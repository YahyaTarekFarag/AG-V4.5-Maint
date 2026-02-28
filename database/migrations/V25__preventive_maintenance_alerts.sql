-- V25__preventive_maintenance_alerts.sql
-- ==========================================
-- المرحلة الثالثة: الصيانة الوقائية والتنبيهات الذكية
-- ==========================================

-- 1. تحديث تاريخ آخر صيانة للأصل تلقائياً عند إغلاق البلاغ
CREATE OR REPLACE FUNCTION public.handle_asset_maintenance_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'resolved' OR NEW.status = 'closed') AND NEW.asset_id IS NOT NULL THEN
        UPDATE public.maintenance_assets
        SET last_maintenance_at = NEW.resolved_at,
            updated_at = NOW()
        WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_resolved_update_asset ON public.tickets;
CREATE TRIGGER on_ticket_resolved_update_asset
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_asset_maintenance_update();

-- 2. تحديث لوحة التحكم لتشمل عدد تنبيهات الصيانة الوقائية
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
  v_preventive_due INT;
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

  -- المخزون المنخفض
  SELECT count(*) INTO v_low_stock FROM public.inventory
  WHERE quantity < 5 AND is_deleted = false;

  -- حساب الأصول التي استحقت الصيانة الوقائية (جديد)
  -- المعادلة: الوقت الحالي تجاوز (تاريخ آخر صيانة + الفاصل الزمني المسموح)
  SELECT count(*) INTO v_preventive_due 
  FROM public.maintenance_assets
  WHERE is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id)
  AND (
      (last_maintenance_at IS NULL AND created_at < NOW() - (service_interval_days * interval '1 day'))
      OR 
      (last_maintenance_at IS NOT NULL AND last_maintenance_at < NOW() - (service_interval_days * interval '1 day'))
  );

  -- بناء JSON النهائي
  v_result := json_build_object(
    'open', v_open,
    'assigned', v_assigned,
    'in_progress', v_in_progress,
    'resolved', v_resolved,
    'available_techs', v_available_techs,
    'faulty_assets', v_faulty_assets,
    'low_stock', v_low_stock,
    'preventive_due', v_preventive_due
  );

  RETURN v_result;
END;
$$;
