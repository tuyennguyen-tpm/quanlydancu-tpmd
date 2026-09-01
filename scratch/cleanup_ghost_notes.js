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

async function cleanGhostNotes() {
  const wardFunds = await fetchAll('ward_funds');
  const toUpdate = [];

  wardFunds.forEach(wf => {
    let totalAct = 0;
    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0) totalAct += Number(c.actual);
      });
    }

    if (totalAct === 0 && wf.note === 'Đã nộp đủ đợt tập trung') {
      toUpdate.push({
        ...wf,
        note: ''
      });
    }
  });

  console.log(`Found ${toUpdate.length} ghost note records to clean...`);

  if (toUpdate.length > 0) {
    // Upsert in batches of 50
    for (let i = 0; i < toUpdate.length; i += 50) {
      const batch = toUpdate.slice(i, i + 50);
      const { error } = await supabase.from('ward_funds').upsert(batch);
      if (error) console.error('Error batch:', error);
    }
    console.log('Cleaned ghost notes successfully!');
  }
}

cleanGhostNotes();
