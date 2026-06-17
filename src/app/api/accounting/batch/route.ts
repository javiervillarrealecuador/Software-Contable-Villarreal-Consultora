import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSaleAccountingEntry } from '@/lib/invoice-accounting';

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const { docType, startDate, endDate } = await request.json();
    if (!docType || !startDate || !endDate) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (docType, startDate, endDate)' }, { status: 400 });
    }

    const supabase = getServerClient();
    const results = [];
    const errors = [];

    if (docType === 'sale') {
      // Obtener facturas de venta no contabilizadas en el rango de fechas
      const { data: orders, error: orderErr } = await supabase
        .from('sale_order')
        .select('id, name')
        .gte('date_order', startDate)
        .lte('date_order', endDate)
        .is('account_move_id', null)
        .in('state', ['sale', 'done']); // asumiendo que solo se contabilizan las validadas

      if (orderErr) throw new Error(orderErr.message);

      for (const order of orders || []) {
        try {
          const moveId = await generateSaleAccountingEntry(order.id);
          results.push({ id: order.id, name: order.name, moveId });
        } catch (err: any) {
          errors.push({ id: order.id, name: order.name, error: err.message });
        }
      }
    } else if (docType === 'purchase') {
      // Futura implementación para compras
      // const { data: orders } = await supabase.from('purchase_order')...
      return NextResponse.json({ error: 'La contabilización de compras por lotes está en construcción.' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Tipo de documento no soportado' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
