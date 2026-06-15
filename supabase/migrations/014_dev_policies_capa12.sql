-- =============================================================================
-- 014_dev_policies_capa12.sql
-- Políticas RLS de desarrollo para las tablas de CAPA 1 (Contabilidad)
-- y CAPA 2 (Tributación), que fueron creadas directamente en Supabase
-- sin archivo de migración en el repositorio.
--
-- Mismo criterio que 010/011: verificación individual e idempotente por
-- tabla. Si una tabla no existe, se omite sin error.
-- EN PRODUCCIÓN: reemplazar por políticas basadas en company_id del usuario.
-- =============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'account_account','account_account_type','account_journal',
        'account_move','account_move_line','account_tax',
        'l10n_ec_rent_rule','l10n_ec_iva_rule',
        'l10n_ec_withhold','l10n_ec_withhold_line'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            IF NOT EXISTS (SELECT 1 FROM pg_policies
                           WHERE schemaname = 'public' AND tablename = t
                             AND cmd = 'ALL') THEN
                EXECUTE format(
                  'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                  'dev_all_' || t, t);
                RAISE NOTICE '✓ Política creada para %', t;
            ELSE
                RAISE NOTICE '· % ya tenía política FOR ALL', t;
            END IF;
        ELSE
            RAISE NOTICE '! Tabla % NO EXISTE — revisar si la capa fue desplegada', t;
        END IF;
    END LOOP;

    RAISE NOTICE '→ Escritura habilitada en CAPAS 1 y 2 (modo desarrollo).';
END $$;

-- Recargar schema cache de la API
NOTIFY pgrst, 'reload schema';
