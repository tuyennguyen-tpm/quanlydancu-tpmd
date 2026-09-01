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

async function findExact517() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');
  const finRecords = await fetchAll('financial_records');

  // Let's check financial_records created_at or manual vs auto
  const manualFin = finRecords.filter(r => r.recorded_by !== 'Hệ thống tự động');
  console.log('Manual financial records:', manualFin.length);

  // In household_funds, group by household_id and check their created_at timestamps
  const hhFundsByHhId = new Map();
  hhFunds.forEach(hf => {
    if (!hhFundsByHhId.has(hf.household_id)) hhFundsByHhId.set(hf.household_id, []);
    hhFundsByHhId.get(hf.household_id).push(hf);
  });
  console.log('Total distinct household_ids in household_funds:', hhFundsByHhId.size);

  // Check how many households have paid_at in July / August
  const datesSet = new Set();
  wardFunds.forEach(w => {
    if (w.contributions) {
      Object.values(w.contributions).forEach(c => {
        if (c && c.date) datesSet.add(c.date);
      });
    }
  });
  console.log('All unique dates in ward_funds:', [...datesSet].sort());
}

findExact517();
