-- 022_purchase_orders.sql
-- Módulo de compras: purchase_order + purchase_order_line
-- El comprobante de retención que emite la empresa al proveedor se almacena
-- en los campos ret_* de purchase_order. Un comprobante por factura de compra.

CREATE TABLE IF NOT EXISTS purchase_order (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES res_company(id),
  partner_id          INTEGER NOT NULL REFERENCES res_partner(id),
  name                TEXT NOT NULL,                          -- PO/2025/000001
  date_order          DATE NOT NULL,
  -- Factura del proveedor (documento sustento)
  invoice_ref         TEXT,                                   -- 001-001-000000001
  invoice_auth        TEXT,                                   -- clave acceso / autorización
  invoice_date        DATE,                                   -- fecha de la factura
  -- Montos
  state               TEXT NOT NULL DEFAULT 'draft',         -- draft | confirmed | cancel
  amount_untaxed      NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_tax          NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Retención emitida (comprobante que le entregamos al proveedor)
  ret_secuencial      INTEGER,                                -- secuencial retención
  ret_numero          TEXT,                                   -- estab-pto-sec
  ret_fecha           DATE,                                   -- fecha emisión retención
  ret_periodo_fiscal  TEXT,                                   -- MM/YYYY
  ret_codigo_renta    TEXT,                                   -- código SRI renta (ej: 312)
  ret_porcentaje_renta NUMERIC(5,2) DEFAULT 0,               -- % ret. renta
  ret_base_renta      NUMERIC(14,2) DEFAULT 0,
  ret_valor_renta     NUMERIC(14,2) DEFAULT 0,
  ret_porcentaje_iva  NUMERIC(5,2) DEFAULT 0,                -- % ret. IVA (30/70/100)
  ret_base_iva        NUMERIC(14,2) DEFAULT 0,
  ret_valor_iva       NUMERIC(14,2) DEFAULT 0,
  -- Estado SRI de la retención
  ret_estado          TEXT,
  ret_autorizacion    TEXT,
  ret_ambiente        INTEGER,
  ret_fecha_aut       TIMESTAMPTZ,
  ret_xml             TEXT,                                   -- XML firmado
  -- Contabilidad
  account_move_id     INTEGER,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_line (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  product_id      INTEGER REFERENCES product_product(id),
  description     TEXT,
  quantity        NUMERIC(14,4) NOT NULL DEFAULT 1,
  price_unit      NUMERIC(14,6) NOT NULL DEFAULT 0,
  iva_rate        NUMERIC(5,2) NOT NULL DEFAULT 15,
  price_subtotal  NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_po_company ON purchase_order(company_id, date_order DESC);
CREATE INDEX IF NOT EXISTS idx_pol_order  ON purchase_order_line(order_id);

-- Habilitar RLS igual que el resto de tablas
ALTER TABLE purchase_order      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_purchase_order"      ON purchase_order      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_purchase_order_line" ON purchase_order_line FOR ALL USING (true) WITH CHECK (true);
