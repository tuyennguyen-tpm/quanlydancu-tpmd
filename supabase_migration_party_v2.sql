-- ═══════════════════════════════════════════════════════════
-- MIGRATION V2: CẬP NHẬT MODULE CHI BỘ ĐẢNG
-- Thêm cột phân loại đảng phí theo Quy định 01-QĐ/TW (2026)
-- Chạy sau supabase_migration_party.sql
-- ═══════════════════════════════════════════════════════════

-- Thêm các cột vào party_members (nếu chưa có)
ALTER TABLE party_members 
  ADD COLUMN IF NOT EXISTS fee_category TEXT DEFAULT 'bhxh' 
    CHECK (fee_category IN ('bhxh', 'pension', 'no_bhxh_under_retire', 'no_bhxh_over_retire', 'student')),
  ADD COLUMN IF NOT EXISTS salary_base BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wage_zone INTEGER DEFAULT 3 CHECK (wage_zone IN (1,2,3,4));

-- Cập nhật party_fees: thêm cột fee_category_snapshot và calculated_amount
ALTER TABLE party_fees
  ADD COLUMN IF NOT EXISTS calculated_amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_exempted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exemption_reason TEXT;

-- Ghi chú:
-- fee_category:
--   'bhxh'                  => Đảng viên có BHXH bắt buộc: 1% lương BHXH
--   'pension'               => Hưởng lương hưu: 0.5% lương hưu
--   'no_bhxh_under_retire'  => Chưa đến tuổi hưu, không BHXH: 0.3% lương TT vùng (2026-27)
--   'no_bhxh_over_retire'   => Đủ tuổi hưu chưa hưởng: 0.2% lương TT vùng (2026-27)
--   'student'               => Học sinh/sinh viên: 5.000đ cố định
-- salary_base: Lương làm căn cứ (đồng/tháng) - tự nhập
-- wage_zone: Vùng lương tối thiểu (1=5.310k, 2=4.730k, 3=4.140k, 4=3.700k)
