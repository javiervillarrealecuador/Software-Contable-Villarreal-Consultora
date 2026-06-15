// src/lib/sri-ride.ts
// RIDE — Representación Impresa del Documento Electrónico (formato SRI).
// SOLO CLIENTE (usa canvas del navegador para el código de barras).
//
// Estructura estándar del RIDE:
//   Cabecera en dos columnas: izquierda el EMISOR (razón social, RUC,
//   direcciones, obligado a contabilidad), derecha el COMPROBANTE (tipo,
//   número, autorización, fecha, ambiente, clave de acceso con código de
//   barras Code-128).
//   Luego: datos del comprador/sujeto, detalle, totales y leyendas.

import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

// ── Datos comunes ─────────────────────────────────────────────────────────────

export interface RideEmisor {
  razonSocial: string;
  ruc: string;
  dirMatriz: string;
  dirEstablecimiento?: string | null;
  obligadoContabilidad: boolean;
  contribuyenteRimpe?: string | null;
  agenteRetencion?: string | null;
}

export interface RideComprobante {
  tipo: string;              // 'FACTURA' | 'COMPROBANTE DE RETENCIÓN'
  numero: string;            // 002-001-000000001
  claveAcceso: string;       // 49 dígitos (= nro. autorización offline)
  fechaEmision: string;      // dd/mm/aaaa
  ambiente: 1 | 2;
  fechaAutorizacion?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number) => `$ ${n.toFixed(2)}`;

/** Código de barras Code-128 de la clave de acceso, como dataURL PNG */
function barcodeDataUrl(clave: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, clave, { format: 'CODE128', displayValue: false, height: 36, margin: 0, width: 1 });
  return canvas.toDataURL('image/png');
}

/** Cabecera estándar de dos columnas; devuelve la Y donde sigue el contenido */
function drawHeader(doc: jsPDF, emisor: RideEmisor, comp: RideComprobante): number {
  const W = doc.internal.pageSize.getWidth();
  const colIzq = 12, colDer = W / 2 + 4, anchoCol = W / 2 - 16;

  // Columna izquierda: emisor
  let y = 16;
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(emisor.razonSocial, colIzq, y, { maxWidth: anchoCol }); y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(`RUC: ${emisor.ruc}`, colIzq, y); y += 5;
  doc.text(`Matriz: ${emisor.dirMatriz}`, colIzq, y, { maxWidth: anchoCol }); y += 5;
  if (emisor.dirEstablecimiento && emisor.dirEstablecimiento !== emisor.dirMatriz) {
    doc.text(`Sucursal: ${emisor.dirEstablecimiento}`, colIzq, y, { maxWidth: anchoCol }); y += 5;
  }
  doc.text(`OBLIGADO A LLEVAR CONTABILIDAD: ${emisor.obligadoContabilidad ? 'SI' : 'NO'}`, colIzq, y); y += 5;
  if (emisor.contribuyenteRimpe) { doc.text(emisor.contribuyenteRimpe, colIzq, y, { maxWidth: anchoCol }); y += 5; }
  if (emisor.agenteRetencion) { doc.text(`Agente de Retención Res. ${emisor.agenteRetencion}`, colIzq, y); y += 5; }
  const finIzq = y;

  // Columna derecha: comprobante (recuadro)
  let yd = 12;
  doc.rect(colDer - 2, yd - 4, anchoCol + 4, 58);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(comp.tipo, colDer, yd + 2); yd += 8;
  doc.setFontSize(9);
  doc.text(`No. ${comp.numero}`, colDer, yd); yd += 7;
  doc.setFont('helvetica', 'normal').setFontSize(7.5);
  doc.text('NÚMERO DE AUTORIZACIÓN:', colDer, yd); yd += 4;
  doc.setFontSize(6.6);
  doc.text(comp.claveAcceso, colDer, yd); yd += 5;
  doc.setFontSize(7.5);
  doc.text(`FECHA EMISIÓN: ${comp.fechaEmision}`, colDer, yd); yd += 4.5;
  doc.text(`AMBIENTE: ${comp.ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS'}   EMISIÓN: NORMAL`, colDer, yd); yd += 4.5;
  doc.text('CLAVE DE ACCESO:', colDer, yd); yd += 2;
  try {
    doc.addImage(barcodeDataUrl(comp.claveAcceso), 'PNG', colDer, yd, anchoCol, 11);
  } catch { /* sin canvas (SSR) se omite el código de barras */ }
  yd += 13;
  doc.setFontSize(6.4);
  doc.text(comp.claveAcceso, colDer, yd);

  return Math.max(finIzq, 74);
}

function drawFooter(doc: jsPDF, comp: RideComprobante) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic').setFontSize(7);
  const leyenda = comp.ambiente === 1
    ? 'DOCUMENTO EMITIDO EN AMBIENTE DE PRUEBAS - SIN VALIDEZ TRIBUTARIA'
    : 'Documento generado por ERP Ecuador';
  doc.text(leyenda, W / 2, H - 8, { align: 'center' });
}

// ── RIDE DE FACTURA ───────────────────────────────────────────────────────────

export interface RideFacturaInput {
  emisor: RideEmisor;
  comprobante: RideComprobante;       // tipo: 'FACTURA'
  comprador: { razonSocial: string; identificacion: string; direccion?: string | null };
  lineas: { codigo: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; subtotal: number }[];
  subtotal15: number;
  subtotal5: number;
  subtotal0: number;
  descuento: number;
  iva: number;
  total: number;
  formaPago: string;
}

export function buildRideFactura(input: RideFacturaInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc, input.emisor, input.comprobante);

  // Comprador
  doc.setDrawColor(120).rect(12, y, W - 24, 14);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(`Razón Social / Nombres: ${input.comprador.razonSocial}`, 14, y + 5);
  doc.text(`Identificación: ${input.comprador.identificacion}`, 14, y + 10);
  if (input.comprador.direccion) doc.text(`Dirección: ${input.comprador.direccion}`, W / 2, y + 10);
  y += 20;

  // Detalle
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.setFillColor('#EBEBEB').rect(12, y, W - 24, 6, 'F');
  doc.text('Código', 14, y + 4);
  doc.text('Descripción', 40, y + 4);
  doc.text('Cant.', 120, y + 4, { align: 'right' });
  doc.text('P. Unit.', 145, y + 4, { align: 'right' });
  doc.text('Dscto.', 165, y + 4, { align: 'right' });
  doc.text('Subtotal', W - 14, y + 4, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  for (const l of input.lineas) {
    doc.text(l.codigo, 14, y + 3);
    doc.text(doc.splitTextToSize(l.descripcion, 70), 40, y + 3);
    doc.text(l.cantidad.toFixed(2), 120, y + 3, { align: 'right' });
    doc.text(l.precioUnitario.toFixed(4), 145, y + 3, { align: 'right' });
    doc.text(l.descuento.toFixed(2), 165, y + 3, { align: 'right' });
    doc.text(l.subtotal.toFixed(2), W - 14, y + 3, { align: 'right' });
    y += 6;
    if (y > 250) { doc.addPage(); y = 16; }
  }
  doc.line(12, y, W - 12, y); y += 4;

  // Totales (caja derecha) y forma de pago (caja izquierda)
  const filas: [string, number][] = [
    ['SUBTOTAL 15%', input.subtotal15],
    ['SUBTOTAL 5%', input.subtotal5],
    ['SUBTOTAL 0%', input.subtotal0],
    ['DESCUENTO', input.descuento],
    ['IVA', input.iva],
    ['VALOR TOTAL', input.total],
  ];
  let yt = y;
  doc.setFontSize(8);
  for (const [lbl, val] of filas) {
    const esTotal = lbl === 'VALOR TOTAL';
    doc.setFont('helvetica', esTotal ? 'bold' : 'normal');
    doc.rect(W / 2 + 10, yt, 55, 6).rect(W / 2 + 65, yt, 31, 6);
    doc.text(lbl, W / 2 + 12, yt + 4);
    doc.text(money(val), W - 14, yt + 4, { align: 'right' });
    yt += 6;
  }
  doc.setFont('helvetica', 'normal');
  doc.rect(12, y, 80, 12);
  doc.text('Forma de pago:', 14, y + 5);
  doc.text(input.formaPago, 14, y + 10);

  drawFooter(doc, input.comprobante);
  return doc;
}

// ── RIDE DE COMPROBANTE DE RETENCIÓN ─────────────────────────────────────────

export interface RideRetencionInput {
  emisor: RideEmisor;
  comprobante: RideComprobante;       // tipo: 'COMPROBANTE DE RETENCIÓN'
  sujeto: { razonSocial: string; identificacion: string };
  periodoFiscal: string;              // MM/AAAA
  docSustento: { tipo: string; numero: string; fecha: string };
  retenciones: { impuesto: string; codigo: string; base: number; porcentaje: number; valor: number }[];
}

export function buildRideRetencion(input: RideRetencionInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc, input.emisor, input.comprobante);

  // Sujeto retenido
  doc.setDrawColor(120).rect(12, y, W - 24, 14);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(`Razón Social: ${input.sujeto.razonSocial}`, 14, y + 5);
  doc.text(`Identificación: ${input.sujeto.identificacion}`, 14, y + 10);
  doc.text(`Período Fiscal: ${input.periodoFiscal}`, W / 2 + 10, y + 10);
  y += 20;

  // Detalle de retenciones
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.setFillColor('#EBEBEB').rect(12, y, W - 24, 6, 'F');
  doc.text('Comprobante', 14, y + 4);
  doc.text('Número', 48, y + 4);
  doc.text('Fecha', 84, y + 4);
  doc.text('Impuesto', 106, y + 4);
  doc.text('Código', 130, y + 4);
  doc.text('Base', 152, y + 4, { align: 'right' });
  doc.text('%', 168, y + 4, { align: 'right' });
  doc.text('Retenido', W - 14, y + 4, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  let total = 0;
  for (const r of input.retenciones) {
    doc.text(input.docSustento.tipo, 14, y + 3);
    doc.text(input.docSustento.numero, 48, y + 3);
    doc.text(input.docSustento.fecha, 84, y + 3);
    doc.text(r.impuesto, 106, y + 3);
    doc.text(r.codigo, 130, y + 3);
    doc.text(r.base.toFixed(2), 152, y + 3, { align: 'right' });
    doc.text(r.porcentaje.toFixed(2), 168, y + 3, { align: 'right' });
    doc.text(r.valor.toFixed(2), W - 14, y + 3, { align: 'right' });
    total += r.valor;
    y += 6;
  }
  doc.line(12, y, W - 12, y); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL RETENIDO:', 130, y + 2);
  doc.text(money(Math.round(total * 100) / 100), W - 14, y + 2, { align: 'right' });

  drawFooter(doc, input.comprobante);
  return doc;
}
