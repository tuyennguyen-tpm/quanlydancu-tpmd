// Script tạo bảng profiles và registration_keys trên Supabase mới
// Chạy: node --experimental-vm-modules scratch/create_profiles_table.js
import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function checkAllTables() {
  const tables = [
    'wards', 'households', 'residents', 'financial_records',
    'household_funds', 'ward_funds', 'sponsors', 'complaints',
    'meetings', 'meeting_minutes', 'documents', 'security_logs',
    'environment_logs', 'policy_activities', 'party_members',
    'party_meetings', 'party_evaluations', 'party_fees',
    'app_config', 'profiles', 'registration_keys'
  ];
  
  console.log('=== Kiểm tra tất cả các bảng ===');
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`❌ ${t}: ${error.message}`);
    } else {
      console.log(`✅ ${t}: OK`);
    }
  }
}

checkAllTables();
