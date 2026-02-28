-- V18__performance_indexes.sql
-- إنشاء فهارس لتحسين أداء النظام خصوصاً لـ Dashboard و MaintenanceDashboard

-- 1. Index لتحسين عد وتصفية التذاكر بناءً على الحالة (لـ Dashboard counts)
CREATE INDEX IF NOT EXISTS idx_tickets_status_is_deleted 
  ON tickets(status, is_deleted);

-- 2. Index لتحسين ترتيب التذاكر زمنياً مع الربط بالفرع
CREATE INDEX IF NOT EXISTS idx_tickets_branch_created 
  ON tickets(branch_id, created_at DESC);

-- 3. Index لتسريع جلب تذاكر الفني النشطة
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_active 
  ON tickets(assigned_to) WHERE is_deleted = false;

-- 4. Index لتسريع جلب تذاكر المدير النشطة
CREATE INDEX IF NOT EXISTS idx_tickets_manager_id_active 
  ON tickets(manager_id) WHERE is_deleted = false;
