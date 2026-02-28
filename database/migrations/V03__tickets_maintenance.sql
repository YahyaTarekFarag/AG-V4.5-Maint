-- V03__tickets_maintenance.sql
-- ==========================================
-- المرحلة الثالثة: نظام البلاغات ومعاملات المخزون
-- ==========================================

-- 1. Tickets (The Core Process)
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id) NOT NULL,
  
  -- Asset & Category Linked
  asset_id uuid REFERENCES public.maintenance_assets(id),
  category_id uuid REFERENCES public.maintenance_categories(id),
  asset_name text,
  
  -- Personnel Linked
  manager_id uuid REFERENCES public.profiles(id),
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_by uuid REFERENCES public.profiles(id),
  technician_id uuid REFERENCES public.profiles(id), -- Historical or active tech, some uses might prefer assigned_to
  
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  description text NOT NULL,
  priority text DEFAULT 'normal',
  is_emergency boolean DEFAULT false,
  
  -- Reporter Details (Manual Entry)
  reporter_name text,
  reporter_job text,
  reporter_phone text,
  breakdown_time timestamptz,
  
  -- Geolocation Matrix (The Tracker)
  reported_lat double precision,
  reported_lng double precision,
  started_lat double precision,
  started_lng double precision,
  resolved_lat double precision,
  resolved_lng double precision,
  
  -- Evaluation System
  rating_score integer CHECK (rating_score >= 1 AND rating_score <= 5),
  rating_comment text,
  
  -- Attachments & Timestamps
  reported_image_url text,
  resolved_image_url text,
  reported_at timestamptz DEFAULT NOW(),
  downtime_start timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  
  -- Analytics
  fault_type_id uuid REFERENCES public.maintenance_categories(id),
  
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- 2. Inventory Transactions (Spare Parts Consumption)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id uuid REFERENCES public.inventory(id) NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id),
  technician_id uuid REFERENCES public.profiles(id) NOT NULL,
  quantity_used integer NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Standard Policies
DO $$
BEGIN
  CREATE POLICY "Allow all actions for authenticated users" ON public.tickets FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all actions for authenticated users" ON public.inventory_transactions FOR ALL TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
