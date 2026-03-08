-- 1. Usuarios y Perfiles (RBAC)
-- Supabase ya maneja Auth, pero necesitamos una tabla de perfiles para el rol.
CREATE TABLE IF NOT EXISTS public.perfiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nombre text,
    rol text DEFAULT 'client' CHECK (rol IN ('admin', 'client')),
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL, -- Si es un cliente, lo vinculamos
    created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para perfiles (admins ven todo, usuarios ven lo propio)
-- (Simplificado por ahora para que el asistente pueda trabajar)

-- 2. Actualizar tabla Clientes para credenciales y funciones
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS backoffice_metodo text DEFAULT 'standard', -- standard, token, etc.
ADD COLUMN IF NOT EXISTS backoffice_activado boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS token_backoffice text,
ADD COLUMN IF NOT EXISTS funciones_habilitadas jsonb DEFAULT '{"tickets": true, "facturas": true, "agentes": true}'::jsonb;

-- 3. Actualizar tabla Proyectos Railway si es necesario (para variables específicas)
-- Ya existe la columna 'configuracion' (jsonb), la usaremos para guardar las variables del bot.
