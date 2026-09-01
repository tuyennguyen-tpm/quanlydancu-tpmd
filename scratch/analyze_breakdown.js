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

async function analyzeNotes() {
  const wardFunds = await fetchAll('ward_funds');
  
  let noteMarkedWithActualZero = 0;
  let noteMarkedWithActualPos = 0;
  let noNoteWithActualPos = 0;
  let noNoteWithActualZero = 0;

  wardFunds.forEach(wf => {
    let hasActual = false;
    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0) hasActual = true;
      });
    }
    const hasNote = wf.note === 'Đã nộp đủ đợt tập trung';

    if (hasNote && !hasActual) noteMarkedWithActualZero++;
    if (hasNote && hasActual) noteMarkedWithActualPos++;
    if (!hasNote && hasActual) noNoteWithActualPos++;
    if (!hasNote && !hasActual) noNoteWithActualZero++;
  });

  console.log('--- Breakdown of ward_funds ---');
  console.log({
    noteMarkedWithActualZero,
    noteMarkedWithActualPos,
    noNoteWithActualPos,
    noNoteWithActualZero
  });
}

analyzeNotes();
