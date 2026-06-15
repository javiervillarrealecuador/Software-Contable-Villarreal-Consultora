-- =============================================================================
-- 016_sri_einvoice_company.sql
-- Facturación electrónica SRI: configuración POR EMPRESA.
--
-- DISEÑO: el régimen tributario varía entre empresas (RIMPE, agente de
-- retención, obligado a llevar contabilidad), así que son columnas de
-- res_company y no constantes del código. El XML toma estas leyendas
-- dinámicamente. Idempotente.
-- =============================================================================

-- Dirección matriz y del establecimiento (obligatorias en el XML)
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_dir_matriz        VARCHAR(300) DEFAULT 'Tulcán - Ecuador';
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_dir_estab         VARCHAR(300);

-- Serie del comprobante
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_estab             VARCHAR(3)  DEFAULT '001';
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_pto_emi           VARCHAR(3)  DEFAULT '001';

-- Régimen y obligaciones (leyendas del XML)
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_obligado_contab   BOOLEAN     DEFAULT TRUE;
-- Si la empresa es RIMPE: texto exacto de la leyenda, p.ej.
-- 'CONTRIBUYENTE RÉGIMEN RIMPE EMPRENDEDOR' o 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE'
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_rimpe             VARCHAR(80);
-- Si es agente de retención: número de resolución (p.ej. '1'). NULL = no es agente.
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_agente_retencion  VARCHAR(20);
-- Si es contribuyente especial: número de resolución. NULL = no lo es.
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_contrib_especial  VARCHAR(20);

-- Ambiente SRI: 1 = pruebas, 2 = producción
ALTER TABLE public.res_company ADD COLUMN IF NOT EXISTS sri_ambiente          SMALLINT    DEFAULT 1;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE '→ Configuración de facturación electrónica agregada a res_company (ambiente=1 pruebas).';
END $$;
