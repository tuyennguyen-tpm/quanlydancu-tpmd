import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

function norm(s) {
  return (s || '').toLowerCase().replace(/^\[.*?\]\s*/, '').replace(/^quỹ\s+/, '').replace(/\s+/g, ' ').trim();
}

async function findConflicts() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  let conflictCount = 0;
  let sampleConflicts = [];

  allWardFunds.forEach(w => {
    const map = {};
    Object.entries(w.contributions || {}).forEach(([k, v]) => {
      const n = norm(k);
      map[n] = map[n] || [];
      map[n].push({ key: k, actual: v.actual, expected: v.expected, date: v.date });
    });

    let hasConflict = false;
    Object.entries(map).forEach(([n, entries]) => {
      if (entries.length > 1) {
        const actuals = entries.map(e => e.actual || 0);
        const minAct = Math.min(...actuals);
        const maxAct = Math.max(...actuals);
        if (minAct !== maxAct) {
          hasConflict = true;
        }
      }
    });

    if (hasConflict) {
      conflictCount++;
      if (sampleConflicts.length < 5) {
        sampleConflicts.push({ id: w.id, name: w.full_name, map });
      }
    }
  });

  console.log(`Records with conflicting actual values among aliased keys: ${conflictCount}`);
  console.log('Sample conflicts:\n', JSON.stringify(sampleConflicts, null, 2));
}

findConflicts();
