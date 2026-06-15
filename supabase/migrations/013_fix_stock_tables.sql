-- =============================================================================
-- 013_fix_stock_tables.sql
-- Completa TODAS las columnas de stock_quant y stock_move (tablas que
-- existían con estructura antigua) y la restricción única que requiere
-- el upsert del promedio ponderado (onConflict: product_id,company_id,location_id).
-- Idempotente.
-- =============================================================================

-- ── stock_quant: columnas completas ──
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS product_id  BIGINT REFERENCES public.product_product(id);
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS company_id  BIGINT REFERENCES public.res_company(id);
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES public.stock_location(id);
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS quantity    NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS avg_cost    NUMERIC(16,6) NOT NULL DEFAULT 0;

-- Restricción única requerida por el upsert (ON CONFLICT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.stock_quant'::regclass
          AND contype = 'u'
          AND conname = 'stock_quant_unique'
    ) THEN
        -- Eliminar filas inválidas (sin claves) antes de crear la restricción
        DELETE FROM public.stock_quant
        WHERE product_id IS NULL OR company_id IS NULL OR location_id IS NULL;

        ALTER TABLE public.stock_quant
            ADD CONSTRAINT stock_quant_unique UNIQUE (product_id, company_id, location_id);
        RAISE NOTICE '✓ stock_quant_unique creada';
    END IF;
END $$;

-- ── stock_move: columnas completas ──
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS company_id           BIGINT REFERENCES public.res_company(id);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS product_id           BIGINT REFERENCES public.product_product(id);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS move_type            VARCHAR(10);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS quantity             NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS unit_cost            NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS total_cost           NUMERIC(16,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_qty          NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_avg_cost     NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_total        NUMERIC(16,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS date                 DATE;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS reference            VARCHAR(120);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS location_internal_id BIGINT REFERENCES public.stock_location(id);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS location_virtual_id  BIGINT REFERENCES public.stock_location(id);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Ubicaciones base (por si la tabla existía sin datos) ──
INSERT INTO public.stock_location (name, usage, company_id)
SELECT v.name, v.usage, v.company_id
FROM (VALUES
    ('Bodega Principal',     'internal',  1::BIGINT),
    ('Proveedores',          'supplier',  NULL),
    ('Clientes',             'customer',  NULL),
    ('Ajuste de Inventario', 'inventory', NULL),
    ('Tránsito',             'transit',   NULL)
) AS v(name, usage, company_id)
WHERE NOT EXISTS (SELECT 1 FROM public.stock_location sl WHERE sl.name = v.name);

-- ── Recargar schema cache de la API ──
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ stock_quant y stock_move completos; ubicaciones verificadas.';
END $$;
