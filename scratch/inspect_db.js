import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function inspectData() {
  const { count: hhCount, data: hhData } = await supabase.from('households').select('*', { count: 'exact' });
  const { count: resCount } = await supabase.from('residents').select('*', { count: 'exact' });
  const { count: wfCount, data: wfData } = await supabase.from('ward_funds').select('*', { count: 'exact' });
  const { count: hfCount, data: hfData } = await supabase.from('household_funds').select('*', { count: 'exact' });
  const { count: finCount, data: finData } = await supabase.from('financial_records').select('*', { count: 'exact' });

  console.log('Households count:', hhCount);
  console.log('Residents count:', resCount);
  console.log('Ward funds count:', wfCount);
  console.log('Household funds count:', hfCount);
  console.log('Financial records count:', finCount);

  // Analyze ward funds
  if (wfData) {
    const fundTotals = {};
    const paidByFund = {};
    let paidFullCount = 0;
    let paidAnyCount = 0;

    wfData.forEach(w => {
      const contribs = w.contributions || {};
      let hasPaid = false;
      let isFull = true;

      for (const [fName, c] of Object.entries(contribs)) {
        fundTotals[fName] = fundTotals[fName] || { expected: 0, actual: 0 };
        fundTotals[fName].expected += (c.expected || 0);
        fundTotals[fName].actual += (c.actual || 0);

        if (c.actual > 0) {
          paidByFund[fName] = (paidByFund[fName] || 0) + 1;
          hasPaid = true;
        }
        if ((c.expected || 0) > (c.actual || 0)) {
          isFull = false;
        }
      }
      if (hasPaid) paidAnyCount++;
      if (isFull && Object.keys(contribs).length > 0) paidFullCount++;
    });

    console.log('Ward Funds Summary:', JSON.stringify(fundTotals, null, 2));
    console.log('Paid by Fund (person count):', JSON.stringify(paidByFund, null, 2));
    console.log('Paid Any Count (persons):', paidAnyCount, 'Paid Full Count (persons):', paidFullCount);
  }

  if (hfData) {
    const hfTotals = {};
    const hfHouseholds = new Set();
    hfData.forEach(h => {
      hfTotals[h.fund_name] = (hfTotals[h.fund_name] || 0) + (h.amount || 0);
      if (h.amount > 0) hfHouseholds.add(h.household_id);
    });
    console.log('Household Funds Summary:', JSON.stringify(hfTotals, null, 2));
    console.log('Households paid TDP funds:', hfHouseholds.size);
  }
}

inspectData();
