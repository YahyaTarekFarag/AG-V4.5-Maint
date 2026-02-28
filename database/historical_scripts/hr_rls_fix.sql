-- ==========================================
-- HR & MAINTENANCE RLS PERMISSIONS FIX
-- ==========================================

-- 1. technician_missions: Allow full control for Admins and Maintenance Managers
DROP POLICY IF EXISTS "Managers can read all missions" ON public.technician_missions;
CREATE POLICY "Managers can manage all missions" ON public.technician_missions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

-- 2. technician_attendance: Allow full control for Admins and Maintenance Managers
DROP POLICY IF EXISTS "Managers can read all attendance" ON public.technician_attendance;
CREATE POLICY "Managers can manage all attendance" ON public.technician_attendance
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

-- 3. payroll_logs: Allow full control for Admins and Maintenance Managers
DROP POLICY IF EXISTS "Managers can read all payroll" ON public.payroll_logs;
CREATE POLICY "Managers can manage all payroll" ON public.payroll_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

-- 4. maintenance_assets: Ensure Admins/Managers can manage
DROP POLICY IF EXISTS "Managers can manage assets" ON public.maintenance_assets;
CREATE POLICY "Managers can manage assets" ON public.maintenance_assets
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

-- 5. maintenance_categories: Ensure Admins/Managers can manage
DROP POLICY IF EXISTS "Managers can manage categories" ON public.maintenance_categories;
CREATE POLICY "Managers can manage categories" ON public.maintenance_categories
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );
