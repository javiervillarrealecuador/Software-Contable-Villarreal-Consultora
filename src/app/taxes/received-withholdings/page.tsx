// src/app/taxes/received-withholdings/page.tsx
// Retenciones recibidas de clientes.
//
// Contexto tributario:
//   Cuando la empresa vende a un cliente que es AGENTE DE RETENCIÓN designado
//   por el SRI, ese cliente está obligado a retener un porcentaje de renta y/o
//   IVA antes de pagarle. El cliente emite su propio comprobante de retención.
//   La empresa debe registrar esas retenciones aquí para que:
//   1. El ATS ventas las declare en <valorRetIva> y <valorRetRenta>.
//   2. La empresa pueda usarlas como crédito tributario en su declaración 104.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getReceivedWithholdings, createReceivedWithholding, cancelReceivedWithholding,
  type ReceivedWithholding,
} from '@/lib/received-withholding';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnSm: { padding: '0.35rem 0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.7rem', textAlign: 'left' as const, fontSize: '0.75rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.6rem 0.7rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' },
};

export default function ReceivedWithholdingsPage() {
  const [records, setRecords] = useState<ReceivedWithholding[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const companyId = 1; // En producción vendría del contexto de sesión

  // Formulario
  const [partnerId, setPartnerId] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [retNumber, setRetNumber] = useState('');
  const [retAuth, setRetAuth] = useState('');
  const [baseRenta, setBaseRenta] = useState(0);
  const [baseIva, setBaseIva] = useState(0);
  const [valorRetRenta, setValorRetRenta] = useState(0);
  const [valorRetIva, setValorRetIva] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [recs, ps] = await Promise.all([
        getReceivedWithholdings(companyId),
        supabase.from('res_partner').select('id, name, vat').eq('company_id', companyId).eq('active', true).order('name'),
      ]);
      setRecords(recs);
      setPartners(ps.data || []);
    } catch (e) { console.error(e); }
  }

  async function handleSave() {
    if (!partnerId || saving) return;
    if (valorRetRenta <= 0 && valorRetIva <= 0) {
      alert('Ingrese al menos un valor de retención mayor a cero.');
      return;
    }
    try {
      setSaving(true);
      await createReceivedWithholding({
        company_id: companyId,
        partner_id: partnerId,
        date,
        ret_number: retNumber || undefined,
        ret_auth: retAuth || undefined,
        base_renta: baseRenta,
        base_iva: baseIva,
        valor_ret_renta: valorRetRenta,
        valor_ret_iva: valorRetIva,
        notes: notes || undefined,
      });
      setModalOpen(false);
      resetForm();
      loadAll();
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSaving(false); }
  }

  async function handleCancel(id: number) {
    if (!confirm('Anular esta retención recibida?')) return;
    try { await cancelReceivedWithholding(id); loadAll(); }
    catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  function resetForm() {
    setPartnerId(0); setDate(new Date().toISOString().slice(0, 10));
    setRetNumber(''); setRetAuth('');
    setBaseRenta(0); setBaseIva(0);
    setValorRetRenta(0); setValorRetIva(0); setNotes('');
  }

  const badge = (state: string) => {
    const ok = state === 'registered';
    return <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b', fontWeight: 600 }}>{ok ? 'Registrada' : 'Anulada'}</span>;
  };

  const totRenta = records.filter(r => r.state === 'registered').reduce((s, r) => s + Number(r.valor_ret_renta), 0);
  const totIva = records.filter(r => r.state === 'registered').reduce((s, r) => s + Number(r.valor_ret_iva), 0);

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Retenciones Recibidas</h1>
          <p className="text-slate-500 mt-2">Comprobantes de retención emitidos por clientes a nuestra empresa</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/taxes/withholdings" className="btn btn-outline">Ret. emitidas</Link>
          <Link href="/taxes/ats" className="btn btn-outline">Anexo ATS</Link>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Registrar retención recibida</button>
        </div>
      </header>

      <main style={S.main}>
        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ ...S.card, background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Total ret. RENTA recibida</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>${totRenta.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#166534' }}>Crédito tributario IR disponible</div>
          </div>
          <div style={{ ...S.card, background: '#fef9c3', border: '1px solid #fde047', marginBottom: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>Total ret. IVA recibida</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>${totIva.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#854d0e' }}>Crédito tributario IVA disponible</div>
          </div>
        </div>

        <div style={S.card}>
          {records.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No hay retenciones recibidas registradas.<br />
              <span style={{ fontSize: '0.85rem' }}>
                Cuando un cliente agente de retención le entregue un comprobante de retención, regístrelo aquí
                para que aparezca en el ATS de ventas.
              </span>
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Cliente (agente)</th>
                  <th style={S.th}>Nº Comprobante</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Base renta</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Ret. renta</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Base IVA</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Ret. IVA</th>
                  <th style={S.th}>Estado</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={S.td}>{r.date}</td>
                    <td style={S.td}>{r.partner?.name || '-'}<br /><span style={{ color: '#64748b', fontSize: '0.78rem' }}>{r.partner?.vat || ''}</span></td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{r.ret_number || '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(r.base_renta).toFixed(2)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: '#166534', fontWeight: 600 }}>${Number(r.valor_ret_renta).toFixed(2)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(r.base_iva).toFixed(2)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: '#854d0e', fontWeight: 600 }}>${Number(r.valor_ret_iva).toFixed(2)}</td>
                    <td style={S.td}>{badge(r.state)}</td>
                    <td style={S.td}>
                      {r.state === 'registered' && (
                        <button style={{ ...S.btnSm, background: '#dc2626' }} onClick={() => handleCancel(r.id)}>Anular</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>Registrar retención recibida</h2>
            <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
              Complete los datos del comprobante de retención que el cliente agente le entregó.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Cliente que retiene (agente de retención) *</label>
                <select style={S.input} value={partnerId} onChange={e => setPartnerId(Number(e.target.value))}>
                  <option value={0}>— Seleccionar —</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name} {p.vat ? `(${p.vat})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Fecha del comprobante *</label>
                <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Nº comprobante de retención</label>
                <input style={S.input} value={retNumber} onChange={e => setRetNumber(e.target.value)} placeholder="001-001-000000042" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Autorización SRI (clave de acceso del cliente)</label>
                <input style={S.input} value={retAuth} onChange={e => setRetAuth(e.target.value)} placeholder="49 dígitos" maxLength={49} />
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', fontWeight: 700, color: '#334155' }}>
                Retención de RENTA
              </div>
              <div>
                <label style={S.label}>Base imponible renta</label>
                <input style={S.input} type="number" step="0.01" min="0" value={baseRenta || ''} onChange={e => setBaseRenta(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={S.label}>Valor retenido renta</label>
                <input style={S.input} type="number" step="0.01" min="0" value={valorRetRenta || ''} onChange={e => setValorRetRenta(parseFloat(e.target.value) || 0)} />
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', fontWeight: 700, color: '#334155' }}>
                Retención de IVA
              </div>
              <div>
                <label style={S.label}>Base IVA retenido</label>
                <input style={S.input} type="number" step="0.01" min="0" value={baseIva || ''} onChange={e => setBaseIva(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={S.label}>Valor retenido IVA</label>
                <input style={S.input} type="number" step="0.01" min="0" value={valorRetIva || ''} onChange={e => setValorRetIva(parseFloat(e.target.value) || 0)} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Observaciones</label>
                <input style={S.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            {/* Resumen */}
            {(valorRetRenta > 0 || valorRetIva > 0) && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.9rem 1.2rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.4rem' }}>Resumen</div>
                {valorRetRenta > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ret. renta</span><strong>${valorRetRenta.toFixed(2)}</strong></div>}
                {valorRetIva > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ret. IVA</span><strong>${valorRetIva.toFixed(2)}</strong></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #86efac', marginTop: '0.4rem', paddingTop: '0.4rem', fontWeight: 700 }}>
                  <span>Total retenido</span><span style={{ color: '#166534' }}>${(valorRetRenta + valorRetIva).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button style={{ ...S.btn, flex: 1, opacity: (!partnerId || saving) ? 0.5 : 1 }} disabled={!partnerId || saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Registrar retención recibida'}
              </button>
              <button style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

