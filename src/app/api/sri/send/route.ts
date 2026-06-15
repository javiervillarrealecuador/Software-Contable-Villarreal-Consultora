// src/app/api/sri/send/route.ts
// FASE 3 — Envío del comprobante al SRI (esquema offline completo):
// recibe el XML firmado + clave de acceso + ambiente, lo presenta a
// recepción y, si es RECIBIDA, consulta la autorización con reintentos.
//
// El ambiente llega del cliente pero se valida aquí: solo 1 (pruebas) o
// 2 (producción). La URL se deriva en sri-soap.ts de ese único valor.

import { NextResponse } from 'next/server';
import { enviarComprobante, consultarAutorizacion } from '@/lib/sri-soap';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(request: Request) {
  try {
    const { signedXml, claveAcceso, ambiente } = await request.json();
    if (!signedXml || !claveAcceso) {
      return NextResponse.json({ error: 'Faltan signedXml o claveAcceso' }, { status: 400 });
    }
    const amb = ambiente === 2 ? 2 : 1;   // por defecto SIEMPRE pruebas

    // 1. Recepción
    const recepcion = await enviarComprobante(signedXml, amb);

    if (recepcion.estado !== 'RECIBIDA') {
      // DEVUELTA: el SRI rechazó el comprobante; los mensajes explican por qué
      return NextResponse.json({
        estado: recepcion.estado || 'DEVUELTA',
        mensajes: recepcion.mensajes,
        ambiente: amb,
      });
    }

    // 2. Autorización (el SRI procesa en segundos; reintentar hasta 5 veces)
    let aut = null as Awaited<ReturnType<typeof consultarAutorizacion>> | null;
    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      aut = await consultarAutorizacion(claveAcceso, amb);
      if (aut.estado === 'AUTORIZADO' || aut.estado === 'NO AUTORIZADO') break;
    }

    return NextResponse.json({
      estado: aut?.estado || 'EN PROCESO',
      numeroAutorizacion: aut?.numeroAutorizacion || null,
      fechaAutorizacion: aut?.fechaAutorizacion || null,
      mensajes: [...recepcion.mensajes, ...(aut?.mensajes || [])],
      ambiente: amb,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error enviando al SRI' }, { status: 500 });
  }
}
