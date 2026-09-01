import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function inspectPaymentStatus() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total Ward Funds:', allWardFunds.length);

  const { data: hhFunds } = await supabase.from('household_funds').select('*');
  console.log('Total Household Funds (TDP):', hhFunds?.length || 0);

  const { data: finRecords } = await supabase.from('financial_records').select('*');
  console.log('Total Financial Records:', finRecords?.length || 0);

  // Analyze ward_funds
  const notesCount = {};
  let totalWithActual = 0;
  let totalZeroActual = 0;
  let datesCount = {};

  allWardFunds.forEach(wf => {
    const note = wf.note || '(none)';
    notesCount[note] = (notesCount[note] || 0) + 1;

    let hasActual = false;
    if (wf.contributions) {
      Object.values(wf.contributions).forEach(c => {
        if (c && c.actual > 0) hasActual = true;
        if (c && c.date) {
          datesCount[c.date] = (datesCount[c.date] || 0) + 1;
        }
      });
    }
    if (hasActual) totalWithActual++;
    else totalZeroActual++;
  });

  console.log('\n--- Ward Funds Note Distribution ---');
  console.log(notesCount);

  console.log('\n--- Ward Funds Actual Stats ---');
  console.log({ totalWithActual, totalZeroActual });

  console.log('\n--- Contribution Dates Distribution ---');
  console.log(datesCount);
}

inspectPaymentStatus();
