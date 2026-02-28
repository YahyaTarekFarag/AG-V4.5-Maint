-- ==========================================
-- HR & Payroll Logic (RPCs & Triggers)
-- ==========================================

-- 1. Trigger to initialize or update daily payroll log when a ticket is closed
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
        v_stars := COALESCE(NEW.rating, 0);
        
        -- Get rates from profile
        SELECT base_daily_rate, star_bonus_rate 
        INTO v_base_rate, v_bonus_rate 
        FROM public.profiles WHERE id = v_profile_id;
        
        -- Calculate bonus (e.g., bonus_rate * stars / 5)
        v_bonus_amount := (v_bonus_rate * v_stars) / 5.0;
        
        -- Insert or Update payroll log for today
        INSERT INTO public.payroll_logs (profile_id, date, base_salary, total_star_bonus, net_earning)
        VALUES (v_profile_id, CURRENT_DATE, v_base_rate, v_bonus_amount, v_base_rate + v_bonus_amount)
        ON CONFLICT (profile_id, date) DO UPDATE SET
            total_star_bonus = public.payroll_logs.total_star_bonus + EXCLUDED.total_star_bonus,
            net_earning = public.payroll_logs.net_earning + EXCLUDED.total_star_bonus;
            
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ticket_closed_payroll
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_closure_payroll();

-- 2. Function to register a mission and calculate distance from last known point
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
    -- Get current active attendance for the technician
    SELECT id, profile_id INTO v_attendance_id, v_profile_id
    FROM public.technician_attendance
    WHERE profile_id = auth.uid() AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;
    
    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION 'No active session found. Please clock-in first.';
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
        SELECT lat, lng INTO v_lat1, v_lng1 FROM public.branches WHERE id = v_last_branch_id;
        SELECT lat, lng INTO v_lat2, v_lng2 FROM public.branches WHERE id = p_to_branch_id;
        
        IF v_lat1 IS NOT NULL AND v_lat2 IS NOT NULL THEN
            v_dist := calculate_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        END IF;
    END IF;

    v_earned := v_dist * v_allowance_rate;

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
