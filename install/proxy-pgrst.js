/**
 * proxy-pgrst.js
 * Proxy minimalista entre supabase-js y PostgREST.
 *
 * PROBLEMA QUE RESUELVE:
 *   supabase-js construye las URLs como:
 *     http://localhost:3100/rest/v1/<tabla>
 *   PostgREST sirve en la raíz:
 *     http://localhost:3101/<tabla>
 *   Este proxy escucha en :3100, quita el prefijo /rest/v1 y
 *   reenvía a PostgREST en :3101. Cero cambios en el código de la app.
 *
 * TAMBIÉN maneja:
 *   - /auth/v1/*  → devuelve sesión nula (no usamos auth)
 *   - CORS        → necesario para el cliente en el navegador
 *
 * No requiere npm install. Solo Node.js nativo.
 */

const http = require('http');

const PROXY_PORT   = parseInt(process.env.PROXY_PORT   || '3100', 10);
const PGRST_PORT   = parseInt(process.env.PGRST_PORT   || '3101', 10);
const PGRST_HOST   = process.env.PGRST_HOST || 'localhost';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type, Prefer, Range, X-Client-Info',
  'Access-Control-Expose-Headers': 'Content-Range, Range-Unit',
};

const server = http.createServer((req, res) => {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // /auth/v1/* → sesión nula (supabase-js no reclama si no hay sesión)
  if (req.url && req.url.startsWith('/auth/v1')) {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: null, session: null }));
    return;
  }

  // /rest/v1/* → strip prefix, forward a PostgREST
  const path = req.url
    ? req.url.replace(/^\/rest\/v1/, '') || '/'
    : '/';

  const options = {
    hostname: PGRST_HOST,
    port:     PGRST_PORT,
    path,
    method:  req.method,
    headers: { ...req.headers, host: `${PGRST_HOST}:${PGRST_PORT}` },
  };

  const proxy = http.request(options, (pgRes) => {
    const headers = { ...pgRes.headers, ...CORS_HEADERS };
    res.writeHead(pgRes.statusCode || 200, headers);
    pgRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('[proxy-pgrst] Error al conectar con PostgREST:', err.message);
    res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'PostgREST no disponible: ' + err.message }));
  });

  req.pipe(proxy, { end: true });
});

// SEGURIDAD: escuchar SOLO en 127.0.0.1 (localhost).
// Esto evita que los puertos 3100 y 3101 sean accesibles desde la red
// local o desde Radmin VPN. Solo el proceso Next.js en el mismo servidor
// puede llamar a este proxy; los clientes externos nunca lo ven.
server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[proxy-pgrst] Escuchando en 127.0.0.1:${PROXY_PORT} → PostgREST :${PGRST_PORT}`);
  console.log('[proxy-pgrst] Solo accesible desde localhost (no expuesto en red).');
});
