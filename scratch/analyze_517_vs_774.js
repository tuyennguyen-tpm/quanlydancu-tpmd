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

async function analyze517vs774() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');
  const finRecords = await fetchAll('financial_records');

  console.log('Households count:', households.length);
  console.log('Residents count:', residents.length);
  console.log('Ward funds count:', wardFunds.length);
  console.log('Household funds count:', hhFunds.length);

  // Distinct households in household_funds (TDP)
  const tdpPaidHhIds = new Set(
    hhFunds
      .filter(hf => Number(hf.year) === 2026 && (hf.amount > 0 || (hf.note && hf.note.includes('Đã thu'))))
      .map(hf => hf.household_id)
      .filter(Boolean)
  );
  console.log('Distinct households in household_funds (TDP 2026):', tdpPaidHhIds.size);

  // Group ward funds by their matching household / resident
  // Let's see how many households have actual > 0 in ward_funds
  const resById = new Map(residents.map(r => [r.id, r]));
  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhMap = new Map(households.map(h => [h.id, h]));

  // Check how WardFunds are grouped currently and how many are "paid"
  // Let's check timestamps in household_funds
  const hhFundsByDate = {};
  const hhFundsByCreatedAt = {};
  hhFunds.forEach(hf => {
    hhFundsByDate[hf.paid_at || '(none)'] = (hhFundsByDate[hf.paid_at || '(none)'] || 0) + 1;
    const crDate = (hf.created_at || '').slice(0, 10);
    hhFundsByCreatedAt[crDate || '(none)'] = (hhFundsByCreatedAt[crDate || '(none)'] || 0) + 1;
  });

  console.log('\nhousehold_funds by paid_at:');
  console.log(hhFundsByDate);

  console.log('\nhousehold_funds by created_at date:');
  console.log(hhFundsByCreatedAt);

  // Check financial records count and distinct households
  const finFlagRegex = /\[QUY_([a-f0-9-]+)\]/i;
  const finRecordsWithHh = finRecords.filter(r => finFlagRegex.test(r.description || ''));
  console.log('\nFinancial records with [QUY_...]:', finRecordsWithHh.length);
}

analyze517vs774();
