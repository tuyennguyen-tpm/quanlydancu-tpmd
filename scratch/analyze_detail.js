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

async function analyzeHouseholdsDetail() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');

  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhMap = new Map(households.map(h => [h.id, h]));

  // For each household in households:
  // Check if it was paid in ward_funds (excluding 2026-09-01 repair date)
  let realPaidHhs = [];
  let repairOnlyHhs = [];
  let notPaidHhs = [];

  households.forEach(hh => {
    // find members
    const hhResidents = residents.filter(r => r.household_id === hh.id);
    const memberNames = hhResidents.map(r => r.full_name.trim().toLowerCase());
    
    // find matching wardFunds
    const memberWardFunds = wardFunds.filter(w => {
      const wName = w.full_name.trim().toLowerCase();
      return memberNames.includes(wName) && (w.user_id ? hh.user_id === w.user_id : true);
    });

    let earliestDate = null;
    let dates = [];
    let hasActual = false;
    let onlyTodayDate = true;

    memberWardFunds.forEach(mw => {
      if (mw.contributions) {
        Object.values(mw.contributions).forEach(c => {
          if (c && c.actual > 0) {
            hasActual = true;
            if (c.date) {
              dates.push(c.date);
              if (c.date !== '2026-09-01') onlyTodayDate = false;
            }
          }
        });
      }
    });

    if (hasActual) {
      if (onlyTodayDate) {
        repairOnlyHhs.push({ id: hh.id, address: hh.address, martyr_name: hh.martyr_name });
      } else {
        realPaidHhs.push({ id: hh.id, address: hh.address, martyr_name: hh.martyr_name, dates: [...new Set(dates)] });
      }
    } else {
      notPaidHhs.push({ id: hh.id, address: hh.address, martyr_name: hh.martyr_name });
    }
  });

  console.log('Real Paid Households (collected on specific dates in July/Aug):', realPaidHhs.length);
  console.log('Auto-repaired today only (2026-09-01):', repairOnlyHhs.length);
  console.log('Not paid households:', notPaidHhs.length);
  console.log('Total households checked:', realPaidHhs.length + repairOnlyHhs.length + notPaidHhs.length);
}

analyzeHouseholdsDetail();
