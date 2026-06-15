// src/app/api/sri/sign/route.ts
// FASE 2 — Endpoint de firma. Recibe el XML sin firmar y devuelve el XML
// firmado XAdES-BES. Corre en el servidor: el .p12 y su contraseña nunca
// llegan al navegador.
//
// MULTIEMPRESA: si se envía company_id, carga el certificado almacenado en
// res_company.sri_p12_b64 / sri_p12_pwd. Sin company_id, fallback a .env.local.

import { NextResponse } from 'next/server';
import { signXml } from '@/lib/sri-firma';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { xml, company_id } = body as { xml: string; company_id?: number };

    if (!xml || typeof xml !== 'string') {
      return NextResponse.json({ error: 'Falta el XML a firmar' }, { status: 400 });
    }

    let p12Override: { p12B64: string; pwd: string } | undefined;

    if (company_id) {
      const { data, error } = await supabaseAdmin
        .from('res_company')
        .select('sri_p12_b64, sri_p12_pwd, name')
        .eq('id', company_id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: `Empresa ID ${company_id} no encontrada` }, { status: 404 });
      }

      if (!data.sri_p12_b64 || !data.sri_p12_pwd) {
        return NextResponse.json({
          error: `La empresa "${data.name}" no tiene firma electrónica configurada. ` +
            'Súbela en Administración → Empresas → Firma electrónica.',
        }, { status: 422 });
      }

      p12Override = { p12B64: data.sri_p12_b64, pwd: data.sri_p12_pwd };
    }

    const signedXml = signXml(xml, p12Override);
    return NextResponse.json({ signedXml });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error firmando' }, { status: 500 });
  }
}
