-- ─── MIGRATION: CẬP NHẬT QUYỀN ĐỌC BẢNG APP_CONFIG CHO TÀI KHOẢN ĐÃ ĐĂNG NHẬP ───
-- Cho phép cả tài khoản đã đăng nhập (authenticated) và chưa đăng nhập (anon) được đọc cấu hình dùng chung từ bảng app_config

DROP POLICY IF EXISTS "Allow public read app_config" ON public.app_config;

CREATE POLICY "Allow public read app_config" ON public.app_config 
FOR SELECT 
TO authenticated, anon 
USING (true);

-- Thông báo chạy thành công
SELECT 'Cập nhật chính sách RLS cho bảng app_config thành công!' AS result;
