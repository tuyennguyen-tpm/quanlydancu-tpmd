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

async function testMatch() {
  const { data, error } = await supabase.from('ward_funds').select('id, full_name, contributions').not('contributions', 'is', null);
  if (error) {
    console.error(error);
    return;
  }

  let thienTaiPaidCount = 0;
  let denOnPaidCount = 0;
  let caoTuoiPaidCount = 0;

  let totalThienTaiActual = 0;
  let totalDenOnActual = 0;
  let totalCaoTuoiActual = 0;

  data.forEach(r => {
    const c1 = getContributionData(r.contributions, 'Quỹ phòng chống thiên tai');
    const c2 = getContributionData(r.contributions, 'Quỹ Đền ơn đáp nghĩa');
    const c3 = getContributionData(r.contributions, 'Chăm sóc người cao tuổi');

    if (c1 && c1.actual > 0) { thienTaiPaidCount++; totalThienTaiActual += c1.actual; }
    if (c2 && c2.actual > 0) { denOnPaidCount++; totalDenOnActual += c2.actual; }
    if (c3 && c3.actual > 0) { caoTuoiPaidCount++; totalCaoTuoiActual += c3.actual; }
  });

  console.log('--- MATCHING RESULTS ---');
  console.log(`Phòng chống thiên tai: ${thienTaiPaidCount} người nộp, Tổng đ: ${totalThienTaiActual.toLocaleString('vi-VN')}đ`);
  console.log(`Đền ơn đáp nghĩa: ${denOnPaidCount} người nộp, Tổng đ: ${totalDenOnActual.toLocaleString('vi-VN')}đ`);
  console.log(`Chăm sóc người cao tuổi: ${caoTuoiPaidCount} hộ/người nộp, Tổng đ: ${totalCaoTuoiActual.toLocaleString('vi-VN')}đ`);
}

testMatch();
