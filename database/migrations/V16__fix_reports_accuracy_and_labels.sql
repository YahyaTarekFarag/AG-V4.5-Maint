-- V16__fix_reports_accuracy_and_labels.sql
-- ==========================================
-- المرحلة العشرون: تدقيق وإصلاح دقة التقارير وتحسين مسميات الحالات
-- ==========================================

-- 1. تحديث دالة (get_dashboard_stats) لتكون أكثر دقة واحترافية
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
    -- جلب معلومات المستخدم
    SELECT role, branch_id, area_id, sector_id, brand_id 
    INTO v_role, v_branch_id, v_area_id, v_sector_id, v_brand_id
    FROM public.profiles WHERE id = p_profile_id;

    v_result = jsonb_build_object(
        -- البلاغات الجديدة (تجاهل المحذوف)
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
        
        -- البلاغات المسندة
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

        -- البلاغات قيد الإصلاح
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

        -- البلاغات التي تم إصلاحها (بانتظار الاعتماد)
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

        -- الفنيين المتاحين (اليوم فقط الذين لم ينصرفوا)
        'available_techs', (SELECT count(*) FROM public.technician_attendance att
                            LEFT JOIN public.profiles p ON att.profile_id = p.id
                            WHERE att.clock_out IS NULL 
                            AND att.clock_in::date = v_today
                            AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                                 OR (v_role = 'manager' AND p.branch_id = v_branch_id)
                                 OR (v_role = 'area_manager' AND p.area_id = v_area_id)
                                 OR (v_role = 'sector_manager' AND p.sector_id = v_sector_id)
                                 OR (v_role = 'brand_ops_manager' AND p.brand_id = v_brand_id))),

        -- الأصول المتعطلة
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

        -- نواقص المخزون (أقل من 5 كميات)
        'low_stock', (SELECT count(*) FROM public.inventory WHERE quantity < 5 AND is_deleted = false)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ترقية دالة (get_table_metrics) لتكون واعية بالصلاحيات الهيكلية (Hierarchy-Aware)
CREATE OR REPLACE FUNCTION public.get_table_metrics(p_table_name TEXT, p_metrics JSONB, p_profile_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_metric RECORD;
    v_result JSONB := '{}'::JSONB;
    v_query TEXT;
    v_val NUMERIC;
    v_filter_key TEXT;
    v_filter_val TEXT;
    v_role TEXT;
    v_branch_id UUID;
    v_area_id UUID;
    v_sector_id UUID;
    v_brand_id UUID;
    v_auth_filter TEXT := '';
BEGIN
    -- جلب معلومات الصلاحيات إذا تم توفير المعرف
    IF p_profile_id IS NOT NULL THEN
        SELECT role, branch_id, area_id, sector_id, brand_id 
        INTO v_role, v_branch_id, v_area_id, v_sector_id, v_brand_id
        FROM public.profiles WHERE id = p_profile_id;
        
        -- تجهيز فلتر الصلاحيات بناءً على نوع الجدول والجدول الهدف
        IF p_table_name = 'tickets' OR p_table_name = 'maintenance_assets' OR p_table_name = 'profiles' THEN
            -- هذه الجداول تحتوي على أعمدة مباشرة أو مرتبطة بالفروع
            IF v_role NOT IN ('admin', 'maint_manager', 'maint_supervisor') THEN
                IF v_role = 'manager' THEN
                    v_auth_filter := ' AND branch_id = ' || quote_literal(v_branch_id);
                ELSIF v_role = 'area_manager' THEN
                    v_auth_filter := ' AND branch_id IN (SELECT id FROM public.branches WHERE area_id = ' || quote_literal(v_area_id) || ')';
                ELSIF v_role = 'sector_manager' THEN
                    v_auth_filter := ' AND branch_id IN (SELECT b.id FROM public.branches b JOIN public.areas a ON b.area_id = a.id WHERE a.sector_id = ' || quote_literal(v_sector_id) || ')';
                ELSIF v_role = 'brand_ops_manager' THEN
                    v_auth_filter := ' AND branch_id IN (SELECT b.id FROM public.branches b JOIN public.areas a ON b.area_id = a.id JOIN public.sectors s ON a.sector_id = s.id WHERE s.brand_id = ' || quote_literal(v_brand_id) || ')';
                END IF;
            END IF;
        END IF;
    END IF;

    FOR v_metric IN SELECT * FROM jsonb_array_elements(p_metrics) LOOP
        -- تجهيز الاستعلام الرئيسي
        v_query := 'SELECT ' || 
                   CASE 
                       WHEN v_metric.value->>'type' = 'sum' THEN 'COALESCE(SUM(' || quote_ident(v_metric.value->>'key') || '), 0)'
                       WHEN v_metric.value->>'type' = 'avg' THEN 'COALESCE(AVG(' || quote_ident(v_metric.value->>'key') || '), 0)'
                       ELSE 'COUNT(*)'
                   END || 
                   ' FROM public.' || quote_ident(p_table_name) || ' WHERE 1=1';
        
        -- تطبيق فلتر الحذف الوهمي
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'is_deleted'
        ) THEN
            v_query := v_query || ' AND is_deleted = false';
        END IF;

        -- دمج فلتر الصلاحيات
        v_query := v_query || v_auth_filter;

        -- دمج الفلاتر المخصصة
        IF v_metric.value ? 'filter' THEN
            FOR v_filter_key, v_filter_val IN SELECT * FROM jsonb_each_text(v_metric.value->'filter') LOOP
                IF v_filter_key = 'quantity' THEN
                    -- دعم المقارنة بدلاً من المطابقة للمخزون
                    v_query := v_query || ' AND ' || quote_ident(v_filter_key) || ' < ' || v_filter_val::numeric;
                ELSE
                    v_query := v_query || ' AND ' || quote_ident(v_filter_key) || ' = ' || quote_literal(v_filter_val);
                END IF;
            END LOOP;
        END IF;

        -- تنفيذ الاستعلام
        EXECUTE v_query INTO v_val;
        v_result := jsonb_set(v_result, ARRAY[v_metric.value->>'label'], to_jsonb(v_val));
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
