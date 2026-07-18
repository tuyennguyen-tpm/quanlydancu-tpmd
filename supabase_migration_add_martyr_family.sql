-- MIGRATION: Thêm diện chính sách 'martyr_family' (Gia đình liệt sỹ 27/07) cho Hộ gia đình
-- Hãy copy toàn bộ nội dung tệp này, dán vào mục SQL Editor trên Supabase Dashboard và nhấn Run.

-- 1. Xóa ràng buộc check cũ đối với cột policy_type trong bảng households (nếu có)
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_policy_type_check;

-- 2. Tạo ràng buộc check mới bổ sung giá trị 'martyr_family'
ALTER TABLE households ADD CONSTRAINT households_policy_type_check CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family', 'martyr_family'));

-- Ghi chú: Dữ liệu cũ không bị ảnh hưởng.
