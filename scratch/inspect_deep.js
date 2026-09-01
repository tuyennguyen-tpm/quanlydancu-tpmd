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

async function run() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');
  const finRecords = await fetchAll('financial_records');

  console.log('Total Households:', households.length);
  console.log('Total Residents:', residents.length);
  console.log('Total Ward Funds:', wardFunds.length);
  console.log('Total Household Funds (TDP):', hhFunds.length);
  console.log('Total Financial Records:', finRecords.length);

  // Check financial records categories and descriptions
  const finDescSample = finRecords.slice(0, 10).map(r => ({ desc: r.description, recorded_by: r.recorded_by, amount: r.amount, date: r.date }));
  console.log('Sample financial records:', finDescSample);

  // Check household funds sample
  console.log('Sample household funds:', hhFunds.slice(0, 5));
}

run();
