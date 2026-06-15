-- Migración: Tablas para el descargador centralizado de XMLs del SRI
-- Fecha: 2026-06-13
--
-- CONTEXTO:
-- El sistema descarga comprobantes electrónicos (XMLs) del portal del SRI
-- para múltiples clientes. Usa una cola centralizada que:
--   1. Accede al portal web para obtener claves de acceso (49 dígitos)
--   2. Descarga el XML vía SOAP (consultarAutorizacion)
--
-- TABLAS:
--   sri_distribution_batch   → Un batch por ejecución mensual
--   sri_client_download      → Progreso por cliente dentro de un batch
--   sri_xml_downloaded        → Cada XML descargado (clave de acceso + autorización)
--   sri_download_error_log   → Log de errores para diagnóstico y reintentos

-- ============================================================================
-- 1. Agregar columnas SRI a res_partner (credenciales del portal)
-- ============================================================================

ALTER TABLE res_partner
ADD COLUMN IF NOT EXISTS sri_user VARCHAR,
ADD COLUMN IF NOT EXISTS sri_password VARCHAR;

COMMENT ON COLUMN res_partner.sri_user IS 'Usuario del portal SRI (srienlinea.sri.gob.ec) del cliente';
COMMENT ON COLUMN res_partner.sri_password IS 'Contraseña del portal SRI del cliente';

-- ============================================================================
-- 2. sri_distribution_batch — Un registro por cada ejecución del descargador
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_distribution_batch (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_month   VARCHAR NOT NULL,              -- '2026-05', '2026-06'
  total_clients INTEGER NOT NULL DEFAULT 0,
  total_invoices INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR NOT NULL DEFAULT 'pending',  -- pending, processing, completed, error
  created_by    VARCHAR,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT
);

COMMENT ON TABLE sri_distribution_batch IS 'Cada ejecución del descargador centralizado de XMLs del SRI';

-- ============================================================================
-- 3. sri_client_download — Progreso por cliente dentro de un batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_client_download (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id        BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id      INTEGER NOT NULL DEFAULT 0,   -- 0 = centralizado
  client_id       BIGINT NOT NULL,              -- FK a res_partner.id
  client_name     VARCHAR NOT NULL,
  client_ruc      VARCHAR NOT NULL,
  total_invoices  INTEGER NOT NULL DEFAULT 0,
  downloaded      INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR NOT NULL DEFAULT 'pending',  -- pending, processing, completed, error
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  last_reported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sri_client_download_batch
  ON sri_client_download(batch_id);
CREATE INDEX IF NOT EXISTS idx_sri_client_download_status
  ON sri_client_download(batch_id, status);

COMMENT ON TABLE sri_client_download IS 'Progreso de descarga por cliente dentro de cada batch';

-- ============================================================================
-- 4. sri_xml_downloaded — Cada XML descargado exitosamente
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_xml_downloaded (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id              BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id            INTEGER NOT NULL DEFAULT 0,
  client_id             BIGINT NOT NULL,
  invoice_id            VARCHAR(49) NOT NULL,      -- clave de acceso (49 dígitos)
  xml_hash              VARCHAR,
  file_size             INTEGER DEFAULT 0,
  status                VARCHAR NOT NULL DEFAULT 'downloaded',
  numero_autorizacion   VARCHAR,
  fecha_autorizacion    VARCHAR,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint único: no descargar la misma clave de acceso dos veces en el mismo batch
ALTER TABLE sri_xml_downloaded
  ADD CONSTRAINT uq_sri_xml_batch_invoice UNIQUE (batch_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_sri_xml_downloaded_batch
  ON sri_xml_downloaded(batch_id);
CREATE INDEX IF NOT EXISTS idx_sri_xml_downloaded_client
  ON sri_xml_downloaded(batch_id, client_id);

COMMENT ON TABLE sri_xml_downloaded IS 'Registro de cada XML de comprobante descargado vía SOAP';

-- ============================================================================
-- 5. sri_download_error_log — Errores para diagnóstico
-- ============================================================================

CREATE TABLE IF NOT EXISTS sri_download_error_log (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id            BIGINT REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id          INTEGER NOT NULL DEFAULT 0,
  client_download_id  BIGINT,
  error_type          VARCHAR NOT NULL,            -- captcha, download_error, login_error, etc.
  error_message       TEXT,
  attempt_number      INTEGER,
  retry_scheduled_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sri_error_log_batch
  ON sri_download_error_log(batch_id);

COMMENT ON TABLE sri_download_error_log IS 'Log de errores del descargador para diagnóstico y reintentos';
