// src/app/reports/page.tsx
// CAPA 5 — Reportes e IA
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAccounts } from '@/lib/accounting';
import {
  trialBalance, incomeStatement, balanceSheet, salesReport, inventoryReport, accountLedger,
  type TrialRow, type IncomeStatement, type BalanceSheet, type SalesReport, type InventoryReport,
} from '@/lib/reports';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1280px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.6rem', textAlign: 'left' as const, fontSize: '0.72rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.5rem 0.6rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.86rem' },
  tdNum: { padding: '0.5rem 0.6rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.86rem', textAlign: 'right' as const, fontFamily: 'monospace' },
  totalRow: { fontWeight: 700, background: '#f8fafc' },
};

const TABS = [
  { id: 'trial', label: 'Comprobación' },
  { id: 'income', label: 'Resultados' },
  { id: 'balance', label: 'Balance General' },
  { id: 'sales', label: 'Ventas y Márgenes' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'ledger', label: 'Mayores' },
] as const;

type TabId = typeof TABS[number]['id'];
const COMPANY = 1;
const money = (n: number) => `$${n.toFixed(2)}`;

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>('trial');
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  const [trial, setTrial] = useState<TrialRow[]>([]);
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [balance, setBalance] = useState<BalanceSheet | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState(0);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof accountLedger>> | null>(null);

  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { getAccounts(COMPANY).then(a => setAccounts(a || [])).catch(console.error); }, []);
  useEffect(() => { setAiText(''); load(); /* eslint-disable-next-line */ }, [tab]);

  async function load() {
    try {
      setLoading(true);
      if (tab === 'trial') setTrial(await trialBalance(COMPANY, from, to));
      if (tab === 'income') setIncome(await incomeStatement(COMPANY, from, to));
      if (tab === 'balance') setBalance(await balanceSheet(COMPANY, to));
      if (tab === 'sales') setSales(await salesReport(COMPANY, from, to));
      if (tab === 'inventory') setInventory(await inventoryReport(COMPANY));
      if (tab === 'ledger' && accountId) setLedger(await accountLedger(COMPANY, accountId, from, to));
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setLoading(false); }
  }

  function currentReportData(): { type: string; data: any } | null {
    if (tab === 'trial') return { type: 'Balance de comprobación', data: trial };
    if (tab === 'income') return { type: 'Estado de resultados', data: income };
    if (tab === 'balance') return { type: 'Balance general', data: balance };
    if (tab === 'sales') return { type: 'Ventas y márgenes', data: sales };
    if (tab === 'inventory') return { type: 'Inventario valorado', data: inventory };
    if (tab === 'ledger') return { type: 'Mayor de cuenta', data: ledger };
    return null;
  }

  async function handleAi() {
    const rep = currentReportData();
    if (!rep || !rep.data) { alert('Genera primero el reporte.'); return; }
    try {
      setAiLoading(true); setAiText('');
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: rep.type, reportData: rep.data, period: `${from} a ${to}` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en el análisis');
      setAiText(json.analysis);
    } catch (e: any) { alert('Error IA: ' + (e.message || '')); }
    finally { setAiLoading(false); }
  }

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Reportes e Inteligencia Artificial</h1>
          <p className="text-slate-500 mt-2">Estados financieros y análisis profundo con Anthropic Claude</p>
        </div>
      </header>

      <main style={S.main}>
        {/* Pestañas */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' as const }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...S.btn, background: tab === t.id ? '#2563eb' : 'white', color: tab === t.id ? 'white' : '#334155', border: '1px solid #cbd5e1' }}>
              {t.label}
            </button>
          ))}
          <Link href="/reports/ats" style={{ ...S.btn, background: '#10b981', textDecoration: 'none' }}>
            Generar ATS (SRI)
          </Link>
        </div>

        {/* Filtros */}
        <div style={{ ...S.card, display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' as const }}>
          {tab !== 'inventory' && tab !== 'balance' && (
            <div><label style={S.label}>Desde</label><input style={S.input} type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          )}
          {tab !== 'inventory' && (
            <div><label style={S.label}>{tab === 'balance' ? 'Fecha de corte' : 'Hasta'}</label><input style={S.input} type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          )}
          {tab === 'ledger' && (
            <div style={{ minWidth: 320 }}><label style={S.label}>Cuenta</label>
              <select style={{ ...S.input, width: '100%' }} value={accountId} onChange={e => setAccountId(Number(e.target.value))}>
                <option value={0}>— Seleccionar cuenta —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </select>
            </div>
          )}
          <button style={S.btn} onClick={load} disabled={loading}>{loading ? 'Cargando...' : 'Generar'}</button>
          <button style={{ ...S.btn, background: '#7c3aed' }} onClick={handleAi} disabled={aiLoading}>
            {aiLoading ? 'Analizando...' : '✦ Analizar con IA'}
          </button>
        </div>

        {/* Análisis IA */}
        {aiText && (
          <div style={{ ...S.card, background: '#faf5ff', border: '1px solid #ddd6fe' }}>
            <strong style={{ color: '#6d28d9' }}>Análisis IA</strong>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#1e293b', marginTop: '0.5rem' }}>{aiText}</div>
          </div>
        )}

        {/* ── Balance de comprobación ── */}
        {tab === 'trial' && (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Código</th><th style={S.th}>Cuenta</th><th style={{ ...S.th, textAlign: 'right' }}>Debe</th><th style={{ ...S.th, textAlign: 'right' }}>Haber</th><th style={{ ...S.th, textAlign: 'right' }}>Saldo</th></tr></thead>
              <tbody>
                {trial.map((r, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace' }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.debit)}</td><td style={S.tdNum}>{money(r.credit)}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>
                ))}
                <tr style={S.totalRow}><td style={S.td} colSpan={2}>TOTALES</td>
                  <td style={S.tdNum}>{money(trial.reduce((s, r) => s + r.debit, 0))}</td>
                  <td style={S.tdNum}>{money(trial.reduce((s, r) => s + r.credit, 0))}</td>
                  <td style={S.tdNum}>{money(trial.reduce((s, r) => s + r.balance, 0))}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Estado de resultados ── */}
        {tab === 'income' && income && (
          <div style={S.card}>
            <h3 style={{ color: '#166534' }}>Ingresos</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
              <tbody>{income.ingresos.map((r, i) => (
                <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace', width: 110 }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>))}
                <tr style={S.totalRow}><td style={S.td} colSpan={2}>Total ingresos</td><td style={S.tdNum}>{money(income.totalIngresos)}</td></tr>
              </tbody>
            </table>
            <h3 style={{ color: '#991b1b' }}>Costos y gastos</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
              <tbody>{income.costosGastos.map((r, i) => (
                <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace', width: 110 }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>))}
                <tr style={S.totalRow}><td style={S.td} colSpan={2}>Total costos y gastos</td><td style={S.tdNum}>{money(income.totalCostosGastos)}</td></tr>
              </tbody>
            </table>
            <div style={{ padding: '1rem', borderRadius: '0.5rem', background: income.utilidad >= 0 ? '#f0fdf4' : '#fef2f2', fontWeight: 700, fontSize: '1.05rem', color: income.utilidad >= 0 ? '#166534' : '#991b1b' }}>
              {income.utilidad >= 0 ? 'UTILIDAD' : 'PÉRDIDA'} DEL PERÍODO: {money(Math.abs(income.utilidad))}
            </div>
          </div>
        )}

        {/* ── Balance general ── */}
        {tab === 'balance' && balance && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={S.card}>
              <h3>Activo</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{balance.activos.map((r, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace', width: 110 }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>))}
                  <tr style={S.totalRow}><td style={S.td} colSpan={2}>TOTAL ACTIVO</td><td style={S.tdNum}>{money(balance.totalActivo)}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={S.card}>
              <h3>Pasivo</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <tbody>{balance.pasivos.map((r, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace', width: 110 }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>))}
                  <tr style={S.totalRow}><td style={S.td} colSpan={2}>TOTAL PASIVO</td><td style={S.tdNum}>{money(balance.totalPasivo)}</td></tr>
                </tbody>
              </table>
              <h3>Patrimonio</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{balance.patrimonio.map((r, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace', width: 110 }}>{r.code}</td><td style={S.td}>{r.name}</td><td style={S.tdNum}>{money(r.balance)}</td></tr>))}
                  <tr><td style={S.td} colSpan={2}>Resultado del ejercicio</td><td style={S.tdNum}>{money(balance.resultadoEjercicio)}</td></tr>
                  <tr style={S.totalRow}><td style={S.td} colSpan={2}>TOTAL PATRIMONIO</td><td style={S.tdNum}>{money(balance.totalPatrimonio)}</td></tr>
                </tbody>
              </table>
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: Math.abs(balance.cuadre) < 0.01 ? '#f0fdf4' : '#fef2f2', fontWeight: 700, color: Math.abs(balance.cuadre) < 0.01 ? '#166534' : '#991b1b' }}>
                {Math.abs(balance.cuadre) < 0.01 ? '✓ Ecuación contable cuadrada' : `✗ Descuadre: ${money(balance.cuadre)}`}
              </div>
            </div>
          </div>
        )}

        {/* ── Ventas y márgenes ── */}
        {tab === 'sales' && sales && (
          <>
            <div style={{ ...S.card, display: 'flex', gap: '2.5rem', flexWrap: 'wrap' as const }}>
              <div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>Ventas netas</div><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(sales.totales.ventas)}</div></div>
              <div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>Costo</div><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{money(sales.totales.costo)}</div></div>
              <div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>Margen bruto</div><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#166534' }}>{money(sales.totales.margen)} ({sales.totales.margenPct}%)</div></div>
            </div>
            <div style={S.card}>
              <h3>Por producto</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
                <thead><tr><th style={S.th}>Producto</th><th style={{ ...S.th, textAlign: 'right' }}>Cantidad</th><th style={{ ...S.th, textAlign: 'right' }}>Ventas</th><th style={{ ...S.th, textAlign: 'right' }}>Costo</th><th style={{ ...S.th, textAlign: 'right' }}>Margen</th></tr></thead>
                <tbody>{sales.porProducto.map((p, i) => (
                  <tr key={i}><td style={S.td}>{p.producto}</td><td style={S.tdNum}>{p.cantidad}</td><td style={S.tdNum}>{money(p.ventas)}</td><td style={S.tdNum}>{money(p.costo)}</td><td style={S.tdNum}>{money(p.margen)}</td></tr>))}
                </tbody>
              </table>
              <h3>Por cliente</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
                <thead><tr><th style={S.th}>Cliente</th><th style={{ ...S.th, textAlign: 'right' }}>Ventas</th><th style={{ ...S.th, textAlign: 'right' }}>Costo</th><th style={{ ...S.th, textAlign: 'right' }}>Margen</th></tr></thead>
                <tbody>{sales.porCliente.map((c, i) => (
                  <tr key={i}><td style={S.td}>{c.cliente}</td><td style={S.tdNum}>{money(c.ventas)}</td><td style={S.tdNum}>{money(c.costo)}</td><td style={S.tdNum}>{money(c.margen)}</td></tr>))}
                </tbody>
              </table>
              <h3>Detalle por venta</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={S.th}>Número</th><th style={S.th}>Fecha</th><th style={S.th}>Cliente</th><th style={{ ...S.th, textAlign: 'right' }}>Subtotal</th><th style={{ ...S.th, textAlign: 'right' }}>Costo</th><th style={{ ...S.th, textAlign: 'right' }}>Margen</th><th style={{ ...S.th, textAlign: 'right' }}>%</th></tr></thead>
                <tbody>{sales.porVenta.map((v, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace' }}>{v.name}</td><td style={S.td}>{v.date}</td><td style={S.td}>{v.cliente}</td><td style={S.tdNum}>{money(v.subtotal)}</td><td style={S.tdNum}>{money(v.costo)}</td><td style={S.tdNum}>{money(v.margen)}</td><td style={S.tdNum}>{v.margenPct}%</td></tr>))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Inventario ── */}
        {tab === 'inventory' && inventory && (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Código</th><th style={S.th}>Producto</th><th style={{ ...S.th, textAlign: 'right' }}>Cantidad</th><th style={{ ...S.th, textAlign: 'right' }}>Costo promedio</th><th style={{ ...S.th, textAlign: 'right' }}>Valor total</th></tr></thead>
              <tbody>
                {inventory.items.map((it, i) => (
                  <tr key={i}><td style={{ ...S.td, fontFamily: 'monospace' }}>{it.code}</td><td style={S.td}>{it.producto}</td><td style={S.tdNum}>{it.cantidad}</td><td style={S.tdNum}>${it.costoPromedio.toFixed(4)}</td><td style={S.tdNum}>{money(it.valorTotal)}</td></tr>))}
                <tr style={S.totalRow}><td style={S.td} colSpan={4}>VALOR TOTAL DEL INVENTARIO</td><td style={S.tdNum}>{money(inventory.valorTotal)}</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
              Valoración a costo promedio ponderado (Bodega Principal). Debe coincidir con el saldo contable de Inventario de Mercancías.
            </p>
          </div>
        )}

        {/* ── Mayor de cuenta ── */}
        {tab === 'ledger' && (
          ledger ? (
            <div style={S.card}>
              <h3 style={{ fontFamily: 'monospace' }}>{ledger.account.code} · {ledger.account.name}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={S.th}>Fecha</th><th style={S.th}>Asiento</th><th style={S.th}>Referencia</th><th style={S.th}>Detalle</th><th style={{ ...S.th, textAlign: 'right' }}>Debe</th><th style={{ ...S.th, textAlign: 'right' }}>Haber</th><th style={{ ...S.th, textAlign: 'right' }}>Saldo</th></tr></thead>
                <tbody>
                  {ledger.rows.map((r, i) => (
                    <tr key={i}><td style={S.td}>{r.date}</td><td style={{ ...S.td, fontFamily: 'monospace' }}>{r.move}</td><td style={S.td}>{r.ref}</td><td style={S.td}>{r.detalle}</td><td style={S.tdNum}>{money(r.debit)}</td><td style={S.tdNum}>{money(r.credit)}</td><td style={S.tdNum}>{money(r.saldo)}</td></tr>))}
                  <tr style={S.totalRow}><td style={S.td} colSpan={4}>TOTALES</td><td style={S.tdNum}>{money(ledger.totalDebit)}</td><td style={S.tdNum}>{money(ledger.totalCredit)}</td><td style={S.tdNum}>{money(ledger.saldoFinal)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', color: '#64748b' }}>Selecciona una cuenta y pulsa Generar.</div>
          )
        )}
      </main>
    </div>
  );
}
