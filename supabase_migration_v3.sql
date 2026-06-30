-- ═══════════════════════════════════════════════════════════
-- MIGRATION V3: NÂNG CẤP DÂN CƯ, CHI BỘ ĐẢNG & QUẢN LÝ THU QUỸ
-- Chạy file này trong Supabase SQL Editor để cập nhật CSDL
-- ═══════════════════════════════════════════════════════════

-- 1. Cập nhật bảng nhân khẩu (residents) với các trường thông tin hành chính
ALTER TABLE residents 
  ADD COLUMN IF NOT EXISTS native_place TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity TEXT DEFAULT 'Kinh',
  ADD COLUMN IF NOT EXISTS religion TEXT DEFAULT 'Không',
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Việt Nam',
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS military_service TEXT DEFAULT 'none' CHECK (military_service IN ('in_age', 'serving', 'completed', 'exempted', 'none')),
  ADD COLUMN IF NOT EXISTS health_insurance_number TEXT,
  ADD COLUMN IF NOT EXISTS has_health_insurance BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS temporary_residence_expiry DATE,
  ADD COLUMN IF NOT EXISTS association_membership TEXT;

-- 2. Cập nhật bảng chi bộ đảng (party_members) cho Đảng viên 213 và miễn sinh hoạt
ALTER TABLE party_members
  ADD COLUMN IF NOT EXISTS is_exempt_party_activities BOOLEAN DEFAULT FALSE;

-- Cập nhật check constraint cho cột status để hỗ trợ 'party_213'
ALTER TABLE party_members DROP CONSTRAINT IF EXISTS party_members_status_check;
ALTER TABLE party_members ADD CONSTRAINT party_members_status_check CHECK (status IN ('official', 'probation', 'inactive', 'party_213'));

-- 3. Tạo bảng quản lý thu các loại Quỹ TDP theo Hộ gia đình (household_funds)
CREATE TABLE IF NOT EXISTS household_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    fund_name TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    paid_at DATE DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id, year, fund_name)
);

-- Kích hoạt RLS bảo mật cho bảng household_funds
ALTER TABLE household_funds ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật cho bảng household_funds
DROP POLICY IF EXISTS "Allow admin access household_funds" ON household_funds;
CREATE POLICY "Allow admin access household_funds" ON household_funds FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public read household_funds" ON household_funds;
CREATE POLICY "Allow public read household_funds" ON household_funds FOR SELECT TO anon USING (true);
