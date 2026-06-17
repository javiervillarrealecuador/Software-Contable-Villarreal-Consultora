// src/lib/received-withholding.ts
// CRUD de retenciones recibidas (clientes que retienen a la empresa).
//
// POR QUÉ estos datos afectan el ATS:
//   El SRI en el ATS ventas (campo <valorRetIva> y <valorRetRenta>) exige declarar
//   cuánto le retuvieron al emisor sus propios clientes. Si la empresa vende $1.000
//   y el cliente es agente de retención, este le entrega un comprobante de retención
//   descontando renta e IVA. Esas retenciones reducen el IR a pagar del período.

import { supabase } from './supabase';

export interface ReceivedWithholding {
  id: number;
  company_id: number;
  sale_order_id: number | null;
  partner_id: number | null;
  date: string;
  ret_number: string | null;
  ret_auth: string | null;
  base_renta: number;
  base_iva: number;
  porcentaje_renta: number;
  porcentaje_iva: number;
  valor_ret_renta: number;
  valor_ret_iva: number;
  state: 'registered' | 'cancel';
  notes: string | null;
  account_move_id: number | null;
  created_at: string;
  partner?: { id: number; name: string; vat: string };
  sale?: { id: number; name: string; invoice_ref: string | null };
}

export async function getReceivedWithholdings(companyId: number): Promise<ReceivedWithholding[]> {
  const { data, error } = await supabase
    .from('sale_received_withholding')
    .select(`
      *,
      partner:res_partner(id, name, vat),
      sale:sale_order(id, name, invoice_ref)
    `)
    .eq('company_id', companyId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []) as ReceivedWithholding[];
}

export async function getWithholdingForSale(saleId: number): Promise<ReceivedWithholding | null> {
  const { data, error } = await supabase
    .from('sale_received_withholding')
    .select('*')
    .eq('sale_order_id', saleId)
    .eq('state', 'registered')
    .maybeSingle();
  if (error) throw error;
  return data as ReceivedWithholding | null;
}

export async function createReceivedWithholding(input: {
  company_id: number;
  sale_order_id?: number | null;
  partner_id: number;
  date: string;
  ret_number?: string;
  ret_auth?: string | null;
  base_renta?: number;
  base_iva?: number;
  porcentaje_renta?: number;
  porcentaje_iva?: number;
  valor_ret_renta?: number;
  valor_ret_iva?: number;
  notes?: string | null;
}): Promise<ReceivedWithholding> {
  const { data, error } = await supabase
    .from('sale_received_withholding')
    .insert([{ ...input, state: 'registered' }])
    .select(`*, partner:res_partner(id, name, vat)`)
    .single();
  if (error) throw error;
  return data as ReceivedWithholding;
}

export async function cancelReceivedWithholding(id: number): Promise<void> {
  const { error } = await supabase
    .from('sale_received_withholding')
    .update({ state: 'cancel' })
    .eq('id', id);
  if (error) throw error;
}

// ── Consulta para el ATS ─────────────────────────────────────────────────────
//
// Devuelve todas las retenciones recibidas de un período, agrupadas por
// identificación del cliente (para sumar al ventasMap del ATS).

export interface ReceivedWithholdingByVat {
  vat: string;            // identificación del cliente agente de retención
  valorRetIva: number;
  valorRetRenta: number;
}

export async function getReceivedWithholdingsByPeriod(
  companyId: number, anio: number, mes: number
): Promise<ReceivedWithholdingByVat[]> {
  const from = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const to = `${anio}-${String(mes).padStart(2, '0')}-${lastDay}`;

  const { data, error } = await supabase
    .from('sale_received_withholding')
    .select(`
      valor_ret_renta, valor_ret_iva,
      partner:res_partner(vat)
    `)
    .eq('company_id', companyId)
    .eq('state', 'registered')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;

  // Agrupar por RUC/cédula del cliente
  const map: Record<string, ReceivedWithholdingByVat> = {};
  for (const r of (data || []) as any[]) {
    const vat = r.partner?.vat || '';
    if (!vat) continue;
    if (!map[vat]) map[vat] = { vat, valorRetIva: 0, valorRetRenta: 0 };
    map[vat].valorRetIva += Number(r.valor_ret_iva) || 0;
    map[vat].valorRetRenta += Number(r.valor_ret_renta) || 0;
  }
  return Object.values(map);
}
