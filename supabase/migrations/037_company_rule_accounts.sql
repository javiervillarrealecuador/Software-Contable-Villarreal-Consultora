-- =============================================================================
-- 037_company_rule_accounts.sql
-- Tablas para asignar una cuenta contable a cada regla de retencion por empresa
-- =============================================================================

-- Mapeo de reglas de Renta a Cuentas Contables por Empresa
CREATE TABLE IF NOT EXISTS public.company_rent_rule_account (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.res_company(id) ON DELETE CASCADE,
  rent_rule_id BIGINT NOT NULL REFERENCES public.l10n_ec_rent_rule(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES public.account_account(id) ON DELETE CASCADE,
  UNIQUE(company_id, rent_rule_id)
);

-- Mapeo de reglas de IVA a Cuentas Contables por Empresa
CREATE TABLE IF NOT EXISTS public.company_iva_rule_account (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.res_company(id) ON DELETE CASCADE,
  iva_rule_id BIGINT NOT NULL REFERENCES public.l10n_ec_iva_rule(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES public.account_account(id) ON DELETE CASCADE,
  UNIQUE(company_id, iva_rule_id)
);

-- RLS
ALTER TABLE public.company_rent_rule_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_iva_rule_account ENABLE ROW LEVEL SECURITY;

-- Politicas
CREATE POLICY "company_rent_rule_account_access" ON public.company_rent_rule_account
  FOR ALL USING (
    company_id IN (
      SELECT COALESCE(company_ids[1], company_id)::BIGINT
      FROM public.res_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_iva_rule_account_access" ON public.company_iva_rule_account
  FOR ALL USING (
    company_id IN (
      SELECT COALESCE(company_ids[1], company_id)::BIGINT
      FROM public.res_users 
      WHERE id = auth.uid()
    )
  );

-- Notificar a postgrest
NOTIFY pgrst, 'reload schema';
