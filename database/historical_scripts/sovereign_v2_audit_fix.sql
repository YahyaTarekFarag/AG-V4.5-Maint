-- ============================================================
-- إصلاح trigger الـ Audit Log
-- سبب الخطأ: NEW->>'id' غير صالح على نوع ROW — يجب to_jsonb(NEW)->>'id'
-- شغّل في Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION log_sovereign_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_json jsonb;
    old_json jsonb;
BEGIN
    new_json := CASE WHEN NEW IS NOT NULL THEN to_jsonb(NEW) ELSE NULL END;
    old_json := CASE WHEN OLD IS NOT NULL THEN to_jsonb(OLD) ELSE NULL END;

    INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(new_json->>'id', old_json->>'id'),
        TG_OP,
        old_json,
        new_json,
        auth.uid()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;
