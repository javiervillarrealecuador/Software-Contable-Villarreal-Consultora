// src/lib/ats-xml.ts
// CAPA 2 - Generador XML del ATS (Anexo Transaccional Simplificado)
//
// EL PORQUE de la estructura:
// El ATS es un XML mensual que el SRI exige con el detalle de:
// - COMPRAS: cada factura recibida con sus retenciones (air = renta, valRet = IVA)
// - VENTAS: resumen por cliente (agrupado por identificacion)
// - VENTAS POR ESTABLECIMIENTO
// Validado contra el XSD oficial del SRI (ficha tecnica ATS).

import { supabase } from './supabase';
import { getReceivedWithholdingsByPeriod } from './received-withholding';

// ============ TIPOS DEL ATS ============

export interface AtsCompra {
  codSustento: string;        // 01=credito tributario IVA, 02=costo/gasto, etc
  tpIdProv: string;           // 01=RUC, 02=cedula, 03=pasaporte
  idProv: string;
  tipoComprobante: string;    // 01=factura, 03=liquidacion, 04=NC, 05=ND
  parteRel: 'SI' | 'NO';
  fechaRegistro: string;      // dd/mm/aaaa
  establecimiento: string;    // 001
  puntoEmision: string;       // 001
  secuencial: string;
  fechaEmision: string;       // dd/mm/aaaa
  autorizacion: string;       // 3-49 digitos (XSD oficial)
  baseNoGraIva: number;
  baseImponible: number;      // base tarifa 0
  baseImpGrav: number;        // base gravada
  baseImpExe: number;
  montoIce: number;
  montoIva: number;
  valRetBien10: number;
  valRetServ20: number;
  valorRetBienes: number;     // 30%
  valRetServ50: number;
  valorRetServicios: number;  // 70%
  valRetServ100: number;
  formaPago: string;          // 01=efectivo, 20=otros con sistema financiero
  air: { codRetAir: string; baseImpAir: number; porcentajeAir: number; valRetAir: number }[];
  // retencion emitida
  estabRetencion1?: string;
  ptoEmiRetencion1?: string;
  secRetencion1?: string;
  autRetencion1?: string;
  fechaEmiRet1?: string;
}

export interface AtsVenta {
  tpIdCliente: string;
  idCliente: string;
  parteRelVtas: 'SI' | 'NO';
  tipoComprobante: string;    // 18=factura
  tipoEmision: 'E' | 'F';
  numeroComprobantes: number;
  baseNoGraIva: number;
  baseImponible: number;
  baseImpGrav: number;
  montoIva: number;
  montoIce: number;
  valorRetIva: number;
  valorRetRenta: number;
  formaPago: string;
}

// ── Exportaciones (para empresas exportadoras) ────────────────────────────────
// Catálogos relevantes:
//   tipoRegi: 01=régimen general, 02=paraíso fiscal, 03=régimen fiscal preferente
//   pagoLocExt: 01=local, 02=exterior (para exportaciones siempre 02)
//   tipoCli: 'NATURAL' | 'SOCIEDAD'
export interface AtsExportacion {
  tpIdClienteEx: string;       // 04=RUC, 05=cédula, 06=pasaporte
  idClienteEx: string;
  parteRelExp: 'SI' | 'NO';
  tipoCli: 'NATURAL' | 'SOCIEDAD';
  tipoRegi: string;            // 01 = régimen general exterior
  denoExpor: string;           // denominación del exportador
  paisEfecPago: string;        // código ISO país (p.ej. 'USA', 'COL')
  pagoLocExt: '02';            // siempre 02 para exportaciones
  pagoCuentaDescripcion: string;
  aplicConvDobTrib: 'SI' | 'NO';
  pagExtSujRetNorLeg: 'SI' | 'NO';
  montoCompras: number;        // total facturado al exterior sin IVA
}

// ── Comprobantes anulados ─────────────────────────────────────────────────────
// Se declaran las facturas/NC/ND propias que fueron anuladas en el período.
// La obligación existe para que el SRI valide que los secuenciales no se usaron.
export interface AtsAnulado {
  tipIdProv: string;           // tipo de identificación del emisor (nuestra empresa)
  idProv: string;              // RUC/cédula del emisor
  tipoComprobante: string;     // 01=factura, 04=NC, 05=ND, etc.
  establecimiento: string;     // 001
  puntoEmision: string;        // 001
  secuencial: string;
  autorizacion: string;        // clave de acceso del comprobante anulado
  fechaEmision: string;        // dd/mm/aaaa
}

export interface AtsData {
  ruc: string;
  razonSocial: string;
  anio: number;
  mes: number;                // 1-12
  numEstabRuc: string;        // 001
  totalVentas: number;
  compras: AtsCompra[];
  ventas: AtsVenta[];
  ventasEstab: { codEstab: string; ventasEstab: number }[];
  exportaciones?: AtsExportacion[];    // opcional: solo si hay ventas al exterior
  anulados?: AtsAnulado[];             // opcional: solo si hay comprobantes anulados
}

// ============ HELPERS ============

const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function dateToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// ============ GENERADOR XML ============

export function generateAtsXml(data: AtsData): string {
  const mes = String(data.mes).padStart(2, '0');

  const comprasXml = data.compras.map(c => `
    <detalleCompras>
      <codSustento>${c.codSustento}</codSustento>
      <tpIdProv>${c.tpIdProv}</tpIdProv>
      <idProv>${esc(c.idProv)}</idProv>
      <tipoComprobante>${c.tipoComprobante}</tipoComprobante>
      <parteRel>${c.parteRel}</parteRel>
      <fechaRegistro>${c.fechaRegistro}</fechaRegistro>
      <establecimiento>${c.establecimiento}</establecimiento>
      <puntoEmision>${c.puntoEmision}</puntoEmision>
      <secuencial>${esc(c.secuencial)}</secuencial>
      <fechaEmision>${c.fechaEmision}</fechaEmision>
      <autorizacion>${esc(c.autorizacion)}</autorizacion>
      <baseNoGraIva>${f2(c.baseNoGraIva)}</baseNoGraIva>
      <baseImponible>${f2(c.baseImponible)}</baseImponible>
      <baseImpGrav>${f2(c.baseImpGrav)}</baseImpGrav>
      <baseImpExe>${f2(c.baseImpExe)}</baseImpExe>
      <montoIce>${f2(c.montoIce)}</montoIce>
      <montoIva>${f2(c.montoIva)}</montoIva>
      <valRetBien10>${f2(c.valRetBien10)}</valRetBien10>
      <valRetServ20>${f2(c.valRetServ20)}</valRetServ20>
      <valorRetBienes>${f2(c.valorRetBienes)}</valorRetBienes>
      <valRetServ50>${f2(c.valRetServ50)}</valRetServ50>
      <valorRetServicios>${f2(c.valorRetServicios)}</valorRetServicios>
      <valRetServ100>${f2(c.valRetServ100)}</valRetServ100>
      <totbasesImpReemb>0.00</totbasesImpReemb>
      <pagoExterior>
        <pagoLocExt>01</pagoLocExt>
        <paisEfecPago>NA</paisEfecPago>
        <aplicConvDobTrib>NA</aplicConvDobTrib>
        <pagExtSujRetNorLeg>NA</pagExtSujRetNorLeg>
      </pagoExterior>
      <formasDePago>
        <formaPago>${c.formaPago}</formaPago>
      </formasDePago>${c.air.length > 0 ? `
      <air>${c.air.map(a => `
        <detalleAir>
          <codRetAir>${a.codRetAir}</codRetAir>
          <baseImpAir>${f2(a.baseImpAir)}</baseImpAir>
          <porcentajeAir>${f2(a.porcentajeAir)}</porcentajeAir>
          <valRetAir>${f2(a.valRetAir)}</valRetAir>
        </detalleAir>`).join('')}
      </air>` : ''}${c.secRetencion1 ? `
      <estabRetencion1>${c.estabRetencion1}</estabRetencion1>
      <ptoEmiRetencion1>${c.ptoEmiRetencion1}</ptoEmiRetencion1>
      <secRetencion1>${c.secRetencion1}</secRetencion1>${c.autRetencion1 ? `
      <autRetencion1>${esc(c.autRetencion1)}</autRetencion1>` : ''}
      <fechaEmiRet1>${c.fechaEmiRet1}</fechaEmiRet1>` : ''}
    </detalleCompras>`).join('');

  const ventasXml = data.ventas.map(v => `
    <detalleVentas>
      <tpIdCliente>${v.tpIdCliente}</tpIdCliente>
      <idCliente>${esc(v.idCliente)}</idCliente>
      <parteRelVtas>${v.parteRelVtas}</parteRelVtas>
      <tipoComprobante>${v.tipoComprobante}</tipoComprobante>
      <tipoEmision>${v.tipoEmision}</tipoEmision>
      <numeroComprobantes>${v.numeroComprobantes}</numeroComprobantes>
      <baseNoGraIva>${f2(v.baseNoGraIva)}</baseNoGraIva>
      <baseImponible>${f2(v.baseImponible)}</baseImponible>
      <baseImpGrav>${f2(v.baseImpGrav)}</baseImpGrav>
      <montoIva>${f2(v.montoIva)}</montoIva>
      <montoIce>${f2(v.montoIce)}</montoIce>
      <valorRetIva>${f2(v.valorRetIva)}</valorRetIva>
      <valorRetRenta>${f2(v.valorRetRenta)}</valorRetRenta>
      <formasDePago>
        <formaPago>${v.formaPago}</formaPago>
      </formasDePago>
    </detalleVentas>`).join('');

  const ventasEstabXml = data.ventasEstab.map(e => `
    <ventaEst>
      <codEstab>${e.codEstab}</codEstab>
      <ventasEstab>${f2(e.ventasEstab)}</ventasEstab>
      <ivaComp>0.00</ivaComp>
    </ventaEst>`).join('');

  // ── Exportaciones (opcional) ─────────────────────────────────────────────
  // Solo se incluye la sección si hay exportaciones en el período.
  // El XSD del SRI define <exportaciones> con <detalleExportaciones> repetible.
  const exportacionesXml = (data.exportaciones && data.exportaciones.length > 0)
    ? `
  <exportaciones>${data.exportaciones.map(e => `
    <detalleExportaciones>
      <tpIdClienteEx>${e.tpIdClienteEx}</tpIdClienteEx>
      <idClienteEx>${esc(e.idClienteEx)}</idClienteEx>
      <parteRelExp>${e.parteRelExp}</parteRelExp>
      <tipoCli>${e.tipoCli}</tipoCli>
      <tipoRegi>${e.tipoRegi}</tipoRegi>
      <denoExpor>${esc(e.denoExpor)}</denoExpor>
      <paisEfecPago>${esc(e.paisEfecPago)}</paisEfecPago>
      <pagoLocExt>${e.pagoLocExt}</pagoLocExt>
      <pagoCuentaDescripcion>${esc(e.pagoCuentaDescripcion)}</pagoCuentaDescripcion>
      <aplicConvDobTrib>${e.aplicConvDobTrib}</aplicConvDobTrib>
      <pagExtSujRetNorLeg>${e.pagExtSujRetNorLeg}</pagExtSujRetNorLeg>
      <montoCompras>${f2(e.montoCompras)}</montoCompras>
    </detalleExportaciones>`).join('')}
  </exportaciones>` : '';

  // ── Anulados (opcional) ──────────────────────────────────────────────────
  // El SRI exige declarar los comprobantes propios anulados en el período para
  // verificar que los secuenciales no se reutilizaron.
  const anuladosXml = (data.anulados && data.anulados.length > 0)
    ? `
  <anulados>${data.anulados.map(a => `
    <detalleAnulados>
      <tipIdProv>${a.tipIdProv}</tipIdProv>
      <idProv>${esc(a.idProv)}</idProv>
      <tipoComprobante>${a.tipoComprobante}</tipoComprobante>
      <establecimiento>${a.establecimiento}</establecimiento>
      <puntoEmision>${a.puntoEmision}</puntoEmision>
      <secuencial>${esc(a.secuencial)}</secuencial>
      <autorizacion>${esc(a.autorizacion)}</autorizacion>
      <fechaEmision>${a.fechaEmision}</fechaEmision>
    </detalleAnulados>`).join('')}
  </anulados>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<iva>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>${esc(data.ruc)}</IdInformante>
  <razonSocial>${esc(data.razonSocial.toUpperCase())}</razonSocial>
  <Anio>${data.anio}</Anio>
  <Mes>${mes}</Mes>
  <numEstabRuc>${data.numEstabRuc}</numEstabRuc>
  <totalVentas>${f2(data.totalVentas)}</totalVentas>
  <codigoOperativo>IVA</codigoOperativo>
  <compras>${comprasXml}
  </compras>
  <ventas>${ventasXml}
  </ventas>
  <ventasEstablecimiento>${ventasEstabXml}
  </ventasEstablecimiento>${exportacionesXml}${anuladosXml}
</iva>`;
}

// ============ CONSTRUIR ATS DESDE LA BD ============

/**
 * Construye el ATS del mes desde los comprobantes de retencion registrados (compras)
 * y las ventas entregadas (CAPA 4).
 */
export async function buildAtsFromDb(companyId: number, anio: number, mes: number): Promise<AtsData> {
  const from = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const to = `${anio}-${String(mes).padStart(2, '0')}-${lastDay}`;

  const { data: company } = await supabase
    .from('res_company').select('*').eq('id', companyId).single();

  const { data: withholds } = await supabase
    .from('l10n_ec_withhold')
    .select(`*, partner:res_partner(id, name, vat, taxpayer_type), lines:l10n_ec_withhold_line(*)`)
    .eq('company_id', companyId)
    .eq('state', 'posted')
    .gte('date', from)
    .lte('date', to);

  const compras: AtsCompra[] = (withholds || []).map((w: any) => {
    const ivaLines = (w.lines || []).filter((l: any) => l.tax_type === 'iva');
    const rentLines = (w.lines || []).filter((l: any) => l.tax_type === 'rent');

    // Clasificar retencion IVA por porcentaje en los campos del ATS
    let valRetBien10 = 0, valRetServ20 = 0, valorRetBienes = 0,
        valRetServ50 = 0, valorRetServicios = 0, valRetServ100 = 0;
    for (const l of ivaLines) {
      const p = Number(l.percent);
      const a = Number(l.amount);
      if (p === 10) valRetBien10 += a;
      else if (p === 20) valRetServ20 += a;
      else if (p === 30) valorRetBienes += a;
      else if (p === 50) valRetServ50 += a;
      else if (p === 70) valorRetServicios += a;
      else if (p === 100) valRetServ100 += a;
    }

    // Parsear numero de factura 001-001-000000123
    const ref = (w.invoice_ref || '').split('-');
    const estab = ref[0] || '001';
    const pto = ref[1] || '001';
    const sec = ref[2] || '1';

    const vat = w.partner?.vat || '';
    const tpId = vat.length === 13 ? '01' : vat.length === 10 ? '02' : '03';

    // Autorización de la factura sustento: el XSD oficial exige 3-49 dígitos.
    // Si no hay registro, se usa 9999999999 (convención para comprobantes
    // físicos sin autorización electrónica).
    const autDigits = (w.invoice_auth || '').replace(/\D/g, '');
    const autorizacion = autDigits.length >= 3 ? autDigits.slice(0, 49) : '9999999999';

    return {
      codSustento: '01',
      tpIdProv: tpId,
      idProv: vat,
      tipoComprobante: '01',
      parteRel: 'NO' as const,
      fechaRegistro: dateToDDMMYYYY(w.date),
      establecimiento: estab,
      puntoEmision: pto,
      secuencial: String(parseInt(sec) || 1),
      fechaEmision: dateToDDMMYYYY(w.invoice_date || w.date),
      autorizacion,
      baseNoGraIva: 0,
      baseImponible: 0,
      baseImpGrav: Number(w.base_iva) || Number(w.base_renta) || 0,
      baseImpExe: 0,
      montoIce: 0,
      montoIva: Math.round((Number(w.base_iva) || 0) * 0.15 * 100) / 100,
      valRetBien10, valRetServ20, valorRetBienes, valRetServ50, valorRetServicios, valRetServ100,
      formaPago: '20',
      air: rentLines.map((l: any) => ({
        codRetAir: l.rule_code || '3440',
        baseImpAir: Number(l.base),
        porcentajeAir: Number(l.percent),
        valRetAir: Number(l.amount),
      })),
      estabRetencion1: '001',
      ptoEmiRetencion1: '001',
      secRetencion1: (w.number || '').replace(/\D/g, '') || '1',
      autRetencion1: (w.sri_clave_acceso || '').replace(/\D/g, '') || '',
      fechaEmiRet1: dateToDDMMYYYY(w.date),
    };
  });

  // ── VENTAS (CAPA 4) ──────────────────────────────────────────────────────────
  const { data: sales } = await supabase
    .from('sale_order')
    .select(`
      id, name, date_order, invoice_ref, invoice_auth,
      amount_untaxed, amount_tax, amount_total,
      partner:res_partner(id, name, vat),
      lines:sale_order_line(price_subtotal, iva_rate)
    `)
    .eq('company_id', companyId)
    .eq('state', 'delivered')
    .gte('date_order', from)
    .lte('date_order', to);

  const ventasMap: Record<string, AtsVenta> = {};
  let totalVentas = 0;
  const estabMap: Record<string, number> = {};

  for (const s of (sales || []) as any[]) {
    const vat: string = s.partner?.vat || '';
    const tpId = vat.length === 13 ? '04' : vat.length === 10 ? '05' : '07';
    const idCliente = tpId === '07' ? '9999999999999' : vat;
    const tipoEmision: 'E' | 'F' = (s.invoice_auth || '').length === 49 ? 'E' : 'F';

    let base0 = 0, baseGrav = 0;
    for (const l of s.lines || []) {
      const sub = Number(l.price_subtotal) || 0;
      if (Number(l.iva_rate) > 0) baseGrav += sub; else base0 += sub;
    }

    const key = `${tpId}|${idCliente}|${tipoEmision}`;
    if (!ventasMap[key]) {
      ventasMap[key] = {
        tpIdCliente: tpId, idCliente,
        parteRelVtas: 'NO', tipoComprobante: '18', tipoEmision,
        numeroComprobantes: 0,
        baseNoGraIva: 0, baseImponible: 0, baseImpGrav: 0,
        montoIva: 0, montoIce: 0,
        valorRetIva: 0,   // se suma al final desde sale_received_withholding
        valorRetRenta: 0,
        formaPago: '20',
      };
    }
    const v = ventasMap[key];
    v.numeroComprobantes += 1;
    v.baseImponible += base0;
    v.baseImpGrav += baseGrav;
    v.montoIva += Number(s.amount_tax) || 0;
    totalVentas += base0 + baseGrav;

    const estab = (s.invoice_ref || '').split('-')[0] || '001';
    estabMap[estab] = (estabMap[estab] || 0) + base0 + baseGrav;
  }

  // ── Retenciones recibidas → valorRetIva / valorRetRenta ─────────────────────
  const receivedWH = await getReceivedWithholdingsByPeriod(companyId, anio, mes);
  for (const rwh of receivedWH) {
    for (const key of Object.keys(ventasMap)) {
      const v = ventasMap[key];
      if (rwh.vat && v.idCliente !== '9999999999999' && v.idCliente === rwh.vat) {
        v.valorRetIva   = Math.round((v.valorRetIva   + rwh.valorRetIva)   * 10000) / 10000;
        v.valorRetRenta = Math.round((v.valorRetRenta + rwh.valorRetRenta) * 10000) / 10000;
        break;
      }
    }
  }

  // ── Comprobantes anulados ────────────────────────────────────────────────────
  const { data: cancelledSales } = await supabase
    .from('sale_order')
    .select('invoice_ref, invoice_auth, date_order')
    .eq('company_id', companyId)
    .eq('state', 'cancel')
    .gte('date_order', from)
    .lte('date_order', to)
    .not('invoice_ref', 'is', null);

  const anulados: AtsAnulado[] = [];
  const rucEmpresa = company?.vat || '';
  for (const s of (cancelledSales || []) as any[]) {
    if (!s.invoice_ref) continue;
    const ref = (s.invoice_ref || '').split('-');
    anulados.push({
      tipIdProv: '04', idProv: rucEmpresa, tipoComprobante: '01',
      establecimiento: ref[0] || '001',
      puntoEmision: ref[1] || '001',
      secuencial: String(parseInt(ref[2] || '1') || 1),
      autorizacion: ((s.invoice_auth || '').replace(/\D/g, '') || '9999999999').slice(0, 49),
      fechaEmision: dateToDDMMYYYY(s.date_order),
    });
  }

  const ventas = Object.values(ventasMap);
  const ventasEstab = Object.keys(estabMap).length > 0
    ? Object.entries(estabMap).map(([codEstab, monto]) => ({ codEstab, ventasEstab: monto }))
    : [{ codEstab: '001', ventasEstab: 0 }];

  return {
    ruc: company?.vat || '',
    razonSocial: company?.name || '',
    anio, mes,
    numEstabRuc: '001',
    totalVentas,
    compras,
    ventas,
    ventasEstab,
    anulados: anulados.length > 0 ? anulados : undefined,
  };
}

/** Descarga el XML en el navegador */
export function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
