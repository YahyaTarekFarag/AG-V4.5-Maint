-- V19__dashboard_stats_v2.sql
-- تجميع إحصائيات لوحة التحكم في طلب واحد لتقليل الضغط على قاعدة البيانات

CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(p_profile_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_branch_id UUID;
  v_result JSON;
  v_open INT;
  v_assigned INT;
  v_in_progress INT;
  v_resolved INT;
  v_available_techs INT;
  v_faulty_assets INT;
  v_low_stock INT;
  v_is_global BOOLEAN;
BEGIN
  -- جلب بيانات المستخدم
  SELECT role, branch_id INTO v_role, v_branch_id
  FROM public.profiles
  WHERE id = p_profile_id;

  v_is_global := v_role IN ('admin', 'maint_manager', 'maint_supervisor');

  -- حساب التذاكر المفتوحة
  SELECT count(*) INTO v_open FROM public.tickets
  WHERE status = 'open' AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id);

  -- حساب التذاكر المسندة
  SELECT count(*) INTO v_assigned FROM public.tickets
  WHERE status = 'assigned' AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id);

  -- حساب التذاكر قيد التنفيذ
  SELECT count(*) INTO v_in_progress FROM public.tickets
  WHERE status = 'in_progress' AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id);

  -- حساب التذاكر المكتملة المقيمة
  SELECT count(*) INTO v_resolved FROM public.tickets
  WHERE status = 'resolved' AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id);

  -- حساب الفنيين المتاحين اليوم
  SELECT count(DISTINCT ta.profile_id) INTO v_available_techs
  FROM public.technician_attendance ta
  JOIN public.profiles p ON ta.profile_id = p.id
  WHERE ta.clock_out IS NULL
  AND ta.clock_in >= date_trunc('day', now())
  AND (v_is_global OR p.branch_id = v_branch_id);

  -- حساب الأصول المعطلة
  SELECT count(*) INTO v_faulty_assets FROM public.maintenance_assets
  WHERE status = 'faulty' AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id);

  -- المخزون المنخفض (دائماً شامل لكل الفروع أو يمكن ربطه بفرع المستودع)
  -- حالياً: حسب المنطق السابق المخزون لم يكن مفلتراً بفرع للمستخدمين العاديين، سنبقيه كما كان (lt 5)
  SELECT count(*) INTO v_low_stock FROM public.inventory
  WHERE quantity < 5 AND is_deleted = false;

  -- بناء JSON النهائي
  v_result := json_build_object(
    'open', v_open,
    'assigned', v_assigned,
    'in_progress', v_in_progress,
    'resolved', v_resolved,
    'available_techs', v_available_techs,
    'faulty_assets', v_faulty_assets,
    'low_stock', v_low_stock
  );

  RETURN v_result;
END;
$$;
