-- ==========================================
-- FSC-MAINT-APP MASTER BOOTSTRAP V11
-- Purpose: Create entire schema from scratch with full harmonization.
-- Repository: AG-V4.5-Maint
-- ==========================================

-- ─── 0. CLEAN SLATE (Optional / Dangerous - Use with care) ───────────
-- DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
-- DROP TABLE IF EXISTS public.tickets CASCADE;
-- DROP TABLE IF EXISTS public.inventory CASCADE;
-- DROP TABLE IF EXISTS public.branches CASCADE;
-- DROP TABLE IF EXISTS public.areas CASCADE;
-- DROP TABLE IF EXISTS public.sectors CASCADE;
-- DROP TABLE IF EXISTS public.brands CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.ui_schemas CASCADE;
-- DROP TABLE IF EXISTS public.system_settings CASCADE;
-- DROP TABLE IF EXISTS public.shifts CASCADE;

-- ─── 1. CORE HIERARCHY ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brands (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sectors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.areas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    br_tel text,
    area_id uuid REFERENCES public.areas(id),
    latitude double precision,
    longitude double precision,
    restrict_branch_submission boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT NOW()
);

-- ─── 2. USERS & PROFILES ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    employee_code text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role text CHECK (role IN ('admin', 'brand_ops_manager', 'sector_manager', 'area_manager', 'manager', 'maint_manager', 'maint_supervisor', 'technician')),
    brand_id uuid REFERENCES public.brands(id),
    sector_id uuid REFERENCES public.sectors(id),
    area_id uuid REFERENCES public.areas(id),
    branch_id uuid REFERENCES public.branches(id),
    created_at timestamptz DEFAULT NOW()
);

-- ─── 3. MAINTENANCE & TICKETS ───────────────────────────

CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_name text NOT NULL,
    description text,
    priority text DEFAULT 'medium',
    status text DEFAULT 'open',
    branch_id uuid REFERENCES public.branches(id),
    assigned_to uuid REFERENCES public.profiles(id),
    reported_by uuid REFERENCES public.profiles(id),
    reported_lat double precision,
    reported_lng double precision,
    started_lat double precision,
    started_lng double precision,
    resolved_lat double precision,
    resolved_lng double precision,
    resolved_at timestamptz,
    rating_score integer CHECK (rating_score BETWEEN 1 AND 5),
    rating_comment text,
    created_at timestamptz DEFAULT NOW()
);

-- ─── 4. INVENTORY & LOGISTICS ───────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name text NOT NULL,
    sku text UNIQUE,
    quantity integer DEFAULT 0,
    unit text,
    min_threshold integer DEFAULT 5,
    last_restocked timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id uuid REFERENCES public.inventory(id),
    ticket_id uuid REFERENCES public.tickets(id),
    technician_id uuid REFERENCES public.profiles(id),
    type text CHECK (type IN ('in', 'out')),
    quantity integer NOT NULL,
    reason text,
    created_at timestamptz DEFAULT NOW()
);

-- ─── 5. ARCHITECTURE & SETTINGS ────────────────────────

CREATE TABLE IF NOT EXISTS public.ui_schemas (
    table_name text PRIMARY KEY,
    list_config jsonb DEFAULT '{}',
    form_config jsonb DEFAULT '{}',
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb,
    description text,
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    technician_id uuid REFERENCES public.profiles(id),
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT NOW()
);

-- ─── 6. POLICIES & SECURITY ───────────────────────────
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Simple "Allow all authenticated" policies for now (Admin dashboard rules)
CREATE POLICY "Allow All" ON public.brands FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.sectors FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.areas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.branches FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.tickets FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.inventory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.ui_schemas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.system_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow All" ON public.shifts FOR ALL TO authenticated USING (true);

-- ─── 7. INITIAL METADATA (UI SCHEMAS) ──────────────────

INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('branches', 
  '{"title":"دليل الفروع","searchable":true,"columns":[
    {"key":"name","label":"اسم الفرع","type":"text"},
    {"key":"br_tel","label":"الهاتف","type":"text"},
    {"key":"area_id","label":"المنطقة","type":"text"},
    {"key":"latitude","label":"Latitude","type":"text"},
    {"key":"longitude","label":"Longitude","type":"text"}
  ]}'::jsonb,
  '{"title":"إضافة / تعديل فرع","fields":[
    {"key":"name","label":"اسم الفرع","type":"text","required":true},
    {"key":"br_tel","label":"الهاتف","type":"text"},
    {"key":"area_id","label":"المنطقة","type":"select","required":true,"dataSource":"areas"},
    {"key":"latitude","label":"Latitude","type":"number"},
    {"key":"longitude","label":"Longitude","type":"number"}
  ]}'::jsonb
),
('tickets',
  '{"title":"سجل البلاغات الموحد","searchable":true,"columns":[
    {"key":"asset_name","label":"المعدة","type":"text"},
    {"key":"branch_id","label":"الفرع","type":"text"},
    {"key":"status","label":"الحالة","type":"status"},
    {"key":"priority","label":"الأولوية","type":"status"},
    {"key":"assigned_to","label":"الفني","type":"text"},
    {"key":"created_at","label":"التاريخ","type":"date"}
  ]}'::jsonb,
  '{"title":"بيانات البلاغ","fields":[
    {"key":"asset_name","label":"اسم المعدة / العطل","type":"text","required":true},
    {"key":"branch_id","label":"الفرع","type":"select","required":true,"dataSource":"branches"},
    {"key":"description","label":"وصف العطل بالتفصيل","type":"textarea"},
    {"key":"priority","label":"درجة الأهمية","type":"status_select"}
  ]}'::jsonb
),
('profiles',
  '{"title":"إدارة القوى البشرية","searchable":true,"columns":[
    {"key":"full_name","label":"الاسم","type":"text"},
    {"key":"employee_code","label":"الكود","type":"text"},
    {"key":"role","label":"الصلاحية","type":"text"}
  ]}'::jsonb,
  '{"title":"بيانات الموظف","fields":[
    {"key":"full_name","label":"الاسم الكامل","type":"text","required":true},
    {"key":"employee_code","label":"كود الموظف","type":"text","required":true},
    {"key":"password","label":"كلمة المرور","type":"text","required":true},
    {"key":"role","label":"الصلاحية","type":"select","required":true,"options":[
      {"label":"مدير صيانة","value":"maint_manager"},
      {"label":"مشرف صيانة","value":"maint_supervisor"},
      {"label":"فني صيانة","value":"technician"},
      {"label":"مدير فرع","value":"manager"}
    ]},
    {"key":"brand_id","label":"البراند","type":"select","dataSource":"brands"},
    {"key":"sector_id","label":"القطاع","type":"select","dataSource":"sectors"},
    {"key":"area_id","label":"المنطقة","type":"select","dataSource":"areas"},
    {"key":"branch_id","label":"الفرع","type":"select","dataSource":"branches"}
  ]}'::jsonb
)
ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;
