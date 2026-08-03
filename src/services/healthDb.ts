import { supabase } from './db';
import type { HealthRecord, VaccinationCampaign, EpidemicReport, FertilityRecord, EmergencyContact } from '../types';

const STORAGE_KEYS = {
  HEALTH_RECORDS: 'tdp_health_records',
  VACCINATIONS: 'tdp_vaccination_campaigns',
  EPIDEMICS: 'tdp_epidemic_reports',
  FERTILITY: 'tdp_fertility_records',
  EMERGENCY: 'tdp_emergency_contacts',
};

// Dữ liệu mẫu ban đầu cho TDP Quảng Giao
const seedHealthRecords: HealthRecord[] = [
  {
    id: 'HR001',
    resident_id: 'R005',
    resident_name: 'Trần Thị Năm',
    dob: '1940-02-10',
    gender: 'female',
    household_number: 'HK-83921',
    address: 'Số 47, Nam Sầm Sơn, Thanh Hóa',
    phone: '0356789123',
    has_bhyt: true,
    bhyt_number: 'DN4380123456789',
    bhyt_expiry: '2026-12-31',
    chronic_diseases: ['Cao huyết áp', 'Xương khớp'],
    is_disabled: false,
    health_status_note: 'Khám định kỳ tại Trạm y tế hàng tháng, cấp thuốc huyết áp.',
    updated_at: '2026-06-01T08:00:00Z'
  },
  {
    id: 'HR002',
    resident_id: 'R009',
    resident_name: 'Hoàng Thị Lan',
    dob: '1946-12-30',
    gender: 'female',
    household_number: 'HK-50192',
    address: 'Số 53, Nam Sầm Sơn, Thanh Hóa',
    phone: '0944556677',
    has_bhyt: true,
    bhyt_number: 'HT4380987654321',
    bhyt_expiry: '2026-12-31',
    chronic_diseases: ['Tim mạch', 'Tiểu đường Tuýp 2'],
    is_disabled: false,
    health_status_note: 'Thương binh 4/4, cần theo dõi đường huyết định kỳ.',
    updated_at: '2026-05-15T09:30:00Z'
  },
  {
    id: 'HR003',
    resident_id: 'R006',
    resident_name: 'Trần Văn Cường',
    dob: '1972-03-15',
    gender: 'male',
    household_number: 'HK-83921',
    address: 'Số 47, Nam Sầm Sơn, Thanh Hóa',
    phone: '0909090909',
    has_bhyt: false,
    chronic_diseases: [],
    is_disabled: false,
    health_status_note: 'Lao động tự do, chưa tham gia BHYT hộ gia đình năm 2026. Đã gửi thông báo vận động.',
    updated_at: '2026-06-10T10:00:00Z'
  },
  {
    id: 'HR004',
    resident_id: 'R001',
    resident_name: 'Nguyễn Kim Tuyến',
    dob: '1965-05-12',
    gender: 'male',
    household_number: 'HK-99281',
    address: 'Số 45, Nam Sầm Sơn, Thanh Hóa',
    phone: '0912345678',
    has_bhyt: true,
    bhyt_number: 'GD4380556677889',
    bhyt_expiry: '2026-12-31',
    chronic_diseases: [],
    is_disabled: false,
    health_status_note: 'Sức khỏe tốt.',
    updated_at: '2026-01-10T08:00:00Z'
  }
];

const seedVaccinations: VaccinationCampaign[] = [
  {
    id: 'VAC001',
    campaign_name: 'Tiêm chủng mở rộng Quý 3/2026 cho Trẻ em (DPT, Sởi, Bại liệt)',
    vaccine_type: 'Vắc xin 5 trong 1 & Sởi - Rubella',
    target_audience: 'Trẻ em từ 2 tháng đến 5 tuổi trên địa bàn TDP',
    start_date: '2026-08-10',
    end_date: '2026-08-12',
    location: 'Trạm Y tế Phường Nam Sầm Sơn',
    status: 'upcoming',
    total_target: 28,
    total_completed: 0,
    notes: 'Yêu cầu phụ huynh mang theo Sổ tiêm chủng cá nhân của trẻ.',
    created_at: '2026-08-01T08:00:00Z'
  },
  {
    id: 'VAC002',
    campaign_name: 'Chiến dịch Uống vắc xin phòng Bại liệt vòng 1',
    vaccine_type: 'OPV',
    target_audience: 'Trẻ em dưới 36 tháng tuổi',
    start_date: '2026-06-01',
    end_date: '2026-06-02',
    location: 'Nhà Văn hóa Tổ dân phố Quảng Giao',
    status: 'completed',
    total_target: 22,
    total_completed: 22,
    notes: 'Đạt 100% chỉ tiêu được giao.',
    created_at: '2026-05-20T08:00:00Z'
  }
];

const seedEpidemicReports: EpidemicReport[] = [
  {
    id: 'EPI001',
    disease_name: 'Giám sát dịch Sốt xuất huyết Dengue',
    area: 'Ngõ 47 & Ngõ 49, TDP Quảng Giao',
    case_count: 1,
    risk_level: 'medium',
    actions_taken: 'Đã tổng vệ sinh môi trường, lật úp dụng cụ chứa nước, phát động Ngày Chủ Nhật Xanh và phun hóa chất diệt muỗi ngày 25/07.',
    status: 'monitoring',
    reported_date: '2026-07-22'
  }
];

const seedFertilityRecords: FertilityRecord[] = [
  {
    id: 'FER001',
    mother_name: 'Nguyễn Thị Hoa',
    household_id: 'H003',
    address: 'Số 49, Nam Sầm Sơn, Thanh Hóa',
    status: 'pregnant',
    expected_due_date: '2026-10-15',
    is_third_child_plus: false,
    notes: 'Mang thai con thứ 2, đã khám thai định kỳ đợt 3 tại Bệnh viện Đa khoa.',
    created_at: '2026-04-10T08:00:00Z'
  },
  {
    id: 'FER002',
    mother_name: 'Lê Thị Mai',
    household_id: 'H001',
    address: 'Số 45, Nam Sầm Sơn, Thanh Hóa',
    status: 'given_birth',
    birth_date: '2026-05-18',
    child_name: 'Lê Minh An',
    child_gender: 'male',
    is_third_child_plus: false,
    notes: 'Bé khỏe mạnh, đã đăng ký khai sinh và làm thẻ BHYT trẻ em dưới 6 tuổi.',
    created_at: '2026-05-20T08:00:00Z'
  }
];

const seedEmergencyContacts: EmergencyContact[] = [
  {
    id: 'EMG001',
    name: 'Trạm Y tế Phường Nam Sầm Sơn',
    role: 'Cơ sở Y tế tuyến Phường',
    phone: '0237 3835 115',
    address: 'Đường Nam Sầm Sơn, Phường Nam Sầm Sơn, TP. Sầm Sơn, Thanh Hóa',
    notes: 'Trực 24/7, tiếp nhận sơ cấp cứu ban đầu & khám BHYT.'
  },
  {
    id: 'EMG002',
    name: 'BS. Nguyễn Văn Hùng',
    role: 'Bác sĩ phụ trách y tế địa bàn TDP',
    phone: '0915 234 567',
    notes: 'Tư vấn sức khỏe cộng đồng & hỗ trợ khám tận nhà cho người cao tuổi nặng.'
  },
  {
    id: 'EMG003',
    name: 'Cấp cứu 115 / BV Đa khoa TP. Sầm Sơn',
    role: 'Tuyến Cấp cứu Tối khẩn cấp',
    phone: '115 / 0237 3835 999',
    address: 'TP. Sầm Sơn, Tỉnh Thanh Hóa',
    notes: 'Điều xe cấp cứu lưu động khi có ca bệnh nặng hoặc sự cố tai nạn.'
  },
  {
    id: 'EMG004',
    name: 'Bà Lê Thị Dung',
    role: 'Cộng tác viên Y tế & Dân số TDP',
    phone: '0987 654 321',
    address: 'Số 45 Nam Sầm Sơn',
    notes: 'Phụ trách theo dõi BHYT, tiêm chủng và phát thuốc người cao tuổi TDP.'
  }
];

// Helper functions for LocalStorage
const getStoredData = <T>(key: string, fallback: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    // Nếu dữ liệu local lưu cũ bị lỗi phông, tự động reset về fallback UTF8 chuẩn
    if (raw.includes('áº') || raw.includes('Æ°') || raw.includes('Ã¢')) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return parsed;
  } catch (err) {
    console.error(`Lỗi đọc ${key} từ localStorage:`, err);
    return fallback;
  }
};

const setStoredData = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Lỗi ghi ${key} vào localStorage:`, err);
  }
};

export const healthDb = {
  // 1. Health Records
  getHealthRecords: async (): Promise<HealthRecord[]> => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('health_records').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Dùng dữ liệu local cho health_records:', e);
      }
    }
    return getStoredData<HealthRecord>(STORAGE_KEYS.HEALTH_RECORDS, seedHealthRecords);
  },

  saveHealthRecord: async (record: HealthRecord): Promise<void> => {
    const records = getStoredData<HealthRecord>(STORAGE_KEYS.HEALTH_RECORDS, seedHealthRecords);
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      records[idx] = { ...record, updated_at: new Date().toISOString() };
    } else {
      records.unshift({ ...record, updated_at: new Date().toISOString() });
    }
    setStoredData(STORAGE_KEYS.HEALTH_RECORDS, records);

    if (supabase) {
      try {
        await supabase.from('health_records').upsert(record);
      } catch (e) {
        console.error('Không thể đồng bộ Supabase:', e);
      }
    }
  },

  deleteHealthRecord: async (id: string): Promise<void> => {
    const records = getStoredData<HealthRecord>(STORAGE_KEYS.HEALTH_RECORDS, seedHealthRecords);
    const filtered = records.filter(r => r.id !== id);
    setStoredData(STORAGE_KEYS.HEALTH_RECORDS, filtered);

    if (supabase) {
      try {
        await supabase.from('health_records').delete().eq('id', id);
      } catch (e) {
        console.error(e);
      }
    }
  },

  // 2. Vaccinations
  getVaccinations: async (): Promise<VaccinationCampaign[]> => {
    return getStoredData<VaccinationCampaign>(STORAGE_KEYS.VACCINATIONS, seedVaccinations);
  },

  saveVaccination: async (campaign: VaccinationCampaign): Promise<void> => {
    const list = getStoredData<VaccinationCampaign>(STORAGE_KEYS.VACCINATIONS, seedVaccinations);
    const idx = list.findIndex(c => c.id === campaign.id);
    if (idx >= 0) list[idx] = campaign;
    else list.unshift(campaign);
    setStoredData(STORAGE_KEYS.VACCINATIONS, list);
  },

  deleteVaccination: async (id: string): Promise<void> => {
    const list = getStoredData<VaccinationCampaign>(STORAGE_KEYS.VACCINATIONS, seedVaccinations);
    setStoredData(STORAGE_KEYS.VACCINATIONS, list.filter(c => c.id !== id));
  },

  // 3. Epidemic Reports
  getEpidemicReports: async (): Promise<EpidemicReport[]> => {
    return getStoredData<EpidemicReport>(STORAGE_KEYS.EPIDEMICS, seedEpidemicReports);
  },

  saveEpidemicReport: async (report: EpidemicReport): Promise<void> => {
    const list = getStoredData<EpidemicReport>(STORAGE_KEYS.EPIDEMICS, seedEpidemicReports);
    const idx = list.findIndex(e => e.id === report.id);
    if (idx >= 0) list[idx] = report;
    else list.unshift(report);
    setStoredData(STORAGE_KEYS.EPIDEMICS, list);
  },

  deleteEpidemicReport: async (id: string): Promise<void> => {
    const list = getStoredData<EpidemicReport>(STORAGE_KEYS.EPIDEMICS, seedEpidemicReports);
    setStoredData(STORAGE_KEYS.EPIDEMICS, list.filter(e => e.id !== id));
  },

  // 4. Fertility Records
  getFertilityRecords: async (): Promise<FertilityRecord[]> => {
    return getStoredData<FertilityRecord>(STORAGE_KEYS.FERTILITY, seedFertilityRecords);
  },

  saveFertilityRecord: async (record: FertilityRecord): Promise<void> => {
    const list = getStoredData<FertilityRecord>(STORAGE_KEYS.FERTILITY, seedFertilityRecords);
    const idx = list.findIndex(f => f.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    setStoredData(STORAGE_KEYS.FERTILITY, list);
  },

  deleteFertilityRecord: async (id: string): Promise<void> => {
    const list = getStoredData<FertilityRecord>(STORAGE_KEYS.FERTILITY, seedFertilityRecords);
    setStoredData(STORAGE_KEYS.FERTILITY, list.filter(f => f.id !== id));
  },


  // 5. Emergency Contacts
  getEmergencyContacts: async (): Promise<EmergencyContact[]> => {
    return getStoredData<EmergencyContact>(STORAGE_KEYS.EMERGENCY, seedEmergencyContacts);
  },

  saveEmergencyContact: async (contact: EmergencyContact): Promise<void> => {
    const list = getStoredData<EmergencyContact>(STORAGE_KEYS.EMERGENCY, seedEmergencyContacts);
    const idx = list.findIndex(c => c.id === contact.id);
    if (idx >= 0) list[idx] = contact;
    else list.unshift(contact);
    setStoredData(STORAGE_KEYS.EMERGENCY, list);
  },

  deleteEmergencyContact: async (id: string): Promise<void> => {
    const list = getStoredData<EmergencyContact>(STORAGE_KEYS.EMERGENCY, seedEmergencyContacts);
    setStoredData(STORAGE_KEYS.EMERGENCY, list.filter(c => c.id !== id));
  }
};

