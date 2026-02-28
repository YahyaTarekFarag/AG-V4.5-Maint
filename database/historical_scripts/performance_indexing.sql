-- ==========================================
-- المرحلة الثامنة: التميز المحمول وتحسين الأداء
-- (Performance Indexing & Database Optimization)
-- ==========================================

-- 1. فهارس تسريع البحث عن البلاغات (Tickets Optimization)
CREATE INDEX IF NOT EXISTS idx_tickets_status_active ON public.tickets(status) WHERE status IN ('open', 'assigned', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_tickets_branch_id_lookup ON public.tickets(branch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_lookup ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON public.tickets(created_at DESC);

-- 2. فهارس تسريع سجل الأصول (Maintenance Assets Optimization)
CREATE INDEX IF NOT EXISTS idx_assets_branch_lookup ON public.maintenance_assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_lookup ON public.maintenance_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_qr_code ON public.maintenance_assets(qr_code);

-- 3. فهارس تسريع الحضور والرواتب (HR & Payroll Optimization)
CREATE INDEX IF NOT EXISTS idx_attendance_profile_active ON public.technician_attendance(profile_id) WHERE clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_date_lookup ON public.technician_attendance(clock_in);
CREATE INDEX IF NOT EXISTS idx_payroll_logs_profile_date ON public.payroll_logs(profile_id, date);

-- 4. فهارس المخزون (Inventory Optimization)
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory(quantity) WHERE quantity > 0;

-- 5. تنظيف وتحسين البيانات (Optional Performance Cleanup)
ANALYZE public.tickets;
ANALYZE public.maintenance_assets;
ANALYZE public.technician_attendance;
