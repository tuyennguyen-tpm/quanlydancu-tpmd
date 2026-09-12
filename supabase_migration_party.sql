-- ═══════════════════════════════════════════════════════════
-- MIGRATION: MODULE QUẢN LÝ CHI BỘ ĐẢNG (CẬP NHẬT HOÀN THIỆN)
-- Chạy file này trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Bảng Đảng viên (party_members)
CREATE TABLE IF NOT EXISTS party_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    party_code TEXT,
    party_group TEXT,
    join_date DATE,
    probation_date DATE,
    position TEXT DEFAULT 'member',
    status TEXT DEFAULT 'official',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bổ sung các cột mở rộng cho đảng viên nếu chưa có
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS fee_category TEXT;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS salary_base BIGINT;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS wage_zone INTEGER;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS is_exempt_party_activities BOOLEAN DEFAULT FALSE;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE party_members ADD COLUMN IF NOT EXISTS party_group TEXT;

-- Nới lỏng ràng buộc trạng thái để hỗ trợ 'party_213', 'deceased'
ALTER TABLE party_members DROP CONSTRAINT IF EXISTS party_members_status_check;
ALTER TABLE party_members ADD CONSTRAINT party_members_status_check CHECK (status IN ('official', 'probation', 'inactive', 'party_213', 'deceased'));

-- 2. Bảng Sinh hoạt Chi bộ (party_meetings)
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
ALTER TABLE party_meetings ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;

-- 3. Bảng Đánh giá Đảng viên hàng năm (party_evaluations)
CREATE TABLE IF NOT EXISTS party_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    member_id UUID NOT NULL REFERENCES party_members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('excellent', 'good', 'average', 'weak')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, year)
);

-- 4. Bảng Thu đảng phí (party_fees)
CREATE TABLE IF NOT EXISTS party_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    member_id UUID NOT NULL REFERENCES party_members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount BIGINT NOT NULL DEFAULT 10000,
    paid_at DATE,
    note TEXT,
    UNIQUE(member_id, year, month)
);

-- ─── BẬT ROW LEVEL SECURITY ───
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_fees ENABLE ROW LEVEL SECURITY;

-- ─── CHÍNH SÁCH BẢO MẬT ───
DROP POLICY IF EXISTS "Allow admin access party_members" ON party_members;
CREATE POLICY "Allow admin access party_members" ON party_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin access party_meetings" ON party_meetings;
CREATE POLICY "Allow admin access party_meetings" ON party_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin access party_evaluations" ON party_evaluations;
CREATE POLICY "Allow admin access party_evaluations" ON party_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin access party_fees" ON party_fees;
CREATE POLICY "Allow admin access party_fees" ON party_fees FOR ALL TO authenticated USING (true) WITH CHECK (true);
