// src/app/accounting/moves/page.tsx
'use client';

import { useState, useEffect } from 'react';

import { getCompanies } from '@/lib/supabase';
import { getAccounts, getJournals, getMoves, createMove, postMove } from '@/lib/accounting';
import { getMoveTotals } from '@/types/capa1';
import type { Company } from '@/types/capa0';
import type { Account, Journal, Move, MoveLineInput } from '@/types/capa1';

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
};

const emptyLine = (): MoveLineInput => ({ account_id: 0, name: '', debit: 0, credit: 0 });

export default function MovesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [journalId, setJournalId] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState<MoveLineInput[]>([emptyLine(), emptyLine()]);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (companyId) loadAll(); }, [companyId]);

  async function init() {
    try {
      const comps = await getCompanies();
      setCompanies(comps);
      if (comps.length > 0) setCompanyId(comps[0].id);
    } catch (e) { console.error(e); }
  }

  async function loadAll() {
    if (!companyId) return;
    try {
      setLoading(true);
      const [mvs, accs, jnls] = await Promise.all([
        getMoves(companyId),
        getAccounts(companyId),
        getJournals(companyId),
      ]);
      setMoves(mvs || []);
      setAccounts((accs || []).filter((a: Account) => !a.is_group)); // solo cuentas de movimiento
      setJournals(jnls || []);
      if (jnls && jnls.length > 0) setJournalId(jnls[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function updateLine(idx: number, field: keyof MoveLineInput, value: any) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  const totals = getMoveTotals(lines);
  const balanced = Math.abs(totals.difference) < 0.005 && totals.totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || saving) return;
    
    const validLines = lines.filter(l => l.account_id > 0 && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      alert('El asiento necesita al menos 2 líneas válidas con cuenta y valor.');
      return;
    }

    try {
      setSaving(true);
      await createMove(companyId, { journal_id: journalId, date, ref, lines: validLines });
      setModalOpen(false);
      setLines([emptyLine(), emptyLine()]);
      setRef('');
      loadAll();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo crear el asiento'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(moveId: number) {
    try {
      await postMove(moveId);
      loadAll();
    } catch (err: any) {
      alert('Error al publicar: ' + (err.message || ''));
    }
  }

  const stateBadge = (state: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      draft: { bg: '#fef9c3', color: '#854d0e', text: 'Borrador' },
      posted: { bg: '#dcfce7', color: '#166534', text: 'Publicado' },
      cancel: { bg: '#fee2e2', color: '#991b1b', text: 'Cancelado' },
    };
    const s = styles[state] || styles.draft;
    return <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: s.bg, color: s.color, fontWeight: 600 }}>{s.text}</span>;
  };

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Asientos Contables</h1>
          <p className="text-slate-500 mt-2">Libro diario y movimientos financieros</p>
        </div>
        <div className="flex gap-4 items-center">
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Nuevo Asiento</button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          <label style={S.label}>Empresa</label>
          <select style={{ ...S.input, maxWidth: '400px' }} value={companyId || ''} onChange={e => setCompanyId(Number(e.target.value))}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={S.card}>
          {loading ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Cargando...</p> :
           moves.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay asientos registrados. Crea el primero.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Número</th>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Diario</th>
                  <th style={S.th}>Referencia</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
                  <th style={S.th}>Estado</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {moves.map(m => (
                  <tr key={m.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{m.name}</td>
                    <td style={S.td}>{m.date}</td>
                    <td style={S.td}>{(m as any).journal?.name || '-'}</td>
                    <td style={S.td}>{m.ref || '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(m.amount_total).toFixed(2)}</td>
                    <td style={S.td}>{stateBadge(m.state)}</td>
                    <td style={S.td}>
                      {m.state === 'draft' && (
                        <button style={S.btnSm} onClick={() => handlePost(m.id)}>Publicar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* MODAL NUEVO ASIENTO */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Nuevo Asiento Contable</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={S.label}>Diario *</label>
                  <select style={S.input} value={journalId} onChange={e => setJournalId(Number(e.target.value))}>
                    {journals.map(j => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Fecha *</label>
                  <input style={S.input} type="date" required value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Referencia</label>
                  <input style={S.input} placeholder="Ej: Factura 001-001-123" value={ref} onChange={e => setRef(e.target.value)} />
                </div>
              </div>

              {/* LÍNEAS */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: '40%' }}>Cuenta</th>
                    <th style={S.th}>Descripción</th>
                    <th style={{ ...S.th, width: '120px' }}>Débito</th>
                    <th style={{ ...S.th, width: '120px' }}>Crédito</th>
                    <th style={{ ...S.th, width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.3rem' }}>
                        <select style={S.input} value={line.account_id} onChange={e => updateLine(idx, 'account_id', Number(e.target.value))}>
                          <option value={0}>— Seleccionar cuenta —</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.3rem' }}>
                        <input style={S.input} placeholder="Detalle" value={line.name || ''} onChange={e => updateLine(idx, 'name', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.3rem' }}>
                        <input style={{ ...S.input, textAlign: 'right' }} type="number" step="0.01" min="0" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td style={{ padding: '0.3rem' }}>
                        <input style={{ ...S.input, textAlign: 'right' }} type="number" step="0.01" min="0" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                        {lines.length > 2 && (
                          <button type="button" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem' }}
                            onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" style={{ ...S.btn, background: '#f1f5f9', color: '#334155', marginBottom: '1rem' }}
                onClick={() => setLines(prev => [...prev, emptyLine()])}>+ Agregar línea</button>

              {/* TOTALES */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', padding: '1rem', background: balanced ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                <span>Débitos: <strong>${totals.totalDebit.toFixed(2)}</strong></span>
                <span>Créditos: <strong>${totals.totalCredit.toFixed(2)}</strong></span>
                <span style={{ color: balanced ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  {balanced ? '✓ Balanceado' : `Diferencia: $${totals.difference.toFixed(2)}`}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={!balanced || saving} style={{ ...S.btn, flex: 1, opacity: (!balanced || saving) ? 0.5 : 1, cursor: (!balanced || saving) ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Guardar Asiento (Borrador)'}
                </button>
                <button type="button" style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => setModalOpen(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

