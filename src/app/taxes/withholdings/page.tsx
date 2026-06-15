// src/app/taxes/withholdings/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getCompanies, getPartners } from '@/lib/supabase';
import {
  getRentRules, getIvaRules, calcWithhold, getWithholds, createWithhold, postWithhold,
} from '@/lib/withholding';
import { emitRetencionElectronica, downloadXmlFile } from '@/lib/sri-docs-db';
import { TAXPAYER_LABELS, IVA_TARGET_LABELS } from '@/types/capa2';
import type { RentRule, IvaRule, TaxpayerType, IvaTarget } from '@/types/capa2';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnSm: { padding: '0.35rem 0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.75rem', textAlign: 'left' as const, fontSize: '0.75rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' },
  calcRow: { display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.9rem' },
};

export default function WithholdingsPage() {
  const [, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [rentRules, setRentRules] = useState<RentRule[]>([]);
  const [ivaRules, setIvaRules] = useState<IvaRule[]>([]);
  const [withholds, setWithholds] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulario
  const [buyerType, setBuyerType] = useState<TaxpayerType>('regimen_general');
  const [partnerId, setPartnerId] = useState<number>(0);
  const [sellerType, setSellerType] = useState<TaxpayerType>('regimen_general');
  const [target, setTarget] = useState<IvaTarget>('goods');
  const [base, setBase] = useState<number>(0);
  const [ivaRate, setIvaRate] = useState<number>(15);
  const [rentRuleId, setRentRuleId] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceAuth, setInvoiceAuth] = useState('');

  useEffect(() => { init(); }, []);
  useEffect(() => { if (companyId) loadWithholds(); }, [companyId]);

  async function init() {
    try {
      const [comps, rr, ir] = await Promise.all([getCompanies(), getRentRules(), getIvaRules()]);
      setCompanies(comps);
      if (comps.length > 0) setCompanyId(comps[0].id);
      setRentRules(rr);
      setIvaRules(ir);
      const ps = await getPartners(comps[0]?.id ?? 1);
      setPartners(ps || []);
    } catch (e) { console.error(e); }
  }

  async function loadWithholds() {
    if (!companyId) return;
    try { setWithholds(await getWithholds(companyId)); } catch (e) { console.error(e); }
  }

  // Al elegir proveedor, autocompletar su tipo de contribuyente
  function onPartnerChange(id: number) {
    setPartnerId(id);
    const p = partners.find(x => x.id === id);
    if (p?.taxpayer_type) setSellerType(p.taxpayer_type);
  }

  // CALCULO EN TIEMPO REAL
  const calc = useMemo(() => {
    if (base <= 0) return null;
    return calcWithhold(
      { buyer_type: buyerType, seller_type: sellerType, target, base_imponible: base, iva_rate: ivaRate, rent_rule_id: rentRuleId },
      ivaRules, rentRules
    );
  }, [buyerType, sellerType, target, base, ivaRate, rentRuleId, ivaRules, rentRules]);

  async function handleSave() {
    if (!companyId || !partnerId || !calc || saving) return;
    const rentRule = rentRules.find(r => r.id === rentRuleId);
    try {
      setSaving(true);
      const lines: any[] = [];
      if (calc.rent_withhold_amount > 0 || rentRule) {
        lines.push({
          tax_type: 'rent', rule_code: rentRule?.air_code || '3440',
          description: rentRule?.name || 'Retencion renta',
          base, percent: calc.rent_withhold_percent, amount: calc.rent_withhold_amount,
        });
      }
      if (calc.iva_withhold_amount > 0) {
        lines.push({
          tax_type: 'iva', rule_code: String(calc.iva_withhold_percent),
          description: `Retencion IVA ${calc.iva_withhold_percent}% - ${IVA_TARGET_LABELS[target]}`,
          base: calc.iva_amount, percent: calc.iva_withhold_percent, amount: calc.iva_withhold_amount,
        });
      }
      if (lines.length === 0) { alert('No hay valores a retener.'); return; }

      await createWithhold({
        company_id: companyId, partner_id: partnerId, date,
        invoice_ref: invoiceRef, invoice_auth: invoiceAuth, invoice_date: date,
        base_iva: base, base_renta: base, lines,
      });
      setModalOpen(false);
      setBase(0); setInvoiceRef(''); setInvoiceAuth('');
      loadWithholds();
    } catch (err: any) {
      alert('Error: ' + (err.message || ''));
    } finally { setSaving(false); }
  }

  async function handlePost(id: number) {
    try { await postWithhold(id); loadWithholds(); }
    catch (err: any) { alert('Error: ' + (err.message || '')); }
  }

  const [sendingSri, setSendingSri] = useState(0);

  async function handleSri(id: number) {
    if (!confirm('Emitir la retencion electronica y enviarla al SRI (ambiente segun la empresa)?')) return;
    try {
      setSendingSri(id);
      const r = await emitRetencionElectronica(id);
      const amb = r.ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS';
      if (r.signedXml) downloadXmlFile(r.signedXml, `RET_${r.numero}_${r.claveAcceso.slice(0, 8)}.xml`);
      alert(`SRI [${amb}] → ${r.estado}` +
        (r.numeroAutorizacion ? `\nAutorización: ${r.numeroAutorizacion}` : '') +
        (r.mensajes?.length ? `\n\n${r.mensajes.join('\n')}` : ''));
      loadWithholds();
    } catch (err: any) { alert('Error: ' + (err.message || '')); }
    finally { setSendingSri(0); }
  }

  const badge = (state: string) => {
    const m: any = { draft: ['#fef9c3', '#854d0e', 'Borrador'], posted: ['#dcfce7', '#166534', 'Emitida'], cancel: ['#fee2e2', '#991b1b', 'Anulada'] };
    const s = m[state] || m.draft;
    return <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: s[0], color: s[1], fontWeight: 600 }}>{s[2]}</span>;
  };

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Retenciones Emitidas</h1>
          <p className="text-slate-500 mt-2">Comprobantes de retención a proveedores</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/taxes/rules" className="btn btn-outline">Reglas Fiscales</Link>
          <Link href="/taxes/received-withholdings" className="btn btn-outline">Ret. recibidas</Link>
          <Link href="/taxes/ats" className="btn btn-outline">Anexo ATS</Link>
          <button className="btn btn-primary shadow-lg shadow-blue-500/30" onClick={() => setModalOpen(true)}>+ Nueva Retención</button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          {withholds.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay retenciones emitidas.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Número</th><th style={S.th}>Fecha</th><th style={S.th}>Proveedor</th>
                <th style={S.th}>Factura</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Ret. Renta</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Ret. IVA</th>
                <th style={S.th}>Estado</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {withholds.map(w => (
                  <tr key={w.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{w.number}</td>
                    <td style={S.td}>{w.date}</td>
                    <td style={S.td}>{w.partner?.name || '-'}</td>
                    <td style={S.td}>{w.invoice_ref || '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(w.total_rent_withheld).toFixed(2)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(w.total_iva_withheld).toFixed(2)}</td>
                    <td style={S.td}>{badge(w.state)}{w.sri_estado && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700,
                          background: w.sri_estado === 'AUTORIZADO' ? '#dcfce7' : '#fee2e2',
                          color: w.sri_estado === 'AUTORIZADO' ? '#166534' : '#991b1b' }}>
                          SRI: {w.sri_estado}
                        </span>
                      </div>
                    )}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' as const }}>
                      {w.state === 'draft' && <button style={S.btnSm} onClick={() => handlePost(w.id)}>Emitir</button>}
                      {w.state === 'posted' && (
                        <button style={{ ...S.btnSm, background: '#ea580c', opacity: sendingSri === w.id ? 0.5 : 1 }} disabled={sendingSri === w.id} onClick={() => handleSri(w.id)}>
                          {sendingSri === w.id ? 'Enviando...' : 'Enviar SRI'}
                        </button>
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
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.25rem', color: '#1e293b' }}>Nueva Retención (Compra)</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={S.label}>Mi empresa actúa como (comprador)</label>
                <select style={S.input} value={buyerType} onChange={e => setBuyerType(e.target.value as TaxpayerType)}>
                  {Object.entries(TAXPAYER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Proveedor</label>
                <select style={S.input} value={partnerId} onChange={e => onPartnerChange(Number(e.target.value))}>
                  <option value={0}>— Seleccionar —</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name} {p.vat ? `(${p.vat})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Tipo de contribuyente del proveedor</label>
                <select style={S.input} value={sellerType} onChange={e => setSellerType(e.target.value as TaxpayerType)}>
                  {Object.entries(TAXPAYER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Concepto (para retención IVA)</label>
                <select style={S.input} value={target} onChange={e => setTarget(e.target.value as IvaTarget)}>
                  {Object.entries(IVA_TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Base imponible (sin IVA) *</label>
                <input style={S.input} type="number" step="0.01" min="0" value={base || ''} onChange={e => setBase(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={S.label}>Tarifa IVA</label>
                <select style={S.input} value={ivaRate} onChange={e => setIvaRate(Number(e.target.value))}>
                  <option value={15}>15%</option>
                  <option value={5}>5%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Concepto retención RENTA (Resolución NAC-DGERCGC26-00000009)</label>
                <select style={S.input} value={rentRuleId} onChange={e => setRentRuleId(Number(e.target.value))}>
                  <option value={0}>— Seleccionar concepto —</option>
                  {rentRules.map(r => <option key={r.id} value={r.id}>{r.percent}% — {r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Nº Factura (001-001-000000123)</label>
                <input style={S.input} value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="001-001-000000123" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Nº Autorización SRI (49 dígitos)</label>
                <input style={S.input} value={invoiceAuth} onChange={e => setInvoiceAuth(e.target.value)} />
              </div>
            </div>

            {/* CALCULO EN TIEMPO REAL */}
            {calc && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.5rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#0c4a6e', marginBottom: '0.5rem' }}>Cálculo automático</div>
                <div style={S.calcRow}><span>Base imponible</span><strong>${base.toFixed(2)}</strong></div>
                <div style={S.calcRow}><span>IVA {ivaRate}%</span><strong>${calc.iva_amount.toFixed(2)}</strong></div>
                <div style={{ ...S.calcRow, color: '#b91c1c' }}>
                  <span>Retención RENTA {calc.rent_withhold_percent}% (sobre base)</span>
                  <strong>- ${calc.rent_withhold_amount.toFixed(2)}</strong>
                </div>
                <div style={{ ...S.calcRow, color: '#b91c1c' }}>
                  <span>Retención IVA {calc.iva_withhold_percent}% (sobre el IVA)</span>
                  <strong>- ${calc.iva_withhold_amount.toFixed(2)}</strong>
                </div>
                <div style={{ ...S.calcRow, borderTop: '2px solid #bae6fd', marginTop: '0.4rem', paddingTop: '0.6rem', fontSize: '1rem' }}>
                  <span style={{ fontWeight: 700 }}>Neto a pagar al proveedor</span>
                  <strong style={{ color: '#166534' }}>${calc.net_payable.toFixed(2)}</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button style={{ ...S.btn, flex: 1, opacity: (!calc || !partnerId || saving) ? 0.5 : 1 }} disabled={!calc || !partnerId || saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Guardar Retención'}
              </button>
              <button style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => setModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
