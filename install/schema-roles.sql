-- schema-roles.sql
-- Crea los roles de PostgreSQL necesarios para PostgREST.
-- Ejecutar ANTES de restaurar el backup de Supabase.
--
-- ROLES:
--   anon           → requests sin autenticación (lectura pública)
--   service_role   → requests con clave de servicio (acceso total, sin RLS)
--   authenticator  → rol de conexión de PostgREST (hereda los anteriores)
--
-- POR QUÉ ESTE DISEÑO:
--   PostgreSQL no tiene "roles de aplicación" integrados. PostgREST usa
--   SET LOCAL ROLE dentro de cada transacción para impersonar el rol correcto
--   según el JWT. authenticator es el rol con el que PostgREST se conecta;
--   luego cambia a anon o service_role según el token recibido.
-- ─────────────────────────────────────────────────────────────────────────────

-- Rol público (sin login, sin herencia de privilegios propios)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Rol de servicio (sin login, con todos los privilegios que le demos)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Rol de autenticación de PostgREST (CON login, hereda anon y service_role)
-- CAMBIA 'CAMBIA_ESTA_PASSWORD' por una contraseña segura
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'CAMBIA_ESTA_PASSWORD';
  END IF;
END $$;

GRANT anon         TO authenticator;
GRANT service_role TO authenticator;

-- ─── Schema auth (stub para compatibilidad con migraciones de Supabase) ──────
-- Algunas migraciones antiguas referencian auth.users. Este stub evita errores.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- ─── Permitir que PostgREST vea el schema public ─────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, service_role;

-- Estos GRANTs se aplican a tablas ya existentes. Para las que se creen
-- después, ejecuta de nuevo o usa ALTER DEFAULT PRIVILEGES (ver más abajo).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO anon;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL                            ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL                            ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Para tablas creadas en el futuro:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL                            ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL                            ON SEQUENCES TO service_role;

NOTIFY pgrst, 'reload schema';
