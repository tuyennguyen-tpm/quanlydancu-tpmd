-- ============================================================
-- MIGRATION: Thêm cột status vào bảng households
-- Chạy script này trên Supabase SQL Editor để cập nhật DB
-- ============================================================

-- 1. Thêm cột status với mặc định là 'active'
ALTER TABLE households 
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'moved_out')) DEFAULT 'active';

-- 2. Đảm bảo tất cả các hộ hiện tại có giá trị mặc định là 'active' nếu cột vừa được tạo
UPDATE households 
  SET status = 'active' 
  WHERE status IS NULL;
