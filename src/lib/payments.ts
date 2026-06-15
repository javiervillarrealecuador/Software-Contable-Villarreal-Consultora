// src/lib/payments.ts
// Registro de cobros (CxC) y pagos (CxP) con asiento contable automático.
//
// Flujo CxC (cobro):
//   Dr  Caja/Bancos   (según método de pago)
//   Cr  Clientes      (cuenta por cobrar)
//
// Flujo CxP (pago):
//   Dr  Proveedores   (cuenta por pagar)
//   Cr  Caja/Bancos

import { supabase } from './supabase';
import { createMove, postMove } from './accounting';
import {
  ACCOUNT_CODES,
  getAccountIdByCode,
  getJournalIdByCode,
} from './erp-accounting';

// ── Métodos de pago (tomados de NIGISU Tipo de Pagos) ────────────────────────
export const PAYMENT_METHODS = [
  { code: 'E', label: 'Efectivo' },
  { code: 'B', label: 'Cheque' },
  { code: 'D', label: 'Depósito / Transferencia' },
  { code: 'C', label: 'Transf. Banco Pichincha' },
  { code: 'A', label: 'Transf. Banco Internacional' },
  { code: 'F', label: 'Transf. Banco Austro' },
  { code: 'U', label: 'Transf. Produbanco' },
  { code: 'T', label: 'Tarjeta de Crédito' },
  { code: 'X', label: 'Cruce de Facturas' },
];

// Efectivo → Caja; cualquier otro → Bancos
function cashAccountCode(method: string) {
  return method === 'E' ? ACCOUNT_CODES.caja : ACCOUNT_CODES.bancos;
}

// ── Listar cuentas por cobrar (ventas entregadas con saldo pendiente) ─────────
export async function getReceivables(companyId: number) {
  const { data, error } = await supabase
    .from('sale_order')
    .select(`
      id, name, date_order, invoice_ref, invoice_auth,
      state, amount_total, amount_paid,
      sri_estado,
      partner:res_partner(id, name, vat)
    `)
    .eq('company_id', companyId)
    .eq('state', 'delivered')
    .order('date_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(o => ({
    ...o,
    amount_residual: Math.round(((o.amount_total || 0) - (o.amount_paid || 0)) * 100) / 100,
  }));
}

// ── Listar cuentas por pagar (compras confirmadas con saldo pendiente) ────────
export async function getPayables(companyId: number) {
  const { data, error } = await supabase
    .from('purchase_order')
    .select(`
      id, name, date_order, invoice_ref, invoice_auth, invoice_date,
      state, amount_total, amount_paid,
      ret_numero, ret_estado,
      partner:res_partner(id, name, vat)
    `)
    .eq('company_id', companyId)
    .eq('state', 'confirmed')
    .order('date_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(o => ({
    ...o,
    amount_residual: Math.round(((o.amount_total || 0) - (o.amount_paid || 0)) * 100) / 100,
  }));
}

// ── Pagos de un documento ─────────────────────────────────────────────────────
export async function getPaymentsForSale(saleOrderId: number) {
  const { data, error } = await supabase
    .from('account_payment')
    .select('id, date, amount, payment_method, reference, notes, state')
    .eq('sale_order_id', saleOrderId)
    .eq('state', 'posted')
    .order('date');
  if (error) throw error;
  return data || [];
}

export async function getPaymentsForPurchase(purchaseOrderId: number) {
  const { data, error } = await supabase
    .from('account_payment')
    .select('id, date, amount, payment_method, reference, notes, state')
    .eq('purchase_order_id', purchaseOrderId)
    .eq('state', 'posted')
    .order('date');
  if (error) throw error;
  return data || [];
}

// ── Registrar cobro (CxC) ─────────────────────────────────────────────────────
export interface RegisterPaymentInput {
  company_id: number;
  partner_id: number;
  date: string;
  amount: number;
  payment_method: string;
  reference?: string;
  notes?: string;
  sale_order_id?: number;
  purchase_order_id?: number;
}

export async function registerCobro(input: RegisterPaymentInput): Promise<void> {
  const { sale_order_id, amount } = input;
  if (!sale_order_id) throw new Error('sale_order_id requerido para cobros');

  // Verificar que no exceda el saldo
  const { data: order } = await supabase
    .from('sale_order')
    .select('amount_total, amount_paid, partner_id, name')
    .eq('id', sale_order_id)
    .single();
  if (!order) throw new Error('Venta no encontrada');
  const saldo = Math.round(((order.amount_total || 0) - (order.amount_paid || 0)) * 100) / 100;
  if (amount > saldo + 0.01) throw new Error(`El monto $${amount} supera el saldo pendiente $${saldo}`);

  // Insertar pago
  const { data: payment, error: payErr } = await supabase
    .from('account_payment')
    .insert([{
      company_id: input.company_id,
      partner_id: order.partner_id,
      payment_type: 'inbound',
      payment_method: input.payment_method,
      date: input.date,
      amount,
      reference: input.reference || null,
      notes: input.notes || null,
      sale_order_id,
      state: 'posted',
    }])
    .select()
    .single();
  if (payErr) throw payErr;

  // Actualizar amount_paid en sale_order
  const newPaid = Math.round(((order.amount_paid || 0) + amount) * 100) / 100;
  await supabase.from('sale_order').update({ amount_paid: newPaid }).eq('id', sale_order_id);

  // Asiento contable
  try {
    const cashCode = cashAccountCode(input.payment_method);
    const [journalId, ctaCash, ctaClientes] = await Promise.all([
      getJournalIdByCode(input.company_id, 'COB'),
      getAccountIdByCode(input.company_id, cashCode),
      getAccountIdByCode(input.company_id, ACCOUNT_CODES.clientes),
    ]);
    const moveId = await createMove(input.company_id, {
      journal_id: journalId,
      date: input.date,
      ref: `Cobro ${order.name}${input.reference ? ' / ' + input.reference : ''}`,
      partner_id: order.partner_id,
      lines: [
        { account_id: ctaCash,      name: `Cobro ${order.name}`, debit: amount, credit: 0 },
        { account_id: ctaClientes,  partner_id: order.partner_id, name: `Cobro ${order.name}`, debit: 0, credit: amount },
      ],
    });
    await postMove(moveId);
    await supabase.from('account_payment').update({ account_move_id: moveId }).eq('id', payment.id);
  } catch (e: any) {
    // Pago ya registrado; asiento contable falla solo si no existen cuentas/diario
    console.warn('Asiento cobro fallido:', e.message);
  }
}

// ── Registrar pago (CxP) ──────────────────────────────────────────────────────
export async function registerPago(input: RegisterPaymentInput): Promise<void> {
  const { purchase_order_id, amount } = input;
  if (!purchase_order_id) throw new Error('purchase_order_id requerido para pagos');

  const { data: order } = await supabase
    .from('purchase_order')
    .select('amount_total, amount_paid, partner_id, name')
    .eq('id', purchase_order_id)
    .single();
  if (!order) throw new Error('Compra no encontrada');
  const saldo = Math.round(((order.amount_total || 0) - (order.amount_paid || 0)) * 100) / 100;
  if (amount > saldo + 0.01) throw new Error(`El monto $${amount} supera el saldo pendiente $${saldo}`);

  const { data: payment, error: payErr } = await supabase
    .from('account_payment')
    .insert([{
      company_id: input.company_id,
      partner_id: order.partner_id,
      payment_type: 'outbound',
      payment_method: input.payment_method,
      date: input.date,
      amount,
      reference: input.reference || null,
      notes: input.notes || null,
      purchase_order_id,
      state: 'posted',
    }])
    .select()
    .single();
  if (payErr) throw payErr;

  const newPaid = Math.round(((order.amount_paid || 0) + amount) * 100) / 100;
  await supabase.from('purchase_order').update({ amount_paid: newPaid }).eq('id', purchase_order_id);

  try {
    const cashCode = cashAccountCode(input.payment_method);
    const [journalId, ctaCash, ctaProveedores] = await Promise.all([
      getJournalIdByCode(input.company_id, 'PAG'),
      getAccountIdByCode(input.company_id, cashCode),
      getAccountIdByCode(input.company_id, ACCOUNT_CODES.proveedores),
    ]);
    const moveId = await createMove(input.company_id, {
      journal_id: journalId,
      date: input.date,
      ref: `Pago ${order.name}${input.reference ? ' / ' + input.reference : ''}`,
      partner_id: order.partner_id,
      lines: [
        { account_id: ctaProveedores, partner_id: order.partner_id, name: `Pago ${order.name}`, debit: amount, credit: 0 },
        { account_id: ctaCash,        name: `Pago ${order.name}`, debit: 0, credit: amount },
      ],
    });
    await postMove(moveId);
    await supabase.from('account_payment').update({ account_move_id: moveId }).eq('id', payment.id);
  } catch (e: any) {
    console.warn('Asiento pago fallido:', e.message);
  }
}

// ── Anular un pago ────────────────────────────────────────────────────────────
export async function cancelPayment(paymentId: number): Promise<void> {
  const { data: pay } = await supabase
    .from('account_payment')
    .select('*')
    .eq('id', paymentId)
    .single();
  if (!pay) throw new Error('Pago no encontrado');
  if (pay.state === 'cancelled') return;

  await supabase.from('account_payment').update({ state: 'cancelled' }).eq('id', paymentId);

  // Revertir amount_paid
  if (pay.sale_order_id) {
    const { data: o } = await supabase.from('sale_order').select('amount_paid').eq('id', pay.sale_order_id).single();
    if (o) await supabase.from('sale_order').update({ amount_paid: Math.max(0, (o.amount_paid || 0) - pay.amount) }).eq('id', pay.sale_order_id);
  }
  if (pay.purchase_order_id) {
    const { data: o } = await supabase.from('purchase_order').select('amount_paid').eq('id', pay.purchase_order_id).single();
    if (o) await supabase.from('purchase_order').update({ amount_paid: Math.max(0, (o.amount_paid || 0) - pay.amount) }).eq('id', pay.purchase_order_id);
  }
}
