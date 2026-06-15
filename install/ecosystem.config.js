/**
 * ecosystem.config.js — PM2 — ERP Ecuador (servidor local)
 *
 * PROCESOS:
 *   1. proxy-pgrst   → Node.js, :3100, proxy entre supabase-js y PostgREST
 *   2. postgrest      → binario externo, :3101, API REST de PostgreSQL
 *   3. erp-ecuador    → Next.js, :3000, sistema contable ERP
 *   4. sri-descargador→ Next.js, :3001, descargador de comprobantes SRI
 *
 * PUERTOS accesibles desde Radmin VPN:
 *   :3000 → ERP (todos los usuarios)
 *   :3001 → SRI Descargador (solo administrador)
 *   :3100 y :3101 → SOLO servidor (internos, no exponer)
 *
 * USO:
 *   pm2 start C:\erp-ecuador\install\ecosystem.config.js
 *   pm2 save       ← guarda la lista para reinicio automático
 *   pm2 startup    ← configura inicio al arrancar Windows
 */

module.exports = {
  apps: [
    // ── 1. Proxy supabase-js ↔ PostgREST ─────────────────────────────────
    {
      name:       'proxy-pgrst',
      script:     'C:\\erp-ecuador\\install\\proxy-pgrst.js',
      interpreter:'node',
      env: {
        PROXY_PORT: '3100',
        PGRST_PORT: '3101',
        PGRST_HOST: 'localhost',
        NODE_ENV:   'production',
      },
      watch:       false,
      autorestart: true,
      max_restarts: 10,
      log_file:   'C:\\erp-ecuador\\logs\\proxy-pgrst.log',
    },

    // ── 2. PostgREST ─────────────────────────────────────────────────────
    // AJUSTA la ruta a donde descargaste postgrest.exe
    {
      name:        'postgrest',
      script:      'C:\\postgrest\\postgrest.exe',
      args:        'C:\\erp-ecuador\\install\\postgrest.conf',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 10,
      log_file:   'C:\\erp-ecuador\\logs\\postgrest.log',
    },

    // ── 3. ERP Ecuador ────────────────────────────────────────────────────
    {
      name:   'erp-ecuador',
      script: 'node_modules\\.bin\\next',
      args:   'start',
      cwd:    'C:\\erp-ecuador',
      env: {
        PORT:     '3000',
        NODE_ENV: 'production',
      },
      watch:       false,
      autorestart: true,
      max_restarts: 10,
      log_file:   'C:\\erp-ecuador\\logs\\erp.log',
    },

    // ── 4. SRI Descargador ────────────────────────────────────────────────
    {
      name:   'sri-descargador',
      script: 'node_modules\\.bin\\next',
      args:   'start',
      cwd:    'C:\\sri-descargador',
      env: {
        PORT:     '3001',
        NODE_ENV: 'production',
      },
      watch:       false,
      autorestart: true,
      max_restarts: 10,
      log_file:   'C:\\erp-ecuador\\logs\\descargador.log',
    },
  ],
};
