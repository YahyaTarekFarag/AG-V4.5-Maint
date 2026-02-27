-- ==========================================
-- HR & Attendance UI Integration Patch
-- ==========================================

-- 1. UI Schema for Attendance Logs
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('technician_attendance',
  '{
    "title":"سجل الحضور والانصراف",
    "searchable":true,
    "columns":[
      {"key":"profile_id","label":"الفني","type":"text"},
      {"key":"clock_in","label":"وقت الحضور","type":"date"},
      {"key":"clock_out","label":"وقت الانصراف","type":"date"},
      {"key":"is_valid","label":"حالة القيد","type":"badge"}
    ]
  }'::jsonb,
  '{
    "title":"تعديل سجل حضور",
    "fields":[
      {"key":"profile_id","label":"الفني","type":"select","dataSource":"profiles", "dataLabel": "full_name"},
      {"key":"clock_in","label":"وقت الحضور","type":"date"},
      {"key":"clock_out","label":"وقت الانصراف","type":"date"},
      {"key":"is_valid","label":"صحة البيانات","type":"select", "options": [
          {"label": "صحيح", "value": "true"},
          {"label": "غير صحيح", "value": "false"}
      ]}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config, list_config = EXCLUDED.list_config;

-- 2. UI Schema for Missions
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('technician_missions',
  '{
    "title":"سجل المأموريات والتحركات",
    "searchable":true,
    "columns":[
      {"key":"profile_id","label":"الفني","type":"text"},
      {"key":"from_branch_id","label":"من فرع","type":"text"},
      {"key":"to_branch_id","label":"إلى فرع","type":"text"},
      {"key":"distance_km","label":"المسافة (كم)","type":"text"},
      {"key":"allowance_earned","label":"بدل الانتقال","type":"badge"}
    ]
  }'::jsonb,
  '{
    "title":"تفاصيل المأمورية",
    "fields":[
      {"key":"profile_id","label":"الفني","type":"select","dataSource":"profiles", "dataLabel": "full_name"},
      {"key":"ticket_id","label":"رقم البلاغ","type":"select","dataSource":"tickets", "dataLabel": "asset_name"},
      {"key":"from_branch_id","label":"من فرع","type":"select","dataSource":"branches"},
      {"key":"to_branch_id","label":"إلى فرع","type":"select","dataSource":"branches"},
      {"key":"distance_km","label":"المسافة المقطوعة (كم)","type":"number"},
      {"key":"allowance_earned","label":"المبلغ المستحق","type":"number"}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config, list_config = EXCLUDED.list_config;

-- 3. UI Schema for Payroll
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('payroll_logs',
  '{
    "title":"سجل المستحقات والرواتب",
    "searchable":true,
    "columns":[
      {"key":"date","label":"التاريخ","type":"date"},
      {"key":"profile_id","label":"الفني","type":"text"},
      {"key":"net_earning","label":"صافي اليوم","type":"badge"},
      {"key":"is_paid","label":"حالة الصرف","type":"status"}
    ]
  }'::jsonb,
  '{
    "title":"تعديل مستحقات يومية",
    "fields":[
      {"key":"profile_id","label":"الفني","type":"select","dataSource":"profiles", "dataLabel": "full_name"},
      {"key":"date","label":"التاريخ","type":"date"},
      {"key":"base_salary","label":"الراتب اليومي","type":"number"},
      {"key":"total_allowance","label":"إجمالي البدلات","type":"number"},
      {"key":"total_star_bonus","label":"مكافآت التقييم","type":"number"},
      {"key":"net_earning","label":"الإجمالي النهائي","type":"number"},
      {"key":"is_paid","label":"هل تم الصرف؟","type":"select", "options": [
          {"label": "نعم - تم الصرف", "value": "true"},
          {"label": "لا - منتظر", "value": "false"}
      ]}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET form_config = EXCLUDED.form_config, list_config = EXCLUDED.list_config;
