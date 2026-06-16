// v2.1 - Su dung bang app_config cho dong bo ma PIN (khong phu thuoc documents)
import { createClient } from '@supabase/supabase-js';
import type { Household, Resident, FinancialRecord, Complaint, Meeting, Document, PolicyActivity } from '../types';


// Types for logs not defined in index.ts
export interface SecurityLog {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'ok' | 'alert';
}

export interface EnvironmentLog {
  id: string;
  area: string;
  status: 'ok' | 'warning' | 'danger';
  last_cleaned: string;
}

const getSupabaseClient = () => {
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  const url = localUrl || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (url && key) {
    try {
      return createClient(url, key);
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
    }
  }
  return null;
};

// Initialize Supabase Client
export let supabase = getSupabaseClient();

export const refreshSupabaseClient = () => {
  supabase = getSupabaseClient();
};

// Initial Seed Data for LocalStorage Fallback
const seedHouseholds: Household[] = [
  { id: 'H001', household_number: 'HK-99281', address: 'Số 45, Nam Sầm Sơn, Thanh Hóa', head_of_household_id: 'R001', group_id: 'NAM_SAM_SON_01', latitude: 19.7425, longitude: 105.9235, policy_type: 'none', created_at: '2026-01-10T08:00:00Z' },
  { id: 'H002', household_number: 'HK-83921', address: 'Số 47, Nam Sầm Sơn, Thanh Hóa', head_of_household_id: 'R005', group_id: 'NAM_SAM_SON_01', latitude: 19.7415, longitude: 105.9225, policy_type: 'poor', created_at: '2026-02-15T09:30:00Z' },
  { id: 'H003', household_number: 'HK-72810', address: 'Số 49, Nam Sầm Sơn, Thanh Hóa', head_of_household_id: 'R007', group_id: 'NAM_SAM_SON_01', latitude: 19.7420, longitude: 105.9240, policy_type: 'none', created_at: '2026-03-20T10:15:00Z' },
  { id: 'H004', household_number: 'HK-61729', address: 'Số 51, Nam Sầm Sơn, Thanh Hóa', head_of_household_id: 'R008', group_id: 'NAM_SAM_SON_01', latitude: 19.7430, longitude: 105.9215, policy_type: 'near_poor', created_at: '2026-04-05T14:20:00Z' },
  { id: 'H005', household_number: 'HK-50192', address: 'Số 53, Nam Sầm Sơn, Thanh Hóa', head_of_household_id: 'R009', group_id: 'NAM_SAM_SON_01', latitude: 19.7405, longitude: 105.9250, policy_type: 'policy_family', created_at: '2026-05-12T11:45:00Z' },
];

const seedResidents: Resident[] = [
  { id: 'R001', household_id: 'H001', full_name: 'Nguyễn Kim Tuyến', gender: 'male', dob: '1965-05-12', cccd: '038065001234', phone: '0912345678', occupation: 'Kinh doanh tự do', permanent_address: 'Số 45, Nam Sầm Sơn, Thanh Hóa', is_head: true, relationship_with_head: 'Chủ hộ', is_senior: false, status: 'resident', created_at: '2026-01-10T08:00:00Z' },
  { id: 'R002', household_id: 'H001', full_name: 'Lê Thị Dung', gender: 'female', dob: '1968-08-20', cccd: '038168005678', phone: '0987654321', occupation: 'Nội trợ', permanent_address: 'Số 45, Nam Sầm Sơn, Thanh Hóa', is_head: false, relationship_with_head: 'Vợ', is_senior: false, status: 'resident', created_at: '2026-01-10T08:05:00Z' },
  { id: 'R003', household_id: 'H001', full_name: 'Lê Thanh Tùng', gender: 'male', dob: '1995-10-15', cccd: '038095004321', phone: '0965432198', occupation: 'Kỹ sư phần mềm', permanent_address: 'Số 45, Nam Sầm Sơn, Thanh Hóa', is_head: false, relationship_with_head: 'Con', is_senior: false, status: 'temporary_absent', created_at: '2026-01-10T08:10:00Z' },
  { id: 'R004', household_id: 'H001', full_name: 'Lê Minh Trang', gender: 'female', dob: '2018-04-02', cccd: '038218001122', phone: '', occupation: 'Học sinh', permanent_address: 'Số 45, Nam Sầm Sơn, Thanh Hóa', is_head: false, relationship_with_head: 'Cháu nội', is_senior: false, status: 'resident', created_at: '2026-03-01T09:00:00Z' },
  
  { id: 'R005', household_id: 'H002', full_name: 'Trần Thị Năm', gender: 'female', dob: '1940-02-10', cccd: '038140003456', phone: '0356789123', occupation: 'Hưu trí', permanent_address: 'Số 47, Nam Sầm Sơn, Thanh Hóa', is_head: true, relationship_with_head: 'Chủ hộ', is_senior: true, status: 'resident', created_at: '2026-02-15T09:30:00Z' },
  { id: 'R006', household_id: 'H002', full_name: 'Trần Văn Cường', gender: 'male', dob: '1972-03-15', cccd: '038072007788', phone: '0909090909', occupation: 'Lao động tự do', permanent_address: 'Số 47, Nam Sầm Sơn, Thanh Hóa', is_head: false, relationship_with_head: 'Con', is_senior: false, status: 'resident', created_at: '2026-02-15T09:35:00Z' },
  
  { id: 'R007', household_id: 'H003', full_name: 'Trần Văn Hải', gender: 'male', dob: '1980-04-25', cccd: '038080009999', phone: '0933445566', occupation: 'Ngư dân', permanent_address: 'Số 49, Nam Sầm Sơn, Thanh Hóa', is_head: true, relationship_with_head: 'Chủ hộ', is_senior: false, status: 'resident', created_at: '2026-03-20T10:15:00Z' },
  
  { id: 'R008', household_id: 'H004', full_name: 'Phạm Minh Đức', gender: 'male', dob: '1985-09-05', cccd: '038085002233', phone: '0977889900', occupation: 'Thợ điện', permanent_address: 'Số 51, Nam Sầm Sơn, Thanh Hóa', is_head: true, relationship_with_head: 'Chủ hộ', is_senior: false, status: 'resident', created_at: '2026-04-05T14:20:00Z' },
  
  { id: 'R009', household_id: 'H005', full_name: 'Hoàng Thị Lan', gender: 'female', dob: '1946-12-30', cccd: '038146004455', phone: '0944556677', occupation: 'Thương binh', permanent_address: 'Số 53, Nam Sầm Sơn, Thanh Hóa', is_head: true, relationship_with_head: 'Chủ hộ', is_senior: true, status: 'resident', created_at: '2026-05-12T11:45:00Z' },
];

const seedFinancialRecords: FinancialRecord[] = [
  { id: 'F001', group_id: 'NAM_SAM_SON_01', type: 'income', amount: 12500000, category: 'Quỹ vận động', description: 'Thu Quỹ Vì người nghèo năm 2026', recorded_by: 'Nguyễn Kim Tuyến', date: '2026-06-10', created_at: '2026-06-10T10:00:00Z' },
  { id: 'F002', group_id: 'NAM_SAM_SON_01', type: 'expense', amount: 2400000, category: 'Cơ sở vật chất', description: 'Sửa chữa đèn đường ngõ 45 bị hỏng', recorded_by: 'Trần Văn Cường', date: '2026-06-08', created_at: '2026-06-08T15:30:00Z' },
  { id: 'F003', group_id: 'NAM_SAM_SON_01', type: 'income', amount: 8400000, category: 'Phí dịch vụ', description: 'Thu phí vệ sinh môi trường Quý 2/2026', recorded_by: 'Lê Thị Dung', date: '2026-06-05', created_at: '2026-06-05T09:00:00Z' },
  { id: 'F004', group_id: 'NAM_SAM_SON_01', type: 'expense', amount: 1000000, category: 'An sinh', description: 'Hỗ trợ tang lễ hộ khó khăn', recorded_by: 'Nguyễn Kim Tuyến', date: '2026-06-01', created_at: '2026-06-01T08:00:00Z' },
];

const seedComplaints: Complaint[] = [
  { id: 'C001', resident_id: 'R001', resident_name: 'Nguyễn Kim Tuyến', content: 'Đèn đường ngõ 45 bị hỏng hơn 1 tuần nay chưa thấy ai sửa.', status: 'pending', response: '', date: '2026-06-12', created_at: '2026-06-12T07:30:00Z' },
  { id: 'C002', resident_id: 'R005', resident_name: 'Trần Thị Năm', content: 'Rác thải tập kết không đúng nơi quy định tại khu vực cổng tổ gây mùi hôi thối.', status: 'resolved', response: 'Đã cho ban vệ sinh dọn dẹp và đặt biển cấm đổ rác tại cổng tổ.', date: '2026-06-11', created_at: '2026-06-11T14:00:00Z' },
  { id: 'C003', resident_id: 'R007', resident_name: 'Trần Văn Hải', content: 'Đợt tiêm chủng tiếp theo cần thông báo sớm cho bà con sắp xếp thời gian.', status: 'processing', response: 'Đã tiếp nhận ý kiến, sẽ soạn thông báo sớm 3 ngày trước khi tiêm.', date: '2026-06-08', created_at: '2026-06-08T09:15:00Z' },
];

const seedMeetings: Meeting[] = [
  { id: 'M001', group_id: 'NAM_SAM_SON_01', title: 'Họp bàn phương án bê tông hóa ngõ 47', content: 'Thảo luận đóng góp kinh phí và nhân công của các hộ gia đình ngõ 47 để bê tông hóa đường ngõ.', date: '2026-06-15T19:30:00Z', location: 'Nhà văn hóa tổ', attendance_count: 0, created_at: '2026-06-01T10:00:00Z' },
  { id: 'M002', group_id: 'NAM_SAM_SON_01', title: 'Họp định kỳ tháng 05/2026', content: 'Đánh giá tình hình trật tự, thu nộp quỹ đầu năm và phát động phong trào ngày chủ nhật xanh.', date: '2026-05-15T19:30:00Z', location: 'Nhà văn hóa tổ', attendance_count: 85, created_at: '2026-05-01T09:00:00Z' },
];

const seedDocuments: Document[] = [
  { id: 'D001', group_id: 'NAM_SAM_SON_01', title: 'Nghị quyết số 12/NQ-TDP về vệ sinh môi trường', type: 'directive', file_url: '#', uploaded_at: '2026-05-30T00:00:00Z' },
  { id: 'D002', group_id: 'NAM_SAM_SON_01', title: 'Công văn 456/UBND về việc tiêm chủng mở rộng hè 2026', type: 'report', file_url: '#', uploaded_at: '2026-06-01T00:00:00Z' },
  { id: 'D003', group_id: 'NAM_SAM_SON_01', title: 'Kế hoạch tổ chức Tết thiếu nhi 1/6 cho trẻ em trong tổ', type: 'plan', file_url: '#', uploaded_at: '2026-05-20T00:00:00Z' },
];

const seedSecurityLogs: SecurityLog[] = [
  { id: 'S001', title: 'Phát hiện mất trộm xe đạp hộ bà Năm', description: 'Bà Năm báo mất xe đạp mini cất ở sân ngõ 45 lúc tối. Đã báo công an phường phối hợp trích xuất camera giám sát.', date: '2026-06-10', type: 'alert' },
  { id: 'S002', title: 'Tuần tra đêm địa bàn Tổ dân phố', description: 'Tổ tự quản gồm 3 đồng chí đã tuần tra các ngõ ngách từ 21h-23h. Không phát hiện sự cố, an ninh ổn định.', date: '2026-06-12', type: 'ok' },
];

const seedEnvironmentLogs: EnvironmentLog[] = [
  { id: 'E001', area: 'Khu vực ngõ 45', status: 'ok', last_cleaned: '2026-06-12' },
  { id: 'E002', area: 'Khu vực nhà văn hóa', status: 'warning', last_cleaned: '2026-06-05' },
  { id: 'E003', area: 'Khu vực ngõ 47', status: 'ok', last_cleaned: '2026-06-11' },
];

const seedPolicyActivities: PolicyActivity[] = [
  { id: 'P-1', title: 'Phát gạo hỗ trợ cho hộ nghèo', desc: 'Cấp phát 20kg gạo/hộ tại Nhà văn hóa tổ.', targetGroup: 'poor', date: '2026-06-20' },
  { id: 'P-2', title: 'Thăm hỏi chúc thọ người cao tuổi ốm đau', desc: 'Thăm hỏi cụ Nguyễn Văn X (85 tuổi) đang nằm viện điều trị.', targetGroup: 'seniors', date: '2026-06-15' },
];

// Helper functions for LocalStorage
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(key);
  if (!item) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(item);
};

const setStorageItem = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// General DB Interface
// General DB Interface
export const getSessionUserId = async (): Promise<string | null> => {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }
  return null;
};

const getTenantFilter = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const tenantId = localStorage.getItem('guest_tenant_id');
  if (isGuest && tenantId) {
    return tenantId;
  }
  return null;
};

export const seedTenantData = async (userId: string): Promise<void> => {
  if (!supabase) return;
  try {
    console.log('Seeding initial data for tenant:', userId);
    
    // 1. Seed Households
    const householdsPayload = seedHouseholds.map(h => ({
      ...h,
      user_id: userId
    }));
    await supabase.from('households').insert(householdsPayload);

    // 2. Seed Residents
    const residentsPayload = seedResidents.map(r => ({
      ...r,
      user_id: userId
    }));
    await supabase.from('residents').insert(residentsPayload);

    // 3. Seed Financial Records
    const financePayload = seedFinancialRecords.map(f => ({
      ...f,
      user_id: userId
    }));
    await supabase.from('financial_records').insert(financePayload);

    // 4. Seed Complaints
    const complaintsPayload = seedComplaints.map(c => ({
      ...c,
      user_id: userId
    }));
    await supabase.from('complaints').insert(complaintsPayload);

    // 5. Seed Meetings
    const meetingsPayload = seedMeetings.map(m => ({
      ...m,
      user_id: userId
    }));
    await supabase.from('meetings').insert(meetingsPayload);

    // 6. Seed Documents
    const docsPayload = seedDocuments.map(d => ({
      ...d,
      user_id: userId
    }));
    await supabase.from('documents').insert(docsPayload);

    // 7. Seed Security Logs
    const securityPayload = seedSecurityLogs.map(s => ({
      ...s,
      user_id: userId
    }));
    await supabase.from('security_logs').insert(securityPayload);

    // 8. Seed Environment Logs
    const envPayload = seedEnvironmentLogs.map(e => ({
      ...e,
      user_id: userId
    }));
    await supabase.from('environment_logs').insert(envPayload);

    // 9. Seed Policy Activities
    const policyPayload = seedPolicyActivities.map(p => ({
      id: p.id,
      title: p.title,
      description: p.desc,
      target_group: p.targetGroup,
      date: p.date,
      user_id: userId
    }));
    await supabase.from('policy_activities').insert(policyPayload);

    // 10. Seed Guest PIN config
    await supabase.from('app_config').insert({
      user_id: userId,
      key: 'guest_pin',
      value: '1234'
    });

    console.log('Seed data completed successfully for tenant:', userId);
  } catch (err) {
    console.error('Failed to seed tenant data:', err);
  }
};

export const checkAndSeedUser = async (userId: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from('households')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (!error && count === 0) {
      console.log('No households found, seeding tenant default data...');
      await seedTenantData(userId);
    }
  } catch (err) {
    console.error('Failed to check or seed user data:', err);
  }
};

export const db = {
  // --- Households ---
  getHouseholds: async (): Promise<Household[]> => {
    if (supabase) {
      try {
        let query = supabase.from('households').select('*');
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getHouseholds error, falling back to local storage', e);
      }
    }
    return getStorageItem<Household[]>('households', seedHouseholds);
  },
  saveHousehold: async (household: Omit<Household, 'created_at'> & { created_at?: string }): Promise<Household> => {
    const fullHousehold: Household = {
      ...household,
      created_at: household.created_at || new Date().toISOString()
    };
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...fullHousehold, user_id: uId };
        const { data, error } = await supabase.from('households').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveHousehold error, saving to local storage', e);
      }
    }
    const households = getStorageItem<Household[]>('households', seedHouseholds);
    const index = households.findIndex(h => h.id === household.id);
    if (index >= 0) {
      households[index] = fullHousehold;
    } else {
      households.push(fullHousehold);
    }
    setStorageItem('households', households);
    return fullHousehold;
  },
  deleteHousehold: async (id: string): Promise<boolean> => {
    if (supabase) {
      try {
        const { error } = await supabase.from('households').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.error('Supabase deleteHousehold error, falling back to local storage', e);
      }
    }
    const households = getStorageItem<Household[]>('households', seedHouseholds);
    const filtered = households.filter(h => h.id !== id);
    setStorageItem('households', filtered);
    
    // Cascading delete for residents in this household in LocalStorage
    const residents = getStorageItem<Resident[]>('residents', seedResidents);
    const filteredResidents = residents.filter(r => r.household_id !== id);
    setStorageItem('residents', filteredResidents);
    return true;
  },

  // --- Residents ---
  getResidents: async (): Promise<Resident[]> => {
    if (supabase) {
      try {
        let query = supabase.from('residents').select('*');
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getResidents error, falling back to local storage', e);
      }
    }
    return getStorageItem<Resident[]>('residents', seedResidents);
  },
  saveResident: async (resident: Omit<Resident, 'created_at' | 'is_senior'> & { created_at?: string; is_senior?: boolean }): Promise<Resident> => {
    const dobYear = new Date(resident.dob).getFullYear();
    const currentYear = new Date().getFullYear();
    const isSenior = (currentYear - dobYear) >= 80;
    
    const fullResident: Resident = {
      ...resident,
      is_senior: isSenior,
      created_at: resident.created_at || new Date().toISOString()
    };
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...fullResident, user_id: uId };
        const { data, error } = await supabase.from('residents').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveResident error, saving to local storage', e);
      }
    }
    const residents = getStorageItem<Resident[]>('residents', seedResidents);
    const index = residents.findIndex(r => r.id === resident.id);
    if (index >= 0) {
      residents[index] = fullResident;
    } else {
      residents.push(fullResident);
    }
    setStorageItem('residents', residents);
    return fullResident;
  },
  deleteResident: async (id: string): Promise<boolean> => {
    if (supabase) {
      try {
        const { error } = await supabase.from('residents').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.error('Supabase deleteResident error, falling back to local storage', e);
      }
    }
    const residents = getStorageItem<Resident[]>('residents', seedResidents);
    const filtered = residents.filter(r => r.id !== id);
    setStorageItem('residents', filtered);
    return true;
  },

  // --- Financial Records ---
  getFinancialRecords: async (): Promise<FinancialRecord[]> => {
    if (supabase) {
      try {
        let query = supabase.from('financial_records').select('*');
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getFinancialRecords error, falling back to local storage', e);
      }
    }
    return getStorageItem<FinancialRecord[]>('financial_records', seedFinancialRecords);
  },
  saveFinancialRecord: async (record: Omit<FinancialRecord, 'created_at'> & { created_at?: string }): Promise<FinancialRecord> => {
    const fullRecord: FinancialRecord = {
      ...record,
      created_at: record.created_at || new Date().toISOString()
    };
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...fullRecord, user_id: uId };
        const { data, error } = await supabase.from('financial_records').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveFinancialRecord error, saving to local storage', e);
      }
    }
    const records = getStorageItem<FinancialRecord[]>('financial_records', seedFinancialRecords);
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = fullRecord;
    } else {
      records.push(fullRecord);
    }
    setStorageItem('financial_records', records);
    return fullRecord;
  },
  deleteFinancialRecord: async (id: string): Promise<boolean> => {
    if (supabase) {
      try {
        const { error } = await supabase.from('financial_records').delete().eq('id', id);
        if (!error) return true;
      } catch (e) {
        console.error('Supabase deleteFinancialRecord error, falling back to local storage', e);
      }
    }
    const records = getStorageItem<FinancialRecord[]>('financial_records', seedFinancialRecords);
    const filtered = records.filter(r => r.id !== id);
    setStorageItem('financial_records', filtered);
    return true;
  },

  // --- Complaints ---
  getComplaints: async (): Promise<Complaint[]> => {
    if (supabase) {
      try {
        let query = supabase.from('complaints').select('*');
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getComplaints error, falling back to local storage', e);
      }
    }
    return getStorageItem<Complaint[]>('complaints', seedComplaints);
  },
  saveComplaint: async (complaint: Omit<Complaint, 'created_at'> & { created_at?: string }): Promise<Complaint> => {
    const fullComplaint: Complaint = {
      ...complaint,
      created_at: complaint.created_at || new Date().toISOString()
    };
    if (supabase) {
      try {
        const tenantId = getTenantFilter();
        const uId = tenantId || (await getSessionUserId());
        const payload = { ...fullComplaint, user_id: uId };
        const { data, error } = await supabase.from('complaints').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveComplaint error, saving to local storage', e);
      }
    }
    const complaints = getStorageItem<Complaint[]>('complaints', seedComplaints);
    const index = complaints.findIndex(c => c.id === complaint.id);
    if (index >= 0) {
      complaints[index] = fullComplaint;
    } else {
      complaints.push(fullComplaint);
    }
    setStorageItem('complaints', complaints);
    return fullComplaint;
  },

  // --- Meetings ---
  getMeetings: async (): Promise<Meeting[]> => {
    if (supabase) {
      try {
        let query = supabase.from('meetings').select('*');
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getMeetings error, falling back to local storage', e);
      }
    }
    return getStorageItem<Meeting[]>('meetings', seedMeetings);
  },
  saveMeeting: async (meeting: Omit<Meeting, 'created_at'> & { created_at?: string }): Promise<Meeting> => {
    const fullMeeting: Meeting = {
      ...meeting,
      created_at: meeting.created_at || new Date().toISOString()
    };
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...fullMeeting, user_id: uId };
        const { data, error } = await supabase.from('meetings').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveMeeting error, saving to local storage', e);
      }
    }
    const meetings = getStorageItem<Meeting[]>('meetings', seedMeetings);
    const index = meetings.findIndex(m => m.id === meeting.id);
    if (index >= 0) {
      meetings[index] = fullMeeting;
    } else {
      meetings.push(fullMeeting);
    }
    setStorageItem('meetings', meetings);
    return fullMeeting;
  },

  // --- Documents ---
  getDocuments: async (): Promise<Document[]> => {
    if (supabase) {
      try {
        let query = supabase.from('documents').select('*').neq('id', 'CONFIG_PIN').order('uploaded_at', { ascending: false });
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getDocuments error, falling back to local storage', e);
      }
    }
    const list = getStorageItem<Document[]>('documents', seedDocuments);
    return list.filter(d => d.id !== 'CONFIG_PIN');
  },
  saveDocument: async (doc: Document): Promise<Document> => {
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...doc, user_id: uId };
        const { data, error } = await supabase.from('documents').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveDocument error, saving to local storage', e);
      }
    }
    const docs = getStorageItem<Document[]>('documents', seedDocuments);
    const index = docs.findIndex(d => d.id === doc.id);
    if (index >= 0) {
      docs[index] = doc;
    } else {
      docs.unshift(doc); // newest first
    }
    setStorageItem('documents', docs);
    return doc;
  },

  // --- Security Logs ---
  getSecurityLogs: async (): Promise<SecurityLog[]> => {
    if (supabase) {
      try {
        let query = supabase.from('security_logs').select('*').order('date', { ascending: false });
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getSecurityLogs error, falling back to local storage', e);
      }
    }
    return getStorageItem<SecurityLog[]>('security_logs', seedSecurityLogs);
  },
  saveSecurityLog: async (log: SecurityLog): Promise<SecurityLog> => {
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...log, user_id: uId };
        const { data, error } = await supabase.from('security_logs').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveSecurityLog error, saving to local storage', e);
      }
    }
    const logs = getStorageItem<SecurityLog[]>('security_logs', seedSecurityLogs);
    const index = logs.findIndex(s => s.id === log.id);
    if (index >= 0) {
      logs[index] = log;
    } else {
      logs.unshift(log); // newest first
    }
    setStorageItem('security_logs', logs);
    return log;
  },

  // --- Environment Logs ---
  getEnvironmentLogs: async (): Promise<EnvironmentLog[]> => {
    if (supabase) {
      try {
        let query = supabase.from('environment_logs').select('*').order('last_cleaned', { ascending: false });
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase getEnvironmentLogs error, falling back to local storage', e);
      }
    }
    return getStorageItem<EnvironmentLog[]>('environment_logs', seedEnvironmentLogs);
  },
  saveEnvironmentLog: async (log: EnvironmentLog): Promise<EnvironmentLog> => {
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const payload = { ...log, user_id: uId };
        const { data, error } = await supabase.from('environment_logs').upsert(payload).select().single();
        if (!error && data) return data;
      } catch (e) {
        console.error('Supabase saveEnvironmentLog error, saving to local storage', e);
      }
    }
    const logs = getStorageItem<EnvironmentLog[]>('environment_logs', seedEnvironmentLogs);
    const index = logs.findIndex(l => l.id === log.id);
    if (index >= 0) {
      logs[index] = log;
    } else {
      logs.push(log);
    }
    setStorageItem('environment_logs', logs);
    return log;
  },

  // --- Policy Activities ---
  getActivityPrograms: async (): Promise<PolicyActivity[]> => {
    if (supabase) {
      try {
        let query = supabase.from('policy_activities').select('*').order('date', { ascending: false });
        const tenantId = getTenantFilter();
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            title: item.title,
            desc: item.description,
            targetGroup: item.target_group,
            date: item.date,
            created_at: item.created_at
          }));
        }
      } catch (e) {
        console.error('Supabase getActivityPrograms error, falling back to local storage', e);
      }
    }
    return getStorageItem<PolicyActivity[]>('policy_activities', seedPolicyActivities);
  },
  saveActivityProgram: async (act: PolicyActivity): Promise<PolicyActivity> => {
    if (supabase) {
      try {
        const uId = await getSessionUserId();
        const dbPayload = {
          id: act.id,
          title: act.title,
          description: act.desc,
          target_group: act.targetGroup,
          date: act.date,
          created_at: act.created_at || new Date().toISOString(),
          user_id: uId
        };
        const { data, error } = await supabase.from('policy_activities').upsert(dbPayload).select().single();
        if (!error && data) {
          return {
            id: data.id,
            title: data.title,
            desc: data.description,
            targetGroup: data.target_group,
            date: data.date,
            created_at: data.created_at
          };
        }
      } catch (e) {
        console.error('Supabase saveActivityProgram error, saving to local storage', e);
      }
    }
    const acts = getStorageItem<PolicyActivity[]>('policy_activities', seedPolicyActivities);
    const index = acts.findIndex(a => a.id === act.id);
    if (index >= 0) {
      acts[index] = act;
    } else {
      acts.unshift(act); // newest first
    }
    setStorageItem('policy_activities', acts);
    return act;
  },
  getGroupId: (): string => {
    return localStorage.getItem('group_id') || 'NAM_SAM_SON_01';
  },
  getGuestPin: async (): Promise<string> => {
    if (supabase) {
      try {
        const tenantId = localStorage.getItem('guest_tenant_id');
        let query = supabase.from('app_config').select('value').eq('key', 'guest_pin');
        if (tenantId) {
          query = query.eq('user_id', tenantId);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw new Error(error.message);
        if (data && data.value) return data.value;
      } catch (e) {
        console.error('Supabase getGuestPin error', e);
      }
    }
    return localStorage.getItem('guest_access_pin') || '1234';
  },
  saveGuestPin: async (pin: string): Promise<void> => {
    localStorage.setItem('guest_access_pin', pin);
    if (!supabase) {
      console.warn('saveGuestPin: supabase la null, chi luu localStorage');
      return;
    }
    const uId = await getSessionUserId();
    const { error } = await supabase
      .from('app_config')
      .upsert({ user_id: uId, key: 'guest_pin', value: pin, updated_at: new Date().toISOString() });
    if (error) {
      throw new Error(`${error.message} (code: ${error.code})`);
    }
    console.log('saveGuestPin: da luu PIN thanh cong vao app_config:', pin);
  }
};
