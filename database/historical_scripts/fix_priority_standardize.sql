-- ==========================================
-- Fix: Standardize ticket priorities
-- Converts Arabic values to English + adds CHECK constraint
-- ==========================================

-- Step 1: Fix existing bad data
UPDATE public.tickets SET priority = 'urgent' WHERE priority = 'طارئ';
UPDATE public.tickets SET priority = 'urgent' WHERE priority = 'عاجل';
UPDATE public.tickets SET priority = 'high'   WHERE priority = 'مرتفع';
UPDATE public.tickets SET priority = 'normal' WHERE priority = 'عادي';
UPDATE public.tickets SET priority = 'critical' WHERE priority = 'حرج';

-- Step 2: Add CHECK constraint to prevent future bad values
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('normal', 'high', 'urgent', 'critical'));

-- Set default for new tickets
ALTER TABLE public.tickets ALTER COLUMN priority SET DEFAULT 'normal';
