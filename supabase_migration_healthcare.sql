-- SQL Migration for Healthcare Module (Y tế cơ sở & Sức khỏe cộng đồng)
-- Created for CSDL TDP Quảng Giao

CREATE TABLE IF NOT EXISTS public.health_records (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES public.residents(id) ON DELETE SET NULL,
    resident_name TEXT NOT NULL,
    dob DATE,
    gender TEXT,
    household_number TEXT,
    address TEXT,
    phone TEXT,
    group_id TEXT,
    has_bhyt BOOLEAN DEFAULT FALSE,
    bhyt_number TEXT,
    bhyt_expiry DATE,
    chronic_diseases TEXT[] DEFAULT '{}',
    is_disabled BOOLEAN DEFAULT FALSE,
    disability_type TEXT,
    mental_health_issue BOOLEAN DEFAULT FALSE,
    health_status_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vaccination_campaigns (
    id TEXT PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    vaccine_type TEXT NOT NULL,
    target_audience TEXT,
    start_date DATE,
    end_date DATE,
    location TEXT,
    status TEXT DEFAULT 'upcoming',
    total_target INT DEFAULT 0,
    total_completed INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.epidemic_reports (
    id TEXT PRIMARY KEY,
    disease_name TEXT NOT NULL,
    area TEXT NOT NULL,
    case_count INT DEFAULT 1,
    risk_level TEXT DEFAULT 'medium',
    actions_taken TEXT,
    status TEXT DEFAULT 'monitoring',
    reported_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.fertility_records (
    id TEXT PRIMARY KEY,
    mother_name TEXT NOT NULL,
    household_id TEXT,
    address TEXT,
    status TEXT DEFAULT 'pregnant',
    expected_due_date DATE,
    birth_date DATE,
    child_name TEXT,
    child_gender TEXT,
    is_third_child_plus BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epidemic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertility_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users or public
CREATE POLICY "Allow public access to health_records" ON public.health_records FOR ALL USING (true);
CREATE POLICY "Allow public access to vaccination_campaigns" ON public.vaccination_campaigns FOR ALL USING (true);
CREATE POLICY "Allow public access to epidemic_reports" ON public.epidemic_reports FOR ALL USING (true);
CREATE POLICY "Allow public access to fertility_records" ON public.fertility_records FOR ALL USING (true);
CREATE POLICY "Allow public access to emergency_contacts" ON public.emergency_contacts FOR ALL USING (true);
