import { NextResponse } from 'next/server';
import { buildAtsFromDb, generateAtsXml } from '@/lib/ats-xml';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const anio = Number(searchParams.get('anio'));
    const mes = Number(searchParams.get('mes'));
    
    // Asumimos companyId 1 por ahora, deberia venir de sesion/cookie en un sistema real
    const companyId = 1;

    if (!anio || !mes) {
      return NextResponse.json({ error: 'Faltan parámetros anio y mes' }, { status: 400 });
    }

    const atsData = await buildAtsFromDb(companyId, anio, mes);
    const xmlContent = generateAtsXml(atsData);

    return new NextResponse(xmlContent, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="ATS_${anio}_${String(mes).padStart(2, '0')}.xml"`
      }
    });

  } catch (error: any) {
    console.error('Error generando ATS:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
