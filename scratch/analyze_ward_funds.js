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

async function analyze() {
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');

  console.log('Ward funds count:', wardFunds.length);
  
  // Group by updated_at or created_at if available
  const sampleWf = wardFunds.slice(0, 3);
  console.log('Sample ward fund fields:', Object.keys(sampleWf[0]));
  console.log('Sample ward fund [0]:', sampleWf[0]);

  // Check how many households in wardFunds have different dates across members or funds
  let distinctDatesPerRecord = new Map();
  wardFunds.forEach(wf => {
    if (wf.contributions) {
      Object.entries(wf.contributions).forEach(([k, v]) => {
        if (v && v.actual > 0 && v.date) {
          distinctDatesPerRecord.set(v.date, (distinctDatesPerRecord.get(v.date) || 0) + 1);
        }
      });
    }
  });

  console.log('Dates with positive actuals in ward_funds:');
  console.log(Object.fromEntries(distinctDatesPerRecord));
}

analyze();
