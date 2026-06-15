-- =============================================================================
-- 015_accounting_integration.sql
-- Integración contable de ventas y compras:
-- columna de trazabilidad documento → asiento contable.
-- Idempotente.
-- =============================================================================

ALTER TABLE public.sale_order
    ADD COLUMN IF NOT EXISTS account_move_id BIGINT REFERENCES public.account_move(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_order
    ADD COLUMN IF NOT EXISTS account_move_id BIGINT REFERENCES public.account_move(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Columnas account_move_id agregadas a sale_order y purchase_order.';
END $$;
