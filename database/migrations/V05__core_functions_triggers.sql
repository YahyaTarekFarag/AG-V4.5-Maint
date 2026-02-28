-- V05__core_functions_triggers.sql
-- ==========================================
-- المرحلة الخامسة: الإجراءات المركزية والمشغلات (Functions & Triggers)
-- ==========================================

-- 1. User Profile Auto-Creation on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, employee_code, full_name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'employee_code', 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'technician')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Inventory Deduction (Trigger-based)
CREATE OR REPLACE FUNCTION public.handle_inventory_deduction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity_used,
        updated_at = NOW()
    WHERE id = NEW.inventory_id
    AND quantity >= NEW.quantity_used;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'عجز في المخزون: الرصيد المتاح لا يكفي لإتمام عملية الخصم المطلوبة.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_inventory_transaction_deduct ON public.inventory_transactions;
CREATE TRIGGER on_inventory_transaction_deduct
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_deduction();

-- 3. Atomic Deadlock-Free Inventory Deduction (RPC)
CREATE OR REPLACE FUNCTION public.deduct_inventory_atomic(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_items JSONB, -- Array of {part_id, qty}
    p_submission_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Idempotency check handled via unique constraints optionally or by checking transactions directly.
    
    FOR v_item IN 
        SELECT (x->>'part_id')::UUID as part_id, (x->>'qty')::INT as qty
        FROM jsonb_array_elements(p_items) AS x
        ORDER BY (x->>'part_id')::UUID
    LOOP
        PERFORM id FROM public.inventory WHERE id = v_item.part_id FOR UPDATE;

        INSERT INTO public.inventory_transactions (
            inventory_id,
            ticket_id,
            technician_id,
            quantity_used,
            created_at
        ) VALUES (
            v_item.part_id,
            p_ticket_id,
            p_technician_id,
            v_item.qty,
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Payroll Auto-Calculation on Ticket Closure
CREATE OR REPLACE FUNCTION public.handle_ticket_closure_payroll()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
    v_base_rate DECIMAL;
    v_bonus_rate DECIMAL;
    v_stars INT;
    v_bonus_amount DECIMAL;
BEGIN
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        v_profile_id := NEW.assigned_to;
        v_stars := COALESCE(NEW.rating_score, 0); -- Fixed column name
        
        SELECT base_daily_rate, star_bonus_rate 
        INTO v_base_rate, v_bonus_rate 
        FROM public.profiles WHERE id = v_profile_id;
        
        v_bonus_amount := (v_bonus_rate * v_stars) / 5.0;
        
        -- Use Cairo Time for daily accuracy
        INSERT INTO public.payroll_logs (profile_id, date, base_salary, total_star_bonus, net_earning)
        VALUES (v_profile_id, (NOW() AT TIME ZONE 'Africa/Cairo')::DATE, v_base_rate, v_bonus_amount, v_base_rate + v_bonus_amount)
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

-- 5. Dashboard Combined Stats (RPC)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_role TEXT;
    v_branch_id UUID;
    v_area_id UUID;
    v_sector_id UUID;
    v_brand_id UUID;
    v_result JSONB;
BEGIN
    SELECT role, branch_id, area_id, sector_id, brand_id 
    INTO v_role, v_branch_id, v_area_id, v_sector_id, v_brand_id
    FROM public.profiles WHERE id = p_profile_id;

    v_result = jsonb_build_object(
        'open', (SELECT count(*) FROM public.tickets t 
                 JOIN public.branches b ON t.branch_id = b.id
                 JOIN public.areas a ON b.area_id = a.id
                 JOIN public.sectors s ON a.sector_id = s.id
                 WHERE t.status = 'open' 
                 AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                      OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                      OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                      OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                      OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),
        
        'assigned', (SELECT count(*) FROM public.tickets t 
                     JOIN public.branches b ON t.branch_id = b.id
                     JOIN public.areas a ON b.area_id = a.id
                     JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'assigned' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'in_progress', (SELECT count(*) FROM public.tickets t 
                        JOIN public.branches b ON t.branch_id = b.id
                        JOIN public.areas a ON b.area_id = a.id
                        JOIN public.sectors s ON a.sector_id = s.id
                        WHERE t.status = 'in_progress' 
                        AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                             OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                             OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                             OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                             OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'resolved', (SELECT count(*) FROM public.tickets t 
                     JOIN public.branches b ON t.branch_id = b.id
                     JOIN public.areas a ON b.area_id = a.id
                     JOIN public.sectors s ON a.sector_id = s.id
                     WHERE t.status = 'resolved' 
                     AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                          OR (v_role = 'manager' AND t.branch_id = v_branch_id)
                          OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                          OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                          OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'available_techs', (SELECT count(*) FROM public.technician_attendance att
                            JOIN public.profiles p ON att.profile_id = p.id
                            WHERE att.clock_out IS NULL
                            AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                                 OR (v_role = 'manager' AND p.branch_id = v_branch_id)
                                 OR (v_role = 'area_manager' AND p.area_id = v_area_id)
                                 OR (v_role = 'sector_manager' AND p.sector_id = v_sector_id)
                                 OR (v_role = 'brand_ops_manager' AND p.brand_id = v_brand_id))),

        'faulty_assets', (SELECT count(*) FROM public.maintenance_assets ma
                          JOIN public.branches b ON ma.branch_id = b.id
                          JOIN public.areas a ON b.area_id = a.id
                          JOIN public.sectors s ON a.sector_id = s.id
                          WHERE ma.status = 'faulty' 
                          AND (v_role IN ('admin', 'maint_manager', 'maint_supervisor') 
                               OR (v_role = 'manager' AND ma.branch_id = v_branch_id)
                               OR (v_role = 'area_manager' AND b.area_id = v_area_id)
                               OR (v_role = 'sector_manager' AND a.sector_id = v_sector_id)
                               OR (v_role = 'brand_ops_manager' AND s.brand_id = v_brand_id))),

        'low_stock', (SELECT count(*) FROM public.inventory WHERE quantity < 5)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO authenticated;
