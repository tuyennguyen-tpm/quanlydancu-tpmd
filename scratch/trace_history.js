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

async function traceHistory() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');
  const finRecords = await fetchAll('financial_records');

  // Let's check dates of contributions in ward_funds per household
  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhMap = new Map(households.map(h => [h.id, h]));

  // For each household, check the earliest date, list of dates, and whether all funds have actual > 0
  const hhStats = [];

  households.forEach(hh => {
    const hhResidents = residents.filter(r => r.household_id === hh.id);
    const memberNames = hhResidents.map(r => r.full_name.trim().toLowerCase());

    const memberWardFunds = wardFunds.filter(w => {
      const wName = w.full_name.trim().toLowerCase();
      return memberNames.includes(wName) && (w.user_id ? hh.user_id === w.user_id : true);
    });

    let dates = new Set();
    let totalActual = 0;
    let totalExpected = 0;
    let hasNote = false;

    memberWardFunds.forEach(mw => {
      if (mw.note === 'Đã nộp đủ đợt tập trung') hasNote = true;
      if (mw.contributions) {
        Object.values(mw.contributions).forEach(c => {
          if (c) {
            totalExpected += (c.expected || 0);
            if (c.actual > 0) {
              totalActual += c.actual;
              if (c.date) dates.add(c.date);
            }
          }
        });
      }
    });

    if (totalActual > 0 || hasNote) {
      hhStats.push({
        id: hh.id,
        to: hh.self_management_group || 'Chưa rõ',
        address: hh.address,
        martyr_name: hh.martyr_name,
        dates: [...dates].sort(),
        totalActual,
        totalExpected,
        hasNote
      });
    }
  });

  console.log('Total households with paid status in ward_funds:', hhStats.length);

  // Group by distinct combinations of dates
  const dateCombos = {};
  hhStats.forEach(h => {
    const key = h.dates.join(', ') || '(no date)';
    dateCombos[key] = (dateCombos[key] || 0) + 1;
  });

  console.log('\n--- Date Combinations of Paid Households ---');
  console.log(dateCombos);
}

traceHistory();
