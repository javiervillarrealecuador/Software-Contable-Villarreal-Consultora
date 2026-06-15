// src/app/admin/page.tsx
// ══════════════════════════════════════════════════════════════════════════════
// SUPER ADMINISTRADOR — Panel central multiempresa
// ══════════════════════════════════════════════════════════════════════════════
// Permite gestionar todas las empresas del sistema:
//   • Ver estado de cada empresa (ambiente SRI, firma electrónica)
//   • Crear y editar empresas con todos los parámetros SRI
//   • Subir la firma electrónica (.p12) por empresa
//   • Acceso rápido a todos los comprobantes electrónicos por empresa
//
// ARQUITECTURA MULTIEMPRESA:
// Cada empresa tiene su propio sri_p12_b64 y sri_p12_pwd en res_company.
// La API /api/sri/sign acepta company_id para seleccionar el certificado correcto.
// Las páginas de comprobantes reciben ?company=<id> para saber qué empresa usar.

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Empresa {
  id: number;
  name: string;
  vat: string;
  active: boolean;
  sri_ambiente: number;          // 1=Pruebas, 2=Producción
  sri_estab: string;
  sri_pto_emi: string;
  sri_dir_matriz: string;
  sri_dir_estab: string;
  sri_obligado_contab: boolean;
  sri_contrib_especial: string;
  sri_agente_retencion: string;
  sri_rimpe: string;
  sri_firma_expira: string;      // ISO date YYYY-MM-DD
  sri_firma_razon: string;       // Nombre del titular del certificado
  sri_logo_b64: string;
  sri_email_envio: string;
}

const EMPTY_EMPRESA: Partial<Empresa> = {
  name: '',
  vat: '',
  sri_ambiente: 1,
  sri_estab: '001',
  sri_pto_emi: '001',
  sri_dir_matriz: '',
  sri_dir_estab: '',
  sri_obligado_contab: false,
  sri_contrib_especial: '',
  sri_agente_retencion: '',
  sri_rimpe: '',
  sri_email_envio: '',
};

// ── Estilos inline ─────────────────────────────────────────────────────────────

const S = {
  // Layout
  page:   { minHeight: '100vh', background: '#f0f4ff', fontFamily: "'Inter', system-ui, sans-serif" } as React.CSSProperties,
  header: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
    padding: '0 2rem', height: '64px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 2px 16px rgba(30,58,138,0.3)',
    position: 'sticky' as const, top: 0, zIndex: 50,
  },
  main: { maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' },

  // Stats bar
  statsBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  statCard: {
    background: 'white', borderRadius: '0.75rem', padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' as const,
  },

  // Grid de empresas
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' },

  // Tarjeta empresa
  card: {
    background: 'white', borderRadius: '1rem', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    transition: 'box-shadow 0.2s, transform 0.2s',
    display: 'flex', flexDirection: 'column' as const,
  },
  cardHeader: { padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #f1f5f9' },
  cardBody:   { padding: '1rem 1.25rem', flex: 1 },
  cardFooter: { padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9' },

  // Avatar empresa
  avatar: {
    width: 48, height: 48, borderRadius: '0.75rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '1.1rem', color: 'white',
    flexShrink: 0,
  },

  // Badges
  badge: (color: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
    background: color === 'green'  ? '#dcfce7' :
                color === 'yellow' ? '#fef9c3' :
                color === 'red'    ? '#fee2e2' :
                color === 'blue'   ? '#dbeafe' : '#f1f5f9',
    color:      color === 'green'  ? '#166534' :
                color === 'yellow' ? '#92400e' :
                color === 'red'    ? '#991b1b' :
                color === 'blue'   ? '#1d4ed8' : '#64748b',
  }) as React.CSSProperties,

  // Botones
  btn: (variant: 'primary' | 'ghost' | 'danger' | 'success') => ({
    padding: '0.5rem 1rem', borderRadius: '0.5rem',
    fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
    transition: 'background 0.15s',
    background: variant === 'primary'  ? '#2563eb' :
                variant === 'success'  ? '#16a34a' :
                variant === 'danger'   ? '#dc2626' :
                'transparent',
    color: variant === 'ghost' ? '#64748b' : 'white',
    border: variant === 'ghost' ? '1px solid #e2e8f0' : 'none',
  }) as React.CSSProperties,

  // Inputs / formulario
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const, outline: 'none', background: 'white' },
  select: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const, background: 'white' },

  // Modal
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modal:   { background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 24px 48px rgba(0,0,0,0.25)' },
  mHeader: { padding: '1.5rem', borderBottom: '1px solid #e2e8f0', position: 'sticky' as const, top: 0, background: 'white', zIndex: 1 },
  mBody:   { padding: '1.5rem' },
  mFooter: { padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
};

// ── Colores avatar por empresa ─────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#0891b2',
  '#059669', '#d97706', '#dc2626', '#9333ea',
];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

// ── Helpers fecha ──────────────────────────────────────────────────────────────

function firmaStatus(expira: string | null): { label: string; color: string; icon: string } {
  if (!expira) return { label: 'Sin firma', color: 'red', icon: '⚠' };
  const hoy = new Date();
  const exp = new Date(expira);
  const dias = Math.floor((exp.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0)   return { label: 'Vencida',    color: 'red',    icon: '✕' };
  if (dias < 30)  return { label: `Vence en ${dias}d`, color: 'yellow', icon: '⏰' };
  return { label: `Vigente hasta ${expira}`, color: 'green', icon: '✓' };
}

// ── Comprobantes rápidos ───────────────────────────────────────────────────────

const COMPROBANTES = [
  { key: 'facturas',     label: 'Facturas',        icon: '🧾', path: '/sales' },
  { key: 'notas-cred',   label: 'N. Crédito',      icon: '↩',  path: '/sales' },
  { key: 'notas-deb',    label: 'N. Débito',       icon: '↪',  path: '/sales' },
  { key: 'guias',        label: 'Guías Remisión',  icon: '🚚', path: '/sales' },
  { key: 'liquidaciones',label: 'Liquidaciones',   icon: '📋', path: '/purchases' },
  { key: 'retenciones',  label: 'Retenciones',     icon: '📌', path: '/taxes/withholdings' },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [empresas,    setEmpresas]    = useState<Empresa[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState<'none' | 'empresa' | 'firma'>('none');
  const [editing,     setEditing]     = useState<Empresa | null>(null);   // empresa en edición
  const [firmaEmpId,  setFirmaEmpId]  = useState<number | null>(null);
  const [form,        setForm]        = useState<Partial<Empresa>>(EMPTY_EMPRESA);
  const [saving,      setSaving]      = useState(false);
  const [prodConfirm, setProdConfirm] = useState(false);
  const [prodText,    setProdText]    = useState('');

  // Firma upload state
  const [p12File,     setP12File]     = useState<File | null>(null);
  const [p12Pwd,      setP12Pwd]      = useState('');
  const [firmaStatus2, setFirmaStatus2] = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadEmpresas(); }, []);

  // ── Carga ──────────────────────────────────────────────────────────────────

  async function loadEmpresas() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/companies');
      if (!r.ok) throw new Error(await r.text());
      setEmpresas(await r.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ── Empresa: abrir modal ───────────────────────────────────────────────────

  function openCrear() {
    setEditing(null);
    setForm({ ...EMPTY_EMPRESA });
    setProdConfirm(false);
    setProdText('');
    setModal('empresa');
  }

  function openEditar(e: Empresa) {
    setEditing(e);
    setForm({ ...e });
    setProdConfirm(false);
    setProdText('');
    setModal('empresa');
  }

  function openFirma(e: Empresa) {
    setFirmaEmpId(e.id);
    setP12File(null);
    setP12Pwd('');
    setFirmaStatus2(null);
    setModal('firma');
  }

  function cerrarModal() {
    setModal('none');
    setEditing(null);
    setFirmaEmpId(null);
  }

  // ── Empresa: guardar ───────────────────────────────────────────────────────

  async function handleSaveEmpresa() {
    if (!form.name?.trim()) { alert('La razón social es obligatoria.'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await fetch(`/api/admin/companies/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Error al guardar');
      } else {
        const r = await fetch('/api/admin/companies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Error al crear');
      }
      cerrarModal();
      await loadEmpresas();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Firma: subir ───────────────────────────────────────────────────────────

  async function handleUploadFirma() {
    if (!p12File || !p12Pwd.trim()) {
      alert('Selecciona el archivo .p12 e ingresa la contraseña.');
      return;
    }
    setUploadingFirma(true);
    setFirmaStatus2(null);
    try {
      // Convertir .p12 a base64
      const p12B64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
          const result = fr.result as string;
          resolve(result.split(',')[1]); // quitar "data:...;base64,"
        };
        fr.onerror = reject;
        fr.readAsDataURL(p12File);
      });

      const r = await fetch(`/api/admin/companies/${firmaEmpId}/firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p12B64, password: p12Pwd }),
      });
      const data = await r.json();
      if (!r.ok) {
        setFirmaStatus2({ ok: false, msg: data.error || 'Error al subir la firma' });
      } else {
        setFirmaStatus2({ ok: true, msg: `✓ Firma cargada — Titular: ${data.razon} | Vence: ${data.expira}` });
        await loadEmpresas();
      }
    } catch (e: any) {
      setFirmaStatus2({ ok: false, msg: 'Error al procesar el archivo: ' + e.message });
    } finally {
      setUploadingFirma(false);
    }
  }

  async function handleEliminarFirma() {
    if (!firmaEmpId) return;
    if (!confirm('¿Eliminar la firma electrónica de esta empresa? Los comprobantes ya no podrán firmarse.')) return;
    await fetch(`/api/admin/companies/${firmaEmpId}/firma`, { method: 'DELETE' });
    await loadEmpresas();
    cerrarModal();
  }

  // ── Campo helper ───────────────────────────────────────────────────────────

  function setF(field: keyof Empresa, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const empresaParaFirma = empresas.find(e => e.id === firmaEmpId);

  // ── Stats globales ─────────────────────────────────────────────────────────

  const total      = empresas.length;
  const activas    = empresas.filter(e => e.active).length;
  const prod       = empresas.filter(e => e.sri_ambiente === 2).length;
  const sinFirma   = empresas.filter(e => !e.sri_firma_expira).length;
  const firmaVenc  = empresas.filter(e => {
    if (!e.sri_firma_expira) return false;
    return new Date(e.sri_firma_expira) < new Date();
  }).length;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '0.6rem', padding: '6px 10px', fontSize: '1.4rem' }}>🏢</div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              ERP Ecuador — Super Administrador
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
              Gestión multiempresa · Facturación electrónica SRI
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', textDecoration: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.1)' }}>
            ← Dashboard
          </Link>
          <button
            onClick={openCrear}
            style={{ background: 'white', color: '#1d4ed8', border: 'none', borderRadius: '0.6rem', padding: '0.5rem 1.1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
          >
            + Nueva Empresa
          </button>
        </div>
      </header>

      <main style={S.main}>

        {/* ── Barra de estadísticas globales ── */}
        <div style={S.statsBar}>
          {[
            { label: 'Empresas totales',    value: total,    icon: '🏢', color: '#2563eb' },
            { label: 'Activas',             value: activas,  icon: '✅', color: '#16a34a' },
            { label: 'En Producción SRI',   value: prod,     icon: '🔴', color: '#dc2626' },
            { label: 'Sin firma config.',   value: sinFirma, icon: '⚠',  color: '#f59e0b' },
            { label: 'Firma vencida',       value: firmaVenc,icon: '✕',  color: '#991b1b' },
          ].map(s => (
            <div key={s.label} style={S.statCard}>
              <div style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{s.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Título sección ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
            Empresas registradas
          </h2>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {loading ? 'Cargando…' : `${empresas.length} empresa${empresas.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* ── Grid de empresas ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            Cargando empresas…
          </div>
        ) : empresas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No hay empresas registradas</div>
            <button onClick={openCrear} style={S.btn('primary')}>+ Crear primera empresa</button>
          </div>
        ) : (
          <div style={S.grid}>
            {empresas.map(emp => {
              const fs = firmaStatus(emp.sri_firma_expira);
              const isProd = emp.sri_ambiente === 2;
              return (
                <div key={emp.id} style={S.card}>

                  {/* Cabecera tarjeta */}
                  <div style={S.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
                      {/* Avatar */}
                      <div style={{ ...S.avatar, background: avatarColor(emp.id) }}>
                        {initials(emp.name)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                          RUC: {emp.vat || <em style={{ color: '#f59e0b' }}>No configurado</em>}
                        </div>
                        {/* Badges */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          <span style={S.badge(isProd ? 'red' : 'yellow')}>
                            {isProd ? '🔴 PRODUCCIÓN' : '🟡 PRUEBAS'}
                          </span>
                          <span style={S.badge(emp.active ? 'green' : 'red')}>
                            {emp.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div style={S.cardBody}>
                    {/* Firma electrónica */}
                    <div style={{
                      padding: '0.75rem', borderRadius: '0.6rem', marginBottom: '0.875rem',
                      background: fs.color === 'green' ? '#f0fdf4' : fs.color === 'yellow' ? '#fefce8' : '#fef2f2',
                      border: `1px solid ${fs.color === 'green' ? '#bbf7d0' : fs.color === 'yellow' ? '#fde68a' : '#fecaca'}`,
                    }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                        FIRMA ELECTRÓNICA
                      </div>
                      <div style={{ fontSize: '0.84rem', color: fs.color === 'green' ? '#166534' : fs.color === 'yellow' ? '#92400e' : '#991b1b', fontWeight: 600 }}>
                        {fs.icon} {fs.label}
                      </div>
                      {emp.sri_firma_razon && (
                        <div style={{ fontSize: '0.77rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.sri_firma_razon}
                        </div>
                      )}
                    </div>

                    {/* Datos SRI compactos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '0.875rem', fontSize: '0.8rem' }}>
                      {[
                        ['Estab.', emp.sri_estab || '-'],
                        ['Pto. emi.', emp.sri_pto_emi || '-'],
                        ['Ob. contab.', emp.sri_obligado_contab ? 'Sí' : 'No'],
                        ['Ambiente', isProd ? 'Producción' : 'Pruebas'],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: '#f8fafc', borderRadius: '0.4rem', padding: '5px 8px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>{k}</div>
                          <div style={{ color: '#334155', fontWeight: 700 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Accesos rápidos a comprobantes */}
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>
                      COMPROBANTES ELECTRÓNICOS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                      {COMPROBANTES.map(c => (
                        <Link
                          key={c.key}
                          href={`${c.path}?company=${emp.id}`}
                          title={c.label}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '8px 4px', borderRadius: '0.5rem',
                            background: '#f0f9ff', border: '1px solid #bae6fd',
                            textDecoration: 'none', color: '#0369a1',
                            fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.3,
                            transition: 'background 0.15s',
                          }}
                        >
                          <span style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{c.icon}</span>
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Footer con acciones */}
                  <div style={S.cardFooter}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEditar(emp)} style={S.btn('ghost')}>
                          ✏ Editar
                        </button>
                        <button
                          onClick={() => openFirma(emp)}
                          style={{
                            ...S.btn(fs.color === 'red' ? 'danger' : 'ghost'),
                            background: fs.color === 'red' ? '#fef2f2' : undefined,
                            color: fs.color === 'red' ? '#dc2626' : undefined,
                            border: '1px solid',
                            borderColor: fs.color === 'red' ? '#fecaca' : '#e2e8f0',
                          }}
                        >
                          🔐 Firma
                        </button>
                      </div>
                      <Link
                        href={`/settings?company=${emp.id}`}
                        style={{ ...S.btn('primary'), textDecoration: 'none', padding: '0.4rem 0.9rem' }}
                      >
                        ⚙ Config →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Tarjeta "+" para nueva empresa */}
            <div
              onClick={openCrear}
              style={{
                ...S.card, cursor: 'pointer', border: '2px dashed #cbd5e1',
                boxShadow: 'none', alignItems: 'center', justifyContent: 'center',
                minHeight: '200px', gap: '0.5rem', color: '#94a3b8',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.color = '#2563eb'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
            >
              <div style={{ fontSize: '2.5rem' }}>+</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Agregar empresa</div>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════
          MODAL — CREAR / EDITAR EMPRESA
      ════════════════════════════════════════════════════════════ */}
      {modal === 'empresa' && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div style={S.modal}>

            <div style={S.mHeader}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                {editing ? `Editar: ${editing.name}` : 'Nueva empresa'}
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Configure los parámetros de identificación y SRI
              </div>
            </div>

            <div style={S.mBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                {/* Razón social */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Razón social *</label>
                  <input style={S.input} value={form.name || ''} onChange={e => setF('name', e.target.value)} placeholder="Nombre completo de la empresa" />
                </div>

                {/* RUC */}
                <div>
                  <label style={S.label}>RUC (13 dígitos)</label>
                  <input style={S.input} value={form.vat || ''} onChange={e => setF('vat', e.target.value)} maxLength={13} placeholder="0400000000001" />
                </div>

                {/* Email envío */}
                <div>
                  <label style={S.label}>Email para envío de comprobantes</label>
                  <input style={S.input} type="email" value={form.sri_email_envio || ''} onChange={e => setF('sri_email_envio', e.target.value)} placeholder="facturacion@empresa.com" />
                </div>

                {/* Dirección matriz */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Dirección matriz</label>
                  <input style={S.input} value={form.sri_dir_matriz || ''} onChange={e => setF('sri_dir_matriz', e.target.value)} placeholder="Calle, número, ciudad" />
                </div>

                {/* Dirección establecimiento */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Dirección establecimiento (si difiere de la matriz)</label>
                  <input style={S.input} value={form.sri_dir_estab || ''} onChange={e => setF('sri_dir_estab', e.target.value)} placeholder="Dejar vacío si es igual a la matriz" />
                </div>

                {/* Estab / Pto. emi. */}
                <div>
                  <label style={S.label}>Establecimiento (estab)</label>
                  <input style={S.input} value={form.sri_estab || ''} onChange={e => setF('sri_estab', e.target.value)} maxLength={3} placeholder="001" />
                </div>
                <div>
                  <label style={S.label}>Punto de emisión (pto. emi.)</label>
                  <input style={S.input} value={form.sri_pto_emi || ''} onChange={e => setF('sri_pto_emi', e.target.value)} maxLength={3} placeholder="001" />
                </div>

                {/* Obligado a llevar contabilidad */}
                <div>
                  <label style={S.label}>Obligado a llevar contabilidad</label>
                  <select style={S.select} value={form.sri_obligado_contab ? '1' : '0'} onChange={e => setF('sri_obligado_contab', e.target.value === '1')}>
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </div>

                {/* RIMPE */}
                <div>
                  <label style={S.label}>Categoría RIMPE</label>
                  <input style={S.input} value={form.sri_rimpe || ''} onChange={e => setF('sri_rimpe', e.target.value)} placeholder="Vacío si no aplica" />
                </div>

                {/* Contrib. especial */}
                <div>
                  <label style={S.label}>Contribuyente especial (resolución)</label>
                  <input style={S.input} value={form.sri_contrib_especial || ''} onChange={e => setF('sri_contrib_especial', e.target.value)} placeholder="Vacío si no aplica" />
                </div>

                {/* Agente de retención */}
                <div>
                  <label style={S.label}>Agente de retención (resolución)</label>
                  <input style={S.input} value={form.sri_agente_retencion || ''} onChange={e => setF('sri_agente_retencion', e.target.value)} placeholder="Vacío si no aplica" />
                </div>

                {/* Ambiente SRI */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Ambiente SRI</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[
                      { val: 1, label: '🟡 Pruebas (certificación)', bg: '#fefce8', border: '#fde68a', textColor: '#92400e' },
                      { val: 2, label: '🔴 Producción (oficial)',    bg: '#fef2f2', border: '#fecaca', textColor: '#991b1b' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          if (opt.val === 2 && form.sri_ambiente !== 2) {
                            setProdConfirm(true);
                          } else {
                            setF('sri_ambiente', opt.val);
                          }
                        }}
                        style={{
                          flex: 1, padding: '0.75rem', border: `2px solid`,
                          borderColor: form.sri_ambiente === opt.val ? opt.border : '#e2e8f0',
                          borderRadius: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                          background: form.sri_ambiente === opt.val ? opt.bg : 'white',
                          color: form.sri_ambiente === opt.val ? opt.textColor : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Confirmación PRODUCCIÓN inline */}
                  {prodConfirm && (
                    <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.6rem' }}>
                      <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.4rem' }}>⚠ ¿Activar PRODUCCIÓN?</div>
                      <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                        Los comprobantes emitidos tendrán plena validez tributaria ante el SRI.
                        Escriba <strong>PRODUCCION</strong> para confirmar:
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          style={{ ...S.input, flex: 1 }}
                          value={prodText}
                          onChange={e => setProdText(e.target.value)}
                          placeholder="PRODUCCION"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (prodText === 'PRODUCCION') {
                              setF('sri_ambiente', 2);
                              setProdConfirm(false);
                              setProdText('');
                            } else {
                              alert('Escriba exactamente PRODUCCION');
                            }
                          }}
                          style={{ ...S.btn('danger'), flexShrink: 0 }}
                        >Confirmar</button>
                        <button type="button" onClick={() => { setProdConfirm(false); setProdText(''); }} style={S.btn('ghost')}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div style={S.mFooter}>
              <button onClick={cerrarModal} style={S.btn('ghost')}>Cancelar</button>
              <button onClick={handleSaveEmpresa} disabled={saving} style={S.btn('primary')}>
                {saving ? 'Guardando…' : editing ? '💾 Guardar cambios' : '+ Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — FIRMA ELECTRÓNICA
      ════════════════════════════════════════════════════════════ */}
      {modal === 'firma' && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div style={{ ...S.modal, maxWidth: '520px' }}>

            <div style={S.mHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '0.6rem', background: avatarColor(firmaEmpId || 0), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                  {initials(empresaParaFirma?.name || '')}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>
                    Firma electrónica
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{empresaParaFirma?.name}</div>
                </div>
              </div>
            </div>

            <div style={S.mBody}>

              {/* Estado actual */}
              {empresaParaFirma && (() => {
                const fs = firmaStatus(empresaParaFirma.sri_firma_expira);
                return (
                  <div style={{
                    padding: '0.875rem', borderRadius: '0.6rem', marginBottom: '1.25rem',
                    background: fs.color === 'green' ? '#f0fdf4' : fs.color === 'yellow' ? '#fefce8' : '#fef2f2',
                    border: `1px solid ${fs.color === 'green' ? '#bbf7d0' : fs.color === 'yellow' ? '#fde68a' : '#fecaca'}`,
                  }}>
                    <div style={{ fontWeight: 700, color: fs.color === 'green' ? '#166534' : fs.color === 'yellow' ? '#92400e' : '#991b1b', fontSize: '0.88rem' }}>
                      {fs.icon} {fs.label}
                    </div>
                    {empresaParaFirma.sri_firma_razon && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                        Titular: {empresaParaFirma.sri_firma_razon}
                      </div>
                    )}
                    {empresaParaFirma.sri_firma_expira && (
                      <button
                        onClick={handleEliminarFirma}
                        style={{ ...S.btn('ghost'), marginTop: '8px', fontSize: '0.76rem', color: '#dc2626', borderColor: '#fecaca' }}
                      >
                        🗑 Eliminar firma actual
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Info .p12 */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.6rem', padding: '0.875rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                <strong>¿Qué es el archivo .p12?</strong><br />
                Es el certificado de firma electrónica emitido por el SRI o una entidad autorizada (BCE, Security Data, ANF, etc.). Contiene la clave privada y el certificado público de la empresa. <strong>Nunca lo compartas por correo.</strong>
              </div>

              {/* Upload .p12 */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={S.label}>Archivo .p12 (certificado de firma)</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed ' + (p12File ? '#2563eb' : '#cbd5e1'),
                    borderRadius: '0.6rem', padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                    background: p12File ? '#eff6ff' : '#f8fafc',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{p12File ? '📄' : '📁'}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: p12File ? '#1d4ed8' : '#64748b' }}>
                    {p12File ? p12File.name : 'Haga clic para seleccionar el .p12'}
                  </div>
                  {p12File && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      {(p12File.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".p12,.pfx"
                  style={{ display: 'none' }}
                  onChange={e => {
                    setP12File(e.target.files?.[0] || null);
                    setFirmaStatus2(null);
                  }}
                />
              </div>

              {/* Contraseña */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={S.label}>Contraseña del certificado</label>
                <input
                  style={S.input}
                  type="password"
                  value={p12Pwd}
                  onChange={e => { setP12Pwd(e.target.value); setFirmaStatus2(null); }}
                  placeholder="Contraseña del archivo .p12"
                  autoComplete="new-password"
                />
              </div>

              {/* Resultado validación */}
              {firmaStatus2 && (
                <div style={{
                  padding: '0.875rem', borderRadius: '0.6rem',
                  background: firmaStatus2.ok ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${firmaStatus2.ok ? '#bbf7d0' : '#fecaca'}`,
                  color: firmaStatus2.ok ? '#166534' : '#991b1b',
                  fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5,
                }}>
                  {firmaStatus2.msg}
                </div>
              )}
            </div>

            <div style={S.mFooter}>
              <button onClick={cerrarModal} style={S.btn('ghost')}>Cerrar</button>
              <button
                onClick={handleUploadFirma}
                disabled={uploadingFirma || !p12File || !p12Pwd}
                style={{ ...S.btn('success'), opacity: (!p12File || !p12Pwd) ? 0.5 : 1 }}
              >
                {uploadingFirma ? '⏳ Validando y guardando…' : '🔐 Cargar firma electrónica'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
