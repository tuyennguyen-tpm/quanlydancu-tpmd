import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

function getContributionData(contributions, fundName) {
  if (!contributions) return undefined;
  if (contributions[fundName]) return contributions[fundName];
  const norm = (s) => (s || '').toLowerCase().replace(/^\[.*?\]\s*/, '').replace(/^quỹ\s+/, '').replace(/\s+/g, ' ').trim();
  const target = norm(fundName);
  for (const k of Object.keys(contributions)) {
    if (norm(k) === target) return contributions[k];
  }
  for (const k of Object.keys(contributions)) {
    const nk = norm(k);
    if (nk && target && (nk.includes(target) || target.includes(nk))) return contributions[k];
  }
  return undefined;
}

async function debugCalculations() {
  const { data: households } = await supabase.from('households').select('*');
  const { data: residents } = await supabase.from('residents').select('*');
  const { data: wardFunds } = await supabase.from('ward_funds').select('*');
  const { data: householdFunds } = await supabase.from('household_funds').select('*');

  console.log(`Loaded: ${households.length} HH, ${residents.length} Res, ${wardFunds.length} WardFunds, ${householdFunds.length} HHFunds`);

  // Active ward funds from config
  const activeFunds = [
    { name: 'Quỹ phòng chống thiên tai', target: 10000, scope: 'person' },
    { name: 'Quỹ Đền ơn đáp nghĩa', target: 20000, scope: 'person' },
    { name: 'Chăm sóc người cao tuổi', target: 20000, scope: 'household' }
  ];

  // Group ward funds by household using matching logic
  // Let's see how many groups/households are identified
  const hhMap = new Map();
  wardFunds.forEach(f => {
    // simplified matching or by household_id
    const key = f.address || f.full_name;
    if (!hhMap.has(key)) hhMap.set(key, []);
    hhMap.get(key).push(f);
  });

  // Calculate stats for each fund
  activeFunds.forEach(fund => {
    let totalActual = 0;
    let totalExpected = 0;
    let paidRecords = 0;
    let paidHouseholds = 0;

    wardFunds.forEach(f => {
      const c = getContributionData(f.contributions, fund.name);
      if (c) {
        totalActual += (c.actual || 0);
        totalExpected += (c.expected || 0);
        if ((c.actual || 0) > 0) paidRecords++;
      }
    });

    hhMap.forEach(members => {
      const hhFundActual = members.reduce((sum, m) => {
        const c = getContributionData(m.contributions, fund.name);
        return sum + (c?.actual || 0);
      }, 0);
      if (hhFundActual > 0) paidHouseholds++;
    });

    console.log(`\nFund: ${fund.name}`);
    console.log(`- Total Actual: ${totalActual.toLocaleString('vi-VN')} đ`);
    console.log(`- Total Expected from DB: ${totalExpected.toLocaleString('vi-VN')} đ`);
    console.log(`- Paid individual records count: ${paidRecords}`);
    console.log(`- Paid households count: ${paidHouseholds}`);
  });

  // Check Quỹ TDP (householdFunds)
  console.log('\n--- Household Funds (TDP) ---');
  const tdpFundsMap = new Map();
  householdFunds.forEach(hf => {
    tdpFundsMap.set(hf.fund_name, (tdpFundsMap.get(hf.fund_name) || 0) + (hf.amount || 0));
  });
  tdpFundsMap.forEach((amt, name) => {
    console.log(`- ${name}: ${amt.toLocaleString('vi-VN')} đ`);
  });
}

debugCalculations();
