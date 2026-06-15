// src/app/api/ai-analysis/route.ts
// CAPA 5 — Análisis ejecutivo con IA (DeepSeek)
//
// Corre en el SERVIDOR por dos razones: la API key no debe exponerse al
// navegador, y el modelo recibe los datos ya resumidos (no consulta la BD).
// El prompt fija el rol (analista financiero ecuatoriano) y exige formato
// breve y accionable para que la salida sea útil a gerencia.

import { NextResponse } from 'next/server';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `Eres un analista financiero senior especializado en empresas ecuatorianas (NIIF, normativa SRI, contexto dólar).
Recibirás un reporte contable o comercial en JSON. Entrega un análisis ejecutivo EN ESPAÑOL con esta estructura:
1. LECTURA GENERAL (2-3 frases sobre la situación que muestran los números)
2. PUNTOS DE ATENCIÓN (riesgos, descuadres, concentraciones, márgenes bajos — solo si existen, con cifras)
3. RECOMENDACIONES (máximo 3, concretas y accionables)
Reglas: usa solo los datos recibidos, no inventes cifras; si los datos son escasos dilo claramente; sé directo y profesional, sin halagos; máximo 250 palabras.`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY no configurada en .env.local' }, { status: 500 });
    }

    const { reportType, reportData, period } = await request.json();
    if (!reportType || !reportData) {
      return NextResponse.json({ error: 'Faltan reportType o reportData' }, { status: 400 });
    }

    // Limitar tamaño del payload al modelo (los reportes grandes se truncan)
    const dataStr = JSON.stringify(reportData);
    const truncated = dataStr.length > 12000 ? dataStr.slice(0, 12000) + '...(truncado)' : dataStr;

    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Reporte: ${reportType}\nPeríodo: ${period || 'no especificado'}\nDatos:\n${truncated}` },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `DeepSeek respondió ${res.status}: ${body.slice(0, 300)}` }, { status: 502 });
    }

    const json = await res.json();
    const analysis = json.choices?.[0]?.message?.content || 'Sin respuesta del modelo';
    return NextResponse.json({ analysis });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
}
