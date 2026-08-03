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
  policy_type: 'none' | 'poor' | 'near_poor' | 'policy_family' | 'martyr_family' | 'meritorious_family';
  fire_safety_group?: string; // Tổ liên gia an toàn PCCC
  self_management_group?: string; // Tổ tự quản
  status?: 'active' | 'moved_out';
  created_at: string;
  user_id?: string;
  ward_id?: string;

  // Thông tin Gia đình liệt sỹ 27/07
  martyr_name?: string;               // Họ và tên liệt sỹ
  martyr_object_type?: string;        // Loại đối tượng (Bố/Mẹ/Con/Vợ/Chồng liệt sỹ...)
  bank_account_number?: string;       // Số tài khoản ngân hàng
  bank_name?: string;                 // Tên ngân hàng
  bank_account_holder?: string;       // Họ và tên người đứng tên tài khoản
  bank_account_holder_cccd?: string;  // Số CCCD người đứng tên tài khoản
  martyr_relation?: string;           // Mối quan hệ với liệt sỹ
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
  status: 'resident' | 'temporary_absent' | 'temporary_resident' | 'deceased' | 'stay';
  pob?: string; // Nơi sinh
  notes?: string; // Ghi chú
  death_date?: string;
  created_at: string;
  
  // Các trường thông tin hành chính Việt Nam mới bổ sung
  native_place?: string;
  ethnicity?: string;
  religion?: string;
  nationality?: string;
  education_level?: string;
  military_service?: 'in_age' | 'serving' | 'completed' | 'exempted' | 'none';
  health_insurance_number?: string;
  has_health_insurance?: boolean;
  temporary_residence_expiry?: string;
  association_membership?: string; // ngăn cách bởi dấu phẩy, ví dụ: 'nct,ccb'
  user_id?: string;
  ward_id?: string;
}

export interface FinancialRecord {
  id: string;
  group_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  recorded_by: string;
  payer?: string;
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

export interface MeetingMinutesData {
  id: string;
  meeting_id: string | null;
  title: string;
  date: string;
  time: string;
  location: string;
  chairman: string;
  secretary: string;
  attendance: number;
  content: string;
  created_at: string;
}

export interface HouseholdFund {
  id: string;
  household_id: string;
  year: number;
  fund_name: string;
  amount: number;
  paid_at?: string;
  note?: string;
  created_at?: string;
}

export interface WardFundContribution {
  expected: number;
  actual: number;
  date?: string;
  is_manual_exempt?: boolean;
  is_manual_target?: boolean;
}

export interface WardFund {
  id: string;
  user_id?: string;
  year: number;
  full_name: string;
  dob?: string;
  address?: string;
  contributions: Record<string, WardFundContribution>; // Key là tên quỹ (Ví dụ: "Quỹ phòng chống thiên tai")
  note?: string;
  created_at?: string;
}

export interface WardDocument {
  id: string;
  title: string;
  summary?: string;
  file_url?: string;
  file_name?: string;
  target_scope: 'all' | 'specific';
  target_tdps?: string[]; // Danh sách các TDP nhận nếu target_scope = 'specific'
  category: 'party' | 'leader' | 'front'; // Đảng, Tổ trưởng, Mặt trận
  sender_name?: string;
  is_read: boolean; // Trạng thái đã xem của tài khoản TDP hiện tại
  created_at: string;
  read_by_tdps?: { tdp_name: string; read_at: string }[];
}

export interface HealthRecord {
  id: string;
  resident_id: string;
  resident_name: string;
  dob?: string;
  gender?: string;
  household_number?: string;
  address?: string;
  phone?: string;
  group_id?: string;
  
  // Bảo hiểm y tế
  has_bhyt: boolean;
  bhyt_number?: string;
  bhyt_expiry?: string;
  
  // Bệnh nền / Mãn tính & Sức khỏe đặc biệt
  chronic_diseases: string[]; // e.g. ['Huyết áp cao', 'Tiểu đường', 'Tim mạch']
  is_disabled: boolean;
  disability_type?: string;
  mental_health_issue?: boolean;
  health_status_note?: string;
  
  updated_at: string;
}

export interface VaccinationCampaign {
  id: string;
  campaign_name: string;
  vaccine_type: string;
  target_audience: string; // e.g. "Trẻ em 0-5 tuổi", "Người trên 65 tuổi"
  start_date: string;
  end_date: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  total_target: number;
  total_completed: number;
  notes?: string;
  created_at: string;
}

export interface EpidemicReport {
  id: string;
  disease_name: string; // e.g. "Sốt xuất huyết", "Tay chân miệng", "COVID-19"
  area: string; // Cụm/Tổ hoặc số nhà
  case_count: number;
  risk_level: 'low' | 'medium' | 'high' | 'danger';
  actions_taken: string; // e.g. "Phun hóa chất diệt muỗi ngày 10/06"
  status: 'monitoring' | 'contained' | 'resolved';
  reported_date: string;
}

export interface FertilityRecord {
  id: string;
  mother_name: string;
  household_id?: string;
  address: string;
  status: 'pregnant' | 'given_birth';
  expected_due_date?: string;
  birth_date?: string;
  child_name?: string;
  child_gender?: 'male' | 'female';
  is_third_child_plus: boolean; // Sinh con thứ 3 trở lên
  notes?: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  role: string; // e.g. "Bác sĩ phụ trách TDP", "Trạm Y tế Phường", "Xe cấp cứu"
  phone: string;
  address?: string;
  notes?: string;
}


