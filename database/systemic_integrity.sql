-- ==========================================
-- FSC-MAINT-APP V12.0: Structural Integrity
-- Preventing systemic data corruption in HR & Maintenance
-- ==========================================

-- 1. Preventing Duplicate Active Shifts (Systemic Safeguard)
-- Ensure only one record can have clock_out as NULL per profile_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_tech 
ON public.technician_attendance (profile_id) 
WHERE (clock_out IS NULL);

-- 2. Performance Audit Log Index
-- Speeds up the global management audit trail
CREATE INDEX IF NOT EXISTS idx_ui_schemas_table_name ON public.ui_schemas(table_name);
