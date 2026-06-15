-- ============================================================================
-- schema-descargador.sql  — Base de datos LOCAL del SRI Descargador
-- ============================================================================
-- POR QUÉ esta BD es independiente del ERP (Supabase):
--   El descargador solo necesita 3 cosas de la BD:
--     1. Lista de clientes con sus credenciales del portal SRI
--     2. Registro de batches de descarga (qué mes, qué estado)
--     3. Progreso y XMLs descargados
--   Ninguna de estas cosas necesita estar en Supabase cloud.
--   Al guardarlas localmente se gana: velocidad, sin costos de red,
--   sin límites de Supabase, y los datos sensibles (contraseñas SRI)
--   nunca salen del servidor.
--
-- POR QUÉ la tabla se llama "res_partner" y no "clientes_sri":
--   El código del descargador ya está escrito para consultar "res_partner"
--   con los campos sri_user y sri_password. Usar el mismo nombre evita
--   reescribir el código.
--
-- EJECUTAR SIEMPRE EN ESTE ORDEN:
--   1. psql ... -f schema-roles.sql     (crea roles anon/service_role)
--   2. psql ... -f schema-descargador.sql  (este archivo)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. res_partner  — Clientes con credenciales del portal SRI
--    Solo tiene las columnas que el descargador necesita.
--    Los clientes se ingresan manualmente aquí (pgAdmin o el panel web).
-- ============================================================================

CREATE TABLE IF NOT EXISTS res_partner (
  id           BIGSERIAL    PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,         -- Razón social
  vat          VARCHAR(13)  UNIQUE,           -- RUC (13 dígitos)
  sri_user     VARCHAR(255),                  -- Usuario portal SRI
  sri_password VARCHAR(255),                  -- Contraseña portal SRI
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_res_partner_active ON res_partner(active);

COMMENT ON COLUMN res_partner.sri_user IS
  'Usuario de srienlinea.sri.gob.ec del cliente';
COMMENT ON COLUMN res_partner.sri_password IS
  'Contraseña del portal SRI. Mantener este servidor seguro.';

-- ============================================================================
-- 2. sri_distribution_batch  — Una fila por ejecución mensual del descargador
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_distribution_batch (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_month    VARCHAR(7)   NOT NULL,   -- 'YYYY-MM'
  total_clients  INTEGER      NOT NULL DEFAULT 0,
  total_invoices INTEGER      NOT NULL DEFAULT 0,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_by     VARCHAR(100),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  error_message  TEXT,
  CONSTRAINT uq_batch_month UNIQUE (batch_month)
);

-- ============================================================================
-- 3. sri_client_download  — Progreso por cliente dentro de un batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_client_download (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id         BIGINT       NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id       INTEGER      NOT NULL DEFAULT 0,
  client_id        BIGINT       NOT NULL,   -- referencia lógica a res_partner.id
  client_name      VARCHAR(255) NOT NULL,
  client_ruc       VARCHAR(13)  NOT NULL,
  total_invoices   INTEGER      NOT NULL DEFAULT 0,
  downloaded       INTEGER      NOT NULL DEFAULT 0,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  last_reported_at TIMESTAMPTZ,
  error_message    TEXT,
  CONSTRAINT uq_batch_client UNIQUE (batch_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_scd_batch   ON sri_client_download(batch_id);
CREATE INDEX IF NOT EXISTS idx_scd_status  ON sri_client_download(batch_id, status);

-- ============================================================================
-- 4. sri_xml_downloaded  — Cada XML descargado (deduplicado por clave acceso)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_xml_downloaded (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id            BIGINT      NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id          INTEGER     NOT NULL DEFAULT 0,
  client_id           BIGINT      NOT NULL,
  invoice_id          VARCHAR(49) NOT NULL,   -- clave de acceso de 49 dígitos
  xml_hash            VARCHAR(64),
  file_size           INTEGER     DEFAULT 0,
  status              VARCHAR(20) NOT NULL DEFAULT 'downloaded',
  numero_autorizacion VARCHAR(49),
  fecha_autorizacion  VARCHAR(30),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_xml_batch_invoice UNIQUE (batch_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_sxd_batch  ON sri_xml_downloaded(batch_id);
CREATE INDEX IF NOT EXISTS idx_sxd_client ON sri_xml_downloaded(batch_id, client_id);

-- ============================================================================
-- 5. sri_download_error_log  — Log de errores para diagnóstico
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_download_error_log (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id           BIGINT REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id         INTEGER     NOT NULL DEFAULT 0,
  client_download_id BIGINT,
  error_type         VARCHAR(50) NOT NULL,
  error_message      TEXT,
  attempt_number     INTEGER,
  retry_scheduled_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sel_batch ON sri_download_error_log(batch_id);

-- ============================================================================
-- 6. app_users  — Empleados que acceden al panel del descargador
--    Contraseñas almacenadas con scrypt (Node.js built-in), nunca en texto plano.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_users (
  id            BIGSERIAL    PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,   -- formato: "salt:hash" (scrypt)
  rol           VARCHAR(20)  NOT NULL DEFAULT 'operador',  -- admin | operador
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_users IS
  'Empleados con acceso al panel del descargador SRI. No confundir con clientes.';
COMMENT ON COLUMN app_users.rol IS
  'admin: puede gestionar clientes y usuarios. operador: solo puede descargar.';

-- ============================================================================
-- PERMISOS para PostgREST
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO anon;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL                            ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL                            ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✓ Schema del SRI Descargador listo.';
  RAISE NOTICE '  Tablas: res_partner, sri_distribution_batch,';
  RAISE NOTICE '          sri_client_download, sri_xml_downloaded,';
  RAISE NOTICE '          sri_download_error_log';
END $$;
