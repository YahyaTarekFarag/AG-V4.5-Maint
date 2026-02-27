-- ==========================================
-- Master Completion Patch (FSC-MAINT-APP)
-- This script consolidates HR, Intelligence, and Performance fixes.
-- ==========================================

-- 1. EXTENSIONS & ESSENTIALS
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HR SCHEMA ENHANCEMENTS (Safely)
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS base_daily_rate DECIMAL DEFAULT 100;
    ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS per_km_allowance DECIMAL DEFAULT 5;
    ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS star_bonus_rate DECIMAL DEFAULT 20;
END $$;

-- 3. CORE INTELLIGENCE VIEWS (MTTR / MTBF)
-- Drop views first to avoid data type conflict (ERROR 42P16)
DROP VIEW IF EXISTS public.v_technician_performance CASCADE;
DROP VIEW IF EXISTS public.v_critical_assets_report CASCADE;

-- View for Technician Performance (MTTR)
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(t.id) as tickets_solved,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.started_at))/3600)::numeric(10,2) as avg_repair_hours,
    AVG(t.rating_score)::numeric(10,1) as avg_rating,
    COALESCE(SUM(it.quantity_used * i.unit_cost), 0)::numeric(10,2) as total_parts_cost
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.status = 'closed' AND t.started_at IS NOT NULL AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;

-- View for Critical Assets (MTBF)
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

-- 4. TICKETS SCHEMA CONSOLIDATION
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS public.tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);
    ALTER TABLE IF EXISTS public.tickets ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id);
    ALTER TABLE IF EXISTS public.tickets ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE IF EXISTS public.tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
END $$;

-- 5. PERFORMANCE INDEXES (V2)
CREATE INDEX IF NOT EXISTS idx_profiles_hierarchy_v2 ON public.profiles(brand_id, sector_id, area_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_composite_status_v2 ON public.tickets(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branches_area_id_v2 ON public.branches(area_id);
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm_v2 ON public.maintenance_assets USING gin (name gin_trgm_ops);

-- 6. ABILITY TO CALCULATE DISTANCE (HR PREREQUISITE)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION, 
  lon1 DOUBLE PRECISION, 
  lat2 DOUBLE PRECISION, 
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R DOUBLE PRECISION := 6371; -- Earth's radius in km
  dLat DOUBLE PRECISION := radians(lat2 - lat1);
  dLon DOUBLE PRECISION := radians(lon2 - lon1);
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- 7. HR AUTOMATION: PAYROLL & MISSION LOGGING
-- Trigger to initialize or update daily payroll log when a ticket is closed
CREATE OR REPLACE FUNCTION public.handle_ticket_closure_payroll()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
    v_base_rate DECIMAL;
    v_bonus_rate DECIMAL;
    v_stars INT;
    v_bonus_amount DECIMAL;
BEGIN
    -- Only act on 'closed' status
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        v_profile_id := NEW.assigned_to;
        v_stars := COALESCE(NEW.rating_score, 0); -- Correct column name
        
        -- Get rates from profile
        SELECT base_daily_rate, star_bonus_rate 
        INTO v_base_rate, v_bonus_rate 
        FROM public.profiles WHERE id = v_profile_id;
        
        -- Calculate bonus (e.g., bonus_rate * stars / 5)
        v_bonus_amount := (COALESCE(v_bonus_rate, 0) * v_stars) / 5.0;
        
        -- Insert or Update payroll log for today
        INSERT INTO public.payroll_logs (profile_id, date, base_salary, total_star_bonus, net_earning)
        VALUES (v_profile_id, CURRENT_DATE, COALESCE(v_base_rate, 0), v_bonus_amount, COALESCE(v_base_rate, 0) + v_bonus_amount)
        ON CONFLICT (profile_id, date) DO UPDATE SET
            total_star_bonus = public.payroll_logs.total_star_bonus + EXCLUDED.total_star_bonus,
            net_earning = public.payroll_logs.net_earning + EXCLUDED.total_star_bonus;
            
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_closed_payroll ON public.tickets;
CREATE TRIGGER on_ticket_closed_payroll
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_closure_payroll();

-- Function to register a mission and calculate distance
CREATE OR REPLACE FUNCTION public.log_technician_mission(
    p_ticket_id UUID,
    p_to_branch_id UUID
) RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
    v_attendance_id UUID;
    v_last_branch_id UUID;
    v_lat1 DOUBLE PRECISION;
    v_lng1 DOUBLE PRECISION;
    v_lat2 DOUBLE PRECISION;
    v_lng2 DOUBLE PRECISION;
    v_dist DOUBLE PRECISION := 0;
    v_allowance_rate DECIMAL;
    v_earned DECIMAL;
    v_mission_id UUID;
BEGIN
    -- Get current active attendance for the technician (using auth.uid() if called from client)
    -- Or use technician_id from ticket if assigned
    SELECT id, profile_id INTO v_attendance_id, v_profile_id
    FROM public.technician_attendance
    WHERE profile_id = auth.uid() AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;
    
    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION 'المناوبة غير نشطة. يرجى تسجيل الحضور أولاً.';
    END IF;

    -- Get allowance rate
    SELECT per_km_allowance INTO v_allowance_rate FROM public.profiles WHERE id = v_profile_id;

    -- Get last mission's branch to calculate distance
    SELECT to_branch_id INTO v_last_branch_id
    FROM public.technician_missions
    WHERE attendance_id = v_attendance_id
    ORDER BY created_at DESC LIMIT 1;

    -- Get coordinates of branches
    IF v_last_branch_id IS NOT NULL THEN
        SELECT branch_lat, branch_lng INTO v_lat1, v_lng1 FROM public.branches WHERE id = v_last_branch_id;
        SELECT branch_lat, branch_lng INTO v_lat2, v_lng2 FROM public.branches WHERE id = p_to_branch_id;
        
        IF v_lat1 IS NOT NULL AND v_lat2 IS NOT NULL THEN
            v_dist := calculate_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        END IF;
    END IF;

    v_earned := v_dist * COALESCE(v_allowance_rate, 0);

    -- Insert Mission
    INSERT INTO public.technician_missions (attendance_id, profile_id, ticket_id, from_branch_id, to_branch_id, distance_km, allowance_earned)
    VALUES (v_attendance_id, v_profile_id, p_ticket_id, v_last_branch_id, p_to_branch_id, v_dist, v_earned)
    RETURNING id INTO v_mission_id;

    -- Update Payroll Log
    INSERT INTO public.payroll_logs (profile_id, date, total_allowance, net_earning)
    VALUES (v_profile_id, CURRENT_DATE, v_earned, v_earned)
    ON CONFLICT (profile_id, date) DO UPDATE SET
        total_allowance = public.payroll_logs.total_allowance + EXCLUDED.total_allowance,
        net_earning = public.payroll_logs.net_earning + EXCLUDED.total_allowance;

    RETURN v_mission_id;
END;
$$ LANGUAGE plpgsql;

-- 8. ENSURE UI SCHEMAS FOR HR TABLES ARE PRESENT
INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('technician_attendance',
  '{
    "title":"سجل الحضور والانصراف (HR)",
    "searchable":true,
    "columns":[
      {"key":"clock_in","label":"وقت الحضور","type":"date"},
      {"key":"clock_out","label":"وقت الانصراف","type":"date"},
      {"key":"is_valid","label":"حالة القيد","type":"badge"}
    ]
  }'::jsonb,
  '{
    "title":"تعديل سجل حضور",
    "fields":[
      {"key":"profile_id","label":"الفني","type":"select","dataSource":"profiles", "required": true},
      {"key":"clock_in","label":"وقت الحضور","type":"date"},
      {"key":"clock_out","label":"وقت الانصراف","type":"date"},
      {"key":"is_valid","label":"صحة البيانات","type":"select", "options": [
          {"label": "صحيح", "value": "true"},
          {"label": "غير صحيح", "value": "false"}
      ]}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO NOTHING;

INSERT INTO public.ui_schemas (table_name, list_config, form_config) VALUES
('payroll_logs',
  '{
    "title":"سجل المستحقات والرواتب",
    "searchable":true,
    "columns":[
      {"key":"date","label":"التاريخ","type":"date"},
      {"key":"net_earning","label":"صافي اليوم","type":"badge"},
      {"key":"is_paid","label":"حالة الصرف","type":"status"}
    ]
  }'::jsonb,
  '{
    "title":"تعديل مستحقات يومية",
    "fields":[
      {"key":"profile_id","label":"الفني","type":"select","dataSource":"profiles"},
      {"key":"date","label":"التاريخ","type":"date"},
      {"key":"net_earning","label":"الإجمالي النهائي","type":"number"},
      {"key":"is_paid","label":"هل تم الصرف؟","type":"select", "options": [
          {"label": "نعم - تم الصرف", "value": "true"},
          {"label": "لا - منتظر", "value": "false"}
      ]}
    ]
  }'::jsonb
) ON CONFLICT (table_name) DO NOTHING;

-- 7. NOTIFY COMPLETION
COMMENT ON DATABASE postgres IS 'Applied Master Completion Patch for FSC-MAINT-APP';
