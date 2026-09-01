import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = 'https://yvtmckpdpinipxyvphdm.supabase.co';
const key = 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8';
const supabase = createClient(url, key);

async function fetchAll(table) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getHouseholdHeadName(hh, residents) {
  if (hh.head_of_household_id) {
    const r = residents.find(res => res.id === hh.head_of_household_id);
    if (r) return r.full_name;
  }
  if (hh.martyr_name) return hh.martyr_name;
  const hhRes = residents.filter(r => r.household_id === hh.id);
  const headRes = hhRes.find(r => r.is_head);
  if (headRes) return headRes.full_name;
  if (hhRes.length > 0) return hhRes[0].full_name;
  return 'Chủ hộ';
}

async function executeRollback() {
  console.log('=== 1. FETCHING CURRENT DATABASE TABLES ===');
  const [households, residents, wardFunds, hhFunds, finRecords] = await Promise.all([
    fetchAll('households'),
    fetchAll('residents'),
    fetchAll('ward_funds'),
    fetchAll('household_funds'),
    fetchAll('financial_records')
  ]);

  console.log(`Fetched: ${households.length} households, ${residents.length} residents, ${wardFunds.length} ward_funds, ${hhFunds.length} household_funds, ${finRecords.length} fin_records.`);

  // Backup to disk
  const backupData = {
    timestamp: new Date().toISOString(),
    wardFunds,
    hhFunds,
    finRecords
  };
  const backupPath = path.join(process.cwd(), 'backup_before_rollback_15aug.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log('Backup saved to:', backupPath);

  // Build lookups
  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  const hhMap = new Map(households.map(h => [h.id, h]));

  console.log('=== 2. PROCESSING WARD FUNDS (KEEP ONLY <= 2026-08-15) ===');
  const updatedWardFunds = [];
  const validPaidHhIds = new Set();
  const validPaidHhDates = new Map(); // hhId -> date

  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let hhId = null;
    if (cands.length === 1) hhId = cands[0].household_id;
    else if (cands.length > 1 && wf.user_id) {
      const match = cands.find(c => c.user_id === wf.user_id);
      if (match) hhId = match.household_id;
    }

    let hasValidActual = false;
    const newContrib = {};

    if (wf.contributions) {
      Object.entries(wf.contributions).forEach(([fundName, c]) => {
        if (c) {
          // Keep only payments on or before 15/08/2026
          if (c.actual > 0 && c.date && c.date <= '2026-08-15') {
            newContrib[fundName] = { ...c };
            hasValidActual = true;
            if (hhId) {
              validPaidHhIds.add(hhId);
              if (!validPaidHhDates.has(hhId)) validPaidHhDates.set(hhId, c.date);
            }
          } else {
            newContrib[fundName] = {
              expected: c.expected || 0,
              actual: 0,
              date: ''
            };
          }
        }
      });
    }

    updatedWardFunds.push({
      ...wf,
      contributions: newContrib,
      note: hasValidActual ? 'Đã nộp đủ đợt tập trung' : ''
    });
  });

  console.log(`Valid paid households up to 15/08/2026: ${validPaidHhIds.size}`);

  // Save updated ward_funds to Supabase
  console.log('Saving updated ward_funds to Supabase in batches...');
  for (let i = 0; i < updatedWardFunds.length; i += 100) {
    const batch = updatedWardFunds.slice(i, i + 100);
    const { error } = await supabase.from('ward_funds').upsert(batch);
    if (error) {
      console.error(`Error saving ward_funds batch ${i}:`, error);
    }
  }
  console.log('Ward funds updated successfully!');

  console.log('=== 3. CLEANING & RE-SYNCING TDP FUNDS & SỔ THU CHI ===');
  // 1. Delete all household_funds for 2026
  const { error: delHhError } = await supabase.from('household_funds').delete().eq('year', 2026);
  if (delHhError) console.error('Error deleting household_funds 2026:', delHhError);
  else console.log('Deleted old household_funds for 2026.');

  // 2. Delete auto-generated financial_records for funds
  const autoFinIds = finRecords
    .filter(r => r.recorded_by === 'Hệ thống tự động' || (r.description && r.description.includes('[QUY_')))
    .map(r => r.id);
  
  if (autoFinIds.length > 0) {
    for (let i = 0; i < autoFinIds.length; i += 200) {
      const batchIds = autoFinIds.slice(i, i + 200);
      const { error: delFinError } = await supabase.from('financial_records').delete().in('id', batchIds);
      if (delFinError) console.error(`Error deleting financial_records batch ${i}:`, delFinError);
    }
    console.log(`Deleted ${autoFinIds.length} auto-generated financial records.`);
  }

  // 3. Re-create TDP funds & General financial records for ONLY the valid paid households
  const tdpFundsToInsert = [];
  const finRecordsToInsert = [];

  // Active TDP funds standard list
  const tdpFundList = [
    { name: 'Kinh phí cho điện chiếu sáng của 7 nhà văn hóa', target: 20000 },
    { name: 'Kinh phí bảo vệ, vệ sinh Nhà văn hóa', target: 6000 },
    { name: 'Internet nhà văn hóa TDP', target: 2200 },
    { name: 'Kinh phí chè nước cho các hội họp TDP', target: 5000 },
    { name: 'Kinh phí tổ chức tang lễ', target: 24000 },
    { name: 'Kinh phí chi hoạt động văn hóa - an sinh xã hội', target: 50000 },
    { name: 'Quỹ khuyến học', target: 50000 },
    { name: 'Kinh phí chi hoạt động chăm sóc thiếu niên, nhi đồng.', target: 50000 }
  ];

  validPaidHhIds.forEach(hhId => {
    const hh = hhMap.get(hhId);
    if (!hh) return;

    const headName = getHouseholdHeadName(hh, residents);
    const paidDate = validPaidHhDates.get(hhId) || '2026-08-08';

    const isKhuyenHocExempt = (() => {
      const hhAddr = ((hh.address || '') + ' ' + (hh.self_management_group || '')).toLowerCase();
      return hhAddr.includes('tổ 8') || hhAddr.includes('to 8') || (hh.self_management_group || '').trim() === 'Tổ 8' || (hh.self_management_group || '').trim() === '8';
    })();

    tdpFundList.forEach(fund => {
      const isExempt = fund.name.includes('khuyến học') && isKhuyenHocExempt;
      const amount = isExempt ? 0 : fund.target;
      const note = isExempt ? 'Đã thu trước' : 'Đã thu đủ theo thông báo';
      const recordId = generateUUID();

      const hhFundPayload = {
        id: recordId,
        user_id: hh.user_id || '00000000-0000-0000-0000-000000000000',
        household_id: hhId,
        year: 2026,
        fund_name: fund.name,
        amount: amount,
        paid_at: paidDate,
        note: note,
        created_at: `${paidDate}T08:00:00.000Z`,
        ward_id: '00000000-0000-0000-0000-000000000000'
      };
      tdpFundsToInsert.push(hhFundPayload);

      if (amount > 0) {
        const flagText = `[QUY_${recordId}]`;
        const finRecordPayload = {
          id: generateUUID(),
          group_id: hh.user_id || '00000000-0000-0000-0000-000000000000',
          type: 'income',
          amount: amount,
          category: fund.name,
          description: `Thu ${fund.name} - Hộ ${headName} ${flagText}`,
          recorded_by: 'Hệ thống tự động',
          date: paidDate,
          created_at: `${paidDate}T08:00:00.000Z`
        };
        finRecordsToInsert.push(finRecordPayload);
      }
    });
  });

  console.log(`Inserting ${tdpFundsToInsert.length} TDP fund records for ${validPaidHhIds.size} valid households...`);
  for (let i = 0; i < tdpFundsToInsert.length; i += 100) {
    const batch = tdpFundsToInsert.slice(i, i + 100);
    const { error } = await supabase.from('household_funds').insert(batch);
    if (error) console.error(`Error inserting household_funds batch ${i}:`, error);
  }

  console.log(`Inserting ${finRecordsToInsert.length} financial ledger records...`);
  for (let i = 0; i < finRecordsToInsert.length; i += 100) {
    const batch = finRecordsToInsert.slice(i, i + 100);
    const { error } = await supabase.from('financial_records').insert(batch);
    if (error) console.error(`Error inserting financial_records batch ${i}:`, error);
  }

  console.log('=== ROLLBACK TO 15/08/2026 COMPLETED SUCCESSFULLY! ===');
  console.log(`Final paid households count: ${validPaidHhIds.size}`);
}

executeRollback();
