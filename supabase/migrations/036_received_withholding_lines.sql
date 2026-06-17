-- 036_received_withholding_lines.sql
-- Detalle de las lineas de retencion recibidas de clientes

CREATE TABLE IF NOT EXISTS sale_received_withholding_line (
  id                  BIGSERIAL PRIMARY KEY,
  withholding_id      INTEGER NOT NULL REFERENCES sale_received_withholding(id) ON DELETE CASCADE,
  tax_type            INTEGER NOT NULL, -- 1=Renta, 2=IVA, 6=ISD
  retention_code      TEXT NOT NULL,    -- ej. 312, 332, 70%
  base_amount         NUMERIC(14,4) NOT NULL DEFAULT 0,
  retention_percent   NUMERIC(14,4) NOT NULL DEFAULT 0,
  retention_amount    NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srw_line_withholding_id ON sale_received_withholding_line(withholding_id);

NOTIFY pgrst, 'reload schema';
