-- ===================================================================
-- SCRIPT BẬT TÍNH NĂNG REALTIME (ĐỒNG BỘ THỜI GIAN THỰC) TRÊN SUPABASE
-- Chạy script này trong phần SQL Editor của Supabase Dashboard nếu chưa bật
-- ===================================================================

-- Thêm các bảng chính vào publication supabase_realtime
BEGIN;
  -- Kiểm tra và tạo publication nếu chưa có
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  -- Bổ sung các bảng vào Realtime Publication
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.households;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.residents;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.ward_funds;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.household_funds;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.financial_records;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.complaints;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.meetings;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.meeting_minutes;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.documents;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.security_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.environment_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.policy_activities;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.party_members;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.party_meetings;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.party_evaluations;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.party_fees;
  ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.app_config;
COMMIT;
