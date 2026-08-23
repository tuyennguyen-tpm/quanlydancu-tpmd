import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function analyzeKeys() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  const keyStats = {};
  allWardFunds.forEach(w => {
    Object.entries(w.contributions || {}).forEach(([k, v]) => {
      keyStats[k] = keyStats[k] || { count: 0, actualSum: 0, expectedSum: 0, actualCount: 0 };
      keyStats[k].count++;
      keyStats[k].actualSum += (v.actual || 0);
      keyStats[k].expectedSum += (v.expected || 0);
      if ((v.actual || 0) > 0) keyStats[k].actualCount++;
    });
  });

  console.log('Key Stats across 3323 ward_funds:');
  console.table(keyStats);
}

analyzeKeys();
