-- supabase/migrations/001_capa0_foundation.sql
-- CAPA 0: Foundation - Maestros base del ERP

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
CREATE TABLE IF NOT EXISTS public.res_users (
    id BIGSERIAL PRIMARY KEY,
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
ALTER TABLE public.res_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.res_users ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo ven partners de sus empresas
CREATE POLICY "res_partner_multicompany" ON public.res_partner
  FOR SELECT USING (company_id IN (
    SELECT unnest(company_ids) FROM public.res_users WHERE id = auth.uid()
  ));

-- Política: Usuarios solo ven usuarios de sus empresas
CREATE POLICY "res_users_multicompany" ON public.res_users
  FOR SELECT USING (company_id IN (
    SELECT unnest(company_ids) FROM public.res_users WHERE id = auth.uid()
  ));

-- 15. Insertar datos base de Ecuador
INSERT INTO public.res_country (name, code, phone_code) VALUES ('Ecuador', 'EC', '+593') ON CONFLICT (code) DO NOTHING;

-- Provincias de Ecuador
INSERT INTO public.res_country_state (country_id, name, code) 
SELECT id, 'Pichincha', 'PI' FROM public.res_country WHERE code = 'EC'
ON CONFLICT (country_id, code) DO NOTHING;

INSERT INTO public.res_country_state (country_id, name, code) 
SELECT id, 'Guayas', 'GU' FROM public.res_country WHERE code = 'EC'
ON CONFLICT (country_id, code) DO NOTHING;

INSERT INTO public.res_country_state (country_id, name, code) 
SELECT id, 'Carchi', 'CA' FROM public.res_country WHERE code = 'EC'
ON CONFLICT (country_id, code) DO NOTHING;

-- Moneda
INSERT INTO public.res_currency (name, symbol, rate, active) VALUES ('USD', '$', 1.0, TRUE) ON CONFLICT (name) DO NOTHING;

-- UOM Categories
INSERT INTO public.uom_category (name) VALUES ('Longitud') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.uom_category (name) VALUES ('Peso') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.uom_category (name) VALUES ('Volumen') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.uom_category (name) VALUES ('Tiempo') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.uom_category (name) VALUES ('Unidades') ON CONFLICT (name) DO NOTHING;

-- UOM comunes
INSERT INTO public.uom_uom (name, category_id, factor, rounding, active)
SELECT 'Metro', id, 1.0, 0.01, TRUE FROM public.uom_category WHERE name = 'Longitud'
ON CONFLICT DO NOTHING;

INSERT INTO public.uom_uom (name, category_id, factor, rounding, active)
SELECT 'Kilogramo', id, 1.0, 0.01, TRUE FROM public.uom_category WHERE name = 'Peso'
ON CONFLICT DO NOTHING;

INSERT INTO public.uom_uom (name, category_id, factor, rounding, active)
SELECT 'Unidad', id, 1.0, 1.0, TRUE FROM public.uom_category WHERE name = 'Unidades'
ON CONFLICT DO NOTHING;
