-- V41__structural_alignment_v5.sql
-- ============================================================
-- المرحلة 15: التوافق الهيكلي المطلق (Sovereign Alignment)
-- ============================================================

-- 1. استعادة دوال التحكم السيادية (Sovereign RPCs)
CREATE OR REPLACE FUNCTION public.sovereign_execute_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', sql_query) INTO v_result;
    RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Sovereign Execution Error: %', SQLERRM;
END;
$$;

-- 2. إصلاح جدول الفئات (Maintenance Categories)
ALTER TABLE public.maintenance_categories ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. إصلاح جدول المخزون (Inventory)
DO $$ 
BEGIN 
    -- التأكد من وجود الأعمدة الحيوية
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'min_quantity') THEN
        ALTER TABLE public.inventory ADD COLUMN min_quantity INTEGER DEFAULT 5;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'branch_id') THEN
        ALTER TABLE public.inventory ADD COLUMN branch_id UUID REFERENCES public.branches(id);
    END IF;

    -- توحيد المسمى ليكون name بدلاً من item_name (إذا وجد النسق القديم)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'item_name') THEN
        ALTER TABLE public.inventory RENAME COLUMN item_name TO name;
    END IF;
END $$;

-- 4. إصلاح جدول البلاغات (Tickets)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE public.tickets SET title = LEFT(description, 50) WHERE title IS NULL AND description IS NOT NULL;

-- 5. واجهة المناوبات (Shifts Alignment)
-- التأكد من عدم وجود جدول بنفس الاسم يعيق إنشاء الـ View
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shifts') THEN
    ALTER TABLE public.shifts RENAME TO shifts_legacy_table;
  END IF;
END $$;

-- إنشاء View للمناوبات لتسهيل التعامل معها وتوحيد المسميات مع ui_schemas
CREATE OR REPLACE VIEW public.shifts AS
SELECT 
    id,
    profile_id AS technician_id,
    clock_in AS start_at,
    clock_out AS end_at,
    clock_in_lat AS start_lat,
    clock_in_lng AS start_lng,
    clock_out_lat AS end_lat,
    clock_out_lng AS end_lng,
    shift_id,
    is_valid,
    created_at,
    is_deleted
FROM public.technician_attendance;

-- 6. تطهير سجلات الواجهات (UI_Schemas Purge & Update)
-- تحديث المخزون لاستخدام name
UPDATE public.ui_schemas
SET 
  list_config = '{
    "columns": [
      {"key": "name", "label": "الصنف", "type": "text", "sortable": true},
      {"key": "quantity", "label": "الرصيد", "type": "number"},
      {"key": "min_quantity", "label": "حد الطلب", "type": "number", "variant": "warning"},
      {"key": "unit_cost", "label": "التكلفة", "type": "currency"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات الصنف المخزني",
    "fields": [
      {"key": "name", "label": "اسم الصنف", "type": "text", "required": true},
      {"key": "quantity", "label": "الكمية الحالية", "type": "number", "required": true},
      {"key": "min_quantity", "label": "حد الطلب الأدنى", "type": "number"},
      {"key": "unit_cost", "label": "تكلفة الوحدة", "type": "number"},
      {"key": "branch_id", "label": "المستودع", "type": "select", "dataSource": "branches"}
    ]
  }'::jsonb
WHERE table_name = 'inventory';

-- تحديث البلاغات لاستخدام title
UPDATE public.ui_schemas
SET 
  list_config = jsonb_set(list_config, '{columns, 0}', '{"key": "title", "label": "عنوان البلاغ", "type": "text", "sortable": true}') 
WHERE table_name = 'tickets';

-- 7. منح الصلاحيات
GRANT ALL ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
