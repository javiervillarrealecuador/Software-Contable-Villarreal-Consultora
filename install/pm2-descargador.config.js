/**
 * pm2-descargador.config.js
 * PM2 para el stack completo del SRI Descargador local:
 *   1. proxy-pgrst     → :3100  (adapta supabase-js a PostgREST)
 *   2. postgrest-desc  → :3101  (API REST sobre PostgreSQL local)
 *   3. sri-descargador → :3001  (aplicación Next.js)
 *
 * El ERP contable NO está aquí (sigue en Supabase, sin tocar).
 *
 * USO:
 *   pm2 start C:\erp-ecuador\install\pm2-descargador.config.js
 *   pm2 save
 *   pm2-windows-startup install
 */

module.exports = {
  apps: [
    // ── 1. Proxy supabase-js ↔ PostgREST ────────────────────────────────────
    // Transforma /rest/v1/<tabla> → /<tabla> para que supabase-js funcione
    // sin ningún cambio de código en el descargador.
    {
      name:        'proxy-pgrst',
      script:      'C:\\erp-ecuador\\install\\proxy-pgrst.js',
      interpreter: 'node',
      env: {
        PROXY_PORT: '3100',
        PGRST_PORT: '3101',
        PGRST_HOST: 'localhost',
        NODE_ENV:   'production',
      },
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      log_file:    'C:\\sri-descargador\\logs\\proxy.log',
    },

    // ── 2. PostgREST ─────────────────────────────────────────────────────────
    // Expone la BD local sri_descargador como una API REST.
    // Descarga postgrest.exe de: https://github.com/PostgREST/postgrest/releases
    // y ponlo en C:\postgrest\postgrest.exe
    {
      name:        'postgrest-desc',
      script:      'C:\\postgrest\\postgrest.exe',
      args:        'C:\\erp-ecuador\\install\\postgrest-descargador.conf',
      interpreter: 'none',
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      log_file:    'C:\\sri-descargador\\logs\\postgrest.log',
    },

    // ── 3. SRI Descargador ────────────────────────────────────────────────────
    {
      name:   'sri-descargador',
      script: 'node_modules\\.bin\\next',
      args:   'start',
      cwd:    'C:\\sri-descargador',
      env: {
        PORT:     '3001',
        NODE_ENV: 'production',
      },
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 5000,
      log_file:    'C:\\sri-descargador\\logs\\descargador.log',
      time:         true,
    },
  ],
};
