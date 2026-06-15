// src/lib/reports.ts
// CAPA 5 — Reportes
//
// CRITERIO GENERAL: todos los reportes contables se construyen desde
// account_move_line de asientos PUBLICADOS (posted). El borrador no afecta
// reportes — el mismo principio por el que un asiento sin publicar no
// aparece en el balance de comprobación.
//
// La clasificación usa el primer dígito del código de cuenta (plan Ecuador):
//   1 Activo · 2 Pasivo · 3 Patrimonio · 4 Ingresos · 5 Costos y Gastos
// Naturaleza: 1 y 5 deudoras (saldo = debe − haber); 2, 3 y 4 acreedoras
// (saldo = haber − debe).

import { supabase } from './supabase';

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Base: líneas de asientos publicados con cuenta ────────────────────────────

async function getPostedLines(companyId: number, dateFrom?: string, dateTo?: string) {
  let query = supabase
    .from('account_move_line')
    .select(`
      account_id, debit, credit, date, name,
      account:account_account(id, code, name),
      move:account_move!inner(id, name, state, ref)
    `)
    .eq('company_id', companyId)
    .eq('move.state', 'posted');
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── 1. Balance de comprobación ────────────────────────────────────────────────

export interface TrialRow { code: string; name: string; debit: number; credit: number; balance: number; }

export async function trialBalance(companyId: number, dateFrom?: string, dateTo?: string): Promise<TrialRow[]> {
  const lines = await getPostedLines(companyId, dateFrom, dateTo);
  const acc: Record<number, TrialRow> = {};
  for (const l of lines as any[]) {
    if (!acc[l.account_id]) acc[l.account_id] = { code: l.account?.code || '', name: l.account?.name || '', debit: 0, credit: 0, balance: 0 };
    acc[l.account_id].debit += Number(l.debit);
    acc[l.account_id].credit += Number(l.credit);
  }
  return Object.values(acc)
    .map(a => ({ ...a, debit: r2(a.debit), credit: r2(a.credit), balance: r2(a.debit - a.credit) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ── 2. Estado de resultados ───────────────────────────────────────────────────

export interface IncomeStatement {
  ingresos: TrialRow[];        // cuentas 4 (saldo acreedor)
  costosGastos: TrialRow[];    // cuentas 5 (saldo deudor)
  totalIngresos: number;
  totalCostosGastos: number;
  utilidad: number;            // ingresos − costos/gastos
}

export async function incomeStatement(companyId: number, dateFrom?: string, dateTo?: string): Promise<IncomeStatement> {
  const rows = await trialBalance(companyId, dateFrom, dateTo);
  const ingresos = rows.filter(r => r.code.startsWith('4'))
    .map(r => ({ ...r, balance: r2(r.credit - r.debit) }));   // naturaleza acreedora
  const costosGastos = rows.filter(r => r.code.startsWith('5'))
    .map(r => ({ ...r, balance: r2(r.debit - r.credit) }));   // naturaleza deudora
  const totalIngresos = r2(ingresos.reduce((s, r) => s + r.balance, 0));
  const totalCostosGastos = r2(costosGastos.reduce((s, r) => s + r.balance, 0));
  return { ingresos, costosGastos, totalIngresos, totalCostosGastos, utilidad: r2(totalIngresos - totalCostosGastos) };
}

// ── 3. Balance general ────────────────────────────────────────────────────────
// A la fecha de corte: activo (1), pasivo (2), patrimonio (3) + resultado del
// ejercicio (4−5 acumulado hasta la fecha) para que cuadre la ecuación
// Activo = Pasivo + Patrimonio.

export interface BalanceSheet {
  activos: TrialRow[];
  pasivos: TrialRow[];
  patrimonio: TrialRow[];
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;     // incluye resultado del ejercicio
  resultadoEjercicio: number;
  cuadre: number;              // totalActivo − (totalPasivo + totalPatrimonio); debe ser 0
}

export async function balanceSheet(companyId: number, asOf?: string): Promise<BalanceSheet> {
  const rows = await trialBalance(companyId, undefined, asOf);
  const activos = rows.filter(r => r.code.startsWith('1'))
    .map(r => ({ ...r, balance: r2(r.debit - r.credit) }));
  const pasivos = rows.filter(r => r.code.startsWith('2'))
    .map(r => ({ ...r, balance: r2(r.credit - r.debit) }));
  const patrimonio = rows.filter(r => r.code.startsWith('3'))
    .map(r => ({ ...r, balance: r2(r.credit - r.debit) }));

  const ingresos = rows.filter(r => r.code.startsWith('4')).reduce((s, r) => s + (r.credit - r.debit), 0);
  const gastos = rows.filter(r => r.code.startsWith('5')).reduce((s, r) => s + (r.debit - r.credit), 0);
  const resultadoEjercicio = r2(ingresos - gastos);

  const totalActivo = r2(activos.reduce((s, r) => s + r.balance, 0));
  const totalPasivo = r2(pasivos.reduce((s, r) => s + r.balance, 0));
  const totalPatrimonio = r2(patrimonio.reduce((s, r) => s + r.balance, 0) + resultadoEjercicio);

  return {
    activos, pasivos, patrimonio,
    totalActivo, totalPasivo, totalPatrimonio, resultadoEjercicio,
    cuadre: r2(totalActivo - (totalPasivo + totalPatrimonio)),
  };
}

// ── 4. Ventas y márgenes ──────────────────────────────────────────────────────

export interface SalesReport {
  porVenta: { name: string; date: string; cliente: string; subtotal: number; costo: number; margen: number; margenPct: number }[];
  porCliente: { cliente: string; ventas: number; costo: number; margen: number }[];
  porProducto: { producto: string; cantidad: number; ventas: number; costo: number; margen: number }[];
  totales: { ventas: number; costo: number; margen: number; margenPct: number };
}

export async function salesReport(companyId: number, dateFrom?: string, dateTo?: string): Promise<SalesReport> {
  let query = supabase
    .from('sale_order')
    .select(`
      id, name, date_order, amount_untaxed, cost_total,
      partner:res_partner(name),
      lines:sale_order_line(quantity, price_subtotal, cost_unit, product:product_product(code, template:product_template(name)))
    `)
    .eq('company_id', companyId)
    .eq('state', 'delivered');
  if (dateFrom) query = query.gte('date_order', dateFrom);
  if (dateTo) query = query.lte('date_order', dateTo);
  const { data, error } = await query;
  if (error) throw error;

  const porVenta = (data || []).map((s: any) => {
    const subtotal = Number(s.amount_untaxed), costo = Number(s.cost_total || 0);
    const margen = r2(subtotal - costo);
    return {
      name: s.name, date: s.date_order, cliente: s.partner?.name || '-',
      subtotal: r2(subtotal), costo: r2(costo), margen,
      margenPct: subtotal > 0 ? r2(margen / subtotal * 100) : 0,
    };
  });

  const cMap: Record<string, { ventas: number; costo: number }> = {};
  const pMap: Record<string, { cantidad: number; ventas: number; costo: number }> = {};
  for (const s of (data || []) as any[]) {
    const cli = s.partner?.name || '-';
    if (!cMap[cli]) cMap[cli] = { ventas: 0, costo: 0 };
    cMap[cli].ventas += Number(s.amount_untaxed);
    cMap[cli].costo += Number(s.cost_total || 0);
    for (const l of s.lines || []) {
      const prod = l.product?.template?.name || l.product?.code || '-';
      if (!pMap[prod]) pMap[prod] = { cantidad: 0, ventas: 0, costo: 0 };
      pMap[prod].cantidad += Number(l.quantity);
      pMap[prod].ventas += Number(l.price_subtotal);
      pMap[prod].costo += Number(l.quantity) * Number(l.cost_unit || 0);
    }
  }

  const totales = porVenta.reduce((t, v) => ({ ventas: t.ventas + v.subtotal, costo: t.costo + v.costo, margen: t.margen + v.margen, margenPct: 0 }),
    { ventas: 0, costo: 0, margen: 0, margenPct: 0 });
  totales.margenPct = totales.ventas > 0 ? r2(totales.margen / totales.ventas * 100) : 0;
  totales.ventas = r2(totales.ventas); totales.costo = r2(totales.costo); totales.margen = r2(totales.margen);

  return {
    porVenta,
    porCliente: Object.entries(cMap).map(([cliente, v]) => ({ cliente, ventas: r2(v.ventas), costo: r2(v.costo), margen: r2(v.ventas - v.costo) })),
    porProducto: Object.entries(pMap).map(([producto, v]) => ({ producto, cantidad: v.cantidad, ventas: r2(v.ventas), costo: r2(v.costo), margen: r2(v.ventas - v.costo) })),
    totales,
  };
}

// ── 5. Inventario valorado ────────────────────────────────────────────────────

export interface InventoryReport {
  items: { code: string; producto: string; cantidad: number; costoPromedio: number; valorTotal: number }[];
  valorTotal: number;
}

export async function inventoryReport(companyId: number): Promise<InventoryReport> {
  const { data, error } = await supabase
    .from('stock_quant')
    .select(`
      quantity, avg_cost,
      location:stock_location!stock_quant_location_id_fkey(usage),
      product:product_product(code, template:product_template(name))
    `)
    .eq('company_id', companyId)
    .gt('quantity', 0);
  if (error) throw error;

  const items = (data || [])
    .filter((q: any) => q.location?.usage === 'internal')
    .map((q: any) => ({
      code: q.product?.code || '',
      producto: q.product?.template?.name || '-',
      cantidad: Number(q.quantity),
      costoPromedio: r2(Number(q.avg_cost)),
      valorTotal: r2(Number(q.quantity) * Number(q.avg_cost)),
    }));
  return { items, valorTotal: r2(items.reduce((s, i) => s + i.valorTotal, 0)) };
}

// ── 6. Mayor de cuenta ────────────────────────────────────────────────────────
// Movimientos cronológicos de UNA cuenta con saldo acumulado según su
// naturaleza (deudora: debe−haber acumulado; acreedora: haber−debe).

export interface LedgerRow { date: string; move: string; ref: string; detalle: string; debit: number; credit: number; saldo: number; }

export async function accountLedger(companyId: number, accountId: number, dateFrom?: string, dateTo?: string):
  Promise<{ account: { code: string; name: string }; rows: LedgerRow[]; totalDebit: number; totalCredit: number; saldoFinal: number }> {

  const { data: account, error: aErr } = await supabase
    .from('account_account').select('id, code, name').eq('id', accountId).single();
  if (aErr) throw aErr;

  let query = supabase
    .from('account_move_line')
    .select(`date, name, debit, credit, move:account_move!inner(name, ref, state)`)
    .eq('company_id', companyId)
    .eq('account_id', accountId)
    .eq('move.state', 'posted')
    .order('date', { ascending: true })
    .order('id', { ascending: true });
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  const { data, error } = await query;
  if (error) throw error;

  const deudora = account.code.startsWith('1') || account.code.startsWith('5');
  let saldo = 0, totalDebit = 0, totalCredit = 0;
  const rows: LedgerRow[] = (data || []).map((l: any) => {
    const d = Number(l.debit), c = Number(l.credit);
    totalDebit += d; totalCredit += c;
    saldo += deudora ? d - c : c - d;
    return { date: l.date, move: l.move?.name || '', ref: l.move?.ref || '', detalle: l.name || '', debit: r2(d), credit: r2(c), saldo: r2(saldo) };
  });

  return { account: { code: account.code, name: account.name }, rows, totalDebit: r2(totalDebit), totalCredit: r2(totalCredit), saldoFinal: r2(saldo) };
}
