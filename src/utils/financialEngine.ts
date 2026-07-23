/**
 * Smart Financial Engine (Động cơ Tài chính Trung tâm & Kiểm toán Tự động)
 * Single Source of Truth cho toàn bộ ứng dụng CSDL TDP Quảng Giao.
 */

import type { Resident, Household, WardFund, HouseholdFund, FinancialRecord } from '../types';
import { calculateExactAge } from './dateUtils';

export interface AgeLimits {
  maleMin: number;
  maleMax: number;
  femaleMin: number;
  femaleMax: number;
  generalMin: number;
  generalMax: number;
}

export interface FundConfigItem {
  name: string;
  target: number;
  scope?: 'person' | 'household';
  age_range?: string;
}

export interface HouseholdFinancialSummary {
  householdId: string;
  headName: string;
  address: string;
  householdNumber: string;
  laborCount: number;
  laborResidents: Resident[];
  tdpLineItems: Array<{
    fundName: string;
    targetVal: number;
    paidAmount: number;
    displayAmount: number;
    noteText: string;
  }>;
  wardLineItems: Array<{
    fundName: string;
    isHouseholdScope: boolean;
    targetVal: number;
    expectedTotal: number;
    actualPaid: number;
    displayAmount: number;
    noteText: string;
  }>;
  tdpTotal: number;
  wardTotal: number;
  grandTotal: number;
}

/**
 * Phân tích chuỗi mốc độ tuổi (vd: "Nam 18-60, Nữ 18-55") thành đối tượng AgeLimits chuẩn.
 * Mặc định pháp luật & địa phương: Nam 18-60 tuổi, Nữ 18-55 tuổi.
 */
export function parseAgeRange(ageRangeStr?: string | null): AgeLimits {
  const result: AgeLimits = {
    maleMin: 18,
    maleMax: 60,
    femaleMin: 18,
    femaleMax: 55,
    generalMin: 18,
    generalMax: 60
  };

  if (!ageRangeStr || !ageRangeStr.trim()) return result;
  const cleanStr = ageRangeStr.toLowerCase().trim();

  const maleMatch = cleanStr.match(/nam[^\d]*(\d+)\s*(?:-|đến|tới|\.\.)\s*(\d+)/);
  if (maleMatch) {
    result.maleMin = parseInt(maleMatch[1], 10);
    result.maleMax = parseInt(maleMatch[2], 10);
  }

  const femaleMatch = cleanStr.match(/(?:nữ|nu)[^\d]*(\d+)\s*(?:-|đến|tới|\.\.)\s*(\d+)/);
  if (femaleMatch) {
    result.femaleMin = parseInt(femaleMatch[1], 10);
    result.femaleMax = parseInt(femaleMatch[2], 10);
  }

  const generalMatch = cleanStr.match(/(?:từ\s*)?(\d+)\s*(?:-|đến|tới|\.\.)\s*(\d+)/);
  if (generalMatch && !maleMatch && !femaleMatch) {
    const min = parseInt(generalMatch[1], 10);
    const max = parseInt(generalMatch[2], 10);
    result.maleMin = min;
    result.maleMax = max;
    result.femaleMin = min;
    result.femaleMax = max;
    result.generalMin = min;
    result.generalMax = max;
  }

  return result;
}

/**
 * Kiểm tra xem cá nhân có thuộc diện Miễn thu do hưu trí, tàn tật, trợ cấp xã hội hay trạng thái biến động hay không.
 */
export function isExemptResident(resident: Resident): boolean {
  if (!resident) return false;

  const statusClean = (resident.status || 'resident').toString().toLowerCase().trim();
  if (['deceased', 'qua_doi', 'moved_out', 'chuyen_di', 'inactive', 'deleted', 'tam_vang'].includes(statusClean)) {
    return true;
  }

  const pensionKeywords = [
    'hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật',
    'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu', 'bệnh binh', 'thương binh'
  ];

  const occLower = (resident.occupation || '').toString().toLowerCase();
  const notesLower = ((resident as any).notes || (resident as any).note || '').toString().toLowerCase();

  return pensionKeywords.some(k => occLower.includes(k) || notesLower.includes(k));
}

/**
 * Kiểm tra cá nhân có nằm trong độ tuổi lao động đóng góp hay không.
 */
export function isLaborAge(resident: Resident, targetYear: number, ageLimits?: AgeLimits): boolean {
  if (!resident) return false;
  if (isExemptResident(resident)) return false;

  const lim = ageLimits || { maleMin: 18, maleMax: 60, femaleMin: 18, femaleMax: 55, generalMin: 18, generalMax: 60 };
  const age = calculateExactAge(resident.dob, targetYear);

  const gStr = (resident.gender || '').toString().toLowerCase().trim();
  const nameLower = (resident.full_name || '').toLowerCase();
  const hasThi = nameLower.includes(' thị ') || nameLower.includes(' thị') || nameLower.startsWith('thị ') || nameLower.includes('bà ') || nameLower.includes('chị ');

  const isFemale = gStr === 'female' || gStr === 'nữ' || gStr === 'nu' || gStr.startsWith('f') || hasThi;

  if (isFemale) {
    return age >= lim.femaleMin && age <= lim.femaleMax;
  } else {
    return age >= lim.maleMin && age <= lim.maleMax;
  }
}

/**
 * Kiểm tra Hộ gia đình có thuộc diện gia đình chính sách / hộ nghèo được miễn quỹ phường hay không.
 */
export function isPolicyHousehold(household?: Household | null): boolean {
  if (!household) return false;
  const policy = household.policy_type;
  return policy === 'poor' || policy === 'near_poor' || policy === 'policy_family';
}

/**
 * Lọc danh sách nhân khẩu trong độ tuổi lao động của một Hộ gia đình.
 */
export function getHouseholdLaborResidents(members: Resident[], targetYear: number, personFundAgeRange?: string): Resident[] {
  const ageLimits = parseAgeRange(personFundAgeRange);
  return members.filter(r => isLaborAge(r, targetYear, ageLimits));
}

/**
 * Đọc số tiền bằng tiếng Việt chính xác 100% cho phiếu thu.
 */
export function docSoTien(number: number): string {
  if (!number || isNaN(number) || number <= 0) return 'Không đồng';
  const arrays = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  const readTriple = (n: number, showZero: boolean): string => {
    let tram = Math.floor(n / 100);
    let chuc = Math.floor((n % 100) / 10);
    let donvi = n % 10;
    let res = "";

    if (tram > 0 || showZero) {
      res += arrays[tram] + " trăm ";
    }

    if (chuc === 0 && donvi > 0) {
      res += "lẻ ";
    } else if (chuc === 1) {
      res += "mười ";
    } else if (chuc > 1) {
      res += arrays[chuc] + " mươi ";
    }

    if (donvi === 1 && chuc > 1) {
      res += "mốt";
    } else if (donvi === 5 && chuc > 0) {
      res += "lăm";
    } else if (donvi > 0) {
      res += arrays[donvi];
    }
    return res.trim();
  };

  let str = "";
  let units = ["", " nghìn", " triệu", " tỷ"];
  let temp = Math.floor(number);
  let i = 0;

  while (temp > 0) {
    let triple = temp % 1000;
    if (triple > 0) {
      let s = readTriple(triple, i > 0);
      str = s + units[i] + " " + str;
    }
    temp = Math.floor(temp / 1000);
    i++;
  }
  const finalStr = str.trim();
  return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
}

/**
 * Tạo mã đối soát ngẫu nhiên / checksum xác thực phiếu thu.
 */
export function generateReceiptVerificationCode(householdId: string, year: number, grandTotal: number): string {
  const cleanId = householdId.replace(/\D/g, '').slice(-4) || '9999';
  const totalHex = Math.abs(grandTotal).toString(16).toUpperCase().padStart(4, '0');
  return `QG-${year}-${cleanId}-${totalHex}`;
}

/**
 * Tính toán tổng hợp tài chính Hộ gia đình một cách chính xác tuyệt đối.
 */
export function calculateHouseholdFinancialSummary(
  household: Household,
  members: Resident[],
  wardFundsList: WardFund[],
  householdPaidFunds: HouseholdFund[],
  tdpActiveFunds: FundConfigItem[],
  wardActiveFunds: FundConfigItem[],
  targetYear: number
): HouseholdFinancialSummary {
  const isPolicyHH = isPolicyHousehold(household);
  const personFund = wardActiveFunds.find(af => af.scope === 'person' || af.name.toLowerCase().includes('thiên tai') || af.name.toLowerCase().includes('đáp nghĩa'));
  const ageLimits = parseAgeRange(personFund?.age_range);

  const laborResidents = members.filter(r => isLaborAge(r, targetYear, ageLimits));
  const laborCount = laborResidents.length;

  const findHeadResident = (resList: Resident[], hh?: Household): Resident | undefined => {
    if (!resList || resList.length === 0) return undefined;
    if (hh && hh.head_of_household_id) {
      const matched = resList.find(r => String(r.id) === String(hh.head_of_household_id));
      if (matched) return matched;
    }
    const isHeadTrue = resList.find(r => r.is_head === true || (r as any).is_head === 'true');
    if (isHeadTrue) return isHeadTrue;

    const relHead = resList.find(r => {
      const rel = (r.relationship_with_head || '').toString().trim().toLowerCase();
      return rel === 'chủ hộ' || rel === 'chu ho' || rel === 'chủ hộ gia đình';
    });
    if (relHead) return relHead;

    if (hh && hh.martyr_name) {
      const mName = hh.martyr_name.trim().toLowerCase();
      const matchedMartyr = resList.find(r => r.full_name.trim().toLowerCase() === mName);
      if (matchedMartyr) return matchedMartyr;
    }
    return resList[0];
  };

  const headResident = findHeadResident(members, household);
  const headName = headResident ? headResident.full_name : (household.martyr_name || (members[0] ? members[0].full_name : 'Đại diện hộ'));

  // 1. Quỹ TDP
  const tdpLineItems: HouseholdFinancialSummary['tdpLineItems'] = [];
  let tdpTotal = 0;

  tdpActiveFunds.forEach(fund => {
    const targetVal = typeof fund.target === 'number' ? fund.target : (parseInt(String((fund as any).target || '0').replace(/[^\d]/g, ''), 10) || 0);
    const paidFund = householdPaidFunds.find(hf => hf.household_id === household.id && hf.fund_name === fund.name && Number(hf.year) === targetYear);
    const rawPaid = paidFund ? paidFund.amount : 0;
    const paidAmountNum = typeof rawPaid === 'number' ? rawPaid : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);

    const displayAmount = paidAmountNum > 0 ? paidAmountNum : targetVal;
    tdpTotal += displayAmount;

    let noteText = 'Theo định mức';
    if (paidFund && paidAmountNum > 0) {
      noteText = paidAmountNum >= targetVal ? 'Đã thu đủ' : `Đã nộp ${paidAmountNum.toLocaleString('vi-VN')} đ`;
    }

    tdpLineItems.push({
      fundName: fund.name,
      targetVal,
      paidAmount: paidAmountNum,
      displayAmount,
      noteText
    });
  });

  // 2. Quỹ Phường
  const wardLineItems: HouseholdFinancialSummary['wardLineItems'] = [];
  let wardTotal = 0;

  const memberWardRecords = wardFundsList.filter(f => {
    if (Number(f.year) !== targetYear) return false;
    return members.some(m => (f.user_id && f.user_id === m.id) || (f.full_name && f.full_name.trim().toLowerCase() === m.full_name.trim().toLowerCase()));
  });

  const laborResidentIds = new Set(laborResidents.map(r => r.id));
  const laborResidentNames = new Set(laborResidents.map(r => r.full_name.trim().toLowerCase()));

  wardActiveFunds.forEach(wf => {
    const isHouseholdScope = wf.scope === 'household' || wf.name.toLowerCase().includes('hộ') || wf.name.toLowerCase().includes('người cao tuổi') || wf.name.toLowerCase().includes('cao tuổi');
    const wfTargetVal = typeof wf.target === 'number' ? wf.target : (parseInt(String((wf as any).target || '0').replace(/[^\d]/g, ''), 10) || 0);

    let expectedTotal = 0;
    if (isPolicyHH) {
      expectedTotal = 0;
    } else if (isHouseholdScope) {
      expectedTotal = wfTargetVal;
    } else {
      expectedTotal = wfTargetVal * laborCount;
    }

    const actualPaidSum = memberWardRecords.reduce((sum, r) => {
      if (!isHouseholdScope) {
        const isLabor = (r.user_id && laborResidentIds.has(r.user_id)) || laborResidentNames.has((r.full_name || '').trim().toLowerCase());
        if (!isLabor) return sum;
      }
      const raw = r.contributions?.[wf.name]?.actual ?? 0;
      const val = typeof raw === 'number' ? raw : (parseInt(String(raw || '0').replace(/[^\d]/g, ''), 10) || 0);
      return sum + val;
    }, 0);

    const displayAmount = actualPaidSum > expectedTotal ? actualPaidSum : expectedTotal;
    wardTotal += displayAmount;

    let noteText = '';
    if (isPolicyHH) {
      noteText = actualPaidSum > 0 ? `Tự nguyện đóng ${actualPaidSum.toLocaleString('vi-VN')} đ` : 'Nhà chính sách - được miễn';
    } else if (expectedTotal === 0) {
      noteText = 'Được miễn';
    } else if (actualPaidSum === 0) {
      noteText = 'Theo định mức';
    } else if (actualPaidSum >= expectedTotal) {
      noteText = 'Đã thu đủ';
    } else {
      noteText = `Đã nộp ${actualPaidSum.toLocaleString('vi-VN')} đ`;
    }

    wardLineItems.push({
      fundName: wf.name,
      isHouseholdScope,
      targetVal: wfTargetVal,
      expectedTotal,
      actualPaid: actualPaidSum,
      displayAmount,
      noteText
    });
  });

  return {
    householdId: household.id,
    headName,
    address: household.address || '',
    householdNumber: household.household_number || '—',
    laborCount,
    laborResidents,
    tdpLineItems,
    wardLineItems,
    tdpTotal,
    wardTotal,
    grandTotal: tdpTotal + wardTotal
  };
}

/**
 * Xuất HTML Phiếu Thu 2 Liên (Mẫu 01-TT theo Thông tư 200/2014/TT-BTC) chuẩn hóa 100%.
 */
export function generateUnifiedHouseholdReceiptHtml(
  summary: HouseholdFinancialSummary,
  dateText: string,
  tdpNameVal: string,
  wardNameVal: string,
  leaderName: string,
  leaderSigUrl: string,
  printMode: 'ward_only' | 'tdp_only' | 'combined' = 'combined'
): string {
  const receiptRows: Array<{ name: string; type: string; rate: string; amount: number; note: string; fundType: 'tdp' | 'ward' }> = [];

  if (printMode === 'combined' || printMode === 'tdp_only') {
    summary.tdpLineItems.forEach(item => {
      receiptRows.push({
        name: '[TDP] ' + item.fundName,
        type: 'Hộ gia đình',
        rate: item.targetVal.toLocaleString('vi-VN') + ' đ/hộ',
        amount: item.displayAmount,
        note: item.noteText,
        fundType: 'tdp'
      });
    });
  }

  if (printMode === 'combined' || printMode === 'ward_only') {
    summary.wardLineItems.forEach(item => {
      receiptRows.push({
        name: '[UBND Phường] ' + item.fundName,
        type: item.isHouseholdScope ? 'Hộ gia đình' : 'Nhân khẩu LĐ',
        rate: item.targetVal.toLocaleString('vi-VN') + (item.isHouseholdScope ? ' đ/hộ' : ' đ/khẩu'),
        amount: item.displayAmount,
        note: item.noteText,
        fundType: 'ward'
      });
    });
  }

  let keToanName = '';
  let keToanSigUrl = '';
  let thuQuyName = '';
  let thuQuySigUrl = '';
  try {
    const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
    const kt = sigs.find((s: any) => s.id === 'ke_toan');
    if (kt?.name?.trim()) keToanName = kt.name.trim();
    if (kt?.signatureUrl?.trim()) keToanSigUrl = kt.signatureUrl.trim();

    const tq = sigs.find((s: any) => s.id === 'thu_quy');
    if (tq?.name?.trim()) thuQuyName = tq.name.trim();
    if (tq?.signatureUrl?.trim()) thuQuySigUrl = tq.signatureUrl.trim();
  } catch { /* ignore */ }

  const rowsHtml = receiptRows.map((r, idx) => `
    <tr data-fund-type="${r.fundType}">
      <td style="text-align: center; border: 1px solid #000; padding: 4px 6px;">${idx + 1}</td>
      <td style="font-weight: bold; text-align: left; border: 1px solid #000; padding: 4px 6px;">${r.name}</td>
      <td style="text-align: center; border: 1px solid #000; padding: 4px 6px;">${r.type}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 4px 6px;">${r.rate}</td>
      <td class="receipt-amount-cell" style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 4px 6px;">${r.amount.toLocaleString('vi-VN')} đ</td>
      <td style="text-align: left; border: 1px solid #000; padding: 4px 6px;">${r.note}</td>
    </tr>
  `).join('');

  const verificationCode = generateReceiptVerificationCode(summary.householdId, new Date().getFullYear(), summary.grandTotal);

  const generateSingleReceipt = (lienName: string) => {
    let _tdpTotal = 0;
    let _wardTotal = 0;
    for (const r of receiptRows) {
      if (r.fundType === 'tdp') _tdpTotal += r.amount;
      else _wardTotal += r.amount;
    }

    const _grandTotal = printMode === 'ward_only' ? _wardTotal : (printMode === 'tdp_only' ? _tdpTotal : _tdpTotal + _wardTotal);
    const _textAmountWords = docSoTien(_grandTotal);

    const _totalLabelText = printMode === 'ward_only'
      ? `(UBND: ${_wardTotal.toLocaleString('vi-VN')} đ)`
      : (printMode === 'tdp_only'
        ? `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ)`
        : `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ + UBND: ${_wardTotal.toLocaleString('vi-VN')} đ)`);

    const titleText = printMode === 'ward_only'
      ? 'PHIẾU THU QUỸ UBND PHƯỜNG'
      : (printMode === 'tdp_only' ? 'PHIẾU THU QUỸ TỔ DÂN PHỐ' : 'PHIẾU THU TỔNG HỢP');

    return `
      <div class="receipt-container" style="page-break-inside: avoid; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed #777;">
        <table class="receipt-header-table">
          <tr>
            <td style="width: 50%;">
              <div class="receipt-org-title">
                Đơn vị: UBND ${wardNameVal.toUpperCase()}<br/>
                Tổ dân phố: ${tdpNameVal.toUpperCase()}<br/>
                Địa chỉ: ${summary.address || tdpNameVal}
              </div>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: top;">
              <div style="display: inline-block; text-align: center; width: 260px;">
                <div class="receipt-form-title" style="text-align: center;">
                  <strong>Mẫu số 01 - TT</strong><br/>
                  <span style="font-size: 8pt; font-style: italic;">
                    (Ban hành theo Thông tư số 200/2014/TT-BTC<br/>
                    Ngày 22/12/2014 của Bộ Tài chính)
                  </span>
                </div>
                <div style="text-align: left; font-size: 8.5pt; margin-top: 4px; font-weight: normal; line-height: 1.2; padding-left: 45px;">
                  Quyển số: ....................<br/>
                  Số: ....................<br/>
                  Nợ: ....................<br/>
                  Có: ....................
                </div>
              </div>
            </td>
          </tr>
        </table>

        <div class="receipt-title-container">
          <h1 class="receipt-title">${titleText}</h1>
          <p class="receipt-subtitle" style="margin-top: 2px; font-weight: bold; color: #1e3a8a;">${lienName}</p>
          <p class="receipt-subtitle">${dateText}</p>
        </div>

        <table class="receipt-info-table">
          <tr>
            <td class="receipt-info-label" style="width: 170px; font-weight: bold; text-align: left;">Họ và tên người nộp tiền:</td>
            <td style="text-align: left;">
              <strong>${summary.headName}</strong> (Đại diện Hộ gia đình)
            </td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Địa chỉ:</td>
            <td style="text-align: left;">${summary.address || tdpNameVal}</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Mã số hộ | Nhân khẩu LĐ:</td>
            <td style="text-align: left;"><strong>${summary.householdNumber}</strong> | Số khẩu trong độ tuổi lao động đóng góp: <strong>${summary.laborCount} khẩu</strong></td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Lý do nộp:</td>
            <td style="text-align: left;">Thu tổng hợp các khoản đóng góp tự nguyện (TDP + UBND) năm ${new Date().getFullYear()}</td>
          </tr>
        </table>

        <table class="receipt-details-table" style="width:100%; border-collapse:collapse; margin-top:5px;">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">STT</th>
              <th style="text-align: left; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">Nội dung đóng góp</th>
              <th style="width: 90px; text-align: center; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">Đối tượng</th>
              <th style="width: 110px; text-align: right; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">Định mức</th>
              <th style="width: 120px; text-align: right; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">Số tiền nộp</th>
              <th style="text-align: left; border: 1px solid #000; padding: 4px 6px; background-color: #f2f2f2;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="6" style="text-align: center; font-style: italic; color: #666; border: 1px solid #000; padding: 4px 6px;">Chưa nộp khoản đóng góp nào.</td></tr>'}
             <tr class="receipt-total-row" style="font-weight: bold;">
               <td colspan="4" style="text-align: center; border: 1px solid #000; padding: 4px 6px; background-color: #f9fbe7;">
                 TỔNG CỘNG THỰC THU ${_totalLabelText}
               </td>
               <td style="text-align: right; color: #15803d; font-size: 11pt; border: 1px solid #000; padding: 4px 6px; background-color: #f9fbe7;">${_grandTotal.toLocaleString('vi-VN')} đ</td>
               <td style="border: 1px solid #000; padding: 4px 6px; background-color: #f9fbe7;"></td>
             </tr>
          </tbody>
        </table>

        <div class="receipt-amount-words" style="font-size: 9.5pt; font-style: italic; margin-bottom: 6px; text-align: left;">
          Số tiền bằng chữ: <strong>${_textAmountWords}</strong>
        </div>

        <table class="receipt-signatures-table" style="width:100%; border-collapse:collapse;">
          <tr>
            <td colspan="4"></td>
            <td style="font-style: italic; font-size: 8.5pt; padding-bottom: 2px; text-align: center;">
              ${wardNameVal.replace(/Phường\s+/gi, '') || 'Quảng Giao'}, ${dateText}
            </td>
          </tr>
          <tr style="font-weight: bold; text-align: center;">
            <td style="width: 20%;">Tổ trưởng tổ dân phố</td>
            <td style="width: 20%;">Kế toán trưởng</td>
            <td style="width: 20%;">Thủ quỹ</td>
            <td style="width: 20%;">Người lập phiếu</td>
            <td style="width: 20%;">Người nộp tiền</td>
          </tr>
          <tr style="font-style: italic; font-size: 8pt; color: #555; text-align: center; line-height: 1.1;">
            <td>(Ký, đóng dấu, họ tên)</td>
            <td>(Ký, họ tên)</td>
            <td>(Ký, họ tên)</td>
            <td>(Ký, họ tên)</td>
            <td>(Ký, họ tên)</td>
          </tr>
          <tr style="text-align: center;">
            <td style="vertical-align: bottom; height: 42px; padding-top: 2px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${leaderName}</strong>
            </td>
            <td style="vertical-align: bottom; height: 42px; padding-top: 2px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${keToanSigUrl ? `<img src="${keToanSigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${keToanName}</strong>
            </td>
            <td style="vertical-align: bottom; height: 42px; padding-top: 2px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${thuQuySigUrl ? `<img src="${thuQuySigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${thuQuyName}</strong>
            </td>
            <td style="vertical-align: bottom;"><strong>Ban Quản lý Quỹ</strong></td>
            <td style="vertical-align: bottom;"><strong>${summary.headName}</strong></td>
          </tr>
        </table>
        
        <div style="margin-top: 6px; font-size: 7.5pt; color: #777; font-style: italic; text-align: right; display: flex; justify-content: space-between;">
          <span>Phần mềm CSDL Quản lý Dân cư TDP Quảng Giao</span>
          <span>Mã đối soát bảo mật: <strong>${verificationCode}</strong></span>
        </div>
      </div>
    `;
  };

  return `
    ${generateSingleReceipt('Liên 1: TDP lưu trữ')}
    <div style="page-break-before: always; margin-top: 20px;"></div>
    ${generateSingleReceipt('Liên 2: Giao cho người nộp tiền')}
  `;
}

/**
 * Công cụ Auto Financial Audit: Đối soát tự động dữ liệu Sổ thu chi & Quỹ.
 */
export function auditFinancialIntegrity(
  financialRecords: FinancialRecord[],
  householdFunds: HouseholdFund[],
  wardFundsList: WardFund[]
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  financialRecords.forEach(r => {
    if (r.amount < 0) {
      issues.push(`Bản ghi phiếu thu/chi ID ${r.id} có số tiền âm (${r.amount} đ).`);
    }
  });

  householdFunds.forEach(hf => {
    if (hf.amount < 0) {
      issues.push(`Khoản đóng quỹ TDP "${hf.fund_name}" của Hộ ID ${hf.household_id} có số tiền âm (${hf.amount} đ).`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues
  };
}
