-- ==========================================
-- FSC-MAINT-APP V10.0 Database Schema
-- Architecture Blueprint Compliance: High
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (Employees) - No Emails
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'technician')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Branches
CREATE TABLE public.branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  branch_lat double precision,
  branch_lng double precision,
  manager_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Inventory (Spare Parts)
CREATE TABLE public.inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  part_number text,
  quantity integer DEFAULT 0,
  unit text DEFAULT 'قطعة',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tickets (The Core Process)
CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id) NOT NULL,
  asset_name text, -- Name of the asset/machine
  technician_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  description text NOT NULL,
  priority text DEFAULT 'normal',
  
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
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Inventory Transactions
CREATE TABLE public.inventory_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id uuid REFERENCES public.inventory(id) NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id),
  technician_id uuid REFERENCES public.profiles(id) NOT NULL,
  quantity_used integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. UI Schemas (Sovereign Metadata-Driven Engine)
CREATE TABLE public.ui_schemas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  list_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_schemas ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Admin has all access, others have read or specific access depending on requirement)
-- Note: In a real system, more granular policies are needed.
CREATE POLICY "Allow all actions for authenticated users" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all actions for authenticated users" ON public.branches FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all actions for authenticated users" ON public.inventory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all actions for authenticated users" ON public.tickets FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all actions for authenticated users" ON public.inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all actions for authenticated users" ON public.ui_schemas FOR ALL TO authenticated USING (true);

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, employee_code, full_name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'employee_code', 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'technician')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile after Auth sync
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
