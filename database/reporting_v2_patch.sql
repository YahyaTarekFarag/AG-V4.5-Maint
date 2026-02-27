-- ==========================================
-- المرحلة 9: تحليلات الصيانة والتقارير الاستراتيجية (V2 - مصحح)
-- تعزيز محرك الذكاء التشغيلي وتحليل التكاليف
-- ==========================================

-- 1. تقرير أداء القطاعات (Sector Performance View)
-- يحلل كفاءة الصيانة على مستوى العلامات التجارية والقطاعات
CREATE OR REPLACE VIEW public.v_sector_performance AS
SELECT 
    br.name as brand_name,
    s.name as sector_name,
    COUNT(DISTINCT t.id) as total_tickets,
    COUNT(DISTINCT CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)::numeric(10,2) as avg_response_hours,
    SUM(COALESCE(it.quantity_used * i.unit_cost, 0))::numeric(10,2) as total_parts_cost
FROM public.sectors s
JOIN public.brands br ON s.brand_id = br.id
JOIN public.areas a ON s.id = a.sector_id
JOIN public.branches b ON a.id = b.area_id
LEFT JOIN public.tickets t ON b.id = t.branch_id
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
GROUP BY br.name, s.name;

-- 2. تقرير الأثر المالي (Financial Impact Report)
-- يدمج تكاليف قطع الغيار مع تقدير خسائر التوقف (Downtime Impact)
CREATE OR REPLACE VIEW public.v_financial_impact_report AS
SELECT 
    t.id as ticket_id,
    b.name as branch_name,
    ma.name as asset_name,
    SUM(COALESCE(it.quantity_used * i.unit_cost, 0))::numeric(10,2) as direct_parts_cost,
    (EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.downtime_start))/3600 * 500)::numeric(10,2) as estimated_downtime_loss, 
    (SUM(COALESCE(it.quantity_used * i.unit_cost, 0)) + (EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.downtime_start))/3600 * 500))::numeric(10,2) as total_economic_impact
FROM public.tickets t
JOIN public.branches b ON t.branch_id = b.id
JOIN public.maintenance_assets ma ON t.asset_id = ma.id
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.downtime_start IS NOT NULL
GROUP BY t.id, b.name, ma.name;

-- 3. درجة صحة الفرع (Branch Health Index)
-- مؤشر مركب لقياس استقرار العمليات في الفروع
CREATE OR REPLACE VIEW public.v_branch_health_index AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    COUNT(t.id) as tickets_count,
    (100 - (COUNT(t.id) * 2) - COALESCE(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600), 0) * 0.5)::numeric(10,2) as health_score
FROM public.branches b
LEFT JOIN public.tickets t ON b.id = t.branch_id AND t.created_at > NOW() - INTERVAL '30 days'
GROUP BY b.id, b.name;

GRANT SELECT ON public.v_sector_performance TO authenticated;
GRANT SELECT ON public.v_financial_impact_report TO authenticated;
GRANT SELECT ON public.v_branch_health_index TO authenticated;
