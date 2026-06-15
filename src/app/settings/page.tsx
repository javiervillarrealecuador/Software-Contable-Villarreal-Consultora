// src/app/settings/page.tsx
// Configuración de la empresa: parámetros SRI y paso a producción.
//
// CONCEPTOS CLAVE:
//
//   Ambiente 1 = PRUEBAS (celcer.sri.gob.ec)
//     → Infraestructura separada del SRI. Las claves de acceso tienen el dígito 24 = 1.
//     → Los comprobantes NO tienen valor tributario. El SRI no los registra en su base
//       de datos de contribuyentes.
//     → Usar para desarrollo, capacitación y certificación antes de producción.
//
//   Ambiente 2 = PRODUCCIÓN (cel.sri.gob.ec)
//     → Infraestructura oficial del SRI. Las claves de acceso tienen el dígito 24 = 2.
//     → Los comprobantes SÍ tienen plena validez tributaria y legal.
//     → Requiere haber obtenido la certificación del SRI (proceso presencial o en línea).
//     → NO ES REVERSIBLE fácilmente: cambiar de vuelta a pruebas invalidará los
//       secuenciales ya usados en producción ante el SRI.
//
//   El mismo valor (sri_ambiente) alimenta tres lugares del sistema:
//     1. La URL del web service SOAP (sri-soap.ts)
//     2. El dígito 24 de la clave de acceso (sri-factura.ts, sri-docs.ts)
//     3. La etiqueta <ambiente> dentro del XML del comprobante
//   Los tres DEBEN ser coherentes. El sistema los deriva del mismo campo → nunca
//   pueden quedar desincronizados.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '860px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' as const },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1rem' },
};

interface CompanyFields {
  id: number;
  name: string;
  vat: string;
  sri_ambiente: number;
  sri_dir_matriz: string;
  sri_dir_estab: string;
  sri_estab: string;
  sri_pto_emi: string;
  sri_obligado_contab: boolean;
  sri_contrib_especial: string;
  sri_agente_retencion: string;
  sri_rimpe: string;
}

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyFields | null>(null);
  const [form, setForm] = useState<Partial<CompanyFields>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showProdWarning, setShowProdWarning] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => { loadCompany(); }, []);

  async function loadCompany() {
    const { data, error } = await supabase
      .from('res_company').select('*').eq('id', 1).single();
    if (error) { console.error(error); return; }
    setCompany(data);
    setForm(data);
  }

  function set(field: keyof CompanyFields, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!company || saving) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('res_company')
        .update({
          name: form.name,
          vat: form.vat,
          sri_ambiente: form.sri_ambiente,
          sri_dir_matriz: form.sri_dir_matriz,
          sri_dir_estab: form.sri_dir_estab,
          sri_estab: form.sri_estab,
          sri_pto_emi: form.sri_pto_emi,
          sri_obligado_contab: form.sri_obligado_contab,
          sri_contrib_especial: form.sri_contrib_especial || null,
          sri_agente_retencion: form.sri_agente_retencion || null,
          sri_rimpe: form.sri_rimpe || null,
        })
        .eq('id', company.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadCompany();
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSaving(false); }
  }

  function requestProduccion() {
    // Se muestra el diálogo de confirmación con advertencias explícitas
    setShowProdWarning(true);
    setConfirmText('');
  }

  function confirmProduccion() {
    if (confirmText !== 'PRODUCCION') {
      alert('Escriba exactamente PRODUCCION para confirmar.');
      return;
    }
    set('sri_ambiente', 2);
    setShowProdWarning(false);
    setConfirmText('');
  }

  const isProduccion = form.sri_ambiente === 2;

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Configuración de empresa</h1>
          <p className="text-slate-500 mt-2">Ajustes generales y credenciales del SRI</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/settings/users" className="btn btn-outline">Gestión de Usuarios</Link>
          {saved && <span className="text-green-700 font-semibold text-sm bg-green-100 px-3 py-1 rounded-full">✓ Guardado</span>}
          <button className="btn btn-primary shadow-lg shadow-blue-500/30" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      <main style={S.main}>
        {!company ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>Cargando configuración...</p>
        ) : (
          <>
            {/* Datos generales */}
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Datos de la empresa</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Razón social</label>
                  <input style={S.input} value={form.name || ''} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>RUC</label>
                  <input style={S.input} value={form.vat || ''} onChange={e => set('vat', e.target.value)} maxLength={13} placeholder="13 dígitos" />
                </div>
                <div>
                  <label style={S.label}>Establecimiento (estab)</label>
                  <input style={S.input} value={form.sri_estab || ''} onChange={e => set('sri_estab', e.target.value)} maxLength={3} placeholder="001" />
                </div>
                <div>
                  <label style={S.label}>Punto de emisión (pto. emi.)</label>
                  <input style={S.input} value={form.sri_pto_emi || ''} onChange={e => set('sri_pto_emi', e.target.value)} maxLength={3} placeholder="001" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Dirección matriz</label>
                  <input style={S.input} value={form.sri_dir_matriz || ''} onChange={e => set('sri_dir_matriz', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={S.label}>Dirección establecimiento (si difiere de la matriz)</label>
                  <input style={S.input} value={form.sri_dir_estab || ''} onChange={e => set('sri_dir_estab', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Obligado a llevar contabilidad</label>
                  <select style={S.input} value={form.sri_obligado_contab ? '1' : '0'} onChange={e => set('sri_obligado_contab', e.target.value === '1')}>
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Contribuyente especial (resolución)</label>
                  <input style={S.input} value={form.sri_contrib_especial || ''} onChange={e => set('sri_contrib_especial', e.target.value)} placeholder="Vacío si no aplica" />
                </div>
                <div>
                  <label style={S.label}>Agente de retención (resolución)</label>
                  <input style={S.input} value={form.sri_agente_retencion || ''} onChange={e => set('sri_agente_retencion', e.target.value)} placeholder="Vacío si no aplica" />
                </div>
                <div>
                  <label style={S.label}>Categoría RIMPE</label>
                  <input style={S.input} value={form.sri_rimpe || ''} onChange={e => set('sri_rimpe', e.target.value)} placeholder="Vacío si no aplica" />
                </div>
              </div>
            </div>

            {/* Ambiente SRI */}
            <div style={{ ...S.card, border: isProduccion ? '2px solid #166534' : '2px solid #f59e0b' }}>
              <h2 style={S.sectionTitle}>Ambiente SRI</h2>

              {/* Estado actual */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                borderRadius: '0.6rem', marginBottom: '1.25rem',
                background: isProduccion ? '#dcfce7' : '#fef9c3',
                border: `1px solid ${isProduccion ? '#86efac' : '#fde047'}`,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  background: isProduccion ? '#16a34a' : '#f59e0b',
                  boxShadow: `0 0 0 4px ${isProduccion ? '#dcfce7' : '#fef9c3'}`,
                }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: isProduccion ? '#166534' : '#92400e' }}>
                    {isProduccion ? 'PRODUCCIÓN' : 'PRUEBAS (certificación)'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: isProduccion ? '#166534' : '#92400e' }}>
                    {isProduccion
                      ? 'Los comprobantes tienen plena validez tributaria y legal ante el SRI.'
                      : 'Los comprobantes NO tienen validez tributaria. Ambiente de certificación.'}
                  </div>
                </div>
              </div>

              {/* Explicación técnica */}
              <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.6rem' }}>
                  <strong>¿Qué cambia al pasar a producción?</strong><br />
                  El sistema usa este valor en tres lugares simultáneamente:
                </p>
                <ol style={{ margin: '0 0 0.6rem', paddingLeft: '1.5rem' }}>
                  <li>La <strong>URL del web service SOAP</strong> apunta a <code>cel.sri.gob.ec</code> (producción) en lugar de <code>celcer.sri.gob.ec</code> (pruebas).</li>
                  <li>El <strong>dígito 24 de la clave de acceso</strong> cambia de 1 a 2, lo que hace que las claves sean distintas e irrepetibles entre ambientes.</li>
                  <li>La etiqueta <strong>&lt;ambiente&gt;</strong> dentro del XML del comprobante toma el valor 2.</li>
                </ol>
                <p style={{ margin: '0', color: '#dc2626', fontWeight: 600 }}>
                  ⚠ Requisito previo: haber completado la certificación formal ante el SRI
                  (proceso en línea en <code>sri.gob.ec → Servicios en línea → Emisión de comprobantes electrónicos</code>).
                  Sin certificación, los comprobantes en producción serán rechazados.
                </p>
              </div>

              {/* Acciones */}
              {!isProduccion ? (
                <button
                  style={{ ...S.btn, background: '#dc2626' }}
                  onClick={requestProduccion}
                >
                  Activar ambiente de PRODUCCIÓN
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: '#166534', fontWeight: 600 }}>✓ Producción activa</span>
                  <button
                    style={{ ...S.btn, background: '#64748b', fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
                    onClick={() => {
                      if (confirm('¿Regresar a ambiente de PRUEBAS? Los comprobantes dejarán de tener validez tributaria.'))
                        set('sri_ambiente', 1);
                    }}
                  >
                    Regresar a pruebas
                  </button>
                </div>
              )}
            </div>

            {/* SMTP */}
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Correo electrónico (SMTP)</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                Configure estas variables en el archivo <code>.env.local</code> del proyecto
                (no se guardan en la base de datos por seguridad):
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#475569' }}>Variable</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#475569' }}>Valor de ejemplo</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#475569' }}>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['SMTP_HOST', 'smtp.gmail.com', 'Servidor SMTP'],
                    ['SMTP_PORT', '587', '587=STARTTLS, 465=SSL'],
                    ['SMTP_SECURE', 'false', '"true" solo para puerto 465'],
                    ['SMTP_USER', 'correo@empresa.com', 'Cuenta emisora'],
                    ['SMTP_PASS', '****', 'Contraseña de aplicación (Google: Seguridad → Contraseñas de app)'],
                    ['SMTP_FROM', '"ERP Ecuador <correo@empresa.com>"', 'Nombre y correo del remitente'],
                  ].map(([k, v, d]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#0369a1' }}>{k}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#475569' }}>{v}</td>
                      <td style={{ padding: '6px 10px', color: '#64748b' }}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Modal confirmación producción */}
      {showProdWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '520px' }}>
            <h2 style={{ color: '#dc2626', margin: '0 0 1rem' }}>⚠ Activar PRODUCCIÓN</h2>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.9rem', color: '#991b1b' }}>
              <strong>Lea antes de continuar:</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.3rem', lineHeight: 1.7 }}>
                <li>Debe tener la certificación SRI completada.</li>
                <li>Los comprobantes emitidos en producción tendrán validez tributaria real.</li>
                <li>Los secuenciales usados en producción NO pueden reutilizarse.</li>
                <li>El sistema apuntará a <code>cel.sri.gob.ec</code>.</li>
              </ul>
            </div>

            <label style={S.label}>
              Escriba <strong>PRODUCCION</strong> (sin tilde) para confirmar:
            </label>
            <input
              style={{ ...S.input, marginBottom: '1rem', borderColor: confirmText === 'PRODUCCION' ? '#16a34a' : '#cbd5e1' }}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="PRODUCCION"
              autoFocus
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                style={{ ...S.btn, flex: 1, background: '#dc2626', opacity: confirmText === 'PRODUCCION' ? 1 : 0.4 }}
                disabled={confirmText !== 'PRODUCCION'}
                onClick={confirmProduccion}
              >
                Activar producción
              </button>
              <button
                style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }}
                onClick={() => setShowProdWarning(false)}
              >
                Cancelar
              </button>
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
              Recuerde presionar <strong>"Guardar cambios"</strong> después de confirmar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
