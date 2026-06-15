// src/lib/sri-soap.ts
// FASE 3 — Cliente SOAP de los web services del SRI (esquema offline).
// SOLO SERVIDOR.
//
// CANDADO DE AMBIENTE: la URL se deriva EXCLUSIVAMENTE del parámetro
// ambiente (1 = pruebas → celcer.sri.gob.ec; 2 = producción → cel.sri.gob.ec).
// Son infraestructuras separadas del SRI: con ambiente=1 es imposible tocar
// producción. El mismo valor alimenta la etiqueta <ambiente> del XML y el
// dígito 24 de la clave de acceso, así los tres siempre son coherentes.
//
// FLUJO OFFLINE del SRI:
//   1. validarComprobante (RecepcionComprobantesOffline): se envía el XML
//      firmado en base64 → RECIBIDA o DEVUELTA (con mensajes).
//   2. autorizacionComprobante (AutorizacionComprobantesOffline): se consulta
//      por clave de acceso → AUTORIZADO / NO AUTORIZADO / EN PROCESO.

const HOSTS: Record<number, string> = {
  1: 'https://celcer.sri.gob.ec',  // PRUEBAS / certificación
  2: 'https://cel.sri.gob.ec',     // PRODUCCIÓN
};

function baseUrl(ambiente: number): string {
  const host = HOSTS[ambiente];
  if (!host) throw new Error(`Ambiente SRI inválido: ${ambiente} (use 1=pruebas o 2=producción)`);
  return `${host}/comprobantes-electronicos-ws`;
}

// ── Helpers XML ───────────────────────────────────────────────────────────────

function extract(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

function extractAll(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1].trim());
}

/**
 * Los mensajes del SRI vienen anidados: <mensaje> contiene a su vez un
 * <mensaje> interno (texto), <identificador>, <informacionAdicional> y <tipo>.
 * La informacionAdicional trae el detalle técnico (línea/columna del error
 * de estructura), que es lo más útil para diagnosticar.
 */
function parseMensajes(resp: string): string[] {
  const out: string[] = [];
  const ids = extractAll(resp, 'identificador');
  const textos = [...resp.matchAll(/<mensaje>([^<]+)<\/mensaje>/g)].map(m => m[1].trim());
  const infos = extractAll(resp, 'informacionAdicional');
  const tipos = extractAll(resp, 'tipo');
  const n = Math.max(ids.length, textos.length);
  for (let i = 0; i < n; i++) {
    out.push(`[${ids[i] || '?'}${tipos[i] ? ' ' + tipos[i] : ''}] ${textos[i] || ''}${infos[i] ? ' — ' + infos[i] : ''}`.trim());
  }
  return out;
}

async function soapCall(url: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body,
  });
  const text = await res.text();
  if (!res.ok && !text.includes('Envelope')) {
    throw new Error(`SRI respondió HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

// ── 1. Recepción ──────────────────────────────────────────────────────────────

export interface RecepcionResult {
  estado: string;              // RECIBIDA | DEVUELTA
  mensajes: string[];          // errores con identificador y texto
}

export async function enviarComprobante(signedXml: string, ambiente: number): Promise<RecepcionResult> {
  const xmlB64 = Buffer.from(signedXml, 'utf8').toString('base64');
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${xmlB64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await soapCall(`${baseUrl(ambiente)}/RecepcionComprobantesOffline`, envelope);

  const estado = extract(resp, 'estado') || 'SIN RESPUESTA';
  return { estado, mensajes: parseMensajes(resp) };
}

// ── 2. Autorización ───────────────────────────────────────────────────────────

export interface AutorizacionResult {
  estado: string;              // AUTORIZADO | NO AUTORIZADO | EN PROCESO | ...
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  comprobante: string | null;  // XML completo del comprobante (contenido del tag <comprobante>)
  mensajes: string[];
}

export async function consultarAutorizacion(claveAcceso: string, ambiente: number): Promise<AutorizacionResult> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await soapCall(`${baseUrl(ambiente)}/AutorizacionComprobantesOffline`, envelope);

  const estado = extract(resp, 'estado') || 'EN PROCESO';

  // El tag <comprobante> contiene el XML completo del comprobante.
  // Puede venir como CDATA: <comprobante><![CDATA[...]]></comprobante>
  // o como texto plano con entidades escapadas.
  let comprobante = extract(resp, 'comprobante');
  if (comprobante) {
    // Si viene envuelto en CDATA, el extract ya lo sacó.
    // Si viene con entidades HTML escapadas, decodificar.
    comprobante = comprobante
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  return {
    estado,
    numeroAutorizacion: extract(resp, 'numeroAutorizacion'),
    fechaAutorizacion: extract(resp, 'fechaAutorizacion'),
    comprobante,
    mensajes: parseMensajes(resp),
  };
}
