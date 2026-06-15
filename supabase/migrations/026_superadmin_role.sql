-- supabase/migrations/026_superadmin_role.sql

ALTER TABLE public.res_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Si queremos que un usuario pueda actualizar este campo, necesitamos políticas, 
-- pero por ahora solo se actualizará vía service_role en el backend al registrarse.
