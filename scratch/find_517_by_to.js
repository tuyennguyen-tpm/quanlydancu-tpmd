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

async function findThe517() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');

  // Let's inspect how many households have distinct real payment records
  // Let's check which households were collected
  const hhMap = new Map(households.map(h => [h.id, h]));
  const resById = new Map(residents.map(r => [r.id, r]));

  // In wardFunds, let's group by households properly
  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const validHhMap = new Map(); // hhId -> { dates, totalPaid, members }

  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let matchedHhId = null;
    if (cands.length === 1) {
      matchedHhId = cands[0].household_id;
    } else if (cands.length > 1) {
      const uMatch = cands.filter(c => c.user_id === wf.user_id);
      if (uMatch.length === 1) matchedHhId = uMatch[0].household_id;
      else if (uMatch.length > 1) {
        // match dob
        const dobM = uMatch.find(c => c.dob && wf.dob && c.dob.includes(wf.dob));
        if (dobM) matchedHhId = dobM.household_id;
      }
    }

    if (matchedHhId) {
      if (!validHhMap.has(matchedHhId)) {
        validHhMap.set(matchedHhId, { hhId: matchedHhId, dates: new Set(), totalActual: 0, members: [] });
      }
      const entry = validHhMap.get(matchedHhId);
      entry.members.push(wf);
      if (wf.contributions) {
        Object.values(wf.contributions).forEach(c => {
          if (c && c.actual > 0) {
            entry.totalActual += c.actual;
            if (c.date) entry.dates.add(c.date);
          }
        });
      }
    }
  });

  console.log('Total valid matched households in ward_funds:', validHhMap.size);

  let paidHhCount = 0;
  let paidHhByTổ = {};

  validHhMap.forEach((v, hhId) => {
    if (v.totalActual > 0) {
      paidHhCount++;
      const hh = hhMap.get(hhId);
      const to = hh?.self_management_group || 'Chưa rõ';
      paidHhByTổ[to] = (paidHhByTổ[to] || 0) + 1;
    }
  });

  console.log('Paid Households count in valid matched households:', paidHhCount);
  console.log('Paid Households by Tổ:', paidHhByTổ);
}

findThe517();
