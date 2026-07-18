-- ============================================================
-- MIGRATION: Thêm giá trị 'meritorious_family' vào cột policy_type
-- Chạy script này trên Supabase SQL Editor
-- ============================================================

-- Xóa constraint cũ (nếu có) và thêm constraint mới bao gồm 'meritorious_family'
ALTER TABLE households
  DROP CONSTRAINT IF EXISTS households_policy_type_check;

ALTER TABLE households
  ADD CONSTRAINT households_policy_type_check
  CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family', 'martyr_family', 'meritorious_family'));

-- Giải thích:
-- meritorious_family: Người có công / Thân nhân liệt sỹ
