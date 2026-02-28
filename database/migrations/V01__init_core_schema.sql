-- V01__init_core_schema.sql
-- ==========================================
-- المرحلة الأولى: البنية الأساسية للنظام والتسلسل الهرمي
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT NOW()
);

-- 2. UI Schemas
CREATE TABLE IF NOT EXISTS public.ui_schemas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  list_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- 3. Organizational Hierarchy

-- 3.1 Brands
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

-- 3.2 Sectors
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

-- 3.3 Areas
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  sector_id uuid NOT NULL REFERENCES public.sectors(id),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

-- 3.4 Branches (will add manager_id later)
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  branch_lat double precision,
  branch_lng double precision,
  area_id uuid REFERENCES public.areas(id),
  created_at timestamptz DEFAULT NOW()
);

-- 4. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY, -- Usually maps to auth.users in Supabase
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'admin',
    'brand_ops_manager',
    'sector_manager',
    'area_manager',
    'manager',
    'maint_manager',
    'maint_supervisor',
    'technician'
  )),
  brand_id uuid REFERENCES public.brands(id),
  sector_id uuid REFERENCES public.sectors(id),
  area_id uuid REFERENCES public.areas(id),
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz DEFAULT NOW()
);

-- 5. Add circular FKs
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id);

-- 6. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Standard Policies
DO $$
BEGIN
  CREATE POLICY "Allow all authenticated users" ON public.system_settings FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.ui_schemas FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.brands FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.sectors FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.areas FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.branches FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.profiles FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all authenticated users" ON public.audit_logs FOR ALL TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Default Settings
INSERT INTO public.system_settings (key, value) 
VALUES ('restrict_branch_submission', 'true')
ON CONFLICT (key) DO NOTHING;
