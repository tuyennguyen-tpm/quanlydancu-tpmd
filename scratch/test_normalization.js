import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

function normFundName(s) {
  const clean = (s || '').toLowerCase().replace(/^\[.*?\]\s*/, '').replace(/^quỹ\s+/, '').replace(/\s+/g, ' ').trim();
  if (clean.includes('thiên tai') || clean.includes('phòng chống')) return 'Quỹ phòng chống thiên tai';
  if (clean.includes('đáp nghĩa') || clean.includes('đền ơn')) return 'Quỹ Đền ơn đáp nghĩa';
  if (clean.includes('cao tuổi') || clean.includes('người cao tuổi')) return 'Chăm sóc người cao tuổi';
  return s;
}

async function testNormalization() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Fetched ${allWardFunds.length} ward funds records.`);

  const canonicalTotals = {
    'Quỹ phòng chống thiên tai': { actual: 0, expected: 0, paidCount: 0 },
    'Quỹ Đền ơn đáp nghĩa': { actual: 0, expected: 0, paidCount: 0 },
    'Chăm sóc người cao tuổi': { actual: 0, expected: 0, paidCount: 0 }
  };

  const normalizedRecords = allWardFunds.map(w => {
    const origContribs = w.contributions || {};
    const newContribs = {
      'Quỹ phòng chống thiên tai': { expected: 10000, actual: 0, date: '' },
      'Quỹ Đền ơn đáp nghĩa': { expected: 20000, actual: 0, date: '' },
      'Chăm sóc người cao tuổi': { expected: 0, actual: 0, date: '' }
    };

    Object.entries(origContribs).forEach(([k, v]) => {
      const canonical = normFundName(k);
      if (!newContribs[canonical]) {
        newContribs[canonical] = { expected: v.expected || 0, actual: 0, date: '' };
      }
      if ((v.actual || 0) > newContribs[canonical].actual) {
        newContribs[canonical].actual = v.actual || 0;
        if (v.date) newContribs[canonical].date = v.date;
      }
      if (v.expected !== undefined && v.expected > 0) {
        newContribs[canonical].expected = v.expected;
      }
      if (v.is_manual_exempt) newContribs[canonical].is_manual_exempt = true;
      if (v.is_manual_target) newContribs[canonical].is_manual_target = true;
    });

    Object.entries(newContribs).forEach(([cName, cVal]) => {
      if (canonicalTotals[cName]) {
        canonicalTotals[cName].actual += cVal.actual;
        canonicalTotals[cName].expected += cVal.expected;
        if (cVal.actual > 0) canonicalTotals[cName].paidCount++;
      }
    });

    return {
      ...w,
      contributions: newContribs
    };
  });

  console.log('\n--- Totals after merging aliased keys ---');
  console.table(canonicalTotals);
}

testNormalization();
