-- ==========================================
-- REMOVE AUDIT LOG SYSTEM (TOTAL CLEANUP)
-- ==========================================

-- 1. AUTOMATED NUCLEAR CLEANUP: Drop ALL triggers referencing handle_audit_log
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON public.' || r.event_object_table || ' CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop trigger % on table %', r.trigger_name, r.event_object_table;
        END;
    END LOOP;
END $$;

-- 2. Drop the audit handling function (CASCADE will help kill remaining links)
DROP FUNCTION IF EXISTS public.handle_audit_log() CASCADE;

-- 3. Drop the audit_logs table and its security policies
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- 4. Manual cleanup for any specifically named triggers just in case
DROP TRIGGER IF EXISTS audit_tickets_trigger ON public.tickets;
DROP TRIGGER IF EXISTS audit_inventory_trigger ON public.inventory;
DROP TRIGGER IF EXISTS audit_attendance_trigger ON public.technician_attendance;
DROP TRIGGER IF EXISTS audit_assets_trigger ON public.maintenance_assets;
DROP TRIGGER IF EXISTS audit_categories_trigger ON public.maintenance_categories;
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
DROP TRIGGER IF EXISTS audit_branches_trigger ON public.branches;
DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.inventory_transactions;
DROP TRIGGER IF EXISTS audit_missions_trigger ON public.technician_missions;
DROP TRIGGER IF EXISTS audit_payroll_trigger ON public.payroll_logs;
DROP TRIGGER IF EXISTS trg_enforce_attendance_integrity ON public.technician_attendance;

-- ==========================================
-- SYSTEM RESTORED TO NO-AUDIT STATE
-- ==========================================
