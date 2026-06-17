import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSalesBatchAccountingEntry } from '@/lib/invoice-accounting';

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
        .select('id, name, company_id')
        .gte('date_order', startDate)
        .lte('date_order', endDate)
        .is('account_move_id', null)
        .in('state', ['sale', 'done']); // asumiendo que solo se contabilizan las validadas

      if (orderErr) throw new Error(orderErr.message);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        try {
          const companyId = orders[0].company_id || 1;
          const moveId = await generateSalesBatchAccountingEntry(companyId, orderIds, startDate, endDate);
          results.push({ id: moveId, name: `Lote de Ventas (${orders.length} facturas)`, moveId });
        } catch (err: any) {
          errors.push({ id: 0, name: 'Lote de Ventas', error: err.message });
        }
      }
    } else if (docType === 'received_withholding') {
      const { data: withholdings, error: whErr } = await supabase
        .from('sale_received_withholding')
        .select('id, ret_number')
        .gte('date', startDate)
        .lte('date', endDate)
        .is('account_move_id', null)
        .eq('state', 'registered');

      if (whErr) throw new Error(whErr.message);
      
      const { generateReceivedWithholdingEntry } = require('@/lib/received-withholding-accounting');

      for (const wh of withholdings || []) {
        try {
          const moveId = await generateReceivedWithholdingEntry(wh.id);
          results.push({ id: wh.id, name: `Ret. Recibida ${wh.ret_number || '#' + wh.id}`, moveId });
        } catch (err: any) {
          errors.push({ id: wh.id, name: `Ret. Recibida ${wh.ret_number || '#' + wh.id}`, error: err.message });
        }
      }
    } else if (docType === 'purchase') {
      // Obtener compras confirmadas no contabilizadas en el rango de fechas
      const { data: orders, error: orderErr } = await supabase
        .from('purchase_order')
        .select('id, name, company_id')
        .gte('date_order', startDate)
        .lte('date_order', endDate)
        .is('account_move_id', null)
        .eq('state', 'confirmed');

      if (orderErr) throw new Error(orderErr.message);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        try {
          const { generatePurchasesBatchAccountingEntry } = require('@/lib/erp-accounting');
          const companyId = orders[0].company_id || 1;
          const moveId = await generatePurchasesBatchAccountingEntry(companyId, orderIds, startDate, endDate);
          results.push({ id: moveId, name: `Lote de Compras (${orders.length} facturas)`, moveId });
        } catch (err: any) {
          errors.push({ id: 0, name: 'Lote de Compras', error: err.message });
        }
      }
    } else {
      return NextResponse.json({ error: 'Tipo de documento no soportado' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
