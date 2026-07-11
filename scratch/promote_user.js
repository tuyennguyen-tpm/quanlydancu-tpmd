// scratch/promote_user.js
import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function run() {
  const userId = '9748b169-0a60-486e-babb-a3afdf90e065'; // Nguyễn Kim Tuyến
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', userId)
    .select();
    
  if (error) {
    console.error('Error promoting user:', error);
  } else {
    console.log('Successfully promoted user:', data);
  }
}

run();
