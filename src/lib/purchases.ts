// src/lib/purchases.ts
import { supabase } from './supabase';
import { registerMove, getLocations } from './inventory';
import { createPurchaseEntry } from './erp-accounting';

export type PurchaseState = 'draft' | 'confirmed' | 'cancel';

export interface PurchaseLine {
  product_id: number | null;
  description?: string;
  quantity: number;
  price_unit: number;
  discount?: number;
  iva_rate: number;
  location_id?: number | null;
}

export interface CreatePurchaseInput {
  company_id: number;
  partner_id: number;
  date_order: string;
  due_date?: string;
  invoice_ref?: string;
  invoice_auth?: string;
  invoice_date?: string;
  tipo_comprobante?: string;
  sustento_tributario?: string;
  amount_no_iva?: number;
  amount_exento_iva?: number;
  lines: PurchaseLine[];
  notes?: string;
}

export async function getPurchaseOrders(companyId: number) {
  const { data, error } = await supabase
    .from('purchase_order')
    .select(`
      id, name, date_order, invoice_ref, invoice_auth, invoice_date,
      state, amount_untaxed, amount_tax, amount_total,
      ret_numero, ret_estado, ret_autorizacion, ret_ambiente,
      ret_valor_renta, ret_valor_iva, account_move_id,
      partner:res_partner(id, name, vat)
    `)
    .eq('company_id', companyId)
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPurchase(input: CreatePurchaseInput) {
  const amount_untaxed = input.lines.reduce((s, l) => {
    const sub = l.quantity * l.price_unit;
    const desc = sub * ((l.discount || 0) / 100);
    return s + (sub - desc);
  }, 0);
  const amount_tax = input.lines.reduce((s, l) => {
    const sub = l.quantity * l.price_unit;
    const desc = sub * ((l.discount || 0) / 100);
    return s + ((sub - desc) * (l.iva_rate / 100));
  }, 0);
  const amount_total = amount_untaxed + amount_tax + (input.amount_no_iva || 0) + (input.amount_exento_iva || 0);

  const { count } = await supabase.from('purchase_order').select('*', { count: 'exact', head: true }).eq('company_id', input.company_id);
  const seq = String((count ?? 0) + 1).padStart(6, '0');
  const name = `PO/${new Date().getFullYear()}/${seq}`;

  const { data: order, error: orderErr } = await supabase.from('purchase_order').insert([{
    company_id: input.company_id, partner_id: input.partner_id, name,
    date_order: input.date_order, due_date: input.due_date || null,
    invoice_ref: input.invoice_ref || null,
    invoice_auth: input.invoice_auth || null, invoice_date: input.invoice_date || input.date_order,
    tipo_comprobante: input.tipo_comprobante || '01',
    sustento_tributario: input.sustento_tributario || '01',
    state: 'draft' as PurchaseState,
    amount_untaxed: Math.round(amount_untaxed * 100) / 100,
    amount_tax: Math.round(amount_tax * 100) / 100,
    amount_no_iva: Math.round((input.amount_no_iva || 0) * 100) / 100,
    amount_exento_iva: Math.round((input.amount_exento_iva || 0) * 100) / 100,
    amount_total: Math.round(amount_total * 100) / 100,
    notes: input.notes || null,
  }]).select().single();
  if (orderErr) throw orderErr;

  const linesData = input.lines.map(l => {
    const sub = l.quantity * l.price_unit;
    const desc = sub * ((l.discount || 0) / 100);
    return {
      order_id: order.id, product_id: l.product_id || null,
      description: l.description || null, quantity: l.quantity, price_unit: l.price_unit,
      discount: l.discount || 0,
      iva_rate: l.iva_rate, price_subtotal: Math.round((sub - desc) * 100) / 100,
      location_id: l.location_id || null
    };
  });
  const { error: linesErr } = await supabase.from('purchase_order_line').insert(linesData);
  if (linesErr) throw linesErr;
  return order;
}

export async function confirmPurchase(orderId: number) {
  const { data: order, error: orderErr } = await supabase.from('purchase_order').select(`
    id, company_id, state, date_order, name, partner_id,
    invoice_ref, amount_untaxed, amount_tax, amount_total, ret_valor_renta, ret_valor_iva,
    lines:purchase_order_line(id, product_id, quantity, price_unit, location_id)
  `).eq('id', orderId).single();
  if (orderErr) throw orderErr;
  if (!order || order.state !== 'draft') throw new Error('La compra debe estar en borrador para confirmar');

  const locs = await getLocations();
  const internal = locs.find((l: any) => l.usage === 'internal');
  const supplier = locs.find((l: any) => l.usage === 'supplier') || locs.find((l: any) => l.usage === 'inventory');
  const date = order.date_order;

  for (const line of (order.lines || []) as any[]) {
    if (!line.product_id || !supplier) continue;
    const destLocId = line.location_id || internal?.id;
    if (!destLocId) continue;
    
    await registerMove({
      company_id: order.company_id, product_id: line.product_id, move_type: 'in',
      quantity: line.quantity, unit_cost: line.price_unit, date, reference: `PO-${orderId}`,
      location_internal_id: destLocId, location_virtual_id: supplier.id,
    });
  }

  const { error: updErr } = await supabase.from('purchase_order').update({ state: 'confirmed' }).eq('id', orderId);
  if (updErr) throw updErr;

  try {
    const moveId = await createPurchaseEntry({
      company_id: order.company_id, partner_id: order.partner_id, date,
      purchase_name: order.name, invoice_ref: order.invoice_ref,
      amount_untaxed: Number(order.amount_untaxed), amount_tax: Number(order.amount_tax),
      amount_total: Number(order.amount_total),
      ret_renta: Number(order.ret_valor_renta || 0), ret_iva: Number(order.ret_valor_iva || 0),
    });
    await supabase.from('purchase_order').update({ account_move_id: moveId }).eq('id', orderId);
  } catch (e: any) { console.error('Asiento compra falló:', e.message); }
}

export async function cancelPurchase(orderId: number) {
  const { data: order, error } = await supabase.from('purchase_order').select('id, state').eq('id', orderId).single();
  if (error) throw error;
  if (order.state !== 'draft') throw new Error('Solo se puede anular una compra en borrador');
  const { error: updErr } = await supabase.from('purchase_order').update({ state: 'cancel' }).eq('id', orderId);
  if (updErr) throw updErr;
}

export async function savePurchaseRetencion(orderId: number, data: {
  ret_secuencial: number; ret_numero: string; ret_fecha: string; ret_periodo_fiscal: string;
  ret_codigo_renta: string; ret_porcentaje_renta: number; ret_base_renta: number; ret_valor_renta: number;
  ret_porcentaje_iva: number; ret_base_iva: number; ret_valor_iva: number;
  ret_estado: string; ret_autorizacion?: string | null; ret_ambiente: number;
  ret_fecha_aut?: string | null; ret_xml?: string | null;
}) {
  const { error } = await supabase.from('purchase_order').update(data).eq('id', orderId);
  if (error) throw error;
}
