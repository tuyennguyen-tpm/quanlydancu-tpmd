-- ══════════════════════════════════════════════════════════════════════════════
-- BẬT ĐỒNG BỘ THỜI GIAN THỰC (REALTIME 0MS) TẤT CẢ CÁC BẢNG CHO MỌI MÁY TÍNH
-- Chạy script này trong Supabase SQL Editor để giải quyết triệt để lỗi các máy khác chưa tự đồng bộ
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Bật REPLICA IDENTITY FULL để Postgres phát đầy đủ dữ liệu khi có Sửa/Thêm/Xóa
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
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 2. Mở quyền RLS cho phép tất cả các tài khoản nhận Realtime và chia sẻ dữ liệu chung của Tổ
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
    EXECUTE format('DROP POLICY IF EXISTS "Allow admin access %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated access %I" ON public.%I', tbl, tbl);
    
    EXECUTE format('CREATE POLICY "Allow authenticated access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow public read %I" ON public.%I FOR SELECT TO anon USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- 3. Thêm tất cả các bảng vào Supabase Realtime Publication
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
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
