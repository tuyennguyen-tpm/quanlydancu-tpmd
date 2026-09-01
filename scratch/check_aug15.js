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

async function checkAugust15() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');
  const finRecords = await fetchAll('financial_records');

  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  // Check in ward_funds:
  // If we filter contributions: keep only those with date <= '2026-08-15' and reset any date > '2026-08-15' to actual = 0, date = ''
  let householdsBeforeAug15 = new Set();
  let contributionsBeforeAug15 = 0;
  let contributionsAfterAug15 = 0;

  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let hhId = null;
    if (cands.length === 1) hhId = cands[0].household_id;
    else if (cands.length > 1 && wf.user_id) {
      const match = cands.find(c => c.user_id === wf.user_id);
      if (match) hhId = match.household_id;
    }

    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0) {
          if (c.date && c.date <= '2026-08-15') {
            contributionsBeforeAug15++;
            if (hhId) householdsBeforeAug15.add(hhId);
          } else {
            contributionsAfterAug15++;
          }
        }
      });
    }
  });

  console.log('--- Data On Or Before 15/08/2026 ---');
  console.log('Distinct Households collected on/before 15/08/2026:', householdsBeforeAug15.size);
  console.log('Contributions on/before 15/08/2026:', contributionsBeforeAug15);
  console.log('Contributions after 15/08/2026:', contributionsAfterAug15);

  // Check household_funds before/after Aug 15
  const hhFundsBeforeAug15 = hhFunds.filter(hf => (hf.paid_at && hf.paid_at <= '2026-08-15') || (hf.created_at && hf.created_at.slice(0, 10) <= '2026-08-15'));
  const hhFundsAfterAug15 = hhFunds.filter(hf => !( (hf.paid_at && hf.paid_at <= '2026-08-15') || (hf.created_at && hf.created_at.slice(0, 10) <= '2026-08-15') ));

  console.log('\nhousehold_funds on/before 15/08/2026:', hhFundsBeforeAug15.length);
  console.log('household_funds after 15/08/2026:', hhFundsAfterAug15.length);
}

checkAugust15();
