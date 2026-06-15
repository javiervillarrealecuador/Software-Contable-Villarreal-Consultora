-- ============================================================
-- MIGRACIÓN 004 — Firma electrónica multiempresa en res_company
-- ============================================================
-- Propósito: permitir que cada empresa almacene su propio
-- certificado .p12 (firma electrónica del SRI) directamente
-- en la base de datos, eliminando la dependencia de .env.local
-- para entornos multiempresa.
--
-- SEGURIDAD: sri_p12_pwd se almacena como texto. En producción
-- se recomienda cifrar con pgcrypto (extensión de Supabase) o
-- mover a un Secret Manager externo. La columna está marcada
-- con COMMENT para que sea visible en auditorías.
-- ============================================================

ALTER TABLE res_company
  -- Certificado .p12 codificado en base64 (puede ser varios KB)
  ADD COLUMN IF NOT EXISTS sri_p12_b64       TEXT,

  -- Contraseña del .p12 (proteger con RLS en producción)
  ADD COLUMN IF NOT EXISTS sri_p12_pwd       TEXT,

  -- Fecha de expiración del certificado (extraída al subir)
  ADD COLUMN IF NOT EXISTS sri_firma_expira  DATE,

  -- Nombre/RUC del titular del certificado (extraído al subir)
  ADD COLUMN IF NOT EXISTS sri_firma_razon   TEXT,

  -- Logo de la empresa en base64 para el RIDE
  ADD COLUMN IF NOT EXISTS sri_logo_b64      TEXT,

  -- Correo por defecto para envío de comprobantes
  ADD COLUMN IF NOT EXISTS sri_email_envio   TEXT;

COMMENT ON COLUMN res_company.sri_p12_b64
  IS 'Certificado .p12 del SRI en base64. Nunca exponer en queries públicas.';

COMMENT ON COLUMN res_company.sri_p12_pwd
  IS 'Contraseña del .p12. Considerar cifrar con pgcrypto en producción.';

-- Insertar empresa SEMICAR si no existe
INSERT INTO res_company (
  name,
  vat,
  active,
  sri_ambiente,
  sri_estab,
  sri_pto_emi,
  sri_obligado_contab,
  currency_id
)
SELECT
  'SEMICAR',
  '0400000000001',   -- RUC temporal — actualizar con el real
  true,
  1,                 -- Pruebas por defecto
  '001',
  '001',
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM res_company WHERE name = 'SEMICAR'
);
