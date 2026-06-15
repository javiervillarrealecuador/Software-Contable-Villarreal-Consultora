-- =============================================================================
-- 012_fix_missing_columns.sql
-- Completa columnas faltantes en tablas de CAPAS 3 y 4.
--
-- PROBLEMA: CREATE TABLE IF NOT EXISTS no modifica tablas ya existentes.
-- Si una tabla quedó creada a medias en un intento previo, faltan columnas
-- (ej. purchase_order_line.price_subtotal) → "Could not find the column".
--
-- SOLUCIÓN: ADD COLUMN IF NOT EXISTS para cada columna esperada.
-- Es idempotente: puede ejecutarse varias veces sin efecto adicional.
-- =============================================================================

-- ── purchase_order ──
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS invoice_ref     VARCHAR(30);
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS invoice_auth    VARCHAR(49);
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS state           VARCHAR(20)   NOT NULL DEFAULT 'draft';
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS amount_untaxed  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS amount_tax      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS amount_total    NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- ── purchase_order_line ──
ALTER TABLE public.purchase_order_line ADD COLUMN IF NOT EXISTS quantity       NUMERIC(14,4) NOT NULL DEFAULT 1;
ALTER TABLE public.purchase_order_line ADD COLUMN IF NOT EXISTS qty_received   NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order_line ADD COLUMN IF NOT EXISTS price_unit     NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order_line ADD COLUMN IF NOT EXISTS iva_rate       NUMERIC(5,2)  NOT NULL DEFAULT 15;
ALTER TABLE public.purchase_order_line ADD COLUMN IF NOT EXISTS price_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ── sale_order ──
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS invoice_ref     VARCHAR(30);
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS invoice_auth    VARCHAR(49);
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS state           VARCHAR(20)   NOT NULL DEFAULT 'draft';
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS amount_untaxed  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS amount_tax      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS amount_total    NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS cost_total      NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- ── sale_order_line ──
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS quantity       NUMERIC(14,4) NOT NULL DEFAULT 1;
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS qty_delivered  NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS price_unit     NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS iva_rate       NUMERIC(5,2)  NOT NULL DEFAULT 15;
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS price_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_order_line ADD COLUMN IF NOT EXISTS cost_unit      NUMERIC(16,6) NOT NULL DEFAULT 0;

-- ── stock_quant ──
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS quantity NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_quant ADD COLUMN IF NOT EXISTS avg_cost NUMERIC(16,6) NOT NULL DEFAULT 0;

-- ── stock_move ──
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS unit_cost            NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS total_cost           NUMERIC(16,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_qty          NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_avg_cost     NUMERIC(16,6) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS balance_total        NUMERIC(16,4) NOT NULL DEFAULT 0;
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS reference            VARCHAR(120);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS location_internal_id BIGINT REFERENCES public.stock_location(id);
ALTER TABLE public.stock_move ADD COLUMN IF NOT EXISTS location_virtual_id  BIGINT REFERENCES public.stock_location(id);

-- ── Limpieza: órdenes borrador huérfanas (cabecera sin líneas) ──
-- Quedaron de los intentos fallidos donde la cabecera se insertó pero las líneas no.
DELETE FROM public.purchase_order po
WHERE po.state = 'draft'
  AND NOT EXISTS (SELECT 1 FROM public.purchase_order_line l WHERE l.order_id = po.id);

DELETE FROM public.sale_order so
WHERE so.state = 'draft'
  AND NOT EXISTS (SELECT 1 FROM public.sale_order_line l WHERE l.order_id = so.id);

-- ── Recargar el schema cache de PostgREST (Supabase API) ──
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Columnas completadas, huérfanos eliminados, schema cache recargado.';
END $$;
