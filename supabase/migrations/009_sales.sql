-- =============================================================================
-- 009_sales.sql
-- CAPA 4: Ventas (espejo de Compras)
-- Depende de: 001_capa0_foundation_fixed.sql y 008_inventory_purchases.sql
-- =============================================================================


-- =============================================================================
-- 1. sale_order  — Facturas / órdenes de venta
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sale_order (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(30)    NOT NULL,          -- SO/2026/000001
    company_id      BIGINT         NOT NULL REFERENCES public.res_company(id)  ON DELETE CASCADE,
    partner_id      BIGINT         NOT NULL REFERENCES public.res_partner(id)  ON DELETE RESTRICT,

    date_order      DATE           NOT NULL,
    invoice_ref     VARCHAR(30),                       -- 001-001-000000001 (n° de factura emitida)
    invoice_auth    VARCHAR(49),                       -- Clave de acceso SRI (49 dígitos)

    state           VARCHAR(20)    NOT NULL DEFAULT 'draft',
    --  'draft'     → borrador
    --  'delivered' → mercadería entregada, inventario descargado a costo promedio
    --  'cancel'    → anulada

    amount_untaxed  NUMERIC(14,2)  NOT NULL DEFAULT 0,
    amount_tax      NUMERIC(14,2)  NOT NULL DEFAULT 0,
    amount_total    NUMERIC(14,2)  NOT NULL DEFAULT 0,

    -- Costo total de la mercadería entregada (a promedio ponderado)
    -- Se llena al entregar; permite calcular margen bruto = amount_untaxed - cost_total
    cost_total      NUMERIC(14,2)  NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT sale_order_state_check
        CHECK (state IN ('draft','delivered','cancel'))
);

CREATE INDEX IF NOT EXISTS idx_sale_order_company_state
    ON public.sale_order(company_id, state, id DESC);


-- =============================================================================
-- 2. sale_order_line  — Líneas de la venta
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sale_order_line (
    id             BIGSERIAL PRIMARY KEY,
    order_id       BIGINT         NOT NULL REFERENCES public.sale_order(id)      ON DELETE CASCADE,
    product_id     BIGINT         NOT NULL REFERENCES public.product_product(id) ON DELETE RESTRICT,

    quantity       NUMERIC(14,4)  NOT NULL DEFAULT 1  CHECK (quantity > 0),
    qty_delivered  NUMERIC(14,4)  NOT NULL DEFAULT 0,
    price_unit     NUMERIC(16,6)  NOT NULL DEFAULT 0,
    iva_rate       NUMERIC(5,2)   NOT NULL DEFAULT 15, -- 0 / 5 / 15
    price_subtotal NUMERIC(14,2)  NOT NULL DEFAULT 0,

    -- Costo unitario promedio al momento de la entrega (para margen por línea)
    cost_unit      NUMERIC(16,6)  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_line_order
    ON public.sale_order_line(order_id);


-- =============================================================================
-- 3. RLS — política abierta para desarrollo (igual que capa 3)
--    En producción reemplazar con políticas basadas en company_id del usuario
-- =============================================================================

ALTER TABLE public.sale_order      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_order_line ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sale_order' AND policyname = 'dev_all_sale_order'
    ) THEN
        CREATE POLICY dev_all_sale_order      ON public.sale_order      FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY dev_all_sale_order_line ON public.sale_order_line FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- =============================================================================
-- 4. VERIFICACIÓN FINAL
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ sale_order:       tabla creada';
    RAISE NOTICE '✓ sale_order_line:  tabla creada';
    RAISE NOTICE '→ CAPA 4 (Ventas) lista. La entrega descarga inventario a costo promedio.';
END $$;
