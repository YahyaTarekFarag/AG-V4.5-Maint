-- ==========================================
-- المرحلة العاشرة: سجل التدقيق، تحسين الأداء، وتأمين البيانات
-- ==========================================

-- 1. إنشاء جدول سجل التدقيق الموحد (Universal Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL, -- INSERT, UPDATE, DELETE
    old_data jsonb,
    new_data jsonb,
    changed_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تفعيل الـ RLS على جدول التدقيق (للقراءة فقط للمديرين)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers and admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'maint_manager')
        )
    );

-- 2. وظيفة التريجر العامة للتدقيق
CREATE OR REPLACE FUNCTION public.handle_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- محاولة الحصول على معرّف المستخدم من Auth.uid()
    v_user_id := auth.uid();

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. تطبيق التريجر على الجداول الحساسة
-- جداول البلاغات
DROP TRIGGER IF EXISTS audit_tickets_trigger ON public.tickets;
CREATE TRIGGER audit_tickets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();

-- جداول المخزون
DROP TRIGGER IF EXISTS audit_inventory_trigger ON public.inventory;
CREATE TRIGGER audit_inventory_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();

-- جداول الحضور (لمنع التلاعب الزمني)
DROP TRIGGER IF EXISTS audit_attendance_trigger ON public.technician_attendance;
CREATE TRIGGER audit_attendance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.technician_attendance
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();

-- 4. تحسين الأداء (Performance Indexing)
-- تحسين البحث في البلاغات
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_branch ON public.tickets(branch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);

-- تحسين البحث في المخزون
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_part_number ON public.inventory(part_number);

-- تحسين البحث في سجلات الحضور والمعاملات
CREATE INDEX IF NOT EXISTS idx_attendance_profile_date ON public.technician_attendance(profile_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_inv_transactions_ticket ON public.inventory_transactions(ticket_id);

-- 5. صيانة الأمن (RLS Hardening)
-- منع الفني من تعديل وقت الحضور (clock_in) بعد تسجيله
-- والسماح فقط بتحديث الانصراف (clock_out)
DROP POLICY IF EXISTS "Technicians can update their own attendance" ON public.technician_attendance;
CREATE POLICY "Technicians can update their own attendance" ON public.technician_attendance
    FOR UPDATE USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- استخدام تريجر لضمان عدم تغيير وقت الحضور (لأن RLS لا يدعم OLD/NEW)
CREATE OR REPLACE FUNCTION public.enforce_attendance_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.clock_in IS DISTINCT FROM NEW.clock_in THEN
        RAISE EXCEPTION 'Security Error: لا يمكن تعديل وقت الحضور بعد تسجيله.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_attendance_integrity ON public.technician_attendance;
CREATE TRIGGER trg_enforce_attendance_integrity
BEFORE UPDATE ON public.technician_attendance
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_integrity();

-- 6. دعم الربط العميق للأصول (Asset ID Linkage Support)
-- التأكد من وجود عمود asset_id في جدول البلاغات (تحسباً)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tickets' AND COLUMN_NAME = 'asset_id') THEN
        ALTER TABLE public.tickets ADD COLUMN asset_id uuid REFERENCES public.maintenance_assets(id);
    END IF;
END $$;
