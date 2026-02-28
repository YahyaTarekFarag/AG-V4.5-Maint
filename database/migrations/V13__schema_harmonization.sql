-- V13__schema_harmonization.sql
-- ==============================================================================
-- PHASE 9: DEEP STRUCTURAL OVERHAUL
-- Goal: Ensure every single operational table has:
-- 1. created_at (TIMESTAMP WITH TIME ZONE)
-- 2. updated_at (TIMESTAMP WITH TIME ZONE)
-- 3. is_deleted (BOOLEAN DEFAULT FALSE)
-- This will stop the "Missing Column Loop" in useSovereign.ts API calls.
-- ==============================================================================

DO $$
DECLARE
    t_name text;
    tables_list text[] := ARRAY[
        'profiles',
        'sectors',
        'areas',
        'branches',
        'maintenance_categories',
        'maintenance_assets',
        'tickets',
        'technician_attendance',
        'technician_missions',
        'payroll_logs',
        'inventory',
        'inventory_transactions',
        'chat_messages',
        'audit_logs',
        'brands'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_list
    LOOP
        -- Check if the table actually exists first
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            -- 1. Ensure `is_deleted` BOOLEAN DEFAULT FALSE
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = t_name AND column_name = 'is_deleted'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;', t_name);
            END IF;

            -- 2. Ensure `created_at` TIMESTAMPTZ DEFAULT NOW()
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = t_name AND column_name = 'created_at'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL;', t_name);
            END IF;

            -- 3. Ensure `updated_at` TIMESTAMPTZ DEFAULT NOW()
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = t_name AND column_name = 'updated_at'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL;', t_name);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Drop isMissingColumn logic dependency right away in theory, UI needs adjusting after this.
