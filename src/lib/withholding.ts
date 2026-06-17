// src/lib/withholding.ts
// CAPA 2 - Motor de calculo de retenciones + CRUD comprobantes
//
// LOGICA CENTRAL (el "porque"):
// La retencion en Ecuador es funcion de 3 variables:
//   RETENCION = f(tipo_comprador, tipo_proveedor, concepto)
// - RENTA: depende del CONCEPTO del pago (tabla NAC-DGERCGC26-00000009)
// - IVA: depende del CRUCE comprador x proveedor x bienes/servicios (matriz)
// La retencion IVA se calcula SOBRE EL IVA, no sobre la base.
// La retencion RENTA se calcula SOBRE LA BASE imponible.

import { supabase } from './supabase';
import type {
  RentRule, IvaRule, WithholdCalcInput, WithholdCalcResult, TaxpayerType, IvaTarget,
} from '@/types/capa2';

// ============ REGLAS ============

export async function getRentRules(companyId?: number): Promise<RentRule[]> {
  const { data, error } = await supabase
    .from('l10n_ec_rent_rule')
    .select('*, company_rent_rule_account(account_id, company_id)' as any)
    .eq('active', true)
    .order('percent')
    .order('name');
  if (error) throw error;
  
  return ((data as any[]) || []).map(r => {
    const mapping = r.company_rent_rule_account?.find((m: any) => m.company_id === companyId);
    return { ...r, account_id: mapping?.account_id };
  });
}

export async function getIvaRules(companyId?: number): Promise<IvaRule[]> {
  const { data, error } = await supabase
    .from('l10n_ec_iva_rule')
    .select('*, company_iva_rule_account(account_id, company_id)' as any)
    .eq('active', true)
    .order('buyer_type')
    .order('seller_type')
    .order('target');
  if (error) throw error;
  
  return ((data as any[]) || []).map(r => {
    const mapping = r.company_iva_rule_account?.find((m: any) => m.company_id === companyId);
    return { ...r, account_id: mapping?.account_id };
  });
}

export async function updateIvaRule(id: number, percent: number) {
  const { error } = await supabase
    .from('l10n_ec_iva_rule')
    .update({ percent })
    .eq('id', id);
  if (error) throw error;
}

export async function updateRentRule(id: number, updates: { percent?: number; air_code?: string }) {
  const { error } = await supabase
    .from('l10n_ec_rent_rule')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function setRentRuleAccount(companyId: number, rentRuleId: number, accountId: number | null) {
  if (!accountId) {
    const { error } = await supabase.from('company_rent_rule_account')
      .delete().eq('company_id', companyId).eq('rent_rule_id', rentRuleId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('company_rent_rule_account')
      .upsert({ company_id: companyId, rent_rule_id: rentRuleId, account_id: accountId }, { onConflict: 'company_id, rent_rule_id' });
    if (error) throw error;
  }
}

export async function setIvaRuleAccount(companyId: number, ivaRuleId: number, accountId: number | null) {
  if (!accountId) {
    const { error } = await supabase.from('company_iva_rule_account')
      .delete().eq('company_id', companyId).eq('iva_rule_id', ivaRuleId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('company_iva_rule_account')
      .upsert({ company_id: companyId, iva_rule_id: ivaRuleId, account_id: accountId }, { onConflict: 'company_id, iva_rule_id' });
    if (error) throw error;
  }
}

// ============ MOTOR DE CALCULO ============

/**
 * Busca el porcentaje de retencion IVA en la matriz.
 * Si no hay regla para el cruce exacto, retorna 0 (no retiene).
 */
export function findIvaPercent(
  rules: IvaRule[],
  buyer: TaxpayerType,
  seller: TaxpayerType,
  target: IvaTarget
): number {
  // 1. Busqueda exacta
  const exact = rules.find(r => r.buyer_type === buyer && r.seller_type === seller && r.target === target);
  if (exact) return Number(exact.percent);
  // 2. Casos especiales (prof_fees, rent_property, etc.) suelen estar
  //    registrados con seller persona_natural_no_obligada
  if (target !== 'goods' && target !== 'services') {
    const special = rules.find(r => r.buyer_type === buyer && r.target === target);
    if (special) return Number(special.percent);
  }
  return 0;
}

/**
 * Calcula la retencion completa de una factura de compra.
 * 
 * Ejemplo: factura de honorarios $1000 + IVA 15% ($150), comprador Regimen General:
 * - Retencion RENTA 10% sobre base: $100
 * - Retencion IVA 100% sobre el IVA: $150
 * - Neto a pagar: 1000 + 150 - 100 - 150 = $900
 */
export function calcWithhold(
  input: WithholdCalcInput,
  ivaRules: IvaRule[],
  rentRules: RentRule[]
): WithholdCalcResult {
  const base = input.base_imponible;
  const ivaAmount = Math.round(base * (input.iva_rate / 100) * 100) / 100;

  // Retencion IVA: porcentaje de la matriz aplicado SOBRE EL IVA
  const ivaPct = findIvaPercent(ivaRules, input.buyer_type, input.seller_type, input.target);
  const ivaWithheld = Math.round(ivaAmount * (ivaPct / 100) * 100) / 100;

  // Retencion RENTA: porcentaje de la regla aplicado SOBRE LA BASE
  const rentRule = rentRules.find(r => r.id === input.rent_rule_id);
  const rentPct = rentRule ? Number(rentRule.percent) : 0;
  const rentWithheld = Math.round(base * (rentPct / 100) * 100) / 100;

  const totalWithheld = Math.round((ivaWithheld + rentWithheld) * 100) / 100;
  const netPayable = Math.round((base + ivaAmount - totalWithheld) * 100) / 100;

  return {
    iva_amount: ivaAmount,
    iva_withhold_percent: ivaPct,
    iva_withhold_amount: ivaWithheld,
    rent_withhold_percent: rentPct,
    rent_withhold_amount: rentWithheld,
    total_withheld: totalWithheld,
    net_payable: netPayable,
  };
}

// ============ COMPROBANTES DE RETENCION ============

export async function getWithholds(companyId: number, limit = 50) {
  const { data, error } = await supabase
    .from('l10n_ec_withhold')
    .select(`*, partner:res_partner(id, name, vat)`)
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getWithhold(id: number) {
  const { data, error } = await supabase
    .from('l10n_ec_withhold')
    .select(`*, partner:res_partner(id, name, vat), lines:l10n_ec_withhold_line(*)`)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

interface CreateWithholdInput {
  company_id: number;
  partner_id: number;
  date: string;
  invoice_ref?: string;
  invoice_auth?: string;
  invoice_date?: string;
  base_iva: number;
  base_renta: number;
  lines: {
    tax_type: 'rent' | 'iva';
    rule_code?: string;
    description?: string;
    base: number;
    percent: number;
    amount: number;
  }[];
}

export async function createWithhold(input: CreateWithholdInput) {
  const totalIva = input.lines.filter(l => l.tax_type === 'iva').reduce((s, l) => s + l.amount, 0);
  const totalRent = input.lines.filter(l => l.tax_type === 'rent').reduce((s, l) => s + l.amount, 0);

  // Numero secuencial simple por empresa
  const { count } = await supabase
    .from('l10n_ec_withhold')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', input.company_id);

  const number = `RET-${String((count || 0) + 1).padStart(6, '0')}`;

  const { data: wh, error } = await supabase
    .from('l10n_ec_withhold')
    .insert([{
      company_id: input.company_id,
      partner_id: input.partner_id,
      number,
      date: input.date,
      invoice_ref: input.invoice_ref || null,
      invoice_auth: input.invoice_auth || null,
      invoice_date: input.invoice_date || null,
      base_iva: input.base_iva,
      base_renta: input.base_renta,
      total_iva_withheld: Math.round(totalIva * 100) / 100,
      total_rent_withheld: Math.round(totalRent * 100) / 100,
      state: 'draft',
    }])
    .select()
    .single();
  if (error) throw error;

  const lines = input.lines.map(l => ({ ...l, withhold_id: wh.id }));
  const { error: lineErr } = await supabase.from('l10n_ec_withhold_line').insert(lines);
  if (lineErr) {
    await supabase.from('l10n_ec_withhold').delete().eq('id', wh.id);
    throw lineErr;
  }
  return wh;
}

export async function postWithhold(id: number) {
  const { error } = await supabase
    .from('l10n_ec_withhold')
    .update({ state: 'posted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('state', 'draft');
  if (error) throw error;
}
