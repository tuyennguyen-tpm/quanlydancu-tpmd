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

async function checkDateBreakdown() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');

  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhDates = new Map(); // hhId -> Set(dates)
  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let hhId = null;
    if (cands.length === 1) hhId = cands[0].household_id;
    else if (cands.length > 1 && wf.user_id) {
      const match = cands.find(c => c.user_id === wf.user_id);
      if (match) hhId = match.household_id;
    }
    if (hhId && wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0 && c.date) {
          if (!hhDates.has(hhId)) hhDates.set(hhId, new Set());
          hhDates.get(hhId).add(c.date);
        }
      });
    }
  });

  const dateList = [
    '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27',
    '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31',
    '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
    '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'
  ];

  let cumulativeHhs = new Set();
  dateList.forEach(d => {
    let dayCount = 0;
    hhDates.forEach((dates, hhId) => {
      if (dates.has(d)) {
        dayCount++;
        cumulativeHhs.add(hhId);
      }
    });
    console.log(`Date: ${d} | New/Collected today: ${dayCount} | Cumulative Households: ${cumulativeHhs.size}`);
  });
}

checkDateBreakdown();
