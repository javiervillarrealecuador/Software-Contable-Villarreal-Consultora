#!/usr/bin/env node
// crear-admin.js — Crea el primer usuario administrador en la BD local
// ─────────────────────────────────────────────────────────────────────
// USO (en el SERVIDOR, dentro de C:\sri-descargador):
//   node C:\erp-ecuador\install\crear-admin.js
//
// Requiere que PostgreSQL esté corriendo y la BD sri_descargador creada.
// Lee la URL de la BD desde .env.local (NEXT_PUBLIC_SUPABASE_URL)
// o usa la conexión directa si tienes DATABASE_URL.

const crypto = require('crypto');
const readline = require('readline');

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// ── Leer .env.local ────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌  No se encontró .env.local en', process.cwd());
    console.error('    Ejecuta este script desde C:\\sri-descargador');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env   = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Insertar vía psql (no requiere PostgREST) ─────────────────────────────────

const { execSync } = require('child_process');

function insertUser(env, user) {
  // Leer DATABASE_URL desde .env.local o usar valor por defecto
  const dbUrl = env['DATABASE_URL'] || 'postgres://postgres:postgres@localhost:5432/sri_descargador';

  // Escapar comillas simples en los valores
  const esc = s => String(s).replace(/'/g, "''");

  const sql = `
INSERT INTO app_users (nombre, email, password_hash, rol, active)
VALUES ('${esc(user.nombre)}', '${esc(user.email)}', '${esc(user.password_hash)}', '${esc(user.rol)}', TRUE)
ON CONFLICT (email) DO UPDATE SET
  nombre        = EXCLUDED.nombre,
  password_hash = EXCLUDED.password_hash,
  rol           = EXCLUDED.rol,
  active        = TRUE;
`.trim();

  try {
    execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
  } catch (err) {
    const msg = err.stderr?.toString() || err.message;
    throw new Error(msg);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Crear primer usuario administrador — SRI Descargador');
  console.log('═══════════════════════════════════════════════════════\n');

  const env = loadEnv();
  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const nombre   = (await prompt(rl, 'Nombre completo: ')).trim();
    const email    = (await prompt(rl, 'Email:           ')).trim().toLowerCase();
    const password = (await prompt(rl, 'Contraseña:      ')).trim();

    if (!nombre || !email || !password) {
      console.error('\n❌  Todos los campos son requeridos.'); process.exit(1);
    }
    if (password.length < 8) {
      console.error('\n❌  La contraseña debe tener al menos 8 caracteres.'); process.exit(1);
    }

    const password_hash = hashPassword(password);

    console.log('\n⏳ Creando usuario…');
    insertUser(env, { nombre, email, password_hash, rol: 'admin', active: true });

    console.log('\n✅  Usuario administrador creado:');
    console.log(`    Nombre: ${nombre}`);
    console.log(`    Email:  ${email}`);
    console.log(`    Rol:    admin`);
    console.log('\n  Ya puedes iniciar sesión en http://localhost:3001/login\n');
  } finally {
    rl.close();
  }
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
