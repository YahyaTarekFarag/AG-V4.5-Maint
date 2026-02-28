-- V07__indexes.sql
-- ==========================================
-- المرحلة السابعة: الفهارس وتسريع الأداء (Performance Indexes)
-- ==========================================

-- 1. فهارس جدول البلاغات (Tickets) لتسريع الداشبورد والفلترة
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_manager_id ON public.tickets (manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_branch_id ON public.tickets (branch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_reported_at ON public.tickets (reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_asset_category ON public.tickets (category_id, asset_id);

-- 2. فهارس الهيكل التنظيمي (Hierarchy)
CREATE INDEX IF NOT EXISTS idx_branches_area_id ON public.branches (area_id);
CREATE INDEX IF NOT EXISTS idx_areas_sector_id ON public.areas (sector_id);
CREATE INDEX IF NOT EXISTS idx_sectors_brand_id ON public.sectors (brand_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles (branch_id);

-- 3. فهارس الموارد البشرية (HR)
CREATE INDEX IF NOT EXISTS idx_payroll_logs_profile_date ON public.payroll_logs (profile_id, date);
CREATE INDEX IF NOT EXISTS idx_technician_attendance_active ON public.technician_attendance (profile_id) WHERE clock_out IS NULL;

-- 4. فهارس المعاملات المخزنية
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ticket ON public.inventory_transactions (ticket_id);
