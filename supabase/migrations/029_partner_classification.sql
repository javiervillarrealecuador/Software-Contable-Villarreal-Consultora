-- Migración: Añadir clasificación de Partners (Cliente / Proveedor)
-- Fecha: 15/06/2026

-- 1. Añadir campos booleanos a la tabla res_partner
ALTER TABLE public.res_partner 
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN DEFAULT false;

-- 2. Asegurar que los datos existentes se mantengan consistentes
-- (Opcional, pero recomendado si ya había datos)
-- UPDATE public.res_partner SET is_customer = true WHERE is_customer IS NULL;
-- UPDATE public.res_partner SET is_supplier = false WHERE is_supplier IS NULL;
