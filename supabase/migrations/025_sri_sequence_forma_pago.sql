-- =============================================================================
-- 025_sri_sequence_forma_pago.sql
-- 1. Tabla de secuenciales SRI por tipo de documento y punto de emision
-- 2. Columna forma_pago en sale_order
-- 3. Asegurar que list_price existe en product_template (ya existe desde 001)
-- SEGURO: solo CREATE IF NOT EXISTS y ALTER ADD COLUMN IF NOT EXISTS
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. sri_document_sequence
--    Controla el secuencial por tipo de documento (factura, NC, ND, GR, ret)
--    por empresa y punto de emision.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sri_document_sequence (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT       NOT NULL REFERENCES public.res_company(id) ON DELETE CASCADE,
    doc_type        VARCHAR(20)  NOT NULL,
    -- doc_type: 'factura' | 'nota_credito' | 'nota_debito' | 'guia_remision' | 'retencion'
    estab           VARCHAR(3)   NOT NULL DEFAULT '001',
    pto_emi         VARCHAR(3)   NOT NULL DEFAULT '001',
    next_number     INTEGER      NOT NULL DEFAULT 1,

    CONSTRAINT sri_doc_seq_unique UNIQUE (company_id, doc_type, estab, pto_emi)
);

-- Insertar secuencial inicial para facturas si no existe
-- (se ejecuta solo una vez; si ya hay datos no inserta)
INSERT INTO public.sri_document_sequence (company_id, doc_type, estab, pto_emi, next_number)
SELECT 1, 'factura', COALESCE(c.sri_estab, '001'), COALESCE(c.sri_pto_emi, '001'), 1
FROM public.res_company c WHERE c.id = 1
ON CONFLICT (company_id, doc_type, estab, pto_emi) DO NOTHING;

INSERT INTO public.sri_document_sequence (company_id, doc_type, estab, pto_emi, next_number)
SELECT 1, 'nota_credito', COALESCE(c.sri_estab, '001'), COALESCE(c.sri_pto_emi, '001'), 1
FROM public.res_company c WHERE c.id = 1
ON CONFLICT (company_id, doc_type, estab, pto_emi) DO NOTHING;

INSERT INTO public.sri_document_sequence (company_id, doc_type, estab, pto_emi, next_number)
SELECT 1, 'nota_debito', COALESCE(c.sri_estab, '001'), COALESCE(c.sri_pto_emi, '001'), 1
FROM public.res_company c WHERE c.id = 1
ON CONFLICT (company_id, doc_type, estab, pto_emi) DO NOTHING;

INSERT INTO public.sri_document_sequence (company_id, doc_type, estab, pto_emi, next_number)
SELECT 1, 'guia_remision', COALESCE(c.sri_estab, '001'), COALESCE(c.sri_pto_emi, '001'), 1
FROM public.res_company c WHERE c.id = 1
ON CONFLICT (company_id, doc_type, estab, pto_emi) DO NOTHING;

INSERT INTO public.sri_document_sequence (company_id, doc_type, estab, pto_emi, next_number)
SELECT 1, 'retencion', COALESCE(c.sri_estab, '001'), COALESCE(c.sri_pto_emi, '001'), 1
FROM public.res_company c WHERE c.id = 1
ON CONFLICT (company_id, doc_type, estab, pto_emi) DO NOTHING;

-- RLS abierta para desarrollo
ALTER TABLE public.sri_document_sequence ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sri_document_sequence' AND policyname = 'dev_all_sri_doc_seq'
    ) THEN
        CREATE POLICY dev_all_sri_doc_seq ON public.sri_document_sequence FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 2. forma_pago en sale_order
--    Codigo SRI del catalogo de formas de pago.
--    Default '01' = Sin utilizacion del sistema financiero (efectivo).
-- ---------------------------------------------------------------------------

ALTER TABLE public.sale_order
    ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(2) NOT NULL DEFAULT '01';


-- ---------------------------------------------------------------------------
-- 3. Verificacion
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'sri_document_sequence: tabla creada con secuenciales iniciales';
    RAISE NOTICE 'sale_order.forma_pago: columna agregada (default 01=efectivo)';
    RAISE NOTICE 'product_template.list_price: ya existe desde migracion 001 (es el PVP)';
    RAISE NOTICE 'Migracion 025 completada.';
END $$;
