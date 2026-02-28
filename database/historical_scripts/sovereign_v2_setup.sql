-- ============================================================
-- محرك الواجهات السيادي V2 — دوال Auto-DDL
-- شغّل في Supabase SQL Editor
-- ============================================================

-- حذف الدوال القديمة أولاً (لتجنب تعارض نوع الـ return)
DROP FUNCTION IF EXISTS sovereign_add_column(text, text, text);
DROP FUNCTION IF EXISTS sovereign_create_table(text);
DROP FUNCTION IF EXISTS sovereign_drop_column(text, text);
DROP FUNCTION IF EXISTS sovereign_list_tables();
DROP FUNCTION IF EXISTS sovereign_list_columns(text);
DROP FUNCTION IF EXISTS sovereign_drop_table(text);

-- 1. إضافة عمود بشكل آمن
CREATE OR REPLACE FUNCTION sovereign_add_column(
  p_table  text,
  p_column text,
  p_type   text DEFAULT 'text'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = p_table
      AND column_name  = p_column
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    RETURN jsonb_build_object('success', true, 'action', 'added', 'column', p_column);
  END IF;
  RETURN jsonb_build_object('success', true, 'action', 'skipped', 'reason', 'column_exists');
END;
$$;

-- 2. إنشاء جدول جديد (مع id + timestamps)
CREATE OR REPLACE FUNCTION sovereign_create_table(
  p_table text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I (
         id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
         created_at timestamptz DEFAULT NOW(),
         updated_at timestamptz DEFAULT NOW()
       )', p_table
    );
    RETURN jsonb_build_object('success', true, 'action', 'created', 'table', p_table);
  END IF;
  RETURN jsonb_build_object('success', true, 'action', 'skipped', 'reason', 'table_exists');
END;
$$;

-- 3. حذف عمود
CREATE OR REPLACE FUNCTION sovereign_drop_column(
  p_table  text,
  p_column text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I', p_table, p_column);
  RETURN jsonb_build_object('success', true, 'action', 'dropped', 'column', p_column);
END;
$$;

-- 4. عرض كل الجداول مع عدد الصفوف
CREATE OR REPLACE FUNCTION sovereign_list_tables()
RETURNS TABLE(table_name text, row_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT t.table_name FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type   = 'BASE TABLE'
      AND t.table_name  != 'audit_logs'
    ORDER BY t.table_name
  LOOP
    BEGIN
      table_name := tbl;
      EXECUTE format('SELECT COUNT(*) FROM public.%I', tbl) INTO row_count;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      table_name := tbl; row_count := 0; RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- 5. عرض أعمدة جدول معين
CREATE OR REPLACE FUNCTION sovereign_list_columns(p_table text)
RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table
  ORDER BY ordinal_position;
$$;

-- 6. حذف جدول كامل (بتأكيد)
CREATE OR REPLACE FUNCTION sovereign_drop_table(p_table text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', p_table);
  RETURN jsonb_build_object('success', true, 'action', 'dropped_table', 'table', p_table);
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION sovereign_add_column    TO authenticated;
GRANT EXECUTE ON FUNCTION sovereign_create_table  TO authenticated;
GRANT EXECUTE ON FUNCTION sovereign_drop_column   TO authenticated;
GRANT EXECUTE ON FUNCTION sovereign_list_tables   TO authenticated;
GRANT EXECUTE ON FUNCTION sovereign_list_columns  TO authenticated;
GRANT EXECUTE ON FUNCTION sovereign_drop_table    TO authenticated;

-- ============================================================
-- Audit Log (المرحلة 5 — اختياري الآن)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name   text        NOT NULL,
  record_id    text,
  action       text        NOT NULL, -- INSERT | UPDATE | DELETE
  old_data     jsonb,
  new_data     jsonb,
  user_id      uuid,
  performed_at timestamptz DEFAULT NOW()
);

-- Soft Delete columns
ALTER TABLE public.tickets   ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.branches  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
