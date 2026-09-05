-- ==============================================================================
-- TOÀN BỘ CƠ SỞ DỮ LIỆU CSDL TỔ DÂN PHỐ QUẢNG GIAO (BẢN CHUẨN ĐẦY ĐỦ 2026)
-- Chạy 1 lần duy nhất trong Supabase SQL Editor của Project mới
-- ==============================================================================

-- 1. Bật Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Bảng Phường / Tổ (wards)
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Hộ gia đình (households)
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_number TEXT NOT NULL,
    address TEXT NOT NULL,
    head_of_household_id UUID,
    group_id TEXT DEFAULT 'NAM_SAM_SON_01', 
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    policy_type TEXT CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family')) DEFAULT 'none',
    status TEXT DEFAULT 'resident',
    martyr_name TEXT,
    martyr_details TEXT,
    meritorious_details TEXT,
    fire_safety_group TEXT,
    self_management_group TEXT,
    moved_out_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng Nhân khẩu (residents)
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    other_name TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    dob DATE NOT NULL,
    cccd TEXT,
    phone TEXT,
    occupation TEXT,
    permanent_address TEXT,
    temporary_address TEXT,
    is_head BOOLEAN DEFAULT FALSE,
    relationship_with_head TEXT,
    status TEXT CHECK (status IN ('resident', 'temporary_absent', 'temporary_resident', 'deceased', 'stay')) DEFAULT 'resident',
    pob TEXT,
    native_place TEXT,
    ethnicity TEXT DEFAULT 'Kinh',
    religion TEXT DEFAULT 'Không',
    nationality TEXT DEFAULT 'Việt Nam',
    education_level TEXT,
    military_service TEXT DEFAULT 'none',
    health_insurance_number TEXT,
    has_health_insurance BOOLEAN DEFAULT TRUE,
    temporary_residence_expiry DATE,
    association_membership TEXT,
    party_member BOOLEAN DEFAULT FALSE,
    party_joined_date DATE,
    party_official_date DATE,
    party_card_number TEXT,
    party_position TEXT,
    party_group TEXT,
    healthcare_type TEXT,
    health_notes TEXT,
    death_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Liên kết head_of_household_id vào residents
ALTER TABLE households 
    DROP CONSTRAINT IF EXISTS fk_head_of_household;
ALTER TABLE households 
    ADD CONSTRAINT fk_head_of_household FOREIGN KEY (head_of_household_id) REFERENCES residents(id) ON DELETE SET NULL;

-- 5. Bảng Thu chi (financial_records)
CREATE TABLE IF NOT EXISTS financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    household_name TEXT,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount BIGINT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    recorded_by TEXT,
    date DATE DEFAULT CURRENT_DATE,
    ward_fund_id UUID,
    fund_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bảng Quỹ Tổ dân phố theo Hộ (household_funds)
CREATE TABLE IF NOT EXISTS household_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    fund_name TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    paid_at DATE DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id, year, fund_name)
);

-- 7. Bảng Quỹ Phường vận động (ward_funds)
CREATE TABLE IF NOT EXISTS ward_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    fund_name TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    paid_at DATE DEFAULT CURRENT_DATE,
    note TEXT,
    household_name TEXT,
    address TEXT,
    group_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Bảng Vận động tài trợ (sponsors)
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    title TEXT,
    amount BIGINT NOT NULL DEFAULT 0,
    fund_name TEXT NOT NULL,
    year INTEGER NOT NULL DEFAULT 2026,
    date DATE DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Bảng Phản ánh kiến nghị (complaints)
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    resident_id TEXT,
    resident_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')) DEFAULT 'pending',
    response TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Bảng Họp dân (meetings)
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    attendance_count INTEGER DEFAULT 0,
    type TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Bảng Biên bản cuộc họp (meeting_minutes)
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    meeting_title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_time TEXT,
    meeting_location TEXT,
    chairperson TEXT,
    secretary TEXT,
    attendees_count INTEGER DEFAULT 0,
    opening_remarks TEXT,
    discussion_points TEXT,
    voting_items TEXT,
    conclusion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Bảng Tài liệu văn bản (documents)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('directive', 'plan', 'report', 'other')) NOT NULL,
    file_url TEXT NOT NULL,
    upload_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Bảng An ninh trật tự (security_logs)
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    type TEXT CHECK (type IN ('ok', 'alert')) DEFAULT 'ok',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Bảng Vệ sinh môi trường (environment_logs)
CREATE TABLE IF NOT EXISTS environment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    area TEXT NOT NULL,
    status TEXT CHECK (status IN ('ok', 'warning', 'danger')) DEFAULT 'ok',
    last_cleaned DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Bảng Hoạt động chính sách (policy_activities)
CREATE TABLE IF NOT EXISTS policy_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    beneficiary_group TEXT,
    budget BIGINT DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('planned', 'ongoing', 'completed')) DEFAULT 'planned',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Bảng Chi bộ Đảng (party_members, party_meetings, party_evaluations, party_fees)
CREATE TABLE IF NOT EXISTS party_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    party_code TEXT,
    party_group TEXT,
    join_date DATE,
    probation_date DATE,
    position TEXT DEFAULT 'member',
    status TEXT DEFAULT 'official' CHECK (status IN ('official', 'probation', 'inactive', 'party_213')),
    is_exempt_party_activities BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT,
    location TEXT,
    content TEXT,
    attendance_count INTEGER DEFAULT 0,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    member_id UUID NOT NULL REFERENCES party_members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('excellent', 'good', 'average', 'weak')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, year)
);

CREATE TABLE IF NOT EXISTS party_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    member_id UUID NOT NULL REFERENCES party_members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount BIGINT NOT NULL DEFAULT 10000,
    paid_at DATE,
    note TEXT,
    UNIQUE(member_id, year, month)
);

-- 17. Bảng Cấu hình ứng dụng (app_config)
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Khởi tạo Phường Quảng Giao mặc định
INSERT INTO wards (name) VALUES ('Quảng Giao') ON CONFLICT (name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- BẬT ROW LEVEL SECURITY (RLS) & CHÍNH SÁCH TRUY CẬP AN TOÀN
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  tbl_list TEXT[] := ARRAY[
    'wards', 'households', 'residents', 'ward_funds', 'household_funds',
    'financial_records', 'sponsors', 'party_members', 'party_meetings',
    'party_evaluations', 'party_fees', 'complaints', 'meetings',
    'meeting_minutes', 'documents', 'security_logs', 'environment_logs',
    'policy_activities', 'app_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read %I" ON public.%I', tbl, tbl);
    
    EXECUTE format('CREATE POLICY "Allow authenticated access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow public read %I" ON public.%I FOR SELECT TO anon USING (true)', tbl, tbl);
    
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
