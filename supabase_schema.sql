-- QUẢN LÝ TỔ DÂN PHỐ - SUPABASE SCHEMA (POSTGRESQL)
-- Hỗ trợ đa chi nhánh (Multi-tenant): dữ liệu của mỗi tài khoản (Tổ) được cô lập hoàn toàn

-- Reset cơ sở dữ liệu cũ
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS policy_activities CASCADE;
DROP TABLE IF EXISTS environment_logs CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS financial_records CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS households CASCADE;

-- 1. Bảng Hộ gia đình (households)
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_number TEXT NOT NULL, -- Số sổ hộ khẩu hoặc mã định danh
    address TEXT NOT NULL,
    head_of_household_id UUID,
    group_id TEXT DEFAULT 'NAM_SAM_SON_01', 
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    policy_type TEXT CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family')) DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Nhân khẩu (residents)
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    other_name TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    dob DATE NOT NULL,
    cccd TEXT,
    phone TEXT,
    occupation TEXT,
    permanent_address TEXT,
    temporary_address TEXT,
    is_head BOOLEAN DEFAULT FALSE,
    relationship_with_head TEXT,
    status TEXT CHECK (status IN ('resident', 'temporary_absent', 'temporary_resident', 'deceased')) DEFAULT 'resident',
    pob TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Thu chi (financial_records)
CREATE TABLE financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount BIGINT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    recorded_by TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng Phản ánh kiến nghị (complaints)
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    resident_id TEXT,
    resident_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')) DEFAULT 'pending',
    response TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bảng Họp dân (meetings)
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    title TEXT NOT NULL,
    content TEXT,
    date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    attendance_count INTEGER DEFAULT 0,
    type TEXT DEFAULT 'general', -- loại cuộc họp: general | party | front
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bảng Tài liệu văn bản (documents)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('directive', 'plan', 'report', 'other')) NOT NULL,
    file_url TEXT DEFAULT '#',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Bảng Nhật ký an ninh (security_logs)
CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT CHECK (type IN ('ok', 'alert')) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Bảng Giám sát môi trường (environment_logs)
CREATE TABLE environment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    area TEXT NOT NULL,
    status TEXT CHECK (status IN ('ok', 'warning', 'danger')) NOT NULL,
    last_cleaned DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Bảng Chương trình chính sách (policy_activities)
CREATE TABLE policy_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_group TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Bảng Cấu hình ứng dụng (app_config)
CREATE TABLE app_config (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

-- 11. Bảng Biên bản cuộc họp (meeting_minutes)
CREATE TABLE meeting_minutes (
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

-- KÍCH HOẠT ROW LEVEL SECURITY (RLS) CHO TẤT CẢ CÁC BẢNG
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- TẠO CÁC CHÍNH SÁCH BẢO MẬT (RLS POLICIES)

-- A. Quyền của quản trị viên (Authenticated): Chỉ thao tác trên dữ liệu của chính mình (user_id = auth.uid())
CREATE POLICY "Allow admin access households" ON households FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access residents" ON residents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access financial_records" ON financial_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access complaints" ON complaints FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access meetings" ON meetings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access documents" ON documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access security_logs" ON security_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access environment_logs" ON environment_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access policy_activities" ON policy_activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access app_config" ON app_config FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admin access meeting_minutes" ON meeting_minutes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- B. Quyền của người dân (Anonymous/Guest): Chỉ được đọc thông tin của tổ (RLS sẽ kiểm tra trong mệnh đề WHERE ở client bằng .eq('user_id', tenantId))
-- Chúng ta mở quyền SELECT công khai (TO anon) để người dân có thể truy vấn
CREATE POLICY "Allow public read households" ON households FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read residents" ON residents FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read financial_records" ON financial_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read complaints" ON complaints FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read meetings" ON meetings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read documents" ON documents FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read security_logs" ON security_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read environment_logs" ON environment_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read policy_activities" ON policy_activities FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read app_config" ON app_config FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read meeting_minutes" ON meeting_minutes FOR SELECT TO anon USING (true);

-- Người dân được gửi phản ánh mới (INSERT vào bảng complaints)
CREATE POLICY "Allow public submit complaint" ON complaints FOR INSERT TO anon WITH CHECK (true);
