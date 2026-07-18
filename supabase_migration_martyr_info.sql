-- ============================================================
-- MIGRATION: Thêm các cột thông tin liệt sỹ vào bảng households
-- Chạy script này trên Supabase SQL Editor
-- ============================================================

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS martyr_name TEXT,
  ADD COLUMN IF NOT EXISTS martyr_object_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder_cccd TEXT,
  ADD COLUMN IF NOT EXISTS martyr_relation TEXT;

-- Giải thích các cột:
-- martyr_name:              Họ và tên liệt sỹ
-- martyr_object_type:       Loại đối tượng (VD: Con liệt sỹ, Vợ liệt sỹ...)
-- bank_account_number:      Số tài khoản ngân hàng
-- bank_name:                Tên ngân hàng
-- bank_account_holder:      Họ và tên người đứng tên tài khoản
-- bank_account_holder_cccd: Số CCCD của người đứng tên tài khoản
-- martyr_relation:          Mối quan hệ của người nhận với liệt sỹ
