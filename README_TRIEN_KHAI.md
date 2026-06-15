# HƯỚNG DẪN TRIỂN KHAI PHẦN MỀM QUẢN LÝ TỔ DÂN PHỐ

Dự án này được thiết kế để sử dụng thực tế cho Tổ dân phố tại Nam Sầm Sơn, Thanh Hóa.

## 1. Yêu cầu hệ thống
- Tài khoản [Supabase](https://supabase.com/) (Miễn phí) để lưu trữ cơ sở dữ liệu và xác thực.
- Tài khoản [Vercel](https://vercel.com/) hoặc [Netlify](https://www.netlify.com/) (Miễn phí) để đưa phần mềm lên chạy trực tuyến.

## 2. Thiết lập Cơ sở dữ liệu (Supabase)
1. Truy cập Supabase, tạo Project mới.
2. Vào mục **SQL Editor**, copy toàn bộ nội dung trong tệp `supabase_schema.sql` và nhấn **Run**.
3. Vào mục **Settings > API**, copy `Project URL` và `anon key`.

## 3. Cấu hình Ứng dụng
1. Tạo tệp `.env` tại thư mục gốc của dự án với nội dung:
   ```
   VITE_SUPABASE_URL=đường_dẫn_url_của_bạn
   VITE_SUPABASE_ANON_KEY=key_của_bạn
   ```
2. Cài đặt thư viện: `npm install`
3. Chạy thử máy local: `npm run dev`

## 4. Đưa lên Internet (Deployment)
1. Đẩy mã nguồn lên GitHub.
2. Kết nối GitHub với Vercel.
3. Trong phần cấu hình biến môi trường trên Vercel, thêm 2 biến đã tạo ở bước 3.
4. Nhấn **Deploy**.

## 5. Hướng dẫn sử dụng cho người lớn tuổi
- Giao diện đã được thiết kế font chữ to, rõ ràng.
- Sử dụng menu bên trái để chuyển đổi giữa các chức năng.
- Tính năng **Trợ lý AI** giúp soạn thảo thông báo nhanh chóng.
- Tính năng **Bản đồ** giúp quản lý địa bàn trực quan.

---
*Phát triển bởi Trợ lý AI cao cấp - 2026*
