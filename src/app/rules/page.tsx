// src/app/taxes/rules/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRentRules, getIvaRules, updateIvaRule, updateRentRule } from '@/lib/withholding';
import { TAXPAYER_LABELS, IVA_TARGET_LABELS } from '@/types/capa2';
import type { RentRule, IvaRule } from '@/types/capa2';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  th: { padding: '0.6rem', textAlign: 'left' as const, fontSize: '0.72rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.5rem 0.6rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' },
  inputSm: { padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', width: '80px', textAlign: 'right' as const },
  tab: (active: boolean) => ({ padding: '0.6rem 1.2rem', border: 'none', borderBottom: active ? '3px solid #2563eb' : '3px solid transparent', background: 'transparent', fontWeight: 600, color: active ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }),
};

export default function RulesPage() {
  const [tab, setTab] = useState<'rent' | 'iva'>('rent');
  const [rentRules, setRentRules] = useState<RentRule[]>([]);
  const [ivaRules, setIvaRules] = useState<IvaRule[]>([]);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [rr, ir] = await Promise.all([getRentRules(), getIvaRules()]);
      setRentRules(rr); setIvaRules(ir);
    } catch (e) { console.error(e); }
  }

  async function saveIva(id: number, percent: number) {
    try { await updateIvaRule(id, percent); setSaved(id); setTimeout(() => setSaved(null), 1500); }
    catch (e: any) { alert('Error: ' + e.message); }
  }

  async function saveRent(id: number, field: 'percent' | 'air_code', value: any) {
    try {
      await updateRentRule(id, field === 'percent' ? { percent: Number(value) } : { air_code: value });
      setSaved(id); setTimeout(() => setSaved(null), 1500);
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <Link href="/taxes/withholdings" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>← Retenciones</Link>
          <h1 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: '#1e293b' }}>Reglas de Retención</h1>
        </div>
      </header>

      <main style={S.main}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.9rem 1.2rem', marginBottom: '1.5rem', fontSize: '0.88rem', color: '#92400e' }}>
          Estas reglas son editables. Renta: Resolución NAC-DGERCGC26-00000009 (vigente 01-mar-2026).
          IVA: matriz comprador × proveedor. <strong>Valida los códigos AIR y los cruces marcados "VALIDAR" contra el catálogo SRI vigente</strong> — los cambios se guardan al salir del campo.
        </div>

        <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
          <button style={S.tab(tab === 'rent')} onClick={() => setTab('rent')}>Retención RENTA ({rentRules.length})</button>
          <button style={S.tab(tab === 'iva')} onClick={() => setTab('iva')}>Retención IVA ({ivaRules.length})</button>
        </div>

        {tab === 'rent' && (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Cód. AIR</th><th style={S.th}>Concepto</th>
                <th style={S.th}>Aplica a</th><th style={S.th}>Ref. legal</th>
                <th style={{ ...S.th, textAlign: 'right' }}>%</th>
              </tr></thead>
              <tbody>
                {rentRules.map(r => (
                  <tr key={r.id} style={{ background: saved === r.id ? '#f0fdf4' : 'white' }}>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width: '70px', textAlign: 'left' }} defaultValue={r.air_code || ''}
                        onBlur={e => e.target.value !== (r.air_code || '') && saveRent(r.id, 'air_code', e.target.value)} />
                    </td>
                    <td style={S.td}>{r.name}</td>
                    <td style={S.td}>{r.applies_to === 'goods' ? 'Bienes' : r.applies_to === 'services' ? 'Servicios' : 'Ambos'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.legal_ref}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <input style={S.inputSm} type="number" step="0.01" defaultValue={r.percent}
                        onBlur={e => Number(e.target.value) !== Number(r.percent) && saveRent(r.id, 'percent', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'iva' && (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Comprador (retiene)</th><th style={S.th}>Proveedor</th>
                <th style={S.th}>Concepto</th><th style={S.th}>Nota</th>
                <th style={{ ...S.th, textAlign: 'right' }}>% sobre IVA</th>
              </tr></thead>
              <tbody>
                {ivaRules.map(r => (
                  <tr key={r.id} style={{ background: saved === r.id ? '#f0fdf4' : (r.note || '').includes('VALIDAR') ? '#fffbeb' : 'white' }}>
                    <td style={S.td}>{TAXPAYER_LABELS[r.buyer_type] || r.buyer_type}</td>
                    <td style={S.td}>{TAXPAYER_LABELS[r.seller_type] || r.seller_type}</td>
                    <td style={S.td}>{IVA_TARGET_LABELS[r.target] || r.target}</td>
                    <td style={{ ...S.td, fontSize: '0.78rem', color: '#64748b' }}>{r.note}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <input style={S.inputSm} type="number" step="0.01" defaultValue={r.percent}
                        onBlur={e => Number(e.target.value) !== Number(r.percent) && saveIva(r.id, Number(e.target.value))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
