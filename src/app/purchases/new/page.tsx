'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanies, getPartners, createPartner } from '@/lib/supabase';
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
  const [activeCompany, setActiveCompany] = useState<any>(null);

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
    
    const activeComp = comps.find((c: any) => c.id === compId) || comps[0];
    setActiveCompany(activeComp);

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

  async function parseAndLoadSingleXML(text: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    // 1. Validar que tenga estructura tributaria
    const info = doc.querySelector('infoTributaria');
    if (!info) throw new Error('No se encontró infoTributaria en el XML.');

    // 2. Validar que sea un comprobante de tipo Factura (codDoc = '01')
    const codDoc = info.querySelector('codDoc')?.textContent?.trim();
    if (codDoc !== '01') {
      throw new Error('El comprobante cargado no es una Factura Electrónica (codDoc debe ser 01).');
    }

    // 3. Validar que esté dirigida a la empresa activa (RUC del comprador)
    const buyerVat = doc.querySelector('infoFactura > identificacionComprador')?.textContent?.trim();
    const companyVat = activeCompany?.vat?.trim();
    if (!buyerVat) {
      throw new Error('No se encontró la identificación del comprador en el XML.');
    }
    if (buyerVat !== companyVat) {
      throw new Error(`Esta factura está emitida al RUC de comprador ${buyerVat}, el cual no coincide con el RUC de la empresa activa (${companyVat || 'sin configurar'}).`);
    }

    // 4. Obtener datos del Proveedor y crearlo si no existe
    const supplierName = info.querySelector('razonSocial')?.textContent?.trim() || doc.querySelector('infoFactura > razonSocialProveedor')?.textContent?.trim() || 'Proveedor Importado';
    const supplierVat = info.querySelector('ruc')?.textContent?.trim();
    if (!supplierVat) {
      throw new Error('No se encontró el RUC del proveedor en el XML.');
    }

    const foundPartner = partners.find(x => x.vat?.trim() === supplierVat);
    if (foundPartner) {
      setPartnerId(foundPartner.id);
    } else {
      const confirmCreate = window.confirm(`El proveedor "${supplierName}" con RUC ${supplierVat} no está registrado. ¿Deseas crearlo automáticamente?`);
      if (!confirmCreate) return;

      try {
        const newP = await createPartner({
          company_id: activeCompanyId,
          name: supplierName,
          vat: supplierVat,
          is_supplier: true,
          is_customer: false,
          active: true
        });
        if (newP) {
          setPartners(prev => [...prev, newP]);
          setPartnerId(newP.id);
        }
      } catch (err: any) {
        throw new Error('Error al registrar proveedor: ' + err.message);
      }
    }

    // 5. Cargar datos del documento
    const estab = info.querySelector('estab')?.textContent?.trim() || '001';
    const ptoEmi = info.querySelector('ptoEmi')?.textContent?.trim() || '001';
    const sec = info.querySelector('secuencial')?.textContent?.trim() || '';
    const accessKey = info.querySelector('claveAcceso')?.textContent?.trim() || '';
    setInvoiceSerie(`${estab}-${ptoEmi}`);
    setInvoiceNum(sec);
    setInvoiceAuth(accessKey);

    const dateStr = doc.querySelector('infoFactura > fechaEmision')?.textContent?.trim();
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        setInvoiceDate(formattedDate);
        setDateOrder(formattedDate);
        setDueDate(formattedDate);
      }
    }

    // 6. Cargar subtotales adicionales (no objeto, exento)
    let noIva = 0;
    let exento = 0;
    const totalsList = doc.querySelectorAll('infoFactura > totalConImpuestos > totalImpuesto');
    totalsList.forEach(tot => {
      const cod = tot.querySelector('codigo')?.textContent;
      const pctCod = tot.querySelector('codigoPorcentaje')?.textContent;
      const base = parseFloat(tot.querySelector('baseImponible')?.textContent || '0');
      if (cod === '2') {
        // IVA - cubierto por líneas
      } else {
        if (pctCod === '6') noIva += base;
        if (pctCod === '7') exento += base;
      }
    });
    setAmountNoIva(noIva);
    setAmountExentoIva(exento);

    // 7. Cargar líneas de detalles
    const extractedLines: PurchaseLine[] = [];
    const details = doc.querySelectorAll('detalles > detalle');
    details.forEach(det => {
      const desc = det.querySelector('descripcion')?.textContent?.trim() || 'Detalle Factura';
      const qty = parseFloat(det.querySelector('cantidad')?.textContent || '1');
      const price = parseFloat(det.querySelector('precioUnitario')?.textContent || '0');
      const descAmt = parseFloat(det.querySelector('descuento')?.textContent || '0');
      
      const subtotal = qty * price;
      const discPct = subtotal > 0 ? (descAmt / subtotal) * 100 : 0;
      
      let iva_rate = 15;
      const imp = det.querySelector('impuestos > impuesto');
      if (imp) {
        const cod = imp.querySelector('codigo')?.textContent;
        const pctCod = imp.querySelector('codigoPorcentaje')?.textContent;
        if (cod === '2') {
          if (pctCod === '0') iva_rate = 0;
          else if (pctCod === '5') iva_rate = 5;
          else if (pctCod === '2') iva_rate = 12;
          else if (pctCod === '4') iva_rate = 15;
        }
      }
      
      extractedLines.push({
        product_id: null,
        description: desc,
        quantity: qty,
        price_unit: price,
        discount: Math.round(discPct * 100) / 100,
        iva_rate,
        location_id: null
      });
    });

    if (extractedLines.length > 0) {
      setLines(extractedLines);
    }
  }

  const handleUploadXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Si es un solo archivo, lo cargamos en el formulario para edición
    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const text = evt.target?.result as string;
          await parseAndLoadSingleXML(text);
          alert('Factura cargada correctamente en el formulario.');
        } catch (err: any) {
          alert('Error leyendo XML: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // Si son múltiples archivos, procesamos en lote directamente a la base de datos
    setSaving(true);
    let successCount = 0;
    let errorCount = 0;
    let newPartnersCount = 0;
    const errors: string[] = [];

    // Copia local de partners para buscar y registrar en lote
    let localPartners = [...partners];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');

        // 1. Validar estructura
        const info = doc.querySelector('infoTributaria');
        if (!info) throw new Error('No se encontró infoTributaria.');

        // 2. Validar que sea Factura
        const codDoc = info.querySelector('codDoc')?.textContent?.trim();
        if (codDoc !== '01') {
          throw new Error('No es una Factura Electrónica (codDoc debe ser 01).');
        }

        // 3. Validar RUC del comprador
        const buyerVat = doc.querySelector('infoFactura > identificacionComprador')?.textContent?.trim();
        const companyVat = activeCompany?.vat?.trim();
        if (!buyerVat) throw new Error('No se encontró la identificación del comprador.');
        if (buyerVat !== companyVat) {
          throw new Error(`El RUC del comprador (${buyerVat}) no coincide con la empresa activa (${companyVat || 'sin configurar'}).`);
        }

        // 4. Proveedor
        const supplierName = info.querySelector('razonSocial')?.textContent?.trim() || doc.querySelector('infoFactura > razonSocialProveedor')?.textContent?.trim() || 'Proveedor Importado';
        const supplierVat = info.querySelector('ruc')?.textContent?.trim();
        if (!supplierVat) throw new Error('No se encontró el RUC del proveedor.');

        let targetPartnerId = 0;
        const foundPartner = localPartners.find(x => x.vat?.trim() === supplierVat);
        if (foundPartner) {
          targetPartnerId = foundPartner.id;
        } else {
          // Crear proveedor automáticamente en lote sin confirmación individual para agilizar
          try {
            const newP = await createPartner({
              company_id: activeCompanyId,
              name: supplierName,
              vat: supplierVat,
              is_supplier: true,
              is_customer: false,
              active: true
            });
            if (newP) {
              localPartners.push(newP);
              targetPartnerId = newP.id;
              newPartnersCount++;
            }
          } catch (err: any) {
            throw new Error('Error al registrar proveedor: ' + err.message);
          }
        }

        // 5. Cargar datos del documento
        const estab = info.querySelector('estab')?.textContent?.trim() || '001';
        const ptoEmi = info.querySelector('ptoEmi')?.textContent?.trim() || '001';
        const sec = info.querySelector('secuencial')?.textContent?.trim() || '';
        const accessKey = info.querySelector('claveAcceso')?.textContent?.trim() || '';
        const fullInvoiceRef = `${estab}-${ptoEmi}-${sec.padStart(9, '0')}`;

        let docDate = new Date().toISOString().slice(0, 10);
        const dateStr = doc.querySelector('infoFactura > fechaEmision')?.textContent?.trim();
        if (dateStr) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            docDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        // 6. Subtotales
        let noIva = 0;
        let exento = 0;
        const totalsList = doc.querySelectorAll('infoFactura > totalConImpuestos > totalImpuesto');
        totalsList.forEach(tot => {
          const cod = tot.querySelector('codigo')?.textContent;
          const pctCod = tot.querySelector('codigoPorcentaje')?.textContent;
          const base = parseFloat(tot.querySelector('baseImponible')?.textContent || '0');
          if (cod === '2') {
            // IVA
          } else {
            if (pctCod === '6') noIva += base;
            if (pctCod === '7') exento += base;
          }
        });

        // 7. Detalles
        const extractedLines: PurchaseLine[] = [];
        const details = doc.querySelectorAll('detalles > detalle');
        details.forEach(det => {
          const desc = det.querySelector('descripcion')?.textContent?.trim() || 'Detalle Factura';
          const qty = parseFloat(det.querySelector('cantidad')?.textContent || '1');
          const price = parseFloat(det.querySelector('precioUnitario')?.textContent || '0');
          const descAmt = parseFloat(det.querySelector('descuento')?.textContent || '0');
          
          const subtotal = qty * price;
          const discPct = subtotal > 0 ? (descAmt / subtotal) * 100 : 0;
          
          let iva_rate = 15;
          const imp = det.querySelector('impuestos > impuesto');
          if (imp) {
            const cod = imp.querySelector('codigo')?.textContent;
            const pctCod = imp.querySelector('codigoPorcentaje')?.textContent;
            if (cod === '2') {
              if (pctCod === '0') iva_rate = 0;
              else if (pctCod === '5') iva_rate = 5;
              else if (pctCod === '2') iva_rate = 12;
              else if (pctCod === '4') iva_rate = 15;
            }
          }
          
          extractedLines.push({
            product_id: null,
            description: desc,
            quantity: qty,
            price_unit: price,
            discount: Math.round(discPct * 100) / 100,
            iva_rate,
            location_id: null
          });
        });

        const validLines = extractedLines.filter(l => l.quantity > 0 && l.price_unit > 0);
        if (validLines.length === 0) throw new Error('No contiene líneas de detalle válidas.');

        // Guardar la compra
        await createPurchase({
          company_id: activeCompanyId,
          partner_id: targetPartnerId,
          date_order: docDate,
          due_date: docDate,
          invoice_ref: fullInvoiceRef,
          invoice_auth: accessKey,
          invoice_date: docDate,
          tipo_comprobante: '01',
          sustento_tributario: '01',
          amount_no_iva: noIva,
          amount_exento_iva: exento,
          lines: validLines,
        });

        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push(`"${file.name}": ${err.message}`);
      }
    }

    setSaving(false);
    setPartners(localPartners); // Actualizar listado local de proveedores

    let summary = `Importación en lote finalizada:\n`;
    summary += `- Facturas cargadas exitosamente: ${successCount}\n`;
    summary += `- Proveedores creados: ${newPartnersCount}\n`;
    summary += `- Facturas con error: ${errorCount}\n`;

    if (errors.length > 0) {
      summary += `\nDetalle de errores:\n` + errors.slice(0, 10).join('\n');
      if (errors.length > 10) summary += `\n... y ${errors.length - 10} errores más.`;
    }

    alert(summary);

    if (successCount > 0) {
      router.push('/purchases');
    }
    e.target.value = '';
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>Factura Compra</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ ...S.btnOutline, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: 0, cursor: 'pointer', backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
            📄 Cargar XML(s)
            <input type="file" accept=".xml" multiple style={{ display: 'none' }} onChange={handleUploadXML} />
          </label>
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
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={S.label}>Tipo Comprobante [F2]</label>
                <select style={S.input} value={tipoComprobante} onChange={e => setTipoComprobante(e.target.value)}>
                  {TIPO_COMPROBANTE.map(t => <option key={t.cod} value={t.cod}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={S.label}>Sustento Tributario [F2]</label>
                <select style={S.input} value={sustento} onChange={e => setSustento(e.target.value)}>
                  {SUSTENTO.map(s => <option key={s.cod} value={s.cod}>{s.label}</option>)}
                </select>
              </div>
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
              {lines.map((l, i) => {
                const prod = products.find((p: any) => p.id === l.product_id);
                const isService = prod?.type === 'service';
                return (
                  <tr key={i}>
                    <td style={S.td}>
                      <select 
                        disabled={isService} 
                        style={{ ...S.input, backgroundColor: isService ? '#f1f5f9' : '#fff', color: isService ? '#94a3b8' : '#000' }} 
                        value={isService ? '' : (l.location_id || '')} 
                        onChange={e => updLine(i, 'location_id', e.target.value ? Number(e.target.value) : null)}
                      >
                        {isService ? (
                          <option value="">N/A (Servicio)</option>
                        ) : (
                          <>
                            <option value="">— Defecto —</option>
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                          </>
                        )}
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
              );
            })}
            </tbody>
          </table>
          <div style={{ marginTop: '0.5rem' }}>
            <button style={S.btnSm} onClick={() => setLines(ls => [...ls, { product_id: null, description: '', quantity: 1, price_unit: 0, discount: 0, iva_rate: 15, location_id: null }])}>
              + Línea
            </button>
          </div>
        </div>

        {/* BLOQUE INFERIOR: TOTALES */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          
          {/* TOTALES DESGLOSADOS */}
          <div style={{ ...S.panel, width: '100%', maxWidth: '600px' }}>
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
          filterType="supplier"
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
            
            const selectedProduct = p || products.find((x: any) => x.id === id);
            if (selectedProduct?.type === 'service') {
              updLine(lineIndex, 'location_id', null);
            }
            
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
