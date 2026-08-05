-- Migration bổ sung giá trị 'moved_out' cho ràng buộc status trong bảng residents của Supabase

ALTER TABLE residents DROP CONSTRAINT IF EXISTS residents_status_check;
ALTER TABLE residents ADD CONSTRAINT residents_status_check CHECK (status IN ('resident', 'temporary_absent', 'temporary_resident', 'deceased', 'stay', 'moved_out'));
