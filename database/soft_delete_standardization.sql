-- ==========================================
-- SOFT DELETE STANDARDIZATION PATCH
-- ==========================================

-- Add is_deleted column to core maintenance tables
DO $$
BEGIN
    -- 1. maintenance_assets
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_assets' AND COLUMN_NAME = 'is_deleted') THEN
        ALTER TABLE public.maintenance_assets ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. maintenance_categories
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_categories' AND COLUMN_NAME = 'is_deleted') THEN
        ALTER TABLE public.maintenance_categories ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;

    -- 3. technician_attendance
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'technician_attendance' AND COLUMN_NAME = 'is_deleted') THEN
        ALTER TABLE public.technician_attendance ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;

    -- 4. technician_missions
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'technician_missions' AND COLUMN_NAME = 'is_deleted') THEN
        ALTER TABLE public.technician_missions ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;

    -- 5. payroll_logs
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payroll_logs' AND COLUMN_NAME = 'is_deleted') THEN
        ALTER TABLE public.payroll_logs ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
