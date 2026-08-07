-- BẬT ĐỒNG BỘ THỜI GIAN THỰC (REALTIME) CHO TOÀN BỘ TẤT CẢ CÁC BẢNG CSDL HỆ THỐNG
-- Chạy đoạn SQL này trong Supabase SQL Editor (có thể ghi đè hoặc dán chạy lại thoải mái mà không lo báo lỗi trùng lặp)

DO $$
DECLARE
  tbl TEXT;
  tbl_list TEXT[] := ARRAY[
    'households', 'residents', 'ward_funds', 'household_funds',
    'financial_records', 'party_members', 'party_meetings', 'party_fees',
    'health_records', 'complaints', 'meetings', 'meeting_minutes',
    'documents', 'security_logs', 'environment_logs', 'policy_activities', 'app_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    EXCEPTION WHEN OTHERS THEN
      -- Tự động bỏ qua nếu bảng đó đã được thêm vào publication trước đó
      NULL;
    END;
  END LOOP;
END $$;


