-- =============================================================================
-- 033_company_accounting_settings.sql
-- Integración Contable: Cuentas globales de impuestos por empresa
-- =============================================================================

ALTER TABLE public.res_company
  ADD COLUMN account_sale_tax_id INT REFERENCES public.account_account(id) ON DELETE SET NULL,
  ADD COLUMN account_purchase_tax_id INT REFERENCES public.account_account(id) ON DELETE SET NULL,
  ADD COLUMN account_withholding_rent_id INT REFERENCES public.account_account(id) ON DELETE SET NULL,
  ADD COLUMN account_withholding_iva_id INT REFERENCES public.account_account(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.res_company.account_sale_tax_id IS 'Cuenta para IVA Ventas (Cobrado)';
COMMENT ON COLUMN public.res_company.account_purchase_tax_id IS 'Cuenta para IVA Compras (Pagado)';
COMMENT ON COLUMN public.res_company.account_withholding_rent_id IS 'Cuenta para Retenciones de Renta';
COMMENT ON COLUMN public.res_company.account_withholding_iva_id IS 'Cuenta para Retenciones de IVA';

-- Refrescar el esquema en postgrest
NOTIFY pgrst, 'reload schema';
