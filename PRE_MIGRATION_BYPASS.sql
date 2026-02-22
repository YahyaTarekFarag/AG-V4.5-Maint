-- ==========================================
-- PRE-MIGRATION: DROPPING CONSTRAINTS
-- Purpose: Allow migrating data with Auth IDs that don't exist yet.
-- ==========================================

-- 1. Drop FK from profiles to auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Drop FK from tickets to profiles
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_reported_by_fkey;

-- 3. Drop FK from inventory_transactions to profiles/tickets
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_technician_id_fkey;
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_ticket_id_fkey;

-- 4. Drop FK from shifts to profiles
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_technician_id_fkey;

-- Now data can be migrated safely.
