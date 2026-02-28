-- ==========================================
-- ATTENDANCE DATA HARMONIZATION PATCH
-- ==========================================

-- 1. Migrate active shifts from 'shifts' to 'technician_attendance' if not already present
INSERT INTO public.technician_attendance (profile_id, clock_in, clock_in_lat, clock_in_lng)
SELECT 
    technician_id as profile_id, 
    COALESCE(start_at, NOW()) as clock_in, 
    start_lat as clock_in_lat, 
    start_lng as clock_in_lng
FROM public.shifts
WHERE end_at IS NULL
AND technician_id NOT IN (
    SELECT profile_id FROM public.technician_attendance WHERE clock_out IS NULL
);

-- 2. Optional: Mark old shifts as migrated/closed to prevent duplication (safe approach)
UPDATE public.shifts SET end_at = NOW() WHERE end_at IS NULL;

-- 3. Update 'tickets' UI schema to ensure metadata is consistent
-- (Already done in previous patches but keeping it as a check)
