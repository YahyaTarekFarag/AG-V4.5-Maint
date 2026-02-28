-- V20__export_rpc.sql
-- إنشاء دالة لتصدير بيانات Sovereign بشكل مجمع من السيرفر مباشرة لتفادي مشاكل الذاكرة في المتصفح
-- تقبل اسم الجدول وترجع البيانات في صيغة JSON ليتم تحويلها لـ Excel في الواجهة بسهولة

CREATE OR REPLACE FUNCTION public.export_sovereign_data(
    p_table_name text,
    p_profile_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role text;
    v_branch_id uuid;
    v_is_global boolean := true;
    v_query text;
    v_result json;
BEGIN
    -- 1. جلب بيانات المستخدم لتطبيق RBAC إذا تم التمرير (لجداول محددة)
    IF p_profile_id IS NOT NULL THEN
        SELECT role, branch_id INTO v_role, v_branch_id
        FROM public.profiles
        WHERE id = p_profile_id;
        
        v_is_global := v_role IN ('admin', 'maint_manager', 'maint_supervisor', 'general_manager', 'regional_manager');
    END IF;

    -- 2. بناء استعلام التصدير
    -- نجلب كل الأعمدة المتاحة. في حالة كان الجدول يحتوي على is_deleted نفلتتر عبره
    v_query := format('SELECT * FROM %I', p_table_name);
    
    -- إضافة فلاتر مبدئية إذا كانت مدعومة
    IF p_table_name IN ('tickets', 'inventory', 'maintenance_assets', 'users', 'profiles', 'technician_attendance') THEN
        v_query := v_query || ' WHERE is_deleted = false';
    ELSE
        -- Default WHERE for safety based on table analysis
        v_query := v_query || ' WHERE 1=1';
    END IF;

    -- إضافة فلتر الفرع إذا لم يكن المستخدم Global والجدول يدعم الفرع (كمثال tickets)
    -- ملاحظة: هذا تطبيق بسيط جداً. التطبيق المعقد للـ RBAC مفضل أن يكون عبر الـ Middle-tier ولكن سنضيف الحماية الأساسية للتذاكر
    IF NOT v_is_global AND p_table_name = 'tickets' AND v_branch_id IS NOT NULL THEN
        v_query := v_query || format(' AND branch_id = %L', v_branch_id);
    END IF;

    -- 3. تنفيذ الاستعلام وإرجاع JSON
    EXECUTE format('SELECT json_agg(t) FROM (%s) t', v_query) INTO v_result;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$;
