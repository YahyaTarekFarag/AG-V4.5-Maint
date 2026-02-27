-- ==========================================
-- B.LABAN EGYPTIAN EDITION — Colloquial Metadata V11
-- ==========================================

-- Update UI Schema for Tickets with Egyptian Colloquial Labels
UPDATE public.ui_schemas SET
  list_config = jsonb_set(
    jsonb_set(list_config, '{columns}', 
      (list_config->'columns') || '[
        {"key":"reporter_name","label":"مين اللى بلغ؟","type":"text"},
        {"key":"reporter_job","label":"شغال إيه؟","type":"text"}
      ]'::jsonb
    ),
    '{searchable}', 
    'true'::jsonb
  ),
  form_config = jsonb_set(form_config, '{fields}', 
    (form_config->'fields') || '[
      {"key":"reporter_name","label":"مين اللى بلغ؟","type":"text","required":true},
      {"key":"reporter_job","label":"شغال إيه؟ (الوظيفة)","type":"text","required":true},
      {"key":"reporter_phone","label":"رقم تليفونه كام؟","type":"text","required":true},
      {"key":"breakdown_time","label":"المكنة وقفت امتى بالظبط؟","type":"datetime","required":true}
    ]'::jsonb
  )
WHERE table_name = 'tickets';
