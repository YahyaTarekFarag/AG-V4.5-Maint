-- V08__reports_rpc_optimization.sql
-- ==========================================
-- المرحلة الثامنة: تحسين أداء صفحة التقارير بالكامل عبر RPC
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_reports_dashboard_data(
    p_start_date DATE,
    p_end_date DATE,
    p_brand_id UUID DEFAULT NULL,
    p_sector_id UUID DEFAULT NULL,
    p_area_id UUID DEFAULT NULL,
    p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_tickets INT;
    v_resolved_tickets INT;
    v_avg_mttr NUMERIC;
    v_total_cost NUMERIC;
    v_daily_trends JSONB;
    v_category_dist JSONB;
    v_branch_perf JSONB;
    v_raw_tickets JSONB;
BEGIN
    -- Temporary table to hold filtered tickets
    CREATE TEMP TABLE tmp_filtered_tickets ON COMMIT DROP AS
    SELECT t.*, b.name as branch_name, b.area_id, a.sector_id, s.brand_id, c.name as category_name
    FROM public.tickets t
    JOIN public.branches b ON t.branch_id = b.id
    LEFT JOIN public.areas a ON b.area_id = a.id
    LEFT JOIN public.sectors s ON a.sector_id = s.id
    LEFT JOIN public.maintenance_categories c ON t.category_id = c.id
    WHERE t.created_at >= p_start_date::timestamp
      AND t.created_at <= (p_end_date + integer '1')::timestamp
      AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
      AND (p_area_id IS NULL OR a.id = p_area_id)
      AND (p_sector_id IS NULL OR s.id = p_sector_id)
      AND (p_brand_id IS NULL OR s.brand_id = p_brand_id);

    -- KPIs
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('closed', 'resolved')),
        COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - COALESCE(started_at, created_at)))/3600), 0)::numeric(10,2)
    INTO v_total_tickets, v_resolved_tickets, v_avg_mttr
    FROM tmp_filtered_tickets;

    SELECT COALESCE(SUM(parts_cost), 0) + COALESCE(SUM(downtime_loss), 0)
    INTO v_total_cost
    FROM (
        SELECT t.id,
               COALESCE(EXTRACT(EPOCH FROM (t.resolved_at - t.downtime_start))/3600 * 500, 0) as downtime_loss,
               (SELECT COALESCE(SUM(it.quantity_used * i.unit_cost), 0)
                FROM public.inventory_transactions it
                JOIN public.inventory i ON it.inventory_id = i.id
                WHERE it.ticket_id = t.id) as parts_cost
        FROM tmp_filtered_tickets t
    ) costs;

    -- Daily Trends
    SELECT jsonb_agg(jsonb_build_object(
        'date', TO_CHAR(d, 'MM/DD'),
        'count', COALESCE(dt.total, 0),
        'resolved', COALESCE(dt.resolved, 0)
    )) INTO v_daily_trends
    FROM generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval) d
    LEFT JOIN (
        SELECT DATE(created_at) as dt, 
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status IN ('closed', 'resolved')) as resolved
        FROM tmp_filtered_tickets
        GROUP BY DATE(created_at)
    ) dt ON DATE(d) = dt.dt;

    -- Category Distrib
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(category_name, 'غير محدد'), 'value', total)), '[]'::jsonb)
    INTO v_category_dist
    FROM (
        SELECT category_name, COUNT(*) as total 
        FROM tmp_filtered_tickets 
        GROUP BY category_name
    ) sub;

    -- Branch Perf
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', branch_name, 
        'total', total, 
        'resolved', resolved, 
        'rate', CASE WHEN total > 0 THEN ROUND((resolved::numeric / total::numeric) * 100) ELSE 0 END
    )), '[]'::jsonb)
    INTO v_branch_perf
    FROM (
        SELECT branch_name, COUNT(*) as total, COUNT(*) FILTER (WHERE status IN ('closed', 'resolved')) as resolved
        FROM tmp_filtered_tickets
        GROUP BY branch_name
        ORDER BY total DESC
        LIMIT 10
    ) sub2;

    -- Raw Tickets for Export (Only essential fields for Excel)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 
        'status', status, 
        'created_at', created_at, 
        'resolved_at', resolved_at,
        'rating_score', rating_score, 
        'branch_name', branch_name,
        'category_name', category_name
    )), '[]'::jsonb)
    INTO v_raw_tickets
    FROM tmp_filtered_tickets;

    RETURN jsonb_build_object(
        'totalTickets', COALESCE(v_total_tickets, 0),
        'resolvedTickets', COALESCE(v_resolved_tickets, 0),
        'avgMttr', COALESCE(v_avg_mttr, 0),
        'totalCost', COALESCE(v_total_cost, 0),
        'dailyTrends', COALESCE(v_daily_trends, '[]'::jsonb),
        'categoryDistribution', v_category_dist,
        'branchPerformance', v_branch_perf,
        'rawTickets', v_raw_tickets
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_reports_dashboard_data TO authenticated;
