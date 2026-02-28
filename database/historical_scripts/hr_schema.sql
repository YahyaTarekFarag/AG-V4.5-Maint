-- ==========================================
-- HR & Payroll System Schema (FSC-MAINT-APP)
-- ==========================================

-- 1. Extend Profiles for Payroll settings
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS base_daily_rate DECIMAL DEFAULT 100,
ADD COLUMN IF NOT EXISTS per_km_allowance DECIMAL DEFAULT 5,
ADD COLUMN IF NOT EXISTS star_bonus_rate DECIMAL DEFAULT 20;

-- 2. Create Attendance Table
CREATE TABLE IF NOT EXISTS public.technician_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clock_out TIMESTAMP WITH TIME ZONE,
    clock_in_lat DOUBLE PRECISION,
    clock_in_lng DOUBLE PRECISION,
    clock_out_lat DOUBLE PRECISION,
    clock_out_lng DOUBLE PRECISION,
    shift_id UUID,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Missions Table (Haversine Tracking)
CREATE TABLE IF NOT EXISTS public.technician_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id UUID REFERENCES public.technician_attendance(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id),
    ticket_id UUID REFERENCES public.tickets(id),
    from_branch_id UUID REFERENCES public.branches(id),
    to_branch_id UUID REFERENCES public.branches(id),
    distance_km DOUBLE PRECISION DEFAULT 0,
    allowance_earned DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Salary Logs (Real-time summary)
CREATE TABLE IF NOT EXISTS public.payroll_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    base_salary DECIMAL DEFAULT 0,
    total_allowance DECIMAL DEFAULT 0,
    total_star_bonus DECIMAL DEFAULT 0,
    net_earning DECIMAL DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

-- RLS Policies
ALTER TABLE public.technician_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_logs ENABLE ROW LEVEL SECURITY;

-- Technicians can see their own data
CREATE POLICY "Technicians can read own attendance" ON public.technician_attendance
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Technicians can read own missions" ON public.technician_missions
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Technicians can read own payroll" ON public.payroll_logs
    FOR SELECT USING (auth.uid() = profile_id);

-- Admins and Maint Managers can see all
CREATE POLICY "Managers can read all attendance" ON public.technician_attendance
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

CREATE POLICY "Managers can read all missions" ON public.technician_missions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

CREATE POLICY "Managers can read all payroll" ON public.payroll_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
    );

-- Helper RPC for Haversine Distance (SQL Version)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION, 
  lon1 DOUBLE PRECISION, 
  lat2 DOUBLE PRECISION, 
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R DOUBLE PRECISION := 6371; -- Earth's radius in km
  dLat DOUBLE PRECISION := radians(lat2 - lat1);
  dLon DOUBLE PRECISION := radians(lon2 - lon1);
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql;
