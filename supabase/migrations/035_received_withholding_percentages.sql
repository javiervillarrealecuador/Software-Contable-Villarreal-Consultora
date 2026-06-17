-- Agrega columnas de porcentaje de retencion
ALTER TABLE public.sale_received_withholding
  ADD COLUMN porcentaje_renta NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN porcentaje_iva NUMERIC(14,4) DEFAULT 0;

COMMENT ON COLUMN public.sale_received_withholding.porcentaje_renta IS 'Porcentaje de retencion de renta (referencial)';
COMMENT ON COLUMN public.sale_received_withholding.porcentaje_iva IS 'Porcentaje de retencion de IVA (referencial)';

NOTIFY pgrst, 'reload schema';
