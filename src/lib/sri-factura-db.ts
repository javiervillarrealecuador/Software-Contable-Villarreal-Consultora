// src/lib/sri-factura-db.ts
// Conecta el generador puro (sri-factura.ts) con la base de datos:
// arma FacturaInput desde una venta y guarda la clave de acceso generada.

import { supabase } from './supabase';
import { buildFacturaXml, type FacturaInput, type FacturaResult } from './sri-factura';
import type { RideFacturaInput } from './sri-ride';

export async function generateFacturaForSale(saleId: number): Promise<FacturaResult> {
  // 1. Venta con cliente y lineas (incluye nombre de producto)
  const { data: sale, error } = await supabase
    .from('sale_order')
    .select(''
      + 'id, name, date_order, invoice_ref, invoice_auth, state, company_id, forma_pago,'
      + 'partner:res_partner(id, name, vat, city),'
      + 'lines:sale_order_line('
      +   'quantity, price_unit, iva_rate,'
      +   'product:product_product(id, code, template:product_template(name))'
      + ')'
    )
    .eq('id', saleId)
    .single();
  if (error) throw error;
  const saleAny = sale as any;
  if (!saleAny) throw new Error('Venta no encontrada');
  if (saleAny.state === 'cancel') throw new Error('No se factura una venta anulada');

  // 2. Configuracion del emisor (migracion 016)
  const { data: company, error: cErr } = await supabase
    .from('res_company')
    .select('*')
    .eq('id', saleAny.company_id)
    .single();
  if (cErr) throw cErr;
  if (!company?.vat || !/^\d{13}$/.test(company.vat)) {
    throw new Error('El RUC de la empresa (' + (company?.vat || 'vacio') + ') debe tener 13 digitos para facturar electronicamente.');
  }

  // 3. Secuencial: tomar del invoice_ref si existe (001-001-000000001);
  //    si no, usar el id de la venta como secuencial.
  const refParts = (saleAny.invoice_ref || '').split('-');
  const secuencial = refParts.length === 3 ? (parseInt(refParts[2]) || saleAny.id) : saleAny.id;

  const input: FacturaInput = {
    emisor: {
      ruc: company.vat,
      razonSocial: company.name,
      nombreComercial: company.name,
      dirMatriz: company.sri_dir_matriz || 'S/D',
      dirEstablecimiento: company.sri_dir_estab || company.sri_dir_matriz || null,
      estab: refParts[0] || company.sri_estab || '001',
      ptoEmi: refParts[1] || company.sri_pto_emi || '001',
      ambiente: (company.sri_ambiente === 2 ? 2 : 1),
      obligadoContabilidad: company.sri_obligado_contab !== false,
      contribuyenteEspecial: company.sri_contrib_especial || null,
      agenteRetencion: company.sri_agente_retencion || null,
      contribuyenteRimpe: company.sri_rimpe || null,
    },
    comprador: {
      identificacion: saleAny.partner?.vat || '',
      razonSocial: saleAny.partner?.name || 'CONSUMIDOR FINAL',
      direccion: saleAny.partner?.city || null,
    },
    fechaEmision: saleAny.date_order,
    secuencial,
    lineas: (saleAny.lines || []).map((l: any) => ({
      codigo: l.product?.code || ('PROD-' + (l.product?.id || 0)),
      descripcion: l.product?.template?.name || 'Producto',
      cantidad: Number(l.quantity),
      precioUnitario: Number(l.price_unit),
      descuento: 0,
      ivaRate: Number(l.iva_rate),
    })),
    formaPago: saleAny.forma_pago || '01',
  };

  const result = buildFacturaXml(input);

  // 4. Persistir clave de acceso y numero si la venta no los tenia.
  const updates: any = {};
  if (!saleAny.invoice_auth) updates.invoice_auth = result.claveAcceso;
  if (!saleAny.invoice_ref) updates.invoice_ref = result.numeroFactura;
  if (Object.keys(updates).length > 0) {
    await supabase.from('sale_order').update(updates).eq('id', saleId);
  }

  return result;
}

// -- FASE 3: envio al SRI (firma + recepcion + autorizacion + persistencia) --

export interface SriSendResult {
  estado: string;
  numeroAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  mensajes: string[];
  ambiente: number;
  claveAcceso: string;
}

export async function sendSaleToSri(saleId: number): Promise<SriSendResult> {
  // 1. Generar XML y clave de acceso
  const factura = await generateFacturaForSale(saleId);

  // 2. Ambiente desde la configuracion de la empresa (1=pruebas por defecto)
  const { data: sale } = await supabase
    .from('sale_order').select('company_id').eq('id', saleId).single();
  const { data: company } = await supabase
    .from('res_company').select('sri_ambiente').eq('id', sale?.company_id).single();
  const ambiente = company?.sri_ambiente === 2 ? 2 : 1;

  // 3. Firmar en el servidor
  const signRes = await fetch('/api/sri/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xml: factura.xml }),
  });
  const signJson = await signRes.json();
  if (!signRes.ok) throw new Error('Firma: ' + (signJson.error || 'fallo'));

  // 4. Enviar al SRI (recepcion + autorizacion)
  const sendRes = await fetch('/api/sri/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXml: signJson.signedXml, claveAcceso: factura.claveAcceso, ambiente }),
  });
  const sendJson = await sendRes.json();
  if (!sendRes.ok) throw new Error('Envio: ' + (sendJson.error || 'fallo'));

  // 5. Persistir el resultado en la venta
  const updates: any = {
    sri_estado: sendJson.estado || null,
    sri_ambiente: ambiente,
    sri_mensajes: (sendJson.mensajes || []).join('\n') || null,
  };
  if (sendJson.numeroAutorizacion) updates.sri_autorizacion = sendJson.numeroAutorizacion;
  if (sendJson.fechaAutorizacion) {
    const d = new Date(sendJson.fechaAutorizacion);
    if (!isNaN(d.getTime())) updates.sri_fecha_aut = d.toISOString();
  }
  await supabase.from('sale_order').update(updates).eq('id', saleId);

  return { ...sendJson, claveAcceso: factura.claveAcceso };
}

// -- RIDE: arma el input para buildRideFactura desde una venta --

export async function getRideInputForSale(saleId: number): Promise<RideFacturaInput> {
  const { data: sale, error } = await supabase
    .from('sale_order')
    .select(''
      + 'id, name, date_order, invoice_ref, invoice_auth, state, company_id, forma_pago,'
      + 'amount_untaxed, amount_tax, amount_total,'
      + 'sri_ambiente, sri_autorizacion, sri_fecha_aut,'
      + 'partner:res_partner(id, name, vat, city),'
      + 'lines:sale_order_line('
      +   'quantity, price_unit, iva_rate, price_subtotal,'
      +   'product:product_product(id, code, template:product_template(name))'
      + ')'
    )
    .eq('id', saleId)
    .single();
  if (error) throw error;
  if (!sale) throw new Error('Venta no encontrada');

  const { data: company } = await supabase
    .from('res_company').select('*').eq('id', (sale as any).company_id).single();

  // Calcular subtotales por tarifa IVA desde las lineas
  let subtotal15 = 0, subtotal5 = 0, subtotal0 = 0;
  const lineas: RideFacturaInput['lineas'] = [];
  for (const l of ((sale as any).lines || []) as any[]) {
    const sub = Number(l.price_subtotal) || Number(l.quantity) * Number(l.price_unit);
    const rate = Number(l.iva_rate);
    if (rate >= 15) subtotal15 += sub;
    else if (rate === 5) subtotal5 += sub;
    else subtotal0 += sub;
    lineas.push({
      codigo: l.product?.code || ('P' + (l.product?.id || 0)),
      descripcion: l.product?.template?.name || 'Producto',
      cantidad: Number(l.quantity),
      precioUnitario: Number(l.price_unit),
      descuento: 0,
      subtotal: sub,
    });
  }

  const ambiente: 1 | 2 = (sale as any).sri_ambiente === 2 ? 2 : (company?.sri_ambiente === 2 ? 2 : 1);
  // Clave de acceso: se guarda como invoice_auth al generar el XML
  const claveAcceso = ((sale as any).invoice_auth || '').replace(/\D/g, '') || '0'.repeat(49);

  // Fecha dd/mm/aaaa para el RIDE
  const dateParts = ((sale as any).date_order || '').slice(0, 10).split('-');
  const fechaEmision = (dateParts[2] || '01') + '/' + (dateParts[1] || '01') + '/' + (dateParts[0] || '2025');

  return {
    emisor: {
      razonSocial: company?.name || '',
      ruc: company?.vat || '',
      dirMatriz: company?.sri_dir_matriz || 'S/D',
      dirEstablecimiento: company?.sri_dir_estab || null,
      obligadoContabilidad: company?.sri_obligado_contab !== false,
      contribuyenteRimpe: company?.sri_rimpe || null,
      agenteRetencion: company?.sri_agente_retencion || null,
    },
    comprobante: {
      tipo: 'FACTURA',
      numero: (sale as any).invoice_ref || (sale as any).name || '',
      claveAcceso: claveAcceso.padEnd(49, '0').slice(0, 49),
      fechaEmision,
      ambiente,
      fechaAutorizacion: (sale as any).sri_fecha_aut
        ? new Date((sale as any).sri_fecha_aut)
            .toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null,
    },
    comprador: {
      razonSocial: (sale as any).partner?.name || 'CONSUMIDOR FINAL',
      identificacion: (sale as any).partner?.vat || '',
      direccion: (sale as any).partner?.city || null,
    },
    lineas,
    subtotal15: Math.round(subtotal15 * 100) / 100,
    subtotal5: Math.round(subtotal5 * 100) / 100,
    subtotal0: Math.round(subtotal0 * 100) / 100,
    descuento: 0,
    iva: Number((sale as any).amount_tax) || 0,
    total: Number((sale as any).amount_total) || 0,
    formaPago: getFormaPagoLabel((sale as any).forma_pago || '01'),
  };
}

function getFormaPagoLabel(code: string): string {
  const map: Record<string, string> = {
    '01': 'SIN SISTEMA FINANCIERO',
    '15': 'COMPENSACION DE DEUDAS',
    '16': 'TARJETA DE DEBITO',
    '17': 'DINERO ELECTRONICO',
    '18': 'TARJETA PREPAGO',
    '19': 'TARJETA DE CREDITO',
    '20': 'OTROS CON SISTEMA FINANCIERO',
    '21': 'ENDOSO DE TITULOS',
  };
  return map[code] || 'SIN SISTEMA FINANCIERO';
}

/** Descarga el XML en el navegador */
export function downloadFacturaXml(result: FacturaResult) {
  const blob = new Blob([result.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FAC_' + result.numeroFactura + '_' + result.claveAcceso.slice(0, 8) + '.xml';
  a.click();
  URL.revokeObjectURL(url);
}
