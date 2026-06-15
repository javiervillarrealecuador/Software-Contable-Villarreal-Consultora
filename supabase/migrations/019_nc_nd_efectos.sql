-- =============================================================================
-- 019_nc_nd_efectos.sql
-- Efectos internos de NC/ND:
--  1. Cuentas 4.03 / 4.03.01 'Otros Ingresos - Intereses y Recargos' (para ND).
--     TÉCNICA: clona la fila completa de una cuenta existente (%ROWTYPE) y
--     cambia código y nombre. Así no dependemos del esquema exacto de
--     account_account, que fue creada fuera del repositorio.
--  2. Trazabilidad de la NC en la venta (clave + asiento de reverso).
-- Idempotente.
-- =============================================================================

DO $$
DECLARE
    src public.account_account%ROWTYPE;
BEGIN
    -- Grupo 4.03 OTROS INGRESOS (clon de 4.01)
    IF NOT EXISTS (SELECT 1 FROM public.account_account WHERE code = '4.03' AND company_id = 1) THEN
        SELECT * INTO src FROM public.account_account WHERE code = '4.01' AND company_id = 1 LIMIT 1;
        IF FOUND THEN
            src.id   := nextval(pg_get_serial_sequence('public.account_account', 'id'));
            src.code := '4.03';
            src.name := 'OTROS INGRESOS';
            INSERT INTO public.account_account VALUES (src.*);
            RAISE NOTICE '✓ Grupo 4.03 creado';
        END IF;
    END IF;

    -- Cuenta de movimiento 4.03.01 (clon de 4.01.01)
    IF NOT EXISTS (SELECT 1 FROM public.account_account WHERE code = '4.03.01' AND company_id = 1) THEN
        SELECT * INTO src FROM public.account_account WHERE code = '4.01.01' AND company_id = 1 LIMIT 1;
        IF FOUND THEN
            src.id   := nextval(pg_get_serial_sequence('public.account_account', 'id'));
            src.code := '4.03.01';
            src.name := 'Otros Ingresos - Intereses y Recargos';
            INSERT INTO public.account_account VALUES (src.*);
            RAISE NOTICE '✓ Cuenta 4.03.01 creada';
        END IF;
    END IF;
END $$;

-- ── Trazabilidad NC en la venta ──
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS nc_clave_acceso     VARCHAR(49);
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS nc_account_move_id  BIGINT REFERENCES public.account_move(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Migración 019 aplicada: cuenta ND + columnas NC.';
END $$;
