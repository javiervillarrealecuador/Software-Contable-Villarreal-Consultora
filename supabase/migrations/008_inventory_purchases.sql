-- =============================================================================
-- 008_inventory_purchases.sql
-- Módulo: Inventario (Promedio Ponderado) + Compras
-- Depende de: 001_capa0_foundation_fixed.sql
-- =============================================================================


-- =============================================================================
-- 0. COLUMNA taxpayer_type EN res_partner (requerida por retenciones)
-- =============================================================================

ALTER TABLE public.res_partner
  ADD COLUMN IF NOT EXISTS taxpayer_type VARCHAR(40) DEFAULT 'regimen_general';


-- =============================================================================
-- 1. stock_location  — Ubicaciones de inventario
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_location (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(120)  NOT NULL,
    usage       VARCHAR(20)   NOT NULL DEFAULT 'internal',
    --  'internal'  → bodega propia (afecta stock)
    --  'supplier'  → origen virtual para compras
    --  'customer'  → destino virtual para ventas
    --  'inventory' → origen/destino para ajustes
    --  'transit'   → tránsito entre bodegas
    company_id  BIGINT        REFERENCES public.res_company(id) ON DELETE SET NULL,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT stock_location_usage_check
        CHECK (usage IN ('internal','supplier','customer','inventory','transit'))
);

CREATE INDEX IF NOT EXISTS idx_stock_location_usage
    ON public.stock_location(usage, active);

-- Columnas que pueden faltar si la tabla ya existía de un intento previo
ALTER TABLE public.stock_location ADD COLUMN IF NOT EXISTS company_id  BIGINT      REFERENCES public.res_company(id) ON DELETE SET NULL;
ALTER TABLE public.stock_location ADD COLUMN IF NOT EXISTS active      BOOLEAN     NOT NULL DEFAULT TRUE;
ALTER TABLE public.stock_location ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Garantizar UNIQUE en name para que ON CONFLICT DO NOTHING funcione
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.stock_location'::regclass
          AND contype = 'u'
          AND conname = 'stock_location_name_unique'
    ) THEN
        ALTER TABLE public.stock_location ADD CONSTRAINT stock_location_name_unique UNIQUE (name);
    END IF;
END $$;

-- Ubicaciones base (se insertan una sola vez)
INSERT INTO public.stock_location (name, usage, company_id) VALUES
    ('Bodega Principal',      'internal',  1),
    ('Proveedores',           'supplier',  NULL),
    ('Clientes',              'customer',  NULL),
    ('Ajuste de Inventario',  'inventory', NULL),
    ('Tránsito',              'transit',   NULL)
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- 2. stock_quant  — Saldo actual por producto / empresa / ubicación
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_quant (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT        NOT NULL REFERENCES public.product_product(id) ON DELETE RESTRICT,
    company_id  BIGINT        NOT NULL REFERENCES public.res_company(id)     ON DELETE CASCADE,
    location_id BIGINT        NOT NULL REFERENCES public.stock_location(id)  ON DELETE RESTRICT,
    quantity    NUMERIC(14,4) NOT NULL DEFAULT 0,
    avg_cost    NUMERIC(16,6) NOT NULL DEFAULT 0,

    CONSTRAINT stock_quant_unique UNIQUE (product_id, company_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_quant_product
    ON public.stock_quant(product_id, company_id);


-- =============================================================================
-- 3. stock_move  — Kardex: movimientos con saldos acumulados
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_move (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT        NOT NULL REFERENCES public.res_company(id)    ON DELETE CASCADE,
    product_id            BIGINT        NOT NULL REFERENCES public.product_product(id) ON DELETE RESTRICT,
    move_type             VARCHAR(10)   NOT NULL,
    --  'in'  → entrada (compra, ajuste positivo)
    --  'out' → salida  (venta, ajuste negativo)

    -- Datos del movimiento
    quantity              NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost             NUMERIC(16,6) NOT NULL DEFAULT 0,
    total_cost            NUMERIC(16,4) NOT NULL DEFAULT 0,

    -- Saldos acumulados (promedio ponderado) — calculados en código
    balance_qty           NUMERIC(14,4) NOT NULL DEFAULT 0,
    balance_avg_cost      NUMERIC(16,6) NOT NULL DEFAULT 0,
    balance_total         NUMERIC(16,4) NOT NULL DEFAULT 0,

    -- Trazabilidad
    date                  DATE          NOT NULL,
    reference             VARCHAR(120),
    location_internal_id  BIGINT        REFERENCES public.stock_location(id),
    location_virtual_id   BIGINT        REFERENCES public.stock_location(id),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT stock_move_type_check CHECK (move_type IN ('in','out'))
);

CREATE INDEX IF NOT EXISTS idx_stock_move_product_date
    ON public.stock_move(product_id, company_id, date, id);


-- =============================================================================
-- 4. purchase_order  — Órdenes de compra
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_order (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(30)    NOT NULL,          -- PO/2025/000001
    company_id      BIGINT         NOT NULL REFERENCES public.res_company(id)  ON DELETE CASCADE,
    partner_id      BIGINT         NOT NULL REFERENCES public.res_partner(id)  ON DELETE RESTRICT,

    date_order      DATE           NOT NULL,
    invoice_ref     VARCHAR(30),                       -- 001-001-000000001
    invoice_auth    VARCHAR(49),                       -- Clave de acceso SRI (49 dígitos)

    state           VARCHAR(20)    NOT NULL DEFAULT 'draft',
    --  'draft'    → borrador
    --  'received' → mercadería recibida, inventario actualizado
    --  'cancel'   → anulada

    amount_untaxed  NUMERIC(14,2)  NOT NULL DEFAULT 0,
    amount_tax      NUMERIC(14,2)  NOT NULL DEFAULT 0,
    amount_total    NUMERIC(14,2)  NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT purchase_order_state_check
        CHECK (state IN ('draft','received','cancel'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_company_state
    ON public.purchase_order(company_id, state, id DESC);


-- =============================================================================
-- 5. purchase_order_line  — Líneas de la orden de compra
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_line (
    id             BIGSERIAL PRIMARY KEY,
    order_id       BIGINT         NOT NULL REFERENCES public.purchase_order(id)  ON DELETE CASCADE,
    product_id     BIGINT         NOT NULL REFERENCES public.product_product(id) ON DELETE RESTRICT,

    quantity       NUMERIC(14,4)  NOT NULL DEFAULT 1  CHECK (quantity > 0),
    qty_received   NUMERIC(14,4)  NOT NULL DEFAULT 0,
    price_unit     NUMERIC(16,6)  NOT NULL DEFAULT 0,
    iva_rate       NUMERIC(5,2)   NOT NULL DEFAULT 15, -- 0 / 5 / 15
    price_subtotal NUMERIC(14,2)  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchase_line_order
    ON public.purchase_order_line(order_id);


-- =============================================================================
-- 6. RLS (Row Level Security) — política abierta para desarrollo
--    En producción reemplazar con políticas basadas en company_id del usuario
-- =============================================================================

ALTER TABLE public.stock_location      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_quant         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_move          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_line ENABLE ROW LEVEL SECURITY;

-- Políticas temporales (permiten todo a usuarios autenticados y anon)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'stock_location' AND policyname = 'dev_all_stock_location'
    ) THEN
        CREATE POLICY dev_all_stock_location      ON public.stock_location      FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY dev_all_stock_quant         ON public.stock_quant         FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY dev_all_stock_move          ON public.stock_move          FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY dev_all_purchase_order      ON public.purchase_order      FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY dev_all_purchase_order_line ON public.purchase_order_line FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- =============================================================================
-- 7. VERIFICACIÓN FINAL
-- =============================================================================

DO $$
DECLARE
    v_locations   INT;
BEGIN
    SELECT COUNT(*) INTO v_locations FROM public.stock_location;
    RAISE NOTICE '✓ stock_location:       % filas', v_locations;
    RAISE NOTICE '✓ stock_quant:          tabla creada';
    RAISE NOTICE '✓ stock_move:           tabla creada (Kardex)';
    RAISE NOTICE '✓ purchase_order:       tabla creada';
    RAISE NOTICE '✓ purchase_order_line:  tabla creada';
    RAISE NOTICE '✓ res_partner.taxpayer_type: columna agregada';
    RAISE NOTICE '→ Módulo Inventario + Compras listo.';
END $$;
