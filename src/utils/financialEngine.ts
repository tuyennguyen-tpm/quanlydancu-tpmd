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
  groupName?: string;
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
 * Phân tích chuỗi mốc độ tuổi (vd: "Nam 18-61, Nữ 18-58") thành đối tượng AgeLimits chuẩn.
 * Mặc định địa phương quy định: Nam 18-61 tuổi, Nữ 18-58 tuổi.
 */
export function parseAgeRange(ageRangeStr?: string | null): AgeLimits {
  const result: AgeLimits = {
    maleMin: 18,
    maleMax: 61,
    femaleMin: 18,
    femaleMax: 58,
    generalMin: 18,
    generalMax: 61
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
 * Kiểm tra cá nhân có nằm trong độ tuổi lao động đóng góp hay không (Nữ 18-58 tuổi, Nam 18-61 tuổi).
 */
export function isLaborAge(resident: Resident, targetYear: number, ageLimits?: AgeLimits): boolean {
  if (!resident) return false;
  if (isExemptResident(resident)) return false;

  const lim = ageLimits || { maleMin: 18, maleMax: 61, femaleMin: 18, femaleMax: 58, generalMin: 18, generalMax: 61 };
  const age = calculateExactAge(resident.dob, targetYear);

  const gStr = (resident.gender || '').toString().toLowerCase().trim();
  const nameLower = (resident.full_name || '').toLowerCase();
  const hasThi = nameLower.includes(' thị ') || nameLower.includes(' thị') || nameLower.startsWith('thị ') || nameLower.includes('bà ') || nameLower.includes('chị ');

  const isFemale = gStr === 'female' || gStr === 'nữ' || gStr === 'nu' || gStr.startsWith('f') || hasThi;

  if (isFemale) {
    return age >= 18 && age <= 58;
  } else {
    return age >= 18 && age <= 61;
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
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  const readTriple = (n: number, isHighestTriple: boolean): string => {
    let tram = Math.floor(n / 100);
    let chuc = Math.floor((n % 100) / 10);
    let donvi = n % 10;
    let res = "";

    if (tram > 0 || !isHighestTriple) {
      res += digits[tram] + " trăm ";
    }

    if (chuc === 0 && donvi > 0) {
      if (tram > 0 || !isHighestTriple) {
        res += "lẻ ";
      }
    } else if (chuc === 1) {
      res += "mười ";
    } else if (chuc > 1) {
      res += digits[chuc] + " mươi ";
    }

    if (donvi === 1) {
      res += chuc > 1 ? "mốt" : "một";
    } else if (donvi === 5) {
      res += chuc > 0 ? "lăm" : "năm";
    } else if (donvi > 0) {
      res += digits[donvi];
    }
    return res.trim();
  };

  let n = Math.floor(Math.abs(number));
  let triples: number[] = [];
  while (n > 0) {
    triples.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let parts: string[] = [];

  for (let i = triples.length - 1; i >= 0; i--) {
    const val = triples[i];
    if (val === 0) continue;
    const isHighestTriple = (i === triples.length - 1);
    const str = readTriple(val, isHighestTriple);
    const unit = units[i] ? " " + units[i] : "";
    parts.push(str + unit);
  }

  let finalStr = parts.join(" ").trim();
  if (!finalStr) return 'Không đồng';

  finalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
  return finalStr.replace(/\s+/g, ' ');
}

/**
 * Lấy dữ liệu khoản đóng góp từ object contributions với cơ chế khớp tên thông minh (bỏ qua tiền tố Quỹ, [TDP], [NGƯỜI CAO TUỔI PHƯỜNG]...)
 */
export function getContributionData(contributions: Record<string, any> | undefined, fundName: string): { expected?: number; actual?: number; date?: string; is_manual_exempt?: boolean; is_manual_target?: boolean } | undefined {
  if (!contributions) return undefined;
  if (contributions[fundName]) return contributions[fundName];
  const norm = (s: string) => s.toLowerCase().replace(/^\[.*?\]\s*/, '').replace(/^quỹ\s+/, '').trim();
  const target = norm(fundName);
  for (const k of Object.keys(contributions)) {
    if (norm(k) === target) return contributions[k];
  }
  for (const k of Object.keys(contributions)) {
    const nk = norm(k);
    if (nk.includes(target) || target.includes(nk)) return contributions[k];
  }
  return undefined;
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
  targetYear: number,
  allDbResidents?: Resident[]
): HouseholdFinancialSummary {
  const isPolicyHH = isPolicyHousehold(household);
  const personFund = wardActiveFunds.find(af => af.scope === 'person' || af.name.toLowerCase().includes('thiên tai') || af.name.toLowerCase().includes('đáp nghĩa'));
  const ageLimits = parseAgeRange(personFund?.age_range);

  // 1. Tìm Chủ hộ chính thức từ CSDL Nhân khẩu đầy đủ (kể cả khi Chủ hộ quá tuổi / miễn đóng)
  const fullResidentList = (allDbResidents && allDbResidents.length > 0) ? allDbResidents : members;

  const findHeadResident = (resList: Resident[], hh?: Household): Resident | undefined => {
    if (!resList || resList.length === 0) return undefined;
    if (hh && hh.head_of_household_id) {
      const matched = resList.find(r => String(r.id) === String(hh.head_of_household_id));
      if (matched) return matched;
    }
    const isHeadTrue = resList.find(r => (hh ? String(r.household_id || '') === String(hh.id) : true) && (r.is_head === true || (r as any).is_head === 'true'));
    if (isHeadTrue) return isHeadTrue;

    const relHead = resList.find(r => {
      if (hh && String(r.household_id || '') !== String(hh.id)) return false;
      const rel = (r.relationship_with_head || '').toString().trim().toLowerCase();
      return rel === 'chủ hộ' || rel === 'chu ho' || rel === 'chủ hộ gia đình';
    });
    if (relHead) return relHead;

    if (hh && hh.martyr_name) {
      const mName = hh.martyr_name.trim().toLowerCase();
      const matchedMartyr = resList.find(r => r.full_name.trim().toLowerCase() === mName);
      if (matchedMartyr) return matchedMartyr;
    }
    return resList.find(r => (hh ? String(r.household_id || '') === String(hh.id) : true)) || resList[0];
  };

  const headResident = findHeadResident(fullResidentList, household);
  const headName = headResident ? headResident.full_name : (household.martyr_name || (members[0] ? members[0].full_name : 'Đại diện hộ'));

  // 2. Tính số lượng Nhân khẩu trong độ tuổi lao động đóng góp
  // Chỉ đếm từ danh sách nhân khẩu thực tế của hộ (members) - KHÔNG tăng theo bản ghi quỹ hay tiền PCTT
  // để tránh bị sai khi dữ liệu quỹ có nhiều bản ghi cũ hoặc nhập nhầm
  const laborResidents = members.filter(r => isLaborAge(r, targetYear, ageLimits));
  const laborCount = laborResidents.length;

  // 1. Quỹ TDP
  const tdpLineItems: HouseholdFinancialSummary['tdpLineItems'] = [];
  let tdpTotal = 0;

  const hhAddressStr = ((household.address || '') + ' ' + (members?.[0]?.permanent_address || '') + ' ' + ((household as any).self_management_group || '') + ' ' + ((household as any).group_name || '')).toLowerCase();
  const isGroup8 = hhAddressStr.includes('tổ 8') || hhAddressStr.includes('to 8') || hhAddressStr.includes('tổ: 8') || ((household as any).self_management_group || '').trim() === 'Tổ 8' || ((household as any).self_management_group || '').trim() === '8';

  tdpActiveFunds.forEach(fund => {
    const isKhuyenHoc = fund.name.toLowerCase().includes('khuyến học') || fund.name.toLowerCase().includes('khuyen hoc');
    const targetVal = typeof fund.target === 'number' ? fund.target : (parseInt(String((fund as any).target || '0').replace(/[^\d]/g, ''), 10) || 0);
    const paidFund = householdPaidFunds.find(hf => hf.household_id === household.id && hf.fund_name === fund.name && Number(hf.year) === targetYear);
    const rawPaid = paidFund ? paidFund.amount : 0;
    const paidAmountNum = typeof rawPaid === 'number' ? rawPaid : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);

    let displayAmount = targetVal;
    let noteText = 'Theo định mức';

    if (isKhuyenHoc && isGroup8 && Number(targetYear) === 2026) {
      displayAmount = 0;
      noteText = (paidFund && paidFund.note && paidFund.note !== 'Đã thu đủ theo thông báo') ? paidFund.note : 'Đã thu trước';
    } else if (paidFund) {
      displayAmount = paidAmountNum;
      if (paidFund.note) {
        noteText = paidFund.note;
      } else if (paidAmountNum >= targetVal) {
        noteText = 'Đã thu đủ';
      } else if (paidAmountNum > 0) {
        noteText = `Đã nộp ${paidAmountNum.toLocaleString('vi-VN')} đ`;
      } else {
        noteText = '0 đ';
      }
    }

    tdpTotal += displayAmount;

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
    const isHouseholdScope = wf.scope ? wf.scope === 'household' : (wf.name.toLowerCase().includes('hộ gia đình') || wf.name.toLowerCase().includes('người cao tuổi') || wf.name.toLowerCase().includes('cao tuổi'));
    const wfTargetVal = typeof wf.target === 'number' ? wf.target : (parseInt(String((wf as any).target || '0').replace(/[^\d]/g, ''), 10) || 0);

    let expectedTotal = 0;
    if (isPolicyHH) {
      expectedTotal = 0;
    } else if (isHouseholdScope) {
      const manualExemptHH = memberWardRecords.some(r => {
        const c = getContributionData(r.contributions, wf.name);
        return c?.is_manual_exempt === true;
      });
      expectedTotal = manualExemptHH ? 0 : wfTargetVal;
    } else {
      expectedTotal = laborResidents.reduce((sum, res) => {
        const rec = memberWardRecords.find(f => 
          (f.user_id && f.user_id === res.id) || 
          (f.full_name && f.full_name.trim().toLowerCase() === res.full_name.trim().toLowerCase())
        );
        if (rec) {
          const contrib = getContributionData(rec.contributions, wf.name);
          if (contrib) {
            if (contrib.expected === 0 || contrib.is_manual_exempt === true) {
              return sum;
            }
            if (typeof contrib.expected === 'number') {
              return sum + contrib.expected;
            }
          }
        }
        return sum + wfTargetVal;
      }, 0);
    }

    const actualPaidSum = memberWardRecords.reduce((sum, r) => {
      if (!isHouseholdScope) {
        const isLabor = (r.user_id && laborResidentIds.has(r.user_id)) || laborResidentNames.has((r.full_name || '').trim().toLowerCase());
        if (!isLabor) return sum;
      }
      const contrib = getContributionData(r.contributions, wf.name);
      const raw = contrib?.actual ?? 0;
      const val = typeof raw === 'number' ? raw : (parseInt(String(raw || '0').replace(/[^\d]/g, ''), 10) || 0);
      return sum + val;
    }, 0);

    // Với quỹ hộ (household scope): dù có nhiều bản ghi nhân khẩu cũng chỉ tính tối đa 1 lần/hộ
    // Tránh tình huống hộ 2 người đều có bản ghi → bị nhân đôi 40.000 thay vì 20.000
    const cappedPaidSum = isHouseholdScope && expectedTotal > 0
      ? Math.min(actualPaidSum, expectedTotal)
      : actualPaidSum;

    const displayAmount = cappedPaidSum > expectedTotal ? cappedPaidSum : expectedTotal;
    wardTotal += displayAmount;

    let noteText = '';
    if (isPolicyHH) {
      noteText = cappedPaidSum > 0 ? `Tự nguyện đóng ${cappedPaidSum.toLocaleString('vi-VN')} đ` : 'Nhà chính sách - được miễn';
    } else if (expectedTotal === 0) {
      noteText = 'Được miễn';
    } else if (cappedPaidSum === 0) {
      noteText = 'Theo định mức';
    } else if (cappedPaidSum >= expectedTotal) {
      noteText = 'Đã thu đủ';
    } else {
      noteText = `Đã nộp ${cappedPaidSum.toLocaleString('vi-VN')} đ`;
    }

    wardLineItems.push({
      fundName: wf.name,
      isHouseholdScope,
      targetVal: wfTargetVal,
      expectedTotal,
      actualPaid: cappedPaidSum,
      displayAmount,
      noteText
    });
  });

  const getGroupOfHousehold = (hh: Household, mems: Resident[]): string => {
    if ((hh as any).self_management_group && String((hh as any).self_management_group).trim()) {
      return String((hh as any).self_management_group).trim();
    }
    if ((hh as any).group_name && String((hh as any).group_name).trim()) {
      return String((hh as any).group_name).trim();
    }
    if (mems && mems.length > 0) {
      for (const m of mems) {
        if ((m as any).self_management_group && String((m as any).self_management_group).trim()) {
          return String((m as any).self_management_group).trim();
        }
        if ((m as any).group_name && String((m as any).group_name).trim()) {
          return String((m as any).group_name).trim();
        }
      }
    }
    try {
      const groupsStr = localStorage.getItem('tdp_groups') || localStorage.getItem('self_management_groups');
      if (groupsStr) {
        const groupsList: string[] = JSON.parse(groupsStr);
        const memAddr = (mems?.[0] as any)?.address || (mems?.[0] as any)?.permanent_address || '';
        const fullAddr = ((hh.address || '') + ' ' + memAddr).toLowerCase();
        for (const g of groupsList) {
          const gClean = g.trim();
          if (!gClean) continue;
          if (fullAddr.includes(gClean.toLowerCase())) return gClean;
          const numMatch = gClean.match(/\d+/);
          if (numMatch) {
            const n = numMatch[0];
            if (fullAddr.includes(`tổ ${n}`) || fullAddr.includes(`tổ: ${n}`) || fullAddr.includes(`cụm ${n}`)) return gClean;
          }
        }
      }
    } catch {}
    const memAddr2 = (mems?.[0] as any)?.address || (mems?.[0] as any)?.permanent_address || '';
    const addr = ((hh.address || '') + ' ' + memAddr2).trim();
    const match = addr.match(/(Tổ\s+\d+|Cụm\s+\d+|Tổ\s+[\w\s]+)/i);
    if (match) return match[0].trim();
    return '';
  };

  return {
    householdId: household.id,
    headName,
    address: household.address || '',
    householdNumber: household.household_number || '—',
    groupName: getGroupOfHousehold(household, members),
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
 * Tự động cập nhật tiền tố Quỹ Phường trên chuỗi HTML phiếu thu (kể cả bản chỉnh sửa đã lưu trước đó của người dùng)
 * mà không làm ảnh hưởng hay mất bất kỳ nội dung chỉnh sửa thủ công nào khác.
 */
export function applyWardFundPrefixToHtml(htmlStr: string): string {
  if (!htmlStr) return htmlStr;
  const rawPrefix = localStorage.getItem('ward_fund_prefix');
  if (!rawPrefix || !rawPrefix.trim()) return htmlStr;
  const newPrefixStr = rawPrefix.trim() + ' ';

  // Thay thế tất cả tiền tố dạng [UBND...], [Phường...], [Cấp Phường...] đứng trước tên quỹ bằng tiền tố mới nhất
  return htmlStr.replace(/(\[\s*(?:UBND|UBND Phường|UBND Xã|Phường|Cấp Phường|Xã)\s*\]\s*)/gi, newPrefixStr);
}

/**
 * Chuẩn hóa khóa lưu trữ receipt key duy nhất cho mọi góc nhìn
 */
export function getCanonicalHouseholdReceiptKey(
  householdId: string,
  year: number | string,
  printMode: string = 'combined'
): string {
  let cleanId = String(householdId || '').trim();
  return `receipt_html_${cleanId}_${year}_${printMode}`;
}

/**
 * Chuẩn hóa địa chỉ trên phiếu thu: Tự động ghép tên Tổ, xử lý dấu phẩy thừa, thêm tiền tố TDP trước Quảng Giao.
 * - Đối với góc nhìn/tài khoản Phường (isWardAccount = true): hiển thị TDP Quảng Giao, Phường Nam Sầm Sơn...
 * - Đối với góc nhìn TDP: hiển thị Tổ Việt Trung, TDP Quảng Giao...
 */
/**
 * Tự động tìm tên Tổ tự quản của hộ gia đình từ dữ liệu hoặc từ cấu hình hệ thống
 */
export function resolveHouseholdGroupName(
  groupName?: string | null,
  rawAddress?: string | null
): string {
  let g = (groupName || '').trim();

  // Nếu g rỗng, tìm trong cấu hình các tổ dân cư của hệ thống trong localStorage
  if (!g) {
    try {
      const groupsStr = localStorage.getItem('tdp_groups') || localStorage.getItem('self_management_groups') || localStorage.getItem('official_groups');
      if (groupsStr) {
        const groupsList: string[] = JSON.parse(groupsStr);
        const addrLower = (rawAddress || '').toLowerCase();
        for (const grp of groupsList) {
          const gClean = grp.trim();
          if (!gClean) continue;
          if (addrLower.includes(gClean.toLowerCase())) {
            g = gClean;
            break;
          }
          const numMatch = gClean.match(/\d+/);
          if (numMatch && (addrLower.includes(`tổ ${numMatch[0]}`) || addrLower.includes(`tổ: ${numMatch[0]}`))) {
            g = gClean;
            break;
          }
        }
      }
    } catch {}
  }

  // Khớp regex trong chuỗi địa chỉ nếu vẫn rỗng
  if (!g && rawAddress) {
    const match = rawAddress.match(/(Tổ\s+\d+|Cụm\s+\d+|Tổ\s+[\w\s]+)/i);
    if (match) {
      g = match[0].trim();
    }
  }

  if (!g) return '';
  return g.toLowerCase().startsWith('tổ') || g.toLowerCase().startsWith('cụm') ? g : `Tổ ${g}`;
}

/**
 * Chuẩn hóa địa chỉ trên phiếu thu: Luôn hiển thị tên Tổ cài đặt đứng trước TDP Quảng Giao (ví dụ: Tổ 7, TDP Quảng Giao).
 */
export function formatReceiptAddress(
  groupName?: string | null,
  rawAddress?: string | null,
  defaultTdpName: string = 'Quảng Giao',
  wardName: string = 'Phường Nam Sầm Sơn'
): string {
  const formattedGroup = resolveHouseholdGroupName(groupName, rawAddress);

  const tdpFormatted = defaultTdpName.trim().toLowerCase().startsWith('tdp') || defaultTdpName.trim().toLowerCase().startsWith('tổ dân phố')
    ? defaultTdpName.trim()
    : `TDP ${defaultTdpName.trim()}`;

  let addr = (rawAddress || '').trim().replace(/^[\s,]+/, '').replace(/[\s,]+$/, '');
  
  if (!addr || /^quảng\s*giao$/i.test(addr) || /^tdp\s*quảng\s*giao$/i.test(addr)) {
    addr = tdpFormatted;
  } else {
    // Đảm bảo có tiền tố "TDP " trước Quảng Giao
    if (!/TDP\s+/i.test(addr) && !/Tổ\s+dân\s+phố/i.test(addr)) {
      if (new RegExp(`\\b${defaultTdpName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi').test(addr)) {
        addr = addr.replace(new RegExp(`\\b${defaultTdpName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), tdpFormatted);
      } else {
        addr = `${addr}, ${tdpFormatted}`;
      }
    }
  }

  if (formattedGroup) {
    if (!addr.toLowerCase().startsWith(formattedGroup.toLowerCase())) {
      addr = addr.replace(new RegExp(`\\b${formattedGroup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\s,]*`, 'gi'), '');
      addr = `${formattedGroup}, ${addr}`;
    }
  }

  return addr.replace(/^[\s,]+/, '').replace(/,\s*(?=,)/g, '').replace(/,\s*,+/g, ', ').replace(/\s+/g, ' ').trim();
}

/**
 * Chuẩn hóa và đồng bộ 100% tất cả các dòng Địa chỉ trên chuỗi HTML phiếu thu (kể cả bản chỉnh sửa lưu trong DB/localStorage).
 */
export function sanitizeReceiptHtmlAddresses(
  receiptHtml: string,
  groupName?: string | null,
  rawAddress?: string | null,
  tdpNameVal: string = 'Quảng Giao',
  wardNameVal: string = 'Phường Nam Sầm Sơn'
): string {
  if (!receiptHtml) return receiptHtml;

  const formattedAddress = formatReceiptAddress(groupName, rawAddress, tdpNameVal, wardNameVal);

  let result = receiptHtml
    .replace(/<div style="page-break-before:\s*always;\s*margin-top:\s*20px;\s*"><\/div>/gi, '')
    .replace(/margin-bottom:\s*25px;\s*padding-bottom:\s*15px;\s*border-bottom:\s*1px dashed #777;/gi, 'margin-bottom: 0; padding-bottom: 0;');

  const gStr = resolveHouseholdGroupName(groupName, rawAddress);
  if (gStr) {
    result = result.replace(
      new RegExp(`(Họ và tên người nộp tiền:[\\s\\S]*?<td[^>]*>[\\s\\S]*?)\\s*${gStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
      '$1'
    );
  }

  // 1. Đồng bộ ô giá trị Địa chỉ trong bảng thông tin người nộp (ô <td> thứ 2 sau label)
  result = result.replace(/(<td[^>]*class="receipt-info-label"[^>]*>\s*Địa chỉ:\s*<\/td>\s*<td[^>]*>)([\s\S]*?)(<\/td>)/gi, (_m, p1, _p2, p3) => {
    return `${p1}${formattedAddress}${p3}`;
  });

  // 2. Đồng bộ dòng Địa chỉ trong góc Đơn vị (thẻ receipt-org-title ở góc trên)
  result = result.replace(/(Địa chỉ:\s*)([\s\S]*?)(<\/div>|<br\s*\/?>)/gi, (_m, p1, _p2, p3) => {
    return `${p1}${formattedAddress}${p3}`;
  });

  return result;
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
    const rawWardFundPrefix = localStorage.getItem('ward_fund_prefix');
    const wardFundPrefix = rawWardFundPrefix !== null ? rawWardFundPrefix.trim() : '';
    const wardPrefixStr = wardFundPrefix ? wardFundPrefix + ' ' : '';
    summary.wardLineItems.forEach(item => {
      receiptRows.push({
        name: wardPrefixStr + item.fundName,
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
      <td style="text-align: center; border: 1px solid #000; padding: 3px 5px;">${idx + 1}</td>
      <td style="font-weight: bold; text-align: left; border: 1px solid #000; padding: 3px 5px;">${r.name}</td>
      <td style="text-align: center; border: 1px solid #000; padding: 3px 5px;">${r.type}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 3px 5px;">${r.rate}</td>
      <td class="receipt-amount-cell" style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 3px 5px;">${r.amount.toLocaleString('vi-VN')} đ</td>
      <td style="text-align: left; border: 1px solid #000; padding: 3px 5px;">${r.note}</td>
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
      ? `(PHƯỜNG: ${_wardTotal.toLocaleString('vi-VN')} đ)`
      : (printMode === 'tdp_only'
        ? `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ)`
        : `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ + PHƯỜNG: ${_wardTotal.toLocaleString('vi-VN')} đ)`);

    const titleText = printMode === 'ward_only'
      ? 'PHIẾU THU QUỸ UBND PHƯỜNG'
      : (printMode === 'tdp_only' ? 'PHIẾU THU QUỸ TỔ DÂN PHỐ' : 'PHIẾU THU TỔNG HỢP');

    return `
      <div class="receipt-container" style="page-break-inside: avoid; margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
        <table class="receipt-header-table">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <div class="receipt-org-title" style="margin-top: 0; padding-top: 0; line-height: 1.3;">
                Đơn vị: UBND ${wardNameVal.toUpperCase()}<br/>
                Tổ dân phố: ${tdpNameVal.toUpperCase()}<br/>
                Địa chỉ: ${formatReceiptAddress(summary.groupName, summary.address, tdpNameVal, wardNameVal)}
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

        <div class="receipt-title-container" style="margin-top: 4px; margin-bottom: 4px;">
          <h1 class="receipt-title" style="margin: 2px 0;">${titleText}</h1>
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
            <td style="text-align: left;">${formatReceiptAddress(summary.groupName, summary.address, tdpNameVal, wardNameVal)}</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Mã số hộ | Nhân khẩu LĐ:</td>
            <td style="text-align: left;"><strong>${summary.householdNumber}</strong> | Số khẩu trong độ tuổi lao động đóng góp: <strong>${summary.laborCount} khẩu</strong></td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Lý do nộp:</td>
            <td style="text-align: left;">Thu tổng hợp các khoản đóng góp tự nguyện TDP và các khoản đóng góp theo quy định của Nhà nước năm ${new Date().getFullYear()}</td>
          </tr>
        </table>

        <table class="receipt-details-table" style="width:100%; border-collapse:collapse; margin-top:4px; margin-bottom:4px;">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">STT</th>
              <th style="text-align: left; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">Nội dung đóng góp</th>
              <th style="width: 90px; text-align: center; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">Đối tượng</th>
              <th style="width: 110px; text-align: right; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">Định mức</th>
              <th style="width: 120px; text-align: right; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">Số tiền nộp</th>
              <th style="text-align: left; border: 1px solid #000; padding: 3px 5px; background-color: #f2f2f2;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="6" style="text-align: center; font-style: italic; color: #666; border: 1px solid #000; padding: 3px 5px;">Chưa nộp khoản đóng góp nào.</td></tr>'}
             <tr class="receipt-total-row" style="font-weight: bold;">
               <td colspan="4" style="text-align: center; border: 1px solid #000; padding: 3px 5px; background-color: #f9fbe7;">
                 TỔNG CỘNG THỰC THU ${_totalLabelText}
               </td>
               <td style="text-align: right; color: #15803d; font-size: 11pt; border: 1px solid #000; padding: 3px 5px; background-color: #f9fbe7;">${_grandTotal.toLocaleString('vi-VN')} đ</td>
               <td style="border: 1px solid #000; padding: 3px 5px; background-color: #f9fbe7;"></td>
             </tr>
          </tbody>
        </table>

        <div class="receipt-amount-words" style="font-size: 9.5pt; font-style: italic; margin-top: 3px; margin-bottom: 4px; text-align: left;">
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
            <td style="vertical-align: bottom; height: 36px; padding-top: 1px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${leaderName}</strong>
            </td>
            <td style="vertical-align: bottom; height: 36px; padding-top: 1px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${keToanSigUrl ? `<img src="${keToanSigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${keToanName}</strong>
            </td>
            <td style="vertical-align: bottom; height: 36px; padding-top: 1px;">
              <div style="height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${thuQuySigUrl ? `<img src="${thuQuySigUrl}" alt="Chữ ký" style="height: 32px; max-height: 32px; max-width: 90px; object-fit: contain;" />` : ''}
              </div>
              <strong>${thuQuyName}</strong>
            </td>
            <td style="vertical-align: bottom;"><strong>Ban Quản lý Quỹ</strong></td>
            <td style="vertical-align: bottom;"><strong>${summary.headName}</strong></td>
          </tr>
        </table>
        
        <div style="margin-top: 4px; font-size: 7.5pt; color: #777; font-style: italic; text-align: right; display: flex; justify-content: space-between;">
          <span>Phần mềm CSDL Quản lý Dân cư TDP Quảng Giao</span>
          <span>Mã đối soát bảo mật: <strong>${verificationCode}</strong></span>
        </div>
      </div>
    `;
  };

  return `
    <div class="receipt-lien-wrapper" style="page-break-inside: avoid; page-break-after: always;">
      ${generateSingleReceipt('Liên 1: TDP lưu trữ')}
    </div>
    <div class="receipt-lien-wrapper" style="page-break-inside: avoid;">
      ${generateSingleReceipt('Liên 2: Giao cho người nộp tiền')}
    </div>
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
