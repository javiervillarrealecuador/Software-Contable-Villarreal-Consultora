-- 028_purchase_invoice_fields.sql
-- Nuevos campos para la factura de compra detallada

ALTER TABLE public.purchase_order 
  ADD COLUMN IF NOT EXISTS tipo_comprobante VARCHAR(2) DEFAULT '01',
  ADD COLUMN IF NOT EXISTS sustento_tributario VARCHAR(2) DEFAULT '01',
  ADD COLUMN IF NOT EXISTS amount_no_iva NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_exento_iva NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Asegurarnos de que los comentarios documenten el uso
COMMENT ON COLUMN public.purchase_order.tipo_comprobante IS '01 Factura, 03 Liquidación...';
COMMENT ON COLUMN public.purchase_order.sustento_tributario IS '01 Crédito tributario, 02 Costo/gasto...';

ALTER TABLE public.purchase_order_line
  ADD COLUMN IF NOT EXISTS discount NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_id INTEGER;
