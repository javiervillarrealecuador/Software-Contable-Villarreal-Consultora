// src/app/api/admin/companies/[id]/firma/route.ts
// POST → recibe el .p12 en base64 + contraseña, valida, extrae metadatos y guarda en BD.
// DELETE → elimina la firma de la empresa.
//
// POR QUÉ base64 y no multipart:
// El frontend convierte el .p12 a base64 con FileReader antes de enviarlo.
// Esto permite un payload JSON simple y evita problemas de parsing multipart
// en edge runtimes de Next.js.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractP12Metadata } from '@/lib/sri-firma';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pevvuxoimshwwphaiwke.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
);

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const { p12B64, password } = await request.json();

  if (!p12B64 || !password) {
    return NextResponse.json(
      { error: 'Se requiere p12B64 y password' },
      { status: 400 },
    );
  }

  // Validar el certificado antes de guardarlo
  let meta: { razon: string; expira: string; emisor: string };
  try {
    meta = extractP12Metadata(p12B64, password);
  } catch (e: any) {
    return NextResponse.json(
      { error: `Certificado inválido o contraseña incorrecta: ${e.message}` },
      { status: 422 },
    );
  }

  // Guardar en BD
  const { error } = await sb
    .from('res_company')
    .update({
      sri_p12_b64: p12B64,
      sri_p12_pwd: password,
      sri_firma_expira: meta.expira,
      sri_firma_razon: meta.razon,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    razon: meta.razon,
    expira: meta.expira,
    emisor: meta.emisor,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  const { error } = await sb
    .from('res_company')
    .update({
      sri_p12_b64: null,
      sri_p12_pwd: null,
      sri_firma_expira: null,
      sri_firma_razon: null,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
