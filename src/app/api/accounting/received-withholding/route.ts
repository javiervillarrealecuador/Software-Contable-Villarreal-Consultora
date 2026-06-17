import { NextResponse } from 'next/server';
import { generateReceivedWithholdingEntry } from '@/lib/received-withholding-accounting';

export async function POST(request: Request) {
  try {
    const { withholdingIds } = await request.json();
    if (!Array.isArray(withholdingIds) || withholdingIds.length === 0) {
      return NextResponse.json({ error: 'Se requieren IDs de retenciones recibidas' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const id of withholdingIds) {
      try {
        const moveId = await generateReceivedWithholdingEntry(id);
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
