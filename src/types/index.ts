export type Role = 'admin' | 'leader' | 'deputy' | 'officer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  group_id: string;
}

export interface Household {
  id: string;
  household_number: string; // Số sổ hộ khẩu (nếu còn dùng) hoặc mã định danh hộ
  address: string;
  head_of_household_id: string | null;
  group_id: string;
  latitude?: number;
  longitude?: number;
  policy_type: 'none' | 'poor' | 'near_poor' | 'policy_family';
  created_at: string;
}

export interface Resident {
  id: string;
  household_id: string;
  full_name: string;
  other_name?: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  cccd: string;
  phone?: string;
  occupation?: string;
  permanent_address: string;
  temporary_address?: string;
  is_head: boolean;
  relationship_with_head: string;
  is_senior: boolean; // Tự động tính toán dựa trên năm sinh
  status: 'resident' | 'temporary_absent' | 'temporary_resident' | 'deceased';
  pob?: string; // Nơi sinh
  notes?: string; // Ghi chú
  created_at: string;
}

export interface FinancialRecord {
  id: string;
  group_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  recorded_by: string;
  date: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  resident_id: string;
  resident_name: string;
  content: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  response?: string;
  date: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  group_id: string;
  title: string;
  content: string;
  date: string;
  location: string;
  attendance_count: number;
  created_at: string;
  type?: 'general' | 'party' | 'front';
}

export interface Document {
  id: string;
  group_id: string;
  title: string;
  type: 'directive' | 'plan' | 'report' | 'other';
  file_url: string;
  uploaded_at: string;
}

export interface PolicyActivity {
  id: string;
  title: string;
  desc: string;
  targetGroup: string;
  date: string;
  created_at?: string;
}

