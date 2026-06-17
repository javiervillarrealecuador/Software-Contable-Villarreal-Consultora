-- =============================================================================
-- 032_accounting_products_partners.sql
-- Integración Contable: Cuentas para Productos y Partners
-- =============================================================================

-- 1. Añadir cuentas de ingreso y gasto a product_template
ALTER TABLE public.product_template
    ADD COLUMN IF NOT EXISTS income_account_id BIGINT REFERENCES public.account_account(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expense_account_id BIGINT REFERENCES public.account_account(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_template.income_account_id IS 'Cuenta contable de ingresos (ej. 4.01.01 Venta de Bienes o 4.01.02 Prestación de Servicios)';
COMMENT ON COLUMN public.product_template.expense_account_id IS 'Cuenta contable de gastos/costos (ej. Costo de Ventas)';

-- 2. Añadir cuentas por cobrar y por pagar a res_partner
ALTER TABLE public.res_partner
    ADD COLUMN IF NOT EXISTS property_account_receivable_id BIGINT REFERENCES public.account_account(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS property_account_payable_id BIGINT REFERENCES public.account_account(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.res_partner.property_account_receivable_id IS 'Cuenta contable por cobrar (ej. 1.01.02.01 Clientes Locales)';
COMMENT ON COLUMN public.res_partner.property_account_payable_id IS 'Cuenta contable por pagar (ej. Proveedores Locales)';

-- Refrescar el esquema en postgrest
NOTIFY pgrst, 'reload schema';
