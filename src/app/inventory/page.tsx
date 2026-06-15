// src/app/inventory/page.tsx
'use client';

import { useState, useEffect } from 'react';

import { getStock, getKardex, getProducts, registerMove, getLocations } from '@/lib/inventory';

const S = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnSm: { padding: '0.35rem 0.7rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' },
  th: { padding: '0.7rem', textAlign: 'left' as const, fontSize: '0.75rem', textTransform: 'uppercase' as const, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '0.6rem 0.7rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' },
};

export default function InventoryPage() {
  const [stock, setStock] = useState<any[]>([]);
  const [kardex, setKardex] = useState<any[]>([]);
  const [kardexProduct, setKardexProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState(0);
  const [adjType, setAdjType] = useState<'in' | 'out'>('in');
  const [adjQty, setAdjQty] = useState(0);
  const [adjCost, setAdjCost] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [st, prods] = await Promise.all([getStock(), getProducts()]);
      setStock((st || []).filter((q: any) => q.location?.usage === 'internal'));
      setProducts(prods || []);
    } catch (e) { console.error(e); }
  }

  async function openKardex(productId: number, product: any) {
    try {
      const moves = await getKardex(productId);
      setKardex(moves || []);
      setKardexProduct(product);
    } catch (e) { console.error(e); }
  }

  async function handleAdjust() {
    if (!adjProductId || adjQty <= 0 || saving) return;
    try {
      setSaving(true);
      const locs = await getLocations();
      const internal = locs.find((l: any) => l.usage === 'internal');
      const inventory = locs.find((l: any) => l.usage === 'inventory');
      if (!internal || !inventory) { alert('Faltan ubicaciones. Ejecuta el SQL 007.'); return; }
      await registerMove({
        company_id: 1,
        product_id: adjProductId,
        move_type: adjType,
        quantity: adjQty,
        unit_cost: adjType === 'in' ? adjCost : undefined,
        date: new Date().toISOString().slice(0, 10),
        reference: adjType === 'in' ? 'AJUSTE ENTRADA / SALDO INICIAL' : 'AJUSTE SALIDA',
        location_internal_id: internal.id,
        location_virtual_id: inventory.id,
      });
      setAdjOpen(false);
      setAdjProductId(0); setAdjQty(0); setAdjCost(0);
      load();
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSaving(false); }
  }

  const fmtType = (t: string) => t === 'in' ? '▲ Entrada' : t === 'out' ? '▼ Salida' : 'Ajuste';

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Inventario</h1>
          <p className="text-slate-500 mt-2">Control de existencias y valoración por promedio ponderado</p>
        </div>
        <div className="flex gap-4 items-center">
          <button className="btn btn-primary shadow-lg shadow-blue-500/30" onClick={() => setAdjOpen(true)}>+ Ajuste / Saldo Inicial</button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Existencias (Bodega Principal) — Valoración: Promedio Ponderado</div>
          {stock.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin existencias. Registra una compra o un saldo inicial.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Producto</th><th style={{ ...S.th, textAlign: 'right' }}>Cantidad</th><th style={{ ...S.th, textAlign: 'right' }}>Costo Promedio</th><th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th><th style={S.th}></th></tr></thead>
              <tbody>{stock.map(q => (
                <tr key={q.id}>
                  <td style={S.td}>{q.product?.name || q.product_id}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>{Number(q.quantity).toFixed(2)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(q.avg_cost).toFixed(4)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${(Number(q.quantity) * Number(q.avg_cost)).toFixed(2)}</td>
                  <td style={S.td}><button style={S.btnSm} onClick={() => openKardex(q.product_id, q.product)}>Ver Kardex</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {kardexProduct && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Kardex — {kardexProduct.name}</div>
              <button style={{ ...S.btnSm, background: '#64748b' }} onClick={() => setKardexProduct(null)}>Cerrar</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Fecha</th><th style={S.th}>Referencia</th><th style={S.th}>Tipo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Cant.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Costo Unit.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Total Mov.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saldo Cant.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saldo Prom.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saldo Valor</th>
              </tr></thead>
              <tbody>{kardex.map(m => (
                <tr key={m.id}>
                  <td style={S.td}>{m.date}</td>
                  <td style={{ ...S.td, fontSize: '0.8rem' }}>{m.reference || '-'}</td>
                  <td style={{ ...S.td, color: m.move_type === 'in' ? '#166534' : '#b91c1c', fontWeight: 600 }}>{fmtType(m.move_type)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>{Number(m.quantity).toFixed(2)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(m.unit_cost).toFixed(4)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(m.total_cost).toFixed(2)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{Number(m.balance_qty).toFixed(2)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${Number(m.balance_avg_cost).toFixed(4)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${Number(m.balance_total).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </main>

      {adjOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', width: '100%', maxWidth: '550px' }}>
            <h2 style={{ marginBottom: '1.25rem', color: '#1e293b' }}>Ajuste de Inventario</h2>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
              <div><label style={S.label}>Producto *</label>
                <select style={S.input} value={adjProductId} onChange={e => setAdjProductId(Number(e.target.value))}>
                  <option value={0}>— Seleccionar —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label style={S.label}>Tipo de ajuste</label>
                <select style={S.input} value={adjType} onChange={e => setAdjType(e.target.value as any)}>
                  <option value="in">Entrada (saldo inicial / sobrante)</option>
                  <option value="out">Salida (faltante / baja)</option>
                </select></div>
              <div><label style={S.label}>Cantidad *</label>
                <input style={S.input} type="number" step="0.01" min="0" value={adjQty || ''} onChange={e => setAdjQty(parseFloat(e.target.value) || 0)} /></div>
              {adjType === 'in' && (
                <div><label style={S.label}>Costo unitario * (para promedio ponderado)</label>
                  <input style={S.input} type="number" step="0.000001" min="0" value={adjCost || ''} onChange={e => setAdjCost(parseFloat(e.target.value) || 0)} /></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button style={{ ...S.btn, flex: 1, opacity: (!adjProductId || adjQty <= 0 || saving) ? 0.5 : 1 }} disabled={!adjProductId || adjQty <= 0 || saving} onClick={handleAdjust}>{saving ? 'Guardando...' : 'Registrar Ajuste'}</button>
              <button style={{ ...S.btn, flex: 1, background: '#e2e8f0', color: '#334155' }} onClick={() => setAdjOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
