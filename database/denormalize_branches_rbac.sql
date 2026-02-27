-- ==========================================
-- B.LABAN — DENORMALIZING BRANCH HIERARCHY FOR RBAC
-- This migration adds sector_id and brand_id directly to branches 
-- to allow O(1) filtering efficiency in Sovereign Engine.
-- ==========================================

DO $$ 
BEGIN
    -- 1. Add columns to branches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'sector_id') THEN
        ALTER TABLE public.branches ADD COLUMN sector_id uuid REFERENCES public.sectors(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'brand_id') THEN
        ALTER TABLE public.branches ADD COLUMN brand_id uuid REFERENCES public.brands(id);
    END IF;

    -- 2. Populate the denormalized data
    UPDATE public.branches b
    SET 
        sector_id = a.sector_id,
        brand_id = s.brand_id
    FROM public.areas a
    JOIN public.sectors s ON a.sector_id = s.id
    WHERE b.area_id = a.id;

    -- 3. Update existing records in other tables if needed (optional since we join branches)
END $$;
