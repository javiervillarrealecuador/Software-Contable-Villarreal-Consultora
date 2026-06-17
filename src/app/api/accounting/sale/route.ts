import { NextResponse } from 'next/server';
import { generateSaleAccountingEntry } from '@/lib/invoice-accounting';

export async function POST(request: Request) {
  try {
    const { orderIds } = await request.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Se requieren IDs de órdenes de venta' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const id of orderIds) {
      try {
        const moveId = await generateSaleAccountingEntry(id);
        results.push({ id, moveId });
      } catch (err: any) {
        errors.push({ id, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
