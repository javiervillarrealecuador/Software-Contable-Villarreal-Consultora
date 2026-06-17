// src/app/api/sri/email/route.ts
// Envío del comprobante electrónico por correo al cliente.
//
// POR QUÉ servidor y no cliente:
//   Las credenciales SMTP (usuario + contraseña) NO pueden exponerse al
//   navegador. Por eso la lógica de nodemailer vive en un Route Handler
//   de Next.js (servidor), no en código 'use client'.
//
// CONFIGURACIÓN (variables de entorno .env.local):
//   SMTP_HOST       p.ej. smtp.gmail.com
//   SMTP_PORT       587 (STARTTLS) o 465 (SSL)
//   SMTP_SECURE     "true" para puerto 465, "false" para 587
//   SMTP_USER       correo del remitente
//   SMTP_PASS       contraseña de aplicación (Gmail → Configuración → Contraseñas de app)
//   SMTP_FROM       nombre y correo: "ERP Ecuador <correo@empresa.com>"

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase servidor (usa service role si está disponible, o anon key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── Plantilla HTML del comprobante ────────────────────────────────────────────
//
// Genera un HTML que replica visualmente el RIDE estándar del SRI.
// Se envía en el cuerpo del correo (inline) para que el cliente lo vea
// sin necesidad de abrir adjuntos.
//
// ESTRUCTURA del RIDE (Ficha Técnica SRI):
//   Cabecera: emisor (izquierda) + comprobante / clave acceso (derecha)
//   Datos del comprador
//   Detalle de líneas
//   Totales + forma de pago
//   Pie: leyenda de ambiente

function buildRideHtml(data: RideEmailData): string {
  const f2 = (n: number) => `$ ${n.toFixed(2)}`;
  const lineas = data.lineas.map(l => `
    <tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0">${l.codigo}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0">${l.descripcion}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">${l.cantidad.toFixed(2)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">${l.precioUnitario.toFixed(4)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">${l.descuento.toFixed(2)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${l.subtotal.toFixed(2)}</td>
    </tr>`).join('');

  const ambLabel = data.ambiente === 2 ? 'PRODUCCIÓN' : 'PRUEBAS';
  const ambColor = data.ambiente === 2 ? '#166534' : '#854d0e';
  const ambBg    = data.ambiente === 2 ? '#dcfce7'  : '#fef9c3';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprobante Electrónico</title></head>
<body style="margin:0;padding:16px;background:#f8fafc;font-family:Arial,sans-serif;font-size:13px;color:#1e293b">
<div style="max-width:700px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">

  <!-- CABECERA -->
  <div style="display:flex;padding:16px;border-bottom:1px solid #e2e8f0;gap:16px">
    <!-- Emisor -->
    <div style="flex:1">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${data.razonSocial}</div>
      <div>RUC: <strong>${data.ruc}</strong></div>
      <div style="margin-top:2px;font-size:11px;color:#475569">${data.dirMatriz}</div>
      ${data.dirEstab && data.dirEstab !== data.dirMatriz ? `<div style="font-size:11px;color:#475569">Sucursal: ${data.dirEstab}</div>` : ''}
      <div style="font-size:11px;margin-top:2px">Obligado a llevar contabilidad: <strong>${data.obligadoContab ? 'SÍ' : 'NO'}</strong></div>
      ${data.rimpe ? `<div style="font-size:11px;color:#0369a1">${data.rimpe}</div>` : ''}
      ${data.agenteRet ? `<div style="font-size:11px">Agente Ret. Res. ${data.agenteRet}</div>` : ''}
    </div>
    <!-- Comprobante -->
    <div style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:12px;background:#f8fafc">
      <div style="font-weight:700;font-size:13px;text-transform:uppercase">FACTURA</div>
      <div style="font-weight:600;margin:4px 0">Nº ${data.numeroFactura}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px">NÚMERO DE AUTORIZACIÓN:</div>
      <div style="font-size:9px;word-break:break-all;font-family:monospace;color:#1e293b">${data.claveAcceso}</div>
      <div style="margin-top:6px;font-size:11px">Fecha emisión: <strong>${data.fechaEmision}</strong></div>
      <div style="margin-top:2px">
        <span style="font-size:11px;padding:2px 8px;border-radius:12px;font-weight:600;background:${ambBg};color:${ambColor}">${ambLabel}</span>
      </div>
      ${data.fechaAutorizacion ? `<div style="font-size:10px;margin-top:4px;color:#64748b">Autorizado: ${data.fechaAutorizacion}</div>` : ''}
    </div>
  </div>

  <!-- COMPRADOR -->
  <div style="padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
    <span style="font-weight:600">Razón Social / Nombres:</span> ${data.compradorNombre} &nbsp;|&nbsp;
    <span style="font-weight:600">Identificación:</span> ${data.compradorId}
    ${data.compradorDir ? ` &nbsp;|&nbsp; <span style="font-weight:600">Dirección:</span> ${data.compradorDir}` : ''}
  </div>

  <!-- DETALLE -->
  <div style="padding:0 16px">
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <thead>
        <tr style="background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569">
          <th style="padding:6px;text-align:left">Código</th>
          <th style="padding:6px;text-align:left">Descripción</th>
          <th style="padding:6px;text-align:right">Cant.</th>
          <th style="padding:6px;text-align:right">P. Unit.</th>
          <th style="padding:6px;text-align:right">Dscto.</th>
          <th style="padding:6px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${lineas}</tbody>
    </table>
  </div>

  <!-- TOTALES -->
  <div style="padding:8px 16px 16px;display:flex;justify-content:flex-end">
    <table style="border-collapse:collapse;min-width:280px">
      ${data.subtotal15 > 0 ? `<tr><td style="padding:3px 8px">Subtotal 15%</td><td style="padding:3px 8px;text-align:right;font-family:monospace">${f2(data.subtotal15)}</td></tr>` : ''}
      ${data.subtotal5 > 0  ? `<tr><td style="padding:3px 8px">Subtotal 5%</td><td style="padding:3px 8px;text-align:right;font-family:monospace">${f2(data.subtotal5)}</td></tr>` : ''}
      ${data.subtotal0 > 0  ? `<tr><td style="padding:3px 8px">Subtotal 0%</td><td style="padding:3px 8px;text-align:right;font-family:monospace">${f2(data.subtotal0)}</td></tr>` : ''}
      <tr><td style="padding:3px 8px">IVA</td><td style="padding:3px 8px;text-align:right;font-family:monospace">${f2(data.iva)}</td></tr>
      <tr style="background:#1e293b;color:white;font-weight:700">
        <td style="padding:5px 8px;border-radius:4px 0 0 4px">VALOR TOTAL</td>
        <td style="padding:5px 8px;text-align:right;font-family:monospace;border-radius:0 4px 4px 0">${f2(data.total)}</td>
      </tr>
    </table>
  </div>

  <!-- FORMA DE PAGO -->
  <div style="padding:8px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569">
    Forma de pago: <strong>${data.formaPago}</strong>
  </div>

  <!-- PIE -->
  <div style="background:#f1f5f9;padding:10px 16px;font-size:10px;text-align:center;color:#64748b;border-top:1px solid #e2e8f0">
    ${data.ambiente === 1
      ? 'DOCUMENTO EMITIDO EN AMBIENTE DE PRUEBAS – SIN VALIDEZ TRIBUTARIA'
      : 'Comprobante electrónico autorizado por el SRI – Ecuador'}
    <br>Generado por ERP Ecuador
  </div>
</div>
</body></html>`;
}

interface RideEmailData {
  razonSocial: string;
  ruc: string;
  dirMatriz: string;
  dirEstab: string | null;
  obligadoContab: boolean;
  rimpe: string | null;
  agenteRet: string | null;
  numeroFactura: string;
  claveAcceso: string;
  fechaEmision: string;
  ambiente: 1 | 2;
  fechaAutorizacion: string | null;
  compradorNombre: string;
  compradorId: string;
  compradorDir: string | null;
  lineas: { codigo: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; subtotal: number }[];
  subtotal15: number;
  subtotal5: number;
  subtotal0: number;
  iva: number;
  total: number;
  formaPago: string;
}

// ── POST /api/sri/email ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { saleId, emailTo } = await request.json();
    if (!saleId) return NextResponse.json({ error: 'Falta saleId' }, { status: 400 });

    // 1. Leer venta + empresa + partner
    const { data: sale, error: sErr } = await supabase
      .from('sale_order')
      .select(`
        id, name, date_order, invoice_ref, invoice_auth, state, company_id,
        amount_untaxed, amount_tax, amount_total, sri_ambiente, sri_autorizacion, sri_fecha_aut,
        partner:res_partner!sale_order_partner_id_fkey(id, name, vat, city, email),
        lines:sale_order_line(
          quantity, price_unit, iva_rate, price_subtotal,
          product:product_product(id, code, template:product_template(name))
        )
      `)
      .eq('id', saleId)
      .single();
    if (sErr) throw sErr;
    if (!sale) throw new Error('Venta no encontrada');

    const { data: company } = await supabase
      .from('res_company').select('*').eq('id', (sale as any).company_id).single();

    // 2. Determinar correo destinatario
    const destino = emailTo || (sale as any).partner?.email || '';
    if (!destino) {
      return NextResponse.json(
        { error: 'El cliente no tiene correo registrado. Ingrese el correo manualmente.' },
        { status: 422 }
      );
    }

    // 3. Construir datos del RIDE para el HTML
    let subtotal15 = 0, subtotal5 = 0, subtotal0 = 0;
    const lineas: RideEmailData['lineas'] = [];
    for (const l of ((sale as any).lines || []) as any[]) {
      const sub = Number(l.price_subtotal) || Number(l.quantity) * Number(l.price_unit);
      const rate = Number(l.iva_rate);
      if (rate >= 15) subtotal15 += sub; else if (rate === 5) subtotal5 += sub; else subtotal0 += sub;
      lineas.push({
        codigo: l.product?.code || `P${l.product?.id || 0}`,
        descripcion: l.product?.template?.name || 'Producto',
        cantidad: Number(l.quantity),
        precioUnitario: Number(l.price_unit),
        descuento: 0,
        subtotal: sub,
      });
    }

    const ambiente: 1 | 2 = (sale as any).sri_ambiente === 2 ? 2 : (company?.sri_ambiente === 2 ? 2 : 1);
    const claveAcceso = ((sale as any).invoice_auth || '').replace(/\D/g, '') || '0'.repeat(49);
    const [y, m, d] = ((sale as any).date_order || '').slice(0, 10).split('-');
    const fechaEmision = `${d || '01'}/${m || '01'}/${y || '2025'}`;

    const rideData: RideEmailData = {
      razonSocial: company?.name || '',
      ruc: company?.vat || '',
      dirMatriz: company?.sri_dir_matriz || 'S/D',
      dirEstab: company?.sri_dir_estab || null,
      obligadoContab: company?.sri_obligado_contab !== false,
      rimpe: company?.sri_rimpe || null,
      agenteRet: company?.sri_agente_retencion || null,
      numeroFactura: (sale as any).invoice_ref || (sale as any).name || '',
      claveAcceso: claveAcceso.padEnd(49, '0').slice(0, 49),
      fechaEmision,
      ambiente,
      fechaAutorizacion: (sale as any).sri_fecha_aut
        ? new Date((sale as any).sri_fecha_aut).toLocaleDateString('es-EC')
        : null,
      compradorNombre: (sale as any).partner?.name || 'CONSUMIDOR FINAL',
      compradorId: (sale as any).partner?.vat || '',
      compradorDir: (sale as any).partner?.city || null,
      lineas,
      subtotal15: Math.round(subtotal15 * 100) / 100,
      subtotal5: Math.round(subtotal5 * 100) / 100,
      subtotal0: Math.round(subtotal0 * 100) / 100,
      iva: Number((sale as any).amount_tax) || 0,
      total: Number((sale as any).amount_total) || 0,
      formaPago: 'Efectivo / Transferencia bancaria',
    };

    const html = buildRideHtml(rideData);

    // 4. Configurar transporte SMTP desde variables de entorno
    // Las variables se definen en .env.local (nunca en el código fuente).
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpSecure = process.env.SMTP_SECURE === 'true';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'ERP Ecuador <no-reply@empresa.com>';

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: 'SMTP no configurado. Defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env.local' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 5. Enviar
    const asunto = ambiente === 1
      ? `[PRUEBAS] Factura ${rideData.numeroFactura} - ${rideData.razonSocial}`
      : `Factura electrónica ${rideData.numeroFactura} - ${rideData.razonSocial}`;

    const textPlano = [
      `FACTURA ELECTRÓNICA - ${rideData.razonSocial}`,
      `RUC: ${rideData.ruc}`,
      `Número: ${rideData.numeroFactura}`,
      `Fecha: ${rideData.fechaEmision}`,
      `Cliente: ${rideData.compradorNombre} (${rideData.compradorId})`,
      ``,
      `Total: $${rideData.total.toFixed(2)}`,
      `Autorización: ${rideData.claveAcceso}`,
      ambiente === 1 ? `\nDOCUMENTO DE PRUEBAS – SIN VALIDEZ TRIBUTARIA` : '',
    ].join('\n');

    await transporter.sendMail({
      from: smtpFrom,
      to: destino,
      subject: asunto,
      text: textPlano,
      html,
    });

    return NextResponse.json({ ok: true, sentTo: destino });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error enviando correo' }, { status: 500 });
  }
}
