-- =============================================================================
-- 011_dev_policies_capa34.sql
-- Repara políticas RLS de desarrollo en CAPAS 3 y 4, tabla por tabla.
--
-- PROBLEMA: 008 y 009 creaban TODAS sus políticas dentro de un solo
-- IF NOT EXISTS sobre la primera tabla. Si esa política ya existía de un
-- intento previo, el bloque entero se saltaba y las demás tablas quedaban
-- con RLS habilitado pero sin política → "new row violates row-level
-- security policy".
--
-- SOLUCIÓN: verificación individual e idempotente por tabla.
-- EN PRODUCCIÓN: reemplazar por políticas basadas en company_id del usuario.
-- =============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'stock_location','stock_quant','stock_move',
        'purchase_order','purchase_order_line',
        'sale_order','sale_order_line'
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
                  'dev_all_' || t || '_fix', t);
                RAISE NOTICE '✓ Política creada para %', t;
            ELSE
                RAISE NOTICE '· % ya tenía política FOR ALL', t;
            END IF;
        END IF;
    END LOOP;
    RAISE NOTICE '→ Escritura habilitada en CAPAS 3 y 4 (modo desarrollo).';
END $$;
