// src/app/cxc/page.tsx  — Cuentas por Cobrar
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getReceivables,
  getPaymentsForSale,
  registerCobro,
  cancelPayment,
  PAYMENT_METHODS,
} from '@/lib/payments';

const S = {
  page:  { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  hdr:   { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main:  { maxWidth: '1400px', margin: '0 auto', padding: '2rem' },
  card:  { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn:   { padding: '0.55rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' },
  btnSm: { padding: '0.3rem 0.65rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' },
  btnGray:{ padding: '0.3rem 0.65rem', background: '#64748b', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' },
  input: { padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th:    { padding: '0.65rem 0.75rem', textAlign: 'left' as const, fontSize: '0.72rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td:    { padding: '0.55rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.87rem' },
  overlay:{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' as const },
};

const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
const badge = (r: number) => r <= 0
  ? { label: 'Cobrado', bg: '#dcfce7', color: '#166534' }
  : { label: 'Pendiente', bg: '#fef9c3', color: '#854d0e' };

export default function CxCPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [loading, setLoading] = useState(true);

  // Modal cobro
  const [cobroDoc, setCobroDoc] = useState<any | null>(null);
  const [cobroAmt, setCobroAmt] = useState('');
  const [cobroDate, setCobroDate] = useState(new Date().toISOString().slice(0, 10));
  const [cobroMethod, setCobroMethod] = useState('E');
  const [cobroRef, setCobroRef] = useState('');
  const [cobroNotes, setCobroNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal pagos del documento
  const [histDoc, setHistDoc] = useState<any | null>(null);
  const [histPays, setHistPays] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setDocs(await getReceivables(1)); } catch (e) { console.error(e); }
    setLoading(false);
  }

  const filtered = docs.filter(d => {
    if (filter === 'pending') return d.amount_residual > 0.005;
    if (filter === 'paid')    return d.amount_residual <= 0.005;
    return true;
  });

  const totalPendiente = docs.filter(d => d.amount_residual > 0).reduce((s, d) => s + d.amount_residual, 0);
  const totalCobrado   = docs.reduce((s, d) => s + (d.amount_paid || 0), 0);

  function openCobro(doc: any) {
    setCobroDoc(doc);
    setCobroAmt(doc.amount_residual.toFixed(2));
    setCobroDate(new Date().toISOString().slice(0, 10));
    setCobroMethod('E');
    setCobroRef('');
    setCobroNotes('');
  }

  async function saveCobro() {
    if (!cobroDoc) return;
    const amt = parseFloat(cobroAmt);
    if (isNaN(amt) || amt <= 0) return alert('Monto inválido');
    setSaving(true);
    try {
      await registerCobro({
        company_id: 1,
        partner_id: cobroDoc.partner?.id,
        date: cobroDate,
        amount: amt,
        payment_method: cobroMethod,
        reference: cobroRef || undefined,
        notes: cobroNotes || undefined,
        sale_order_id: cobroDoc.id,
      });
      setCobroDoc(null);
      await load();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  }

  async function openHist(doc: any) {
    setHistDoc(doc);
    const pays = await getPaymentsForSale(doc.id);
    setHistPays(pays);
  }

  async function doCancel(payId: number) {
    if (!confirm('¿Anular este cobro?')) return;
    await cancelPayment(payId);
    if (histDoc) openHist(histDoc);
    await load();
  }

  return (
    <div style={S.page}>
      <header style={S.hdr}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>Cuentas por Cobrar</h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Cobros y saldos de ventas</p>
        </div>
        <Link href="/" style={{ ...S.btn, textDecoration: 'none', background: '#64748b' }}>← Inicio</Link>
      </header>

      <main style={S.main}>
        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Por cobrar', value: fmt(totalPendiente), color: '#b45309' },
            { label: 'Cobrado total', value: fmt(totalCobrado), color: '#166534' },
            { label: 'Documentos', value: docs.length, color: '#1e40af' },
          ].map(s => (
            <div key={s.label} style={{ ...S.card, marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['pending', 'all', 'paid'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ ...S.btnSm, background: filter === f ? '#2563eb' : '#e2e8f0', color: filter === f ? 'white' : '#334155' }}>
                {f === 'pending' ? 'Pendientes' : f === 'paid' ? 'Cobrados' : 'Todos'}
              </button>
            ))}
          </div>

          {loading ? <p style={{ color: '#64748b' }}>Cargando…</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Cliente', 'Pedido / Factura', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Estado', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const b = badge(d.amount_residual);
                  return (
                    <tr key={d.id} style={{ transition: 'background 0.1s' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{d.partner?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.partner?.vat}</div>
                      </td>
                      <td style={S.td}>
                        <div>{d.name}</div>
                        {d.invoice_ref && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.invoice_ref}</div>}
                      </td>
                      <td style={S.td}>{d.date_order}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmt(d.amount_total)}</td>
                      <td style={{ ...S.td, color: '#166534' }}>{fmt(d.amount_paid)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: d.amount_residual > 0 ? '#b45309' : '#166534' }}>{fmt(d.amount_residual)}</td>
                      <td style={S.td}>
                        <span style={{ background: b.bg, color: b.color, padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {b.label}
                        </span>
                      </td>
                      <td style={{ ...S.td, display: 'flex', gap: '0.35rem' }}>
                        {d.amount_residual > 0.005 && (
                          <button style={S.btnSm} onClick={() => openCobro(d)}>+ Cobrar</button>
                        )}
                        <button style={S.btnGray} onClick={() => openHist(d)}>Pagos</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Sin registros</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal: registrar cobro */}
      {cobroDoc && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setCobroDoc(null); }}>
          <div style={S.modal}>
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Registrar Cobro</h2>
            <p style={{ color: '#64748b', margin: '0 0 1rem', fontSize: '0.85rem' }}>
              {cobroDoc.partner?.name} — {cobroDoc.name}<br />
              Saldo pendiente: <strong>{fmt(cobroDoc.amount_residual)}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" style={S.input} value={cobroDate} onChange={e => setCobroDate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Monto *</label>
                <input type="number" step="0.01" style={S.input} value={cobroAmt} onChange={e => setCobroAmt(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={S.label}>Forma de Pago</label>
              <select style={S.input} value={cobroMethod} onChange={e => setCobroMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={S.label}>Referencia (N° cheque / comprobante)</label>
              <input style={S.input} value={cobroRef} onChange={e => setCobroRef(e.target.value)} placeholder="Opcional" />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={S.label}>Notas</label>
              <input style={S.input} value={cobroNotes} onChange={e => setCobroNotes(e.target.value)} placeholder="Opcional" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn, background: '#64748b' }} onClick={() => setCobroDoc(null)}>Cancelar</button>
              <button style={S.btn} onClick={saveCobro} disabled={saving}>{saving ? 'Guardando…' : 'Registrar Cobro'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: historial de pagos */}
      {histDoc && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setHistDoc(null); }}>
          <div style={{ ...S.modal, maxWidth: '560px' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Historial de Cobros</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              {histDoc.partner?.name} — {histDoc.name}
            </p>
            {histPays.length === 0
              ? <p style={{ color: '#94a3b8' }}>Sin cobros registrados</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      {['Fecha', 'Método', 'Monto', 'Referencia', ''].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {histPays.map(p => {
                      const m = PAYMENT_METHODS.find(x => x.code === p.payment_method);
                      return (
                        <tr key={p.id}>
                          <td style={S.td}>{p.date}</td>
                          <td style={S.td}>{m?.label || p.payment_method}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{fmt(p.amount)}</td>
                          <td style={S.td}>{p.reference || '—'}</td>
                          <td style={S.td}>
                            <button style={{ ...S.btnGray, background: '#dc2626', fontSize: '0.72rem' }} onClick={() => doCancel(p.id)}>Anular</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            <div style={{ textAlign: 'right', marginTop: '1rem' }}>
              <button style={{ ...S.btn, background: '#64748b' }} onClick={() => setHistDoc(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
