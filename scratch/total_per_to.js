import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function fetchAll(table) {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from(table).select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function totalPerTo() {
  const households = await fetchAll('households');
  const counts = {};
  households.forEach(h => {
    const to = h.self_management_group || 'Chưa rõ';
    counts[to] = (counts[to] || 0) + 1;
  });
  console.log('Total households in village per Tổ:');
  console.log(counts);
}

totalPerTo();
