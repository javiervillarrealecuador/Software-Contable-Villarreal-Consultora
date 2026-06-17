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
    const { name, category_id, type, uom_id, list_price, standard_price, description, presentations } = body;

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
        active: body.active !== undefined ? body.active : true,
        
        // Advanced Fields
        reference: body.reference || null,
        group1: body.group1 || null,
        group2: body.group2 || null,
        group3: body.group3 || null,
        stock_unit: body.stock_unit || 'UNIDAD',
        min_stock: Number(body.min_stock) || 0,
        max_stock: Number(body.max_stock) || 0,
        cost_center: body.cost_center || null,
        iva_code: body.iva_code || '15%',
        has_ice: Boolean(body.has_ice),
        ice_percentage: Number(body.ice_percentage) || 0,
        price_1: Number(body.price_1) || 0,
        price_2: Number(body.price_2) || 0,
        price_3: Number(body.price_3) || 0,
        price_4: Number(body.price_4) || 0,
        price_5: Number(body.price_5) || 0,
        price_6: Number(body.price_6) || 0,
        discount_percentage: Number(body.discount_percentage) || 0,
        previous_price: Number(body.previous_price) || 0,
        promo_quantity: Number(body.promo_quantity) || 0,
        promo_valid_until: body.promo_valid_until || null,
        warehouse_location: body.warehouse_location || null,
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
        code: body.reference ? body.reference : `PROD-${String(template.id).padStart(5, '0')}`,
        active: true,
      }])
      .select()
      .single();
      
    if (prodErr) {
      // Rollback manual del template para no dejar huérfanos
      await supabase.from('product_template').delete().eq('id', template.id);
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    // 3. Crear presentaciones si existen
    if (presentations && Array.isArray(presentations) && presentations.length > 0) {
      const presToInsert = presentations.map((p: any) => ({
        product_tmpl_id: template.id,
        name: p.name || 'UNIDAD',
        barcode: p.barcode || null,
        gross_weight: Number(p.gross_weight) || 0,
        weight_unit: p.weight_unit || 'UNIDAD',
        price_1: Number(p.price_1) || 0,
        price_2: Number(p.price_2) || 0,
        price_3: Number(p.price_3) || 0,
        price_4: Number(p.price_4) || 0,
        price_5: Number(p.price_5) || 0,
        price_6: Number(p.price_6) || 0,
      }));
      
      const { error: presErr } = await supabase
        .from('product_presentation')
        .insert(presToInsert);
        
      if (presErr) {
        console.error('Error inserting presentations:', presErr.message);
        // We do not rollback the whole product if presentations fail, but we log it.
      }
    }

    return NextResponse.json({ template, product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
}
