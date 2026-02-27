-- ==========================================
-- المرحلة 8: تحسينات الذكاء الصناعي وجاهزية الـ PWA
-- تحديث مخططات الواجهات وإضافة مؤشرات الأداء المتقدمة
-- ==========================================

-- 1. تحديث مخطط "بلاغ صيانة" ليدعم الـ QR وربط الأصول بشكل كامل
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('tickets',
  '{
    "title":"سجل البلاغات الذكي",
    "searchable":true,
    "columns":[
      {"key":"created_at","label":"تاريخ البلاغ","type":"date"},
      {"key":"asset_id","label":"المعدة / الأصل","type":"text"},
      {"key":"status","label":"الحالة","type":"status"},
      {"key":"priority","label":"الأولوية","type":"badge"}
    ]
  }'::jsonb,
  '{
    "title":"فتح بلاغ صيانة ذكي",
    "fields":[
      {"key":"branch_id","label":"الفرع","type":"select","required":true,"dataSource":"branches"},
      {"key":"asset_id","label":"عن طريق المسح أو الاختيار","type":"select","dataSource":"maintenance_assets", "scanable": true},
      {"key":"category_id","label":"تصنيف المشكلة","type":"select","dataSource":"maintenance_categories"},
      {"key":"description","label":"وصف العطل","type":"textarea","required":true},
      {"key":"downtime_start","label":"وقت تعطل المعدة الفعلي","type":"date"},
      {"key":"is_emergency","label":"بلاغ طوارئ (حرج)","type":"select","options":[
          {"label":"لا","value":"false"},
          {"label":"نعم - طوارئ","value":"true"}
      ]},
      {"key":"reported_image_url","label":"صورة العطل","type":"image"}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config, list_config = EXCLUDED.list_config;

-- 2. تحديث مخطط "الأصول" لدعم المسح اليدوي للـ QR
UPDATE public.ui_schemas
SET form_config = jsonb_set(
    form_config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE 
                WHEN f->>'key' = 'qr_code' THEN f || '{"scanable": true}'::jsonb
                ELSE f
            END
        )
        FROM jsonb_array_elements(form_config->'fields') f
    )
)
WHERE table_name = 'maintenance_assets';

-- 3. بناء تقارير ذكاء الأعطال المتقدمة (MTTR / MTBF)
-- حساب متوسط وقت الإصلاح لكل فني (MTTR)
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(t.id) as tickets_solved,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.started_at))/3600)::numeric(10,2) as avg_repair_hours,
    AVG(t.rating_score)::numeric(10,1) as avg_rating
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
WHERE t.status = 'closed' AND t.started_at IS NOT NULL AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;

-- حساب أكثر المعدات تعطلاً وتكلفة زمنية (MTBF Analysis)
CREATE OR REPLACE VIEW public.v_critical_assets_report AS
SELECT 
    a.name as asset_name,
    b.name as branch_name,
    COUNT(t.id) as failure_count,
    SUM(EXTRACT(EPOCH FROM (t.resolved_at - t.downtime_start))/3600)::numeric(10,2) as total_downtime_hours,
    MAX(t.created_at) as last_failure_date
FROM public.maintenance_assets a
JOIN public.branches b ON a.branch_id = b.id
JOIN public.tickets t ON a.id = t.asset_id
WHERE t.status IN ('resolved', 'closed') AND t.downtime_start IS NOT NULL
GROUP BY a.id, a.name, b.name
ORDER BY failure_count DESC;

GRANT SELECT ON public.v_technician_performance TO authenticated;
GRANT SELECT ON public.v_critical_assets_report TO authenticated;
