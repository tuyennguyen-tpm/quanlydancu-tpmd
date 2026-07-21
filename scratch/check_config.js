import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('app_config').select('*');
  if (error) {
    console.error('Error fetching app_config:', error);
  } else {
    console.log('App Config records:', data);
  }
}

run();
