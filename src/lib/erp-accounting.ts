// src/lib/erp-accounting.ts
// Asientos contables automáticos para ventas (entrega), compras (recepción),
// notas de crédito (reverso) y notas de débito (recargo).
//
// Diseño:
// - Un solo asiento por documento, publicado al crearse.
// - Las cuentas se resuelven por CÓDIGO (no por id), para que el mapeo
//   sobreviva a recreaciones del plan de cuentas. Si cambias el plan,
//   ajusta ACCOUNT_CODES.
// - El diario se resuelve por código (VEN / COM).

import { supabase } from './supabase';
import { createMove, postMove } from './accounting';

// ── Mapeo de cuentas del plan (por código) ────────────────────────────────────
export const ACCOUNT_CODES = {
  clientes:        '1.01.02.01', // Clientes Locales
  ventas:          '4.01.01',    // Venta de Bienes
  ivaDebito:       '2.01.07.01', // IVA Débito Tributario
  costoVentas:     '5.01.01',    // Costo Ventas Bienes
  inventario:      '1.01.03.01', // Inventario de Mercancías
  proveedores:     '2.01.03.01', // Proveedores Locales
  ivaCredito:      '1.01.05.01', // IVA Crédito Tributario
  otrosIngresos:   '4.03.01',    // Otros Ingresos - Intereses y Recargos (ND)
  retRentaPagar:   '2.01.07.02', // Retenciones en la Fuente por Pagar
  retIvaPagar:     '2.01.07.03', // Retenciones de IVA por Pagar
  caja:            '1.01.01.01', // Caja General
  bancos:          '1.01.01.02', // Bancos
} as const;

const JOURNAL_CODES = { ventas: 'VEN', compras: 'COM', cobros: 'COB', pagos: 'PAG' } as const;

// ── Helpers de resolución ─────────────────────────────────────────────────────

export async function getAccountIdByCode(companyId: number, code: string): Promise<number> {
  const { data, error } = await supabase
    .from('account_account')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('active', true)
    .single();
  if (error || !data) throw new Error(`Cuenta contable ${code} no encontrada en el plan. Revisa ACCOUNT_CODES.`);
  return data.id;
}

export async function getJournalIdByCode(companyId: number, code: string): Promise<number> {
  const { data, error } = await supabase
    .from('account_journal')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('active', true)
    .single();
  if (error || !data) throw new Error(`Diario ${code} no encontrado. Crea el diario o ajusta JOURNAL_CODES.`);
  return data.id;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Asiento de VENTA (al entregar) ────────────────────────────────────────────
// Debe : Clientes        (total con IVA)
// Haber: Ventas          (subtotal sin IVA)
// Haber: IVA Débito      (IVA)            [solo si IVA > 0]
// Debe : Costo de Ventas (costo promedio) [solo si hay costo]
// Haber: Inventario      (costo promedio)

export interface SaleEntryInput {
  company_id: number;
  partner_id: number;
  date: string;            // fecha de la entrega
  sale_name: string;       // SO/2026/000001
  invoice_ref?: string | null;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  cost_total: number;
}

export async function createSaleEntry(input: SaleEntryInput): Promise<number> {
  const [journalId, ctaClientes, ctaVentas, ctaIva, ctaCosto, ctaInventario] = await Promise.all([
    getJournalIdByCode(input.company_id, JOURNAL_CODES.ventas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.clientes),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ventas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ivaDebito),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.costoVentas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.inventario),
  ]);

  const lines: any[] = [
    { account_id: ctaClientes, partner_id: input.partner_id, name: `Venta ${input.sale_name}`, debit: r2(input.amount_total), credit: 0 },
    { account_id: ctaVentas,   partner_id: input.partner_id, name: `Venta ${input.sale_name}`, debit: 0, credit: r2(input.amount_untaxed) },
  ];
  if (input.amount_tax > 0) {
    lines.push({ account_id: ctaIva, name: `IVA venta ${input.sale_name}`, debit: 0, credit: r2(input.amount_tax) });
  }
  if (input.cost_total > 0) {
    lines.push({ account_id: ctaCosto,      name: `Costo venta ${input.sale_name}`, debit: r2(input.cost_total), credit: 0 });
    lines.push({ account_id: ctaInventario, name: `Salida inventario ${input.sale_name}`, debit: 0, credit: r2(input.cost_total) });
  }

  const move = await createMove(input.company_id, {
    journal_id: journalId,
    date: input.date,
    ref: input.invoice_ref ? `Fact. ${input.invoice_ref}` : input.sale_name,
    narration: `Asiento automático por entrega de ${input.sale_name}`,
    partner_id: input.partner_id,
    lines,
  });

  await postMove(move.id);
  return move.id;
}

// ── Asiento de COMPRA (al recibir) ────────────────────────────────────────────
// Debe : Inventario   (subtotal sin IVA — al costo)
// Debe : IVA Crédito  (IVA)               [solo si IVA > 0]
// Haber: Proveedores  (total con IVA)

export interface PurchaseEntryInput {
  company_id: number;
  partner_id: number;
  date: string;            // fecha de la recepción
  purchase_name: string;   // PO/2026/000001
  invoice_ref?: string | null;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  ret_renta?: number;      // valor retenido renta (reduce lo que se le paga al proveedor)
  ret_iva?: number;        // valor retenido IVA
}

// Asiento de COMPRA con retenciones:
// Debe : Inventario      (subtotal sin IVA)
// Debe : IVA Crédito     (IVA compra)       [si IVA > 0]
// Haber: Proveedores     (total - ret_renta - ret_iva)
// Haber: Ret. Renta PP   (ret_renta)        [si > 0]
// Haber: Ret. IVA PP     (ret_iva)          [si > 0]
export async function createPurchaseEntry(input: PurchaseEntryInput): Promise<number> {
  const retRenta = r2(input.ret_renta || 0);
  const retIva   = r2(input.ret_iva   || 0);
  const netoProv = r2(input.amount_total - retRenta - retIva);

  // Cuentas de retención opcionales (si no existen en el plan, se ignoran)
  const [journalId, ctaInventario, ctaIvaCred, ctaProveedores] = await Promise.all([
    getJournalIdByCode(input.company_id, JOURNAL_CODES.compras),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.inventario),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ivaCredito),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.proveedores),
  ]);

  let ctaRetRenta: number | null = null;
  let ctaRetIva:   number | null = null;
  if (retRenta > 0) {
    try { ctaRetRenta = await getAccountIdByCode(input.company_id, ACCOUNT_CODES.retRentaPagar); }
    catch { /* cuenta no creada aún; el valor se añade a proveedores */ }
  }
  if (retIva > 0) {
    try { ctaRetIva = await getAccountIdByCode(input.company_id, ACCOUNT_CODES.retIvaPagar); }
    catch { /* cuenta no creada aún */ }
  }

  const lines: any[] = [
    { account_id: ctaInventario, name: `Ingreso inventario ${input.purchase_name}`, debit: r2(input.amount_untaxed), credit: 0 },
  ];
  if (input.amount_tax > 0) {
    lines.push({ account_id: ctaIvaCred, name: `IVA compra ${input.purchase_name}`, debit: r2(input.amount_tax), credit: 0 });
  }

  // Proveedor: neto a pagar (si no hay cuentas de retención, recibe el total)
  const creditoProv = ctaRetRenta || ctaRetIva ? netoProv : r2(input.amount_total);
  lines.push({ account_id: ctaProveedores, partner_id: input.partner_id, name: `Compra ${input.purchase_name}`, debit: 0, credit: creditoProv });

  if (retRenta > 0 && ctaRetRenta) {
    lines.push({ account_id: ctaRetRenta, name: `Ret. Renta ${input.purchase_name}`, debit: 0, credit: retRenta });
  }
  if (retIva > 0 && ctaRetIva) {
    lines.push({ account_id: ctaRetIva, name: `Ret. IVA ${input.purchase_name}`, debit: 0, credit: retIva });
  }

  const move = await createMove(input.company_id, {
    journal_id: journalId,
    date: input.date,
    ref: input.invoice_ref ? `Fact. ${input.invoice_ref}` : input.purchase_name,
    narration: `Asiento automático por recepción de ${input.purchase_name}`,
    partner_id: input.partner_id,
    lines,
  });

  await postMove(move.id);
  return move.id;
}

// ── Asiento de NOTA DE CRÉDITO (reverso de la venta) ─────────────────────────
// Espejo exacto del asiento de venta, con débitos y créditos invertidos:
// Debe : Ventas (subtotal) + IVA Débito (IVA)   [reversa el ingreso]
// Haber: Clientes (total)                        [reduce la cuenta por cobrar]
// Debe : Inventario (costo)                      [la mercadería vuelve]
// Haber: Costo de Ventas (costo)                 [reversa el costo]

export interface NotaCreditoEntryInput {
  company_id: number;
  partner_id: number;
  date: string;
  nc_numero: string;           // 002-001-000000001
  sale_name: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  cost_total: number;
}

export async function createNotaCreditoEntry(input: NotaCreditoEntryInput): Promise<number> {
  const [journalId, ctaClientes, ctaVentas, ctaIva, ctaCosto, ctaInventario] = await Promise.all([
    getJournalIdByCode(input.company_id, JOURNAL_CODES.ventas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.clientes),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ventas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ivaDebito),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.costoVentas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.inventario),
  ]);

  const lines: any[] = [
    { account_id: ctaVentas,   partner_id: input.partner_id, name: `NC ${input.nc_numero} reversa ${input.sale_name}`, debit: r2(input.amount_untaxed), credit: 0 },
  ];
  if (input.amount_tax > 0) {
    lines.push({ account_id: ctaIva, name: `NC ${input.nc_numero} IVA`, debit: r2(input.amount_tax), credit: 0 });
  }
  lines.push({ account_id: ctaClientes, partner_id: input.partner_id, name: `NC ${input.nc_numero}`, debit: 0, credit: r2(input.amount_total) });
  if (input.cost_total > 0) {
    lines.push({ account_id: ctaInventario, name: `NC ${input.nc_numero} reingreso inventario`, debit: r2(input.cost_total), credit: 0 });
    lines.push({ account_id: ctaCosto,      name: `NC ${input.nc_numero} reversa costo`, debit: 0, credit: r2(input.cost_total) });
  }

  const move = await createMove(input.company_id, {
    journal_id: journalId,
    date: input.date,
    ref: `NC ${input.nc_numero}`,
    narration: `Asiento automático por nota de crédito ${input.nc_numero} (reverso de ${input.sale_name})`,
    partner_id: input.partner_id,
    lines,
  });

  await postMove(move.id);
  return move.id;
}

// ── Asiento de NOTA DE DÉBITO (recargo al cliente) ───────────────────────────
// Debe : Clientes (total con IVA)
// Haber: Otros Ingresos (base)
// Haber: IVA Débito (IVA)

export interface NotaDebitoEntryInput {
  company_id: number;
  partner_id: number;
  date: string;
  nd_numero: string;
  razon: string;
  base: number;
  iva: number;
}

export async function createNotaDebitoEntry(input: NotaDebitoEntryInput): Promise<number> {
  const [journalId, ctaClientes, ctaOtros, ctaIva] = await Promise.all([
    getJournalIdByCode(input.company_id, JOURNAL_CODES.ventas),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.clientes),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.otrosIngresos),
    getAccountIdByCode(input.company_id, ACCOUNT_CODES.ivaDebito),
  ]);

  const total = r2(input.base + input.iva);
  const lines: any[] = [
    { account_id: ctaClientes, partner_id: input.partner_id, name: `ND ${input.nd_numero} ${input.razon}`, debit: total, credit: 0 },
    { account_id: ctaOtros, name: `ND ${input.nd_numero} ${input.razon}`, debit: 0, credit: r2(input.base) },
  ];
  if (input.iva > 0) {
    lines.push({ account_id: ctaIva, name: `ND ${input.nd_numero} IVA`, debit: 0, credit: r2(input.iva) });
  }

  const move = await createMove(input.company_id, {
    journal_id: journalId,
    date: input.date,
    ref: `ND ${input.nd_numero}`,
    narration: `Asiento automático por nota de débito ${input.nd_numero}: ${input.razon}`,
    partner_id: input.partner_id,
    lines,
  });

  await postMove(move.id);
  return move.id;
}
