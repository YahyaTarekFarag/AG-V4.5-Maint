-- V17__db_contract_hotfix.sql
-- ==============================================================================
-- إصلاح الحد الأدنى لعقد قاعدة البيانات
-- يحل فقط: get_dashboard_stats (is_deleted + فلتر اليوم)
-- باقي الإصلاحات تمت من جهة الكود البرمجي
-- ==============================================================================

-- إعادة تعريف get_dashboard_stats مع:
-- 1. فلتر is_deleted = false في كل استعلام
-- 2. فلتر clock_in::date = CURRENT_DATE لـ available_techs
-- 3. فلتر is_deleted = false للمخزون

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_role TEXT;
    v_branch_id UUID;
    v_area_id UUID;
    v_sector_id UUID;
    v_brand_id UUID;
    v_result JSONB;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT role, branch_id, area_id, sector_id, brand_id
    INTO v_role, v_branch_id, v_area_id, v_sector_id, v_brand_id
    FROM public.profiles WHERE id = p_profile_id;

    v_result = jsonb_build_object(
        'open', (SELECT count(*) FROM public.tickets t
                 LEFT JOIN public.branches b ON t.branch_id = b.id
                 LEFT JOIN public.areas a ON b.area_id = a.id
                 LEFT JOIN public.sectors s ON a.sector_id = s.id
                 WHERE t.status = 'open' AND t.is_deleted = false
                 AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                      OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                      OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                      OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                      OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'assigned', (SELECT count(*) FROM public.tickets t
                     LEFT JOIN public.branches b ON t.branch_id = b.id
                     LEFT JOIN public.areas a ON b.area_id = a.id
                     LEFT JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'assigned' AND t.is_deleted = false
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'in_progress', (SELECT count(*) FROM public.tickets t
                        LEFT JOIN public.branches b ON t.branch_id = b.id
                        LEFT JOIN public.areas a ON b.area_id = a.id
                        LEFT JOIN public.sectors s ON a.sector_id = s.id
                        WHERE t.status = 'in_progress' AND t.is_deleted = false
                        AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                             OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                             OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                             OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                             OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'resolved', (SELECT count(*) FROM public.tickets t
                     LEFT JOIN public.branches b ON t.branch_id = b.id
                     LEFT JOIN public.areas a ON b.area_id = a.id
                     LEFT JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'resolved' AND t.is_deleted = false
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'available_techs', (SELECT count(*) FROM public.technician_attendance att
                            LEFT JOIN public.profiles p ON att.profile_id = p.id
                            WHERE att.clock_out IS NULL
                            AND att.clock_in::date = v_today
                            AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                                 OR (v_role = 'manager' AND p.branch_id = v_branch_id)
                                 OR (v_role = 'area_manager' AND p.area_id = v_area_id)
                                 OR (v_role = 'sector_manager' AND p.sector_id = v_sector_id)
                                 OR (v_role = 'brand_ops_manager' AND p.brand_id = v_brand_id))),

        'faulty_assets', (SELECT count(*) FROM public.maintenance_assets ma
                          LEFT JOIN public.branches b ON ma.branch_id = b.id
                          LEFT JOIN public.areas a ON b.area_id = a.id
                          LEFT JOIN public.sectors s ON a.sector_id = s.id
                          WHERE ma.status = 'faulty' AND ma.is_deleted = false
                          AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor')
                               OR (v_role = 'manager' AND ma.branch_id = v_branch_id)
                               OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                               OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                               OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'low_stock', (SELECT count(*) FROM public.inventory WHERE quantity < 5 AND is_deleted = false)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
