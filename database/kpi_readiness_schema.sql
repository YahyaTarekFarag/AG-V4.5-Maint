-- ==========================================
-- المرحلة 6: هيكلة البيانات والجاهزية للـ KPIs
-- التحسينات الهيكلية (Fixed Assets & Categories)
-- ==========================================

-- 1. جدول تصنيفات الأعطال (لتحليل أسباب تكرار المشاكل)
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE, -- مثال: كهرباء، ميكانيكا، تبريد، سباكة
    created_at timestamptz DEFAULT NOW()
);

INSERT INTO public.maintenance_categories (name) VALUES 
('تبريد وتكييف'),
('كهرباء'),
('ميكانيكا'),
('سباكة'),
('معدات مطبخ'),
('أعمال مدنية'),
('أخرى')
ON CONFLICT (name) DO NOTHING;

-- 2. جدول الأصول الثابتة (Fixed Assets)
CREATE TABLE IF NOT EXISTS public.maintenance_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id uuid REFERENCES public.branches(id) NOT NULL,
    category_id uuid REFERENCES public.maintenance_categories(id),
    name text NOT NULL, -- اسم المعدة (مثلاً: تكييف كونسيلد 1)
    model_number text,
    serial_number text,
    qr_code text UNIQUE, -- الرمز الذي سيتم طباعته
    purchase_date date,
    warranty_expiry date,
    status text DEFAULT 'operational' CHECK (status IN ('operational', 'faulty', 'under_repair', 'scrapped')),
    last_maintenance_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- 3. تحديث جدول البلاغات لربط الأصول والـ KPIs
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.maintenance_assets(id);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.maintenance_categories(id);

-- إضافة حقول الجاهزية للـ KPIs
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS started_at timestamptz; -- متى بدأ الفني العمل فعلياً
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS downtime_start timestamptz; -- متى تعطلت المعدة فعلياً
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS fault_type_id uuid REFERENCES public.maintenance_categories(id); -- تصنيف العطل الفني
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false;

-- 4. صلاحيات الوصول (RLS)
ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for all authenticated" ON public.maintenance_categories;
CREATE POLICY "Allow read for all authenticated" ON public.maintenance_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read for all authenticated" ON public.maintenance_assets;
CREATE POLICY "Allow read for all authenticated" ON public.maintenance_assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow maintain for admin and managers" ON public.maintenance_assets;
CREATE POLICY "Allow maintain for admin and managers" ON public.maintenance_assets FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
);

-- 5. تهيئة محرك الواجهات (UI Schemas)
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('maintenance_assets',
  '{"title":"سجل الأصول والمعدات","searchable":true,"columns":[
    {"key":"name","label":"اسم المعدة","type":"text"},
    {"key":"category_id","label":"التصنيف","type":"text"},
    {"key":"branch_id","label":"الفرع","type":"text"},
    {"key":"status","label":"الحالة","type":"status"},
    {"key":"qr_code","label":"QR Code","type":"badge"}
  ]}'::jsonb,
  '{"title":"إضافة / تعديل معدة","fields":[
    {"key":"name","label":"اسم المعدة","type":"text","required":true},
    {"key":"branch_id","label":"الفرع","type":"select","required":true,"dataSource":"branches"},
    {"key":"category_id","label":"التصنيف","type":"select","required":true,"dataSource":"maintenance_categories"},
    {"key":"model_number","label":"الموديل","type":"text"},
    {"key":"serial_number","label":"الرقم التسلسلي","type":"text"},
    {"key":"qr_code","label":"QR Code (يدوي)","type":"text"},
    {"key":"purchase_date","label":"تاريخ الشراء","type":"date"},
    {"key":"warranty_expiry","label":"تاريخ انتهاء الضمان","type":"date"},
    {"key":"status","label":"الحالة التشغيلية","type":"select","options":[
        {"label":"تعمل","value":"operational"},
        {"label":"بها عطل","value":"faulty"},
        {"label":"قيد الإصلاح","value":"under_repair"},
        {"label":"كهنة / مستهلكة","value":"scrapped"}
    ]}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;

INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('maintenance_categories',
  '{"title":"تصنيفات الأعطال والجودة","columns":[
    {"key":"name","label":"اسم التصنيف","type":"text"}
  ]}'::jsonb,
  '{"title":"إضافة تصنيف جديد","fields":[
    {"key":"name","label":"اسم التصنيف","type":"text","required":true}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;

-- 6. تحديث نموذج البلاغات (Tickets UI Schema)
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('tickets',
  '{"title":"سجل البلاغات الذكي","searchable":true,"columns":[
    {"key":"created_at","label":"تاريخ البلاغ","type":"date"},
    {"key":"asset_name","label":"المعدة / الأصل","type":"text"},
    {"key":"status","label":"الحالة","type":"status"},
    {"key":"priority","label":"الأولوية","type":"badge"}
  ]}'::jsonb,
  '{"title":"فتح بلاغ صيانة ذكي","fields":[
    {"key":"branch_id","label":"الفرع","type":"select","required":true,"dataSource":"branches"},
    {"key":"asset_id","label":"المعدة المعطلة (اختياري)","type":"select","dataSource":"maintenance_assets"},
    {"key":"category_id","label":"تصنيف المشكلة","type":"select","dataSource":"maintenance_categories"},
    {"key":"description","label":"وصف العطل","type":"textarea","required":true},
    {"key":"downtime_start","label":"وقت تعطل المعدة الفعلي","type":"date"},
    {"key":"is_emergency","label":"بلاغ طوارئ (حرج)","type":"select","options":[
        {"label":"لا","value":"false"},
        {"label":"نعم - طوارئ","value":"true"}
    ]},
    {"key":"reported_image_url","label":"صورة العطل","type":"image"}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config;

-- 7. بناء طرق حساب الـ KPIs (Database Views)

-- View لحساب كفاءة المعدات (MTBF & Reliability)
CREATE OR REPLACE VIEW public.v_asset_reliability AS
SELECT 
    a.id as asset_id,
    a.name as asset_name,
    c.name as category_name,
    COUNT(t.id) as total_repairs,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.started_at, t.created_at)))/3600)::numeric(10,2) as avg_repair_hours_mttr,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.downtime_start, t.created_at)))/3600)::numeric(10,2) as avg_downtime_hours
FROM public.maintenance_assets a
JOIN public.maintenance_categories c ON a.category_id = c.id
LEFT JOIN public.tickets t ON a.id = t.asset_id AND t.status = 'closed'
GROUP BY a.id, a.name, c.name;

GRANT SELECT ON public.v_asset_reliability TO authenticated;
