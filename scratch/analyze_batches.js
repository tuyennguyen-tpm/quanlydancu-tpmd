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

async function analyzeBatches() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');

  // Let's inspect household_funds created_at timestamps
  // Group by household_id
  const hhByFirstCreated = new Map();
  hhFunds.forEach(hf => {
    const hhId = hf.household_id;
    if (!hhByFirstCreated.has(hhId)) {
      hhByFirstCreated.set(hhId, {
        household_id: hhId,
        created_at: hf.created_at,
        paid_at: hf.paid_at,
        year: hf.year,
        count: 0
      });
    }
    hhByFirstCreated.get(hhId).count++;
  });

  const timestamps = {};
  hhByFirstCreated.forEach(v => {
    // Round to minute or second
    const minute = (v.created_at || '').slice(0, 16);
    timestamps[minute] = (timestamps[minute] || 0) + 1;
  });

  console.log('--- household_funds Creation Timestamps (by minute) ---');
  console.log(timestamps);

  // Check ward_funds: For each resident/person, what is their updated/created timestamp or contribution date?
  const wardDateFreq = {};
  wardFunds.forEach(wf => {
    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0 && c.date) {
          wardDateFreq[c.date] = (wardDateFreq[c.date] || 0) + 1;
        }
      });
    }
  });
  console.log('\n--- Ward Funds positive contribution dates ---');
  console.log(wardDateFreq);
}

analyzeBatches();
