-- V09__missing_rpcs_and_fixes.sql
-- ==========================================
-- المرحلة الخامسة: إصلاح الإجراءات المفقودة والمقاييس الصفرية
-- ==========================================

-- 1. إضافة دالة عرض استعلامات المديولات المفقودة (get_table_metrics)
-- والتي كانت تسبب ظهور أصفار في بطاقات (KPI Cards) في صفحات إدارة المخزون وباقي الشاشات
CREATE OR REPLACE FUNCTION public.get_table_metrics(p_table_name TEXT, p_metrics JSONB)
RETURNS JSONB AS $$
DECLARE
    v_metric RECORD;
    v_result JSONB := '{}'::JSONB;
    v_query TEXT;
    v_val NUMERIC;
    v_filter_key TEXT;
    v_filter_val TEXT;
BEGIN
    FOR v_metric IN SELECT * FROM jsonb_array_elements(p_metrics) LOOP
        -- تجهيز الاستعلام الرئيسي للحساب (العدد أو المجموع أو المتوسط)
        v_query := 'SELECT ' || 
                   CASE 
                       WHEN v_metric.value->>'type' = 'sum' THEN 'COALESCE(SUM(' || quote_ident(v_metric.value->>'key') || '), 0)'
                       WHEN v_metric.value->>'type' = 'avg' THEN 'COALESCE(AVG(' || quote_ident(v_metric.value->>'key') || '), 0)'
                       ELSE 'COUNT(*)'
                   END || 
                   ' FROM public.' || quote_ident(p_table_name) || ' WHERE 1=1';
        
        -- تطبيق فلتر الحذف الوهمي إذا كان الحقل مدعوماً في الجدول
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = p_table_name 
            AND column_name = 'is_deleted'
        ) THEN
            v_query := v_query || ' AND is_deleted = false';
        END IF;

        -- التقاط فلتر مخصص قادم من الواجهة ودمجه
        IF v_metric.value ? 'filter' THEN
            FOR v_filter_key, v_filter_val IN SELECT * FROM jsonb_each_text(v_metric.value->'filter') LOOP
                IF v_filter_key = 'quantity' THEN
                    v_query := v_query || ' AND ' || quote_ident(v_filter_key) || ' < ' || v_filter_val::numeric;
                ELSE
                    v_query := v_query || ' AND ' || quote_ident(v_filter_key) || ' = ' || quote_literal(v_filter_val);
                END IF;
            END LOOP;
        END IF;

        -- تنفيذ الاستعلام وتخزينه في المصفوفة
        EXECUTE v_query INTO v_val;
        v_result := jsonb_set(v_result, ARRAY[v_metric.value->>'label'], to_jsonb(v_val));
    END LOOP;
    
    RETURN v_result;
EXCEPTION
    WHEN others THEN
        RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_table_metrics(TEXT, JSONB) TO authenticated;

-- 2. ترقية دالة (get_dashboard_stats) لتستخدم LEFT JOIN لمنع إخفاء البيانات غير المرتبطة بالكامل
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_profile_id UUID)
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
                 LEFT JOIN public.branches b ON t.branch_id = b.id
                 LEFT JOIN public.areas a ON b.area_id = a.id
                 LEFT JOIN public.sectors s ON a.sector_id = s.id
                 WHERE t.status = 'open' 
                 AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                      OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                      OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                      OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                      OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),
        
        'assigned', (SELECT count(*) FROM public.tickets t 
                     LEFT JOIN public.branches b ON t.branch_id = b.id
                     LEFT JOIN public.areas a ON b.area_id = a.id
                     LEFT JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'assigned' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'in_progress', (SELECT count(*) FROM public.tickets t 
                        LEFT JOIN public.branches b ON t.branch_id = b.id
                        LEFT JOIN public.areas a ON b.area_id = a.id
                        LEFT JOIN public.sectors s ON a.sector_id = s.id
                        WHERE t.status = 'in_progress' 
                        AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                             OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                             OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                             OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                             OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'resolved', (SELECT count(*) FROM public.tickets t 
                     LEFT JOIN public.branches b ON t.branch_id = b.id
                     LEFT JOIN public.areas a ON b.area_id = a.id
                     LEFT JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'resolved' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'available_techs', (SELECT count(*) FROM public.technician_attendance att
                            LEFT JOIN public.profiles p ON att.profile_id = p.id
                            WHERE att.clock_out IS NULL
                            AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                                 OR (v_role = 'manager' AND p.branch_id = v_branch_id)
                                 OR (v_role = 'area_manager' AND p.area_id = v_area_id)
                                 OR (v_role = 'sector_manager' AND p.sector_id = v_sector_id)
                                 OR (v_role = 'brand_ops_manager' AND p.brand_id = v_brand_id))),

        'faulty_assets', (SELECT count(*) FROM public.maintenance_assets ma
                          LEFT JOIN public.branches b ON ma.branch_id = b.id
                          LEFT JOIN public.areas a ON b.area_id = a.id
                          LEFT JOIN public.sectors s ON a.sector_id = s.id
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
