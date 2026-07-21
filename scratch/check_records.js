import { createClient } from '@supabase/supabase-js';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function run() {
  const { data: funds, error } = await supabase.from('ward_funds')
    .select('*')
    .eq('year', 2026)
    .eq('user_id', 'b3c31146-3399-4add-b600-7f39f34a1bac');
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total loaded funds count:', funds.length);
  
  const activeFunds = [
    { name: 'Quỹ phòng chống thiên tai', target: 10000 },
    { name: 'Quỹ Đền ơn đáp nghĩa', target: 20000 },
    { name: 'Chăm sóc  người cao tuổi', target: 20000 }
  ];

  activeFunds.forEach(fund => {
    let totalExp = 0;
    let totalAct = 0;
    let counts = 0;
    funds.forEach(f => {
      const contrib = f.contributions?.[fund.name];
      if (contrib) {
        totalExp += (contrib.expected || 0);
        totalAct += (contrib.actual || 0);
        counts++;
      }
    });
    console.log(`Fund "${fund.name}": count with contribution=${counts}, totalExpected=${totalExp}, totalActual=${totalAct}`);
  });
}

run();
