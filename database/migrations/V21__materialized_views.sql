-- V21__materialized_views.sql
-- إنشاء Materialized Views للإحصائيات الثقيلة (Reports) وتحديثها دورياً

-- 1. Daily Stats Materialized View
CREATE MATERIALIZED VIEW mv_daily_ticket_stats AS
SELECT 
    date_trunc('day', created_at) AS report_date,
    branch_id,
    COUNT(id) as total_tickets,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
    COUNT(CASE WHEN status IN ('pending_review', 'in_progress', 'scheduled') THEN 1 END) as active_tickets,
    AVG(CASE WHEN status = 'resolved' AND resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600.0 ELSE NULL END) as avg_mttr_hours
FROM tickets
WHERE is_deleted = false
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_mv_daily_stats_unique ON mv_daily_ticket_stats(report_date, branch_id);

-- 2. Category Distribution Materialized View
CREATE MATERIALIZED VIEW mv_category_distribution AS
SELECT 
    date_trunc('month', created_at) AS report_month,
    branch_id,
    category_id,
    COUNT(id) as ticket_count
FROM tickets
WHERE is_deleted = false
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_cat_dist_unique ON mv_category_distribution(report_month, branch_id, category_id);

-- 3. Function to Refresh Materialized Views (Can be called via CRON or Trigger)
-- Note: CONCURRENTLY cannot be run inside a PostgreSQL function/transaction block.
CREATE OR REPLACE FUNCTION refresh_reporting_mvs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_daily_ticket_stats;
    REFRESH MATERIALIZED VIEW mv_category_distribution;
END;
$$;
