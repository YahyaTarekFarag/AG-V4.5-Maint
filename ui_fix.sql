-- ==========================================
-- FSC-MAINT-APP UI & MAP STABILITY FIX
-- ==========================================

-- 1. مزامنة البيانات المفقودة في سجل البلاغات
-- التأكد من أن مفاتيح العرض (Keys) تطابق تماماً أسماء الأعمدة في قاعدة البيانات
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'tickets',
  '{
    "title": "سجل البلاغات",
    "searchable": true,
    "columns": [
      { "key": "asset_name", "label": "عنوان البلاغ", "type": "text" },
      { "key": "status", "label": "الحالة", "type": "status" },
      { "key": "reported_at", "label": "تاريخ البلاغ", "type": "date" },
      { "key": "rating_score", "label": "التقييم", "type": "badge" }
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
ON CONFLICT (table_name) DO UPDATE SET 
  list_config = EXCLUDED.list_config,
  form_config = EXCLUDED.form_config;
