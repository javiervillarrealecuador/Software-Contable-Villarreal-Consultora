// src/app/accounting/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCompanies } from '@/lib/supabase';
import { getAccounts, getAccountTypes, createAccount, updateAccount, deleteAccount } from '@/lib/accounting';
import type { Company } from '@/types/capa0';
import type { Account, AccountType, AccountFormData } from '@/types/capa1';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnGhost: { padding: '0.4rem 0.8rem', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '0.9rem' },
  input: { padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.75rem', textAlign: 'left' as const, fontSize: '0.75rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.65rem 0.75rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' },
};

export default function AccountingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState<AccountFormData>({
    code: '', name: '', account_type_id: 0, reconcile: false, is_group: false,
  });

  useEffect(() => { init(); }, []);
  useEffect(() => { if (companyId) loadAccounts(); }, [companyId]);

  async function init() {
    try {
      const comps = await getCompanies();
      setCompanies(comps);
      if (comps.length > 0) setCompanyId(comps[0].id);
      const types = await getAccountTypes();
      setAccountTypes(types);
      if (types.length > 0) setForm(f => ({ ...f, account_type_id: types[0].id }));
    } catch (e) { console.error(e); }
  }

  async function loadAccounts() {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await getAccounts(companyId);
      setAccounts(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ code: '', name: '', account_type_id: accountTypes[0]?.id || 0, reconcile: false, is_group: false });
    setEditId(null);
    setModalOpen(true);
  }

  function handleEdit(acc: Account) {
    setForm({
      code: acc.code,
      name: acc.name,
      account_type_id: acc.account_type_id,
      reconcile: acc.reconcile,
      is_group: acc.is_group,
    });
    setEditId(acc.id);
    setModalOpen(true);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Estás seguro de eliminar la cuenta ${name}?`)) return;
    try {
      await deleteAccount(id);
      loadAccounts();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo eliminar. Puede tener movimientos asociados.'));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editId) {
        await updateAccount(editId, form);
      } else {
        await createAccount({ ...form, company_id: companyId });
      }
      setModalOpen(false);
      setForm({ code: '', name: '', account_type_id: accountTypes[0]?.id || 0, reconcile: false, is_group: false });
      setEditId(null);
      loadAccounts();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar la cuenta'));
    }
  }

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
  );

  // Indentación visual según profundidad del código (1.01.02 → nivel 3)
  function depth(code: string) {
    return code.split('.').length - 1;
  }

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Plan de Cuentas</h1>
          <p className="text-slate-500 mt-2">Gestión del catálogo contable</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/accounting/batch" className="btn btn-ghost bg-indigo-50 text-indigo-700">⚡ Contabilización Masiva</Link>
          <Link href="/accounting/moves" className="btn btn-ghost">Ver Asientos Contables →</Link>
          <button className="btn btn-primary" onClick={openNew}>+ Nueva Cuenta</button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label style={S.label}>Empresa</label>
              <select style={S.input} value={companyId || ''} onChange={e => setCompanyId(Number(e.target.value))}>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Buscar</label>
              <input style={S.input} placeholder="Código o nombre de cuenta..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={S.card}>
          {loading ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Cargando...</p> :
           filtered.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay cuentas. Ejecuta la migración 002 en Supabase para cargar el plan de cuentas base.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Código</th>
                  <th style={S.th}>Nombre</th>
                  <th style={S.th}>Tipo</th>
                  <th style={S.th}>Conciliable</th>
                  <th style={S.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => (
                  <tr key={acc.id} style={{ background: acc.is_group ? '#f8fafc' : 'white' }}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: acc.is_group ? 700 : 400 }}>{acc.code}</td>
                    <td style={{ ...S.td, paddingLeft: `${0.75 + depth(acc.code) * 1.25}rem`, fontWeight: acc.is_group ? 700 : 400, color: acc.is_group ? '#1e293b' : '#475569' }}>
                      {acc.name}
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
                        {(acc as any).account_type?.name || '-'}
                      </span>
                    </td>
                    <td style={S.td}>{acc.reconcile ? '✓' : ''}</td>
                    <td style={S.td}>
                      <button onClick={() => handleEdit(acc)} style={{...S.btnGhost, color: '#2563eb'}}>Editar</button>
                      <button onClick={() => handleDelete(acc.id, acc.name)} style={{...S.btnGhost, color: '#ef4444'}}>Eliminar</button>
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
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>{editId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={S.label}>Código * (ej: 1.01.01.03)</label>
                  <input style={S.input} required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Nombre *</label>
                  <input style={S.input} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Tipo de Cuenta *</label>
                  <select style={S.input} value={form.account_type_id} onChange={e => setForm({ ...form, account_type_id: Number(e.target.value) })}>
                    {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={form.is_group} onChange={e => setForm({ ...form, is_group: e.target.checked })} />
                    Cuenta de grupo
                  </label>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={form.reconcile} onChange={e => setForm({ ...form, reconcile: e.target.checked })} />
                    Conciliable (CxC/CxP)
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" style={{ ...S.btn, flex: 1 }}>{editId ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
                <button type="button" style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => setModalOpen(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

