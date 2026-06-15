// src/app/taxes/ats/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCompanies } from '@/lib/supabase';
import { buildAtsFromDb, generateAtsXml, downloadXml } from '@/lib/ats-xml';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '900px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function AtsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [xml, setXml] = useState<string>('');
  const [stats, setStats] = useState<{ compras: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCompanies().then(c => { setCompanies(c); if (c.length > 0) setCompanyId(c[0].id); }).catch(console.error);
  }, []);

  async function handleGenerate() {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await buildAtsFromDb(companyId, anio, mes);
      const x = generateAtsXml(data);
      setXml(x);
      setStats({ compras: data.compras.length });
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  }

  function handleDownload() {
    if (!xml) return;
    downloadXml(xml, `ATS_${anio}_${String(mes).padStart(2, '0')}.xml`);
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <Link href="/taxes/withholdings" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>← Retenciones</Link>
        <h1 style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: '#1e293b' }}>ATS — Anexo Transaccional Simplificado</h1>
      </header>

      <main style={S.main}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.9rem 1.2rem', marginBottom: '1.5rem', fontSize: '0.88rem', color: '#92400e' }}>
          El XML se construye con las retenciones <strong>emitidas</strong> (estado: Emitida) del período.
          La sección de ventas se completará automáticamente cuando exista CAPA 4 (facturación).
          <strong> Valida la primera carga con el validador del SRI antes de presentar.</strong>
        </div>

        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={S.label}>Empresa</label>
              <select style={S.input} value={companyId || ''} onChange={e => setCompanyId(Number(e.target.value))}>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Año</label>
              <input style={S.input} type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} />
            </div>
            <div>
              <label style={S.label}>Mes</label>
              <select style={S.input} value={mes} onChange={e => setMes(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <button style={S.btn} onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generando...' : 'Generar ATS'}
            </button>
          </div>
        </div>

        {xml && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <strong style={{ color: '#1e293b' }}>XML generado</strong>
                <span style={{ marginLeft: '1rem', color: '#64748b', fontSize: '0.88rem' }}>
                  {stats?.compras || 0} compras con retención en {MESES[mes - 1]} {anio}
                </span>
              </div>
              <button style={{ ...S.btn, background: '#16a34a' }} onClick={handleDownload}>⬇ Descargar XML</button>
            </div>
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '420px' }}>
              {xml}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
