-- ==========================================
-- FSC-MAINT-APP V10.1 — Detailed Reporter Info
-- ==========================================

-- 1. Add Columns to public.tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS reporter_name text,
ADD COLUMN IF NOT EXISTS reporter_job text,
ADD COLUMN IF NOT EXISTS reporter_phone text,
ADD COLUMN IF NOT EXISTS breakdown_time timestamptz;

-- 2. Update UI Schema for Tickets (List and Form)
UPDATE public.ui_schemas SET
  list_config = jsonb_set(
    jsonb_set(list_config, '{columns}', 
      (list_config->'columns') || '[
        {"key":"reporter_name","label":"اسم القائم بالبلاغ","type":"text"},
        {"key":"reporter_job","label":"الوظيفة","type":"text"}
      ]'::jsonb
    ),
    '{searchable}', 
    'true'::jsonb
  ),
  form_config = jsonb_set(form_config, '{fields}', 
    (form_config->'fields') || '[
      {"key":"reporter_name","label":"اسم القائم بالبلاغ","type":"text","required":true},
      {"key":"reporter_job","label":"وظيفة القائم بالبلاغ","type":"text","required":true},
      {"key":"reporter_phone","label":"رقم هاتف القائم بالبلاغ","type":"text","required":true},
      {"key":"breakdown_time","label":"موعد تعطل المعدة فعلياً","type":"datetime","required":true}
    ]'::jsonb
  )
WHERE table_name = 'tickets';
