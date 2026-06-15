// src/lib/sri-docs-db.ts
// Emisión de NC / ND / Retención / Liquidación / Guía de remisión desde los
// datos del ERP: arma el XML → firma (/api/sri/sign) → envía (/api/sri/send)
// → devuelve el resultado y el XML firmado para descarga.
//
// EFECTOS INTERNOS: la NC autorizada reingresa inventario y reversa el
// asiento; la ND autorizada registra el asiento del recargo.

import { supabase } from './supabase';
import type { FacturaEmisor } from './sri-factura';
import {
  buildNotaCreditoXml, buildNotaDebitoXml, buildRetencionXml,
  buildLiquidacionXml, buildGuiaRemisionXml,
  ivaRetencionCodigo, type DocResult,
} from './sri-docs';
import { registerMove, getLocations } from './inventory';
import { createNotaCreditoEntry, createNotaDebitoEntry } from './erp-accounting';

/**
 * Fecha actual de ECUADOR (UTC-5). Nunca usar toISOString() directo para
 * fechas de emisión: después de las 19:00 hora Ecuador, la fecha UTC ya es
 * "mañana" y el SRI rechaza con error 65 (fecha mayor a la del servidor).
 */
function hoyEcuador(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Mañana en hora de Ecuador (para fechaFinTransporte de la guía) */
function mananaEcuador(): string {
  return new Date(Date.now() + (24 - 5) * 3600 * 1000).toISOString().slice(0, 10);
}

export interface SriDocSendResult {
  tipo: string;
  estado: string;
  numeroAutorizacion?: string | null;
  mensajes: string[];
  ambiente: number;
  claveAcceso: string;
  numero: string;
  signedXml?: string;
}

// ── Helpers compartidos ───────────────────────────────────────────────────────

async function getEmisor(companyId: number): Promise<{ emisor: FacturaEmisor; ambiente: 1 | 2 }> {
  const { data: company, error } = await supabase
    .from('res_company').select('*').eq('id', companyId).single();
  if (error) throw error;
  if (!company?.vat || !/^\d{13}$/.test(company.vat)) {
    throw new Error('El RUC de la empresa debe tener 13 dígitos.');
  }
  const ambiente: 1 | 2 = company.sri_ambiente === 2 ? 2 : 1;
  return {
    ambiente,
    emisor: {
      ruc: company.vat,
      razonSocial: company.name,
      nombreComercial: company.name,
      dirMatriz: company.sri_dir_matriz || 'S/D',
      dirEstablecimiento: company.sri_dir_estab || company.sri_dir_matriz || null,
      estab: company.sri_estab || '001',
      ptoEmi: company.sri_pto_emi || '001',
      ambiente,
      obligadoContabilidad: company.sri_obligado_contab !== false,
      contribuyenteEspecial: company.sri_contrib_especial || null,
      agenteRetencion: company.sri_agente_retencion || null,
      contribuyenteRimpe: company.sri_rimpe || null,
    },
  };
}

async function signAndSend(doc: DocResult, ambiente: number, tipo: string): Promise<SriDocSendResult> {
  const signRes = await fetch('/api/sri/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xml: doc.xml }),
  });
  const signJson = await signRes.json();
  if (!signRes.ok) throw new Error('Firma: ' + (signJson.error || 'falló'));

  const sendRes = await fetch('/api/sri/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXml: signJson.signedXml, claveAcceso: doc.claveAcceso, ambiente }),
  });
  const sendJson = await sendRes.json();
  if (!sendRes.ok) throw new Error('Envío: ' + (sendJson.error || 'falló'));

  return {
    tipo,
    estado: sendJson.estado,
    numeroAutorizacion: sendJson.numeroAutorizacion || null,
    mensajes: sendJson.mensajes || [],
    ambiente,
    claveAcceso: doc.claveAcceso,
    numero: doc.numero,
    signedXml: signJson.signedXml,
  };
}

export function downloadXmlFile(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── NOTA DE CRÉDITO por una venta (reverso total) ─────────────────────────────

export async function emitNotaCreditoForSale(saleId: number, motivo = 'DEVOLUCION DE MERCADERIA'): Promise<SriDocSendResult> {
  const { data: sale, error } = await supabase
    .from('sale_order')
    .select(`
      id, name, date_order, invoice_ref, company_id, state, partner_id,
      amount_untaxed, amount_tax, amount_total, cost_total, nc_clave_acceso,
      partner:res_partner(name, vat),
      lines:sale_order_line(quantity, price_unit, iva_rate, cost_unit, product:product_product(id, code, template:product_template(name)))
    `)
    .eq('id', saleId)
    .single();
  if (error) throw error;
  if (!sale.invoice_ref) throw new Error('La venta no tiene número de factura; emite primero la factura.');
  if (sale.nc_clave_acceso) throw new Error('Esta venta ya tiene una nota de crédito aplicada (reverso total único).');

  const { emisor, ambiente } = await getEmisor(sale.company_id);

  const doc = buildNotaCreditoXml({
    emisor,
    comprador: {
      identificacion: (sale as any).partner?.vat || '',
      razonSocial: (sale as any).partner?.name || 'CONSUMIDOR FINAL',
    },
    fechaEmision: hoyEcuador(),
    secuencial: sale.id,
    docModificado: { codDoc: '01', numero: sale.invoice_ref, fechaEmision: sale.date_order },
    motivo,
    lineas: ((sale as any).lines || []).map((l: any) => ({
      codigo: l.product?.code || `PROD-${l.product?.id || 0}`,
      descripcion: l.product?.template?.name || 'Producto',
      cantidad: Number(l.quantity),
      precioUnitario: Number(l.price_unit),
      descuento: 0,
      ivaRate: Number(l.iva_rate),
    })),
  });

  const result = await signAndSend(doc, ambiente, 'NOTA DE CRÉDITO');

  // ── EFECTOS INTERNOS, solo si el SRI AUTORIZÓ ──
  // 1. Reingreso del inventario al costo unitario con que salió (cost_unit):
  //    así el promedio ponderado se reconstruye sin distorsión.
  // 2. Asiento de reverso completo (ventas, IVA, clientes, costo, inventario).
  if (result.estado === 'AUTORIZADO') {
    try {
      const locs = await getLocations();
      const internal = locs.find((l: any) => l.usage === 'internal');
      const customer = locs.find((l: any) => l.usage === 'customer') || locs.find((l: any) => l.usage === 'inventory');
      if (!internal || !customer) throw new Error('Faltan ubicaciones de inventario');

      const hoy = hoyEcuador();
      for (const l of (sale as any).lines || []) {
        if (!l.product?.id) continue;
        await registerMove({
          company_id: sale.company_id,
          product_id: l.product.id,
          move_type: 'in',
          quantity: Number(l.quantity),
          unit_cost: Number(l.cost_unit) || 0,
          date: hoy,
          reference: `NC-${saleId}`,
          location_internal_id: internal.id,
          location_virtual_id: customer.id,
        });
      }

      const moveId = await createNotaCreditoEntry({
        company_id: sale.company_id,
        partner_id: sale.partner_id,
        date: hoy,
        nc_numero: result.numero,
        sale_name: sale.name,
        amount_untaxed: Number(sale.amount_untaxed),
        amount_tax: Number(sale.amount_tax),
        amount_total: Number(sale.amount_total),
        cost_total: Number(sale.cost_total || 0),
      });

      await supabase.from('sale_order').update({
        nc_clave_acceso: result.claveAcceso,
        nc_account_move_id: moveId,
      }).eq('id', saleId);
    } catch (e: any) {
      throw new Error(`NC AUTORIZADA por el SRI, pero los efectos internos fallaron: ${e.message}. Registra inventario y asiento manualmente.`);
    }
  }

  return result;
}

// ── NOTA DE DÉBITO por una venta (recargo) ────────────────────────────────────

export async function emitNotaDebitoForSale(saleId: number, razon: string, valor: number): Promise<SriDocSendResult> {
  const { data: sale, error } = await supabase
    .from('sale_order')
    .select(`id, date_order, invoice_ref, company_id, partner_id, partner:res_partner(name, vat)`)
    .eq('id', saleId)
    .single();
  if (error) throw error;
  if (!sale.invoice_ref) throw new Error('La venta no tiene número de factura; emite primero la factura.');

  const { emisor, ambiente } = await getEmisor(sale.company_id);

  const doc = buildNotaDebitoXml({
    emisor,
    comprador: {
      identificacion: (sale as any).partner?.vat || '',
      razonSocial: (sale as any).partner?.name || 'CONSUMIDOR FINAL',
    },
    fechaEmision: hoyEcuador(),
    secuencial: sale.id,
    docModificado: { codDoc: '01', numero: sale.invoice_ref, fechaEmision: sale.date_order },
    motivos: [{ razon, valor }],
    ivaRate: 15,
  });

  const result = await signAndSend(doc, ambiente, 'NOTA DE DÉBITO');

  // ── EFECTO INTERNO, solo si el SRI AUTORIZÓ ──
  // Asiento: Clientes (debe) contra Otros Ingresos + IVA débito (haber).
  if (result.estado === 'AUTORIZADO') {
    try {
      const base = Math.round(valor * 100) / 100;
      const iva = Math.round(base * 15) / 100;
      await createNotaDebitoEntry({
        company_id: sale.company_id,
        partner_id: sale.partner_id,
        date: hoyEcuador(),
        nd_numero: result.numero,
        razon,
        base,
        iva,
      });
    } catch (e: any) {
      throw new Error(`ND AUTORIZADA por el SRI, pero el asiento falló: ${e.message}. Regístralo manualmente.`);
    }
  }

  return result;
}

// ── COMPROBANTE DE RETENCIÓN desde el módulo de retenciones ──────────────────

export async function emitRetencionElectronica(withholdId: number): Promise<SriDocSendResult> {
  const { data: wh, error } = await supabase
    .from('l10n_ec_withhold')
    .select(`*, partner:res_partner(name, vat), lines:l10n_ec_withhold_line(*)`)
    .eq('id', withholdId)
    .single();
  if (error) throw error;
  if (wh.state !== 'posted') throw new Error('La retención debe estar emitida (posted) para enviarla al SRI.');

  const { emisor, ambiente } = await getEmisor(wh.company_id);

  const baseIva = Number(wh.base_iva) || 0;
  const baseRenta = Number(wh.base_renta) || 0;
  const base = baseRenta || baseIva;
  const iva = Math.round(baseIva * 15) / 100;

  // numDocSustento: factura del proveedor sin guiones (15 dígitos)
  const numDoc = (wh.invoice_ref || '').replace(/\D/g, '');
  if (numDoc.length !== 15) {
    throw new Error(`El número de factura sustento (${wh.invoice_ref || 'vacío'}) debe tener formato 001-001-000000001.`);
  }

  const retenciones = (wh.lines || []).map((l: any) => {
    if (l.tax_type === 'rent') {
      return {
        codigo: '1' as const,
        codigoRetencion: l.rule_code || '312',
        base: Number(l.base), porcentaje: Number(l.percent), valor: Number(l.amount),
      };
    }
    return {
      codigo: '2' as const,
      codigoRetencion: ivaRetencionCodigo(Number(l.percent)),
      base: Number(l.base), porcentaje: Number(l.percent), valor: Number(l.amount),
    };
  });
  if (retenciones.length === 0) throw new Error('La retención no tiene líneas.');

  const fecha = wh.date;
  const [y, m] = fecha.slice(0, 10).split('-');

  const doc = buildRetencionXml({
    emisor,
    sujetoRetenido: {
      identificacion: (wh as any).partner?.vat || '',
      razonSocial: (wh as any).partner?.name || 'PROVEEDOR',
    },
    fechaEmision: fecha,
    secuencial: wh.id,
    periodoFiscal: `${m}/${y}`,
    docSustento: {
      codSustento: '01',
      codDocSustento: '01',
      numDocSustento: numDoc,
      fechaEmision: wh.invoice_date || fecha,
      totalSinImpuestos: base,
      importeTotal: Math.round((base + iva) * 100) / 100,
      impuestos: baseIva > 0
        ? [{ codigoPorcentaje: '4', base: baseIva, tarifa: 15, valor: iva }]
        : [{ codigoPorcentaje: '0', base, tarifa: 0, valor: 0 }],
      retenciones,
    },
  });

  const result = await signAndSend(doc, ambiente, 'RETENCIÓN');

  // Persistir el estado en la retención
  await supabase.from('l10n_ec_withhold').update({
    sri_estado: result.estado,
    sri_clave_acceso: result.claveAcceso,
    sri_mensajes: result.mensajes.join('\n') || null,
  }).eq('id', withholdId);

  return result;
}

// ── LIQUIDACIÓN DE COMPRA desde una orden de compra ──────────────────────────

export async function emitLiquidacionForPurchase(purchaseId: number): Promise<SriDocSendResult> {
  const { data: po, error } = await supabase
    .from('purchase_order')
    .select(`
      id, date_order, company_id,
      partner:res_partner(name, vat, city),
      lines:purchase_order_line(quantity, price_unit, iva_rate, product:product_product(id, code, template:product_template(name)))
    `)
    .eq('id', purchaseId)
    .single();
  if (error) throw error;

  const { emisor, ambiente } = await getEmisor(po.company_id);

  const doc = buildLiquidacionXml({
    emisor,
    proveedor: {
      identificacion: (po as any).partner?.vat || '',
      razonSocial: (po as any).partner?.name || 'PROVEEDOR',
      direccion: (po as any).partner?.city || null,
    },
    fechaEmision: hoyEcuador(),
    secuencial: po.id,
    lineas: ((po as any).lines || []).map((l: any) => ({
      codigo: l.product?.code || `PROD-${l.product?.id || 0}`,
      descripcion: l.product?.template?.name || 'Producto',
      cantidad: Number(l.quantity),
      precioUnitario: Number(l.price_unit),
      descuento: 0,
      ivaRate: Number(l.iva_rate),
    })),
  });

  return signAndSend(doc, ambiente, 'LIQUIDACIÓN DE COMPRA');
}

// ── GUÍA DE REMISIÓN desde una venta entregada ───────────────────────────────

export async function emitGuiaRemisionForSale(
  saleId: number,
  transportista: { identificacion: string; razonSocial: string; placa: string },
  dirDestinatario: string,
): Promise<SriDocSendResult> {
  const { data: sale, error } = await supabase
    .from('sale_order')
    .select(`
      id, date_order, invoice_ref, invoice_auth, company_id,
      partner:res_partner(name, vat, city),
      lines:sale_order_line(quantity, product:product_product(id, code, template:product_template(name)))
    `)
    .eq('id', saleId)
    .single();
  if (error) throw error;

  const { emisor, ambiente } = await getEmisor(sale.company_id);
  const hoy = hoyEcuador();
  const fin = mananaEcuador();

  const doc = buildGuiaRemisionXml({
    emisor,
    fechaEmision: hoy,
    secuencial: sale.id,
    dirPartida: emisor.dirEstablecimiento || emisor.dirMatriz,
    transportista,
    fechaIniTransporte: hoy,
    fechaFinTransporte: fin,
    destinatario: {
      identificacion: (sale as any).partner?.vat || '',
      razonSocial: (sale as any).partner?.name || 'CONSUMIDOR FINAL',
      direccion: dirDestinatario || (sale as any).partner?.city || 'S/D',
      motivoTraslado: 'VENTA',
      docSustento: sale.invoice_ref ? {
        codDoc: '01',
        numero: sale.invoice_ref,
        numAut: sale.invoice_auth && /^\d{49}$/.test(sale.invoice_auth) ? sale.invoice_auth : null,
        fechaEmision: sale.date_order,
      } : null,
    },
    lineas: ((sale as any).lines || []).map((l: any) => ({
      codigo: l.product?.code,
      descripcion: l.product?.template?.name || 'Producto',
      cantidad: Number(l.quantity),
    })),
  });

  return signAndSend(doc, ambiente, 'GUÍA DE REMISIÓN');
}
