// src/app/api/admin/companies/[id]/route.ts
// PUT  → actualiza parámetros de una empresa
// DELETE → desactiva (soft delete) una empresa

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const body = await request.json();

  const { data, error } = await sb
    .from('res_company')
    .update({
      name: body.name,
      vat: body.vat || null,
      active: body.active ?? true,
      sri_ambiente: body.sri_ambiente,
      sri_estab: body.sri_estab,
      sri_pto_emi: body.sri_pto_emi,
      sri_dir_matriz: body.sri_dir_matriz || null,
      sri_dir_estab: body.sri_dir_estab || null,
      sri_obligado_contab: body.sri_obligado_contab ?? false,
      sri_contrib_especial: body.sri_contrib_especial || null,
      sri_agente_retencion: body.sri_agente_retencion || null,
      sri_rimpe: body.sri_rimpe || null,
      sri_email_envio: body.sri_email_envio || null,
    })
    .eq('id', id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  // Soft delete: marcar como inactivo, nunca borrar físicamente
  const { error } = await sb
    .from('res_company')
    .update({ active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
