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

async function findDifference() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');

  // Let's see: In household_funds, which households were created at 2026-08-23T03:27 vs individual dates?
  // Let's find which households in household_funds had ONLY 2026-08-23 records!
  const hhFundsByHh = new Map();
  hhFunds.forEach(hf => {
    if (!hhFundsByHh.has(hf.household_id)) hhFundsByHh.set(hf.household_id, []);
    hhFundsByHh.get(hf.household_id).push(hf);
  });

  console.log('Total households with household_funds:', hhFundsByHh.size);

  // In ward_funds, check how many households have positive actuals
  // Group by how their dates look:
  // e.g. households with dates on 2026-08-08 (1908 contributions), 2026-08-07 (1256 contributions), 2026-08-22 (1234 contributions)
  const dateCounts = {};
  wardFunds.forEach(w => {
    if (w.contributions) {
      Object.values(w.contributions).forEach(c => {
        if (c && c.actual > 0 && c.date) {
          dateCounts[c.date] = (dateCounts[c.date] || 0) + 1;
        }
      });
    }
  });

  console.log('Date counts in ward_funds:');
  console.log(dateCounts);
}

findDifference();
