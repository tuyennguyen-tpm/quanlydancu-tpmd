import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function inspectDuplicates() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total Ward Funds fetched:', allWardFunds.length);

  let duplicateKeysCount = 0;
  let sampleDupes = [];

  allWardFunds.forEach(w => {
    const keys = Object.keys(w.contributions || {});
    // Check if there are keys that normalize to the same fund
    const normalizedKeys = new Map();
    for (const k of keys) {
      const norm = k.toLowerCase().replace(/^\[.*?\]\s*/, '').replace(/^quỹ\s+/, '').replace(/\s+/g, ' ').trim();
      if (normalizedKeys.has(norm)) {
        duplicateKeysCount++;
        sampleDupes.push({
          id: w.id,
          name: w.full_name,
          keys,
          contribs: w.contributions
        });
        break;
      }
      normalizedKeys.set(norm, k);
    }
  });

  console.log('Records with duplicate/overlapping fund keys in contributions:', duplicateKeysCount);
  if (sampleDupes.length > 0) {
    console.log('Sample duplicate:', JSON.stringify(sampleDupes[0], null, 2));
  }
}

inspectDuplicates();
