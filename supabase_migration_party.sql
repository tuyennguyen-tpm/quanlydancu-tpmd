-- ═══════════════════════════════════════════════════════════
-- MIGRATION: MODULE QUẢN LÝ CHI BỘ ĐẢNG
-- Chạy file này trong Supabase SQL Editor để tạo 4 bảng mới
-- ═══════════════════════════════════════════════════════════

-- 1. Bảng Đảng viên (party_members)
DROP TABLE IF EXISTS party_fees CASCADE;
DROP TABLE IF EXISTS party_evaluations CASCADE;
DROP TABLE IF EXISTS party_meetings CASCADE;
DROP TABLE IF EXISTS party_members CASCADE;

CREATE TABLE party_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    party_code TEXT,
    party_group TEXT,
    join_date DATE,
    probation_date DATE,
    position TEXT DEFAULT 'member',
    status TEXT DEFAULT 'official' CHECK (status IN ('official', 'probation', 'inactive')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Sinh hoạt Chi bộ (party_meetings)
CREATE TABLE party_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT,
    location TEXT,
    content TEXT,
    attendance_count INTEGER DEFAULT 0,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Đánh giá Đảng viên hàng năm (party_evaluations)
CREATE TABLE party_evaluations (
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
CREATE TABLE party_fees (
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

-- ─── CHÍNH SÁCH BẢO MẬT (chỉ admin mới xem được - không public) ───
CREATE POLICY "Allow admin access party_members" ON party_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access party_meetings" ON party_meetings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access party_evaluations" ON party_evaluations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access party_fees" ON party_fees FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
