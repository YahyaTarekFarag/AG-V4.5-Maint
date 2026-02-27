-- ======================================================
-- المرحلة الختامية: التحصين الكمي (Quantum Hardening V2)
-- معالجة الجمود، تضخم البيانات، وتوحيد السيادة الجغرافية
-- ======================================================

-- 1. إصلاح الهيكل التنظيمي والفرادة (Idempotency & Structure)
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS submission_id TEXT UNIQUE;
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS submission_id TEXT UNIQUE;

-- 2. توحيد السيادة الجغرافية (Geographic Unification)
-- توحيد مسميات خطوط الطول والعرض لضمان التوافقية الشاملة
DO $$ 
BEGIN
    -- تعديل حقول الفروع
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='branch_lat') THEN
        ALTER TABLE public.branches RENAME COLUMN branch_lat TO latitude;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='branch_lng') THEN
        ALTER TABLE public.branches RENAME COLUMN branch_lng TO longitude;
    END IF;
END $$;

-- 3. تحصين خصم المخزون ومنع الجمود (Atomic Deadlock-Free Deduction)
-- [CRITICAL FIX] حذف النسخ القديمة لتجنب تضارب الأسماء (Function Overloading Conflict)
DROP FUNCTION IF EXISTS public.deduct_inventory_atomic(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.deduct_inventory_atomic(UUID, UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.deduct_inventory_atomic(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_items JSONB, -- Array of {part_id, qty}
    p_submission_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- [QUANTUM SECURITY] منع التكرار (Idempotency)
    IF p_submission_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE submission_id = p_submission_id) THEN
            RETURN;
        END IF;
    END IF;

    -- [DEADLOCK PREVENTION] ترتيب الأصناف حسب الـ ID لضمان عدم حدوث الجمود عند السحب المتزامن
    FOR v_item IN 
        SELECT (x->>'part_id')::UUID as part_id, (x->>'qty')::INT as qty
        FROM jsonb_array_elements(p_items) AS x
        ORDER BY (x->>'part_id')::UUID -- الترتيب هو المفتاح لمنع Deadlock
    LOOP
        -- قفل الصف بشكل حصري لمنع Race Condition
        PERFORM id FROM public.inventory WHERE id = v_item.part_id FOR UPDATE;

        -- تسجيل الحركة (التريجر handle_inventory_deduction سيقوم بالخصم الفعلي)
        INSERT INTO public.inventory_transactions (
            inventory_id,
            ticket_id,
            technician_id,
            quantity_used,
            submission_id,
            created_at
        ) VALUES (
            v_item.part_id,
            p_ticket_id,
            p_technician_id,
            v_item.qty,
            p_submission_id,
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. تصحيح عداد الإنجاز (KPI Accuracy Fix)
-- منع تضخم الأرقام عند استخدام قطع غيار متعددة
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(DISTINCT t.id) as tickets_solved, -- [FIXED] DISTINCT لمنع التكرار
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.started_at))/3600)::numeric(10,2) as avg_repair_hours,
    AVG(t.rating_score)::numeric(10,1) as avg_rating,
    COALESCE(SUM(it.quantity_used * i.unit_cost), 0)::numeric(10,2) as total_parts_cost
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.status IN ('resolved', 'closed') AND t.started_at IS NOT NULL AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;

-- 5. تحديث دالة حساب المسافات لتعمل بالأسماء الموحدة
-- [CRITICAL FIX] حذف النسخ القديمة لتجنب تضارب الأسماء
DROP FUNCTION IF EXISTS public.log_technician_mission(UUID, UUID);
DROP FUNCTION IF EXISTS public.log_technician_mission(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.log_technician_mission(
    p_ticket_id UUID,
    p_to_branch_id UUID,
    p_submission_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
    v_attendance_id UUID;
    v_last_branch_id UUID;
    v_lat1 DOUBLE PRECISION;
    v_lng1 DOUBLE PRECISION;
    v_lat2 DOUBLE PRECISION;
    v_lng2 DOUBLE PRECISION;
    v_dist DOUBLE PRECISION := 0;
    v_allowance_rate DECIMAL;
    v_earned DECIMAL;
    v_mission_id UUID;
BEGIN
    -- [QUANTUM SECURITY] منع التكرار
    IF p_submission_id IS NOT NULL THEN
        SELECT id INTO v_mission_id FROM public.technician_missions WHERE submission_id = p_submission_id;
        IF FOUND THEN RETURN v_mission_id; END IF;
    END IF;

    -- التقاط بيانات الحضور
    SELECT id, profile_id INTO v_attendance_id, v_profile_id
    FROM public.technician_attendance
    WHERE profile_id = auth.uid() AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;
    
    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION 'المناوبة غير نشطة. يرجى تسجيل الحضور أولاً.';
    END IF;

    SELECT per_km_allowance INTO v_allowance_rate FROM public.profiles WHERE id = v_profile_id;

    -- الفروع السابقة
    SELECT to_branch_id INTO v_last_branch_id
    FROM public.technician_missions
    WHERE attendance_id = v_attendance_id
    ORDER BY created_at DESC LIMIT 1;

    -- التنسيق الموحد: latitude/longitude
    IF v_last_branch_id IS NOT NULL THEN
        SELECT latitude, longitude INTO v_lat1, v_lng1 FROM public.branches WHERE id = v_last_branch_id;
        SELECT latitude, longitude INTO v_lat2, v_lng2 FROM public.branches WHERE id = p_to_branch_id;
        
        IF v_lat1 IS NOT NULL AND v_lat2 IS NOT NULL THEN
            v_dist := calculate_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        END IF;
    END IF;

    v_earned := v_dist * COALESCE(v_allowance_rate, 0);

    INSERT INTO public.technician_missions (
        attendance_id, profile_id, ticket_id, from_branch_id, to_branch_id, 
        distance_km, allowance_earned, submission_id
    ) VALUES (
        v_attendance_id, v_profile_id, p_ticket_id, v_last_branch_id, p_to_branch_id, 
        v_dist, v_earned, p_submission_id
    ) RETURNING id INTO v_mission_id;

    -- [TEMPORAL HARDENING] استخدام التوقيت المحلي للقاهرة لمنع تداخل التواريخ عند منتصف الليل
    -- (NOW() AT TIME ZONE 'Africa/Cairo')::DATE يضمن أن الرواتب تسجل في اليوم الصحيح محلياً
    INSERT INTO public.payroll_logs (profile_id, date, total_allowance, net_earning)
    VALUES (v_profile_id, (NOW() AT TIME ZONE 'Africa/Cairo')::DATE, v_earned, v_earned)
    ON CONFLICT (profile_id, date) DO UPDATE SET
        total_allowance = public.payroll_logs.total_allowance + EXCLUDED.total_allowance,
        net_earning = public.payroll_logs.net_earning + EXCLUDED.total_allowance;

    RETURN v_mission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- [PERFORMANCE] Bundled RPC for Dashboard Stats to prevent N+1 request storm
-- Updated with full Hierarchical RBAC support
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_role TEXT;
    v_branch_id UUID;
    v_area_id UUID;
    v_sector_id UUID;
    v_brand_id UUID;
    v_result JSONB;
BEGIN
    SELECT role, branch_id, area_id, sector_id, brand_id 
    INTO v_role, v_branch_id, v_area_id, v_sector_id, v_brand_id
    FROM public.profiles WHERE id = p_profile_id;

    v_result = jsonb_build_object(
        'open', (SELECT count(*) FROM public.tickets t 
                 JOIN public.branches b ON t.branch_id = b.id
                 JOIN public.areas a ON b.area_id = a.id
                 JOIN public.sectors s ON a.sector_id = s.id
                 WHERE t.status = 'open' 
                 AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                      OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                      OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                      OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                      OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),
        
        'assigned', (SELECT count(*) FROM public.tickets t 
                     JOIN public.branches b ON t.branch_id = b.id
                     JOIN public.areas a ON b.area_id = a.id
                     JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'assigned' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'in_progress', (SELECT count(*) FROM public.tickets t 
                        JOIN public.branches b ON t.branch_id = b.id
                        JOIN public.areas a ON b.area_id = a.id
                        JOIN public.sectors s ON a.sector_id = s.id
                        WHERE t.status = 'in_progress' 
                        AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                             OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                             OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                             OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                             OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'resolved', (SELECT count(*) FROM public.tickets t 
                     JOIN public.branches b ON t.branch_id = b.id
                     JOIN public.areas a ON b.area_id = a.id
                     JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'resolved' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'available_techs', (SELECT count(*) FROM public.technician_attendance att
                            JOIN public.profiles p ON att.profile_id = p.id
                            WHERE att.clock_out IS NULL
                            AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                                 OR (v_role = 'manager' AND p.branch_id = v_branch_id)
                                 OR (v_role = 'area_manager' AND p.area_id = v_area_id)
                                 OR (v_role = 'sector_manager' AND p.sector_id = v_sector_id)
                                 OR (v_role = 'brand_ops_manager' AND p.brand_id = v_brand_id))),

        'faulty_assets', (SELECT count(*) FROM public.maintenance_assets ma
                          JOIN public.branches b ON ma.branch_id = b.id
                          JOIN public.areas a ON b.area_id = a.id
                          JOIN public.sectors s ON a.sector_id = s.id
                          WHERE ma.status = 'faulty' 
                          AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                               OR (v_role = 'manager' AND ma.branch_id = v_branch_id)
                               OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                               OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                               OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'low_stock', (SELECT count(*) FROM public.inventory WHERE quantity < 5)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID) TO authenticated;
COMMENT ON FUNCTION deduct_inventory_atomic IS 'Atomic, Deadlock-protected inventory deduction with idempotency';
