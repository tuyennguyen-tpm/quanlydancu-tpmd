// scratch/list_wards.js
import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function run() {
  const { data: wards, error } = await supabase.from('wards').select('*');
  if (error) {
    console.error('Error fetching wards:', error);
  } else {
    console.log('Wards:', wards);
  }
}

run();
