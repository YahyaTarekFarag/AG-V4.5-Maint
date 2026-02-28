-- V38__fix_schema_mismatches.sql
-- ============================================================
-- مرحلة الإصلاح النهائي: توحيد عقد البيانات بين الكود والواجهة
-- ============================================================

-- 1. إصلاح جدول البلاغات (Tickets)
-- إضافة عمود title المفقود والذي تعتمد عليه كافة الواجهات
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'title') THEN
        ALTER TABLE public.tickets ADD COLUMN title TEXT;
        -- نقل الوصف كعنوان مؤقت للبيانات القديمة لضمان عدم وجود قيم فارغة
        UPDATE public.tickets SET title = LEFT(description, 50) WHERE title IS NULL;
    END IF;
END $$;

-- 2. توحيد مسميات جدول المناوبات (Shifts) في محرك الواجهات
-- تصحيح ui_schemas والمفاتيح لتعمل مع الأعمدة الحقيقية في قاعدة البيانات
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "سجل المناوبات",
    "columns": [
      {"key": "technician_id", "label": "الفني",        "type": "text",   "sortable": true},
      {"key": "start_at",      "label": "بداية المناوبة","type": "date",   "sortable": true},
      {"key": "end_at",        "label": "نهاية المناوبة","type": "date",   "sortable": true},
      {"key": "start_lat",     "label": "موقع البداية",  "type": "text"},
      {"key": "end_lat",       "label": "موقع النهاية",  "type": "text"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "مناوبة الفني",
    "fields": [
      {"key": "technician_id", "label": "الفني", "type": "select", "required": true, "dataSource": "profiles", "dataValue": "id", "dataLabel": "full_name"},
      {"key": "start_at",      "label": "وقت البدء",   "type": "date", "required": true},
      {"key": "end_at",        "label": "وقت الانتهاء", "type": "date"},
      {"key": "start_lat",     "label": "خط عرض البداية", "type": "number"},
      {"key": "start_lng",     "label": "خط طول البداية", "type": "number"}
    ]
  }'::jsonb
WHERE table_name = 'shifts';

-- 3. التأكد من وجود created_at في كافة الجداول التشغيلية (للتوافق مع useSovereign)
-- (تم التأكد من صحتها في V13 ولكن كإجراء احترازي إضافي)
ALTER TABLE IF EXISTS public.inventory_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.inventory_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
