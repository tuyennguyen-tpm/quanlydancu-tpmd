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

async function checkGroupSizes() {
  const wardFunds = await fetchAll('ward_funds');
  const residents = await fetchAll('residents');
  const households = await fetchAll('households');

  // Let's build residentsByName
  const residentsByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!residentsByName.has(k)) residentsByName.set(k, []);
    residentsByName.get(k).push(r);
  });

  // Group wardFunds
  const groupSizes = new Map();
  wardFunds.forEach(f => {
    const nameKey = f.full_name.trim().toLowerCase();
    const cand = residentsByName.get(nameKey) || [];
    let hhId = cand.length === 1 ? cand[0].household_id : null;
    if (!hhId) {
      hhId = 'FALLBACK_' + f.address;
    }
    groupSizes.set(hhId, (groupSizes.get(hhId) || 0) + 1);
  });

  const sortedGroups = [...groupSizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top group sizes:', sortedGroups);
}

checkGroupSizes();
