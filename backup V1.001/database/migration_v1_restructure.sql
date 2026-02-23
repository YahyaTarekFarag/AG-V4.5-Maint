-- ==========================================
-- FSC-MAINT-APP V1.0 — Organizational Restructuring Migration
-- Date: 2026-02-22
-- Pre-Backup Tag: v0.0-backup
-- ==========================================

-- ===== PHASE 1: NEW TABLES (Hierarchy) =====

-- 1.1 Brands (البراندات)
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.brands;
CREATE POLICY "Allow all for authenticated" ON public.brands FOR ALL TO authenticated USING (true);
GRANT ALL ON TABLE public.brands TO authenticated;
GRANT ALL ON TABLE public.brands TO service_role;

-- 1.2 Sectors (القطاعات)
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sectors;
CREATE POLICY "Allow all for authenticated" ON public.sectors FOR ALL TO authenticated USING (true);
GRANT ALL ON TABLE public.sectors TO authenticated;
GRANT ALL ON TABLE public.sectors TO service_role;

-- 1.3 Areas (المناطق)
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  sector_id uuid NOT NULL REFERENCES public.sectors(id),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.areas;
CREATE POLICY "Allow all for authenticated" ON public.areas FOR ALL TO authenticated USING (true);
GRANT ALL ON TABLE public.areas TO authenticated;
GRANT ALL ON TABLE public.areas TO service_role;


-- ===== PHASE 2: MODIFY EXISTING TABLES =====

-- 2.1 Branches — Add area_id FK
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id);

-- 2.2 Profiles — Expand roles and add hierarchy links
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'brand_ops_manager',
    'sector_manager',
    'area_manager',
    'manager',
    'maint_manager',
    'maint_supervisor',
    'technician'
  ));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.sectors(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id);

-- 2.3 Tickets — Add assignment tracking
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id);


-- ===== PHASE 3: UI SCHEMAS FOR NEW TABLES =====

-- 3.1 brands UI Schema
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('brands',
  '{"title":"إدارة البراندات","searchable":true,"columns":[
    {"key":"name","label":"اسم البراند","type":"text"}
  ]}'::jsonb,
  '{"title":"إضافة / تعديل براند","fields":[
    {"key":"name","label":"اسم البراند","type":"text","required":true}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE 
  SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;

-- 3.2 sectors UI Schema
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('sectors',
  '{"title":"إدارة القطاعات","searchable":true,"columns":[
    {"key":"name","label":"اسم القطاع","type":"text"},
    {"key":"brand_id","label":"البراند","type":"text"}
  ]}'::jsonb,
  '{"title":"إضافة / تعديل قطاع","fields":[
    {"key":"name","label":"اسم القطاع","type":"text","required":true},
    {"key":"brand_id","label":"البراند","type":"select","required":true,"dataSource":"brands"}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE 
  SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;

-- 3.3 areas UI Schema
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('areas',
  '{"title":"إدارة المناطق","searchable":true,"columns":[
    {"key":"name","label":"اسم المنطقة","type":"text"},
    {"key":"sector_id","label":"القطاع","type":"text"}
  ]}'::jsonb,
  '{"title":"إضافة / تعديل منطقة","fields":[
    {"key":"name","label":"اسم المنطقة","type":"text","required":true},
    {"key":"sector_id","label":"القطاع","type":"select","required":true,"dataSource":"sectors"}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE 
  SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;


-- ===== PHASE 4: UPDATE EXISTING UI SCHEMAS =====

-- 4.1 Update branches UI Schema (replace text 'sector' with area_id FK)
UPDATE public.ui_schemas SET
  list_config = '{"title":"دليل الفروع","searchable":true,"columns":[
    {"key":"name","label":"اسم الفرع","type":"text"},
    {"key":"br_tel","label":"رقم الهاتف","type":"text"},
    {"key":"area_id","label":"المنطقة","type":"text"}
  ]}'::jsonb,
  form_config = '{"title":"إضافة / تعديل فرع","fields":[
    {"key":"name","label":"اسم الفرع","type":"text","required":true},
    {"key":"br_tel","label":"رقم الهاتف","type":"text"},
    {"key":"area_id","label":"المنطقة","type":"select","required":true,"dataSource":"areas"},
    {"key":"branch_lat","label":"خط العرض","type":"number"},
    {"key":"branch_lng","label":"خط الطول","type":"number"}
  ]}'::jsonb
WHERE table_name = 'branches';

-- 4.2 Update profiles UI Schema (expand roles + hierarchy selects)
UPDATE public.ui_schemas SET
  form_config = '{"title":"إضافة / تعديل بيانات موظف","fields":[
    {"key":"full_name","label":"الاسم الرباعي","type":"text","required":true},
    {"key":"employee_code","label":"كود الدخول التعريفي","type":"text","required":true},
    {"key":"password","label":"كلمة المرور","type":"text","required":true},
    {"key":"role","label":"صلاحية النظام","type":"select","required":true,"options":[
      {"label":"مسؤول نظام","value":"admin"},
      {"label":"مدير تشغيل البراند","value":"brand_ops_manager"},
      {"label":"مدير قطاع","value":"sector_manager"},
      {"label":"مدير منطقة","value":"area_manager"},
      {"label":"مدير فرع","value":"manager"},
      {"label":"مدير صيانة","value":"maint_manager"},
      {"label":"مشرف صيانة","value":"maint_supervisor"},
      {"label":"فني صيانة","value":"technician"}
    ]},
    {"key":"brand_id","label":"البراند","type":"select","dataSource":"brands"},
    {"key":"sector_id","label":"القطاع","type":"select","dataSource":"sectors"},
    {"key":"area_id","label":"المنطقة","type":"select","dataSource":"areas"},
    {"key":"branch_id","label":"الفرع","type":"select","dataSource":"branches"}
  ]}'::jsonb
WHERE table_name = 'profiles';

-- ===== DONE =====
-- Run this script in Supabase SQL Editor
-- Then proceed to frontend changes
