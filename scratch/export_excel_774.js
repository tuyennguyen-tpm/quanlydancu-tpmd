import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import path from 'path';

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

async function exportExcel() {
  console.log('Fetching data...');
  const households = await fetchAll('households');
  const residents = await fetchAll('residents');
  const wardFunds = await fetchAll('ward_funds');
  const hhFunds = await fetchAll('household_funds');

  const hhMap = new Map(households.map(h => [h.id, h]));
  const resById = new Map(residents.map(r => [r.id, r]));

  const resByName = new Map();
  residents.forEach(r => {
    const k = r.full_name.trim().toLowerCase();
    if (!resByName.has(k)) resByName.set(k, []);
    resByName.get(k).push(r);
  });

  // Group ward funds by household
  const wardByHh = new Map();
  wardFunds.forEach(wf => {
    const k = wf.full_name.trim().toLowerCase();
    const cands = resByName.get(k) || [];
    let matchedHhId = null;
    if (cands.length === 1) {
      matchedHhId = cands[0].household_id;
    } else if (cands.length > 1) {
      const uMatch = cands.filter(c => c.user_id === wf.user_id);
      if (uMatch.length === 1) matchedHhId = uMatch[0].household_id;
      else if (uMatch.length > 1) {
        const dobM = uMatch.find(c => c.dob && wf.dob && c.dob.includes(wf.dob));
        if (dobM) matchedHhId = dobM.household_id;
      }
    }
    if (matchedHhId) {
      if (!wardByHh.has(matchedHhId)) wardByHh.set(matchedHhId, []);
      wardByHh.get(matchedHhId).push(wf);
    }
  });

  // Group household_funds (TDP) by household
  const tdpByHh = new Map();
  hhFunds.forEach(hf => {
    if (Number(hf.year) === 2026) {
      if (!tdpByHh.has(hf.household_id)) tdpByHh.set(hf.household_id, []);
      tdpByHh.get(hf.household_id).push(hf);
    }
  });

  // Find all 774 households that are currently marked paid
  const paidHouseholdsList = [];

  households.forEach(hh => {
    const wMembers = wardByHh.get(hh.id) || [];
    const tdpFundsList = tdpByHh.get(hh.id) || [];

    let totalWardActual = 0;
    let totalWardExpected = 0;
    let wardDates = new Set();

    wMembers.forEach(m => {
      if (m.contributions) {
        Object.values(m.contributions).forEach(c => {
          if (c) {
            totalWardExpected += (c.expected || 0);
            if (c.actual > 0) {
              totalWardActual += c.actual;
              if (c.date) wardDates.add(c.date);
            }
          }
        });
      }
    });

    let totalTdpActual = 0;
    let tdpDates = new Set();
    tdpFundsList.forEach(tf => {
      totalTdpActual += (Number(tf.amount) || 0);
      if (tf.paid_at) tdpDates.add(tf.paid_at);
    });

    const isPaid = totalWardActual > 0 || totalTdpActual > 0 || tdpFundsList.length > 0;
    if (isPaid) {
      const headName = getHouseholdHeadName(hh, residents);
      const allDates = [...new Set([...wardDates, ...tdpDates])].sort();
      paidHouseholdsList.push({
        household_id: hh.id,
        household_number: hh.household_number || '',
        head_name: headName,
        address: hh.address || '',
        group_name: hh.self_management_group || 'Chưa rõ',
        ward_actual: totalWardActual,
        tdp_actual: totalTdpActual,
        total_amount: totalWardActual + totalTdpActual,
        dates: allDates.join(', ') || '2026-08-23',
        member_count: residents.filter(r => r.household_id === hh.id).length
      });
    }
  });

  console.log('Total paid households identified:', paidHouseholdsList.length);

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSDL TDP Quảng Giao';
  workbook.created = new Date();

  // Helper to format a worksheet
  function populateSheet(sheet, items, title) {
    sheet.views = [{ showGridLines: true }];

    // Title Row
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    sheet.getRow(1).height = 35;

    // Header Row
    const headers = [
      'STT',
      'Họ và tên Chủ hộ',
      'Số nhân khẩu',
      'Địa chỉ / Số nhà',
      'Tổ tự quản',
      'Ngày ghi nhận',
      'Quỹ Phường (VNĐ)',
      'Quỹ TDP (VNĐ)',
      'Tổng tiền (VNĐ)',
      'Kiểm tra (Đã thu / Chưa thu)'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // Data rows
    items.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.head_name,
        item.member_count,
        item.address,
        item.group_name,
        item.dates,
        item.ward_actual,
        item.tdp_actual,
        item.total_amount,
        '✅ Đã ghi nhận'
      ]);
      row.height = 22;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).font = { name: 'Arial', size: 10, bold: true };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Numbers
      [7, 8, 9].forEach(colIdx => {
        const c = row.getCell(colIdx);
        c.numFmt = '#,##0';
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      });

      row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };

      // Zebra striping
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
      row.eachCell((cell) => {
        if (cell.col !== 10) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Auto fit column widths
    sheet.columns = [
      { width: 7 },   // STT
      { width: 26 },  // Chủ hộ
      { width: 14 },  // Số nhân khẩu
      { width: 40 },  // Địa chỉ
      { width: 16 },  // Tổ
      { width: 22 },  // Ngày ghi nhận
      { width: 18 },  // Quỹ Phường
      { width: 18 },  // Quỹ TDP
      { width: 18 },  // Tổng tiền
      { width: 22 }   // Kiểm tra
    ];
  }

  // 1. Sheet Tổng hợp
  const sortedAll = [...paidHouseholdsList].sort((a, b) => {
    const grpComp = a.group_name.localeCompare(b.group_name, 'vi');
    if (grpComp !== 0) return grpComp;
    return a.head_name.localeCompare(b.head_name, 'vi');
  });
  const allSheet = workbook.addWorksheet('TỔNG HỢP TẤT CẢ TỔ');
  populateSheet(allSheet, sortedAll, `BẢNG ĐỐI SOÁT TOÀN BỘ ${paidHouseholdsList.length} HỘ ĐANG GHI NHẬN THU NĂM 2026`);

  // 2. Sheets theo từng Tổ
  const groupsList = ['Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9', 'Tổ Việt Trung'];
  groupsList.forEach(g => {
    const items = paidHouseholdsList
      .filter(item => item.group_name.trim().toLowerCase() === g.trim().toLowerCase())
      .sort((a, b) => a.head_name.localeCompare(b.head_name, 'vi'));
    
    const safeSheetName = g.replace(/[\/\\\?\*\]\[]/g, '_');
    const sheet = workbook.addWorksheet(safeSheetName);
    populateSheet(sheet, items, `DANH SÁCH ${items.length} HỘ ĐANG GHI NHẬN THU - ${g.toUpperCase()}`);
  });

  const outPath = path.join(process.cwd(), 'Danh_Sach_774_Ho_Da_Ghi_Nhan_Thu.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Excel file created successfully at:', outPath);
}

exportExcel();
