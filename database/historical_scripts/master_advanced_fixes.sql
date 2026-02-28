-- ==========================================
-- FSC-MAINT-APP Advanced Features Master Fix
-- ==========================================

-- 1. Schema Extensions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_at timestamptz DEFAULT NOW();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_image_url text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_image_url text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS rating_score int;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS rating_comment text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_lat float8;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_lng float8;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS started_lat float8;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS started_lng float8;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_lat float8;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_lng float8;

CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value) 
VALUES ('restrict_branch_submission', '"true"') -- Match JSON string format
ON CONFLICT (key) DO NOTHING;

-- 2. UI Schemas Sync (Metadata)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'profiles',
  '{
    "title": "إدارة شؤون الموظفين",
    "columns": [
      { "key": "full_name", "label": "الاسم الكامل", "type": "text" },
      { "key": "employee_code", "label": "كود الموظف", "type": "badge" },
      { "key": "role", "label": "الصلاحية", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة / تعديل بيانات موظف",
    "fields": [
      { "key": "full_name", "label": "الاسم الرباعي", "type": "text", "required": true },
      { "key": "employee_code", "label": "كود الدخول التعريفي", "type": "text", "required": true },
      { "key": "password", "label": "كلمة المرور", "type": "text", "required": true },
      { "key": "role", "label": "صلاحية النظام", "type": "select", "required": true, 
        "options": [
          {"label": "مدير فرع", "value": "manager"},
          {"label": "فني صيانة", "value": "technician"},
          {"label": "مسؤول نظام (أدمن)", "value": "admin"}
        ]
      },
      { "key": "branch_id", "label": "الفرع التابع له (لمديري الفروع)", "type": "select", "dataSource": "branches" }
    ]
  }'::jsonb
)
ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config;

INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'tickets',
  '{
    "title": "سجل تذاكر الصيانة",
    "searchable": true,
    "columns": [
      { "key": "asset_name", "label": "المعدة", "type": "text" },
      { "key": "status", "label": "الحالة", "type": "status" },
      { "key": "priority", "label": "الأولوية", "type": "badge" },
      { "key": "created_at", "label": "وقت البلاغ", "type": "date" }
    ]
  }'::jsonb,
  '{
    "title": "تفاصيل بلاغ الصيانة",
    "fields": [
      { "key": "branch_id", "label": "الفرع", "type": "select", "required": true, "dataSource": "branches" },
      { "key": "asset_name", "label": "المعدة المعطلة", "type": "text", "required": true },
      { "key": "description", "label": "وصف العطل", "type": "textarea", "required": true },
      { "key": "reported_image_url", "label": "صورة العطل (قبل)", "type": "image" }
    ]
  }'::jsonb
)
ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config;

-- Grant Permissions
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;
