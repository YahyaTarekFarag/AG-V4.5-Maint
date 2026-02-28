-- ==========================================
-- FSC-MAINT-APP: Final Sovereign & RBAC Fix
-- ==========================================

-- 1. Ensure System Settings Table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW()
);

-- Add created_at if it's missing from existing table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='created_at') THEN
        ALTER TABLE public.system_settings ADD COLUMN created_at timestamptz DEFAULT NOW();
    END IF;
END $$;

-- Insert Default Settings
INSERT INTO public.system_settings (key, value) VALUES
('restrict_branch_submission', 'true'),
('geofencing_enabled', 'true'),
('geofencing_radius', '100')
ON CONFLICT (key) DO NOTHING;

-- 2. Secure System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for all authenticated" ON public.system_settings;
CREATE POLICY "Allow read for all authenticated" ON public.system_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow update for admins" ON public.system_settings;
CREATE POLICY "Allow update for admins" ON public.system_settings FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Ensure essential UI Schemas exist for Sovereign Navigation
-- Profiles Schema (HR)
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('profiles',
  '{"title":"إدارة الموارد البشرية","columns":[
    {"key":"employee_code","label":"كود الموظف","type":"text"},
    {"key":"full_name","label":"الاسم الكامل","type":"text"},
    {"key":"role","label":"الدور","type":"status"},
    {"key":"branch_id","label":"الفرع","type":"text"}
  ]}'::jsonb,
  '{"title":"تعديل بيانات موظف","fields":[
    {"key":"full_name","label":"الاسم الكامل","type":"text","required":true},
    {"key":"employee_code","label":"كود الموظف","type":"text","required":true},
    {"key":"role","label":"الدور الوظيفي","type":"select","options":[
        {"label":"فني","value":"technician"},
        {"label":"مدير فرع","value":"manager"},
        {"label":"مدير منطقة","value":"area_manager"},
        {"label":"مدير قطاع","value":"sector_manager"},
        {"label":"مدير عام الصيانة","value":"maint_manager"},
        {"label":"مدير عمليات","value":"brand_ops_manager"},
        {"label":"مدير نظام","value":"admin"}
    ]},
    {"key":"branch_id","label":"الفرع","type":"select","dataSource":"branches"}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config;

-- Sectors & Areas (Hierarchy)
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('sectors', '{"title":"قطاعات التشغيل","columns":[{"key":"name","label":"القطاع","type":"text"}]}'::jsonb, '{}'::jsonb),
('areas', '{"title":"المناطق التشغيلية","columns":[{"key":"name","label":"المنطقة","type":"text"}]}'::jsonb, '{}'::jsonb),
('branches', '{"title":"الفروع التشغيلية","columns":[{"key":"name","label":"الفرع","type":"text"}]}'::jsonb, '{}'::jsonb)
ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config;

-- 4. Maintenance Core (Tickets & Assets)
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('tickets', 
  '{"title":"سجل البلاغات والأعطال","columns":[
    {"key":"asset_name","label":"المعدة","type":"text"},
    {"key":"status","label":"الحالة","type":"status"},
    {"key":"priority","label":"الأولوية","type":"status"},
    {"key":"created_at","label":"تاريخ البلاغ","type":"date"}
  ]}'::jsonb,
  '{"title":"تعديل بلاغ صيانة","fields":[
    {"key":"status","label":"حالة البلاغ","type":"select","options":[
        {"label":"بلاغ جديد","value":"open"},
        {"label":"تم الإسناد","value":"assigned"},
        {"label":"تحت الإصلاح","value":"in_progress"},
        {"label":"تم الإصلاح","value":"resolved"},
        {"label":"مغلق","value":"closed"}
    ]}
  ]}'::jsonb
),
('maintenance_assets', 
  '{"title":"إدارة الأصول والمعدات","columns":[
    {"key":"name","label":"اسم المعدة","type":"text"},
    {"key":"model_number","label":"الموديل","type":"text"},
    {"key":"branch_id","label":"الفرع","type":"text"}
  ]}'::jsonb,
  '{}'::jsonb
),
('maintenance_categories', 
  '{"title":"تصنيفات الأعطال","columns":[{"key":"name","label":"التصنيف","type":"text"}]}'::jsonb, 
  '{}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config;

-- 5. Operations & Logistics
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('technician_attendance', 
  '{"title":"سجل الحضور الميداني","columns":[
    {"key":"profile_id","label":"الفني","type":"text"},
    {"key":"check_in","label":"وقت الحضور","type":"datetime"},
    {"key":"status","label":"الحالة","type":"status"}
  ]}'::jsonb, 
  '{}'::jsonb
),
('technician_missions', 
  '{"title":"مهام العمل الميداني","columns":[
    {"key":"profile_id","label":"الفني","type":"text"},
    {"key":"description","label":"تفاصيل المهمة","type":"text"},
    {"key":"status","label":"حالة المهمة","type":"status"}
  ]}'::jsonb, 
  '{}'::jsonb
),
('payroll_logs', 
  '{"title":"السجلات المالية والرواتب","columns":[
    {"key":"profile_id","label":"الموظف","type":"text"},
    {"key":"base_salary","label":"الراتب الأساسي","type":"number"},
    {"key":"net_salary","label":"صافي المستحق","type":"number"}
  ]}'::jsonb, 
  '{}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config;

-- 6. Inventory & Transactions
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('inventory',
  '{"title":"مخزون قطع الغيار","columns":[
    {"key":"name","label":"اسم الصنف","type":"text"},
    {"key":"quantity","label":"الرصيد المتاح","type":"number"},
    {"key":"unit_cost","label":"تكلفة الوحدة","type":"currency"}
  ]}'::jsonb,
  '{"title":"إضافة/تعديل صنف مخزني","fields":[
    {"key":"name","label":"اسم الصنف","type":"text","required":true},
    {"key":"quantity","label":"الكمية","type":"number","required":true},
    {"key":"unit_cost","label":"تكلفة الوحدة","type":"number"}
  ]}'::jsonb
),
('inventory_transactions',
  '{"title":"سجل حركات المخزن","columns":[
    {"key":"ticket_id","label":"رقم البلاغ","type":"text"},
    {"key":"inventory_id","label":"الصنف","type":"text"},
    {"key":"quantity_used","label":"الكمية","type":"number"},
    {"key":"technician_id","label":"الفني","type":"text"}
  ]}'::jsonb,
  '{"title":"تسجيل استهلاك مخزني","fields":[
    {"key":"ticket_id","label":"البلاغ المرتبط","type":"select","dataSource":"tickets","dataLabel":"asset_name"},
    {"key":"inventory_id","label":"الصنف","type":"select","dataSource":"inventory"},
    {"key":"quantity_used","label":"الكمية المستهلكة","type":"number","required":true},
    {"key":"technician_id","label":"الفني","type":"select","dataSource":"profiles","dataLabel":"full_name"}
  ]}'::jsonb
),
('system_settings',
  '{"title":"إعدادات النظام (المطورين)","columns":[
    {"key":"key","label":"المفتاح","type":"text"},
    {"key":"value","label":"القيمة الحالية","type":"text"},
    {"key":"updated_at","label":"تاريخ التعديل","type":"datetime"}
  ],"defaultSort":{"column":"key","ascending":true}}'::jsonb,
  '{"title":"تعديل قيمة برمجية","fields":[
    {"key":"key","label":"مفتاح الإعداد","type":"text","disabled":true},
    {"key":"value","label":"القيمة","type":"text","required":true}
  ]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config;

-- 7. Final Permission Cleanup
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
