-- ═══════════════════════════════════════════════════════════
-- MIGRATION: BỔ SUNG TRƯỜNG THÔNG TIN NGÀY CẤP CCCD CHO NHÂN KHẨU
-- Chạy file này trong Supabase SQL Editor để cập nhật CSDL
-- ═══════════════════════════════════════════════════════════

ALTER TABLE residents 
  ADD COLUMN IF NOT EXISTS cccd_issue_date DATE;
