-- ==========================================================
-- تسجيل الجداول الجديدة في محرك الواجهات السيادي
-- شغّل هذا الملف في Supabase SQL Editor
-- ==========================================================

-- 1. إضافة جدول المناوبات (shifts) للمحرك
INSERT INTO public.ui_schemas (table_name, form_config, list_config)
VALUES (
  'shifts',
  '{
    "title": "مناوبة الفني",
    "fields": [
      {"key": "technician_id", "label": "الفني", "type": "select", "required": true, "dataSource": "profiles", "dataValue": "id", "dataLabel": "full_name"},
      {"key": "start_at",      "label": "وقت البدء",   "type": "date", "required": true},
      {"key": "start_lat",     "label": "خط عرض البداية (تلقائي)", "type": "number"},
      {"key": "start_lng",     "label": "خط طول البداية (تلقائي)", "type": "number"},
      {"key": "end_at",        "label": "وقت الانتهاء", "type": "date"},
      {"key": "end_lat",       "label": "خط عرض النهاية (تلقائي)", "type": "number"},
      {"key": "end_lng",       "label": "خط طول النهاية (تلقائي)", "type": "number"}
    ]
  }',
  '{
    "title": "سجل المناوبات",
    "columns": [
      {"key": "technician_id", "label": "الفني",        "type": "text",   "sortable": true},
      {"key": "start_at",      "label": "بداية المناوبة","type": "date",   "sortable": true},
      {"key": "end_at",        "label": "نهاية المناوبة","type": "date",   "sortable": true},
      {"key": "start_lat",     "label": "موقع البداية",  "type": "text",   "sortable": false},
      {"key": "end_lat",       "label": "موقع النهاية",  "type": "text",   "sortable": false}
    ]
  }'
)
ON CONFLICT (table_name) DO UPDATE SET
  form_config = EXCLUDED.form_config,
  list_config = EXCLUDED.list_config;


-- 2. تحديث مخطط جدول البلاغات (tickets) بالحقول الجديدة
UPDATE public.ui_schemas
SET
  form_config = '{
    "title": "إضافة / تعديل بلاغ",
    "fields": [
      {"key": "title",         "label": "عنوان البلاغ",      "type": "text",    "required": true,  "placeholder": "مثال: عطل في التكييف المركزي"},
      {"key": "description",   "label": "وصف تفصيلي",        "type": "textarea","required": false, "placeholder": "اشرح المشكلة بالتفصيل..."},
      {"key": "status",        "label": "حالة البلاغ",       "type": "select",  "required": true,
       "options": [
         {"value": "open",        "label": "جديد"},
         {"value": "assigned",    "label": "مُسنَد للفني"},
         {"value": "in_progress", "label": "قيد الإصلاح"},
         {"value": "resolved",    "label": "تم الإصلاح"},
         {"value": "closed",      "label": "مُغلَق"}
       ]
      },
      {"key": "manager_id",    "label": "مدير الفرع",         "type": "select", "dataSource": "profiles", "dataValue": "id", "dataLabel": "full_name"},
      {"key": "assigned_to",   "label": "الفني المسؤول",      "type": "select", "dataSource": "profiles", "dataValue": "id", "dataLabel": "full_name"},
      {"key": "reported_at",   "label": "وقت البلاغ",         "type": "date"},
      {"key": "reported_lat",  "label": "خط عرض البلاغ (GPS)", "type": "number"},
      {"key": "reported_lng",  "label": "خط طول البلاغ (GPS)", "type": "number"},
      {"key": "resolved_lat",  "label": "خط عرض الإصلاح (GPS)","type": "number"},
      {"key": "resolved_lng",  "label": "خط طول الإصلاح (GPS)","type": "number"},
      {"key": "rating_score",  "label": "تقييم الفني (1-5)",   "type": "number"},
      {"key": "rating_comment","label": "تعليق التقييم",       "type": "textarea"}
    ]
  }',
  list_config = '{
    "title": "سجل البلاغات",
    "columns": [
      {"key": "title",       "label": "عنوان البلاغ",  "type": "text",   "sortable": true},
      {"key": "status",      "label": "الحالة",         "type": "status", "sortable": true},
      {"key": "reported_at", "label": "تاريخ البلاغ",   "type": "date",   "sortable": true},
      {"key": "assigned_to", "label": "الفني المسؤول",  "type": "text",   "sortable": false},
      {"key": "rating_score","label": "التقييم",        "type": "number", "sortable": true}
    ]
  }'
WHERE table_name = 'tickets';


-- 3. إضافة عمود lat/lng الفروع لمخطط جدول branches
UPDATE public.ui_schemas
SET
  form_config = jsonb_set(
    jsonb_set(
      form_config::jsonb,
      '{fields}',
      (form_config::jsonb -> 'fields') ||
      '[
        {"key": "latitude",  "label": "خط العرض (Latitude)",  "type": "number", "placeholder": "مثال: 30.0444"},
        {"key": "longitude", "label": "خط الطول (Longitude)", "type": "number", "placeholder": "مثال: 31.2357"}
      ]'::jsonb
    ),
    '{title}',
    '"إضافة / تعديل فرع"'
  )
WHERE table_name = 'branches'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(form_config::jsonb -> 'fields') AS f
    WHERE f->>'key' = 'latitude'
  );
