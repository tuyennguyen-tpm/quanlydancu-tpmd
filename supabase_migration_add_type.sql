-- MIGRATION: Thêm cột 'type' vào bảng meetings
-- Chạy script này trong Supabase SQL Editor nếu bảng meetings đã tồn tại

-- 1. Thêm cột type vào bảng meetings (nếu chưa có)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';

-- 2. Cập nhật dữ liệu cũ: tất cả cuộc họp chưa có type sẽ mặc định là 'general'
UPDATE meetings SET type = 'general' WHERE type IS NULL;
