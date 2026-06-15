-- =============================================================================
-- 024_sales_v2_fields.sql
-- Campos adicionales para ventas: cabecera completa, desglose tributario,
-- descuento por línea, bodega por línea, UdM visible.
-- SEGURO: solo ALTER TABLE ADD COLUMN IF NOT EXISTS con defaults.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. sale_order — cabecera enriquecida
-- ─────────────────────────────────────────────────────────────────────────────

-- Vendedor asignado (referencia a res_partner que sea empleado/usuario)
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES res_partner(id) ON DELETE SET NULL;

-- Plazo y condiciones de pago
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS payment_term VARCHAR(20) NOT NULL DEFAULT 'contado';
  -- contado | credito_15 | credito_30 | credito_45 | credito_60 | credito_90

ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS payment_days INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Bodega por defecto del documento
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS warehouse_id BIGINT REFERENCES stock_location(id) ON DELETE SET NULL;

-- Campos de texto libre
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS observation TEXT;

ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS reference TEXT;

-- ─── Desglose tributario en totales ─────────────────────────────────────────

-- Subtotal solo de líneas gravadas (IVA > 0)
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_taxed NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Subtotal solo de líneas tarifa 0%
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_zero NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Subtotal No Objeto de IVA
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_no_objeto NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Subtotal Exento de IVA
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_exento NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ICE total
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_ice NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Descuento total acumulado
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_discount NUMERIC(14,2) NOT NULL DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sale_order_line — campos de grilla
-- ─────────────────────────────────────────────────────────────────────────────

-- Tipo fiscal de la línea: determina en qué casillero del desglose cae
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) NOT NULL DEFAULT 'gravado';
  -- gravado | tarifa_0 | no_objeto | exento

-- Descuento por línea (porcentaje y monto)
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ICE por línea
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS ice_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

-- PVP total con IVA (calculado: (subtotal - descuento) * (1 + iva/100) + ice)
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS price_total NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Bodega específica de la línea (override del warehouse_id de cabecera)
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES stock_location(id) ON DELETE SET NULL;

-- Descripción libre de la línea (override del nombre del producto)
ALTER TABLE sale_order_line
  ADD COLUMN IF NOT EXISTS description TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    RAISE NOTICE '✓ sale_order:      campos v2 agregados (seller, plazo, desglose tributario)';
    RAISE NOTICE '✓ sale_order_line: campos v2 agregados (tax_type, descuento, ICE, bodega)';
    RAISE NOTICE '→ Migración 024 completada. Compatible con datos existentes (todos tienen defaults).';
END $$;
