-- إضافة عمود page_config لجدول ui_schemas (لتخزين KPI Cards وإعدادات الصفحة)
ALTER TABLE public.ui_schemas
ADD COLUMN IF NOT EXISTS page_config jsonb DEFAULT '{}'::jsonb;

-- بيانات KPI Cards الافتراضية لكل دور
UPDATE public.ui_schemas SET page_config = '{
  "kpi_cards": [
    {"label":"إجمالي البلاغات","table":"tickets","aggregate":"count","color":"blue","icon":"Wrench","link_to":"/tickets"},
    {"label":"قيد المعالجة","table":"tickets","aggregate":"count","filter":{"status":"in_progress"},"color":"amber","icon":"Activity","link_to":"/tickets"},
    {"label":"تنتظر الاستلام","table":"tickets","aggregate":"count","filter":{"status":"resolved"},"color":"red","icon":"AlertTriangle","link_to":"/tickets"},
    {"label":"مُغلَقة","table":"tickets","aggregate":"count","filter":{"status":"closed"},"color":"green","icon":"CheckCircle","link_to":"/tickets"}
  ]
}'::jsonb WHERE table_name = 'tickets';
