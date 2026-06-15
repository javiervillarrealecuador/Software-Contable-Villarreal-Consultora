// src/app/api/admin/companies/route.ts
// CRUD de empresas para el Super Administrador.
// GET  → lista todas las empresas con estado de firma
// POST → crea una nueva empresa

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
  const { data, error } = await sb
    .from('res_company')
    .select(
      'id, name, vat, active, sri_ambiente, sri_estab, sri_pto_emi, ' +
      'sri_dir_matriz, sri_obligado_contab, sri_firma_expira, sri_firma_razon, ' +
      'sri_logo_b64, sri_email_envio, sri_contrib_especial, sri_agente_retencion, sri_rimpe',
    )
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { data, error } = await sb
    .from('res_company')
    .insert([{
      name: body.name,
      vat: body.vat || null,
      active: true,
      sri_ambiente: body.sri_ambiente ?? 1,
      sri_estab: body.sri_estab || '001',
      sri_pto_emi: body.sri_pto_emi || '001',
      sri_dir_matriz: body.sri_dir_matriz || null,
      sri_dir_estab: body.sri_dir_estab || null,
      sri_obligado_contab: body.sri_obligado_contab ?? false,
      sri_contrib_especial: body.sri_contrib_especial || null,
      sri_agente_retencion: body.sri_agente_retencion || null,
      sri_rimpe: body.sri_rimpe || null,
      currency_id: 1,
    }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0], { status: 201 });
}
