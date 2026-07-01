-- ═══════════════════════════════════════════════════════════
-- MIGRATION: BỔ SUNG TRƯỜNG THÔNG TIN NGÀY MẤT CHO NHÂN KHẨU
-- Chạy file này trong Supabase SQL Editor để cập nhật CSDL
-- ═══════════════════════════════════════════════════════════

ALTER TABLE residents 
  ADD COLUMN IF NOT EXISTS death_date DATE;
