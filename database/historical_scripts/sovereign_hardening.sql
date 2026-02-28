-- ==========================================
-- الحصن السيادي: الإصلاحات الجوهرية (Sovereign Hardening)
-- defusing logical bombs and ensuring data integrity
-- ==========================================

-- 1. تأمين المخازن ضد الأرصدة السالبة (Ultimate Bomb Defusal)
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS public.inventory 
    ADD CONSTRAINT quantity_non_negative CHECK (quantity >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. تحصين الـ Views ضد القيم الفارغة (Null-Safe Intelligence)
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(t.id) as tickets_solved,
    COALESCE(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.started_at))/3600), 0)::numeric(10,2) as avg_repair_hours,
    COALESCE(AVG(t.rating_score), 0)::numeric(10,1) as avg_rating,
    COALESCE(SUM(it.quantity_used * i.unit_cost), 0)::numeric(10,2) as total_parts_cost
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.status = 'closed' AND t.started_at IS NOT NULL AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;

CREATE OR REPLACE VIEW public.v_critical_assets_report AS
SELECT 
    a.name as asset_name,
    b.name as branch_name,
    COUNT(t.id) as failure_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (t.resolved_at - t.downtime_start))/3600), 0)::numeric(10,2) as total_downtime_hours,
    MAX(t.created_at) as last_failure_date
FROM public.maintenance_assets a
JOIN public.branches b ON a.branch_id = b.id
JOIN public.tickets t ON a.id = t.asset_id
WHERE t.status IN ('resolved', 'closed') AND t.downtime_start IS NOT NULL
GROUP BY a.id, a.name, b.name
ORDER BY failure_count DESC;

-- 3. تفعيل الفهارس الذكية لتحسين الأداء تحت الضغط العالي
CREATE INDEX IF NOT EXISTS idx_inventory_id_qty ON public.inventory(id, quantity);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON public.tickets(resolved_at) WHERE status = 'closed';

-- 4. تعزيز دالة الخصم بالتأكد من الكمية (Redundancy check)
CREATE OR REPLACE FUNCTION public.handle_inventory_deduction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity_used,
        updated_at = NOW()
    WHERE id = NEW.inventory_id
    AND quantity >= NEW.quantity_used;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'فشل في تحديث المخزن: قد يكون الرصيد غير كافٍ أو أن هناك تضارب في العمليات.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE postgres IS 'Applied Sovereign Hardening Patch - Logical Bombs Defused';
