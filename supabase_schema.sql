-- QUẢN LÝ TỔ DÂN PHỐ - SUPABASE SCHEMA (POSTGRESQL)

-- 1. Bảng Hộ gia đình (households)
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_number TEXT UNIQUE, -- Số sổ hộ khẩu hoặc mã định danh
    address TEXT NOT NULL,
    group_id TEXT DEFAULT 'NAM_SAM_SON_01', 
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    policy_type TEXT CHECK (policy_type IN ('none', 'poor', 'near_poor', 'policy_family')) DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Nhân khẩu (residents)
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    other_name TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    dob DATE NOT NULL,
    cccd TEXT UNIQUE,
    phone TEXT,
    occupation TEXT,
    permanent_address TEXT,
    temporary_address TEXT,
    is_head BOOLEAN DEFAULT FALSE,
    relationship_with_head TEXT,
    status TEXT CHECK (status IN ('resident', 'temporary_absent', 'temporary_resident', 'deceased')) DEFAULT 'resident',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Thu chi (financial_records)
CREATE TABLE financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    title TEXT NOT NULL,
    content TEXT,
    date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    attendance_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE RLS (Row Level Security)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Tạo Policy đơn giản (Cho phép mọi người dùng đã đăng nhập có quyền xem và sửa - có thể tùy chỉnh thêm)
CREATE POLICY "Allow authorized access" ON households FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON residents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON financial_records FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON complaints FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON meetings FOR ALL USING (auth.role() = 'authenticated');

-- 6. Bảng Tài liệu văn bản (documents)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id TEXT DEFAULT 'NAM_SAM_SON_01',
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('directive', 'plan', 'report', 'other')) NOT NULL,
    file_url TEXT DEFAULT '#',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Bảng Nhật ký an ninh (security_logs)
CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT CHECK (type IN ('ok', 'alert')) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Bảng Giám sát môi trường (environment_logs)
CREATE TABLE environment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area TEXT NOT NULL,
    status TEXT CHECK (status IN ('ok', 'warning', 'danger')) NOT NULL,
    last_cleaned DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Bảng Chương trình chính sách (policy_activities)
CREATE TABLE policy_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_group TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE RLS (Row Level Security) FOR NEW TABLES
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_activities ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho các bảng mới
CREATE POLICY "Allow authorized access" ON documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON security_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON environment_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authorized access" ON policy_activities FOR ALL USING (auth.role() = 'authenticated');

-- 10. Bảng Cấu hình ứng dụng (app_config)
-- Bảng này dùng để lưu trữ các cấu hình toàn cục như mã PIN truy cập công khai
-- Cần TEXT primary key (không phải UUID) và cho phép truy cập công khai
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Không cần RLS cho bảng config - cho phép đọc/ghi công khai
-- (mã PIN không phải dữ liệu bí mật cấp cao, chỉ để phân biệt người dùng thường)
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Thêm mã PIN mặc định
INSERT INTO app_config (key, value) VALUES ('guest_pin', '1234')
ON CONFLICT (key) DO NOTHING;
