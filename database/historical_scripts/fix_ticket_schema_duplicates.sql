-- ==========================================
-- B.LABAN EGYPTIAN EDITION — Ticket Schema Cleanup V11.2 (FIXED)
-- ==========================================

-- This script cleans up duplicate fields in the ui_schemas table for the 'tickets' table.
-- It resets the form_config and list_config to a clean, canonical state.

UPDATE public.ui_schemas
SET 
  form_config = jsonb_build_object(
    'title', 'فتح بلاغ صيانة ذكي',
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'asset_id', 'label', 'تحديد المعدة (من سجل الأصول) *', 'type', 'select', 'dataSource', 'maintenance_assets', 'required', true),
      jsonb_build_object('key', 'category_id', 'label', 'تصنيف العطل *', 'type', 'select', 'dataSource', 'maintenance_categories', 'required', true),
      jsonb_build_object('key', 'asset_name', 'label', 'اسم المعدة / عنوان البلاغ *', 'type', 'text', 'required', true),
      jsonb_build_object('key', 'reporter_name', 'label', 'اسم القائم بالبلاغ *', 'type', 'text', 'required', true),
      jsonb_build_object('key', 'reporter_job', 'label', 'وظيفة القائم بالبلاغ *', 'type', 'text', 'required', true),
      jsonb_build_object('key', 'reporter_phone', 'label', 'رقم هاتف القائم بالبلاغ *', 'type', 'text', 'required', true),
      jsonb_build_object('key', 'breakdown_time', 'label', 'موعد تعطل المعدة فعلياً *', 'type', 'datetime', 'required', true),
      jsonb_build_object('key', 'description', 'label', 'وصف تفصيلي', 'type', 'textarea'),
      jsonb_build_object('key', 'priority', 'label', 'أولوية قصوى؟', 'type', 'checkbox', 'placeholder', 'بلاغ طوارئ وحالة حرجة (Emergency)'),
      jsonb_build_object('key', 'image_url', 'label', 'صورة العطل (اختياري)', 'type', 'image')
    )
  ),
  list_config = jsonb_build_object(
    'columns', jsonb_build_array(
      jsonb_build_object('key', 'status', 'label', 'الحالة', 'type', 'status'),
      jsonb_build_object('key', 'asset_name', 'label', 'المعدة', 'type', 'text'),
      jsonb_build_object('key', 'branches.name', 'label', 'الفرع', 'type', 'text'),
      jsonb_build_object('key', 'reporter_name', 'label', 'المُبلغ', 'type', 'text'),
      jsonb_build_object('key', 'created_at', 'label', 'تاريخ البلاغ', 'type', 'date')
    ),
    'searchable', true,
    'defaultSort', jsonb_build_object('column', 'created_at', 'ascending', false)
  )
WHERE table_name = 'tickets';
