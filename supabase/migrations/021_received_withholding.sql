-- 021_received_withholding.sql
-- Retenciones RECIBIDAS de clientes.
--
-- POR QUÉ esta tabla es separada de l10n_ec_withhold:
--   l10n_ec_withhold registra las retenciones que NOSOTROS EMITIMOS a nuestros
--   proveedores (compramos → retenemos). Esta tabla registra las retenciones que
--   nuestros CLIENTES NOS HACEN a nosotros cuando les vendemos (ellos son agentes
--   de retención designados por el SRI). La diferencia es la dirección del flujo:
--
--   l10n_ec_withhold:          Empresa → retiene al proveedor → reduce A/P
--   sale_received_withholding: Cliente → retiene a la empresa  → reduce A/R
--
-- Los campos valorRetIva y valorRetRenta del ATS ventas (sección <ventas>) se
-- alimentan exclusivamente de esta tabla.

CREATE TABLE IF NOT EXISTS sale_received_withholding (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES res_company(id),
  -- Venta de referencia (opcional; puede existir la retención sin venta registrada)
  sale_order_id INTEGER REFERENCES sale_order(id),
  -- Cliente que nos retiene (agente de retención)
  partner_id    INTEGER REFERENCES res_partner(id),
  date          DATE NOT NULL,

  -- Número y autorización del comprobante de retención EMITIDO POR EL CLIENTE
  ret_number    TEXT,           -- ej. 001-001-000000042
  ret_auth      TEXT,           -- clave de acceso de 49 dígitos o autorización SRI

  -- Bases e impuestos retenidos (positivos, representan lo que nos descontaron)
  base_renta    NUMERIC(14,4) NOT NULL DEFAULT 0,
  base_iva      NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_ret_renta NUMERIC(14,4) NOT NULL DEFAULT 0,  -- retención IR aplicada
  valor_ret_iva   NUMERIC(14,4) NOT NULL DEFAULT 0,  -- retención IVA aplicada

  state         TEXT NOT NULL DEFAULT 'registered'
                     CHECK (state IN ('registered', 'cancel')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para las consultas del ATS (busca por empresa + período)
CREATE INDEX IF NOT EXISTS idx_srw_company_date
  ON sale_received_withholding(company_id, date);
