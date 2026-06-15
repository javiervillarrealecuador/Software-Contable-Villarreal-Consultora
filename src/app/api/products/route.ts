// src/app/api/products/route.ts
// Endpoint que faltaba en capa 0: la página /products hace POST aquí.
// Crea product_template y su product_product asociado (patrón Odoo:
// template = datos comerciales; product = variante vendible/almacenable).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Preferir service role (ignora RLS, solo existe en el servidor);
  // si no está definida, usar anon (requiere políticas dev de la 010).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category_id, type, uom_id, list_price, standard_price, description } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const supabase = getServerClient();

    // 1. Crear template
    const { data: template, error: tmplErr } = await supabase
      .from('product_template')
      .insert([{
        name: String(name).trim(),
        category_id: category_id || null,
        type: type || 'product',
        uom_id: uom_id || 1,
        uom_po_id: uom_id || 1,
        list_price: Number(list_price) || 0,
        standard_price: Number(standard_price) || 0,
        description: description || null,
        active: true,
      }])
      .select()
      .single();
    if (tmplErr) {
      return NextResponse.json({ error: tmplErr.message }, { status: 500 });
    }

    // 2. Crear la variante (product_product) con código secuencial
    const { data: product, error: prodErr } = await supabase
      .from('product_product')
      .insert([{
        product_tmpl_id: template.id,
        code: `PROD-${String(template.id).padStart(5, '0')}`,
        active: true,
      }])
      .select()
      .single();
    if (prodErr) {
      // Rollback manual del template para no dejar huérfanos
      await supabase.from('product_template').delete().eq('id', template.id);
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    return NextResponse.json({ template, product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
}
