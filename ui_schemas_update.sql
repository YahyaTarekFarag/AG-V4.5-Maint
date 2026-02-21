-- ==========================================
-- المرحلة 7: تحديث الواجهات السيادية (UI Schemas Sync)
-- ==========================================

-- 1. تحديث واجهة الموظفين لإضافة ربط الفرع
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
      { "key": "password", "label": "كلمة المرور", "type": "text", "required": true, "placeholder": "أدخل كلمة مرور قوية" },
      { "key": "role", "label": "صلاحية النظام", "type": "select", "required": true, 
        "options": [
          {"label": "مدير فرع", "value": "manager"},
          {"label": "فني صيانة", "value": "technician"},
          {"label": "مسؤول نظام (أدمن)", "value": "admin"}
        ]
      },
      { "key": "branch_id", "label": "الفرع التابع له (للمديرين)", "type": "select", 
        "dataSource": "branches", "dataLabel": "name", "dataValue": "id" }
    ]
  }'::jsonb
)
ON CONFLICT (table_name) DO UPDATE SET 
  form_config = EXCLUDED.form_config,
  list_config = EXCLUDED.list_config;

-- 2. تحديث واجهة البلاغات لإضافة رفع الصور والموقع
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
      { "key": "branch_id", "label": "الفرع", "type": "select", "required": true, "dataSource": "branches", "dataLabel": "name", "dataValue": "id" },
      { "key": "asset_name", "label": "المعدة المعطلة", "type": "text", "required": true },
      { "key": "description", "label": "وصف العطل", "type": "textarea", "required": true },
      { "key": "priority", "label": "الأولوية", "type": "select", "options": [
          {"label": "عادي", "value": "normal"},
          {"label": "عالي", "value": "high"},
          {"label": "طارئ جداً", "value": "urgent"}
      ]},
      { "key": "reported_image_url", "label": "صورة العطل (قبل)", "type": "image" },
      { "key": "resolved_image_url", "label": "صورة الإصلاح (بعد)", "type": "image" },
      { "key": "reported_lat", "label": "موقع البلاغ (Lat)", "type": "number", "hidden": true },
      { "key": "reported_lng", "label": "موقع البلاغ (Lng)", "type": "number", "hidden": true }
    ]
  }'::jsonb
)
ON CONFLICT (table_name) DO UPDATE SET 
  form_config = EXCLUDED.form_config;
