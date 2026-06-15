/**
 * generate-keys.js
 * Genera las tres claves necesarias para PostgREST local:
 *   - JWT_SECRET   → secreto para firmar/verificar los tokens
 *   - ANON_KEY     → token con rol "anon" (acceso público)
 *   - SERVICE_KEY  → token con rol "service_role" (acceso total)
 *
 * USO: node generate-keys.js
 * No requiere npm install. Solo Node.js nativo.
 *
 * POR QUÉ JWT:
 *   PostgREST usa JWT para determinar el rol de PostgreSQL con el que
 *   ejecutar cada request. El cliente (supabase-js) envía el token en
 *   el header "Authorization: Bearer <token>". PostgREST lo verifica
 *   con el jwt-secret, lee el campo "role" del payload, y ejecuta la
 *   query como ese rol de PostgreSQL (anon o service_role).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Utilidades JWT HS256 en puro Node.js ────────────────────────────────────

function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJWT(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify(payload));
  const sig    = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.${sig}`;
}

// ─── Generar claves ───────────────────────────────────────────────────────────

const secret = crypto.randomBytes(32).toString('hex');
const now    = Math.floor(Date.now() / 1000);
const exp    = now + 10 * 365 * 24 * 3600; // 10 años

const anonJWT = signJWT({
  role: 'anon',
  iss:  'erp-ecuador-local',
  iat:  now,
  exp,
}, secret);

const serviceJWT = signJWT({
  role: 'service_role',
  iss:  'erp-ecuador-local',
  iat:  now,
  exp,
}, secret);

// ─── Salida ───────────────────────────────────────────────────────────────────

const lines = [
  '# Claves generadas para PostgREST local',
  '# Guarda este archivo en un lugar seguro (NO subir a git)',
  '',
  `JWT_SECRET="${secret}"`,
  `ANON_KEY="${anonJWT}"`,
  `SERVICE_ROLE_KEY="${serviceJWT}"`,
];

const outFile = path.join(__dirname, 'claves-generadas.txt');
fs.writeFileSync(outFile, lines.join('\n') + '\n');

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║          CLAVES GENERADAS PARA POSTGREST LOCAL           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
console.log('JWT_SECRET (para postgrest.conf):\n' + secret + '\n');
console.log('ANON_KEY (para .env.local de las apps):\n' + anonJWT + '\n');
console.log('SERVICE_ROLE_KEY (para .env.local de las apps):\n' + serviceJWT + '\n');
console.log('► Guardado también en: ' + outFile);
console.log('► ADVERTENCIA: No subas claves-generadas.txt a Git.\n');
