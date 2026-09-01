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

async function testGrouping() {
  const wardFunds = await fetchAll('ward_funds');
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');

  // Count how many have generic address
  let addressCounts = {};
  wardFunds.forEach(w => {
    const addr = (w.address || '(none)').trim();
    addressCounts[addr] = (addressCounts[addr] || 0) + 1;
  });

  const sortedAddresses = Object.entries(addressCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('Top addresses in ward_funds:');
  console.log(sortedAddresses);
}

testGrouping();
