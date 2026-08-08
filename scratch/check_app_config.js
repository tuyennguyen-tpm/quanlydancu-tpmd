import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function checkConfig() {
  const { data, error } = await supabase.from('app_config').select('*').in('key', ['ward_fund_list', 'official_signatures', 'tdp_groups_config', 'fund_list']);
  if (error) {
    console.error('Error fetching app_config:', error);
    return;
  }
  console.log('--- TARGET CONFIG ROWS ---');
  data.forEach(row => {
    console.log(`Key: ${row.key} | User: ${row.user_id} | Updated: ${row.updated_at}`);
    console.log(`Value: ${row.value}\n`);
  });
}

checkConfig();
