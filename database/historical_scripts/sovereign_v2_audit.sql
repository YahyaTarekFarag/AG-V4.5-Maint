-- ============================================================
-- المرحلة 5: Audit Log + Soft Delete
-- شغّل في Supabase SQL Editor
-- ============================================================

-- إنشاء جدول سجل التغييرات أولاً
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name   text        NOT NULL,
  record_id    text,
  action       text        NOT NULL,
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


-- دالة التسجيل التلقائي لكل تغيير
CREATE OR REPLACE FUNCTION log_sovereign_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((NEW->>'id')::text, (OLD->>'id')::text),
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- تفعيل Trigger على الجداول الرئيسية
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tickets','branches','profiles','inventory','shifts']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS sovereign_audit_%1$s ON public.%1$I;
      CREATE TRIGGER sovereign_audit_%1$s
      AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION log_sovereign_changes();
    ', tbl);
  END LOOP;
END;
$$;

-- صلاحيات audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_audit" ON public.audit_logs FOR ALL
  TO authenticated USING (true);
