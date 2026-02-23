-- ==========================================
-- UI Schema Reconciliation: Profiles & Tickets
-- Adds missing hierarchy and assignment fields to UI engine
-- ==========================================

-- 1. Update Profiles UI Schema (Include Hierarchy Selects)
UPDATE public.ui_schemas SET
  form_config = jsonb_set(
    form_config,
    '{fields}',
    (form_config->'fields') || '[
      {"key":"brand_id","label":"البراند","type":"select","dataSource":"brands"},
      {"key":"sector_id","label":"القطاع","type":"select","dataSource":"sectors"},
      {"key":"area_id","label":"المنطقة","type":"select","dataSource":"areas"},
      {"key":"branch_id","label":"الفرع","type":"select","dataSource":"branches"}
    ]'::jsonb
  )
WHERE table_name = 'profiles';

-- 2. Update Tickets UI Schema (Include Assignment & Detailed Info)
UPDATE public.ui_schemas SET
  list_config = jsonb_set(
    list_config,
    '{columns}',
    (list_config->'columns') || '[
      {"key":"assigned_to","label":"الفني","type":"text"},
      {"key":"priority","label":"الأولوية","type":"status"}
    ]'::jsonb
  ),
  form_config = jsonb_set(
    form_config,
    '{fields}',
    (form_config->'fields') || '[
      {"key":"assigned_to","label":"تعيين فني","type":"select","dataSource":"profiles","dataLabel":"full_name"},
      {"key":"priority","label":"الأولوية","type":"select","options":[
        {"label":"عادي","value":"normal"},
        {"label":"مرتفع","value":"high"},
        {"label":"عاجل","value":"urgent"},
        {"label":"حرج","value":"critical"}
      ]}
    ]'::jsonb
  )
WHERE table_name = 'tickets';
