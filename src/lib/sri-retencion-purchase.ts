// src/lib/sri-retencion-purchase.ts
// Genera y envía el comprobante de retención (codDoc 07) que la empresa
// emite al proveedor cuando registra una factura de compra.
// Utiliza buildRetencionXml de sri-docs.ts y el mismo pipeline firma/envío.

import { supabase } from './supabase';
import { buildRetencionXml, ivaRetencionCodigo, type RetencionInput } from './sri-docs';
import type { FacturaEmisor } from './sri-factura';
import { savePurchaseRetencion } from './purchases';

export interface RetInput {
  purchaseId: number;
  codigoRenta: string;        // Código SRI renta (ej: '312' bienes, '340' servicios)
  porcentajeRenta: number;    // % retención renta (ej: 1, 2, 8, 10)
  porcentajeIva: number;      // % retención IVA (0, 30, 70, 100) — 0 = no retiene IVA
}

export async function emitRetencionForPurchase(input: RetInput) {
  // 1. Leer compra + empresa
  const { data: order, error: oErr } = await supabase
    .from('purchase_order')
    .select(`
      id, company_id, name, date_order, invoice_ref, invoice_auth, invoice_date,
      amount_untaxed, amount_tax, amount_total,
      partner:res_partner(id, name, vat)
    `)
    .eq('id', input.purchaseId)
    .single();
  if (oErr) throw oErr;
  if (!order) throw new Error('Compra no encontrada');

  const { data: company, error: cErr } = await supabase
    .from('res_company').select('*').eq('id', (order as any).company_id).single();
  if (cErr) throw cErr;
  if (!company?.vat || !/^\d{13}$/.test(company.vat)) throw new Error('RUC de la empresa inválido (debe tener 13 dígitos)');

  const ambiente: 1 | 2 = company.sri_ambiente === 2 ? 2 : 1;
  const emisor: FacturaEmisor = {
    ruc: company.vat, razonSocial: company.name, nombreComercial: company.name,
    dirMatriz: company.sri_dir_matriz || 'S/D',
    dirEstablecimiento: company.sri_dir_estab || company.sri_dir_matriz || null,
    estab: company.sri_estab || '001', ptoEmi: company.sri_pto_emi || '001',
    ambiente, obligadoContabilidad: company.sri_obligado_contab !== false,
    contribuyenteEspecial: company.sri_contrib_especial || null,
    agenteRetencion: company.sri_agente_retencion || null,
    contribuyenteRimpe: company.sri_rimpe || null,
  };

  // 2. Secuencial de retención
  const { count } = await supabase
    .from('purchase_order')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', (order as any).company_id)
    .not('ret_secuencial', 'is', null);
  const secuencial = (count ?? 0) + 1;

  const fechaEmision = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const [anio, mes] = fechaEmision.split('-');
  const periodoFiscal = `${mes}/${anio}`;

  // 3. Construir retenciones
  const subtotal = Number((order as any).amount_untaxed);
  const iva      = Number((order as any).amount_tax);

  const retenciones: RetencionInput['docSustento']['retenciones'] = [];

  if (input.porcentajeRenta > 0) {
    retenciones.push({
      codigo: '1', codigoRetencion: input.codigoRenta,
      base: subtotal, porcentaje: input.porcentajeRenta,
      valor: Math.round(subtotal * input.porcentajeRenta / 100 * 100) / 100,
    });
  }

  if (input.porcentajeIva > 0 && iva > 0) {
    retenciones.push({
      codigo: '2', codigoRetencion: ivaRetencionCodigo(input.porcentajeIva),
      base: iva, porcentaje: input.porcentajeIva,
      valor: Math.round(iva * input.porcentajeIva / 100 * 100) / 100,
    });
  }

  if (retenciones.length === 0) throw new Error('Debe configurar al menos un porcentaje de retención > 0');

  // Impuestos del doc sustento (factura de compra)
  const impuestos: RetencionInput['docSustento']['impuestos'] = [];
  if (iva > 0) {
    const ivaRate = Number((order as any).amount_tax) / Number((order as any).amount_untaxed) * 100;
    const ivaRateRound = Math.round(ivaRate);
    let codigoPorcentaje = '4'; // 15%
    if (ivaRateRound <= 5) codigoPorcentaje = '5';
    else if (ivaRateRound === 0) codigoPorcentaje = '0';
    impuestos.push({ codigoPorcentaje, base: subtotal, tarifa: ivaRateRound, valor: iva });
  }

  // Número del doc sustento: 15 dígitos sin guiones
  const numDocSustento = ((order as any).invoice_ref || '001001000000001').replace(/\D/g, '').slice(0, 15).padStart(15, '0');

  const retencionInput: RetencionInput = {
    emisor, sujetoRetenido: {
      identificacion: (order as any).partner?.vat || '',
      razonSocial:    (order as any).partner?.name || 'PROVEEDOR',
    },
    fechaEmision,
    secuencial,
    periodoFiscal,
    docSustento: {
      codSustento:        '01',
      codDocSustento:     '01',
      numDocSustento,
      fechaEmision:       (order as any).invoice_date || (order as any).date_order,
      numAutDocSustento:  (order as any).invoice_auth || null,
      totalSinImpuestos:  subtotal,
      importeTotal:       Number((order as any).amount_total),
      impuestos,
      retenciones,
      formaPago:          '01',
    },
  };

  const doc = buildRetencionXml(retencionInput);

  // 4. Firmar
  const signRes  = await fetch('/api/sri/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ xml: doc.xml }) });
  const signJson = await signRes.json();
  if (!signRes.ok) throw new Error('Firma: ' + (signJson.error || 'falló'));
  const signedXml = signJson.signedXml;

  // 5. Enviar al SRI
  const sendRes  = await fetch('/api/sri/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ xml: signedXml, ambiente }) });
  const sendJson = await sendRes.json();

  const estado             = sendJson.estado  || 'ENVIADA';
  const numeroAutorizacion = sendJson.numeroAutorizacion || null;
  const mensajes           = sendJson.mensajes || [];

  // 6. Guardar en la compra
  await savePurchaseRetencion(input.purchaseId, {
    ret_secuencial:       secuencial,
    ret_numero:           doc.numero,
    ret_fecha:            fechaEmision,
    ret_periodo_fiscal:   periodoFiscal,
    ret_codigo_renta:     input.codigoRenta,
    ret_porcentaje_renta: input.porcentajeRenta,
    ret_base_renta:       subtotal,
    ret_valor_renta:      retenciones.find(r => r.codigo === '1')?.valor || 0,
    ret_porcentaje_iva:   input.porcentajeIva,
    ret_base_iva:         iva,
    ret_valor_iva:        retenciones.find(r => r.codigo === '2')?.valor || 0,
    ret_estado:           estado,
    ret_autorizacion:     numeroAutorizacion,
    ret_ambiente:         ambiente,
    ret_fecha_aut:        sendJson.fechaAutorizacion || null,
    ret_xml:              signedXml,
  });

  return { estado, numeroAutorizacion, mensajes, ambiente, claveAcceso: doc.claveAcceso, numero: doc.numero, signedXml };
}
