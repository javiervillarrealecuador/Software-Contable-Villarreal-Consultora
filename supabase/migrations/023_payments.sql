-- 023_payments.sql
-- Registro de pagos (cobros CxC y pagos CxP)
-- Lógica: cada pago referencia un sale_order (cobro) o purchase_order (pago)
-- y actualiza el campo amount_paid del documento.

-- Saldo pagado en ventas
ALTER TABLE sale_order
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Saldo pagado en compras
ALTER TABLE purchase_order
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Tabla de pagos / cobros
CREATE TABLE IF NOT EXISTS account_payment (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER NOT NULL REFERENCES res_company(id),
  partner_id       INTEGER NOT NULL REFERENCES res_partner(id),
  payment_type     TEXT NOT NULL DEFAULT 'inbound',  -- inbound=cobro CxC | outbound=pago CxP
  payment_method   TEXT NOT NULL DEFAULT 'E',        -- E=Efectivo B=Cheque D=Depósito T=Tarjeta X=Cruce
  date             DATE NOT NULL,
  amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference        TEXT,                             -- N° cheque, comprobante, transacción
  notes            TEXT,
  state            TEXT NOT NULL DEFAULT 'posted',   -- posted | cancelled
  sale_order_id    INTEGER REFERENCES sale_order(id),
  purchase_order_id INTEGER REFERENCES purchase_order(id),
  account_move_id  INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_company  ON account_payment(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_sale     ON account_payment(sale_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_purchase ON account_payment(purchase_order_id);

ALTER TABLE account_payment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_payment" ON account_payment FOR ALL USING (true) WITH CHECK (true);
