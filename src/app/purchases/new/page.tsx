'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanies, getPartners } from '@/lib/supabase';
import { createPurchase, PurchaseLine } from '@/lib/purchases';
import { getProducts, getLocations } from '@/lib/inventory';
import QuickCreatePartnerModal from '@/components/modals/QuickCreatePartnerModal';
import QuickCreateProductModal from '@/components/modals/QuickCreateProductModal';
import SelectPartnerModal from '@/components/modals/SelectPartnerModal';
import SelectProductModal from '@/components/modals/SelectProductModal';

const S = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 40 },
  main: { maxWidth: '1600px', margin: '0 auto', padding: '1.5rem' },
  panel: { background: 'white', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  panelTitle: { fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' as const, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' },
  btn: { padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnOutline: { padding: '0.6rem 1.2rem', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '0.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  btnSm: { padding: '0.2rem 0.5rem', background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '0.2rem', fontSize: '0.75rem', cursor: 'pointer' },
  input: { padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: '0.2rem', fontSize: '0.85rem', width: '100%', background: '#fff' },
  inputReadonly: { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.2rem', fontSize: '0.85rem', width: '100%', background: '#f8fafc', color: '#475569' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem', color: '#475569' },
  grid: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: '1rem' }),
  th: { padding: '0.5rem', textAlign: 'left' as const, fontSize: '0.75rem', color: '#334155', borderBottom: '2px solid #cbd5e1', background: '#f8fafc' },
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' },
};

const TIPO_COMPROBANTE = [
  { cod: '01', label: '01 Factura' },
  { cod: '03', label: '03 Liquidación de compra' },
  { cod: '04', label: '04 Nota de Crédito' },
  { cod: '05', label: '05 Nota de Débito' },
];

const SUSTENTO = [
  { cod: '01', label: '01 Crédito Tributario para declaración de IVA' },
  { cod: '02', label: '02 Costo o Gasto para declaración de IR' },
  { cod: '10', label: '10 Distribución de Dividendos' },
];

export default function NewPurchasePage() {
  const router = useRouter();
  const [partners, setPartners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<number>(1);

  // Form State
  const [partnerId, setPartnerId] = useState<number>(0);
  const [dateOrder, setDateOrder] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [invoiceSerie, setInvoiceSerie] = useState('001-001');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [invoiceAuth, setInvoiceAuth] = useState('');
  
  const [tipoComprobante, setTipoComprobante] = useState('01');
  const [sustento, setSustento] = useState('01');
  
  const [amountNoIva, setAmountNoIva] = useState(0);
  const [amountExentoIva, setAmountExentoIva] = useState(0);

  const [lines, setLines] = useState<PurchaseLine[]>([{ product_id: null, description: '', quantity: 1, price_unit: 0, discount: 0, iva_rate: 15, location_id: null }]);

  // Modal states
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showProductModalForLine, setShowProductModalForLine] = useState<number | null>(null);
  const [showSelectPartnerModal, setShowSelectPartnerModal] = useState(false);
  const [showSelectProductModalForLine, setShowSelectProductModalForLine] = useState<number | null>(null);

  async function loadData() {
    const comps = await getCompanies();
    const compId = comps.length > 0 ? comps[0].id : 1;
    setActiveCompanyId(compId);

    const ps = await getPartners(compId);
    setPartners(ps || []);
    const prods = await getProducts();
    setProducts(prods || []);
    const locs = await getLocations();
    setLocations(locs.filter((l: any) => l.usage === 'internal') || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedPartner = useMemo(() => partners.find(p => p.id === partnerId), [partnerId, partners]);

  const totals = useMemo(() => {
    let subGravado = 0;
    let subTarifa0 = 0;
    let iva = 0;

    lines.forEach(l => {
      const sub = l.quantity * l.price_unit;
      const desc = sub * ((l.discount || 0) / 100);
      const subNeto = sub - desc;
      
      if (l.iva_rate > 0) {
        subGravado += subNeto;
        iva += subNeto * (l.iva_rate / 100);
      } else {
        subTarifa0 += subNeto;
      }
    });

    return {
      subGravado,
      subTarifa0,
      iva,
      total: subGravado + subTarifa0 + iva + amountNoIva + amountExentoIva
    };
  }, [lines, amountNoIva, amountExentoIva]);

  function updLine(i: number, field: keyof PurchaseLine, value: any) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  async function handleSave() {
    if (!partnerId) { alert('Seleccione un proveedor.'); return; }
    if (!invoiceNum) { alert('Ingrese el número de factura.'); return; }
    const validLines = lines.filter(l => l.quantity > 0 && l.price_unit > 0);
    if (validLines.length === 0) { alert('Agregue al menos un producto con precio.'); return; }

    const fullInvoiceRef = `${invoiceSerie}-${invoiceNum.padStart(9, '0')}`;

    try {
      setSaving(true);
      await createPurchase({
        company_id: activeCompanyId,
        partner_id: partnerId,
        date_order: dateOrder,
        due_date: dueDate,
        invoice_ref: fullInvoiceRef,
        invoice_auth: invoiceAuth,
        invoice_date: invoiceDate,
        tipo_comprobante: tipoComprobante,
        sustento_tributario: sustento,
        amount_no_iva: amountNoIva,
        amount_exento_iva: amountExentoIva,
        lines: validLines,
      });
      router.push('/purchases');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>Factura Compra</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={S.btnOutline} onClick={() => router.push('/purchases')}>Cerrar</button>
          <button style={S.btn} onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </header>

      <main style={S.main}>
        {/* BLOQUE SUPERIOR: DATOS PROVEEDOR Y DOCUMENTO */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ ...S.panel, flex: 2 }}>
            <div style={S.panelTitle}>Datos Proveedor</div>
            <div style={S.grid('1fr 1fr')}>
              <div>
                <label style={S.label}>Proveedor / Vendedor *</label>
                <button
                  type="button"
                  onClick={() => setShowSelectPartnerModal(true)}
                  style={{ ...S.input, textAlign: 'left', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  {selectedPartner ? `${selectedPartner.name} ${selectedPartner.identification || selectedPartner.vat ? `(${selectedPartner.identification || selectedPartner.vat})` : ''}` : '-- Seleccionar Proveedor --'}
                </button>
              </div>
              <div>
                <label style={S.label}>RUC/Cédula</label>
                <input style={S.inputReadonly} readOnly value={selectedPartner?.vat || ''} />
              </div>
              <div>
                <label style={S.label}>Autorización SRI</label>
                <input style={S.input} value={invoiceAuth} onChange={e => setInvoiceAuth(e.target.value)} placeholder="Ej: 49 dígitos" />
              </div>
              <div>
                <label style={S.label}>Dirección</label>
                <input style={S.inputReadonly} readOnly value={selectedPartner?.street || ''} />
              </div>
            </div>
          </div>

          <div style={{ ...S.panel, flex: 1.5 }}>
            <div style={S.panelTitle}>Datos Documento</div>
            <div style={S.grid('1fr 1.5fr')}>
              <div>
                <label style={S.label}>Serie Nº</label>
                <input style={S.input} value={invoiceSerie} onChange={e => setInvoiceSerie(e.target.value)} placeholder="001-001" />
              </div>
              <div>
                <label style={S.label}>Factura Nº</label>
                <input style={S.input} value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} placeholder="000000123" />
              </div>
              <div>
                <label style={S.label}>Fecha Factura</label>
                <input style={S.input} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Fecha Registro (Contabilidad)</label>
                <input style={S.input} type="date" value={dateOrder} onChange={e => setDateOrder(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Vence en</label>
                <input style={S.input} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE CENTRAL: LINEAS */}
        <div style={S.panel}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Bodega</th>
                <th style={S.th}>ITEM (Producto)</th>
                <th style={S.th}>Descripción</th>
                <th style={{ ...S.th, width: 80 }}>Cantidad</th>
                <th style={{ ...S.th, width: 100 }}>Costo Unit</th>
                <th style={{ ...S.th, width: 80 }}>% Desc</th>
                <th style={{ ...S.th, width: 80 }}>IVA %</th>
                <th style={{ ...S.th, width: 100, textAlign: 'right' }}>Total Línea</th>
                <th style={{ ...S.th, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={S.td}>
                    <select style={S.input} value={l.location_id || ''} onChange={e => updLine(i, 'location_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— Defecto —</option>
                      {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button
                      type="button"
                      onClick={() => setShowSelectProductModalForLine(i)}
                      style={{ ...S.input, textAlign: 'left', backgroundColor: '#fff', cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
                    >
                      {l.product_id ? (products.find((p: any) => p.id === l.product_id)?.name || `Producto #${l.product_id}`) : '-- Seleccionar --'}
                    </button>
                  </td>
                  <td style={S.td}>
                    <input style={S.input} value={l.description || ''} onChange={e => updLine(i, 'description', e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <input style={S.input} type="number" step="0.01" value={l.quantity || ''} onChange={e => updLine(i, 'quantity', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={S.td}>
                    <input style={S.input} type="number" step="0.0001" value={l.price_unit || ''} onChange={e => updLine(i, 'price_unit', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={S.td}>
                    <input style={S.input} type="number" step="0.01" value={l.discount || ''} onChange={e => updLine(i, 'discount', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td style={S.td}>
                    <select style={S.input} value={l.iva_rate} onChange={e => updLine(i, 'iva_rate', Number(e.target.value))}>
                      <option value={15}>15%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace' }}>
                    ${((l.quantity * l.price_unit) * (1 - (l.discount || 0) / 100)).toFixed(2)}
                  </td>
                  <td style={S.td}>
                    <button style={S.btnSm} onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '0.5rem' }}>
            <button style={S.btnSm} onClick={() => setLines(ls => [...ls, { product_id: null, description: '', quantity: 1, price_unit: 0, discount: 0, iva_rate: 15, location_id: null }])}>
              + Línea
            </button>
          </div>
        </div>

        {/* BLOQUE INFERIOR: TRIBUTACION Y TOTALES */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          
          {/* TRIBUTACION */}
          <div style={{ ...S.panel, flex: 1.5 }}>
            <div style={S.grid('1fr')}>
              <div>
                <label style={S.label}>Tipo Comprobante [F2]</label>
                <select style={S.input} value={tipoComprobante} onChange={e => setTipoComprobante(e.target.value)}>
                  {TIPO_COMPROBANTE.map(t => <option key={t.cod} value={t.cod}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Sustento Tributario [F2]</label>
                <select style={S.input} value={sustento} onChange={e => setSustento(e.target.value)}>
                  {SUSTENTO.map(s => <option key={s.cod} value={s.cod}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* TOTALES DESGLOSADOS */}
          <div style={{ ...S.panel, flex: 2 }}>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>Valores Gravados (15%, 5%)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.85rem' }}>Subtotal</span>
                  <input style={{ ...S.inputReadonly, width: '80px', textAlign: 'right', padding: '0.2rem' }} readOnly value={totals.subGravado.toFixed(2)} />
                </div>
                
                <div style={{ ...S.label, marginTop: '1rem' }}>Otros Valores</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>(+) No Obj IVA</span>
                  <input style={{ ...S.input, width: '80px', textAlign: 'right', padding: '0.2rem' }} type="number" step="0.01" value={amountNoIva || ''} onChange={e => setAmountNoIva(parseFloat(e.target.value) || 0)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>(+) Exento IVA</span>
                  <input style={{ ...S.input, width: '80px', textAlign: 'right', padding: '0.2rem' }} type="number" step="0.01" value={amountExentoIva || ''} onChange={e => setAmountExentoIva(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={S.label}>Valores Tarifa 0%</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.85rem' }}>Subtotal</span>
                  <input style={{ ...S.inputReadonly, width: '80px', textAlign: 'right', padding: '0.2rem' }} readOnly value={totals.subTarifa0.toFixed(2)} />
                </div>

                <div style={{ ...S.label, marginTop: '1rem' }}>Impuestos Generados</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.85rem' }}>(+) I.V.A.</span>
                  <input style={{ ...S.inputReadonly, width: '80px', textAlign: 'right', padding: '0.2rem' }} readOnly value={totals.iva.toFixed(2)} />
                </div>

                <div style={{ ...S.label, marginTop: '1rem', color: '#166534', fontSize: '0.9rem' }}>TOTAL A PAGAR</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>$</span>
                  <input style={{ ...S.inputReadonly, width: '100px', textAlign: 'right', padding: '0.3rem', fontSize: '1rem', fontWeight: 700, color: '#166534', background: '#dcfce7', borderColor: '#bbf7d0' }} readOnly value={totals.total.toFixed(2)} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      {showSelectPartnerModal && (
        <SelectPartnerModal
          companyId={activeCompanyId}
          partners={partners}
          onSelect={(id, p) => {
            if (p && !partners.find(x => x.id === id)) {
              setPartners(prev => [...prev, p]);
            }
            setPartnerId(id);
            setShowSelectPartnerModal(false);
          }}
          onCancel={() => setShowSelectPartnerModal(false)}
          onCreateNew={() => {
            setShowSelectPartnerModal(false);
            setShowPartnerModal(true);
          }}
        />
      )}

      {showPartnerModal && (
        <QuickCreatePartnerModal
          companyId={activeCompanyId}
          defaultIsCustomer={false}
          defaultIsSupplier={true}
          onSaved={async (newId) => {
            setShowPartnerModal(false);
            const ps = await getPartners(activeCompanyId);
            setPartners(ps || []);
            setPartnerId(newId);
          }}
          onCancel={() => setShowPartnerModal(false)}
        />
      )}

      {showProductModalForLine !== null && (
        <QuickCreateProductModal
          onSaved={async (newId) => {
            const lineIndex = showProductModalForLine;
            setShowProductModalForLine(null);
            await loadData();
            updLine(lineIndex, 'product_id', newId);
          }}
          onCancel={() => setShowProductModalForLine(null)}
        />
      )}

      {showSelectProductModalForLine !== null && (
        <SelectProductModal
          products={products}
          onSelect={(id, p) => {
            if (p && !products.find((x: any) => x.id === id)) {
              setProducts((prev: any) => [...prev, p]);
            }
            const lineIndex = showSelectProductModalForLine;
            updLine(lineIndex, 'product_id', id);
            
            if (p?.list_price) {
              updLine(lineIndex, 'price_unit', p.list_price);
            } else {
               const exist = products.find((x: any) => x.id === id);
               if (exist?.list_price) updLine(lineIndex, 'price_unit', exist.list_price);
            }
            
            setShowSelectProductModalForLine(null);
          }}
          onCancel={() => setShowSelectProductModalForLine(null)}
          onCreateNew={() => {
            const idx = showSelectProductModalForLine;
            setShowSelectProductModalForLine(null);
            setShowProductModalForLine(idx);
          }}
        />
      )}
    </div>
  );
}
