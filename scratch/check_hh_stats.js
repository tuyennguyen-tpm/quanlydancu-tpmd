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

function removeAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

async function checkHouseholdStats() {
  let allWardFunds = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('ward_funds').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allWardFunds = [...allWardFunds, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  const { data: households } = await supabase.from('households').select('*');
  const { data: residents } = await supabase.from('residents').select('*');

  console.log(`HH: ${households.length}, Res: ${residents.length}, WF: ${allWardFunds.length}`);

  // Create household maps
  const hhMapById = new Map();
  households.forEach(h => hhMapById.set(h.id, h));

  const resByNormName = new Map();
  residents.forEach(r => {
    const k = removeAccents(r.full_name);
    if (!resByNormName.has(k)) resByNormName.set(k, []);
    resByNormName.get(k).push(r);
  });

  const headNameMap = new Map();
  households.forEach(h => {
    const r = residents.find(res => res.id === h.head_of_household_id || (res.household_id === h.id && res.is_head));
    headNameMap.set(h.id, r?.full_name || h.martyr_name || '');
  });

  // Match each WF record to HH
  const hhGroups = new Map();

  allWardFunds.forEach(f => {
    const nameNorm = removeAccents(f.full_name || '');
    const addrClean = (f.address || '').trim().toLowerCase();
    const addrNorm = removeAccents(f.address || '');

    let hhId = undefined;

    // a. Check resident
    const cands = resByNormName.get(nameNorm) || [];
    if (cands.length === 1 && cands[0].household_id) {
      hhId = cands[0].household_id;
    } else if (cands.length > 1) {
      const match = cands.find(c => {
        const hh = hhMapById.get(c.household_id);
        if (!hh) return false;
        const hhAddr = removeAccents(hh.address || '');
        return hhAddr === addrNorm || addrNorm.includes(hhAddr) || hhAddr.includes(addrNorm);
      });
      if (match) hhId = match.household_id;
      else hhId = cands[0].household_id;
    }

    // b. Match by head of household name in address or headNameMap
    if (!hhId && addrClean) {
      const matchedHh = households.find(h => {
        const hName = removeAccents(headNameMap.get(h.id) || '');
        return hName && (addrClean.includes(hName) || addrNorm.includes(hName));
      });
      if (matchedHh) hhId = matchedHh.id;
    }

    if (!hhId) {
      hhId = addrNorm ? `addr__${addrNorm}` : `name__${nameNorm}`;
    }

    if (!hhGroups.has(hhId)) hhGroups.set(hhId, []);
    hhGroups.get(hhId).push(f);
  });

  console.log(`Total Grouped Households: ${hhGroups.size}`);

  let paidFullHouseholds = 0;
  let paidAnyHouseholds = 0;
  let unpaidHouseholds = 0;

  hhGroups.forEach((members, gId) => {
    let totalExp = 0;
    let totalAct = 0;

    members.forEach(m => {
      Object.entries(m.contributions || {}).forEach(([k, v]) => {
        totalExp += (v.expected || 0);
        totalAct += (v.actual || 0);
      });
    });

    if (totalExp > 0 && totalAct >= totalExp) paidFullHouseholds++;
    if (totalAct > 0) paidAnyHouseholds++;
    else unpaidHouseholds++;
  });

  console.log(`Paid Full Households: ${paidFullHouseholds} / ${hhGroups.size} (${Math.round(paidFullHouseholds / hhGroups.size * 100)}%)`);
  console.log(`Paid Any Households: ${paidAnyHouseholds}`);
  console.log(`Unpaid Households: ${unpaidHouseholds}`);
}

checkHouseholdStats();
