-- Migración para añadir campos adicionales a product_template basados en el UI de inventario antiguo
ALTER TABLE public.product_template
    -- Referencia adicional
    ADD COLUMN IF NOT EXISTS reference VARCHAR(255),
    
    -- Clasificación (Grupos)
    ADD COLUMN IF NOT EXISTS group1 VARCHAR(100),
    ADD COLUMN IF NOT EXISTS group2 VARCHAR(100),
    ADD COLUMN IF NOT EXISTS group3 VARCHAR(100),
    
    -- Inventario y stock
    ADD COLUMN IF NOT EXISTS stock_unit VARCHAR(50),
    ADD COLUMN IF NOT EXISTS min_stock NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_stock NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS warehouse_location VARCHAR(100),
    
    -- Impuestos y contabilidad
    ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100),
    ADD COLUMN IF NOT EXISTS iva_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS has_ice BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ice_percentage NUMERIC(5,2) DEFAULT 0,
    
    -- Precios múltiples
    ADD COLUMN IF NOT EXISTS price_1 NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_2 NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_3 NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_4 NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_5 NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_6 NUMERIC(15,2) DEFAULT 0,
    
    -- Promociones y descuentos
    ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS previous_price NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_quantity INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_valid_until DATE,
    
    -- Costos y existencias (histórico)
    ADD COLUMN IF NOT EXISTS last_cost NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_stock NUMERIC(15,2) DEFAULT 0, -- Nota: Normalmente esto es calculado, pero se añade por compatibilidad con el UI
    
    -- Adjuntos y multimedia
    ADD COLUMN IF NOT EXISTS pdf_catalog_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS attached_document_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Añadir comentarios a las columnas para documentar su uso
COMMENT ON COLUMN public.product_template.reference IS 'Referencia adicional del producto';
COMMENT ON COLUMN public.product_template.group1 IS 'Grupo I del producto';
COMMENT ON COLUMN public.product_template.group2 IS 'Grupo II del producto';
COMMENT ON COLUMN public.product_template.group3 IS 'Grupo III del producto';
COMMENT ON COLUMN public.product_template.stock_unit IS 'Unidad de medida para el stock (ej. UNIDAD)';
COMMENT ON COLUMN public.product_template.min_stock IS 'Existencia mínima permitida';
COMMENT ON COLUMN public.product_template.max_stock IS 'Existencia máxima recomendada';
COMMENT ON COLUMN public.product_template.warehouse_location IS 'Ubicación física en bodega (BO)';
COMMENT ON COLUMN public.product_template.cost_center IS 'Centro de Costo F2';
COMMENT ON COLUMN public.product_template.iva_code IS 'Código I.V.A. (ej. 0%, 12%)';
COMMENT ON COLUMN public.product_template.has_ice IS 'Indica si grava I.C.E.';
COMMENT ON COLUMN public.product_template.ice_percentage IS 'Porcentaje de I.C.E.';
COMMENT ON COLUMN public.product_template.price_1 IS 'PVP Precio 1';
COMMENT ON COLUMN public.product_template.price_2 IS 'PVP Precio 2';
COMMENT ON COLUMN public.product_template.price_3 IS 'PVP Precio 3';
COMMENT ON COLUMN public.product_template.price_4 IS 'PVP Precio 4';
COMMENT ON COLUMN public.product_template.price_5 IS 'PVP Precio 5';
COMMENT ON COLUMN public.product_template.price_6 IS 'PVP Precio 6';
COMMENT ON COLUMN public.product_template.discount_percentage IS 'Promoción Dcto %';
COMMENT ON COLUMN public.product_template.previous_price IS 'PVP Anterior para promoción';
COMMENT ON COLUMN public.product_template.promo_quantity IS 'Condición de promoción: Por cada X cantidad';
COMMENT ON COLUMN public.product_template.promo_valid_until IS 'Vigencia de la promoción hasta';
COMMENT ON COLUMN public.product_template.last_cost IS 'Último Costo registrado';
COMMENT ON COLUMN public.product_template.current_stock IS 'Existencia Actual (si se maneja de forma estática en la tabla)';
COMMENT ON COLUMN public.product_template.pdf_catalog_url IS 'Ruta o URL del Catálogo PDF';
COMMENT ON COLUMN public.product_template.attached_document_url IS 'Ruta o URL del Documento Adjunto (PDF, WORD, EXCEL, JPG)';
COMMENT ON COLUMN public.product_template.image_url IS 'Ruta o URL de la fotografía subida';
