-- Drop old strict policies
DROP POLICY IF EXISTS "company_rent_rule_account_access" ON public.company_rent_rule_account;
DROP POLICY IF EXISTS "company_iva_rule_account_access" ON public.company_iva_rule_account;

-- Create open dev policies
CREATE POLICY "dev_all_company_rent_rule_account" ON public.company_rent_rule_account FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all_company_iva_rule_account" ON public.company_iva_rule_account FOR ALL USING (true) WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
