-- 034_received_withholding_accounting.sql
-- Agrega columna para enlace contable a las retenciones recibidas

ALTER TABLE public.sale_received_withholding
  ADD COLUMN account_move_id INT REFERENCES public.account_move(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sale_received_withholding.account_move_id IS 'Enlace al asiento contable generado para esta retención';

-- Refrescar el esquema en postgrest
NOTIFY pgrst, 'reload schema';
