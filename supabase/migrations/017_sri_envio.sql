-- =============================================================================
-- 017_sri_envio.sql
-- FASE 3: estado del comprobante electrónico ante el SRI, por venta.
--
-- Ciclo de estados del SRI:
--   (sin enviar) → RECIBIDA (recepción) → AUTORIZADO / NO AUTORIZADO
--   o DEVUELTA (rechazo en recepción, con mensajes de error)
-- Idempotente.
-- =============================================================================

ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS sri_estado        VARCHAR(20);
-- 'RECIBIDA' | 'DEVUELTA' | 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO'
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS sri_autorizacion  VARCHAR(49);   -- nro autorización (= clave de acceso en esquema offline)
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS sri_fecha_aut     TIMESTAMPTZ;
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS sri_ambiente      SMALLINT;      -- 1 pruebas / 2 producción (con el que se envió)
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS sri_mensajes      TEXT;          -- errores/advertencias devueltos por el SRI

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Columnas de estado SRI agregadas a sale_order.';
END $$;
