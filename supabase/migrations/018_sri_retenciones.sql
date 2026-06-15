-- =============================================================================
-- 018_sri_retenciones.sql
-- Estado de la retención electrónica ante el SRI. Idempotente.
-- =============================================================================

ALTER TABLE public.l10n_ec_withhold ADD COLUMN IF NOT EXISTS sri_estado        VARCHAR(20);
ALTER TABLE public.l10n_ec_withhold ADD COLUMN IF NOT EXISTS sri_clave_acceso  VARCHAR(49);
ALTER TABLE public.l10n_ec_withhold ADD COLUMN IF NOT EXISTS sri_mensajes      TEXT;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Columnas SRI agregadas a l10n_ec_withhold.';
END $$;
