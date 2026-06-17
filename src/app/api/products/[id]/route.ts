import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const { name, category_id, type, uom_id, list_price, standard_price, description, tmpl_id } = body;

    if (!tmpl_id) {
      return NextResponse.json({ error: 'Falta el tmpl_id para actualizar el template' }, { status: 400 });
    }

    const supabase = getServerClient();

    // 1. Actualizar template
    const { error: tmplErr } = await supabase
      .from('product_template')
      .update({
        name: String(name).trim(),
        category_id: category_id || null,
        type: type || 'product',
        uom_id: uom_id || 1,
        uom_po_id: uom_id || 1,
        list_price: Number(list_price) || 0,
        standard_price: Number(standard_price) || 0,
        description: description || null,
        active: body.active !== undefined ? body.active : true,
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
        income_account_id: body.income_account_id || null,
        expense_account_id: body.expense_account_id || null,
      })
      .eq('id', tmpl_id);
      
    if (tmplErr) {
      return NextResponse.json({ error: tmplErr.message }, { status: 500 });
    }

    // 2. Actualizar product_product (estado activo)
    const { error: prodErr } = await supabase
      .from('product_product')
      .update({
        active: body.active !== undefined ? body.active : true,
      })
      .eq('id', id);
      
    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
}
