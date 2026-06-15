// src/lib/sri-docs.ts
// Generadores XML de NOTA DE CRÉDITO (04), NOTA DE DÉBITO (05),
// COMPROBANTE DE RETENCIÓN (07), LIQUIDACIÓN DE COMPRA (03) y
// GUÍA DE REMISIÓN (06) conforme a los XSD oficiales del SRI.
// MÓDULO PURO (sin supabase), igual que sri-factura.ts.

import {
  claveAcceso, isoToDDMMYYYY, ivaCodigoPorcentaje, tipoIdentificacion,
  type FacturaEmisor, type FacturaLinea,
} from './sri-factura';

const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const f6 = (n: number) => n.toFixed(6);
const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export interface DocResult {
  xml: string;
  claveAcceso: string;
  numero: string;            // estab-ptoEmi-secuencial
}

// ── infoTributaria común ──────────────────────────────────────────────────────

function infoTributaria(e: FacturaEmisor, codDoc: string, clave: string, sec9: string): string {
  return `<infoTributaria>
    <ambiente>${e.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${esc(e.razonSocial)}</razonSocial>${e.nombreComercial ? `
    <nombreComercial>${esc(e.nombreComercial)}</nombreComercial>` : ''}
    <ruc>${e.ruc}</ruc>
    <claveAcceso>${clave}</claveAcceso>
    <codDoc>${codDoc}</codDoc>
    <estab>${e.estab}</estab>
    <ptoEmi>${e.ptoEmi}</ptoEmi>
    <secuencial>${sec9}</secuencial>
    <dirMatriz>${esc(e.dirMatriz)}</dirMatriz>${e.agenteRetencion ? `
    <agenteRetencion>${esc(e.agenteRetencion)}</agenteRetencion>` : ''}${e.contribuyenteRimpe ? `
    <contribuyenteRimpe>${esc(e.contribuyenteRimpe)}</contribuyenteRimpe>` : ''}
  </infoTributaria>`;
}

// ── NOTA DE CRÉDITO V1.1.0 (codDoc 04) ───────────────────────────────────────

export interface NotaCreditoInput {
  emisor: FacturaEmisor;
  comprador: { identificacion: string; razonSocial: string };
  fechaEmision: string;          // ISO
  secuencial: number;
  docModificado: { codDoc: string; numero: string; fechaEmision: string };  // factura origen
  motivo: string;
  lineas: FacturaLinea[];        // líneas que se devuelven/anulan
}

export function buildNotaCreditoXml(input: NotaCreditoInput, codigoNumerico?: string): DocResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');

  const porTarifa: Record<string, { rate: number; base: number; valor: number }> = {};
  let totalSinImpuestos = 0;
  for (const l of input.lineas) {
    const sub = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    totalSinImpuestos += sub;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    if (!porTarifa[cod]) porTarifa[cod] = { rate: l.ivaRate, base: 0, valor: 0 };
    porTarifa[cod].base += sub;
    porTarifa[cod].valor += Math.round(sub * l.ivaRate) / 100;
  }
  totalSinImpuestos = Math.round(totalSinImpuestos * 100) / 100;
  const totalIva = Math.round(Object.values(porTarifa).reduce((s, t) => s + t.valor, 0) * 100) / 100;
  const valorModificacion = Math.round((totalSinImpuestos + totalIva) * 100) / 100;

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision, codDoc: '04', ruc: e.ruc, ambiente: e.ambiente,
    estab: e.estab, ptoEmi: e.ptoEmi, secuencial: input.secuencial, codigoNumerico,
  });
  const compr = tipoIdentificacion(input.comprador.identificacion);

  // En NC el totalImpuesto NO lleva <tarifa> (a diferencia de la factura)
  const totalImpuestosXml = Object.entries(porTarifa).map(([cod, t]) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${cod}</codigoPorcentaje>
        <baseImponible>${f2(t.base)}</baseImponible>
        <valor>${f2(t.valor)}</valor>
      </totalImpuesto>`).join('');

  // En NC el detalle usa codigoInterno (no codigoPrincipal)
  const detallesXml = input.lineas.map(l => {
    const sub = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    return `
    <detalle>
      <codigoInterno>${esc(l.codigo)}</codigoInterno>
      <descripcion>${esc(l.descripcion)}</descripcion>
      <cantidad>${f6(l.cantidad)}</cantidad>
      <precioUnitario>${f6(l.precioUnitario)}</precioUnitario>
      <descuento>${f2(l.descuento)}</descuento>
      <precioTotalSinImpuesto>${f2(sub)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${cod}</codigoPorcentaje>
          <tarifa>${f2(l.ivaRate)}</tarifa>
          <baseImponible>${f2(sub)}</baseImponible>
          <valor>${f2(Math.round(sub * l.ivaRate) / 100)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  ${infoTributaria(e, '04', clave, sec9)}
  <infoNotaCredito>
    <fechaEmision>${isoToDDMMYYYY(input.fechaEmision)}</fechaEmision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <tipoIdentificacionComprador>${compr.tipo}</tipoIdentificacionComprador>
    <razonSocialComprador>${esc(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${compr.id}</identificacionComprador>
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <codDocModificado>${input.docModificado.codDoc}</codDocModificado>
    <numDocModificado>${input.docModificado.numero}</numDocModificado>
    <fechaEmisionDocSustento>${isoToDDMMYYYY(input.docModificado.fechaEmision)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${f2(totalSinImpuestos)}</totalSinImpuestos>
    <valorModificacion>${f2(valorModificacion)}</valorModificacion>
    <moneda>DOLAR</moneda>
    <totalConImpuestos>${totalImpuestosXml}
    </totalConImpuestos>
    <motivo>${esc(input.motivo)}</motivo>
  </infoNotaCredito>
  <detalles>${detallesXml}
  </detalles>
</notaCredito>`;

  return { xml, claveAcceso: clave, numero: `${e.estab}-${e.ptoEmi}-${sec9}` };
}

// ── NOTA DE DÉBITO V1.0.0 (codDoc 05) ────────────────────────────────────────

export interface NotaDebitoInput {
  emisor: FacturaEmisor;
  comprador: { identificacion: string; razonSocial: string };
  fechaEmision: string;
  secuencial: number;
  docModificado: { codDoc: string; numero: string; fechaEmision: string };
  motivos: { razon: string; valor: number }[];   // recargos (sin IVA)
  ivaRate: number;                                // tarifa aplicada a los recargos
  formaPago?: string;
}

export function buildNotaDebitoXml(input: NotaDebitoInput, codigoNumerico?: string): DocResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');

  const base = Math.round(input.motivos.reduce((s, m) => s + m.valor, 0) * 100) / 100;
  const iva = Math.round(base * input.ivaRate) / 100;
  const valorTotal = Math.round((base + iva) * 100) / 100;
  const cod = ivaCodigoPorcentaje(input.ivaRate);

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision, codDoc: '05', ruc: e.ruc, ambiente: e.ambiente,
    estab: e.estab, ptoEmi: e.ptoEmi, secuencial: input.secuencial, codigoNumerico,
  });
  const compr = tipoIdentificacion(input.comprador.identificacion);

  const motivosXml = input.motivos.map(m => `
    <motivo>
      <razon>${esc(m.razon)}</razon>
      <valor>${f2(m.valor)}</valor>
    </motivo>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notaDebito id="comprobante" version="1.0.0">
  ${infoTributaria(e, '05', clave, sec9)}
  <infoNotaDebito>
    <fechaEmision>${isoToDDMMYYYY(input.fechaEmision)}</fechaEmision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <tipoIdentificacionComprador>${compr.tipo}</tipoIdentificacionComprador>
    <razonSocialComprador>${esc(input.comprador.razonSocial)}</razonSocialComprador>
    <identificacionComprador>${compr.id}</identificacionComprador>
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <codDocModificado>${input.docModificado.codDoc}</codDocModificado>
    <numDocModificado>${input.docModificado.numero}</numDocModificado>
    <fechaEmisionDocSustento>${isoToDDMMYYYY(input.docModificado.fechaEmision)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${f2(base)}</totalSinImpuestos>
    <impuestos>
      <impuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${cod}</codigoPorcentaje>
        <tarifa>${f2(input.ivaRate)}</tarifa>
        <baseImponible>${f2(base)}</baseImponible>
        <valor>${f2(iva)}</valor>
      </impuesto>
    </impuestos>
    <valorTotal>${f2(valorTotal)}</valorTotal>
    <pagos>
      <pago>
        <formaPago>${input.formaPago || '01'}</formaPago>
        <total>${f2(valorTotal)}</total>
      </pago>
    </pagos>
  </infoNotaDebito>
  <motivos>${motivosXml}
  </motivos>
</notaDebito>`;

  return { xml, claveAcceso: clave, numero: `${e.estab}-${e.ptoEmi}-${sec9}` };
}

// ── COMPROBANTE DE RETENCIÓN V2.0.0 (codDoc 07) ──────────────────────────────
// Versión ATS vigente: la retención se declara POR DOCUMENTO SUSTENTO
// (la factura de compra que la origina), con sus impuestos y pagos.
//
// Catálogos usados:
//   codigo (impuesto retenido): 1 = Renta, 2 = IVA
//   codigoRetencion IVA: 9=10%, 10=20%, 1=30%, 11=50%, 2=70%, 3=100%
//   codigoRetencion Renta: código del concepto (ej. 312 compras, 3440 otros)

export interface RetencionInput {
  emisor: FacturaEmisor;
  sujetoRetenido: { identificacion: string; razonSocial: string };
  fechaEmision: string;          // ISO
  secuencial: number;
  periodoFiscal: string;         // MM/YYYY
  docSustento: {
    codSustento: string;         // '01' crédito tributario
    codDocSustento: string;      // '01' factura
    numDocSustento: string;      // 15 dígitos sin guiones
    fechaEmision: string;        // ISO
    numAutDocSustento?: string | null;
    totalSinImpuestos: number;
    importeTotal: number;
    impuestos: { codigoPorcentaje: string; base: number; tarifa: number; valor: number }[];
    retenciones: { codigo: '1' | '2'; codigoRetencion: string; base: number; porcentaje: number; valor: number }[];
    formaPago?: string;
  };
}

const IVA_RET_CODIGO: Record<number, string> = { 10: '9', 20: '10', 30: '1', 50: '11', 70: '2', 100: '3' };

export function ivaRetencionCodigo(percent: number): string {
  const c = IVA_RET_CODIGO[percent];
  if (!c) throw new Error(`Porcentaje de retención IVA ${percent}% sin código SRI`);
  return c;
}

export function buildRetencionXml(input: RetencionInput, codigoNumerico?: string): DocResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');
  const d = input.docSustento;

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision, codDoc: '07', ruc: e.ruc, ambiente: e.ambiente,
    estab: e.estab, ptoEmi: e.ptoEmi, secuencial: input.secuencial, codigoNumerico,
  });
  const suj = tipoIdentificacion(input.sujetoRetenido.identificacion);

  const impuestosXml = d.impuestos.map(i => `
        <impuestoDocSustento>
          <codImpuestoDocSustento>2</codImpuestoDocSustento>
          <codigoPorcentaje>${i.codigoPorcentaje}</codigoPorcentaje>
          <baseImponible>${f2(i.base)}</baseImponible>
          <tarifa>${f2(i.tarifa)}</tarifa>
          <valorImpuesto>${f2(i.valor)}</valorImpuesto>
        </impuestoDocSustento>`).join('');

  const retencionesXml = d.retenciones.map(r => `
        <retencion>
          <codigo>${r.codigo}</codigo>
          <codigoRetencion>${esc(r.codigoRetencion)}</codigoRetencion>
          <baseImponible>${f2(r.base)}</baseImponible>
          <porcentajeRetener>${f2(r.porcentaje)}</porcentajeRetener>
          <valorRetenido>${f2(r.valor)}</valorRetenido>
        </retencion>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<comprobanteRetencion id="comprobante" version="2.0.0">
  ${infoTributaria(e, '07', clave, sec9)}
  <infoCompRetencion>
    <fechaEmision>${isoToDDMMYYYY(input.fechaEmision)}</fechaEmision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionSujetoRetenido>${suj.tipo}</tipoIdentificacionSujetoRetenido>
    <parteRel>NO</parteRel>
    <razonSocialSujetoRetenido>${esc(input.sujetoRetenido.razonSocial)}</razonSocialSujetoRetenido>
    <identificacionSujetoRetenido>${suj.id}</identificacionSujetoRetenido>
    <periodoFiscal>${input.periodoFiscal}</periodoFiscal>
  </infoCompRetencion>
  <docsSustento>
    <docSustento>
      <codSustento>${d.codSustento}</codSustento>
      <codDocSustento>${d.codDocSustento}</codDocSustento>
      <numDocSustento>${d.numDocSustento}</numDocSustento>
      <fechaEmisionDocSustento>${isoToDDMMYYYY(d.fechaEmision)}</fechaEmisionDocSustento>${d.numAutDocSustento ? `
      <numAutDocSustento>${esc(d.numAutDocSustento)}</numAutDocSustento>` : ''}
      <pagoLocExt>01</pagoLocExt>
      <totalSinImpuestos>${f2(d.totalSinImpuestos)}</totalSinImpuestos>
      <importeTotal>${f2(d.importeTotal)}</importeTotal>
      <impuestosDocSustento>${impuestosXml}
      </impuestosDocSustento>
      <retenciones>${retencionesXml}
      </retenciones>
      <pagos>
        <pago>
          <formaPago>${d.formaPago || '01'}</formaPago>
          <total>${f2(d.importeTotal)}</total>
        </pago>
      </pagos>
    </docSustento>
  </docsSustento>
</comprobanteRetencion>`;

  return { xml, claveAcceso: clave, numero: `${e.estab}-${e.ptoEmi}-${sec9}` };
}

// ── LIQUIDACIÓN DE COMPRA V1.1.0 (codDoc 03) ─────────────────────────────────
// Se emite cuando el COMPRADOR documenta la compra porque el proveedor no
// puede facturar (servicios ocasionales, no obligados, etc.).

export interface LiquidacionInput {
  emisor: FacturaEmisor;
  proveedor: { identificacion: string; razonSocial: string; direccion?: string | null };
  fechaEmision: string;
  secuencial: number;
  lineas: FacturaLinea[];
  formaPago?: string;
}

export function buildLiquidacionXml(input: LiquidacionInput, codigoNumerico?: string): DocResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');

  const porTarifa: Record<string, { rate: number; base: number; valor: number }> = {};
  let totalSinImpuestos = 0, totalDescuento = 0;
  for (const l of input.lineas) {
    const sub = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    totalSinImpuestos += sub;
    totalDescuento += l.descuento;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    if (!porTarifa[cod]) porTarifa[cod] = { rate: l.ivaRate, base: 0, valor: 0 };
    porTarifa[cod].base += sub;
    porTarifa[cod].valor += Math.round(sub * l.ivaRate) / 100;
  }
  totalSinImpuestos = Math.round(totalSinImpuestos * 100) / 100;
  const totalIva = Math.round(Object.values(porTarifa).reduce((s, t) => s + t.valor, 0) * 100) / 100;
  const importeTotal = Math.round((totalSinImpuestos + totalIva) * 100) / 100;

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision, codDoc: '03', ruc: e.ruc, ambiente: e.ambiente,
    estab: e.estab, ptoEmi: e.ptoEmi, secuencial: input.secuencial, codigoNumerico,
  });
  const prov = tipoIdentificacion(input.proveedor.identificacion);

  const totalImpuestosXml = Object.entries(porTarifa).map(([cod, t]) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${cod}</codigoPorcentaje>
        <baseImponible>${f2(t.base)}</baseImponible>
        <tarifa>${f2(t.rate)}</tarifa>
        <valor>${f2(t.valor)}</valor>
      </totalImpuesto>`).join('');

  const detallesXml = input.lineas.map(l => {
    const sub = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
    const cod = ivaCodigoPorcentaje(l.ivaRate);
    return `
    <detalle>
      <codigoPrincipal>${esc(l.codigo)}</codigoPrincipal>
      <descripcion>${esc(l.descripcion)}</descripcion>
      <cantidad>${f6(l.cantidad)}</cantidad>
      <precioUnitario>${f6(l.precioUnitario)}</precioUnitario>
      <descuento>${f2(l.descuento)}</descuento>
      <precioTotalSinImpuesto>${f2(sub)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${cod}</codigoPorcentaje>
          <tarifa>${f2(l.ivaRate)}</tarifa>
          <baseImponible>${f2(sub)}</baseImponible>
          <valor>${f2(Math.round(sub * l.ivaRate) / 100)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<liquidacionCompra id="comprobante" version="1.1.0">
  ${infoTributaria(e, '03', clave, sec9)}
  <infoLiquidacionCompra>
    <fechaEmision>${isoToDDMMYYYY(input.fechaEmision)}</fechaEmision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionProveedor>${prov.tipo}</tipoIdentificacionProveedor>
    <razonSocialProveedor>${esc(input.proveedor.razonSocial)}</razonSocialProveedor>
    <identificacionProveedor>${prov.id}</identificacionProveedor>${input.proveedor.direccion ? `
    <direccionProveedor>${esc(input.proveedor.direccion)}</direccionProveedor>` : ''}
    <totalSinImpuestos>${f2(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${f2(totalDescuento)}</totalDescuento>
    <totalConImpuestos>${totalImpuestosXml}
    </totalConImpuestos>
    <importeTotal>${f2(importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${input.formaPago || '01'}</formaPago>
        <total>${f2(importeTotal)}</total>
      </pago>
    </pagos>
  </infoLiquidacionCompra>
  <detalles>${detallesXml}
  </detalles>
</liquidacionCompra>`;

  return { xml, claveAcceso: clave, numero: `${e.estab}-${e.ptoEmi}-${sec9}` };
}

// ── GUÍA DE REMISIÓN V1.1.0 (codDoc 06) ──────────────────────────────────────
// Ampara el traslado físico de mercadería. No tiene valores monetarios:
// solo origen, transportista, destinatarios y detalle de bultos.

export interface GuiaRemisionInput {
  emisor: FacturaEmisor;
  fechaEmision: string;          // ISO (alimenta la clave de acceso)
  secuencial: number;
  dirPartida: string;
  transportista: { identificacion: string; razonSocial: string; placa: string };
  fechaIniTransporte: string;    // ISO
  fechaFinTransporte: string;    // ISO
  destinatario: {
    identificacion: string;
    razonSocial: string;
    direccion: string;
    motivoTraslado: string;
    docSustento?: { codDoc: string; numero: string; numAut?: string | null; fechaEmision?: string | null } | null;
  };
  lineas: { codigo?: string; descripcion: string; cantidad: number }[];
}

export function buildGuiaRemisionXml(input: GuiaRemisionInput, codigoNumerico?: string): DocResult {
  const e = input.emisor;
  const sec9 = String(input.secuencial).padStart(9, '0');

  const clave = claveAcceso({
    fechaEmision: input.fechaEmision, codDoc: '06', ruc: e.ruc, ambiente: e.ambiente,
    estab: e.estab, ptoEmi: e.ptoEmi, secuencial: input.secuencial, codigoNumerico,
  });
  const transp = tipoIdentificacion(input.transportista.identificacion);
  const dest = tipoIdentificacion(input.destinatario.identificacion);
  const ds = input.destinatario.docSustento;

  const detallesXml = input.lineas.map(l => `
        <detalle>${l.codigo ? `
          <codigoInterno>${esc(l.codigo)}</codigoInterno>` : ''}
          <descripcion>${esc(l.descripcion)}</descripcion>
          <cantidad>${f6(l.cantidad)}</cantidad>
        </detalle>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<guiaRemision id="comprobante" version="1.1.0">
  ${infoTributaria(e, '06', clave, sec9)}
  <infoGuiaRemision>${e.dirEstablecimiento ? `
    <dirEstablecimiento>${esc(e.dirEstablecimiento)}</dirEstablecimiento>` : ''}
    <dirPartida>${esc(input.dirPartida)}</dirPartida>
    <razonSocialTransportista>${esc(input.transportista.razonSocial)}</razonSocialTransportista>
    <tipoIdentificacionTransportista>${transp.tipo}</tipoIdentificacionTransportista>
    <rucTransportista>${transp.id}</rucTransportista>
    <obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <fechaIniTransporte>${isoToDDMMYYYY(input.fechaIniTransporte)}</fechaIniTransporte>
    <fechaFinTransporte>${isoToDDMMYYYY(input.fechaFinTransporte)}</fechaFinTransporte>
    <placa>${esc(input.transportista.placa)}</placa>
  </infoGuiaRemision>
  <destinatarios>
    <destinatario>
      <identificacionDestinatario>${dest.id}</identificacionDestinatario>
      <razonSocialDestinatario>${esc(input.destinatario.razonSocial)}</razonSocialDestinatario>
      <dirDestinatario>${esc(input.destinatario.direccion)}</dirDestinatario>
      <motivoTraslado>${esc(input.destinatario.motivoTraslado)}</motivoTraslado>${ds ? `
      <codDocSustento>${ds.codDoc}</codDocSustento>
      <numDocSustento>${ds.numero}</numDocSustento>${ds.numAut ? `
      <numAutDocSustento>${esc(ds.numAut)}</numAutDocSustento>` : ''}${ds.fechaEmision ? `
      <fechaEmisionDocSustento>${isoToDDMMYYYY(ds.fechaEmision)}</fechaEmisionDocSustento>` : ''}` : ''}
      <detalles>${detallesXml}
      </detalles>
    </destinatario>
  </destinatarios>
</guiaRemision>`;

  return { xml, claveAcceso: clave, numero: `${e.estab}-${e.ptoEmi}-${sec9}` };
}
