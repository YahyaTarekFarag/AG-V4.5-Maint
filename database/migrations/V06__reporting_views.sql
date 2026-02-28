-- V06__reporting_views.sql
-- ==========================================
-- المرحلة السادسة: عروض التقارير والتحليلات الآلية (Views)
-- ==========================================

-- 1. View لحساب كفاءة المعدات (MTBF & Reliability)
CREATE OR REPLACE VIEW public.v_asset_reliability AS
SELECT 
    a.id as asset_id,
    a.name as asset_name,
    c.name as category_name,
    COUNT(t.id) as total_repairs,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.started_at, t.created_at)))/3600)::numeric(10,2) as avg_repair_hours_mttr,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.downtime_start, t.created_at)))/3600)::numeric(10,2) as avg_downtime_hours
FROM public.maintenance_assets a
JOIN public.maintenance_categories c ON a.category_id = c.id
LEFT JOIN public.tickets t ON a.id = t.asset_id AND t.status IN ('resolved', 'closed')
GROUP BY a.id, a.name, c.name;

-- 2. View لأداء الفنيين وتكاليف قطع الغيار المستهلكة
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(DISTINCT t.id) as tickets_solved,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.started_at, t.created_at)))/3600)::numeric(10,2) as avg_repair_hours,
    AVG(t.rating_score)::numeric(10,1) as avg_rating,
    COALESCE(SUM(it.quantity_used * i.unit_cost), 0)::numeric(10,2) as total_parts_cost
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;

-- 3. [NEW] View ملخص يومي للبلاغات والصيانة (لحل مشكلة انهيار صفحة التقارير ReportsPage)
CREATE OR REPLACE VIEW public.v_daily_maintenance_stats AS
SELECT 
    DATE(t.created_at) as report_date,
    b.id as branch_id,
    b.name as branch_name,
    s.id as sector_id,
    br.id as brand_id,
    COUNT(t.id) as total_tickets,
    COUNT(t.id) FILTER (WHERE t.status IN ('resolved', 'closed')) as resolved_tickets,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - COALESCE(t.started_at, t.created_at)))/3600)::numeric(10,2) as avg_mttr,
    COALESCE(SUM(c.total_cost), 0)::numeric(10,2) as total_cost_impact,
    -- Calculate generic downtime losses logic (hours * 500)
    COALESCE(SUM(EXTRACT(EPOCH FROM (t.resolved_at - t.downtime_start))/3600 * 500), 0)::numeric(10,2) as downtime_losses_value
FROM public.tickets t
JOIN public.branches b ON t.branch_id = b.id
LEFT JOIN public.areas a ON b.area_id = a.id
LEFT JOIN public.sectors s ON a.sector_id = s.id
LEFT JOIN public.brands br ON s.brand_id = br.id
LEFT JOIN (
    SELECT ticket_id, SUM(quantity_used * COALESCE(inventory.unit_cost, 0)) as total_cost
    FROM public.inventory_transactions
    JOIN public.inventory ON inventory_id = inventory.id
    GROUP BY ticket_id
) c ON c.ticket_id = t.id
GROUP BY DATE(t.created_at), b.id, b.name, s.id, br.id;

-- منح الصلاحيات لقراءة הـ Views
GRANT SELECT ON public.v_asset_reliability TO authenticated;
GRANT SELECT ON public.v_technician_performance TO authenticated;
GRANT SELECT ON public.v_daily_maintenance_stats TO authenticated;
