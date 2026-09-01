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

async function simulateRollback() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');

  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhMap = new Map(households.map(h => [h.id, h]));

  // Simulate rolling back ward_funds to <= 2026-08-15
  const simulatedWf = wardFunds.map(wf => {
    const newContrib = {};
    let hasActual = false;
    if (wf.contributions) {
      Object.entries(wf.contributions).forEach(([k, c]) => {
        if (c) {
          if (c.actual > 0 && c.date && c.date <= '2026-08-15') {
            newContrib[k] = { ...c };
            hasActual = true;
          } else {
            newContrib[k] = {
              expected: c.expected || 0,
              actual: 0,
              date: ''
            };
          }
        }
      });
    }
    return {
      ...wf,
      contributions: newContrib,
      note: hasActual ? wf.note : ''
    };
  });

  // Count distinct paid households
  const paidHhMap = new Map();
  simulatedWf.forEach(wf => {
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
          if (hhId) {
            paidHhMap.set(hhId, (paidHhMap.get(hhId) || 0) + c.actual);
          }
        }
      });
    }
  });

  console.log('Resulting paid households after rollback to 15/08/2026:', paidHhMap.size);

  // Group by Tổ
  const paidByTo = {};
  paidHhMap.forEach((amt, hhId) => {
    const hh = hhMap.get(hhId);
    const to = hh?.self_management_group || 'Chưa rõ';
    paidByTo[to] = (paidByTo[to] || 0) + 1;
  });

  console.log('Resulting paid households by Tổ:');
  console.log(paidByTo);
}

simulateRollback();
