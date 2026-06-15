-- =============================================================================
-- 010_dev_policies_capa0.sql
-- Políticas RLS abiertas (desarrollo) para las tablas de CAPA 0.
--
-- PROBLEMA: 001_capa0 habilitó RLS con políticas SOLO de SELECT (y atadas a
-- auth.uid()). Sin política de INSERT/UPDATE, Supabase rechaza toda escritura
-- hecha con la clave anónima → "Error al guardar" al crear partners/productos.
--
-- SOLUCIÓN DEV: política FOR ALL (igual que capas 3 y 4).
-- EN PRODUCCIÓN: reemplazar por políticas basadas en company_id del usuario.
-- =============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['res_partner','product_template','product_product','res_company','uom_uom']
    LOOP
        -- Solo si la tabla existe
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            IF NOT EXISTS (SELECT 1 FROM pg_policies
                           WHERE schemaname = 'public' AND tablename = t
                             AND policyname = 'dev_all_' || t) THEN
                EXECUTE format(
                  'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                  'dev_all_' || t, t);
                RAISE NOTICE '✓ Política dev_all_% creada', t;
            ELSE
                RAISE NOTICE '· Política dev_all_% ya existía', t;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE '→ Escritura habilitada en CAPA 0 (modo desarrollo).';
END $$;
