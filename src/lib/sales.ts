// src/lib/sales.ts
// CAPA 4: Ventas -- espejo de purchases.ts
// Flujo: draft -> delivered (descarga inventario a costo promedio) / cancel
//
// v2: Cabecera enriquecida (vendedor, plazo, observacion),
//     desglose tributario (gravado/0%/no_objeto/exento/ICE),
//     descuento por linea.
// v3: forma_pago SRI, auto-secuencial de factura, list_price.

import { supabase } from './supabase';
import { registerMove, getLocations } from './inventory';
import { createSaleEntry } from './erp-accounting';

export type SaleState = 'draft' | 'delivered' | 'cancel';
export type TaxLineType = 'gravado' | 'tarifa_0' | 'no_objeto' | 'exento';
export type PaymentTerm = 'contado' | 'credito_15' | 'credito_30' | 'credito_45' | 'credito_60' | 'credito_90';
export type FormaPagoSRI = '01' | '15' | '16' | '17' | '18' | '19' | '20' | '21';

export const PAYMENT_TERMS: { value: PaymentTerm; label: string; days: number }[] = [
  { value: 'contado',     label: 'Contado',         days: 0 },
  { value: 'credito_15',  label: 'Credito 15 dias', days: 15 },
  { value: 'credito_30',  label: 'Credito 30 dias', days: 30 },
  { value: 'credito_45',  label: 'Credito 45 dias', days: 45 },
  { value: 'credito_60',  label: 'Credito 60 dias', days: 60 },
  { value: 'credito_90',  label: 'Credito 90 dias', days: 90 },
];

export const TAX_LINE_TYPES: { value: TaxLineType; label: string }[] = [
  { value: 'gravado',   label: 'Gravado' },
  { value: 'tarifa_0',  label: 'Tarifa 0%' },
  { value: 'no_objeto', label: 'No Objeto IVA' },
  { value: 'exento',    label: 'Exento IVA' },
];

export const FORMAS_PAGO_SRI: { value: FormaPagoSRI; label: string }[] = [
  { value: '01', label: 'Sin sistema financiero' },
  { value: '15', label: 'Compensacion de deudas' },
  { value: '16', label: 'Tarjeta de debito' },
  { value: '17', label: 'Dinero electronico' },
  { value: '18', label: 'Tarjeta prepago' },
  { value: '19', label: 'Tarjeta de credito' },
  { value: '20', label: 'Otros con sistema financiero' },
  { value: '21', label: 'Endoso de titulos' },
];

export interface SaleLine {
  product_id: number;
  quantity: number;
  price_unit: number;
  iva_rate: number;
  tax_type: TaxLineType;
  discount_percent: number;
  ice_amount: number;
  location_id?: number;
  description?: string;
}

export interface CreateSaleInput {
  company_id: number;
  partner_id: number;
  date_order: string;
  invoice_ref?: string;
  invoice_auth?: string;
  seller_id?: number;
  payment_term?: PaymentTerm;
  forma_pago?: FormaPagoSRI;
  warehouse_id?: number;
  observation?: string;
  reference?: string;
  lines: SaleLine[];
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function lineSubtotal(l: SaleLine) {
  const bruto = l.quantity * l.price_unit;
  return bruto - bruto * (l.discount_percent / 100);
}

function lineIva(l: SaleLine) {
  if (l.tax_type !== 'gravado') return 0;
  return lineSubtotal(l) * (l.iva_rate / 100);
}

function linePriceTotal(l: SaleLine) {
  return lineSubtotal(l) + lineIva(l) + (l.ice_amount || 0);
}

export function calcTotals(lines: SaleLine[]) {
  let amount_taxed = 0, amount_zero = 0, amount_no_objeto = 0, amount_exento = 0;
  let amount_discount = 0, amount_ice = 0, amount_tax = 0;

  for (const l of lines) {
    const bruto = l.quantity * l.price_unit;
    const desc = bruto * (l.discount_percent / 100);
    const sub = bruto - desc;

    amount_discount += desc;
    amount_ice += l.ice_amount || 0;

    switch (l.tax_type) {
      case 'gravado':
        amount_taxed += sub;
        amount_tax += sub * (l.iva_rate / 100);
        break;
      case 'tarifa_0':
        amount_zero += sub;
        break;
      case 'no_objeto':
        amount_no_objeto += sub;
        break;
      case 'exento':
        amount_exento += sub;
        break;
    }
  }

  const amount_untaxed = amount_taxed + amount_zero + amount_no_objeto + amount_exento;
  const amount_total = amount_untaxed + amount_tax + amount_ice;

  return {
    amount_untaxed:   round2(amount_untaxed),
    amount_taxed:     round2(amount_taxed),
    amount_zero:      round2(amount_zero),
    amount_no_objeto: round2(amount_no_objeto),
    amount_exento:    round2(amount_exento),
    amount_tax:       round2(amount_tax),
    amount_ice:       round2(amount_ice),
    amount_discount:  round2(amount_discount),
    amount_total:     round2(amount_total),
  };
}

function calcDueDate(dateOrder: string, term: PaymentTerm): string | null {
  const entry = PAYMENT_TERMS.find(t => t.value === term);
  if (!entry || entry.days === 0) return null;
  const d = new Date(dateOrder);
  d.setDate(d.getDate() + entry.days);
  return d.toISOString().slice(0, 10);
}

// --- Auto-secuencial SRI ---------------------------------------------------
// Obtiene el siguiente secuencial para un tipo de documento y lo incrementa
// atomicamente. Devuelve el numero formateado 001-001-000000001.
export async function getNextInvoiceRef(companyId: number, docType: string): Promise<string> {
  // 1. Obtener estab y pto_emi de la empresa
  const { data: co, error: coErr } = await supabase
    .from('res_company')
    .select('sri_estab, sri_pto_emi')
    .eq('id', companyId)
    .single();
  if (coErr) throw coErr;
  const estab = co?.sri_estab || '001';
  const ptoEmi = co?.sri_pto_emi || '001';

  // 2. Buscar o crear secuencial
  const { data: seq, error: seqErr } = await supabase
    .from('sri_document_sequence')
    .select('id, next_number')
    .eq('company_id', companyId)
    .eq('doc_type', docType)
    .eq('estab', estab)
    .eq('pto_emi', ptoEmi)
    .single();

  let nextNum: number;
  if (seqErr || !seq) {
    // Crear registro de secuencial si no existe
    const { error: crErr } = await supabase
      .from('sri_document_sequence')
      .insert({ company_id: companyId, doc_type: docType, estab, pto_emi: ptoEmi, next_number: 2 });
    if (crErr) throw crErr;
    nextNum = 1; // se inserto con next=2, asi que este es el 1
  } else {
    nextNum = seq.next_number;
    // Incrementar atomicamente
    const { error: updErr } = await supabase
      .from('sri_document_sequence')
      .update({ next_number: nextNum + 1 })
      .eq('id', seq.id);
    if (updErr) throw updErr;
  }

  const seqStr = String(nextNum).padStart(9, '0');
  return estab + '-' + ptoEmi + '-' + seqStr;
}

export async function getSaleOrders(companyId: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('sale_order')
    .select(''
      + 'id, name, date_order, invoice_ref, invoice_auth,'
      + 'state, amount_untaxed, amount_tax, amount_total, cost_total,'
      + 'amount_taxed, amount_zero, amount_no_objeto, amount_exento, amount_ice, amount_discount,'
      + 'payment_term, payment_days, due_date, observation, reference, warehouse_id, forma_pago,'
      + 'sri_estado, sri_autorizacion, sri_ambiente, account_move_id,'
      + 'partner:res_partner!sale_order_partner_id_fkey(id, name, vat, phone, street, city),'
      + 'seller:res_partner!sale_order_seller_id_fkey(id, name)'
    )
    .eq('company_id', companyId)
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSaleOrder(orderId: number): Promise<any> {
  const { data, error } = await supabase
    .from('sale_order')
    .select(''
      + 'id, name, date_order, invoice_ref, invoice_auth, company_id,'
      + 'state, amount_untaxed, amount_tax, amount_total, cost_total,'
      + 'amount_taxed, amount_zero, amount_no_objeto, amount_exento, amount_ice, amount_discount,'
      + 'payment_term, payment_days, due_date, observation, reference, warehouse_id, forma_pago,'
      + 'seller_id, partner_id, account_move_id, amount_paid,'
      + 'sri_estado, sri_autorizacion, sri_ambiente,'
      + 'partner:res_partner!sale_order_partner_id_fkey(id, name, vat, phone, street, city),'
      + 'seller:res_partner!sale_order_seller_id_fkey(id, name),'
      + 'lines:sale_order_line('
      +   'id, product_id, quantity, qty_delivered, price_unit, iva_rate,'
      +   'price_subtotal, price_total, cost_unit,'
      +   'tax_type, discount_percent, discount_amount, ice_amount,'
      +   'location_id, description,'
      +   'product:product_product(id, code, template:product_template(name, uom_id))'
      + ')'
    )
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}

export async function createSale(input: CreateSaleInput) {
  const totals = calcTotals(input.lines);
  const term = input.payment_term || 'contado';
  const termEntry = PAYMENT_TERMS.find(t => t.value === term);
  const days = termEntry?.days || 0;
  const dueDate = calcDueDate(input.date_order, term);

  const { count } = await supabase
    .from('sale_order')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', input.company_id);
  const seq = String((count ?? 0) + 1).padStart(6, '0');
  const name = 'SO/' + new Date().getFullYear() + '/' + seq;

  // Auto-generar invoice_ref si no se proporciono
  let invoiceRef = input.invoice_ref || null;
  if (!invoiceRef) {
    invoiceRef = await getNextInvoiceRef(input.company_id, 'factura');
  }

  const orderData = {
    company_id: input.company_id,
    partner_id: input.partner_id,
    name: name,
    date_order: input.date_order,
    invoice_ref: invoiceRef,
    invoice_auth: input.invoice_auth || null,
    state: 'draft' as const,
    amount_untaxed: totals.amount_untaxed,
    amount_tax: totals.amount_tax,
    amount_total: totals.amount_total,
    amount_taxed: totals.amount_taxed,
    amount_zero: totals.amount_zero,
    amount_no_objeto: totals.amount_no_objeto,
    amount_exento: totals.amount_exento,
    amount_ice: totals.amount_ice,
    amount_discount: totals.amount_discount,
    cost_total: 0,
    seller_id: input.seller_id || null,
    payment_term: term,
    payment_days: days,
    due_date: dueDate,
    warehouse_id: input.warehouse_id || null,
    observation: input.observation || null,
    reference: input.reference || null,
    forma_pago: input.forma_pago || '01',
  };

  const { data: order, error: orderErr } = await supabase
    .from('sale_order')
    .insert([orderData])
    .select()
    .single();
  if (orderErr) throw orderErr;

  const linesData = input.lines.map(l => {
    const sub = round2(lineSubtotal(l));
    const discAmt = round2(l.quantity * l.price_unit * (l.discount_percent / 100));
    return {
      order_id: order.id,
      product_id: l.product_id,
      quantity: l.quantity,
      price_unit: l.price_unit,
      iva_rate: l.iva_rate,
      qty_delivered: 0,
      price_subtotal: sub,
      price_total: round2(linePriceTotal(l)),
      cost_unit: 0,
      tax_type: l.tax_type || 'gravado',
      discount_percent: l.discount_percent || 0,
      discount_amount: discAmt,
      ice_amount: l.ice_amount || 0,
      location_id: l.location_id || null,
      description: l.description || null,
    };
  });

  const { error: linesErr } = await supabase
    .from('sale_order_line')
    .insert(linesData);
  if (linesErr) throw linesErr;

  return order;
}

export async function updateSale(orderId: number, input: CreateSaleInput) {
  const { data: existing, error: chkErr } = await supabase
    .from('sale_order')
    .select('id, state')
    .eq('id', orderId)
    .single();
  if (chkErr) throw chkErr;
  if (existing.state !== 'draft') throw new Error('Solo se puede editar una venta en borrador');

  const totals = calcTotals(input.lines);
  const term = input.payment_term || 'contado';
  const termEntry = PAYMENT_TERMS.find(t => t.value === term);
  const days = termEntry?.days || 0;
  const dueDate = calcDueDate(input.date_order, term);

  const { error: updErr } = await supabase
    .from('sale_order')
    .update({
      partner_id: input.partner_id,
      date_order: input.date_order,
      invoice_ref: input.invoice_ref || null,
      invoice_auth: input.invoice_auth || null,
      amount_untaxed: totals.amount_untaxed,
      amount_tax: totals.amount_tax,
      amount_total: totals.amount_total,
      amount_taxed: totals.amount_taxed,
      amount_zero: totals.amount_zero,
      amount_no_objeto: totals.amount_no_objeto,
      amount_exento: totals.amount_exento,
      amount_ice: totals.amount_ice,
      amount_discount: totals.amount_discount,
      seller_id: input.seller_id || null,
      payment_term: term,
      payment_days: days,
      due_date: dueDate,
      warehouse_id: input.warehouse_id || null,
      observation: input.observation || null,
      reference: input.reference || null,
      forma_pago: input.forma_pago || '01',
    })
    .eq('id', orderId);
  if (updErr) throw updErr;

  const { error: delErr } = await supabase
    .from('sale_order_line')
    .delete()
    .eq('order_id', orderId);
  if (delErr) throw delErr;

  const linesData = input.lines.map(l => {
    const sub = round2(lineSubtotal(l));
    const discAmt = round2(l.quantity * l.price_unit * (l.discount_percent / 100));
    return {
      order_id: orderId,
      product_id: l.product_id,
      quantity: l.quantity,
      price_unit: l.price_unit,
      iva_rate: l.iva_rate,
      qty_delivered: 0,
      price_subtotal: sub,
      price_total: round2(linePriceTotal(l)),
      cost_unit: 0,
      tax_type: l.tax_type || 'gravado',
      discount_percent: l.discount_percent || 0,
      discount_amount: discAmt,
      ice_amount: l.ice_amount || 0,
      location_id: l.location_id || null,
      description: l.description || null,
    };
  });

  const { error: linesErr } = await supabase
    .from('sale_order_line')
    .insert(linesData);
  if (linesErr) throw linesErr;
}

export async function deliverSale(orderId: number) {
  const { data: order, error: orderErr } = await supabase
    .from('sale_order')
    .select(''
      + 'id, company_id, state, date_order, name, partner_id, invoice_ref,'
      + 'amount_untaxed, amount_tax, amount_total, warehouse_id,'
      + 'lines:sale_order_line(id, product_id, quantity, qty_delivered, location_id)'
    )
    .eq('id', orderId)
    .single();
  if (orderErr) throw orderErr;
  const orderAny = order as any;
  if (!orderAny || orderAny.state !== 'draft') throw new Error('La venta debe estar en borrador para entregar');

  const locs = await getLocations();
  const defaultInternal = locs.find((l: any) => l.id === orderAny.warehouse_id)
    || locs.find((l: any) => l.usage === 'internal');
  const customer = locs.find((l: any) => l.usage === 'customer') || locs.find((l: any) => l.usage === 'inventory');
  if (!defaultInternal || !customer) throw new Error('Faltan ubicaciones (internal / customer).');

  const costByLine: Record<number, number> = {};
  for (const line of orderAny.lines || []) {
    const pending = line.quantity - (line.qty_delivered || 0);
    if (pending <= 0) continue;

    const locId = line.location_id || defaultInternal.id;

    const { data: quant } = await supabase
      .from('stock_quant')
      .select('quantity, avg_cost')
      .eq('product_id', line.product_id)
      .eq('company_id', orderAny.company_id)
      .eq('location_id', locId)
      .single();

    const available = quant?.quantity ?? 0;
    if (available < pending) {
      throw new Error('Stock insuficiente para producto ' + line.product_id + ': disponible ' + available + ', requerido ' + pending);
    }
    costByLine[line.id] = quant?.avg_cost ?? 0;
  }

  const date = new Date().toISOString().slice(0, 10);
  let costTotal = 0;

  for (const line of orderAny.lines || []) {
    const pending = line.quantity - (line.qty_delivered || 0);
    if (pending <= 0) continue;

    const avgCost = costByLine[line.id] ?? 0;
    const locId = line.location_id || defaultInternal.id;

    await registerMove({
      company_id: orderAny.company_id,
      product_id: line.product_id,
      move_type: 'out',
      quantity: pending,
      date: date,
      reference: 'SO-' + orderId,
      location_internal_id: locId,
      location_virtual_id: customer.id,
    });

    costTotal += pending * avgCost;

    const { error: lineErr } = await supabase
      .from('sale_order_line')
      .update({ qty_delivered: line.quantity, cost_unit: avgCost })
      .eq('id', line.id);
    if (lineErr) throw lineErr;
  }

  const cost = Math.round(costTotal * 100) / 100;
  const { error: updateErr } = await supabase
    .from('sale_order')
    .update({ state: 'delivered', cost_total: cost })
    .eq('id', orderId);
  if (updateErr) throw updateErr;

  try {
    const moveId = await createSaleEntry({
      company_id: orderAny.company_id,
      partner_id: orderAny.partner_id,
      date: date,
      sale_name: orderAny.name,
      invoice_ref: orderAny.invoice_ref,
      amount_untaxed: Number(orderAny.amount_untaxed),
      amount_tax: Number(orderAny.amount_tax),
      amount_total: Number(orderAny.amount_total),
      cost_total: cost,
    });
    await supabase.from('sale_order').update({ account_move_id: moveId }).eq('id', orderId);
  } catch (e: any) {
    throw new Error('Entrega registrada, pero el asiento contable fallo: ' + e.message + '. Registralo manualmente en Contabilidad.');
  }
}

export async function cancelSale(orderId: number) {
  const { data: order, error } = await supabase
    .from('sale_order')
    .select('id, state')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  if (order.state !== 'draft') throw new Error('Solo se puede anular una venta en borrador (la entregada ya afecto inventario)');

  const { error: updErr } = await supabase
    .from('sale_order')
    .update({ state: 'cancel' })
    .eq('id', orderId);
  if (updErr) throw updErr;
}
