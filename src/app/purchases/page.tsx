// src/app/purchases/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

import { getPurchaseOrders, confirmPurchase, cancelPurchase } from '@/lib/purchases';
import { emitRetencionForPurchase } from '@/lib/sri-retencion-purchase';


const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1400px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnSm: { padding: '0.35rem 0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.7rem', textAlign: 'left' as const, fontSize: '0.75rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.6rem 0.7rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' },
};



const RENTA_CODES = [
  { code: '312', label: '312 — Bienes (1%)', pct: 1 },
  { code: '340', label: '340 — Servicios (2%)', pct: 2 },
  { code: '3440', label: '3440 — Honorarios profesionales (8%)', pct: 8 },
  { code: '322', label: '322 — Transporte (1%)', pct: 1 },
  { code: '304', label: '304 — Arrendamiento (8%)', pct: 8 },
  { code: '332', label: '332 — Publicidad (1%)', pct: 1 },
  { code: '320', label: '320 — Seguros (1%)', pct: 1 },
  { code: '310', label: '310 — Bienes inmuebles (8%)', pct: 8 },
];

export default function PurchasesPage() {
  const [orders, setOrders] = useState<any[]>([]);

  // Retention modal
  const [retModal, setRetModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [retCodigoRenta, setRetCodigoRenta] = useState('312');
  const [retPctRenta, setRetPctRenta] = useState(1);
  const [retPctIva, setRetPctIva] = useState(0);
  const [sendingRet, setSendingRet] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const os = await getPurchaseOrders(1);
      setOrders(os || []);
    } catch (e) { console.error(e); }
  }


  async function handleConfirm(id: number) {
    if (!confirm('Confirmar esta compra? Se registrará el ingreso al inventario y el asiento contable.')) return;
    try { await confirmPurchase(id); loadAll(); }
    catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  async function handleCancel(id: number) {
    if (!confirm('Anular esta compra en borrador?')) return;
    try { await cancelPurchase(id); loadAll(); }
    catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  function openRetModal(order: any) {
    setRetModal({ open: true, order });
    setRetCodigoRenta('312');
    setRetPctRenta(1);
    setRetPctIva(0);
  }

  async function handleEmitRetencion() {
    if (!retModal.order || sendingRet) return;
    if (retPctRenta <= 0 && retPctIva <= 0) { alert('Debe ingresar al menos un porcentaje de retención mayor a 0.'); return; }
    try {
      setSendingRet(true);
      const r = await emitRetencionForPurchase({
        purchaseId: retModal.order.id,
        codigoRenta: retCodigoRenta,
        porcentajeRenta: retPctRenta,
        porcentajeIva: retPctIva,
      });
      const ambTxt = r.ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS';
      alert(`Retención [${ambTxt}] → ${r.estado}` +
        (r.numeroAutorizacion ? `\nAutorización: ${r.numeroAutorizacion}` : '') +
        (r.mensajes?.length ? `\n\n${r.mensajes.join('\n')}` : ''));
      setRetModal({ open: false, order: null });
      loadAll();
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSendingRet(false); }
  }

  // Retention preview
  const retPreview = useMemo(() => {
    if (!retModal.order) return { renta: 0, iva: 0 };
    const sub = Number(retModal.order.amount_untaxed);
    const ivaVal = Number(retModal.order.amount_tax);
    return {
      renta: Math.round(sub * retPctRenta / 100 * 100) / 100,
      iva: retPctIva > 0 ? Math.round(ivaVal * retPctIva / 100 * 100) / 100 : 0,
    };
  }, [retModal.order, retPctRenta, retPctIva]);

  const stateBadge = (state: string) => {
    const m: any = {
      draft: ['#fef9c3', '#854d0e', 'Borrador'],
      confirmed: ['#dcfce7', '#166534', 'Confirmado'],
      cancel: ['#fee2e2', '#991b1b', 'Anulado'],
    };
    const s = m[state] || m.draft;
    return <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: s[0], color: s[1], fontWeight: 600 }}>{s[2]}</span>;
  };

  const sriBadge = (estado: string, ambiente: number) => {
    const bg = estado === 'AUTORIZADO' ? '#dcfce7' : estado === 'RECIBIDA' || estado === 'EN PROCESO' ? '#fef9c3' : '#fee2e2';
    const color = estado === 'AUTORIZADO' ? '#166534' : estado === 'RECIBIDA' || estado === 'EN PROCESO' ? '#854d0e' : '#991b1b';
    return (
      <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700, background: bg, color }}>
        RET{ambiente === 1 ? '·P' : ''}: {estado}
      </span>
    );
  };

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Compras</h1>
          <p className="text-slate-500 mt-2">Gestión de órdenes y facturas de compra</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/purchases/new" className="btn btn-primary">+ Nueva Compra</Link>
        </div>
      </header>

      <main>
        <div style={S.card}>
          {orders.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay compras registradas.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>Número</th>
                    <th style={S.th}>Fecha</th>
                    <th style={S.th}>Proveedor</th>
                    <th style={S.th}>Fact. Proveedor</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>IVA</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
                    <th style={S.th}>Estado</th>
                    <th style={S.th}>Retención</th>
                    <th style={S.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{o.name}</td>
                      <td style={S.td}>{o.date_order}</td>
                      <td style={S.td}>{o.partner?.name || '-'}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.invoice_ref || '-'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(o.amount_untaxed).toFixed(2)}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(o.amount_tax).toFixed(2)}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${Number(o.amount_total).toFixed(2)}</td>
                      <td style={S.td}>{stateBadge(o.state)}</td>
                      <td style={S.td}>
                        {o.ret_estado ? (
                          <div>
                            {sriBadge(o.ret_estado, o.ret_ambiente)}
                            {o.ret_numero && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                                {o.ret_numero}
                              </div>
                            )}
                            {(o.ret_valor_renta > 0 || o.ret_valor_iva > 0) && (
                              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.1rem' }}>
                                Renta: ${Number(o.ret_valor_renta || 0).toFixed(2)}
                                {o.ret_valor_iva > 0 && ` | IVA: $${Number(o.ret_valor_iva).toFixed(2)}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' as const }}>
                        {o.state === 'draft' && (
                          <>
                            <button style={S.btnSm} onClick={() => handleConfirm(o.id)}>Confirmar</button>{' '}
                            <button style={{ ...S.btnSm, background: '#dc2626' }} onClick={() => handleCancel(o.id)}>Anular</button>{' '}
                          </>
                        )}
                        {o.state !== 'cancel' && (
                          <button style={{ ...S.btnSm, background: '#7c3aed' }} onClick={() => openRetModal(o)}>
                            Retención SRI
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>



      {/* ── Modal Retención ── */}
      {retModal.open && retModal.order && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '560px' }}>
            <h2 style={{ marginBottom: '1.25rem', color: '#1e293b' }}>Emitir Retención al SRI</h2>

            {/* Datos de la compra (solo lectura) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.9rem 1.2rem', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div><strong>Proveedor:</strong> {retModal.order.partner?.name || '-'}</div>
                <div><strong>RUC/CI:</strong> {retModal.order.partner?.vat || '-'}</div>
                <div><strong>Factura:</strong> {retModal.order.invoice_ref || '-'}</div>
                <div><strong>Fecha fact.:</strong> {retModal.order.invoice_date || retModal.order.date_order}</div>
                <div><strong>Subtotal:</strong> ${Number(retModal.order.amount_untaxed).toFixed(2)}</div>
                <div><strong>IVA:</strong> ${Number(retModal.order.amount_tax).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={S.label}>Código de retención en la fuente (Renta)</label>
                <select style={S.input} value={retCodigoRenta} onChange={e => {
                  const c = RENTA_CODES.find(r => r.code === e.target.value);
                  setRetCodigoRenta(e.target.value);
                  if (c) setRetPctRenta(c.pct);
                }}>
                  {RENTA_CODES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label style={S.label}>Porcentaje retención Renta (%)</label>
                <input
                  style={S.input} type="number" step="0.5" min="0" max="100"
                  value={retPctRenta}
                  onChange={e => setRetPctRenta(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label style={S.label}>Porcentaje retención IVA (%)</label>
                <select style={S.input} value={retPctIva} onChange={e => setRetPctIva(Number(e.target.value))}>
                  <option value={0}>0% — No retiene IVA</option>
                  <option value={30}>30%</option>
                  <option value={70}>70%</option>
                  <option value={100}>100%</option>
                </select>
              </div>
            </div>

            {/* Preview de valores calculados */}
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '0.5rem', padding: '0.9rem 1.2rem', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#6b21a8' }}>Valores a retener:</div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <span>Renta ({retPctRenta}%): <strong>${retPreview.renta.toFixed(2)}</strong></span>
                {retPctIva > 0 && (
                  <span>IVA ({retPctIva}%): <strong>${retPreview.iva.toFixed(2)}</strong></span>
                )}
                <span style={{ color: '#6b21a8' }}>
                  Total retención: <strong>${(retPreview.renta + retPreview.iva).toFixed(2)}</strong>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                style={{ ...S.btn, flex: 1, background: '#7c3aed', opacity: sendingRet ? 0.5 : 1 }}
                disabled={sendingRet}
                onClick={handleEmitRetencion}
              >
                {sendingRet ? 'Emitiendo...' : 'Emitir Retención → SRI'}
              </button>
              <button style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => setRetModal({ open: false, order: null })}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

