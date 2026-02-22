-- ==========================================
-- FINAL SCHEMA HARMONIZATION & CLEANUP
-- Purpose: Unify naming, remove redundancies, clean debt.
-- ==========================================

-- ─── 1. HARMONIZE TICKETS ──────────────────────────────────
-- Migrate technician_id -> assigned_to (Standard is assigned_to)
UPDATE public.tickets 
SET assigned_to = technician_id 
WHERE assigned_to IS NULL AND technician_id IS NOT NULL;

-- Remove redundant columns from tickets
ALTER TABLE public.tickets DROP COLUMN IF EXISTS technician_id;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS title; -- asset_name is our standard

-- ─── 2. HARMONIZE BRANCHES ──────────────────────────────────
-- Ensure latitude/longitude are populated from old branch_lat/lng
UPDATE public.branches SET latitude = branch_lat WHERE latitude IS NULL AND branch_lat IS NOT NULL;
UPDATE public.branches SET longitude = branch_lng WHERE longitude IS NULL AND branch_lng IS NOT NULL;

-- Remove redundant columns from branches
ALTER TABLE public.branches DROP COLUMN IF EXISTS branch_lat;
ALTER TABLE public.branches DROP COLUMN IF EXISTS branch_lng;
ALTER TABLE public.branches DROP COLUMN IF EXISTS sector; -- area_id is the standard FK

-- ─── 3. HARMONIZE UI_SCHEMAS ────────────────────────────────
-- Force list/form to use the standard column names exclusively
UPDATE public.ui_schemas SET 
  list_config = jsonb_set(list_config, '{columns}', '[
    {"key": "name", "label": "اسم الفرع", "type": "text"},
    {"key": "br_tel", "label": "الهاتف", "type": "text"},
    {"key": "area_id", "label": "المنطقة", "type": "text"},
    {"key": "latitude", "label": "Latitude", "type": "text"},
    {"key": "longitude", "label": "Longitude", "type": "text"}
  ]'::jsonb),
  form_config = jsonb_set(form_config, '{fields}', '[
    {"key": "name", "label": "اسم الفرع", "type": "text", "required": true},
    {"key": "br_tel", "label": "الهاتف", "type": "text"},
    {"key": "area_id", "label": "المنطقة", "type": "select", "required": true, "dataSource": "areas"},
    {"key": "latitude", "label": "Latitude", "type": "number"},
    {"key": "longitude", "label": "Longitude", "type": "number"}
  ]'::jsonb)
WHERE table_name = 'branches';

UPDATE public.ui_schemas SET 
  list_config = jsonb_set(list_config, '{columns}', '[
    {"key": "asset_name", "label": "المعدة", "type": "text"},
    {"key": "branch_id", "label": "الفرع", "type": "text"},
    {"key": "status", "label": "الحالة", "type": "status"},
    {"key": "priority", "label": "الأولوية", "type": "status"},
    {"key": "assigned_to", "label": "الفني", "type": "text"},
    {"key": "created_at", "label": "التاريخ", "type": "date"}
  ]'::jsonb)
WHERE table_name = 'tickets';
