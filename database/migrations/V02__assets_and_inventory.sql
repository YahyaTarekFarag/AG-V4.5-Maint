-- V02__assets_and_inventory.sql
-- ==========================================
-- المرحلة الثانية: الأصول الثابتة والمخزون
-- ==========================================

-- 1. Maintenance Categories
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE, 
    created_at timestamptz DEFAULT NOW()
);

-- 2. Maintenance Assets
CREATE TABLE IF NOT EXISTS public.maintenance_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id uuid REFERENCES public.branches(id) NOT NULL,
    category_id uuid REFERENCES public.maintenance_categories(id),
    name text NOT NULL,
    model_number text,
    serial_number text,
    qr_code text UNIQUE,
    purchase_date date,
    warranty_expiry date,
    status text DEFAULT 'operational' CHECK (status IN ('operational', 'faulty', 'under_repair', 'scrapped')),
    last_maintenance_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- 3. Inventory (Spare Parts)
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  part_number text,
  quantity integer DEFAULT 0,
  unit text DEFAULT 'قطعة',
  unit_cost numeric(10, 2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Standard Policies
DO $$
BEGIN
  CREATE POLICY "Allow read for all authenticated" ON public.maintenance_categories FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Allow read for all authenticated" ON public.maintenance_assets FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Allow maintain for admin and managers" ON public.maintenance_assets FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
  );
  CREATE POLICY "Allow all actions for authenticated users" ON public.inventory FOR ALL TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Basic initial categories
INSERT INTO public.maintenance_categories (name) VALUES 
('تبريد وتكييف'), ('كهرباء'), ('ميكانيكا'), ('سباكة'), ('معدات مطبخ'), ('أعمال مدنية'), ('أخرى')
ON CONFLICT (name) DO NOTHING;
