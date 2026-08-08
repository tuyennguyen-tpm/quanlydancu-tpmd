import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function fixConfig() {
  const cleanWardFunds = JSON.stringify([
    { name: 'Quỹ phòng chống thiên tai', target: 15000, scope: 'person', age_range: 'Nam 18-61, Nữ 18-58 tuổi' },
    { name: 'Quỹ Đền ơn đáp nghĩa', target: 70000, scope: 'person', age_range: 'Nam 18-61, Nữ 18-58 tuổi' },
    { name: 'Quỹ Chăm sóc người cao tuổi', target: 50000, scope: 'household', age_range: 'Hộ gia đình' }
  ]);

  const { data: rows } = await supabase.from('app_config').select('*').eq('key', 'ward_fund_list');
  console.log('Current ward_fund_list rows:', rows);

  if (rows && rows.length > 0) {
    for (const r of rows) {
      const { error } = await supabase.from('app_config').update({
        value: cleanWardFunds,
        updated_at: new Date().toISOString()
      }).eq('user_id', r.user_id).eq('key', 'ward_fund_list');

      if (error) {
        console.error(`Failed to update user ${r.user_id}:`, error);
      } else {
        console.log(`Updated ward_fund_list for user ${r.user_id} successfully!`);
      }
    }
  }
}

fixConfig();
