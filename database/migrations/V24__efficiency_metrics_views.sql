-- V24__efficiency_metrics_views.sql
-- ==========================================
-- المرحلة الثانية عشر: مقاييس الكفاءة والذكاء التشغيلي
-- ==========================================

-- 1. تحديث جدول الأصول لدعم الصيانة الوقائية
ALTER TABLE public.maintenance_assets 
ADD COLUMN IF NOT EXISTS service_interval_days integer DEFAULT 90;

-- 2. مشهد مادي لحساب MTTR (متوسط وقت الإصلاح) لكل فني
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_technician_efficiency AS
SELECT 
    assigned_to as profile_id,
    COUNT(*) as total_resolved,
    COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - COALESCE(started_at, created_at)))/3600), 0)::numeric(10,2) as mttr_hours
FROM public.tickets
WHERE status IN ('resolved', 'closed') AND assigned_to IS NOT NULL AND is_deleted = false
GROUP BY assigned_to;

-- 3. مشهد مادي لحساب MTBF (متوسط الوقت بين الأعطال) للأصول
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_asset_reliability AS
WITH ticket_steps AS (
    SELECT 
        asset_id,
        created_at as fail_date,
        LAG(resolved_at) OVER (PARTITION BY asset_id ORDER BY created_at) as prev_resolve_date
    FROM public.tickets
    WHERE asset_id IS NOT NULL AND is_deleted = false
)
SELECT 
    asset_id,
    COUNT(*) as failure_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (fail_date - prev_resolve_date))/3600), 0)::numeric(10,2) as mtbf_hours,
    CASE 
        WHEN COALESCE(AVG(EXTRACT(EPOCH FROM (fail_date - prev_resolve_date))/3600), 0) < 168 THEN 'critical' -- عطل أسبوعي
        WHEN COALESCE(AVG(EXTRACT(EPOCH FROM (fail_date - prev_resolve_date))/3600), 0) < 720 THEN 'warning'  -- عطل شهري
        ELSE 'stable'
    END as reliability_status
FROM ticket_steps
WHERE prev_resolve_date IS NOT NULL
GROUP BY asset_id;

-- 4. وظيفة لتحديث المشاهد المادية (Refresh Efficiency Data)
CREATE OR REPLACE FUNCTION public.refresh_efficiency_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_technician_efficiency;
    REFRESH MATERIALIZED VIEW public.mv_asset_reliability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. تحديث دالة التقارير لتشمل متوسطات الكفاءة العامة
-- سيتم استدعاؤها في ReportsPage للاستفادة من البيانات الجديدة
CREATE OR REPLACE FUNCTION public.get_efficiency_overview()
RETURNS JSONB AS $$
DECLARE
    v_global_mttr NUMERIC;
    v_top_failing_assets JSONB;
BEGIN
    SELECT COALESCE(AVG(mttr_hours), 0)::numeric(10,2) INTO v_global_mttr FROM public.mv_technician_efficiency;
    
    SELECT COALESCE(
        (SELECT jsonb_agg(item)
        FROM (
            SELECT jsonb_build_object(
                'asset_name', ma.name,
                'failure_count', ar.failure_count,
                'mtbf_hours', ar.mtbf_hours,
                'status', ar.reliability_status
            ) as item
            FROM public.mv_asset_reliability ar
            JOIN public.maintenance_assets ma ON ar.asset_id = ma.id
            ORDER BY ar.failure_count DESC
            LIMIT 5
        ) sub), '[]'::jsonb
    ) INTO v_top_failing_assets;

    RETURN jsonb_build_object(
        'global_mttr', v_global_mttr,
        'top_failing_assets', COALESCE(v_top_failing_assets, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_efficiency_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_efficiency_metrics() TO authenticated;
