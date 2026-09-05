// Script kiểm tra + tạo bảng profiles và registration_keys trên Supabase mới
import { createClient } from '@supabase/supabase-js';

const url = 'https://pxnvgoqmtydqxljtiyinb.supabase.co';
const key = 'sb_publishable_IlXMJqlHdpVgSKMBB1PCwQ_als-0lLf';
const supabase = createClient(url, key);

const tables = [
  'wards', 'households', 'residents', 'financial_records',
  'household_funds', 'ward_funds', 'sponsors', 'complaints',
  'meetings', 'meeting_minutes', 'documents', 'security_logs',
  'environment_logs', 'policy_activities', 'party_members',
  'party_meetings', 'party_evaluations', 'party_fees',
  'app_config', 'profiles', 'registration_keys'
];

async function checkAllTables() {
  console.log('=== Kiểm tra tất cả các bảng trên project mới ===');
  const missing = [];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log(`❌ THIẾU: ${t}`);
      missing.push(t);
    } else if (error && error.message.includes('restricted')) {
      console.log(`🔴 BỊ KHÓA: ${t} - ${error.message.substring(0, 60)}`);
    } else if (error) {
      console.log(`⚠️  ${t}: ${error.message.substring(0, 80)}`);
      missing.push(t);
    } else {
      console.log(`✅ ${t}: OK`);
    }
  }
  return missing;
}

async function checkHouseholdCount() {
  console.log('\n=== Kiểm tra số liệu đã nạp ===');
  const { count: hCount } = await supabase.from('households').select('*', { count: 'exact', head: true });
  const { count: rCount } = await supabase.from('residents').select('*', { count: 'exact', head: true });
  console.log(`Hộ dân: ${hCount ?? 'lỗi'}`);
  console.log(`Nhân khẩu: ${rCount ?? 'lỗi'}`);
}

async function main() {
  const missing = await checkAllTables();
  if (missing.length === 0) {
    await checkHouseholdCount();
  } else {
    console.log(`\n⚠️  Còn thiếu ${missing.length} bảng: ${missing.join(', ')}`);
  }
}

main().catch(console.error);
