-- ==========================================
-- FSC-MAINT-APP UI Schemas Patch
-- ⚠️ Run this file to fix missing UI schemas for profiles and ui_schemas tables
-- ==========================================

INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES
(
  'profiles',
  '{
    "title": "إدارة الموظفين (المستخدمين)",
    "searchable": true,
    "searchPlaceholder": "ابحث عن اسم موظف أو كود...",
    "columns": [
      { "key": "full_name", "label": "اسم الموظف", "type": "text" },
      { "key": "employee_code", "label": "كود الدخول", "type": "badge" },
      { "key": "role", "label": "الصلاحية", "type": "status" },
      { "key": "created_at", "label": "تاريخ الانضمام", "type": "date" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة / تعديل موظف",
    "fields": [
      { "key": "full_name", "label": "الاسم الرباعي", "type": "text", "required": true },
      { "key": "employee_code", "label": "كود الدخول التعريفي", "type": "text", "required": true },
      { "key": "role", "label": "صلاحية النظام", "type": "select", "required": true, "options": [
        { "label": "مدير نظام مركزي", "value": "admin" },
        { "label": "مدير فرع", "value": "manager" },
        { "label": "فني صيانة", "value": "technician" }
      ]}
    ]
  }'::jsonb
),
(
  'ui_schemas',
  '{
    "title": "إعدادات محرك الواجهات السيادي (للمطورين)",
    "searchable": true,
    "columns": [
      { "key": "table_name", "label": "مفتاح الجدول المربوط", "type": "badge" },
      { "key": "created_at", "label": "تاريخ الإنشاء", "type": "date" }
    ]
  }'::jsonb,
  '{
    "title": "تعديل إعدادات بنية الشاشة",
    "fields": [
      { "key": "table_name", "label": "اسم الجدول في قاعدة البيانات", "type": "text", "required": true },
      { "key": "list_config", "label": "هيكل بيانات الجدول (JSON)", "type": "textarea", "required": true },
      { "key": "form_config", "label": "هيكل شكل النموذج (JSON)", "type": "textarea", "required": true }
    ]
  }'::jsonb
);
