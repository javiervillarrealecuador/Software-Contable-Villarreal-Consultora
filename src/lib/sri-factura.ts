// src/lib/sri-factura.ts
// Facturación electrónica SRI — FASE 1: XML de factura V2.1.0 + clave de acceso.
//
// MÓDULO PURO: no importa supabase ni APIs del navegador, para poder probarlo
// de forma aislada (tests con node) y validarlo contra el XSD oficial.
// La consulta de datos vive en sri-factura-db.ts.
//
// EL PORQUÉ de cada pieza:
// - claveAcceso (49 dígitos): identifica el comprobante ante el SRI. Estructura:
//   fecha(8 ddmmaaaa) + codDoc(2) + RUC(13) + ambiente(1) + serie(6) +
//   secuencial(9) + códigoNumérico(8) + tipoEmision(1) + dígitoVerificador(1).
//   El dígito verificador es módulo 11 con pesos 2..7 desde la derecha:
//   11 - (suma % 11); si resulta 11 → 0, si resulta 10 → 1.
// - codigoPorcentaje IVA (tabla SRI): 0%→0, 12%→2, 14%→3, 15%→4, 5%→5,
//   no objeto→6, exento→7.
// - tipoIdentificacionComprador: 04 RUC, 05 cédula, 06 pasaporte,
//   07 consumidor final (identificación 9999999999999).

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FacturaEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  dirMatriz: string;
  dirEstablecimiento?: string | null;
  estab: string;            // 001
  ptoEmi: string;           // 001
  ambiente: 1 | 2;          // 1 pruebas, 2 producción
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string | null;  // nro resolución
  agenteRetencion?: string | null;        // nro resolución
  contribuyenteRimpe?: string | null;     // leyenda RIMPE exacta
}

export interface FacturaComprador {
  identificacion: string;   // RUC/cédula/pasaporte; vacío → consumidor final
  razonSocial: string;
  direccion?: string | null;
}

export interface FacturaLinea {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;        // monto, no porcentaje
  ivaRate: number;          // 0, 5, 15...
}

export interface FacturaInput {
  emisor: FacturaEmisor;
  comprador: FacturaComprador;
  fechaEmision: string;     // ISO yyyy-mm-dd
  secuencial: number;       // entero; se rellena a 9 dígitos
  lineas: FacturaLinea[];
  formaPago?: string;       // catálogo SRI: 01 efectivo, 20 otros con sistema financiero
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const f6 = (n: number) => n.toFixed(6);
const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function isoToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Tabla SRI: tarifa de IVA → codigoPorcentaje */
export function ivaCodigoPorcentaje(rate: number): string {
  if (rate === 0) return '0';
  if (rate === 12) return '2';
  if (rate === 14) return '3';
  if (rate === 15) return '4';
  if (rate === 5) return '5';
  throw new Error(`Tarifa de IVA ${rate}% sin código SRI mapeado`);
}

/** Tipo de identificación del comprador según longitud/forma */
export function tipoIdentificacion(id: string): { tipo: string; id: string } {
  const clean = (id || '').trim();
  if (!clean) return { tipo: '07', id: '9999999999999' };          // consumidor final
  if (/^\d{13}$/.test(clean)) return { tipo: '04', id: clean };    // RUC
  if (/^\d{10}$/.test(clean)) return { tipo: '05', id: clean };    // cédula
  return { tipo: '06', id: clean };                                 // pasaporte
}

// ── Clave de acceso (módulo 11) ───────────────────────────────────────────────

export function digitoVerificadorMod11(digits48: string): number {
  // Pesos 2,3,4,5,6,7 cíclicos desde el dígito MÁS A LA DERECHA
  let sum = 0;
  let weight = 2;
  for (let i = digits48.length - 1; i >= 0; i--) {
    sum += Number(digits48[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

export function claveAcceso(input: {
  fechaEmision: string;    // ISO yyyy-mm-dd
  codDoc: string;          // '01' factura
  ruc: string;
  ambiente: 1 | 2;
  estab: string;
  ptoEmi: string;
  secuencial: number;
  codigoNumerico?: string; // 8 dígitos; aleatorio si no se da
  tipoEmision?: string;    // '1' normal
}): string {
  const [y, m, d] = input.fechaEmision.slice(0, 10).split('-');
  const fecha = `${d}${m}${y}`;                                     // ddmmaaaa
  const serie = `${input.estab}${input.ptoEmi}`;
  const sec = String(input.secuencial).padStart(9, '0');
  const codNum = (input.codigoNumerico || String(Math.floor(Math.random() * 1e8)).padStart(8, '0')).slice(0, 8).padStart(8, '0');
  const tipoEmision = input.tipoEmision || '1';

  const base48 = `${fecha}${input.codDoc}${input.ruc}${input.ambiente}${serie}${sec}${codNum}${tipoEmision}`;
  if (base48.length !== 48 || !/^\d{48}$/.test(base48)) {
    throw new Error(`Clave de acceso inválida (largo ${base48.length}, debe ser 48 dígitos antes del verificador). Revisa RUC (13 dígitos) y serie.`);
  }
  return base48 + String(digitoVerificadorMod11(base48));
}

// ── Generador XML factura V2.1.0 ──────────────────────────────────────────────

export interface FacturaResult {
  xml: string;
  claveAcceso: string;
  secuencialFormateado: string;   // 000000001
  numeroFactura: string;          // 001-001-000000001
  importeTotal: number;
}

export function buildFacturaXml(input: FacturaInput, codigoNumerico?: string): FacturaResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');

  // Totales por tarifa (agrupados como exige totalConImpuestos)
  const porTarifa: Record<string, { rate: number; base: number; valor: number }> = {};
  let totalSinImpuestos = 0, totalDescuento = 0;

  for (const l of input.lineas) {
    const subtotal = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    totalSinImpuestos += subtotal;
    totalDescuento += l.descuento;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    if (!porTarifa[cod]) porTarifa[cod] = { rate: l.ivaRate, base: 0, valor: 0 };
    porTarifa[cod].base += subtotal;
    porTarifa[cod].valor += Math.round(subtotal * l.ivaRate) / 100;
  }
  totalSinImpuestos = Math.round(totalSinImpuestos * 100) / 100;
  const totalIva = Math.round(Object.values(porTarifa).reduce((s, t) => s + t.valor, 0) * 100) / 100;
  const importeTotal = Math.round((totalSinImpuestos + totalIva) * 100) / 100;

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision,
    codDoc: '01',
    ruc: e.ruc,
    ambiente: e.ambiente,
    estab: e.estab,
    ptoEmi: e.ptoEmi,
    secuencial: input.secuencial,
    codigoNumerico,
  });

  const compr = tipoIdentificacion(input.comprador.identificacion);
  const formaPago = input.formaPago || '01';

  const totalImpuestosXml = Object.entries(porTarifa).map(([cod, t]) => `
    <totalImpuesto>
      <codigo>2</codigo>
      <codigoPorcentaje>${cod}</codigoPorcentaje>
      <baseImponible>${f2(t.base)}</baseImponible>
      <tarifa>${f2(t.rate)}</tarifa>
      <valor>${f2(t.valor)}</valor>
    </totalImpuesto>`).join('');

  const detallesXml = input.lineas.map(l => {
    const subtotal = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    const ivaValor = Math.round(subtotal * l.ivaRate) / 100;
    return `
    <detalle>
      <codigoPrincipal>${esc(l.codigo)}</codigoPrincipal>
      <descripcion>${esc(l.descripcion)}</descripcion>
      <cantidad>${f6(l.cantidad)}</cantidad>
      <precioUnitario>${f6(l.precioUnitario)}</precioUnitario>
      <descuento>${f2(l.descuento)}</descuento>
      <precioTotalSinImpuesto>${f2(subtotal)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${cod}</codigoPorcentaje>
          <tarifa>${f2(l.ivaRate)}</tarifa>
          <baseImponible>${f2(subtotal)}</baseImponible>
          <valor>${f2(ivaValor)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  // Orden de elementos EXACTO según el XSD (los opcionales vacíos se omiten)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.1.0">
  <infoTributaria>
    <ambiente>${e.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${esc(e.razonSocial)}</razonSocial>${e.nombreComercial ? `
    <nombreComercial>${esc(e.nombreComercial)}</nombreComercial>` : ''}
    <ruc>${e.ruc}</ruc>
    <claveAcceso>${clave}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${e.estab}</estab>
    <ptoEmi>${e.ptoEmi}</ptoEmi>
    <secuencial>${sec9}</secuencial>
    <dirMatriz>${esc(e.dirMatriz)}</dirMatriz>${e.agenteRetencion ? `
    <agenteRetencion>${esc(e.agenteRetencion)}</agenteRetencion>` : ''}${e.contribuyenteRimpe ? `
    <contribuyenteRimpe>${esc(e.contribuyenteRimpe)}</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${isoToDDMMYYYY(input.fechaEmision)}</fechaEmision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}${e.contribuyenteEspecial ? `
    <contribuyenteEspecial>${esc(e.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${compr.tipo}</tipoIdentificacionComprador>
    <razonSocialComprador>${esc(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${compr.id}</identificacionComprador>${input.comprador.direccion ? `
    <direccionComprador>${esc(input.comprador.direccion)}</direccionComprador>` : ''}
    <totalSinImpuestos>${f2(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${f2(totalDescuento)}</totalDescuento>
    <totalConImpuestos>${totalImpuestosXml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${f2(importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${formaPago}</formaPago>
        <total>${f2(importeTotal)}</total>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>${detallesXml}
  </detalles>
</factura>`;

  return {
    xml,
    claveAcceso: clave,
    secuencialFormateado: sec9,
    numeroFactura: `${e.estab}-${e.ptoEmi}-${sec9}`,
    importeTotal,
  };
}
