import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('ward_funds').select('*').limit(5);
  if (error) {
    console.error('Error fetching ward_funds:', error);
  } else {
    console.log('Ward Funds sample records:', data);
    const { count, error: countError } = await supabase.from('ward_funds').select('*', { count: 'exact', head: true });
    console.log('Total count of ward_funds:', count);
  }
}

run();
