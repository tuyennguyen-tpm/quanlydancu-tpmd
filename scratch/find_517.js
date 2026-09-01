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

async function find517() {
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');

  // Let's inspect receipts or customizations
  const { data: receipts } = await supabase.from('receipt_customizations').select('key, created_at');
  console.log('Total receipt customizations (printed receipts):', receipts?.length || 0);

  // Analyze dates in ward_funds
  // Group ward_funds by household (using residents mapping)
  const resByName = new Map();
  const resById = new Map();
  residents.forEach(r => {
    resById.set(r.id, r);
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const householdPaidMap = new Map(); // hhId -> { dates: Set, totalActual: number, members: [] }

  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let hhId = null;
    if (cands.length === 1) hhId = cands[0].household_id;
    else if (cands.length > 1 && wf.user_id) {
      const match = cands.find(c => c.user_id === wf.user_id);
      if (match) hhId = match.household_id;
    }
    if (!hhId) hhId = 'UNMATCHED_' + wf.id;

    if (!householdPaidMap.has(hhId)) {
      householdPaidMap.set(hhId, { dates: new Set(), totalActual: 0, membersCount: 0, hasNote: false });
    }
    const item = householdPaidMap.get(hhId);
    item.membersCount++;
    if (wf.note === 'Đã nộp đủ đợt tập trung') item.hasNote = true;

    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0) {
          item.totalActual += c.actual;
          if (c.date) item.dates.add(c.date);
        }
      });
    }
  });

  let hhWithActualPos = 0;
  let hhWithNote = 0;
  let hhByDateSummary = {};

  householdPaidMap.forEach((v, k) => {
    if (v.totalActual > 0) hhWithActualPos++;
    if (v.hasNote) hhWithNote++;
    v.dates.forEach(d => {
      hhByDateSummary[d] = (hhByDateSummary[d] || 0) + 1;
    });
  });

  console.log('Households with totalActual > 0 in ward_funds:', hhWithActualPos);
  console.log('Households with note in ward_funds:', hhWithNote);
  console.log('Households by collection date in ward_funds:');
  console.log(hhByDateSummary);
}

find517();
