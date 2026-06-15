-- supabase/migrations/027_company_roles.sql

-- 1. Añadimos la columna de rol a la tabla de usuarios
ALTER TABLE public.res_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'ventas';

-- Comentario para el rol
COMMENT ON COLUMN public.res_users.role IS 'Rol del usuario: admin, contador, ventas, bodeguero';
