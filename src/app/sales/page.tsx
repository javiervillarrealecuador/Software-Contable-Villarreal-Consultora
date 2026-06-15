// src/app/sales/page.tsx
// CAPA 4 v3: Ventas -- formulario unico (cabecera + grilla + pie tributario)
// v3: forma_pago SRI, auto-secuencial, list_price auto-fill
'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getSaleOrders, getSaleOrder, createSale, updateSale, deliverSale, cancelSale,
  calcTotals, PAYMENT_TERMS, TAX_LINE_TYPES, FORMAS_PAGO_SRI,
  type SaleLine, type TaxLineType, type PaymentTerm, type FormaPagoSRI,
} from '@/lib/sales';
import { getProducts, getLocations } from '@/lib/inventory';
import { generateFacturaForSale, downloadFacturaXml, sendSaleToSri } from '@/lib/sri-factura-db';
import { emitNotaCreditoForSale, emitNotaDebitoForSale, emitGuiaRemisionForSale, downloadXmlFile } from '@/lib/sri-docs-db';
import QuickCreatePartnerModal from '@/components/modals/QuickCreatePartnerModal';
import QuickCreateProductModal from '@/components/modals/QuickCreateProductModal';

const RidePdfButton = dynamic(() => import('@/components/RidePdfButton'), { ssr: false });

// Estilos
const C = {
  page: { width: '100%' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' },
  main: { display: 'grid', gridTemplateColumns: '1fr 160px', gap: '0', minHeight: 'calc(100vh - 44px)' } as React.CSSProperties,
  form: { padding: '0.75rem 1rem', overflowY: 'auto' as const } as React.CSSProperties,
  sidebar: { background: '#e8edf2', borderLeft: '1px solid #cbd5e1', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' },
  fieldGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem 0.75rem', marginBottom: '0.75rem', background: 'white', border: '1px solid #d1d9e0', borderRadius: '6px', padding: '0.6rem 0.75rem' },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' },
  input: { padding: '4px 6px', border: '1px solid #c2cad4', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const, background: '#fafbfc' },
  inputRO: { padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const, background: '#f1f5f9', color: '#64748b' },
  select: { padding: '4px 6px', border: '1px solid #c2cad4', borderRadius: '3px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const, background: '#fafbfc' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
  th: { padding: '5px 6px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, color: '#475569', background: '#e8edf2', borderBottom: '2px solid #94a3b8', whiteSpace: 'nowrap' as const },
  thR: { padding: '5px 6px', textAlign: 'right' as const, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, color: '#475569', background: '#e8edf2', borderBottom: '2px solid #94a3b8', whiteSpace: 'nowrap' as const },
  td: { padding: '3px 5px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' as const },
  tdR: { padding: '3px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' as const, fontFamily: 'monospace', verticalAlign: 'middle' as const },
  tdInput: { padding: '2px', border: '1px solid #d1d9e0', borderRadius: '2px', fontSize: '12px', width: '100%', textAlign: 'right' as const, boxSizing: 'border-box' as const },
  btnSide: { padding: '6px 8px', border: '1px solid #94a3b8', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' as const, width: '100%' } as React.CSSProperties,
  btnPrimary: { padding: '6px 8px', border: 'none', borderRadius: '4px', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textAlign: 'center' as const, width: '100%' } as React.CSSProperties,
  btnDanger: { padding: '6px 8px', border: 'none', borderRadius: '4px', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textAlign: 'center' as const, width: '100%' } as React.CSSProperties,
  btnGreen: { padding: '6px 8px', border: 'none', borderRadius: '4px', background: '#16a34a', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textAlign: 'center' as const, width: '100%' } as React.CSSProperties,
  btnSmall: { padding: '3px 7px', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 },
  footer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' },
  totBox: { background: '#f8fafc', border: '1px solid #d1d9e0', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '12px' },
  totRow: { display: 'flex', justifyContent: 'space-between', padding: '2px 0' },
  totLabel: { color: '#475569', fontWeight: 600 },
  totValue: { fontFamily: 'monospace', fontWeight: 600 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);

const emptyLine = (): SaleLine => ({
  product_id: 0, quantity: 1, price_unit: 0, iva_rate: 15,
  tax_type: 'gravado', discount_percent: 0, ice_amount: 0,
});

type ViewMode = 'list' | 'form';

export default function SalesPage() {
  const [mode, setMode] = useState<ViewMode>('list');
  const [orders, setOrders] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingSri, setSendingSri] = useState(0);
  const [emailingSale, setEmailingSale] = useState(0);

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  // Form fields - cabecera
  const [docName, setDocName] = useState('NUEVO');
  const [docState, setDocState] = useState<string>('draft');
  const [partnerId, setPartnerId] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceAuth, setInvoiceAuth] = useState('');
  const [sellerId, setSellerId] = useState(0);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('contado');
  const [formaPago, setFormaPago] = useState<FormaPagoSRI>('01');
  const [warehouseId, setWarehouseId] = useState(0);
  const [observation, setObservation] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);

  // Modal states
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showProductModalForLine, setShowProductModalForLine] = useState<number | null>(null);

  const isEditable = docState === 'draft' || !currentId;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [ps, prods, locs, ords] = await Promise.all([
        supabase.from('res_partner').select('id, name, vat, phone, street, city, taxpayer_type').eq('company_id', 1).eq('active', true).order('name'),
        getProducts(),
        getLocations(),
        getSaleOrders(1),
      ]);
      setPartners(ps.data || []);
      setProducts(prods || []);
      setLocations(locs || []);
      setOrders(ords || []);
      setSellers(ps.data || []);
    } catch (e) { console.error('load error:', e); }
  }

  const selectedPartner = useMemo(() => partners.find(p => p.id === partnerId), [partners, partnerId]);
  const totals = useMemo(() => calcTotals(lines), [lines]);
  const dueDate = useMemo(() => {
    const entry = PAYMENT_TERMS.find(t => t.value === paymentTerm);
    if (!entry || entry.days === 0) return null;
    const d = new Date(date);
    d.setDate(d.getDate() + entry.days);
    return d.toISOString().slice(0, 10);
  }, [date, paymentTerm]);

  function updLine(i: number, field: keyof SaleLine, value: any) {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      if (field === 'tax_type') {
        if (value !== 'gravado') updated.iva_rate = 0;
        else if (updated.iva_rate === 0) updated.iva_rate = 15;
      }
      if (field === 'product_id' && value > 0) {
        const prod = products.find((p: any) => p.id === value);
        if (prod && updated.price_unit === 0) {
          // Usar list_price (PVP) si existe, sino standard_price (costo)
          updated.price_unit = prod.list_price || prod.standard_price || 0;
        }
      }
      return updated;
    }));
  }

  function handleNew() {
    setCurrentId(null);
    setCurrentOrder(null);
    setDocName('NUEVO');
    setDocState('draft');
    setPartnerId(0);
    setDate(new Date().toISOString().slice(0, 10));
    setInvoiceRef('');
    setInvoiceAuth('');
    setSellerId(0);
    setPaymentTerm('contado');
    setFormaPago('01');
    setWarehouseId(0);
    setObservation('');
    setReference('');
    setLines([emptyLine()]);
    setMode('form');
  }

  async function handleOpen(id: number) {
    try {
      const o = await getSaleOrder(id);
      if (!o) return;
      setCurrentId(o.id);
      setCurrentOrder(o);
      setDocName(o.name);
      setDocState(o.state);
      setPartnerId(o.partner_id);
      setDate(o.date_order);
      setInvoiceRef(o.invoice_ref || '');
      setInvoiceAuth(o.invoice_auth || '');
      setSellerId(o.seller_id || 0);
      setPaymentTerm((o.payment_term || 'contado') as PaymentTerm);
      setFormaPago(((o as any).forma_pago || '01') as FormaPagoSRI);
      setWarehouseId(o.warehouse_id || 0);
      setObservation(o.observation || '');
      setReference(o.reference || '');
      const mappedLines: SaleLine[] = (o.lines || []).map((l: any) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        price_unit: Number(l.price_unit),
        iva_rate: Number(l.iva_rate),
        tax_type: (l.tax_type || 'gravado') as TaxLineType,
        discount_percent: Number(l.discount_percent || 0),
        ice_amount: Number(l.ice_amount || 0),
        location_id: l.location_id || undefined,
        description: l.description || undefined,
      }));
      setLines(mappedLines.length > 0 ? mappedLines : [emptyLine()]);
      setMode('form');
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  async function handleSave() {
    if (!partnerId || saving) return;
    const validLines = lines.filter(l => l.product_id > 0 && l.quantity > 0);
    if (validLines.length === 0) { alert('Agrega al menos una linea con producto y cantidad.'); return; }
    try {
      setSaving(true);
      const input = {
        company_id: 1, partner_id: partnerId, date_order: date,
        invoice_ref: invoiceRef || undefined, invoice_auth: invoiceAuth || undefined,
        seller_id: sellerId || undefined, payment_term: paymentTerm,
        forma_pago: formaPago,
        warehouse_id: warehouseId || undefined,
        observation: observation || undefined, reference: reference || undefined,
        lines: validLines,
      };
      if (currentId) {
        await updateSale(currentId, input);
      } else {
        const order = await createSale(input);
        setCurrentId(order.id);
        setDocName(order.name);
        // El secuencial se auto-genero, actualizar el campo visible
        if (order.invoice_ref) setInvoiceRef(order.invoice_ref);
      }
      setDocState('draft');
      await loadAll();
      if (currentId) await handleOpen(currentId);
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSaving(false); }
  }

  async function handleDeliver() {
    if (!currentId) return;
    if (!confirm('Entregar esta venta descargara el inventario a costo promedio. Continuar?')) return;
    try { await deliverSale(currentId); await loadAll(); await handleOpen(currentId); }
    catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  async function handleCancel() {
    if (!currentId) return;
    if (!confirm('Anular esta venta en borrador?')) return;
    try { await cancelSale(currentId); await loadAll(); await handleOpen(currentId); }
    catch (e: any) { alert('Error: ' + (e.message || '')); }
  }

  async function handleFacturaXml() {
    if (!currentId) return;
    try {
      const result = await generateFacturaForSale(currentId);
      try {
        const res = await fetch('/api/sri/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ xml: result.xml }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error firmando');
        downloadFacturaXml({ ...result, xml: json.signedXml });
      } catch (signErr: any) {
        alert('No se pudo firmar (' + (signErr.message || '') + '). Se descarga SIN FIRMA.');
        downloadFacturaXml(result);
      }
      loadAll();
    } catch (e: any) { alert('Error generando XML: ' + (e.message || '')); }
  }

  async function handleEnviarSri() {
    if (!currentId) return;
    if (!confirm('Enviar este comprobante al SRI?')) return;
    try {
      setSendingSri(currentId);
      const r = await sendSaleToSri(currentId);
      const ambTxt = r.ambiente === 2 ? 'PRODUCCION' : 'PRUEBAS';
      alert('SRI [' + ambTxt + '] -> ' + r.estado +
        (r.numeroAutorizacion ? '\nAutorizacion: ' + r.numeroAutorizacion : '') +
        (r.mensajes?.length ? '\n\n' + r.mensajes.join('\n') : ''));
      await loadAll();
      await handleOpen(currentId);
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setSendingSri(0); }
  }

  async function handleNotaCredito() {
    if (!currentId) return;
    const motivo = prompt('Motivo de la nota de credito:', 'DEVOLUCION DE MERCADERIA');
    if (!motivo) return;
    try {
      const r = await emitNotaCreditoForSale(currentId, motivo);
      if (r.signedXml) downloadXmlFile(r.signedXml, 'NC_' + r.numero + '_' + r.claveAcceso.slice(0, 8) + '.xml');
      alert('NC -> SRI [' + (r.ambiente === 2 ? 'PRODUCCION' : 'PRUEBAS') + '] -> ' + r.estado +
        (r.numeroAutorizacion ? '\nAutorizacion: ' + r.numeroAutorizacion : '') +
        (r.mensajes?.length ? '\n\n' + r.mensajes.join('\n') : ''));
    } catch (e: any) { alert('Error NC: ' + (e.message || '')); }
  }

  async function handleNotaDebito() {
    if (!currentId) return;
    const razon = prompt('Motivo del recargo:', 'INTERES POR MORA');
    if (!razon) return;
    const valorStr = prompt('Valor del recargo SIN IVA:', '5.00');
    const valor = parseFloat(valorStr || '0');
    if (!valor || valor <= 0) return;
    try {
      const r = await emitNotaDebitoForSale(currentId, razon, valor);
      if (r.signedXml) downloadXmlFile(r.signedXml, 'ND_' + r.numero + '_' + r.claveAcceso.slice(0, 8) + '.xml');
      alert('ND -> SRI [' + (r.ambiente === 2 ? 'PRODUCCION' : 'PRUEBAS') + '] -> ' + r.estado +
        (r.numeroAutorizacion ? '\nAutorizacion: ' + r.numeroAutorizacion : '') +
        (r.mensajes?.length ? '\n\n' + r.mensajes.join('\n') : ''));
    } catch (e: any) { alert('Error ND: ' + (e.message || '')); }
  }

  async function handleGuiaRemision() {
    if (!currentId) return;
    const razonT = prompt('Razon social del transportista:', 'TRANSPORTES TULCAN');
    if (!razonT) return;
    const idT = prompt('RUC/cedula del transportista:', '');
    if (!idT) return;
    const placa = prompt('Placa del vehiculo:', 'ABC1234');
    if (!placa) return;
    const dir = prompt('Direccion del destinatario:', 'Tulcan') || 'S/D';
    try {
      const r = await emitGuiaRemisionForSale(currentId, { identificacion: idT, razonSocial: razonT, placa }, dir);
      if (r.signedXml) downloadXmlFile(r.signedXml, 'GR_' + r.numero + '_' + r.claveAcceso.slice(0, 8) + '.xml');
      alert('GR -> SRI [' + (r.ambiente === 2 ? 'PRODUCCION' : 'PRUEBAS') + '] -> ' + r.estado +
        (r.numeroAutorizacion ? '\nAutorizacion: ' + r.numeroAutorizacion : '') +
        (r.mensajes?.length ? '\n\n' + r.mensajes.join('\n') : ''));
    } catch (e: any) { alert('Error GR: ' + (e.message || '')); }
  }

  async function handleEmailComprobante() {
    if (!currentId) return;
    const emailTo = prompt('Correo del destinatario (vacio = cliente):', '');
    if (emailTo === null) return;
    try {
      setEmailingSale(currentId);
      const res = await fetch('/api/sri/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saleId: currentId, emailTo: emailTo || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error enviando correo');
      alert('Correo enviado a: ' + json.sentTo);
    } catch (e: any) { alert('Error: ' + (e.message || '')); }
    finally { setEmailingSale(0); }
  }

  const badge = (state: string) => {
    const m: any = { draft: ['#fef9c3', '#854d0e', 'Borrador'], delivered: ['#dcfce7', '#166534', 'Entregada'], cancel: ['#fee2e2', '#991b1b', 'Anulada'] };
    const s = m[state] || m.draft;
    return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '1rem', background: s[0], color: s[1], fontWeight: 700 }}>{s[2]}</span>;
  };

  const sriBadge = (o: any) => {
    if (!o.sri_estado) return null;
    const bg = o.sri_estado === 'AUTORIZADO' ? '#dcfce7' : o.sri_estado === 'RECIBIDA' || o.sri_estado === 'EN PROCESO' ? '#fef9c3' : '#fee2e2';
    const clr = o.sri_estado === 'AUTORIZADO' ? '#166534' : o.sri_estado === 'RECIBIDA' || o.sri_estado === 'EN PROCESO' ? '#854d0e' : '#991b1b';
    return <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '1rem', fontWeight: 700, background: bg, color: clr, marginLeft: '4px' }}>SRI{o.sri_ambiente === 1 ? ' P' : ''}: {o.sri_estado}</span>;
  };

  const getProductCode = (id: number) => products.find((p: any) => p.id === id)?.code || '';
  const getProductName = (id: number) => products.find((p: any) => p.id === id)?.name || '';
  const getProductUom = (_id: number) => {
    const p = products.find((pr: any) => pr.id === _id);
    return p?.uom_id || '';
  };

  // === LIST MODE ===
  if (mode === 'list') {
    return (
      <div className="w-full">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Ventas</h1>
            <p className="text-slate-500 mt-2 flex items-center gap-2">
              Gestión de facturas y notas
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold border border-blue-200">Factura Electrónica</span>
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <button className="btn btn-primary shadow-lg shadow-blue-500/30" onClick={handleNew}>+ Nueva Venta</button>
          </div>
        </header>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
          <div style={{ background: 'white', border: '1px solid #d1d9e0', borderRadius: '6px', overflow: 'hidden' }}>
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No hay ventas registradas.</p>
            ) : (
              <table style={C.table}>
                <thead>
                  <tr>
                    <th style={C.th}>Numero</th><th style={C.th}>Fecha</th><th style={C.th}>Cliente</th>
                    <th style={C.th}>Factura</th><th style={C.th}>Tipo Pago</th><th style={C.th}>Forma Pago</th>
                    <th style={C.thR}>Subtotal</th><th style={C.thR}>IVA</th><th style={C.thR}>Total</th>
                    <th style={C.th}>Estado</th><th style={C.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => handleOpen(o.id)} onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...C.td, fontFamily: 'monospace', fontWeight: 700 }}>{o.name}</td>
                      <td style={C.td}>{o.date_order}</td>
                      <td style={C.td}>{o.partner?.name || '-'}</td>
                      <td style={{ ...C.td, fontFamily: 'monospace', fontSize: '11px' }}>{o.invoice_ref || '-'}</td>
                      <td style={C.td}>{PAYMENT_TERMS.find(t => t.value === o.payment_term)?.label || o.payment_term || 'Contado'}</td>
                      <td style={{ ...C.td, fontSize: '11px' }}>{FORMAS_PAGO_SRI.find(f => f.value === o.forma_pago)?.label || o.forma_pago || '-'}</td>
                      <td style={C.tdR}>${fmt(Number(o.amount_untaxed))}</td>
                      <td style={C.tdR}>${fmt(Number(o.amount_tax))}</td>
                      <td style={{ ...C.tdR, fontWeight: 700 }}>${fmt(Number(o.amount_total))}</td>
                      <td style={C.td}>{badge(o.state)}{sriBadge(o)}</td>
                      <td style={C.td}>
                        <button style={{ ...C.btnSmall, background: '#2563eb', color: 'white' }} onClick={(e) => { e.stopPropagation(); handleOpen(o.id); }}>Abrir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === FORM MODE ===
  const internalLocs = locations.filter((l: any) => l.usage === 'internal');

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-semibold mb-2 flex items-center gap-1" onClick={() => { setMode('list'); loadAll(); }}>
            ← Volver a la lista
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-800">
              {currentId ? `Factura ${docName}` : 'Nueva Factura'}
            </h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold border border-blue-200">Electrónica</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {badge(docState)}
          {currentOrder && sriBadge(currentOrder)}
        </div>
      </header>

      <div style={C.main}>
        <div style={C.form}>
          {/* Cabecera */}
          <div style={C.fieldGroup}>
            <div>
              <label style={C.label}>Numero</label>
              <input style={C.inputRO} value={docName} readOnly />
            </div>
            <div>
              <label style={C.label}>Fecha</label>
              <input style={isEditable ? C.input : C.inputRO} type="date" value={date} onChange={e => setDate(e.target.value)} readOnly={!isEditable} />
            </div>
            <div>
              <label style={C.label}>Moneda</label>
              <input style={C.inputRO} value="DOLARES AMERICANOS" readOnly />
            </div>
            <div>
              <label style={C.label}>Tipo Pago</label>
              <select style={isEditable ? C.select : C.inputRO} value={paymentTerm} onChange={e => setPaymentTerm(e.target.value as PaymentTerm)} disabled={!isEditable}>
                {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={C.label}>Forma Pago SRI</label>
              <select style={isEditable ? C.select : C.inputRO} value={formaPago} onChange={e => setFormaPago(e.target.value as FormaPagoSRI)} disabled={!isEditable}>
                {FORMAS_PAGO_SRI.map(f => <option key={f.value} value={f.value}>[{f.value}] {f.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={C.label}>Cliente *</label>
              <select style={isEditable ? C.select : C.inputRO} value={partnerId} onChange={e => {
                if (e.target.value === 'CREATE_NEW') setShowPartnerModal(true);
                else setPartnerId(Number(e.target.value));
              }} disabled={!isEditable}>
                <option value={0}>-- Seleccionar --</option>
                {isEditable && <option value="CREATE_NEW">+ Crear Nuevo Cliente...</option>}
                {partners.map(p => <option key={p.id} value={p.id}>{p.name} {p.vat ? '(' + p.vat + ')' : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={C.label}>Direccion</label>
              <input style={C.inputRO} value={selectedPartner?.street || ''} readOnly />
            </div>
            <div>
              <label style={C.label}>Telefono</label>
              <input style={C.inputRO} value={selectedPartner?.phone || ''} readOnly />
            </div>
            <div>
              <label style={C.label}>Ciudad / Zona</label>
              <input style={C.inputRO} value={selectedPartner?.city || ''} readOnly />
            </div>
            <div>
              <label style={C.label}>Vendedor</label>
              <select style={isEditable ? C.select : C.inputRO} value={sellerId} onChange={e => setSellerId(Number(e.target.value))} disabled={!isEditable}>
                <option value={0}>(NINGUNO)</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={C.label}>Plazo (dias)</label>
              <input style={C.inputRO} value={PAYMENT_TERMS.find(t => t.value === paymentTerm)?.days || 0} readOnly />
            </div>
            <div>
              <label style={C.label}>Vence en</label>
              <input style={C.inputRO} value={dueDate || date} readOnly />
            </div>
            <div>
              <label style={C.label}>Referencia</label>
              <input style={isEditable ? C.input : C.inputRO} value={reference} onChange={e => setReference(e.target.value)} readOnly={!isEditable} />
            </div>
            <div>
              <label style={C.label}>No. Factura (auto)</label>
              <input style={C.inputRO} value={invoiceRef || '(se genera al guardar)'} readOnly />
            </div>
            <div>
              <label style={C.label}>Clave Acceso SRI</label>
              <input style={C.inputRO} value={invoiceAuth} readOnly />
            </div>
            <div>
              <label style={C.label}>Bodega</label>
              <select style={isEditable ? C.select : C.inputRO} value={warehouseId} onChange={e => setWarehouseId(Number(e.target.value))} disabled={!isEditable}>
                <option value={0}>MATRIZ</option>
                {internalLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={C.label}>Observacion</label>
              <input style={isEditable ? C.input : C.inputRO} value={observation} onChange={e => setObservation(e.target.value)} readOnly={!isEditable} />
            </div>
          </div>

          {/* Grilla de lineas */}
          <div style={{ background: 'white', border: '1px solid #d1d9e0', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem' }}>
            <table style={C.table}>
              <thead>
                <tr>
                  <th style={{ ...C.th, width: 30 }}>ITEM</th>
                  <th style={{ ...C.th, width: 70 }}>Codigo</th>
                  <th style={C.th}>Descripcion</th>
                  <th style={{ ...C.th, width: 80 }}>Bodega</th>
                  <th style={{ ...C.th, width: 55 }}>U.Med.</th>
                  <th style={{ ...C.th, width: 70 }}>Tipo IVA</th>
                  <th style={{ ...C.thR, width: 65 }}>Cantidad</th>
                  <th style={{ ...C.thR, width: 75 }}>Precio</th>
                  <th style={{ ...C.thR, width: 50 }}>%Desc</th>
                  <th style={{ ...C.thR, width: 80 }}>Total PVP</th>
                  <th style={{ ...C.thR, width: 85 }}>PVP T+IVA</th>
                  {isEditable && <th style={{ ...C.th, width: 30 }}></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const sub = round2(l.quantity * l.price_unit * (1 - l.discount_percent / 100));
                  const iva = l.tax_type === 'gravado' ? round2(sub * l.iva_rate / 100) : 0;
                  const pvpTotal = round2(sub + iva + (l.ice_amount || 0));
                  const prodCode = getProductCode(l.product_id);
                  const prodUom = getProductUom(l.product_id);
                  return (
                    <tr key={i}>
                      <td style={{ ...C.td, textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                      <td style={{ ...C.td, fontFamily: 'monospace', fontSize: '11px' }}>{prodCode || '-'}</td>
                      <td style={C.td}>
                        {isEditable ? (
                          <select style={{ ...C.tdInput, textAlign: 'left' }} value={l.product_id} onChange={e => {
                            if (e.target.value === 'CREATE_NEW') setShowProductModalForLine(i);
                            else updLine(i, 'product_id', Number(e.target.value));
                          }}>
                            <option value={0}>-- Producto --</option>
                            <option value="CREATE_NEW">+ Crear Nuevo Producto...</option>
                            {products.map((p: any) => <option key={p.id} value={p.id}>{p.code ? '[' + p.code + '] ' : ''}{p.name}{p.list_price > 0 ? ' ($' + Number(p.list_price).toFixed(2) + ')' : ''}</option>)}
                          </select>
                        ) : (
                          <span>{getProductName(l.product_id) || '-'}</span>
                        )}
                      </td>
                      <td style={C.td}>
                        {isEditable ? (
                          <select style={{ ...C.tdInput, textAlign: 'left', fontSize: '11px' }} value={l.location_id || 0} onChange={e => updLine(i, 'location_id', Number(e.target.value) || undefined)}>
                            <option value={0}>--</option>
                            {internalLocs.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: '11px' }}>{internalLocs.find(loc => loc.id === l.location_id)?.name || '-'}</span>
                        )}
                      </td>
                      <td style={{ ...C.td, fontSize: '11px', color: '#64748b' }}>{prodUom || 'Und'}</td>
                      <td style={C.td}>
                        {isEditable ? (
                          <select style={{ ...C.tdInput, textAlign: 'left', fontSize: '11px' }} value={l.tax_type} onChange={e => updLine(i, 'tax_type', e.target.value)}>
                            {TAX_LINE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: '11px' }}>{TAX_LINE_TYPES.find(t => t.value === l.tax_type)?.label || l.tax_type}</span>
                        )}
                      </td>
                      <td style={C.tdR}>
                        {isEditable ? (
                          <input style={C.tdInput} type="number" step="0.01" min="0" value={l.quantity || ''} onChange={e => updLine(i, 'quantity', parseFloat(e.target.value) || 0)} />
                        ) : <span>{l.quantity}</span>}
                      </td>
                      <td style={C.tdR}>
                        {isEditable ? (
                          <input style={C.tdInput} type="number" step="0.000001" min="0" value={l.price_unit || ''} onChange={e => updLine(i, 'price_unit', parseFloat(e.target.value) || 0)} />
                        ) : <span>{fmt(l.price_unit)}</span>}
                      </td>
                      <td style={C.tdR}>
                        {isEditable ? (
                          <input style={C.tdInput} type="number" step="0.01" min="0" max="100" value={l.discount_percent || ''} onChange={e => updLine(i, 'discount_percent', parseFloat(e.target.value) || 0)} />
                        ) : <span>{l.discount_percent || 0}%</span>}
                      </td>
                      <td style={{ ...C.tdR, fontWeight: 600 }}>${fmt(sub)}</td>
                      <td style={{ ...C.tdR, fontWeight: 700, color: '#166534' }}>${fmt(pvpTotal)}</td>
                      {isEditable && (
                        <td style={C.td}>
                          {lines.length > 1 && <button style={{ ...C.btnSmall, background: '#dc2626', color: 'white' }} onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}>x</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isEditable && (
              <div style={{ padding: '4px 8px', borderTop: '1px solid #e2e8f0' }}>
                <button style={{ ...C.btnSmall, background: '#64748b', color: 'white' }} onClick={() => setLines(ls => [...ls, emptyLine()])}>+ Agregar linea</button>
              </div>
            )}
          </div>

          {/* Pie: Desglose tributario */}
          <div style={C.footer}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={C.totBox}>
                <div style={{ fontWeight: 700, fontSize: '11px', color: '#475569', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>Valores Gravados</div>
                <div style={C.totRow}><span style={C.totLabel}>Valor Parcial</span><span style={C.totValue}>{fmt(totals.amount_taxed)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>Descuento</span><span style={C.totValue}>{fmt(totals.amount_discount)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>Subtotal</span><span style={C.totValue}>{fmt(totals.amount_taxed)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>I.C.E.</span><span style={C.totValue}>{fmt(totals.amount_ice)}</span></div>
                <div style={{ ...C.totRow, borderTop: '1px solid #cbd5e1', paddingTop: '3px', marginTop: '2px' }}>
                  <span style={{ ...C.totLabel, color: '#1e40af' }}>I.V.A.</span>
                  <span style={{ ...C.totValue, color: '#1e40af' }}>{fmt(totals.amount_tax)}</span>
                </div>
              </div>
              <div style={C.totBox}>
                <div style={{ fontWeight: 700, fontSize: '11px', color: '#475569', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>Valores Tarifa 0%</div>
                <div style={C.totRow}><span style={C.totLabel}>Valor Parcial</span><span style={C.totValue}>{fmt(totals.amount_zero)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>Descuento</span><span style={C.totValue}>0.00</span></div>
                <div style={C.totRow}><span style={C.totLabel}>Subtotal</span><span style={C.totValue}>{fmt(totals.amount_zero)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>No Objeto IVA</span><span style={C.totValue}>{fmt(totals.amount_no_objeto)}</span></div>
                <div style={C.totRow}><span style={C.totLabel}>Exento IVA</span><span style={C.totValue}>{fmt(totals.amount_exento)}</span></div>
              </div>
            </div>
            <div style={{ ...C.totBox, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ ...C.totRow, fontSize: '13px' }}><span style={C.totLabel}>Subtotal sin IVA</span><span style={C.totValue}>{fmt(totals.amount_untaxed)}</span></div>
              <div style={C.totRow}><span style={C.totLabel}>Descuento Total</span><span style={C.totValue}>{fmt(totals.amount_discount)}</span></div>
              <div style={C.totRow}><span style={C.totLabel}>ICE</span><span style={C.totValue}>{fmt(totals.amount_ice)}</span></div>
              <div style={C.totRow}><span style={C.totLabel}>IVA</span><span style={C.totValue}>{fmt(totals.amount_tax)}</span></div>
              <div style={{ ...C.totRow, borderTop: '2px solid #1e40af', paddingTop: '5px', marginTop: '4px', fontSize: '15px' }}>
                <span style={{ ...C.totLabel, color: '#1e40af' }}>TOTAL</span>
                <span style={{ ...C.totValue, color: '#1e40af', fontSize: '16px' }}>${fmt(totals.amount_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar de acciones */}
        <div style={C.sidebar}>
          <button style={C.btnSide} onClick={() => { setMode('list'); loadAll(); }}>Cerrar</button>
          <button style={C.btnPrimary} onClick={handleNew}>Nuevo</button>
          <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '4px 0' }} />

          {isEditable && (
            <button style={C.btnGreen} disabled={!partnerId || saving} onClick={handleSave}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}

          {currentId && docState === 'draft' && (
            <>
              <button style={{ ...C.btnSide, color: '#16a34a', borderColor: '#16a34a' }} onClick={handleDeliver}>Entregar</button>
              <button style={{ ...C.btnSide, color: '#dc2626', borderColor: '#dc2626' }} onClick={handleCancel}>Anular</button>
            </>
          )}

          {currentId && docState !== 'cancel' && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '4px 0' }} />
              <button style={C.btnSide} onClick={handleFacturaXml}>Fac. Electronica</button>
              <RidePdfButton saleId={currentId} style={{ ...C.btnSide, display: 'block' }} />
              <button style={C.btnSide} onClick={handleEnviarSri} disabled={sendingSri === currentId}>
                {sendingSri === currentId ? 'Enviando...' : 'Enviar SRI'}
              </button>
              <button style={C.btnSide} onClick={handleEmailComprobante} disabled={emailingSale === currentId}>
                {emailingSale === currentId ? 'Enviando...' : 'Email'}
              </button>
            </>
          )}

          {currentId && currentOrder?.sri_estado === 'AUTORIZADO' && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '4px 0' }} />
              <button style={C.btnSide} onClick={handleNotaCredito}>Nota Credito</button>
              <button style={C.btnSide} onClick={handleNotaDebito}>Nota Debito</button>
              <button style={C.btnSide} onClick={handleGuiaRemision}>Guia Remision</button>
            </>
          )}

          {currentId && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '4px 0' }} />
              <Link href="/cxc" style={{ ...C.btnSide, textDecoration: 'none', display: 'block', textAlign: 'center' }}>Ver CxC</Link>
            </>
          )}

          <div style={{ flex: 1 }} />

          {currentId && currentOrder && (
            <div style={{ fontSize: '10px', color: '#64748b', borderTop: '1px solid #94a3b8', paddingTop: '6px' }}>
              {currentOrder.cost_total > 0 && (
                <div>Costo: ${fmt(Number(currentOrder.cost_total))}</div>
              )}
              {currentOrder.amount_paid > 0 && (
                <div>Pagado: ${fmt(Number(currentOrder.amount_paid))}</div>
              )}
              {currentOrder.sri_autorizacion && (
                <div style={{ wordBreak: 'break-all' }}>Auth: {currentOrder.sri_autorizacion}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPartnerModal && (
        <QuickCreatePartnerModal
          companyId={1}
          defaultIsCustomer={true}
          defaultIsSupplier={false}
          onSaved={async (newId) => {
            setShowPartnerModal(false);
            await loadAll();
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
            await loadAll();
            updLine(lineIndex, 'product_id', newId);
          }}
          onCancel={() => setShowProductModalForLine(null)}
        />
      )}
    </div>
  );
}
