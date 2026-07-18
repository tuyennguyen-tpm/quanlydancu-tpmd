-- ============================================================
-- MIGRATION TỔNG HỢP: Sửa CHECK constraint + Thêm cột mới
-- Chạy toàn bộ script này trên Supabase SQL Editor
-- ============================================================

-- BƯỚC 1: Xóa CHECK constraint cũ trên cột policy_type
ALTER TABLE households
  DROP CONSTRAINT IF EXISTS households_policy_type_check;

-- BƯỚC 2: Thêm CHECK constraint mới bao gồm đầy đủ các loại
ALTER TABLE households
  ADD CONSTRAINT households_policy_type_check
  CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family', 'martyr_family', 'meritorious_family'));

-- BƯỚC 3: Thêm các cột thông tin liệt sỹ (nếu chưa có)
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS martyr_name TEXT,
  ADD COLUMN IF NOT EXISTS martyr_object_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder_cccd TEXT,
  ADD COLUMN IF NOT EXISTS martyr_relation TEXT;

-- BƯỚC 4: Thêm các cột phụ khác (nếu chưa có)
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS fire_safety_group TEXT,
  ADD COLUMN IF NOT EXISTS self_management_group TEXT,
  ADD COLUMN IF NOT EXISTS ward_id TEXT;

-- Xác nhận thành công
SELECT 'Migration hoàn thành thành công!' AS result;
