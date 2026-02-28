-- V12__schema_contract_fixes.sql
-- ==========================================
-- المرحلة السابعة: إصلاحات تعارض العقد (Schema Contract Fixes)
-- ==========================================

-- 1. إصلاح خرائط الأصول (Geofencing) في جدول الفروع
-- الكود الأمامي (React) يتوقع أعمدة بأسم 'latitude' و 'longitude'
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='branch_lat') THEN
        ALTER TABLE public.branches RENAME COLUMN branch_lat TO latitude;
    END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='branch_lng') THEN
        ALTER TABLE public.branches RENAME COLUMN branch_lng TO longitude;
    END IF;
END $$;

-- 2. توفير خصائص التصميم (UI Configs) في جدول ui_schemas
-- الكود الأمامي يعتمد عليها لرسم الشريط الجانبي (Sidebar) وصفحة رئيسية (Dashboard)
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='ui_schemas' AND column_name='page_config') THEN
        ALTER TABLE public.ui_schemas ADD COLUMN page_config jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='ui_schemas' AND column_name='nav_config') THEN
        ALTER TABLE public.ui_schemas ADD COLUMN nav_config jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. استكمال السجل الزمني لبلاغات الصيانة (Tickets Timeline Ledger)
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='assigned_at') THEN
        ALTER TABLE public.tickets ADD COLUMN assigned_at timestamptz;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='closed_at') THEN
        ALTER TABLE public.tickets ADD COLUMN closed_at timestamptz;
    END IF;
END $$;

-- 4. إحياء وظيفة المباشرة الحركية لحساب الرواتب والمسافات (log_technician_mission)
-- الدالة اختفت في تحديثات قاعدة البيانات مما تسبب بتطاير تسجيل تحركات المهندسين
DROP FUNCTION IF EXISTS public.log_technician_mission(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.log_technician_mission(
    p_ticket_id UUID,
    p_to_branch_id UUID,
    p_submission_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_profile_id UUID;
    v_active_attendance_id UUID;
    v_from_branch_id UUID;
    v_distance_km DOUBLE PRECISION := 0;
    v_allowance_rate DECIMAL := 0;
    v_earned_allowance DECIMAL := 0;
    v_from_lat DOUBLE PRECISION;
    v_from_lng DOUBLE PRECISION;
    v_to_lat DOUBLE PRECISION;
    v_to_lng DOUBLE PRECISION;
BEGIN
    -- المتغير الأساسي
    v_profile_id := auth.uid();

    -- البحث عن أول مناوبة عمل مفتوحة
    SELECT id INTO v_active_attendance_id
    FROM public.technician_attendance
    WHERE profile_id = v_profile_id AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;

    IF v_active_attendance_id IS NULL THEN
        RAISE EXCEPTION 'لا توجد مناوبة عمل نشطة للفني الحالي لتوثيق التحرك الجغرافي.';
    END IF;

    -- معرفة النقطة الحالية للمهندس قبل الانطلاق (عبر آخر مهمه أو عبر الفرع الأساسي)
    SELECT to_branch_id INTO v_from_branch_id
    FROM public.technician_missions
    WHERE profile_id = v_profile_id AND attendance_id = v_active_attendance_id
    ORDER BY created_at DESC LIMIT 1;

    IF v_from_branch_id IS NULL THEN
        -- نقطة الانطلاق الأولى غالباً هي فرعه المسجل بملفه التعريفي
        SELECT branch_id INTO v_from_branch_id 
        FROM public.profiles 
        WHERE id = v_profile_id;
    END IF;

    -- إذا كانت نقطة البداية والنهاية معروفة ومختلفة، نحسب المسافة
    IF v_from_branch_id IS NOT NULL AND v_from_branch_id != p_to_branch_id THEN
        -- جلب الإحداثيات للفروع
        SELECT latitude, longitude INTO v_from_lat, v_from_lng FROM public.branches WHERE id = v_from_branch_id;
        SELECT latitude, longitude INTO v_to_lat, v_to_lng FROM public.branches WHERE id = p_to_branch_id;
        
        -- التحقق من الدالة الجغرافية وحسابالمسافة
        IF v_from_lat IS NOT NULL AND v_to_lat IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_distance') THEN
                v_distance_km := public.calculate_distance(v_from_lat, v_from_lng, v_to_lat, v_to_lng);
            END IF;
        END IF;
    END IF;

    -- احتساب بدل الانتقالات (Allowance)
    SELECT COALESCE(per_km_allowance, 0) INTO v_allowance_rate
    FROM public.profiles
    WHERE id = v_profile_id;
    
    v_earned_allowance := v_distance_km * v_allowance_rate;

    -- توثيق التحرك في قاعدة البيانات
    INSERT INTO public.technician_missions (
        attendance_id,
        profile_id,
        ticket_id,
        from_branch_id,
        to_branch_id,
        distance_km,
        allowance_earned,
        created_at
    ) VALUES (
        v_active_attendance_id,
        v_profile_id,
        p_ticket_id,
        v_from_branch_id,
        p_to_branch_id,
        v_distance_km,
        v_earned_allowance,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
