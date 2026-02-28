-- V15__add_missing_unique_constraints.sql
-- ==========================================
-- توحيد القيود الفريدة لدعم عمليات الحقن الذكي
-- ==========================================

DO $$
BEGIN
    -- 1. Brands name uniqueness
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'brands_name_unique'
    ) THEN
        ALTER TABLE public.brands ADD CONSTRAINT brands_name_unique UNIQUE (name);
    END IF;

    -- 2. Branches name uniqueness (per brand ideally, but globally for now to match upsert logic)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'branches_name_unique'
    ) THEN
        ALTER TABLE public.branches ADD CONSTRAINT branches_name_unique UNIQUE (name);
    END IF;

    -- 3. Inventory part_number uniqueness
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_part_number_unique'
    ) THEN
        ALTER TABLE public.inventory ADD CONSTRAINT inventory_part_number_unique UNIQUE (part_number);
    END IF;

    -- 4. Assets serial_number uniqueness
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'assets_serial_unique'
    ) THEN
        ALTER TABLE public.maintenance_assets ADD CONSTRAINT assets_serial_unique UNIQUE (serial_number);
    END IF;
END $$;
