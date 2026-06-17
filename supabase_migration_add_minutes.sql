-- MIGRATION: Thêm cột type cho bảng meetings và tạo bảng meeting_minutes mới
-- Chạy script này trong Supabase SQL Editor

-- 1. Đảm bảo bảng meetings có cột type để phân biệt loại cuộc họp
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
UPDATE meetings SET type = 'general' WHERE type IS NULL;

-- 2. Tạo bảng meeting_minutes mới
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    chairman TEXT NOT NULL,
    secretary TEXT NOT NULL,
    attendance INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Kích hoạt Row Level Security (RLS)
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- 4. Tạo chính sách bảo mật RLS
DROP POLICY IF EXISTS "Allow admin access meeting_minutes" ON meeting_minutes;
CREATE POLICY "Allow admin access meeting_minutes" ON meeting_minutes 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public read meeting_minutes" ON meeting_minutes;
CREATE POLICY "Allow public read meeting_minutes" ON meeting_minutes 
    FOR SELECT TO anon 
    USING (true);
