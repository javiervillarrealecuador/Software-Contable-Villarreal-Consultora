-- supabase/migrations/001_capa0_foundation_fixed.sql
-- CAPA 0: Foundation - Maestros base del ERP (CORREGIDO CON UUID)

-- 1. Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. res_country (Países)
CREATE TABLE IF NOT EXISTS public.res_country (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(2) UNIQUE NOT NULL,
    phone_code VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. res_country_state (Provincias)
CREATE TABLE IF NOT EXISTS public.res_country_state (
    id BIGSERIAL PRIMARY KEY,
    country_id BIGINT NOT NULL REFERENCES public.res_country(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country_id, code)
);

-- 4. res_currency (Monedas)
CREATE TABLE IF NOT EXISTS public.res_currency (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(3) UNIQUE NOT NULL,
    symbol VARCHAR(4),
    rate NUMERIC(12,6) DEFAULT 1.0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. res_company (Empresas - Multiempresa)
CREATE TABLE IF NOT EXISTS public.res_company (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    street VARCHAR(255),
    street2 VARCHAR(255),
    city VARCHAR(128),
    state_id BIGINT REFERENCES public.res_country_state(id),
    zip VARCHAR(24),
    country_id BIGINT REFERENCES public.res_country(id),
    phone VARCHAR(20),
    email VARCHAR(254),
    website VARCHAR(255),
    vat VARCHAR(32),
    partner_id BIGINT UNIQUE,
    currency_id BIGINT NOT NULL REFERENCES public.res_currency(id),
    logo BYTEA,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. res_partner (Clientes, Proveedores, Contactos)
CREATE TABLE IF NOT EXISTS public.res_partner (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES public.res_company(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES public.res_partner(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    website VARCHAR(255),
    street VARCHAR(255),
    street2 VARCHAR(255),
    city VARCHAR(128),
    state_id BIGINT REFERENCES public.res_country_state(id),
    zip VARCHAR(24),
    country_id BIGINT REFERENCES public.res_country(id),
    vat VARCHAR(32),
    is_company BOOLEAN DEFAULT FALSE,
    company_name VARCHAR(255),
    company_type VARCHAR(10) DEFAULT 'person',
    active BOOLEAN DEFAULT TRUE,
    type VARCHAR(10) DEFAULT 'contact',
    lang VARCHAR(5),
    tz VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. res_users (Usuarios del sistema)
-- IMPORTANTE: Usamos UUID para integración con Supabase Auth
CREATE TABLE IF NOT EXISTS public.res_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    login VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    partner_id BIGINT UNIQUE REFERENCES public.res_partner(id),
    company_id BIGINT REFERENCES public.res_company(id),
    company_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    active BOOLEAN DEFAULT TRUE,
    share BOOLEAN DEFAULT FALSE,
    lang VARCHAR(5) DEFAULT 'es_EC',
    tz VARCHAR(64),
    signature TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. uom_category (Categorías de Unidades de Medida)
CREATE TABLE IF NOT EXISTS public.uom_category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. uom_uom (Unidades de Medida)
CREATE TABLE IF NOT EXISTS public.uom_uom (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id BIGINT NOT NULL REFERENCES public.uom_category(id),
    factor NUMERIC(12,6) DEFAULT 1.0,
    rounding NUMERIC(12,6) DEFAULT 0.01,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. product_category (Categorías de Productos)
CREATE TABLE IF NOT EXISTS public.product_category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT REFERENCES public.product_category(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. product_template (Template de Productos)
CREATE TABLE IF NOT EXISTS public.product_template (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id BIGINT REFERENCES public.product_category(id),
    type VARCHAR(10) DEFAULT 'product',
    uom_id BIGINT REFERENCES public.uom_uom(id),
    uom_po_id BIGINT REFERENCES public.uom_uom(id),
    description TEXT,
    list_price NUMERIC(15,2) DEFAULT 0,
    standard_price NUMERIC(15,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. product_product (Productos)
CREATE TABLE IF NOT EXISTS public.product_product (
    id BIGSERIAL PRIMARY KEY,
    product_tmpl_id BIGINT NOT NULL REFERENCES public.product_template(id) ON DELETE CASCADE,
    code VARCHAR(255) UNIQUE,
    barcode VARCHAR(255) UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_res_partner_company_id ON public.res_partner(company_id);
CREATE INDEX IF NOT EXISTS idx_res_partner_active ON public.res_partner(active);
CREATE INDEX IF NOT EXISTS idx_res_partner_vat ON public.res_partner(vat);
CREATE INDEX IF NOT EXISTS idx_res_users_email ON public.res_users(email);
CREATE INDEX IF NOT EXISTS idx_res_users_company_id ON public.res_users(company_id);
CREATE INDEX IF NOT EXISTS idx_product_product_active ON public.product_product(active);
CREATE INDEX IF NOT EXISTS idx_product_template_category ON public.product_template(category_id);

-- 14. RLS (Row Level Security) - Multiempresa
-- AHORA FUNCIONA: auth.uid() es UUID, res_users.id es UUID
ALTER TABLE public.res_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_company ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo ven su propia información
CREATE POLICY "res_users_own_record" ON public.res_users
  FOR SELECT USING (id = auth.uid());

-- Política: Usuarios solo ven partners de sus empresas
CREATE POLICY "res_partner_multicompany" ON public.res_partner
  FOR SELECT USING (
    company_id IN (
      SELECT COALESCE(company_ids[1], company_id)::BIGINT
      FROM public.res_users 
      WHERE id = auth.uid()
    )
  );

-- Política: Usuarios solo ven productos (sin restricción por company por ahora)
CREATE POLICY "product_product_active" ON public.product_product
  FOR SELECT USING (active = TRUE);

-- Política: Usuarios solo ven empresas donde tienen acceso
CREATE POLICY "res_company_access" ON public.res_company
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT UNNEST(company_ids)
      FROM public.res_users 
      WHERE id = auth.uid()
    )
  );

-- 15. Insertar datos base de Ecuador
INSERT INTO public.res_country (name, code, phone_code) 
VALUES ('Ecuador', 'EC', '+593') 
ON CONFLICT (code) DO NOTHING;

-- Provincias de Ecuador (las principales)
DO $$
DECLARE
  ec_id BIGINT;
BEGIN
  SELECT id INTO ec_id FROM public.res_country WHERE code = 'EC';
  
  INSERT INTO public.res_country_state (country_id, name, code) 
  VALUES 
    (ec_id, 'Pichincha', 'PI'),
    (ec_id, 'Guayas', 'GU'),
    (ec_id, 'Carchi', 'CA'),
    (ec_id, 'Tungurahua', 'TU'),
    (ec_id, 'Imbabura', 'IM'),
    (ec_id, 'Cotopaxi', 'CO'),
    (ec_id, 'Manabí', 'MN'),
    (ec_id, 'Santa Elena', 'SE'),
    (ec_id, 'Azuay', 'AZ'),
    (ec_id, 'Cañar', 'CN'),
    (ec_id, 'Morona Santiago', 'MS'),
    (ec_id, 'Zamora Chinchipe', 'ZC'),
    (ec_id, 'Napo', 'NP'),
    (ec_id, 'Pastaza', 'PZ'),
    (ec_id, 'Sucumbíos', 'SU'),
    (ec_id, 'Orellana', 'OR'),
    (ec_id, 'Santo Domingo de los Tsáchilas', 'SD'),
    (ec_id, 'Santa Cruz', 'SC')
  ON CONFLICT (country_id, code) DO NOTHING;
END $$;

-- Moneda
INSERT INTO public.res_currency (name, symbol, rate, active) 
VALUES ('USD', '$', 1.0, TRUE) 
ON CONFLICT (name) DO NOTHING;

-- UOM Categories
INSERT INTO public.uom_category (name) 
VALUES 
  ('Longitud'),
  ('Peso'),
  ('Volumen'),
  ('Tiempo'),
  ('Unidades')
ON CONFLICT (name) DO NOTHING;

-- UOM comunes
DO $$
DECLARE
  length_id BIGINT;
  weight_id BIGINT;
  unit_id BIGINT;
BEGIN
  SELECT id INTO length_id FROM public.uom_category WHERE name = 'Longitud';
  SELECT id INTO weight_id FROM public.uom_category WHERE name = 'Peso';
  SELECT id INTO unit_id FROM public.uom_category WHERE name = 'Unidades';
  
  INSERT INTO public.uom_uom (name, category_id, factor, rounding, active)
  VALUES 
    ('Metro', length_id, 1.0, 0.01, TRUE),
    ('Centímetro', length_id, 0.01, 0.01, TRUE),
    ('Kilogramo', weight_id, 1.0, 0.01, TRUE),
    ('Gramo', weight_id, 0.001, 0.01, TRUE),
    ('Unidad', unit_id, 1.0, 1.0, TRUE),
    ('Docena', unit_id, 12.0, 1.0, TRUE),
    ('Caja', unit_id, 1.0, 1.0, TRUE)
  ON CONFLICT DO NOTHING;
END $$;

-- Grant permissions para Supabase Auth
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
