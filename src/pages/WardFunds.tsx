import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { 
  Search, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  TrendingUp, 
  Wallet,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Coins,
  Printer,
  Users,
  Home,
  Database,
  PlusCircle,
  UserPlus
} from 'lucide-react';
import { db, generateUUID, supabase } from '../services/db';
import { showToast } from '../utils/toast';
import { calculateExactAge } from '../utils/dateUtils';
import type { WardFund, Resident, Household, HouseholdFund, FinancialRecord } from '../types';
import ExcelJS from 'exceljs';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

const formatDateVN = (dateStr?: string | null): string => {
  if (!dateStr || !dateStr.trim()) return '';
  const str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  if (str.includes('T') && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
    const [y, m, d] = str.split('/');
    return `${d}/${m}/${y}`;
  }
  return str;
};

const normalizeDateToCompare = (dStr?: string | null): string => {
  if (!dStr || !dStr.trim()) return '';
  const s = dStr.trim().replace(/[-\/]/g, '.');
  const parts = s.split('.');
  if (parts.length === 3) {
    let day = '', month = '', year = '';
    if (parts[0].length === 4) {
      // YYYY.MM.DD
      [year, month, day] = parts;
    } else if (parts[2].length === 4) {
      // DD.MM.YYYY
      [day, month, year] = parts;
    }
    if (day && month && year) {
      return `${parseInt(day, 10)}-${parseInt(month, 10)}-${year}`;
    }
  }
  return s;
};

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 250,
  ...props
}: DebouncedInputProps) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);
    return () => clearTimeout(timeout);
  }, [value, onChange, debounce]);

  return (
    <input {...props} value={value} onChange={e => setValue(e.target.value)} />
  );
};

const WardFunds = () => {
  const currentYear = new Date().getFullYear();
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  // Cấp quyền sửa cho to_truong, admin, chung
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
    (currentRole !== 'to_truong' && currentRole !== 'admin' && currentRole !== 'ke_toan');
  const canPrintExport = currentRole !== 'demo' && localStorage.getItem('guest_mode') !== 'true';
  
  // State
  const [funds, setFunds] = useState<WardFund[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid_all' | 'unpaid_any'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('tdp_groups_config');
    return saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  });
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdFunds, setHouseholdFunds] = useState<HouseholdFund[]>([]);

  // Cache tra cứu hộ gia đình để tránh tính toán lại khi thanh toán hoặc thay đổi input tìm kiếm
  const matchCacheRef = useRef<Map<string, { householdId: string; address: string; headName: string; groupName: string }>>(new Map());
  const prevDBStateRef = useRef({ residents, households, groups });

  if (
    prevDBStateRef.current.residents !== residents ||
    prevDBStateRef.current.households !== households ||
    prevDBStateRef.current.groups !== groups
  ) {
    matchCacheRef.current.clear();
    prevDBStateRef.current = { residents, households, groups };
  }

  
  // Cấu hình quỹ của Phường động
  const [activeFunds, setActiveFunds] = useState<{ name: string; target: number }[]>([]);
  const [subTabMode, setSubTabMode] = useState<'ward_list' | 'household_list' | 'all_summary'>('ward_list');
  
  // Modal State
  const [editingRecord, setEditingRecord] = useState<WardFund | null>(null);
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [dobInput, setDobInput] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [contribInputs, setContribInputs] = useState<Record<string, { expected: string; actual: string; date: string }>>({});
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [note, setNote] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list'); // Chế độ xem danh sách hay gom theo hộ

  // Lazy rendering state to prevent DOM bloating and typing lag
  const [visibleCount, setVisibleCount] = useState(150);

  // Add Member to Household Modal State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberTargetGroup, setAddMemberTargetGroup] = useState<any>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDob, setNewMemberDob] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<'Nữ' | 'Nam'>('Nữ');
  const [newMemberNote, setNewMemberNote] = useState('');

  const handleOpenAddMemberModal = (group: any) => {
    setAddMemberTargetGroup(group);
    setNewMemberName('');
    setNewMemberDob('');
    setNewMemberGender('Nữ');
    setNewMemberNote('');
    setIsAddMemberModalOpen(true);
  };

  const handleSaveNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showToast('Vui lòng nhập họ và tên nhân khẩu!', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const activeFundsList = (db as any).getWardFundList();

      let age = 30;
      if (newMemberDob) {
        const year = parseInt(newMemberDob.match(/\d{4}/)?.[0] || '0', 10);
        if (year > 0) age = selectedYear - year;
      }

      const isFemale = newMemberGender === 'Nữ';
      const isMale = newMemberGender === 'Nam';
      const isFemaleInAge = isFemale ? (age >= 18 && age <= 58) : false;
      const isMaleInAge = isMale ? (age >= 18 && age <= 61) : false;
      const isInAgeRange = isFemaleInAge || isMaleInAge;

      const occLower = newMemberNote.toLowerCase();
      const pensionKeywords = ['hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật', 'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu'];
      const isPensioner = pensionKeywords.some(key => occLower.includes(key));

      const contributions: Record<string, any> = {};

      activeFundsList.forEach((fund: any) => {
        let expected = 0;
        if (!isPensioner && !fund.scope && isInAgeRange) {
          expected = fund.target;
        }
        contributions[fund.name] = {
          expected,
          actual: 0
        };
      });

      const newRecord: WardFund = {
        id: generateUUID(),
        year: selectedYear,
        full_name: newMemberName.trim(),
        dob: newMemberDob ? formatDateVN(newMemberDob.trim()) : undefined,
        address: addMemberTargetGroup?.address || '',
        user_id: addMemberTargetGroup?.members?.[0]?.user_id || undefined,
        note: newMemberNote.trim() || undefined,
        contributions
      };

      await db.saveWardFund(newRecord);
      showToast(`Đã thêm nhân khẩu "${newMemberName}" vào hộ thành công!`, 'success');
      setIsAddMemberModalOpen(false);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi thêm nhân khẩu mới!', 'danger');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setVisibleCount(150);
  }, [searchTerm, filterStatus, groupFilter, subTabMode, viewMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load danh sách cấu hình quỹ Phường
  const loadActiveFunds = () => {
    const list = (db as any).getWardFundList();
    setActiveFunds(list);
  };

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await db.getWardFunds(selectedYear);
      setFunds(data);
      try {
        const hhFunds = await db.getHouseholdFunds();
        setHouseholdFunds(hhFunds || []);
      } catch { /* ignore */ }
    } catch (e) {
      showToast('Lỗi tải dữ liệu quỹ phường!', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const loadResidentsAndHouseholds = async () => {
    try {
      const resList = await db.getResidents();
      const hhList = await db.getHouseholds();
      setResidents(resList);
      setHouseholds(hhList);
    } catch (e) {
      console.error('Failed to load residents/households in WardFunds', e);
    }
  };

  useEffect(() => {
    loadActiveFunds();
    loadResidentsAndHouseholds();
    window.addEventListener('ward-fund-targets-changed', loadActiveFunds);
    window.addEventListener('db-changed', loadResidentsAndHouseholds);
    
    const handleGroupsChange = () => {
      const saved = localStorage.getItem('tdp_groups_config');
      setGroups(saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9']);
    };
    window.addEventListener('tdp-groups-changed', handleGroupsChange);

    const handleGlobalClick = () => {
      setShowDataMenu(false);
      setShowPrintMenu(false);
    };
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('ward-fund-targets-changed', loadActiveFunds);
      window.removeEventListener('db-changed', loadResidentsAndHouseholds);
      window.removeEventListener('tdp-groups-changed', handleGroupsChange);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, [selectedYear]);

  // Format number to currency string
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Helper formats input string to dots grouped format (e.g. 100.000)
  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return parseInt(clean).toLocaleString('vi-VN');
  };

  // 1. Memoized lookups for rapid O(1) resident search
  const residentsInfoLookup = useMemo(() => {
    const resIdMap = new Map<string, Resident>();
    residents.forEach(r => resIdMap.set(r.id, r));

    const hhHeadMap = new Map<string, string>(); // household_id -> headName
    const hhGroupMap = new Map<string, string>(); // household_id -> self_management_group

    households.forEach(h => {
      hhGroupMap.set(h.id, (h.self_management_group || '').trim());
      if (h.head_of_household_id) {
        const head = resIdMap.get(h.head_of_household_id);
        if (head) {
          hhHeadMap.set(h.id, head.full_name);
        }
      }
    });

    // We store residents by name for quick lookup. If multiple exists, we group them.
    const nameMap = new Map<string, Array<{ dob: string; group: string; headName: string; isHead: boolean }>>();
    residents.forEach(r => {
      const nameKey = r.full_name.trim().toLowerCase();
      const info = {
        dob: (r.dob || '').trim(),
        group: hhGroupMap.get(r.household_id) || '',
        headName: hhHeadMap.get(r.household_id) || '',
        isHead: r.is_head || false
      };
      if (!nameMap.has(nameKey)) {
        nameMap.set(nameKey, []);
      }
      nameMap.get(nameKey)!.push(info);
    });

    return nameMap;
  }, [residents, households]);

  // Tập hợp tên các CHỦ HỘ từ CSDL hộ khẩu để đối chiếu nhanh và chính xác cho Tab 2
  const headNamesSet = useMemo(() => {
    const headNames = new Set<string>();
    households.forEach(h => {
      if (h.head_of_household_id) {
        const headRes = residents.find(r => r.id === h.head_of_household_id);
        if (headRes) headNames.add(headRes.full_name.trim().toLowerCase());
      }
    });
    residents.forEach(r => {
      if (r.is_head || (r.relationship_with_head && r.relationship_with_head.toLowerCase().trim() === 'chủ hộ')) {
        headNames.add(r.full_name.trim().toLowerCase());
      }
    });
    funds.forEach(f => {
      if (f.note && (f.note.includes('Chủ hộ') || f.note.includes('Hộ'))) {
        headNames.add(f.full_name.trim().toLowerCase());
      }
    });
    return headNames;
  }, [households, residents, funds]);

  // Pre-calculated O(1) Maps for zero-latency page renders
  const householdMap = useMemo(() => {
    const map = new Map<string, Household>();
    households.forEach(h => map.set(h.id, h));
    return map;
  }, [households]);

  const residentsByNameMap = useMemo(() => {
    const map = new Map<string, Resident[]>();
    residents.forEach(r => {
      const k = r.full_name.trim().toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return map;
  }, [residents]);

  const headNameForHHMap = useMemo(() => {
    const resIdMap = new Map<string, Resident>();
    residents.forEach(r => resIdMap.set(r.id, r));

    const headMap = new Map<string, string>();
    households.forEach(h => {
      if (h.head_of_household_id) {
        const head = resIdMap.get(h.head_of_household_id);
        if (head) headMap.set(h.id, head.full_name);
      }
    });
    return headMap;
  }, [households, residents]);

  // A fast O(1) helper function to find resident info by name and dob
  const findResidentGroupAndHead = (name: string, dob: string) => {
    const nameKey = name.trim().toLowerCase();
    const list = residentsInfoLookup.get(nameKey);
    if (!list || list.length === 0) return { group: '', headName: '', isHead: false };
    
    const cleanDob = dob.trim();
    if (cleanDob) {
      const normClean = normalizeDateToCompare(cleanDob);
      const matched = list.find(r => {
        const normR = normalizeDateToCompare(r.dob);
        return normR === normClean || r.dob.includes(cleanDob) || cleanDob.includes(r.dob);
      });
      if (matched) return matched;
      const noDobMatch = list.find(r => !r.dob);
      if (noDobMatch) return noDobMatch;
      return { group: '', headName: '', isHead: false };
    }
    
    if (list.length === 1) return list[0];
    return { group: '', headName: '', isHead: false };
  };

  // Helper to resolve group/tổ of a fund record directly
  const getGroupOfFundRecord = (f: WardFund) => {
    // 1. Quét địa chỉ trước để lấy tổ/cụm thực tế ghi trên địa chỉ (độ ưu tiên cao nhất)
    const addr = (f.address || '').toLowerCase();
    for (const g of groups) {
      const gLower = g.toLowerCase();
      if (addr.includes(gLower)) {
        return g;
      }
      const numMatch = g.match(/\d+/);
      if (numMatch) {
        const num = numMatch[0];
        if (addr.includes(`tổ ${num}`) || addr.includes(`tổ: ${num}`) || addr.includes(`tổ tự quản ${num}`) || addr.includes(`tổ tự quản số ${num}`)) {
          return g;
        }
      }
    }

    // 2. Nếu địa chỉ không ghi rõ tổ/cụm cụ thể, đối chiếu với danh sách nhân khẩu trong cơ sở dữ liệu
    const info = findResidentGroupAndHead(f.full_name, f.dob || '');
    if (info.group) {
      return info.group;
    }
    
    return '';
  };

  // Hàm tra cứu khớp chính xác Hộ gia đình cho từng bản ghi quỹ Phường dựa trên Tên, Ngày sinh, Tổ (user_id) & Địa chỉ
  const findMatchingHouseholdForWardFund = (f: WardFund) => {
    const nameKey = f.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
    const dobClean = (f.dob || '').trim();
    const yearClean = dobClean.match(/\d{4}/)?.[0] || '';
    const addrClean = (f.address || '').trim().toLowerCase().replace(/\s+/g, ' ');

    // 1. Lọc tất cả nhân khẩu trùng tên trong CSDL (O(1) lookup)
    let candidates = residentsByNameMap.get(nameKey) || [];

    let matchedResident: Resident | undefined = undefined;

    if (candidates.length === 1) {
      matchedResident = candidates[0];
    } else if (candidates.length > 1) {
      let filtered = candidates;

      // a. Ưu tiên khớp Tổ (user_id) nếu bản ghi có user_id
      if (f.user_id) {
        const userMatch = filtered.filter(r => r.user_id === f.user_id);
        if (userMatch.length > 0) filtered = userMatch;
      }

      // b. Tiếp theo khớp Ngày sinh hoặc Năm sinh
      if (filtered.length > 1 && dobClean) {
        const normClean = normalizeDateToCompare(dobClean);
        const exactDobMatch = filtered.filter(r => {
          const normR = normalizeDateToCompare(r.dob);
          return r.dob && (normR === normClean || r.dob.trim() === dobClean || r.dob.includes(dobClean) || dobClean.includes(r.dob));
        });
        if (exactDobMatch.length > 0) {
          filtered = exactDobMatch;
        } else if (yearClean) {
          const yearMatch = filtered.filter(r => (r.dob || '').includes(yearClean));
          if (yearMatch.length > 0) filtered = yearMatch;
        }
      }

      // c. Tiếp theo khớp Tên chủ hộ nếu địa chỉ chứa tên chủ hộ (vd: "Hộ bà Trương Thị Phương")
      if (filtered.length > 1 && addrClean) {
        const headMatch = filtered.filter(r => {
          const headName = headNameForHHMap.get(r.household_id)?.toLowerCase() || '';
          return headName && (addrClean.includes(headName) || headName.includes(addrClean));
        });
        if (headMatch.length > 0) filtered = headMatch;
      }

      // d. Tiếp theo khớp Địa chỉ hoặc Tổ tự quản của Hộ
      if (filtered.length > 1 && addrClean) {
        const addrMatch = filtered.filter(r => {
          const hh = householdMap.get(r.household_id);
          if (!hh) return false;
          const hhAddr = (hh.address || '').trim().toLowerCase();
          return hhAddr === addrClean || addrClean.includes(hhAddr) || hhAddr.includes(addrClean);
        });
        if (addrMatch.length > 0) filtered = addrMatch;
      }

      matchedResident = filtered[0];
    }

    if (matchedResident) {
      const hh = householdMap.get(matchedResident.household_id);
      return {
        householdId: matchedResident.household_id,
        address: hh?.address || f.address || '',
        headName: headNameForHHMap.get(matchedResident.household_id) || f.full_name,
        groupName: (hh as any)?.self_management_group || getGroupOfFundRecord(f)
      };
    }

    // 2. Nếu không khớp nhân khẩu trong CSDL, thử đối chiếu với Hộ gia đình bằng Tên Chủ hộ có trong địa chỉ
    if (addrClean) {
      const matchedHhByHead = households.find(h => {
        const headName = headNameForHHMap.get(h.id)?.toLowerCase();
        if (!headName) return false;
        return addrClean.includes(headName);
      });
      if (matchedHhByHead) {
        return {
          householdId: matchedHhByHead.id,
          address: matchedHhByHead.address || f.address || '',
          headName: headNameForHHMap.get(matchedHhByHead.id) || f.full_name,
          groupName: (matchedHhByHead as any)?.self_management_group || getGroupOfFundRecord(f)
        };
      }

      // Thử đối chiếu với Hộ gia đình bằng địa chỉ + user_id
      const matchedHh = households.find(h => {
        const hhAddr = (h.address || '').trim().toLowerCase();
        const addrOk = hhAddr === addrClean || addrClean.includes(hhAddr) || hhAddr.includes(addrClean);
        const userOk = f.user_id ? h.user_id === f.user_id : true;
        return addrOk && userOk;
      });
      if (matchedHh) {
        return {
          householdId: matchedHh.id,
          address: matchedHh.address || f.address || '',
          headName: headNameForHHMap.get(matchedHh.id) || f.full_name,
          groupName: (matchedHh as any)?.self_management_group || getGroupOfFundRecord(f)
        };
      }
    }

    // 3. Hộ ảo: Nếu dùng chung địa chỉ (vd: "Hộ bà Trương Thị Phương"), gom chung các thành viên vào 1 Hộ
    const addrKey = addrClean ? addrClean : ('name__' + nameKey);
    const fallbackId = 'addr__' + addrKey + '__' + (f.user_id || '');

    let derivedHeadName = f.full_name;
    const hoMatch = f.address?.match(/hộ\s+(?:ông|bà)?\s*([^\s,,-]+(?:\s+[^\s,,-]+)+)/i);
    if (hoMatch && hoMatch[1]) {
      derivedHeadName = hoMatch[1].trim();
    }

    return {
      householdId: fallbackId,
      address: f.address || '',
      headName: derivedHeadName,
      groupName: getGroupOfFundRecord(f)
    };
  };

  // Pre-calculate metadata (group, household info) for all fund records to ensure 60fps search/filter performance
  const fundMetaMap = useMemo(() => {
    const map = new Map<string, { householdId: string; address: string; headName: string; groupName: string }>();
    const cache = matchCacheRef.current;
    
    funds.forEach(f => {
      const key = `${f.full_name}_${f.dob || ''}_${f.address || ''}_${f.user_id || ''}`;
      let info = cache.get(key);
      if (!info) {
        info = findMatchingHouseholdForWardFund(f);
        cache.set(key, info);
      }
      map.set(f.id, info);
    });
    return map;
  }, [funds, residents, households, groups, residentsInfoLookup]);

  // Helper loại bỏ dấu tiếng Việt để phục vụ tìm kiếm không dấu linh hoạt
  const removeAccents = (str: string): string => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  };

  // Filtered List với Tìm kiếm siêu thông minh (Hỗ trợ Không dấu + Tìm theo tên mọi thành viên trong hộ + Địa chỉ + Ghi chú + Tổ)
  const filteredFunds = useMemo(() => {
    const rawTerm = searchTerm.trim().toLowerCase();
    const termNoAccent = removeAccents(rawTerm);

    const list = funds.filter(f => {
      const meta = fundMetaMap.get(f.id);
      const headName = meta?.headName || '';
      const groupName = meta?.groupName || '';
      const hhId = meta?.householdId;

      // Gom tất cả tên thành viên trong hộ gia đình này để khi gõ tên bất kỳ thành viên nào cũng tìm thấy Hộ
      let memberNamesStr = '';
      if (hhId && !hhId.startsWith('addr__')) {
        const hhMembers = residents.filter(r => r.household_id === hhId);
        memberNamesStr = hhMembers.map(m => m.full_name).join(' ');
      }

      const searchableText = `${f.full_name} ${f.address || ''} ${f.note || ''} ${f.dob || ''} ${headName} ${groupName} ${memberNamesStr}`.toLowerCase();
      const searchableNoAccent = removeAccents(searchableText);

      const matchesSearch = !rawTerm || 
        searchableText.includes(rawTerm) || 
        searchableNoAccent.includes(termNoAccent);
      
      if (!matchesSearch) return false;

      let matchesStatus = true;
      if (filterStatus === 'paid_all') {
        matchesStatus = activeFunds.every(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
          return contrib.actual >= contrib.expected;
        });
      } else if (filterStatus === 'unpaid_any') {
        matchesStatus = activeFunds.some(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
          return contrib.actual < contrib.expected;
        });
      }
      if (!matchesStatus) return false;

      // Filter group
      if (groupFilter !== 'all') {
        const fundGroup = meta?.groupName || '';
        if (fundGroup !== groupFilter) return false;
      }

      return true;
    });

    // Lọc chỉ giữ lại đại diện hộ nếu ở Tab thu theo Hộ:
    let filteredByMode: WardFund[];
    if (subTabMode === 'household_list') {
      const seenHouseholdIds = new Set<string>();
      const seenNames = new Set<string>();
      filteredByMode = list.filter(f => {
        const nameKey = f.full_name.trim().toLowerCase();
        const meta = fundMetaMap.get(f.id);
        const hhId = meta?.householdId;

        if (hhId && seenHouseholdIds.has(hhId)) return false;
        if (seenNames.has(nameKey)) return false;

        const isHead = headNamesSet.has(nameKey) || (f.note && (f.note.includes('Chủ hộ') || f.note.includes('Hộ')));
        
        if (isHead) {
          if (hhId) seenHouseholdIds.add(hhId);
          seenNames.add(nameKey);
          return true;
        }

        // Đảm bảo mọi Hộ dân xuất hiện ít nhất 1 dòng đại diện trong Tab Hộ
        if (hhId && !seenHouseholdIds.has(hhId)) {
          seenHouseholdIds.add(hhId);
          seenNames.add(nameKey);
          return true;
        }

        return false;
      });
    } else {
      filteredByMode = list;
    }

    // Sắp xếp thứ tự ưu tiên theo Cụm/Tổ đã cấu hình
    return filteredByMode.sort((a, b) => {
      const grpA = fundMetaMap.get(a.id)?.groupName || '';
      const grpB = fundMetaMap.get(b.id)?.groupName || '';

      const idxA = groups.findIndex(g => g.trim().toLowerCase() === grpA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === grpB.trim().toLowerCase());

      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.full_name.localeCompare(b.full_name, 'vi');
    });
  }, [funds, searchTerm, filterStatus, activeFunds, groupFilter, subTabMode, fundMetaMap, groups, headNamesSet]);

  // *** Map tính chỉ tiêu kỳ vọng ĐÚNG theo tuổi/giới tính thực tế từ CSDL nhân khẩu ***
  // Override giá trị lưu trong DB để hiển thị đúng ngay lập tức, không cần đồng bộ thủ công
  const computedExpectedMap = useMemo(() => {
    const currentYear = new Date().getFullYear(); // Luôn dùng năm hiện tại để tính tuổi

    const parseAgeRange = (ageRangeStr: string | undefined) => {
      const result = { maleMin: 18, maleMax: 61, femaleMin: 18, femaleMax: 58 };
      if (!ageRangeStr) return result;
      const s = ageRangeStr.toLowerCase();
      const mM = s.match(/nam[^\d]*(\d+)\s*(?:-|đến|tới|\.\.)\s*(\d+)/);
      if (mM) { result.maleMin = parseInt(mM[1], 10); result.maleMax = parseInt(mM[2], 10); }
      const fM = s.match(/(?:nữ|nu)[^\d]*(\d+)\s*(?:-|đến|tới|\.\.)\s*(\d+)/);
      if (fM) { result.femaleMin = parseInt(fM[1], 10); result.femaleMax = parseInt(fM[2], 10); }
      return result;
    };

    const resultMap = new Map<string, Record<string, number>>();
    funds.forEach(f => {
      const expected: Record<string, number> = {};

      // Ưu tiên sử dụng mức chỉ tiêu expected đã được khởi tạo/lưu trong contributions của bản ghi
      if (f.contributions) {
        Object.keys(f.contributions).forEach(k => {
          if (typeof f.contributions[k]?.expected === 'number') {
            expected[k] = f.contributions[k].expected;
          }
        });
      }

      // Dự phòng nếu chưa có thông tin trong contributions
      let matchedRes: Resident | undefined;
      if (f.user_id) matchedRes = residents.find(r => r.id === f.user_id);
      if (!matchedRes && f.full_name) {
        const cands = residentsByNameMap.get(f.full_name.trim().toLowerCase()) || [];
        if (cands.length === 1) matchedRes = cands[0];
        else if (cands.length > 1) {
          matchedRes = f.dob ? cands.find(r => r.dob === f.dob) || cands[0] : cands[0];
        }
      }

      activeFunds.forEach((fund: any) => {
        if (expected[fund.name] !== undefined) return;

        const isHH = fund.scope === 'household'
          || fund.name.toLowerCase().includes('hộ')
          || fund.name.toLowerCase().includes('người cao tuổi')
          || fund.name.toLowerCase().includes('cao tuổi');
        if (isHH) {
          expected[fund.name] = 0;
          return;
        }

        if (matchedRes) {
          const hh = households.find(h => h.id === matchedRes!.household_id);
          const isPolicyHousehold = hh && (hh.policy_type === 'poor' || hh.policy_type === 'near_poor' || hh.policy_type === 'policy_family');
          if (isPolicyHousehold) {
            expected[fund.name] = 0;
            return;
          }

          const pensionKeywords = ['hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật', 'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu'];
          const occLower = (matchedRes.occupation || '').toLowerCase();
          const notesLower = (matchedRes.notes || '').toLowerCase();
          if (pensionKeywords.some(k => occLower.includes(k) || notesLower.includes(k))) {
            expected[fund.name] = 0;
            return;
          }
        }

        let isFemale = false;
        if (matchedRes) {
          const g = (matchedRes.gender || '').toString().toLowerCase().trim();
          isFemale = g === 'female' || g === 'nữ' || g === 'nu' || g.startsWith('f');
        } else {
          const n = (f.full_name || '').toLowerCase();
          isFemale = n.includes(' thị ') || n.endsWith(' thị');
        }

        const dobStr = f.dob || (matchedRes ? matchedRes.dob : '');
        const age = calculateExactAge(dobStr, selectedYear);

        const lim = parseAgeRange(fund.age_range);
        const shouldPay = isFemale
          ? age >= lim.femaleMin && age <= lim.femaleMax
          : age >= lim.maleMin && age <= lim.maleMax;
        expected[fund.name] = shouldPay ? fund.target : 0;
      });

      resultMap.set(f.id, expected);
    });
    return resultMap;
  }, [funds, residents, residentsByNameMap, activeFunds, households]);

  // Danh sách gom theo hộ gia đình cho chế độ xem “Thu gom theo Hộ”
  const householdGroupedFunds = useMemo(() => {
    type HHGroup = { householdId: string; headName: string; address: string; groupName: string; members: WardFund[] };
    const groupMap = new Map<string, HHGroup>();
    filteredFunds.forEach(f => {
      const hhInfo = fundMetaMap.get(f.id) || findMatchingHouseholdForWardFund(f);
      const householdId = hhInfo.householdId;
      const address = hhInfo.address || f.address || '';
      const headName = hhInfo.headName || '';
      const groupName = hhInfo.groupName || '';
      if (!groupMap.has(householdId)) {
        groupMap.set(householdId, { householdId, headName, address, groupName, members: [] });
      }
      groupMap.get(householdId)!.members.push(f);
    });
    groupMap.forEach(g => {
      g.members.sort((a, b) => {
        const aH = headNamesSet.has(a.full_name.trim().toLowerCase());
        const bH = headNamesSet.has(b.full_name.trim().toLowerCase());
        if (aH !== bH) return aH ? -1 : 1;
        return a.full_name.localeCompare(b.full_name, 'vi');
      });
    });
    return Array.from(groupMap.values()).sort((a, b) => {
      const iA = groups.findIndex(g => g.toLowerCase() === a.groupName.toLowerCase());
      const iB = groups.findIndex(g => g.toLowerCase() === b.groupName.toLowerCase());
      const rA = iA >= 0 ? iA : 999;
      const rB = iB >= 0 ? iB : 999;
      if (rA !== rB) return rA - rB;
      return a.address.localeCompare(b.address, 'vi');
    });
  }, [filteredFunds, fundMetaMap, groups, headNamesSet]);

  // Calculate Statistics dynamically - luôn dùng chỉ tiêu mới nhất từ cấu hình
  const fundStats = activeFunds.map(fund => {
    const isHouseholdScope = (fund as any).scope === 'household'
      || fund.name.toLowerCase().includes('hộ')
      || fund.name.toLowerCase().includes('người cao tuổi')
      || fund.name.toLowerCase().includes('cao tuổi');

    // Tính tổng số tiền phải thu: chỉ tính từ bản ghi có expected > 0
    const recordsWithExpected = funds.filter(f => (f.contributions?.[fund.name]?.expected || 0) > 0);
    const expected = recordsWithExpected.length > 0
      ? recordsWithExpected.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.expected || 0), 0)
      : fund.target * (isHouseholdScope
          ? new Set(funds.map(f => fundMetaMap.get(f.id)?.householdId).filter(Boolean)).size
          : funds.length);

    const actual = funds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
    const percent = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    const remaining = Math.max(0, expected - actual);
    return {
      name: fund.name,
      target: fund.target,
      scope: isHouseholdScope ? 'household' : 'person',
      expected,
      actual,
      percent,
      remaining
    };
  });

  // Add new record manually
  const handleAddNewRecord = () => {
    if (isGuest) {
      showToast('Khách không có quyền thêm mới dữ liệu đóng quỹ!', 'warning');
      return;
    }
    const newRecord: WardFund = {
      id: generateUUID(),
      year: selectedYear,
      full_name: '',
      dob: '',
      address: '',
      contributions: {},
      note: ''
    };
    setEditingRecord(newRecord);
    setFullNameInput('');
    setDobInput('');
    setAddressInput('');
    setNote('');

    const inputs: Record<string, { expected: string; actual: string; date: string }> = {};
    activeFunds.forEach(fund => {
      inputs[fund.name] = {
        expected: fund.target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        actual: '0',
        date: new Date().toISOString().slice(0, 10)
      };
    });
    setContribInputs(inputs);
  };

  // Open Edit Modal
  const handleOpenPay = (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    setEditingRecord(record);
    setFullNameInput(record.full_name);

    // Tìm nhân khẩu tương ứng để lấy ngày sinh đầy đủ nếu record.dob chỉ chứa năm sinh
    let displayDob = record.dob || '';
    if (displayDob.length === 4) {
      const nameKey = record.full_name.trim().toLowerCase();
      const candidates = residents.filter(r => r.full_name.trim().toLowerCase() === nameKey);
      if (candidates.length === 1) {
        displayDob = formatDateVN(candidates[0].dob);
      } else if (candidates.length > 1) {
        const matched = candidates.find(r => r.user_id === record.user_id);
        if (matched) displayDob = formatDateVN(matched.dob);
      }
    } else {
      displayDob = formatDateVN(displayDob);
    }

    setDobInput(displayDob);
    setAddressInput(record.address || '');
    setNote(record.note || '');

    // Khởi tạo các ô nhập tiền động cho các quỹ - luôn dùng fund.target mới nhất từ cấu hình
    const inputs: Record<string, { expected: string; actual: string; date: string }> = {};
    activeFunds.forEach(fund => {
      const contrib = record.contributions?.[fund.name] || { expected: 0, actual: 0 };
      // Luôn lấy chỉ tiêu mới nhất từ cấu hình (fund.target) thay vì bản ghi cũ
      const latestExpected = fund.target;
      inputs[fund.name] = {
        expected: latestExpected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        actual: contrib.actual.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        date: contrib.date || new Date().toISOString().slice(0, 10)
      };
    });
    setContribInputs(inputs);
  };

  // Quick Pay (Mark fully paid for all funds / or toggle back to unpaid)
  const handleQuickPay = async (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    try {
      // Kiểm tra xem hiện tại đã đóng đủ chưa
      const isCurrentlyPaid = activeFunds.every(fund => {
        const contrib = record.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
        return contrib.actual >= contrib.expected && contrib.expected > 0;
      });

      const newContributions: Record<string, any> = { ...record.contributions };
      activeFunds.forEach(fund => {
        const existing = record.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
        // Luôn lấy chỉ tiêu mới nhất từ cấu hình nếu bản ghi cũ có expected = 0
        const latestExpected = existing.expected > 0 ? existing.expected : fund.target;
        newContributions[fund.name] = {
          expected: latestExpected,
          actual: isCurrentlyPaid ? 0 : latestExpected, // Nếu đã đóng đủ thì hủy đóng, ngược lại đóng đủ
          date: isCurrentlyPaid ? '' : (existing.date || new Date().toISOString().slice(0, 10))
        };
      });

      const payload: WardFund = {
        ...record,
        contributions: newContributions,
        note: isCurrentlyPaid 
          ? (record.note === 'Đã nộp đủ đợt tập trung' ? '' : record.note) // Xóa ghi chú tự động nếu hủy đóng
          : (record.note || 'Đã nộp đủ đợt tập trung')
      };
      await db.saveWardFund(payload);
      showToast(
        isCurrentlyPaid 
          ? `Đã hủy ghi nhận đóng quỹ cho ${record.full_name}` 
          : `Đã ghi nhận đóng đủ các quỹ cho ${record.full_name}`, 
        'success'
      );
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Thao tác thất bại!', 'danger');
    }
  };

  // Thu nhanh toàn bộ thành viên của 1 hộ gia đình cùng 1 lần (gồm Quỹ Phường + Quỹ TDP theo thông báo)
  const handleQuickPayHousehold = async (members: WardFund[], forceCancel?: boolean, targetHouseholdId?: string) => {
    if (isGuest) { showToast('Khách không có quyền sửa!', 'warning'); return; }
    try {
      let householdId = targetHouseholdId || '';
      if (!householdId || householdId.startsWith('addr__')) {
        for (const m of members) {
          const hhInfo = findMatchingHouseholdForWardFund(m);
          if (hhInfo.householdId && !hhInfo.householdId.startsWith('addr__')) {
            householdId = hhInfo.householdId;
            break;
          }
        }
      }

      let household = households.find(h => h.id === householdId);
      if (!household && householdId.startsWith('addr__')) {
        const firstM = members[0];
        const addrClean = (firstM?.address || '').trim().toLowerCase();
        const matchedHh = households.find(h => (h.address || '').trim().toLowerCase() === addrClean);
        if (matchedHh) {
          household = matchedHh;
          householdId = matchedHh.id;
        }
      }

      const tdpActiveFunds = (db as any).getFundList() || [];
      
      let householdPaidFunds: HouseholdFund[] = [];
      try {
        householdPaidFunds = await db.getHouseholdFunds();
      } catch { /* ignore */ }
      const filteredHhFunds = householdPaidFunds.filter(hf => hf.household_id === householdId && hf.year === selectedYear);

      let financialRecords: FinancialRecord[] = [];
      try {
        financialRecords = await db.getFinancialRecords() || [];
      } catch { /* ignore */ }

      const allWardPaid = members.every(m =>
        activeFunds.every(fund => {
          const c = m.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          return c.actual >= c.expected && c.expected > 0;
        })
      );

      const allTdpPaid = tdpActiveFunds.length > 0 && tdpActiveFunds.every((fund: any) => {
        const paidFund = filteredHhFunds.find(hf => hf.fund_name === fund.name);
        return paidFund && paidFund.amount >= fund.target;
      });

      const shouldPay = forceCancel !== undefined ? !forceCancel : (!allWardPaid || !allTdpPaid);
      const today = new Date().toISOString().slice(0, 10);

      // 1. Lưu đóng quỹ Phường
      const memberContribMaps = members.map(m => ({ ...m.contributions }));

      activeFunds.forEach(fund => {
        const isHouseholdFund = (fund as any).scope === 'household' || fund.name.toLowerCase().includes('hộ') || fund.name.toLowerCase().includes('cao tuổi') || fund.name.toLowerCase().includes('người cao tuổi');
        
        if (isHouseholdFund) {
          let primaryIndex = members.findIndex(m => (m.contributions?.[fund.name]?.expected || 0) > 0);
          if (primaryIndex < 0) primaryIndex = 0;

          members.forEach((m, idx) => {
            const c = m.contributions?.[fund.name] || { expected: 0, actual: 0 };
            if (idx === primaryIndex) {
              const targetExp = c.expected > 0 ? c.expected : fund.target;
              memberContribMaps[idx][fund.name] = {
                expected: targetExp,
                actual: shouldPay ? targetExp : 0,
                date: shouldPay ? today : ''
              };
            } else {
              memberContribMaps[idx][fund.name] = {
                expected: c.expected || 0,
                actual: 0,
                date: ''
              };
            }
          });
        } else {
          members.forEach((m, idx) => {
            const c = m.contributions?.[fund.name] || { expected: 0, actual: 0 };
            
            let inLaborAge = true;
            if (m.dob) {
              const year = parseInt(m.dob.match(/\d{4}/)?.[0] || '0', 10);
              if (year > 0) {
                const age = selectedYear - year;
                const gender = (m as any).gender;
                if (gender === 'male') inLaborAge = age >= 18 && age <= 61;
                else if (gender === 'female') inLaborAge = age >= 18 && age <= 58;
                else inLaborAge = age >= 18 && age <= 60;
              }
            }

            const expVal = inLaborAge ? (c.expected > 0 ? c.expected : fund.target) : (c.expected > 0 ? c.expected : 0);
            memberContribMaps[idx][fund.name] = {
              expected: expVal,
              actual: (shouldPay && expVal > 0) ? expVal : 0,
              date: (shouldPay && expVal > 0) ? today : ''
            };
          });
        }
      });

      await Promise.all(members.map(async (m, idx) => {
        await db.saveWardFund({ ...m, contributions: memberContribMaps[idx], note: shouldPay ? 'Đã nộp đủ đợt tập trung' : '' });
      }));

      // 2. Lưu đóng quỹ TDP và đồng bộ Sổ quỹ chung
      if (householdId && !householdId.startsWith('addr__')) {
        const firstMember = members[0];
        const headResident = residents.find(r => (household && r.id === household.head_of_household_id) || r.is_head);
        const headName = headResident ? headResident.full_name : (household?.martyr_name || (firstMember ? firstMember.full_name : 'Đại diện hộ'));

        for (const fund of tdpActiveFunds) {
          const existing = filteredHhFunds.find(hf => hf.fund_name === fund.name);
          const targetId = existing ? existing.id : generateUUID();
          const flagText = `[QUY_${targetId}]`;
          const matchedGeneral = financialRecords.find(r => r.description.includes(flagText));

          if (shouldPay) {
            const payload: HouseholdFund = {
              id: targetId,
              household_id: householdId,
              year: selectedYear,
              fund_name: fund.name,
              amount: fund.target,
              paid_at: today,
              note: 'Đã thu đủ theo thông báo'
            };
            await db.saveHouseholdFund(payload);

            const generalRecord: FinancialRecord = {
              id: matchedGeneral ? matchedGeneral.id : generateUUID(),
              group_id: db.getGroupId(),
              type: 'income',
              amount: fund.target,
              category: fund.name,
              description: `Thu ${fund.name} - Hộ ${headName} ${flagText}`,
              recorded_by: 'Hệ thống tự động',
              date: today,
              created_at: matchedGeneral ? matchedGeneral.created_at : new Date().toISOString()
            };
            await db.saveFinancialRecord(generalRecord);
          } else {
            if (matchedGeneral) {
              await db.deleteFinancialRecord(matchedGeneral.id);
            }
            if (existing) {
              await db.deleteHouseholdFund(targetId);
            }
          }
        }
      }

      showToast(
        shouldPay 
          ? `✅ Đã thu đủ và lập phiếu thu gộp (TDP + Phường) cho hộ dân!` 
          : `↩ Đã hủy ghi nhận thu quỹ của hộ gia đình!`, 
        'success'
      );
      loadData();
    } catch { showToast('Có lỗi khi cập nhật!', 'danger'); }
  };

  // Save Edit Modal
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!fullNameInput.trim()) {
      showToast('Vui lòng nhập họ và tên!', 'warning');
      return;
    }

    // Parse các chỉ tiêu đóng quỹ
    const newContributions: Record<string, any> = {};
    for (const fundName of Object.keys(contribInputs)) {
      const input = contribInputs[fundName];
      const exp = parseInt(input.expected.replace(/\./g, '')) || 0;
      const act = parseInt(input.actual.replace(/\./g, '')) || 0;
      if (exp < 0 || act < 0) {
        showToast(`Số tiền của quỹ "${fundName}" không hợp lệ!`, 'warning');
        return;
      }
      newContributions[fundName] = {
        expected: exp,
        actual: act,
        date: act > 0 ? input.date : undefined
      };
    }

    // Kiểm tra xem có còn đóng đủ tất cả các quỹ không
    const isAllPaid = activeFunds.every(fund => {
      const contrib = newContributions[fund.name] || { expected: fund.target, actual: 0 };
      return contrib.actual >= contrib.expected && contrib.expected > 0;
    });

    let finalNote = note.trim();
    if (!isAllPaid && finalNote === 'Đã nộp đủ đợt tập trung') {
      finalNote = '';
    }

    try {
      const payload: WardFund = {
        ...editingRecord,
        full_name: fullNameInput.trim(),
        dob: dobInput.trim() || undefined,
        address: addressInput.trim() || undefined,
        contributions: newContributions,
        note: finalNote || undefined
      };
      await db.saveWardFund(payload);
      showToast('Cập nhật thông tin thành công!', 'success');
      setEditingRecord(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi cập nhật dữ liệu đóng quỹ!', 'danger');
    }
  };

  // Delete Individual Record
  const handleDeleteRecord = async (id: string, name: string) => {
    if (isGuest) {
      showToast('Khách không có quyền xóa dữ liệu đóng quỹ!', 'warning');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa dòng thông tin đóng quỹ của cá nhân "${name}" khỏi danh sách năm ${selectedYear}?`)) {
      try {
        await db.deleteWardFund(id);
        showToast('Đã xóa bản ghi thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa bản ghi!', 'danger');
      }
    }
  };

  // Clear All Year Data
  const handleClearYearData = async () => {
    if (isGuest) {
      showToast('Khách không có quyền xóa dữ liệu đóng quỹ!', 'warning');
      return;
    }
    if (window.confirm(`CẢNH BÁO CỰC KỲ QUAN TRỌNG: Bạn có chắc chắn muốn xóa toàn bộ danh sách quỹ Phường của năm ${selectedYear}? Hành động này sẽ xóa vĩnh viễn dữ liệu đã lưu và không thể hoàn tác.`)) {
      const secondConfirm = window.confirm(`Vui lòng xác nhận một lần nữa để xóa hết dữ liệu quỹ năm ${selectedYear}.`);
      if (secondConfirm) {
        try {
          setIsLoading(true);
          await db.clearWardFunds(selectedYear);
          showToast(`Đã dọn dẹp sạch dữ liệu đóng quỹ năm ${selectedYear}!`, 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        } catch (e) {
          showToast('Lỗi khi dọn dẹp dữ liệu!', 'danger');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  // Excel Sample Template Download (Dynamic column setup)
  const handleExportTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mẫu Danh Sách Quỹ Phường');

      // Title rows
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MẪU NHẬP LIỆU THU QUỸ PHƯỜNG NĂM ${selectedYear}`;
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.mergeCells('A1:F1');
      worksheet.getRow(1).height = 30;

      const subCell = worksheet.getCell('A2');
      subCell.value = 'Lưu ý: Không chỉnh sửa các cột tiêu đề. Nhập số nguyên không có chấm hay phẩy cho các mức quỹ phải đóng.';
      subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
      worksheet.mergeCells('A2:F2');
      worksheet.getRow(2).height = 20;

      // Headers row dynamically built
      const headers = [
        'STT',
        'Họ và tên',
        'Năm sinh / Ngày sinh',
        'Địa chỉ (Số nhà / Ngõ)',
        ...activeFunds.map(f => `${f.name} (Đồng)`)
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;
      
      // Styling header row
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      // Dynamic Sample Data
      const sampleData = [
        [1, 'Nguyễn Văn A', '1985', 'Số nhà 12 - Tổ 4', ...activeFunds.map(f => f.target)],
        [2, 'Trần Thị B', '1992', 'Ngõ 2A - Hộ số 5', ...activeFunds.map(f => f.target)],
        [3, 'Lê Văn C', '05/10/1990', 'Đường Quảng Giao', ...activeFunds.map(f => f.name.includes('thiên tai') ? 0 : f.target)]
      ];

      sampleData.forEach(row => {
        const dataRow = worksheet.addRow(row);
        dataRow.height = 22;
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

        for (let i = 0; i < activeFunds.length; i++) {
          const colIdx = 5 + i;
          dataRow.getCell(colIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(colIdx).numFmt = '#,##0';
        }
      });

      // Border and gridlines
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          });
        }
      });

      // Auto width
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 6;
        else if (idx === 1) col.width = 25;
        else if (idx === 2) col.width = 18;
        else if (idx === 3) col.width = 30;
        else col.width = 35;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Mau_Nhap_Lieu_Quy_Phuong_${selectedYear}.xlsx`;
      link.click();
      showToast('Đã tải xuống file Excel mẫu thành công!', 'success');
    } catch (e) {
      showToast('Không thể tạo file mẫu!', 'danger');
    }
  };

  // Auto-initialize Ward Funds covering 100% Households & Residents across all data sources
  const handleAutoInitFromResidents = async () => {
    if (isGuest) {
      showToast('Bạn không có quyền khởi tạo dữ liệu đóng quỹ!', 'warning');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn TỰ ĐỘNG KHỞI TẠO danh sách thu quỹ năm ${selectedYear} cho 100% Hộ gia đình & Nhân khẩu không?\n\n` +
      `Chi tiết quy tắc khởi tạo:\n` +
      `1. Quét toàn bộ CSDL Hộ khẩu và Nhân khẩu để đảm bảo 100% các Hộ dân đều có bản ghi đại diện (Chủ hộ).\n` +
      `2. Tự động tính Quỹ Phường cho nhân khẩu trong độ tuổi lao động: Nữ từ 18-58 tuổi, Nam từ 18-61 tuổi.\n` +
      `3. Các hộ/cá nhân thuộc diện miễn đóng Quỹ Phường vẫn sẽ có tên đại diện trong danh sách (mức thu Quỹ Phường = 0 VNĐ).`)) {
      
      setIsLoading(true);
      try {
        // 1. Lấy danh sách nhân khẩu và hộ khẩu
        const resList = await db.getResidents();
        const hhList = await db.getHouseholds();

        // 2. Lấy danh sách chỉ tiêu quỹ hiện tại
        const activeFundsList = (db as any).getWardFundList();

        const batchFunds: WardFund[] = [];
        const addedResidentIds = new Set<string>();
        let successCount = 0;

        // Định nghĩa các từ khóa nghề nghiệp/ghi chú của người về hưu hoặc hưởng lương hưu
        const pensionKeywords = ['hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật', 'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu'];

        // Helper tính đóng góp cho 1 cá nhân
        const calculateContributions = (r: Resident, hh?: Household, isHead: boolean = false) => {
          const isPolicyHousehold = hh && (hh.policy_type === 'poor' || hh.policy_type === 'near_poor' || hh.policy_type === 'policy_family');

          let age = 30; // Mặc định trong độ tuổi lao động nếu r.dob thiếu
          let parsedYear = 0;
          if (r.dob) {
            parsedYear = parseInt(r.dob.match(/\d{4}/)?.[0] || '0', 10);
            if (parsedYear > 0) {
              age = selectedYear - parsedYear;
            }
          }

          const gStr = (r.gender || '').toString().toLowerCase().trim();
          const hasThi = r.full_name.toLowerCase().includes(' thị ') || r.full_name.toLowerCase().includes(' thị');
          const isFemale = gStr === 'female' || gStr === 'nữ' || gStr === 'nu' || gStr.startsWith('f') || hasThi;
          const isMale = !isFemale && (gStr === 'male' || gStr === 'nam' || gStr.startsWith('m'));

          const isFemaleInAge = isFemale ? (age >= 18 && age <= 58) : false;
          const isMaleInAge = isMale ? (age >= 18 && age <= 61) : false;
          const isGeneralInAge = (!isFemale && !isMale) ? (age >= 18 && age <= 60) : false;
          const isInAgeRange = isFemaleInAge || isMaleInAge || isGeneralInAge;

          const occLower = (r.occupation || '').toLowerCase();
          const notesLower = (r.notes || '').toLowerCase();
          const isPensioner = pensionKeywords.some(key => occLower.includes(key) || notesLower.includes(key));

          const contributions: Record<string, any> = {};

          activeFundsList.forEach((fund: any) => {
            let expected = 0;

            if (isPolicyHousehold) {
              expected = 0;
            } else if (isPensioner) {
              expected = 0;
            } else {
              const isHouseholdScope = (fund as any).scope === 'household' || fund.name.toLowerCase().includes('hộ');
              if (isHouseholdScope) {
                if (isHead && age >= 18) {
                  expected = fund.target;
                }
              } else {
                if (isInAgeRange) {
                  expected = fund.target;
                }
              }
            }

            contributions[fund.name] = {
              expected,
              actual: 0
            };
          });

          return { contributions, isInAgeRange };
        };

        // BẢN ĐỒ TRA CỨU HỘ GIA ĐÌNH & NHÂN KHẨU
        const hhMap = new Map<string, Household>();
        hhList.forEach(h => hhMap.set(h.id, h));

        const resByHhId = new Map<string, Resident[]>();
        resList.forEach(r => {
          if (r.status === 'deceased') return;
          if (!r.household_id) return;
          if (!resByHhId.has(r.household_id)) {
            resByHhId.set(r.household_id, []);
          }
          resByHhId.get(r.household_id)!.push(r);
        });

        // Gom tất cả Household ID từ cả bảng Households lẫn bảng Residents
        const allHouseholdIds = new Set<string>();
        hhList.forEach(h => allHouseholdIds.add(h.id));
        resByHhId.forEach((_, hhId) => allHouseholdIds.add(hhId));

        // PASS 1: Khởi tạo tất cả Hộ gia đình (Bản ghi Chủ hộ / Đại diện Hộ)
        allHouseholdIds.forEach(hhId => {
          const hh = hhMap.get(hhId);
          const members = resByHhId.get(hhId) || [];
          
          let head: Resident | undefined = members.find(m => m.is_head) || 
                     members.find(m => hh && hh.head_of_household_id === m.id) || 
                     members.find(m => m.relationship_with_head && m.relationship_with_head.toLowerCase().trim() === 'chủ hộ') || 
                     members[0];

          if (!head && hh && hh.head_of_household_id) {
            head = resList.find(r => r.id === hh.head_of_household_id && r.status !== 'deceased');
          }

          if (head) {
            addedResidentIds.add(head.id);
            const { contributions } = calculateContributions(head, hh, true);

            batchFunds.push({
              id: generateUUID(),
              year: selectedYear,
              full_name: head.full_name.trim(),
              dob: head.dob ? formatDateVN(head.dob.trim()) : undefined,
              address: hh ? hh.address : (head.permanent_address || head.temporary_address),
              user_id: head.user_id || (hh ? hh.user_id : undefined),
              note: 'Chủ hộ (Bản ghi Hộ gia đình)',
              contributions
            });
            successCount++;
          } else if (hh) {
            // Trường hợp Hộ gia đình không có nhân khẩu trong CSDL
            const headTitle = hh.martyr_name ? `Hộ ${hh.martyr_name}` : (hh.household_number ? `Hộ ${hh.household_number}` : `Hộ tại ${hh.address}`);
            const emptyContributions: Record<string, any> = {};
            activeFundsList.forEach((fund: any) => {
              emptyContributions[fund.name] = { expected: 0, actual: 0 };
            });

            batchFunds.push({
              id: generateUUID(),
              year: selectedYear,
              full_name: headTitle,
              address: hh.address,
              user_id: hh.user_id,
              note: 'Hộ chưa có nhân khẩu trong CSDL',
              contributions: emptyContributions
            });
            successCount++;
          }
        });

        // PASS 2: Bổ sung các thành viên khác trong hộ nằm trong độ tuổi lao động (Nữ 18-58, Nam 18-61)
        resList.forEach(r => {
          if (r.status === 'deceased') return;
          if (addedResidentIds.has(r.id)) return; // Đã thêm ở Pass 1 làm chủ hộ

          const hh = r.household_id ? hhMap.get(r.household_id) : undefined;
          const { contributions, isInAgeRange } = calculateContributions(r, hh, false);

          const hasExpectedValue = Object.values(contributions).some((c: any) => c.expected > 0);
          if (isInAgeRange && hasExpectedValue) {
            batchFunds.push({
              id: generateUUID(),
              year: selectedYear,
              full_name: r.full_name.trim(),
              dob: r.dob ? formatDateVN(r.dob.trim()) : undefined,
              address: hh ? hh.address : (r.permanent_address || r.temporary_address),
              user_id: r.user_id,
              contributions
            });
            successCount++;
          }
        });

        if (batchFunds.length === 0) {
          showToast('Không tìm thấy dữ liệu Hộ gia đình hoặc Nhân khẩu để khởi tạo!', 'info');
        } else {
          // Xóa dữ liệu cũ của năm trước khi lưu danh sách mới khởi tạo để tránh nhân đôi bản ghi
          await db.clearWardFunds(selectedYear);
          // Lưu hàng loạt vào bảng ward_funds
          await db.saveWardFundsBatch(batchFunds);
          showToast(`Khởi tạo thành công! Đã quét và khởi tạo ${successCount} bản ghi Hộ gia đình & Nhân khẩu cho năm ${selectedYear}.`, 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        }
      } catch (err) {
        showToast('Lỗi trong quá trình khởi tạo dữ liệu!', 'danger');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Tự động quét và bổ sung các Hộ gia đình còn thiếu từ CSDL vào danh sách Quỹ Phường
  const handleSupplementMissingHouseholds = async () => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu!', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const resList = await db.getResidents();
      const hhList = await db.getHouseholds();
      const activeFundsList = (db as any).getWardFundList();

      const existingFundNames = new Set(funds.map(f => f.full_name.trim().toLowerCase()));
      const missingBatch: WardFund[] = [];
      let addedCount = 0;

      hhList.forEach(hh => {
        const members = resList.filter(r => r.household_id === hh.id && r.status !== 'deceased');
        const hasMemberInFund = members.some(m => existingFundNames.has(m.full_name.trim().toLowerCase()));

        if (!hasMemberInFund && members.length > 0) {
          const head = members.find(m => m.is_head) || members[0];
          const contributions: Record<string, any> = {};

          activeFundsList.forEach((fund: any) => {
            const isHouseholdScope = fund.scope === 'household' || fund.name.toLowerCase().includes('hộ') || fund.name.toLowerCase().includes('người cao tuổi') || fund.name.toLowerCase().includes('cao tuổi');
            contributions[fund.name] = {
              expected: isHouseholdScope ? fund.target : 0,
              actual: 0
            };
          });

          missingBatch.push({
            id: generateUUID(),
            year: selectedYear,
            full_name: head.full_name.trim(),
            dob: head.dob ? head.dob.slice(0, 4) : undefined,
            address: hh.address,
            user_id: head.user_id,
            note: 'Tự động bổ sung từ CSDL Hộ khẩu',
            contributions
          });
          addedCount++;
        }
      });

      if (missingBatch.length === 0) {
        showToast('Tất cả các Hộ dân trong CSDL đều đã có tên trong danh sách Quỹ Phường!', 'info');
      } else {
        await db.saveWardFundsBatch(missingBatch);
        showToast(`Đã tự động tìm và bổ sung ${addedCount} Hộ dân còn thiếu vào danh sách Quỹ Phường!`, 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      }
    } catch (e) {
      showToast('Lỗi khi tự động bổ sung hộ dân!', 'danger');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Tự động quét, đối chiếu và đồng bộ chuẩn thông tin Hộ, Tổ, Ngày sinh với CSDL Hộ khẩu
  const handleAutoSyncWithDB = async () => {
    if (isGuest) {
      showToast('Khách không có quyền sửa dữ liệu!', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const resList = await db.getResidents();
      const hhList = await db.getHouseholds();
      const currentFunds = await db.getWardFunds(selectedYear);

      const pensionKeywords = ['hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật', 'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu'];
      let matchedCount = 0;
      const updatedFunds: WardFund[] = [];

      currentFunds.forEach(f => {
        const nameKey = f.full_name.trim().toLowerCase();
        const dobClean = (f.dob || '').trim();
        const yearClean = dobClean.match(/\d{4}/)?.[0] || '';
        const addrClean = (f.address || '').trim().toLowerCase();

        // 1. Lọc tất cả nhân khẩu trùng tên
        const candidates = resList.filter(r => r.full_name.trim().toLowerCase() === nameKey);
        let matchedRes: Resident | undefined = undefined;

        if (candidates.length === 1) {
          matchedRes = candidates[0];
        } else if (candidates.length > 1) {
          let filtered = candidates;
          if (f.user_id) {
            const uMatch = filtered.filter(r => r.user_id === f.user_id);
            if (uMatch.length > 0) filtered = uMatch;
          }
          if (filtered.length > 1 && dobClean) {
            const normClean = normalizeDateToCompare(dobClean);
            const dobMatch = filtered.filter(r => {
              const normR = normalizeDateToCompare(r.dob);
              return r.dob && (normR === normClean || r.dob.trim() === dobClean || r.dob.includes(dobClean));
            });
            if (dobMatch.length > 0) filtered = dobMatch;
            else if (yearClean) {
              const yMatch = filtered.filter(r => (r.dob || '').includes(yearClean));
              if (yMatch.length > 0) filtered = yMatch;
            }
          }
          if (filtered.length > 1 && addrClean) {
            const headMatch = filtered.filter(r => {
              const hh = hhList.find(h => h.id === r.household_id);
              if (!hh || !hh.head_of_household_id) return false;
              const headRes = resList.find(res => res.id === hh.head_of_household_id);
              const headName = headRes?.full_name.toLowerCase() || '';
              return headName && (addrClean.includes(headName) || headName.includes(addrClean));
            });
            if (headMatch.length > 0) filtered = headMatch;
          }

          if (filtered.length > 1 && addrClean) {
            const aMatch = filtered.filter(r => {
              const hh = hhList.find(h => h.id === r.household_id);
              if (!hh) return false;
              const hAddr = (hh.address || '').trim().toLowerCase();
              return hAddr === addrClean || addrClean.includes(hAddr) || hAddr.includes(addrClean);
            });
            if (aMatch.length > 0) filtered = aMatch;
          }
          matchedRes = filtered[0];
        }

        let updated = false;
        let newUserId = f.user_id;
        let newDob = f.dob;
        let newAddress = f.address;
        let newContributions = f.contributions ? { ...f.contributions } : {};

        if (matchedRes) {
          const hh = hhList.find(h => h.id === matchedRes!.household_id);
          if (matchedRes.user_id && f.user_id !== matchedRes.user_id) {
            newUserId = matchedRes.user_id;
            updated = true;
          }
          if (matchedRes.dob && f.dob !== matchedRes.dob) {
            newDob = matchedRes.dob;
            updated = true;
          }
          if (hh?.address && f.address !== hh.address) {
            newAddress = hh.address;
            updated = true;
          }

          // Tự động tính toán lại chỉ tiêu đóng góp kỳ vọng của quỹ Phường dựa trên tuổi/giới tính mới cập nhật
          const isPolicyHousehold = hh && (hh.policy_type === 'poor' || hh.policy_type === 'near_poor' || hh.policy_type === 'policy_family');
          const age = calculateExactAge(matchedRes.dob, selectedYear);

          const mGStr = (matchedRes.gender || '').toString().toLowerCase().trim();
          const hasThi = matchedRes.full_name.toLowerCase().includes(' thị ') || matchedRes.full_name.toLowerCase().includes(' thị');
          const isFemale = mGStr === 'female' || mGStr === 'nữ' || mGStr === 'nu' || mGStr.startsWith('f') || hasThi;
          const isMale = !isFemale && (mGStr === 'male' || mGStr === 'nam' || mGStr.startsWith('m'));

          const activeFundsList = (db as any).getWardFundList() || [];
          activeFundsList.forEach((fund: any) => {
            const isPCTT = fund.name.toLowerCase().includes('thiên tai');
            const isDOdn = fund.name.toLowerCase().includes('đền ơn đáp nghĩa') || fund.name.toLowerCase().includes('đền ơn');
            
            let expected = 0;
            if (isPolicyHousehold) {
              expected = 0;
            } else {
              const occLower = (matchedRes!.occupation || '').toLowerCase();
              const notesLower = (matchedRes!.notes || '').toLowerCase();
              const isPensioner = pensionKeywords.some((key: string) => occLower.includes(key) || notesLower.includes(key));
              
              if (isPensioner) {
                expected = 0;
              } else {
                if (fund.scope === 'person' || isPCTT || isDOdn) {
                  const parseAgeRange = (ageRangeStr: string | undefined) => {
                    const result = { maleMin: 18, maleMax: 61, femaleMin: 18, femaleMax: 58, generalMin: 18, generalMax: 60 };
                    if (!ageRangeStr) return result;
                    const cleanStr = ageRangeStr.toLowerCase();
                    const maleMatch = cleanStr.match(/nam\s*(\d+)\s*-\s*(\d+)/);
                    if (maleMatch) {
                      result.maleMin = parseInt(maleMatch[1], 10);
                      result.maleMax = parseInt(maleMatch[2], 10);
                    }
                    const femaleMatch = cleanStr.match(/nữ\s*(\d+)\s*-\s*(\d+)/) || cleanStr.match(/nu\s*(\d+)\s*-\s*(\d+)/);
                    if (femaleMatch) {
                      result.femaleMin = parseInt(femaleMatch[1], 10);
                      result.femaleMax = parseInt(femaleMatch[2], 10);
                    }
                    const generalMatch = cleanStr.match(/(?:từ\s*)?(\d+)\s*-\s*(\d+)/);
                    if (generalMatch && !maleMatch && !femaleMatch) {
                      result.generalMin = parseInt(generalMatch[1], 10);
                      result.generalMax = parseInt(generalMatch[2], 10);
                    }
                    return result;
                  };

                  const ageLimits = parseAgeRange(fund.age_range);
                  const isMaleInAge = isMale ? (age >= ageLimits.maleMin && age <= ageLimits.maleMax) : false;
                  const isFemaleInAge = isFemale ? (age >= ageLimits.femaleMin && age <= ageLimits.femaleMax) : false;
                  const isGeneralInAge = (!isMale && !isFemale) ? (age >= ageLimits.generalMin && age <= ageLimits.generalMax) : false;
                  
                  if (isMaleInAge || isFemaleInAge || isGeneralInAge) {
                    expected = fund.target;
                  }
                } else {
                  const isHouseholdScope = fund.scope === 'household' || fund.name.toLowerCase().includes('hộ') || fund.name.toLowerCase().includes('người cao tuổi') || fund.name.toLowerCase().includes('cao tuổi');
                  if (isHouseholdScope) {
                    if (matchedRes!.is_head && age >= 18) {
                      expected = fund.target;
                    }
                  } else {
                    if (age >= 18) {
                      expected = fund.target;
                    }
                  }
                }
              }
            }

            const currentExpected = newContributions[fund.name]?.expected || 0;
            if (currentExpected !== expected) {
              newContributions[fund.name] = {
                expected,
                actual: newContributions[fund.name]?.actual || 0
              };
              updated = true;
            }
          });
        } else if (addrClean) {
          const matchedHhByHead = hhList.find(h => {
            if (!h.head_of_household_id) return false;
            const headRes = resList.find(r => r.id === h.head_of_household_id);
            const headName = headRes?.full_name.toLowerCase();
            return headName && addrClean.includes(headName);
          });
          if (matchedHhByHead) {
            if (matchedHhByHead.user_id && f.user_id !== matchedHhByHead.user_id) {
              newUserId = matchedHhByHead.user_id;
              updated = true;
            }
            if (matchedHhByHead.address && f.address !== matchedHhByHead.address) {
              newAddress = matchedHhByHead.address;
              updated = true;
            }
          } else {
            const matchedHh = hhList.find(h => {
              const hAddr = (h.address || '').trim().toLowerCase();
              return hAddr === addrClean || addrClean.includes(hAddr) || hAddr.includes(addrClean);
            });
            if (matchedHh) {
              if (matchedHh.user_id && f.user_id !== matchedHh.user_id) {
                newUserId = matchedHh.user_id;
                updated = true;
              }
              if (matchedHh.address && f.address !== matchedHh.address) {
                newAddress = matchedHh.address;
                updated = true;
              }
            }
          }
        }

        // Tính lại expected ngay cả khi không tìm được nhân khẩu khớp
        // dựa trên dob + giới tính từ tên (chữ đệm Thị)
        const activeFundsList2 = (db as any).getWardFundList() || [];
        const parseAgeRange2 = (ageRangeStr: string | undefined) => {
          const result = { maleMin: 18, maleMax: 61, femaleMin: 18, femaleMax: 58, generalMin: 18, generalMax: 60 };
          if (!ageRangeStr) return result;
          const cleanStr = ageRangeStr.toLowerCase();
          const maleMatch = cleanStr.match(/nam\s*(\d+)\s*-\s*(\d+)/);
          if (maleMatch) { result.maleMin = parseInt(maleMatch[1], 10); result.maleMax = parseInt(maleMatch[2], 10); }
          const femaleMatch = cleanStr.match(/nữ\s*(\d+)\s*-\s*(\d+)/) || cleanStr.match(/nu\s*(\d+)\s*-\s*(\d+)/);
          if (femaleMatch) { result.femaleMin = parseInt(femaleMatch[1], 10); result.femaleMax = parseInt(femaleMatch[2], 10); }
          return result;
        };

        const fDobStr = f.dob || (matchedRes ? matchedRes.dob : '');
        const fAge = calculateExactAge(fDobStr, selectedYear);
        const fName = f.full_name || '';

        // Xác định giới tính: ưu tiên từ nhân khẩu đã khớp, rồi mới dùng tên "Thị" làm dự phòng
        let fIsFemale = false;
        let fGenderKnown = false;
        if (matchedRes) {
          const mGStr = (matchedRes.gender || '').toString().toLowerCase().trim();
          if (mGStr === 'female' || mGStr === 'nữ' || mGStr === 'nu' || mGStr.startsWith('f')) {
            fIsFemale = true;
            fGenderKnown = true;
          } else if (mGStr === 'male' || mGStr === 'nam' || mGStr.startsWith('m')) {
            fIsFemale = false;
            fGenderKnown = true;
          }
        }
        // Chỉ dùng "Thị" làm dự phòng khi không xác định được giới tính từ CSDL
        if (!fGenderKnown) {
          const hasThi2 = fName.toLowerCase().includes(' thị ') || fName.toLowerCase().endsWith(' thị');
          fIsFemale = hasThi2;
        }
        const fIsMale = !fIsFemale;

        activeFundsList2.forEach((fund2: any) => {
          const isPCTT2 = fund2.name.toLowerCase().includes('thiên tai');
          const isDOdn2 = fund2.name.toLowerCase().includes('đền ơn đáp nghĩa') || fund2.name.toLowerCase().includes('đền ơn');
          const isHouseholdScope2 = fund2.scope === 'household' || fund2.name.toLowerCase().includes('hộ') || fund2.name.toLowerCase().includes('người cao tuổi') || fund2.name.toLowerCase().includes('cao tuổi');

          if (fund2.scope === 'person' || isPCTT2 || isDOdn2) {
            const ageLimits2 = parseAgeRange2(fund2.age_range);
            let shouldPay2 = false;
            if (fIsMale) shouldPay2 = fAge >= ageLimits2.maleMin && fAge <= ageLimits2.maleMax;
            else if (fIsFemale) shouldPay2 = fAge >= ageLimits2.femaleMin && fAge <= ageLimits2.femaleMax;
            else shouldPay2 = fAge >= ageLimits2.generalMin && fAge <= ageLimits2.generalMax;
            
            const newExpected2 = shouldPay2 ? fund2.target : 0;
            const currentExpected2 = newContributions[fund2.name]?.expected;
            if (currentExpected2 !== newExpected2) {
              newContributions[fund2.name] = {
                expected: newExpected2,
                actual: newContributions[fund2.name]?.actual || 0
              };
              updated = true;
            }
          } else if (!isHouseholdScope2) {
            // Quỹ thu theo đầu người (không phân biệt tuổi lao động)
            const newExpected2 = fAge >= 18 ? fund2.target : 0;
            const currentExpected2 = newContributions[fund2.name]?.expected;
            if (currentExpected2 !== newExpected2) {
              newContributions[fund2.name] = {
                expected: newExpected2,
                actual: newContributions[fund2.name]?.actual || 0
              };
              updated = true;
            }
          }
        });

        if (updated) {
          matchedCount++;
          updatedFunds.push({
            ...f,
            user_id: newUserId,
            dob: newDob,
            address: newAddress,
            contributions: newContributions
          });
        } else {
          updatedFunds.push(f);
        }
      });

      // Luôn lưu lại toàn bộ (bao gồm cả những record không thay đổi metadata nhưng có thể đã sửa expected)
      await db.saveWardFundsBatch(updatedFunds);
      if (matchedCount > 0) {
        showToast(`Đồng bộ & tính lại chỉ tiêu thành công! Đã cập nhật ${matchedCount} bản ghi.`, 'success');
      } else {
        showToast('Đã tính lại toàn bộ chỉ tiêu theo tuổi/giới tính. Không có thay đổi nào!', 'info');
      }
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Thao tác đồng bộ thất bại!', 'danger');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Excel Bulk Import Logic (Dynamic columns matching with TDP distribution)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        
        if (!worksheet) {
          showToast('File Excel trống hoặc không đúng định dạng!', 'danger');
          setIsLoading(false);
          return;
        }

        // Đọc dòng tiêu đề (dòng 3) để khớp cột quỹ
        const headerRow = worksheet.getRow(3);
        const fundColIndices: Record<string, number> = {};

        headerRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().trim().toLowerCase() || '';
          activeFunds.forEach(fund => {
            const nameLower = fund.name.toLowerCase();
            if (val === nameLower || val.includes(nameLower)) {
              fundColIndices[fund.name] = colNum;
            }
          });
        });

        // Nếu không khớp được cột nào, tự quy định theo thứ tự mặc định từ cột 5 trở đi
        if (Object.keys(fundColIndices).length === 0) {
          activeFunds.forEach((fund, index) => {
            fundColIndices[fund.name] = 5 + index;
          });
        }

        // Lấy thông tin các Tổ dân phố để phân phối dữ liệu
        let tdpProfiles: { id: string; tdp_name: string }[] = [];
        if (supabase) {
          try {
            const { data } = await supabase.from('profiles').select('id, tdp_name').eq('role', 'tdp_leader');
            tdpProfiles = data || [];
          } catch (err) {
            console.error('Lỗi tải danh sách TDP để đối chiếu:', err);
          }
        }

        const batchFunds: WardFund[] = [];
        let successCount = 0;
        const matchedResidentIdsInBatch = new Set<string>();

        worksheet.eachRow((row, rowNum) => {
          // Bỏ qua dòng tiêu đề và header
          if (rowNum < 4) return;

          const name = row.getCell(2).value?.toString() || '';
          const dobVal = row.getCell(3).value?.toString() || '';
          const addr = row.getCell(4).value?.toString() || '';

          if (!name.trim()) return;

          const nameKey = name.trim().toLowerCase();
          const dobClean = dobVal.trim();
          const yearClean = dobClean.match(/\d{4}/)?.[0] || '';
          const addrClean = addr.trim().toLowerCase();

          // Dò tìm nhân khẩu trùng khớp trong CSDL
          const candidates = residents.filter(r => r.full_name.trim().toLowerCase() === nameKey);
          let matchedResident: Resident | undefined = undefined;

          if (candidates.length === 1) {
            matchedResident = candidates[0];
          } else if (candidates.length > 1) {
            let filtered = candidates;
            if (dobClean) {
              const normClean = normalizeDateToCompare(dobClean);
              const exactDobMatch = filtered.filter(r => {
                const normR = normalizeDateToCompare(r.dob);
                return r.dob && (normR === normClean || r.dob.trim() === dobClean || r.dob.includes(dobClean));
              });
              if (exactDobMatch.length > 0) filtered = exactDobMatch;
              else if (yearClean) {
                const yearMatch = filtered.filter(r => (r.dob || '').includes(yearClean));
                if (yearMatch.length > 0) filtered = yearMatch;
              }
            }
            if (filtered.length > 1 && addrClean) {
              const headMatch = filtered.filter(r => {
                const hh = households.find(h => h.id === r.household_id);
                if (!hh || !hh.head_of_household_id) return false;
                const headRes = residents.find(res => res.id === hh.head_of_household_id);
                const headName = headRes?.full_name.toLowerCase() || '';
                return headName && (addrClean.includes(headName) || headName.includes(addrClean));
              });
              if (headMatch.length > 0) filtered = headMatch;
            }
            if (filtered.length > 1 && addrClean) {
              const addrMatch = filtered.filter(r => {
                const hh = households.find(h => h.id === r.household_id);
                if (!hh) return false;
                const hhAddr = (hh.address || '').trim().toLowerCase();
                return hhAddr === addrClean || addrClean.includes(hhAddr) || hhAddr.includes(addrClean);
              });
              if (addrMatch.length > 0) filtered = addrMatch;
            }
            
            // Tránh gán trùng lặp: Ưu tiên chọn nhân khẩu chưa được khớp trong batch này
            const unmatched = filtered.filter(r => !matchedResidentIdsInBatch.has(r.id));
            if (unmatched.length > 0) {
              matchedResident = unmatched[0];
            } else {
              matchedResident = filtered[0];
            }
          }

          let matchedTdpId: string | undefined = matchedResident?.user_id;
          let finalDob = matchedResident?.dob || (dobVal ? dobVal.trim() : undefined);
          let finalAddr = addr ? addr.trim() : undefined;

          if (matchedResident) {
            matchedResidentIdsInBatch.add(matchedResident.id);
            const hh = households.find(h => h.id === matchedResident!.household_id);
            if (hh?.address) finalAddr = hh.address;
          }

          if (!matchedTdpId && addrClean) {
            const matchedHhByHead = households.find(h => {
              if (!h.head_of_household_id) return false;
              const headRes = residents.find(r => r.id === h.head_of_household_id);
              const headName = headRes?.full_name.toLowerCase();
              return headName && addrClean.includes(headName);
            });
            if (matchedHhByHead) {
              matchedTdpId = matchedHhByHead.user_id;
              if (matchedHhByHead.address) finalAddr = matchedHhByHead.address;
            }
          }

          if (!matchedTdpId) {
            const matchedHh = households.find(h => {
              const hhAddr = (h.address || '').trim().toLowerCase();
              return hhAddr === addrClean || addrClean.includes(hhAddr) || hhAddr.includes(addrClean);
            });
            if (matchedHh) {
              matchedTdpId = matchedHh.user_id;
              if (matchedHh.address) finalAddr = matchedHh.address;
            }
          }

          if (!matchedTdpId && tdpProfiles.length > 0 && addrClean) {
            const matched = tdpProfiles.find(p => {
              const nameLower = (p.tdp_name || '').toLowerCase();
              if (nameLower && addrClean.includes(nameLower)) return true;
              const numMatch = nameLower.match(/\d+/);
              if (numMatch) {
                const num = numMatch[0];
                if (addrClean.includes(`tổ ${num}`) || addrClean.includes(`tổ: ${num}`) || addrClean.includes(`tổ tự quản ${num}`)) {
                  return true;
                }
              }
              return false;
            });
            if (matched) matchedTdpId = matched.id;
          }

          // Parse quỹ động
          const contributions: Record<string, any> = {};
          activeFunds.forEach(fund => {
            const colIndex = fundColIndices[fund.name];
            let expected = fund.target;
            if (colIndex) {
              const rawVal = row.getCell(colIndex).value;
              if (rawVal !== null && rawVal !== undefined) {
                expected = parseInt(rawVal.toString().replace(/\D/g, '')) || 0;
              }
            }
            contributions[fund.name] = {
              expected,
              actual: 0
            };
          });

          const record: WardFund = {
            id: generateUUID(),
            year: selectedYear,
            full_name: name.trim(),
            dob: finalDob,
            address: finalAddr,
            user_id: matchedTdpId,
            contributions
          };
          batchFunds.push(record);
          successCount++;
        });

        if (batchFunds.length === 0) {
          showToast('Không đọc được dòng dữ liệu hợp lệ nào từ file Excel!', 'warning');
        } else {
          await db.saveWardFundsBatch(batchFunds);
          showToast(`Nhập dữ liệu thành công! Đã thêm và phân bổ ${successCount} nhân khẩu phải đóng quỹ về các TDP.`, 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        }
      } catch (err) {
        showToast('Lỗi cấu trúc hoặc định dạng file Excel!', 'danger');
        console.error(err);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
  };

  // Excel Report Export Logic (Dynamic columns alignment)
  const handleExportReport = async () => {
    if (filteredFunds.length === 0) {
      showToast('Danh sách trống, không thể xuất báo cáo!', 'warning');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();

      // ─── Helper: Xây dựng nội dung cho 1 worksheet ───────────────────────
      const buildSheet = (
        ws: ExcelJS.Worksheet,
        sheetFunds: typeof filteredFunds,
        sheetTitle: string,
        isSummary: boolean
      ) => {
        const totalCols = 5 + activeFunds.length * 3 + 1;
        const lastColLetter = ws.getColumn(totalCols).letter;

        // ── Tiêu đề ──
        ws.getCell('A1').value = sheetTitle;
        ws.getCell('A1').font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF15803D' } };
        ws.mergeCells(`A1:${lastColLetter}1`);
        ws.getRow(1).height = 30;

        const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
        ws.getCell('A2').value = `Tổ dân phố: ${tdpName} - Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
        ws.getCell('A2').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
        ws.mergeCells(`A2:${lastColLetter}2`);
        ws.getRow(2).height = 20;

        // ── Header nhóm cột ──
        ws.getCell('A3').value = 'Thông tin cá nhân';
        ws.mergeCells('A3:E3');

        let currentColNum = 6;
        activeFunds.forEach(fund => {
          const startCell = ws.getColumn(currentColNum).letter + '3';
          const endCell   = ws.getColumn(currentColNum + 2).letter + '3';
          ws.getCell(startCell).value = fund.name;
          ws.mergeCells(`${startCell}:${endCell}`);
          currentColNum += 3;
        });
        ws.getCell(ws.getColumn(currentColNum).letter + '3').value = 'Ghi chú';

        const groupRow = ws.getRow(3);
        groupRow.height = 25;
        groupRow.eachCell(cell => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // ── Sub-headers ──
        const subHeaders = ['STT', 'Họ và tên', 'Năm sinh', 'Cụm / Tổ', 'Địa chỉ'];
        activeFunds.forEach(() => { subHeaders.push('Phải nộp (đ)', 'Thực nộp (đ)', 'Ngày nộp'); });
        subHeaders.push('Chú thích');

        const subHeaderRow = ws.addRow(subHeaders);
        subHeaderRow.height = 24;
        subHeaderRow.eachCell(cell => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
        });

        // ── Sắp xếp dữ liệu theo thứ tự tổ trong cài đặt ──
        const sortedFunds = [...sheetFunds].sort((a, b) => {
          const gA = getGroupOfFundRecord(a) || '';
          const gB = getGroupOfFundRecord(b) || '';
          const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
          const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
          const rankA = idxA !== -1 ? idxA : 999;
          const rankB = idxB !== -1 ? idxB : 999;
          if (rankA !== rankB) return rankA - rankB;
          return (a.full_name || '').toLowerCase().localeCompare((b.full_name || '').toLowerCase(), 'vi');
        });

        // ── Dữ liệu ──
        let currentGroup = '';
        let sttCounter   = 0;

        sortedFunds.forEach(item => {
          const itemGroup = getGroupOfFundRecord(item) || 'Chưa phân nhóm';
          
          if (isSummary && itemGroup !== currentGroup) {
            currentGroup = itemGroup;
            const gRow = ws.addRow([`── ${currentGroup.toUpperCase()} ──`]);
            ws.mergeCells(`A${gRow.number}:${lastColLetter}${gRow.number}`);
            gRow.height = 22;
            gRow.eachCell(cell => {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            });
          }

          sttCounter++;
          const rowVals: any[] = [
            sttCounter,
            item.full_name || '',
            formatDateVN(item.dob),
            itemGroup,
            item.address || ''
          ];

          activeFunds.forEach(fund => {
            const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
            rowVals.push(contrib.expected || fund.target, contrib.actual || 0, formatDateVN(contrib.date));
          });
          rowVals.push(item.note || '');

          const r = ws.addRow(rowVals);
          r.height = 20;
          r.eachCell((cell, colIndex) => {
            if (colIndex === 1 || colIndex === 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colIndex >= 6 && (colIndex - 6) % 3 !== 2 && colIndex < totalCols) {
              cell.numFmt = '#,##0';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (colIndex >= 6 && (colIndex - 6) % 3 === 2) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          });
        });

        // ── Dòng tổng cộng ──
        const totalRowVals: any[] = ['TỔNG CỘNG', '', '', '', ''];
        activeFunds.forEach(fund => {
          const sumExpected = sheetFunds.reduce((sum, f) => {
            const exp = f.contributions?.[fund.name]?.expected;
            return sum + (exp !== undefined && exp > 0 ? exp : fund.target);
          }, 0);
          const sumActual = sheetFunds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
          totalRowVals.push(sumExpected, sumActual, '');
        });
        totalRowVals.push('');

        const totalRow = ws.addRow(totalRowVals);
        ws.mergeCells(`A${totalRow.number}:E${totalRow.number}`);
        totalRow.height = 24;
        totalRow.getCell(1).font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
        totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        let curCellIndex = 6;
        activeFunds.forEach(() => {
          [curCellIndex, curCellIndex + 1].forEach(colIdx => {
            const cell = totalRow.getCell(colIdx);
            cell.font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          });
          curCellIndex += 3;
        });

        // Borders and gridlines
        ws.eachRow((row, rowNum) => {
          if (rowNum >= 3) {
            row.eachCell(cell => {
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
              };
            });
          }
        });

        // Column widths
        ws.columns.forEach((col, idx) => {
          if (idx === 0) col.width = 6;      // STT
          else if (idx === 1) col.width = 25;  // Họ tên
          else if (idx === 2) col.width = 12;  // Năm sinh
          else if (idx === 3) col.width = 16;  // Cụm/Tổ
          else if (idx === 4) col.width = 25;  // Địa chỉ
          else if (idx < totalCols - 1) {
            const mod = (idx - 5) % 3;
            if (mod === 2) col.width = 14;     // Ngày nộp
            else col.width = 15;               // Expected / Actual
          } else col.width = 20;               // Ghi chú
        });
      };

      // 1. Sheet 1: Tổng hợp tất cả
      const summarySheet = workbook.addWorksheet('📋 Tổng hợp');
      buildSheet(summarySheet, filteredFunds, `BÁO CÁO THU CÁC KHOẢN UBND PHƯỜNG NĂM ${selectedYear} - TỔNG HỢP`, true);

      // 2. Tạo sheet cho từng Tổ/Cụm
      groups.forEach(groupName => {
        const groupFunds = filteredFunds.filter(f => {
          const grp = getGroupOfFundRecord(f);
          return grp.trim().toLowerCase() === groupName.trim().toLowerCase();
        });

        if (groupFunds.length > 0) {
          const safeSheetName = groupName.replace(/[\\/*?:[\]]/g, '').slice(0, 31);
          const groupSheet = workbook.addWorksheet(safeSheetName);
          buildSheet(groupSheet, groupFunds, `BÁO CÁO THU CÁC KHOẢN UBND PHƯỜNG NĂM ${selectedYear} - ${groupName.toUpperCase()}`, false);
        }
      });

      // 3. Sheet cho những hộ chưa thuộc nhóm nào (nếu có)
      const unassignedFunds = filteredFunds.filter(f => {
        const grp = getGroupOfFundRecord(f);
        return !groups.some(g => g.trim().toLowerCase() === grp.trim().toLowerCase());
      });
      if (unassignedFunds.length > 0) {
        const unassignedSheet = workbook.addWorksheet('Chưa phân nhóm');
        buildSheet(unassignedSheet, unassignedFunds, `BÁO CÁO THU CÁC KHOẢN UBND PHƯỜNG NĂM ${selectedYear} - CHƯA PHÂN NHÓM`, false);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Bao_Cao_Thu_Quy_Phuong_${selectedYear}.xlsx`;
      link.click();
      showToast('Đã xuất báo cáo Excel thành công!', 'success');
    } catch (e) {
      showToast('Lỗi khi xuất file Excel báo cáo!', 'danger');
      console.error(e);
    }
  };

  const handlePrintList = () => {
    if (filteredFunds.length === 0) {
      showToast('Danh sách trống, không thể in!', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardName = localStorage.getItem('ward_name') || 'Phường Quảng Giao';
    const leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';
    const leaderSigUrl = localStorage.getItem('leader_sig_url') || '';

    const sortedFunds = [...filteredFunds].sort((a, b) => {
      const gA = getGroupOfFundRecord(a) || '';
      const gB = getGroupOfFundRecord(b) || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const rowsHtml = sortedFunds.map((item, index) => {
      const fundContributions = activeFunds.map(fund => {
        const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
        return `<td style="text-align: right;">${formatCurrency(contrib.actual)} / ${formatCurrency(contrib.expected)}</td>`;
      }).join('');

      const isAllPaid = activeFunds.every(fund => {
        const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
        return contrib.actual >= contrib.expected && contrib.expected > 0;
      });
      const displayNote = (!isAllPaid && item.note === 'Đã nộp đủ đợt tập trung') ? '' : (item.note || '');

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="font-weight: bold; white-space: nowrap;">
            ${item.full_name}
            ${(() => {
              const res = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
              const hh = res ? households.find(h => h.id === res.household_id) : null;
              const head = hh ? residents.find(r => r.id === hh.head_of_household_id) : null;
              return head ? `<div style="font-size: 8.5pt; font-weight: normal; color: #555; margin-top: 2px;">🏡 Chủ hộ: ${head.full_name}</div>` : '';
            })()}
          </td>
          <td style="text-align: center;">${item.dob || '-'}</td>
          <td>${item.address || '-'}</td>
          ${fundContributions}
          <td>${displayNote}</td>
        </tr>
      `;
    }).join('');

    const fundsHeaderCols = activeFunds.map(fund => `<th style="width: 15%;">${fund.name} (đ)</th>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Danh sách đóng góp Quỹ Phường Năm ${selectedYear}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin-top: 20mm;
              margin-bottom: 20mm;
              margin-left: 30mm;
              margin-right: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13pt;
            line-height: 1.3;
            color: #000;
            margin: 0;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .org-title {
            text-align: center;
            font-weight: bold;
            font-size: 12pt;
            text-transform: uppercase;
          }
          .motto {
            text-align: center;
            font-size: 12pt;
          }
          .motto-main {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .motto-sub {
            font-weight: bold;
          }
          .line-separator {
            width: 80px;
            height: 1px;
            background-color: #000;
            margin: 4px auto 0 auto;
          }
          .line-separator-long {
            width: 150px;
            height: 1px;
            background-color: #000;
            margin: 4px auto 0 auto;
          }
          .doc-title-container {
            text-align: center;
            margin-top: 15px;
            margin-bottom: 15px;
          }
          .doc-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .doc-subtitle {
            font-style: italic;
            font-size: 13pt;
            margin: 0;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 8px 6px;
            font-size: 13pt;
            vertical-align: middle;
          }
          .data-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
            text-transform: uppercase;
          }
          .signature-section {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            page-break-inside: avoid;
          }
          .signature-section td {
            border: none;
            text-align: center;
            width: 50%;
            font-size: 12px;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
            margin-bottom: 60px;
          }
          .signature-name {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 38%;">
              <div class="org-title">
                UBND ${wardName.toUpperCase()}<br/>
                TỔ DÂN PHỐ ${tdpName.toUpperCase()}
                <div class="line-separator"></div>
              </div>
            </td>
            <td style="width: 2%;">&nbsp;</td>
            <td style="width: 60%;">
              <div class="motto">
                <div class="motto-main">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div class="motto-sub">Độc lập - Tự do - Hạnh phúc</div>
                <div class="line-separator-long"></div>
              </div>
            </td>
          </tr>
        </table>

        <div class="doc-title-container">
          <h1 class="doc-title">DANH SÁCH THEO DÕI ĐÓNG GÓP QUỸ PHƯỜNG NĂM ${selectedYear}</h1>
          <p class="doc-subtitle">Tổ dân phố: ${tdpName} ${groupFilter !== 'all' ? `| Tổ: ${groupFilter}` : ''} | Trạng thái: ${filterStatus === 'paid_all' ? 'Đã nộp đủ' : filterStatus === 'unpaid_any' ? 'Chưa nộp đủ' : 'Tất cả'}</p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 4%;">STT</th>
              <th style="width: 18%;">Họ và tên</th>
              <th style="width: 8%;">Năm sinh</th>
              <th style="width: 25%;">Địa chỉ</th>
              ${fundsHeaderCols}
              <th style="width: 15%;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; border: none;"></td>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 13pt;">
              ${wardName.replace(/Phường\s+/gi, '') || 'Sầm Sơn'}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
            </td>
          </tr>
        </table>

        <table class="signature-section" style="width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; text-align: center; border: none; vertical-align: top; font-size: 13pt;">
              <div class="signature-title" style="font-weight: bold; font-size: 14pt;">NGƯỜI LẬP BIỂU</div>
              <div style="font-style: italic; font-size: 13pt; color: #000; margin-top: 4px;">(Ký, ghi rõ họ tên)</div>
              <div style="height: 110px;"></div>
            </td>
            <td style="width: 50%; text-align: center; border: none; vertical-align: top; font-size: 13pt;">
              <div class="signature-title" style="font-weight: bold; font-size: 14pt;">TỔ TRƯỞNG TỔ DÂN PHỐ</div>
              <div style="font-style: italic; font-size: 13pt; color: #000; margin-top: 4px;">(Ký, đóng dấu, ghi rõ họ tên)</div>
              <div style="height: 110px; display: flex; align-items: center; justify-content: center; margin: 5px auto;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 110px; max-height: 120px; max-width: 220px; object-fit: contain;" />` : ''}
              </div>
              <div class="signature-name" style="font-weight: bold; font-size: 14pt;">${leaderName}</div>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // --- PRINT RECEIPT HANDLERS FOR WARD FUNDS ---
  const generateWardStateReceiptHtml = (
    item: WardFund,
    dateText: string,
    tdpNameVal: string,
    wardNameVal: string,
    leaderName: string,
    leaderSigUrl: string
  ) => {
    // Tìm tổ tự quản & chủ hộ từ danh sách nhân khẩu bằng Map tra cứu siêu tốc
    const info = findResidentGroupAndHead(item.full_name, item.dob || '');
    const groupName = info.group;
    const headName = info.headName;
    const resident = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
    const hhOfRes = resident ? households.find(h => h.id === resident.household_id) : null;
    
    // Tải các khoản Quỹ Tổ Dân Phố để in chung trên 1 phiếu
    const tdpFundsConfig = (db as any).getFundList() || [];
    const householdFundsList = (db as any).getHouseholdFunds() || [];

    // Tính tiền Quỹ Phường thực tế đã nộp (actual)
    let wardTotal = 0;
    const wardRows = activeFunds.map((fund, idx) => {
      const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
      const rawPaid = contrib.actual ?? 0;
      const amountPaid = typeof rawPaid === 'number'
        ? rawPaid
        : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);
      wardTotal += amountPaid;
      const note = contrib.date 
        ? new Date(contrib.date).toLocaleDateString('vi-VN') 
        : '—';
      return `
        <tr data-fund-type="ward">
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold; text-align: left;">[UBND] ${fund.name} (${selectedYear})</td>
          <td class="receipt-amount-cell" style="text-align: right; font-weight: bold;">${amountPaid.toLocaleString('vi-VN')} đ</td>
          <td style="text-align: left;">${note}</td>
        </tr>
      `;
    });

    // Tính tiền Quỹ TDP thực tế đã nộp (nếu khớp Hộ gia đình)
    let tdpTotal = 0;
    const tdpRows: string[] = [];
    if (hhOfRes && tdpFundsConfig.length > 0) {
      const hhFunds = householdFundsList.filter((hf: any) => hf.household_id === hhOfRes.id && hf.year === selectedYear);
      tdpFundsConfig.forEach((tf: any, idx: number) => {
        const fundRec = hhFunds.find((hf: any) => hf.fund_name === tf.name);
        const rawPaid = fundRec ? fundRec.amount : 0;
        const amountPaid = typeof rawPaid === 'number'
          ? rawPaid
          : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);
        tdpTotal += amountPaid;
        const note = fundRec?.paid_at ? new Date(fundRec.paid_at).toLocaleDateString('vi-VN') : '—';
        tdpRows.push(`
          <tr data-fund-type="tdp">
            <td style="text-align: center;">${wardRows.length + idx + 1}</td>
            <td style="font-weight: bold; text-align: left;">[TDP] ${tf.name} (${selectedYear})</td>
            <td class="receipt-amount-cell" style="text-align: right; font-weight: bold;">${amountPaid.toLocaleString('vi-VN')} đ</td>
            <td style="text-align: left;">${note}</td>
          </tr>
        `);
      });
    }

    const grandTotalTarget = wardTotal + tdpTotal;
    const paidFundsRowsHtml = [...tdpRows, ...wardRows].join('');

    const isAllPaid = activeFunds.every(fund => {
      const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
      return contrib.actual >= contrib.expected && contrib.expected > 0;
    });
    const displayNote = (!isAllPaid && item.note === 'Đã nộp đủ đợt tập trung') ? '' : (item.note || '');

    const docSoTien = (number: number): string => {
      if (number === 0) return 'Không đồng';
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
      let temp = number;
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
    };

    const textAmountWords = docSoTien(grandTotalTarget);

    // Tải chữ ký động cho Kế toán trưởng & Thủ quỹ
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

    return `
      <div class="receipt-container">
        <table class="receipt-header-table">
          <tr>
            <td style="width: 50%;">
              <div class="receipt-org-title">
                Đơn vị: UBND ${wardNameVal.toUpperCase()}<br/>
                Tổ dân phố: ${tdpNameVal.toUpperCase()}<br/>
                Địa chỉ: ${item.address || hhOfRes?.address || tdpNameVal}
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
          <h1 class="receipt-title">PHIẾU THU</h1>
          <p class="receipt-subtitle">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
        </div>

        <table class="receipt-info-table">
          <tr>
            <td class="receipt-info-label" style="width: 170px; font-weight: bold; text-align: left;">Họ và tên người nộp tiền:</td>
            <td style="text-align: left;">
              <strong>${item.full_name}</strong>
              ${headName ? ` - (Hộ ông/bà: ${headName})` : ''}
              ${groupName ? ` - (${groupName})` : ''}
            </td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Địa chỉ:</td>
            <td style="text-align: left;">${item.address || hhOfRes?.address || tdpNameVal} ${item.dob ? `(Ngày sinh: ${item.dob})` : ''}</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Lý do nộp:</td>
            <td style="text-align: left;">Nộp các khoản đóng góp quỹ Phường năm ${selectedYear}</td>
          </tr>
          ${displayNote ? `
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Ghi chú:</td>
            <td style="text-align: left; font-weight: bold; color: #b91c1c;">${displayNote}</td>
          </tr>
          ` : ''}
        </table>

        <table class="receipt-details-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">STT</th>
              <th style="text-align: left;">Nội dung quỹ đóng góp</th>
              <th style="width: 130px; text-align: right;">Số tiền</th>
              <th style="text-align: left;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${paidFundsRowsHtml.length > 0 ? paidFundsRowsHtml : '<tr><td colspan="4" style="text-align: center; font-style: italic; color: #666;">Chưa nộp khoản quỹ nào trong năm.</td></tr>'}
            <tr class="receipt-total-row">
              <td colspan="2" style="text-align: center; font-weight: bold;">TỔNG CỘNG CÁC KHOẢN (TĐP + PHƯỜNG)</td>
              <td style="text-align: right; font-weight: bold; color: #15803d;">${formatCurrency(grandTotalTarget)} đ</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-amount-words" style="font-size: 9.5pt; font-style: italic; margin-bottom: 4px; margin-top: 2px; text-align: left;">
          Số tiền bằng chữ: <strong>${textAmountWords}</strong>
        </div>

        <table class="receipt-signatures-table">
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
            <td style="vertical-align: bottom;"><strong>${item.full_name}</strong></td>
          </tr>
        </table>
      </div>
    `;
  };

  const handlePrintIndividualReceipt_Ward = (item: WardFund) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const freshReceiptHtml = generateWardStateReceiptHtml(item, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);
    const SAVE_KEY = `receipt_html_ward_indiv_${item.id}_${selectedYear}`;
    const savedReceiptHtml = localStorage.getItem(SAVE_KEY);
    const hasSavedVersion = !!savedReceiptHtml;
    const receiptHtml = savedReceiptHtml ? savedReceiptHtml : freshReceiptHtml;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Biên lai thu tiền - ${item.full_name}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 6mm 10mm;
            }
            html, body {
              margin: 0;
              padding: 0;
            }
            .print-toolbar {
              display: none !important;
            }
            #saved-notice {
              display: none !important;
            }
            body {
              padding-top: 5px !important;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.3;
            color: #000;
            padding: 5px;
            padding-top: 55px;
          }
          .receipt-container {
            width: 100%;
            box-sizing: border-box;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 10pt !important;
            line-height: 1.3;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9.5pt !important;
            line-height: 1.25;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 10px !important;
            margin-bottom: 10px !important;
          }
          .receipt-title {
            font-size: 15.5pt !important;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px !important;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 10pt !important;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 4px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0 !important;
            font-size: 10pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 3.5px 6px !important;
            font-size: 9.5pt !important;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px !important;
            page-break-inside: avoid !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 10pt !important;
            vertical-align: top;
            padding: 4px !important;
          }
          .print-toolbar {
            position: fixed;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 6px 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            display: flex;
            gap: 10px;
            z-index: 99999;
          }
          .toolbar-btn {
            padding: 6px 14px;
            border-radius: 6px;
            border: none;
            font-weight: bold;
            cursor: pointer;
            font-size: 9pt;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .btn-print { background: #10b981; color: white; }
          .btn-print:hover { background: #059669; }
          .btn-save { background: #3b82f6; color: white; }
          .btn-save:hover { background: #2563eb; }
          .btn-reset { background: #f59e0b; color: white; }
          .btn-reset:hover { background: #d97706; }
          .btn-close { background: #ef4444; color: white; }
          .btn-close:hover { background: #dc2626; }
          .font-size-select {
            padding: 5px 8px;
            border-radius: 6px;
            border: 1.5px solid #cbd5e1;
            font-size: 8.5pt;
            font-weight: 600;
            cursor: pointer;
            background: #f8fafc;
            color: #334155;
          }
          .toolbar-label {
            font-size: 8pt;
            color: #64748b;
            font-weight: 600;
            display: flex;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <button class="toolbar-btn btn-print" onclick="window.print()">🖨️ In ngay</button>
          <button class="toolbar-btn btn-save" id="btn-save">💾 Lưu chỉnh sửa</button>
          <button class="toolbar-btn btn-reset" id="btn-reset">🔄 Tải dữ liệu gốc từ hệ thống</button>
          <span class="toolbar-label">📝 Cỡ chữ:</span>
          <select class="font-size-select" id="font-size-select">
            <option value="8pt">8pt</option>
            <option value="8.5pt">8.5pt</option>
            <option value="9pt">9pt</option>
            <option value="9.5pt">9.5pt</option>
            <option value="10pt" selected>10pt (mặc định)</option>
            <option value="10.5pt">10.5pt</option>
            <option value="11pt">11pt</option>
            <option value="12pt">12pt</option>
          </select>
          <button class="toolbar-btn btn-close" onclick="window.close()">❌ Đóng</button>
        </div>

        <div id="saved-notice" style="${hasSavedVersion ? 'display:flex;' : 'display:none;'}background:#dcfce7;border:1.5px solid #16a34a;border-radius:8px;padding:8px 16px;margin-bottom:10px;font-size:9pt;font-family:Arial,sans-serif;align-items:center;gap:10px;color:#14532d;">
          ✅ <strong>Đang hiển thị phiếu thu đã lưu chỉnh sửa của cá nhân này.</strong> Mọi chỉnh sửa trước đây đã được giữ nguyên. (Bấm <strong>🔄 Tải dữ liệu gốc từ hệ thống</strong> nếu muốn hủy bỏ chỉnh sửa).
        </div>

        <div class="editor-area" contenteditable="true" style="outline: none;">
          ${receiptHtml}
        </div>

        <script>
          const SAVE_KEY = 'receipt_html_ward_indiv_${item.id}_${selectedYear}';
          const freshHtml = ${JSON.stringify(freshReceiptHtml)};
          const btnSave = document.getElementById('btn-save');
          const btnReset = document.getElementById('btn-reset');
          const editor = document.querySelector('.editor-area');
          const fontSizeSelect = document.getElementById('font-size-select');

          function docSoTien(number) {
            if (isNaN(number) || number === 0) return 'Không đồng';
            const arrays = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
            
            function readTriple(n, showZero) {
              let tram = Math.floor(n / 100);
              let chuc = Math.floor((n % 100) / 10);
              let donvi = n % 10;
              let res = "";
              if (tram > 0 || showZero) res += arrays[tram] + " trăm ";
              if (chuc === 0 && donvi > 0) res += "lẻ ";
              else if (chuc === 1) res += "mười ";
              else if (chuc > 1) res += arrays[chuc] + " mươi ";
              
              if (donvi === 1 && chuc > 1) res += "mốt";
              else if (donvi === 5 && chuc > 0) res += "lăm";
              else if (donvi > 0) res += arrays[donvi];
              return res.trim();
            }

            let str = "";
            let units = ["", " nghìn", " triệu", " tỷ"];
            let temp = Math.abs(Math.floor(number));
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
            if (!finalStr) return "Không đồng";
            return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
          }

          let isRecalculating = false;
          function recalculateReceiptTotals() {
            if (isRecalculating) return;
            isRecalculating = true;
            try {
              const containers = document.querySelectorAll('.receipt-container');
              if (containers.length === 0) return;

              // Sync cell content across multiple liens (if Lien 1 and Lien 2 exist)
              if (containers.length > 1) {
                let activeEl = document.activeElement;
                if (activeEl && activeEl.nodeType === 3) {
                  activeEl = activeEl.parentElement;
                }
                if (activeEl && typeof activeEl.closest === 'function' && typeof editor !== 'undefined' && editor && editor.contains(activeEl)) {
                  const activeContainer = activeEl.closest('.receipt-container');
                  const activeRow = activeEl.closest('tr');
                  const activeTd = activeEl.closest('td');
                  if (activeContainer && activeRow && activeTd && !activeRow.classList.contains('receipt-total-row') && !(activeRow.textContent || activeRow.innerText || '').toUpperCase().includes('TỔNG CỘNG')) {
                    const sourceContainerIndex = Array.from(containers).indexOf(activeContainer);
                    const sourceRows = Array.from(activeContainer.querySelectorAll('.receipt-details-table tbody tr'));
                    const rowIndex = sourceRows.indexOf(activeRow);
                    
                    if (rowIndex >= 0) {
                      const cellIndex = Array.from(activeRow.children).indexOf(activeTd);
                      const newValue = activeTd.textContent || activeTd.innerText || '';
                      
                      if (cellIndex >= 0 && newValue !== undefined) {
                        containers.forEach((cnt, idx) => {
                          if (idx !== sourceContainerIndex) {
                            const targetRows = cnt.querySelectorAll('.receipt-details-table tbody tr');
                            if (targetRows[rowIndex]) {
                              const targetTd = targetRows[rowIndex].children[cellIndex];
                              if (targetTd && targetTd !== activeTd && (targetTd.textContent || targetTd.innerText || '') !== newValue) {
                                targetTd.textContent = newValue;
                              }
                            }
                          }
                        });
                      }
                    }
                  }
                }
              }

              containers.forEach(container => {
                const table = container.querySelector('.receipt-details-table');
                if (!table) return;

                const rows = Array.from(table.querySelectorAll('tbody tr'));
                if (rows.length === 0) return;

                let totalRow = table.querySelector('tr.receipt-total-row');
                if (!totalRow) {
                  totalRow = rows.find(r => (r.textContent || r.innerText || '').toUpperCase().includes('TỔNG CỘNG'));
                  if (totalRow) totalRow.classList.add('receipt-total-row');
                }

                let grandTotal = 0;
                let tdpTotal = 0;
                let wardTotal = 0;

                rows.forEach(row => {
                  const rText = (row.textContent || row.innerText || '').toUpperCase();
                  if (row === totalRow || row.classList.contains('receipt-total-row') || rText.includes('TỔNG CỘNG')) {
                    return;
                  }

                  const tds = Array.from(row.querySelectorAll('td'));
                  if (tds.length < 2) return;

                  let amountTd = row.querySelector('.receipt-amount-cell');
                  if (!amountTd) {
                    if (tds.length >= 6) amountTd = tds[4];
                    else if (tds.length >= 4) amountTd = tds[2];
                    else amountTd = tds[tds.length - 2];
                  }

                  const cellText = amountTd ? (amountTd.textContent || amountTd.innerText || '') : '';
                  const digits = cellText.replace(/[^\d]/g, '');
                  const num = digits ? parseInt(digits, 10) : 0;

                  const fundTypeAttr = row.getAttribute('data-fund-type');
                  const fundName = (tds[1] ? (tds[1].textContent || tds[1].innerText || '') : '').toLowerCase();
                  const isWard = fundTypeAttr === 'ward' || fundName.includes('ubnd') || fundName.includes('phường') || fundName.includes('thiên tai') || fundName.includes('đền ơn') || fundName.includes('cao tuổi');

                  if (isWard) {
                    wardTotal += num;
                  } else {
                    tdpTotal += num;
                  }

                  grandTotal += num;
                });

                const activePrintMode = (typeof currentPrintMode !== 'undefined') ? currentPrintMode : 'combined';
                let effectiveTotal = grandTotal;
                if (activePrintMode === 'tdp_only') {
                  effectiveTotal = tdpTotal;
                } else if (activePrintMode === 'ward_only') {
                  effectiveTotal = wardTotal;
                }

                if (effectiveTotal === 0 && totalRow) {
                  const existingTd = totalRow.querySelectorAll('td')[1];
                  const existingTxt = existingTd ? (existingTd.textContent || existingTd.innerText || '') : '';
                  const existingNum = parseInt(existingTxt.replace(/[^\d]/g, ''), 10) || 0;
                  if (existingNum > 0) {
                    const hasCellData = rows.some(r => {
                      if (r === totalRow || r.classList.contains('receipt-total-row')) return false;
                      const c = r.querySelector('.receipt-amount-cell') || r.querySelectorAll('td')[4] || r.querySelectorAll('td')[3];
                      return c && (c.textContent || '').replace(/[^\d]/g, '').length > 0;
                    });
                    if (hasCellData) return;
                  }
                }

                if (totalRow) {
                  const totalTds = totalRow.querySelectorAll('td');
                  if (totalTds.length >= 2) {
                    const firstBodyRow = table.querySelector('tbody tr:not(.receipt-total-row)');
                    const ths = Array.from(table.querySelectorAll('thead th'));
                    const is6Col = ths.length >= 6 || (firstBodyRow && firstBodyRow.querySelectorAll('td').length >= 6);
                    
                    if (is6Col && totalTds.length >= 2) {
                      const labelTd = totalTds[0];
                      labelTd.setAttribute('colspan', '4');
                      let printModeText = '';
                      if (activePrintMode === 'tdp_only') {
                        printModeText = '(TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ)';
                      } else if (activePrintMode === 'ward_only') {
                        printModeText = '(UBND: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';
                      } else {
                        printModeText = '(TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ + UBND: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';
                      }
                      labelTd.innerHTML = 'TỔNG CỘNG THỰC THU ' + printModeText;

                      const amountTd = totalTds[1];
                      amountTd.innerHTML = effectiveTotal.toLocaleString('vi-VN') + ' đ';

                      if (totalTds.length >= 3) {
                        totalTds[2].innerHTML = '';
                      }
                    } else {
                      const labelTd = totalTds[0];
                      labelTd.innerHTML = 'TỔNG CỘNG CÁC KHOẢN';
                      const amountTd = totalTds[1];
                      amountTd.innerHTML = effectiveTotal.toLocaleString('vi-VN') + ' đ';
                    }
                  }
                }

                const wordsContainer = container.querySelector('.receipt-amount-words') 
                  || Array.from(container.querySelectorAll('div')).find(d => (d.textContent || d.innerText || '').includes('Số tiền bằng chữ'));
                
                if (wordsContainer) {
                  const strongEl = wordsContainer.querySelector('strong');
                  if (strongEl) {
                    strongEl.innerText = docSoTien(effectiveTotal);
                  } else {
                    wordsContainer.innerHTML = 'Số tiền bằng chữ: <strong>' + docSoTien(effectiveTotal) + '</strong>';
                  }
                }
              });
            } catch (err) {
              console.error('Error recalculating totals:', err);
            } finally {
              isRecalculating = false;
            }
          }

          fontSizeSelect.addEventListener('change', function() {
            document.querySelectorAll('.receipt-container').forEach(function(el) {
              el.style.fontSize = fontSizeSelect.value;
            });
          });

          ['input', 'keyup', 'change', 'blur', 'paste', 'DOMSubtreeModified'].forEach(function(evtType) {
            document.addEventListener(evtType, recalculateReceiptTotals, true);
            window.addEventListener(evtType, recalculateReceiptTotals, true);
            if (editor) {
              editor.addEventListener(evtType, recalculateReceiptTotals, true);
            }
          });

          setInterval(recalculateReceiptTotals, 300);

          try {
            recalculateReceiptTotals();
          } catch (e) {}

          btnSave.addEventListener('click', function() {
            localStorage.setItem(SAVE_KEY, editor.innerHTML);
            const notice = document.getElementById('saved-notice');
            if (notice) {
              notice.style.display = 'flex';
              notice.style.background = '#dcfce7';
              notice.style.border = '1.5px solid #16a34a';
              notice.style.color = '#14532d';
              notice.innerHTML = '✅ <strong>Đã lưu thành công!</strong> Các chỉnh sửa trên phiếu thu của cá nhân này đã được lưu lại cho các lần mở tiếp theo.';
            }
            alert('Đã lưu bản chỉnh sửa phiếu thu thành công! Lần sau mở phiếu thu của cá nhân này ra, hệ thống sẽ tự động hiển thị nội dung bạn vừa lưu.');
          });

          btnReset.addEventListener('click', function() {
            if (confirm('Bạn có chắc chắn muốn xóa bản chỉnh sửa đã lưu và tải lại dữ liệu mới nhất từ hệ thống không?')) {
              localStorage.removeItem(SAVE_KEY);
              editor.innerHTML = freshHtml;
              recalculateReceiptTotals();
              const notice = document.getElementById('saved-notice');
              if (notice) notice.style.display = 'none';
              alert('Đã khôi phục về dữ liệu gốc từ hệ thống!');
            }
          });


        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintBulkReceiptsA4_Ward = () => {
    if (filteredFunds.length === 0) {
      showToast('Không có dữ liệu cá nhân nào để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    // Sắp xếp danh sách theo Cụm / Tổ trước khi in
    const sortedFunds = [...filteredFunds].sort((a, b) => {
      const gA = getGroupOfFundRecord(a) || '';
      const gB = getGroupOfFundRecord(b) || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const householdFundsList = (db as any).getHouseholdFunds() || [];
    const fundsToPrint = sortedFunds.filter(item => {
      let total = 0;
      activeFunds.forEach(fund => {
        total += item.contributions?.[fund.name]?.actual || 0;
      });
      const resident = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
      const hhOfRes = resident ? households.find(h => h.id === resident.household_id) : null;
      if (hhOfRes) {
        const tdpPaid = householdFundsList
          .filter((hf: any) => hf.household_id === hhOfRes.id && hf.year === selectedYear)
          .reduce((sum: number, hf: any) => sum + hf.amount, 0);
        total += tdpPaid;
      }
      return total > 0;
    });

    if (fundsToPrint.length === 0) {
      showToast('Không có cá nhân nào đã nộp tiền trong danh sách để in phiếu thu!', 'warning');
      printWindow.close();
      return;
    }

    const pagesHtmlList: string[] = [];
    for (let i = 0; i < fundsToPrint.length; i += 2) {
      const item1 = fundsToPrint[i];
      const receipt1 = generateWardStateReceiptHtml(item1, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);

      const item2 = fundsToPrint[i + 1];
      let receipt2 = '';
      if (item2) {
        receipt2 = generateWardStateReceiptHtml(item2, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);
      }

      pagesHtmlList.push(`
        <div class="page">
          ${receipt1}
          ${receipt2 ? `
            <div class="cut-line">
              <span>✂ - - - - - - - - - - - Kéo cắt tại đây - - - - - - - - - - - ✂</span>
            </div>
            ${receipt2}
          ` : ''}
        </div>
      `);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In loạt phiếu thu quỹ phường A4 (2 phiếu/trang) - ${filteredFunds.length} người</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 12mm 15mm;
            }
            .page {
              page-break-after: always;
              height: 270mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .page:last-child {
              page-break-after: avoid;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.35;
            color: #000;
          }
          .receipt-container {
            width: 100%;
            height: 124mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 9.5pt !important;
            line-height: 1.25;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9pt !important;
            line-height: 1.2;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 5px !important;
            margin-bottom: 5px !important;
          }
          .receipt-title {
            font-size: 14pt !important;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2px !important;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 9.5pt !important;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 5px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0 !important;
            font-size: 9.5pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px !important;
            margin-bottom: 5px !important;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 3px 5px !important;
            font-size: 9pt !important;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 9pt !important;
            vertical-align: top;
            padding: 3px !important;
          }
          .cut-line {
            text-align: center;
            border-top: 1px dashed #666;
            margin: 10px 0;
            position: relative;
          }
          .cut-line span {
            position: relative;
            top: -10px;
            background: #fff;
            padding: 0 10px;
            font-size: 8pt;
            color: #666;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        ${pagesHtmlList.join('\n')}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintBulkReceiptsA4_1PerPage_Ward = () => {
    if (filteredFunds.length === 0) {
      showToast('Không có dữ liệu cá nhân nào để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    // Sắp xếp danh sách theo Cụm / Tổ trước khi in
    const sortedFunds = [...filteredFunds].sort((a, b) => {
      const gA = getGroupOfFundRecord(a) || '';
      const gB = getGroupOfFundRecord(b) || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const householdFundsList = (db as any).getHouseholdFunds() || [];
    const fundsToPrint = sortedFunds.filter(item => {
      let total = 0;
      activeFunds.forEach(fund => {
        total += item.contributions?.[fund.name]?.actual || 0;
      });
      const resident = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
      const hhOfRes = resident ? households.find(h => h.id === resident.household_id) : null;
      if (hhOfRes) {
        const tdpPaid = householdFundsList
          .filter((hf: any) => hf.household_id === hhOfRes.id && hf.year === selectedYear)
          .reduce((sum: number, hf: any) => sum + hf.amount, 0);
        total += tdpPaid;
      }
      return total > 0;
    });

    if (fundsToPrint.length === 0) {
      showToast('Không có cá nhân nào đã nộp tiền trong danh sách để in phiếu thu!', 'warning');
      printWindow.close();
      return;
    }

    const receiptsHtml = fundsToPrint.map(item => {
      return generateWardStateReceiptHtml(item, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);
    }).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In loạt phiếu thu quỹ phường A4 (1 phiếu/trang) - ${fundsToPrint.length} người</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 12mm 15mm;
            }
            .receipt-container {
              width: 100% !important;
              page-break-inside: avoid !important;
              page-break-after: always !important;
              box-sizing: border-box;
            }
            .receipt-container:last-child {
              page-break-after: avoid !important;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.35;
            color: #000;
          }
          .receipt-container {
            width: 100%;
            box-sizing: border-box;
            padding-top: 5px;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 10pt !important;
            line-height: 1.3;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9.5pt !important;
            line-height: 1.25;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 6px !important;
            margin-bottom: 6px !important;
          }
          .receipt-title {
            font-size: 15.5pt !important;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px !important;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 9.5pt !important;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 4px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0 !important;
            font-size: 10pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 3.5px 6px !important;
            font-size: 9.5pt !important;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px !important;
            page-break-inside: avoid !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 9.5pt !important;
            vertical-align: top;
            padding: 2px !important;
          }
        </style>
      </head>
      <body>
        ${receiptsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintBulkReceiptsA5_Ward = () => {
    if (filteredFunds.length === 0) {
      showToast('Không có dữ liệu cá nhân nào để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    // Sắp xếp danh sách theo Cụm / Tổ trước khi in
    const sortedFunds = [...filteredFunds].sort((a, b) => {
      const gA = getGroupOfFundRecord(a) || '';
      const gB = getGroupOfFundRecord(b) || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const householdFundsList = (db as any).getHouseholdFunds() || [];
    const fundsToPrint = sortedFunds.filter(item => {
      let total = 0;
      activeFunds.forEach(fund => {
        total += item.contributions?.[fund.name]?.actual || 0;
      });
      const resident = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
      const hhOfRes = resident ? households.find(h => h.id === resident.household_id) : null;
      if (hhOfRes) {
        const tdpPaid = householdFundsList
          .filter((hf: any) => hf.household_id === hhOfRes.id && hf.year === selectedYear)
          .reduce((sum: number, hf: any) => sum + hf.amount, 0);
        total += tdpPaid;
      }
      return total > 0;
    });

    if (fundsToPrint.length === 0) {
      showToast('Không có cá nhân nào đã nộp tiền trong danh sách để in phiếu thu!', 'warning');
      printWindow.close();
      return;
    }

    const receiptsHtml = fundsToPrint.map(item => {
      return generateWardStateReceiptHtml(item, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);
    }).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In loạt phiếu thu quỹ phường A5 - ${fundsToPrint.length} người</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A5 landscape;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 8mm 10mm;
            }
            .receipt-container {
              page-break-after: always;
            }
            .receipt-container:last-child {
              page-break-after: avoid;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 9.5pt;
            line-height: 1.3;
            color: #000;
            padding: 5px;
          }
          .receipt-container {
            width: 100%;
            box-sizing: border-box;
            font-size: inherit;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 1.05em;
            line-height: 1.3;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 0.95em;
            line-height: 1.25;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 4px;
            margin-bottom: 4px;
          }
          .receipt-title {
            font-size: 1.5em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 0.95em;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 4px;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 1px 0;
            font-size: 1em;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3px;
            margin-bottom: 3px;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            font-size: 0.95em;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            page-break-inside: avoid;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 0.95em;
            vertical-align: top;
            padding: 1px;
          }
        </style>
      </head>
      <body>
        ${receiptsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const generateHouseholdReceiptHtml = (
    household: Household,
    members: Resident[],
    memberWardRecords: WardFund[],
    householdPaidFunds: HouseholdFund[],
    dateText: string,
    tdpNameVal: string,
    wardNameVal: string,
    leaderName: string,
    leaderSigUrl: string,
    printMode: 'ward_only' | 'combined' = 'combined'
  ) => {
    const headResident = members.find(r => r.id === household.head_of_household_id || r.is_head);
    const headName = headResident ? headResident.full_name : (household.martyr_name || 'Đại diện hộ');

    const getResidentAge = (dobStr: string) => {
      return calculateExactAge(dobStr, selectedYear);
    };

    const activeFundsList = (db as any).getWardFundList() || [];
    const personFund = activeFundsList.find((af: any) => af.scope === 'person' || af.name.toLowerCase().includes('thiên tai') || af.name.toLowerCase().includes('đáp nghĩa'));

    const parseAgeRange = (ageRangeStr: string | undefined) => {
      const result = { maleMin: 18, maleMax: 61, femaleMin: 18, femaleMax: 58, generalMin: 18, generalMax: 60 };
      if (!ageRangeStr) return result;
      const cleanStr = ageRangeStr.toLowerCase();
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
        result.generalMin = parseInt(generalMatch[1], 10);
        result.generalMax = parseInt(generalMatch[2], 10);
      }
      return result;
    };

    const ageLimits = parseAgeRange(personFund?.age_range);

    const laborResidents = members.filter(r => {
      const statusClean = r.status || 'resident';
      if (statusClean === 'deceased') return false;
      const age = getResidentAge(r.dob);
      const gStr = (r.gender || '').toString().toLowerCase().trim();
      const hasThi = r.full_name.toLowerCase().includes(' thị ') || r.full_name.toLowerCase().includes(' thị');
      const isFemale = gStr === 'female' || gStr === 'nữ' || gStr === 'nu' || gStr.startsWith('f') || hasThi;
      const isMale = !isFemale && (gStr === 'male' || gStr === 'nam' || gStr.startsWith('m'));
      if (isMale) {
        return age >= ageLimits.maleMin && age <= ageLimits.maleMax;
      } else if (isFemale) {
        return age >= ageLimits.femaleMin && age <= ageLimits.femaleMax;
      }
      return age >= ageLimits.generalMin && age <= ageLimits.generalMax;
    });
    const laborCount = laborResidents.length;

    const receiptRows: Array<{ name: string; type: string; rate: string; amount: number; note: string }> = [];

    // Luôn hiển thị tất cả quỹ TDP đang hoạt động (kể cả chưa nộp)
    if (printMode === 'combined') {
      const tdpActiveFunds = (db as any).getFundList() as { name: string; target: number }[];
      tdpActiveFunds.forEach((fund: { name: string; target: any }) => {
        const targetVal = typeof fund.target === 'number' ? fund.target : (parseInt((fund.target || '0').toString().replace(/[^\d]/g, ''), 10) || 0);
        const paidFund = householdPaidFunds.find(hf => hf.fund_name === fund.name);
        const rawPaid = paidFund ? paidFund.amount : 0;
        const paidAmountNum = typeof rawPaid === 'number' ? rawPaid : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);
        // Chỉ dùng số thực đã nộp. Nếu chưa nộp thì hiển thị định mức (để xem rõ phải nộp bao nhiêu)
        const paidAmount = paidAmountNum > 0 ? paidAmountNum : targetVal;
        receiptRows.push({
          name: '[TDP] ' + fund.name,
          type: 'Hộ gia đình',
          rate: targetVal.toLocaleString('vi-VN') + ' đ/hộ',
          amount: Number(paidAmount) || 0,
          note: paidFund && paidAmountNum > 0
            ? (paidAmountNum >= targetVal ? 'Đã thu đủ' : `Đã nộp ${paidAmountNum.toLocaleString('vi-VN')} đ`)
            : 'Theo định mức'
        });
      });
    }

    // Luôn hiển thị tất cả quỹ Phường đang hoạt động (kể cả chưa nộp)
    const wardActiveFunds = (db as any).getWardFundList();
    wardActiveFunds.forEach((wf: any) => {
      const isHousehold = wf.scope === 'household' || wf.name.toLowerCase().includes('hộ') || wf.name.toLowerCase().includes('người cao tuổi') || wf.name.toLowerCase().includes('cao tuổi');
      const wfTargetVal = typeof wf.target === 'number' ? wf.target : (parseInt((wf.target || '0').toString().replace(/[^\d]/g, ''), 10) || 0);
      
      const isPolicyHousehold = household && (household.policy_type === 'poor' || household.policy_type === 'near_poor' || household.policy_type === 'policy_family');

      let expectedTotalForHH = 0;
      if (isPolicyHousehold) {
        expectedTotalForHH = 0;
      } else if (isHousehold) {
        expectedTotalForHH = wfTargetVal;
      } else {
        expectedTotalForHH = wfTargetVal * laborCount;
      }

      const actualPaidSum = memberWardRecords.reduce((sum, r) => {
        const raw = r.contributions?.[wf.name]?.actual ?? 0;
        const val = typeof raw === 'number' ? raw : (parseInt(String(raw || '0').replace(/[^\d]/g, ''), 10) || 0);
        return sum + val;
      }, 0);

      // Số tiền hiển thị: nếu đã có dữ liệu thực → dùng thực; nếu chưa → dùng định mức (để biết phải nộp bao nhiêu)
      const displayAmount = actualPaidSum > 0 ? actualPaidSum : expectedTotalForHH;

      let noteText = '';
      if (isPolicyHousehold) {
        noteText = actualPaidSum > 0 ? `Tự nguyện đóng ${actualPaidSum.toLocaleString('vi-VN')} đ` : 'Được miễn';
      } else if (expectedTotalForHH === 0) {
        noteText = 'Được miễn';
      } else if (actualPaidSum === 0) {
        noteText = 'Theo định mức';
      } else if (actualPaidSum >= expectedTotalForHH) {
        noteText = 'Đã thu đủ';
      } else {
        noteText = `Đã nộp ${actualPaidSum.toLocaleString('vi-VN')} đ`;
      }

      receiptRows.push({
        name: '[UBND Phường] ' + wf.name,
        type: isHousehold ? 'Hộ gia đình' : 'Nhân khẩu LĐ',
        rate: wfTargetVal.toLocaleString('vi-VN') + (isHousehold ? ' đ/hộ' : ' đ/khẩu'),
        amount: Number(displayAmount) || 0,
        note: noteText
      });
    });

    // Bước 3 & 4: Duyệt qua toàn bộ receiptRows và phân loại theo tên khoản
    let tdpTotal = 0;
    let wardTotal = 0;
    receiptRows.forEach(r => {
      const itemAmount = typeof r.amount === 'number' ? r.amount : (parseInt(String(r.amount || '0').replace(/[^\d]/g, ''), 10) || 0);
      const nameStr = r.name.trim();
      if (nameStr.startsWith('[TDP]') || nameStr.toLowerCase().includes('tdp') || nameStr.toLowerCase().includes('tổ dân phố')) {
        tdpTotal += itemAmount;
      } else {
        // Tất cả quỹ Phường (UBND) tính vào wardTotal
        wardTotal += itemAmount;
      }
    });

    // Bước 5: Tổng cộng thực thu
    const grandTotal = tdpTotal + wardTotal;

    const docSoTien = (number: number): string => {
      if (number === 0) return 'Không đồng';
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
      let temp = number;
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
    };

    const textAmountWords = docSoTien(grandTotal);

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

    const rowsHtml = receiptRows.map((r, idx) => {
      const isTdp = r.name.startsWith('[TDP]') || r.name.toLowerCase().includes('tdp') || r.name.toLowerCase().includes('tổ dân phố');
      const isWard = r.name.startsWith('[UBND') || r.name.toLowerCase().includes('ubnd') || r.name.toLowerCase().includes('phường');
      const fundType = isTdp ? 'tdp' : (isWard ? 'ward' : 'tdp');
      return `
        <tr data-fund-type="${fundType}">
          <td style="text-align: center; border: 1px solid #000; padding: 4px 6px;">${idx + 1}</td>
          <td style="font-weight: bold; text-align: left; border: 1px solid #000; padding: 4px 6px;">${r.name}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 4px 6px;">${r.type}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px 6px;">${r.rate}</td>
          <td class="receipt-amount-cell" style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 4px 6px;">${r.amount.toLocaleString('vi-VN')} đ</td>
          <td style="text-align: left; border: 1px solid #000; padding: 4px 6px;">${r.note}</td>
        </tr>
      `;
    }).join('');

    const generateSingleReceipt = (lienName: string) => {
      // Tính tổng TRỰC TIẾP từ receiptRows mỗi lần gọi — đảm bảo chính xác 100%
      let _tdpTotal = 0;
      let _wardTotal = 0;
      for (const r of receiptRows) {
        const amt = typeof r.amount === 'number' ? r.amount : (parseInt(String(r.amount || '0').replace(/[^\d]/g, ''), 10) || 0);
        if (r.name.startsWith('[TDP]') || r.name.toLowerCase().includes('tdp') || r.name.toLowerCase().includes('tổ dân phố')) {
          _tdpTotal += amt;
        } else {
          _wardTotal += amt;
        }
      }
      const _grandTotal = _tdpTotal + _wardTotal;
      const _textAmountWords = docSoTien(_grandTotal);

      const _totalLabelText = (printMode as string) === 'ward_only'
        ? `(UBND: ${_wardTotal.toLocaleString('vi-VN')} đ)`
        : (printMode as string) === 'tdp_only'
          ? `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ)`
          : `(TDP: ${_tdpTotal.toLocaleString('vi-VN')} đ + UBND: ${_wardTotal.toLocaleString('vi-VN')} đ)`;

      return `
      <div class="receipt-container" style="page-break-inside: avoid; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed #777;">
        <table class="receipt-header-table">
          <tr>
            <td style="width: 50%;">
              <div class="receipt-org-title">
                Đơn vị: UBND ${wardNameVal.toUpperCase()}<br/>
                Tổ dân phố: ${tdpNameVal.toUpperCase()}<br/>
                Địa chỉ: ${household.address || tdpNameVal}
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
          <h1 class="receipt-title">${printMode === 'ward_only' ? 'PHIẾU THU QUỸ UBND PHƯỜNG' : 'PHIẾU THU TỔNG HỢP'}</h1>
          <p class="receipt-subtitle" style="margin-top: 2px; font-weight: bold; color: #1e3a8a;">${lienName}</p>
          <p class="receipt-subtitle">${dateText}</p>
        </div>

        <table class="receipt-info-table">
          <tr>
            <td class="receipt-info-label" style="width: 170px; font-weight: bold; text-align: left;">Họ và tên người nộp tiền:</td>
            <td style="text-align: left;">
              <strong>${headName}</strong> (Đại diện Hộ gia đình)
            </td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Địa chỉ:</td>
            <td style="text-align: left;">${household.address || tdpNameVal}</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Mã số hộ | Nhân khẩu LĐ:</td>
            <td style="text-align: left;"><strong>${household.household_number || '—'}</strong> | Số khẩu trong độ tuổi lao động đóng góp: <strong>${laborCount} khẩu</strong></td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Lý do nộp:</td>
            <td style="text-align: left;">Thu tổng hợp các khoản đóng góp tự nguyện (TDP + UBND) năm ${selectedYear}</td>
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
            <td style="vertical-align: bottom;"><strong>${headName}</strong></td>
          </tr>
        </table>
      </div>
    `;
    };

    return `
      ${generateSingleReceipt('Liên 1: TDP lưu trữ')}
      <div style="page-break-before: always; margin-top: 20px;"></div>
      ${generateSingleReceipt('Liên 2: Giao cho người nộp tiền')}
    `;
  };

  const handlePrintHouseholdReceipt = async (
    householdId: string,
    printMode: 'ward_only' | 'combined' = 'combined'
  ) => {
    const household = households.find(h => h.id === householdId);
    if (!household) {
      showToast('Không tìm thấy thông tin hộ gia đình!', 'danger');
      return;
    }

    const members = residents.filter(r => r.household_id === householdId);
    if (members.length === 0) {
      showToast('Hộ gia đình chưa có nhân khẩu nào đăng ký!', 'warning');
      return;
    }

    const memberIds = new Set(members.map(m => m.id));
    const memberNames = new Set(members.map(m => m.full_name.trim().toLowerCase()));

    const memberWardRecords = funds.filter(f => {
      if (f.year !== selectedYear) return false;
      if (f.user_id && memberIds.has(f.user_id)) return true;
      if (f.full_name && memberNames.has(f.full_name.trim().toLowerCase())) return true;
      return false;
    });

    let householdPaidFunds: HouseholdFund[] = [];
    try {
      householdPaidFunds = await db.getHouseholdFunds();
    } catch { /* ignore */ }
    const filteredHhFunds = householdPaidFunds.filter(hf => hf.household_id === householdId && hf.year === selectedYear);

    const totalTdp = filteredHhFunds.reduce((sum, hf) => sum + hf.amount, 0);
    const totalWard = memberWardRecords.reduce((sum, r) => {
      let rSum = 0;
      activeFunds.forEach(fund => {
        rSum += r.contributions?.[fund.name]?.actual || 0;
      });
      return sum + rSum;
    }, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const headResident = members.find(r => r.id === household.head_of_household_id || r.is_head);
    const headName = headResident ? headResident.full_name : (household.martyr_name || 'Đại diện hộ');

    // Luôn dùng dữ liệu mới nhất từ hệ thống
    const freshReceiptHtml = generateHouseholdReceiptHtml(
      household,
      members,
      memberWardRecords,
      filteredHhFunds,
      dateText,
      tdpNameVal,
      wardNameVal,
      leaderName,
      leaderSigUrl,
      printMode
    );
    const SAVE_KEY = `receipt_html_${householdId}_${selectedYear}_${printMode}`;
    const savedReceiptHtml = localStorage.getItem(SAVE_KEY);
    const hasSavedVersion = !!savedReceiptHtml;
    const receiptHtml = freshReceiptHtml;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phiếu thu - Hộ ${headName}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 12mm;
            }
            html, body {
              margin: 0;
              padding: 0;
            }
            .print-toolbar {
              display: none !important;
            }
            #saved-notice {
              display: none !important;
            }
            body {
              padding-top: 5px !important;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.35;
            color: #000;
            padding: 5px;
            padding-top: 55px;
          }
          .receipt-container {
            width: 100%;
            box-sizing: border-box;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 10pt !important;
            line-height: 1.3;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9.5pt !important;
            line-height: 1.25;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 6px !important;
            margin-bottom: 6px !important;
          }
          .receipt-title {
            font-size: 15.5pt !important;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px !important;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 9.5pt !important;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 4px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0 !important;
            font-size: 10pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000 !important;
            padding: 4px 6px !important;
            font-size: 9.5pt !important;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px !important;
            page-break-inside: avoid !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 9.5pt !important;
            vertical-align: top;
            padding: 2px !important;
          }
          .print-toolbar {
            position: fixed;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 6px 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            display: flex;
            gap: 10px;
            z-index: 99999;
          }
          .toolbar-btn {
            padding: 6px 14px;
            border-radius: 6px;
            border: none;
            font-weight: bold;
            cursor: pointer;
            font-size: 9pt;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .btn-print { background: #10b981; color: white; }
          .btn-print:hover { background: #059669; }
          .btn-save { background: #3b82f6; color: white; }
          .btn-save:hover { background: #2563eb; }
          .btn-load { background: #8b5cf6; color: white; }
          .btn-load:hover { background: #7c3aed; }
          .btn-reset { background: #f59e0b; color: white; }
          .btn-reset:hover { background: #d97706; }
          .btn-close { background: #ef4444; color: white; }
          .btn-close:hover { background: #dc2626; }
          .font-size-select {
            padding: 5px 8px;
            border-radius: 6px;
            border: 1.5px solid #cbd5e1;
            font-size: 8.5pt;
            font-weight: 600;
            cursor: pointer;
            background: #f8fafc;
            color: #334155;
          }
          .toolbar-label {
            font-size: 8pt;
            color: #64748b;
            font-weight: 600;
            display: flex;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <button class="toolbar-btn btn-print" onclick="window.print()">🖨️ In ngay</button>
          <button class="toolbar-btn btn-save" id="btn-save">💾 Lưu chỉnh sửa</button>
          ${hasSavedVersion ? '<button class="toolbar-btn btn-load" id="btn-load">📂 Mở bản đã lưu</button>' : ''}
          <button class="toolbar-btn btn-reset" id="btn-reset">🔄 Tải dữ liệu gốc từ hệ thống</button>
          <span class="toolbar-label">📝 Cỡ chữ:</span>
          <select class="font-size-select" id="font-size-select">
            <option value="7pt">7pt</option>
            <option value="7.5pt">7.5pt</option>
            <option value="8pt">8pt</option>
            <option value="8.5pt">8.5pt</option>
            <option value="9pt" selected>9pt (mặc định)</option>
            <option value="9.5pt">9.5pt</option>
            <option value="10pt">10pt</option>
            <option value="10.5pt">10.5pt</option>
            <option value="11pt">11pt</option>
            <option value="12pt">12pt</option>
          </select>
          <button class="toolbar-btn btn-close" onclick="window.close()">❌ Đóng</button>
        </div>

        <div id="saved-notice" style="${hasSavedVersion ? 'display:flex;' : 'display:none;'}background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;padding:8px 16px;margin-bottom:10px;font-size:9pt;font-family:Arial,sans-serif;align-items:center;gap:10px;color:#92400e;">
          ⚠️ <strong>Đang hiển thị dữ liệu mới nhất từ hệ thống.</strong> ${hasSavedVersion ? 'Có 1 bản đã lưu trước đó của phiếu này. Nhấn <strong>📂 Mở bản đã lưu</strong> để xem lại bản cũ.' : ''}
        </div>
        
        <div class="editor-area" contenteditable="true" style="outline: none;">
          ${receiptHtml}
        </div>
        
        <script>
          const SAVE_KEY = 'receipt_html_${householdId}_${selectedYear}_${printMode}';
          const currentPrintMode = '${printMode}';
          const freshHtml = ${JSON.stringify(freshReceiptHtml)};
          const btnSave = document.getElementById('btn-save');
          const btnReset = document.getElementById('btn-reset');
          const btnLoad = document.getElementById('btn-load');
          const editor = document.querySelector('.editor-area');
          const fontSizeSelect = document.getElementById('font-size-select');

          function docSoTien(number) {
            if (isNaN(number) || number === 0) return 'Không đồng';
            const arrays = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
            
            function readTriple(n, showZero) {
              let tram = Math.floor(n / 100);
              let chuc = Math.floor((n % 100) / 10);
              let donvi = n % 10;
              let res = "";
              if (tram > 0 || showZero) res += arrays[tram] + " trăm ";
              if (chuc === 0 && donvi > 0) res += "lẻ ";
              else if (chuc === 1) res += "mười ";
              else if (chuc > 1) res += arrays[chuc] + " mươi ";
              
              if (donvi === 1 && chuc > 1) res += "mốt";
              else if (donvi === 5 && chuc > 0) res += "lăm";
              else if (donvi > 0) res += arrays[donvi];
              return res.trim();
            }

            let str = "";
            let units = ["", " nghìn", " triệu", " tỷ"];
            let temp = Math.abs(Math.floor(number));
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
            if (!finalStr) return "Không đồng";
            return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
          }

          let isRecalculating = false;
          function recalculateReceiptTotals() {
            if (isRecalculating) return;
            isRecalculating = true;
            try {
              const containers = document.querySelectorAll('.receipt-container');
              if (containers.length === 0) return;

              if (containers.length > 1) {
                let activeEl = document.activeElement;
                if (activeEl && activeEl.nodeType === 3) {
                  activeEl = activeEl.parentElement;
                }
                if (activeEl && typeof activeEl.closest === 'function' && typeof editor !== 'undefined' && editor && editor.contains(activeEl)) {
                  const activeContainer = activeEl.closest('.receipt-container');
                  const activeRow = activeEl.closest('tr');
                  const activeTd = activeEl.closest('td');
                  if (activeContainer && activeRow && activeTd && !activeRow.classList.contains('receipt-total-row') && !(activeRow.textContent || activeRow.innerText || '').toUpperCase().includes('TỔNG CỘNG')) {
                    const sourceContainerIndex = Array.from(containers).indexOf(activeContainer);
                    const sourceRows = Array.from(activeContainer.querySelectorAll('.receipt-details-table tbody tr'));
                    const rowIndex = sourceRows.indexOf(activeRow);
                    
                    if (rowIndex >= 0) {
                      const cellIndex = Array.from(activeRow.children).indexOf(activeTd);
                      const newValue = activeTd.textContent || activeTd.innerText || '';
                      
                      if (cellIndex >= 0 && newValue !== undefined) {
                        containers.forEach((cnt, idx) => {
                          if (idx !== sourceContainerIndex) {
                            const targetRows = cnt.querySelectorAll('.receipt-details-table tbody tr');
                            if (targetRows[rowIndex]) {
                              const targetTd = targetRows[rowIndex].children[cellIndex];
                              if (targetTd && targetTd !== activeTd && (targetTd.textContent || targetTd.innerText || '') !== newValue) {
                                targetTd.textContent = newValue;
                              }
                            }
                          }
                        });
                      }
                    }
                  }
                }
              }

              containers.forEach(container => {
                const table = container.querySelector('.receipt-details-table');
                if (!table) return;

                const rows = Array.from(table.querySelectorAll('tbody tr'));
                if (rows.length === 0) return;

                let totalRow = table.querySelector('tr.receipt-total-row');
                if (!totalRow) {
                  totalRow = rows.find(r => (r.textContent || r.innerText || '').toUpperCase().includes('TỔNG CỘNG'));
                  if (totalRow) totalRow.classList.add('receipt-total-row');
                }

                let grandTotal = 0;
                let tdpTotal = 0;
                let wardTotal = 0;

                rows.forEach(row => {
                  const rText = (row.textContent || row.innerText || '').toUpperCase();
                  if (row === totalRow || row.classList.contains('receipt-total-row') || rText.includes('TỔNG CỘNG')) {
                    return;
                  }

                  const tds = Array.from(row.querySelectorAll('td'));
                  if (tds.length < 2) return;

                  let amountTd = row.querySelector('.receipt-amount-cell');
                  if (!amountTd) {
                    if (tds.length >= 6) amountTd = tds[4];
                    else if (tds.length >= 4) amountTd = tds[2];
                    else amountTd = tds[tds.length - 2];
                  }

                  const cellText = amountTd ? (amountTd.textContent || amountTd.innerText || '') : '';
                  const digits = cellText.replace(/[^\d]/g, '');
                  const num = digits ? parseInt(digits, 10) : 0;

                  const fundTypeAttr = row.getAttribute('data-fund-type');
                  const fundName = (tds[1] ? (tds[1].textContent || tds[1].innerText || '') : '').toLowerCase();
                  const isWard = fundTypeAttr === 'ward' || fundName.includes('ubnd') || fundName.includes('phường') || fundName.includes('thiên tai') || fundName.includes('đền ơn') || fundName.includes('cao tuổi');

                  if (isWard) {
                    wardTotal += num;
                  } else {
                    tdpTotal += num;
                  }

                  grandTotal += num;
                });

                const activePrintMode = (typeof currentPrintMode !== 'undefined') ? currentPrintMode : 'combined';
                let effectiveTotal = grandTotal;
                if (activePrintMode === 'tdp_only') {
                  effectiveTotal = tdpTotal;
                } else if (activePrintMode === 'ward_only') {
                  effectiveTotal = wardTotal;
                }

                if (effectiveTotal === 0 && totalRow) {
                  const existingTd = totalRow.querySelectorAll('td')[1];
                  const existingTxt = existingTd ? (existingTd.textContent || existingTd.innerText || '') : '';
                  const existingNum = parseInt(existingTxt.replace(/[^\d]/g, ''), 10) || 0;
                  if (existingNum > 0) {
                    const hasCellData = rows.some(r => {
                      if (r === totalRow || r.classList.contains('receipt-total-row')) return false;
                      const c = r.querySelector('.receipt-amount-cell') || r.querySelectorAll('td')[4] || r.querySelectorAll('td')[3];
                      return c && (c.textContent || '').replace(/[^\d]/g, '').length > 0;
                    });
                    if (hasCellData) return;
                  }
                }

                if (totalRow) {
                  const totalTds = totalRow.querySelectorAll('td');
                  if (totalTds.length >= 2) {
                    const firstBodyRow = table.querySelector('tbody tr:not(.receipt-total-row)');
                    const ths = Array.from(table.querySelectorAll('thead th'));
                    const is6Col = ths.length >= 6 || (firstBodyRow && firstBodyRow.querySelectorAll('td').length >= 6);
                    
                    if (is6Col && totalTds.length >= 2) {
                      const labelTd = totalTds[0];
                      labelTd.setAttribute('colspan', '4');
                      let printModeText = '';
                      if (activePrintMode === 'tdp_only') {
                        printModeText = '(TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ)';
                      } else if (activePrintMode === 'ward_only') {
                        printModeText = '(UBND: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';
                      } else {
                        printModeText = '(TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ + UBND: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';
                      }
                      labelTd.innerHTML = 'TỔNG CỘNG THỰC THU ' + printModeText;

                      const amountTd = totalTds[1];
                      amountTd.innerHTML = effectiveTotal.toLocaleString('vi-VN') + ' đ';

                      if (totalTds.length >= 3) {
                        totalTds[2].innerHTML = '';
                      }
                    } else {
                      const labelTd = totalTds[0];
                      labelTd.innerHTML = 'TỔNG CỘNG CÁC KHOẢN';
                      const amountTd = totalTds[1];
                      amountTd.innerHTML = effectiveTotal.toLocaleString('vi-VN') + ' đ';
                    }
                  }
                }

                const wordsContainer = container.querySelector('.receipt-amount-words') 
                  || Array.from(container.querySelectorAll('div')).find(d => (d.textContent || d.innerText || '').includes('Số tiền bằng chữ'));
                
                if (wordsContainer) {
                  const strongEl = wordsContainer.querySelector('strong');
                  if (strongEl) {
                    strongEl.innerText = docSoTien(effectiveTotal);
                  } else {
                    wordsContainer.innerHTML = 'Số tiền bằng chữ: <strong>' + docSoTien(effectiveTotal) + '</strong>';
                  }
                }
              });
            } catch (err) {
              console.error('Error recalculating totals:', err);
            } finally {
              isRecalculating = false;
            }
          }

          fontSizeSelect.addEventListener('change', function() {
            document.querySelectorAll('.receipt-container').forEach(function(el) {
              el.style.fontSize = fontSizeSelect.value;
            });
          });

          ['input', 'keyup', 'change', 'blur', 'paste', 'DOMSubtreeModified'].forEach(function(evtType) {
            document.addEventListener(evtType, recalculateReceiptTotals, true);
            window.addEventListener(evtType, recalculateReceiptTotals, true);
            if (editor) {
              editor.addEventListener(evtType, recalculateReceiptTotals, true);
            }
          });

          setInterval(recalculateReceiptTotals, 300);

          try {
            recalculateReceiptTotals();
          } catch (e) {}



          btnSave.addEventListener('click', function() {
            localStorage.setItem(SAVE_KEY, editor.innerHTML);
            const notice = document.getElementById('saved-notice');
            if (notice) {
              notice.style.display = 'flex';
              notice.style.background = '#dcfce7';
              notice.style.border = '1.5px solid #16a34a';
              notice.style.color = '#14532d';
              notice.innerHTML = '✅ <strong>Đã lưu bản chỉnh sửa thành công!</strong> Lần sau bạn có thể bấm <strong>📂 Mở bản đã lưu</strong> để xem lại.';
            }
            if (btnLoad) btnLoad.style.display = 'inline-flex';
            alert('Đã lưu bản chỉnh sửa phiếu thu thành công!');
          });

          if (btnLoad) {
            btnLoad.addEventListener('click', function() {
              const saved = localStorage.getItem(SAVE_KEY);
              if (saved) {
                editor.innerHTML = saved;
                recalculateReceiptTotals();
                const notice = document.getElementById('saved-notice');
                if (notice) {
                  notice.style.display = 'flex';
                  notice.style.background = '#dcfce7';
                  notice.style.border = '1.5px solid #16a34a';
                  notice.style.color = '#14532d';
                  notice.innerHTML = '✅ Đang hiển thị <strong>bản chỉnh sửa đã lưu trước đó</strong>.';
                }
              }
            });
          }

          btnReset.addEventListener('click', function() {
            if (confirm('Bạn có chắc chắn muốn xóa bản đã lưu và tải lại dữ liệu mới nhất từ hệ thống không?')) {
              localStorage.removeItem(SAVE_KEY);
              editor.innerHTML = freshHtml;
              recalculateReceiptTotals();
              const notice = document.getElementById('saved-notice');
              if (notice) notice.style.display = 'none';
              if (btnLoad) btnLoad.style.display = 'none';
              alert('Đã khôi phục về dữ liệu gốc từ hệ thống!');
            }
          });


        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintBulkReceiptsA5_Household = async () => {
    if (householdGroupedFunds.length === 0) {
      showToast('Không có dữ liệu hộ gia đình nào để in!', 'warning');
      return;
    }

    let householdFundsList: HouseholdFund[] = [];
    try {
      householdFundsList = await db.getHouseholdFunds();
    } catch { /* ignore */ }

    const listToPrint: Array<{
      household: Household;
      members: Resident[];
      memberWardRecords: WardFund[];
      filteredHhFunds: HouseholdFund[];
    }> = [];

    for (const group of householdGroupedFunds) {
      const hh = households.find(h => h.id === group.householdId);
      if (!hh) continue;

      const hhFunds = householdFundsList.filter(hf => hf.household_id === group.householdId && hf.year === selectedYear);
      const totalTdp = hhFunds.reduce((sum, hf) => sum + hf.amount, 0);

      const memberNames = group.members.map(m => m.full_name.trim().toLowerCase());
      const memberWardRecords = funds.filter(f => {
        if (f.year !== selectedYear) return false;
        const nameKey = f.full_name.trim().toLowerCase();
        return memberNames.includes(nameKey);
      });

      const totalWard = memberWardRecords.reduce((sum, r) => {
        let rSum = 0;
        activeFunds.forEach(fund => {
          rSum += r.contributions?.[fund.name]?.actual || 0;
        });
        return sum + rSum;
      }, 0);

      if (totalTdp + totalWard > 0) {
        listToPrint.push({
          household: hh,
          members: residents.filter(r => r.household_id === group.householdId),
          memberWardRecords,
          filteredHhFunds: hhFunds
        });
      }
    }

    if (listToPrint.length === 0) {
      showToast('Không có hộ gia đình nào đã nộp tiền để in phiếu thu!', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const receiptsHtml = listToPrint.map((item, idx) => {
      const receiptBody = generateHouseholdReceiptHtml(
        item.household,
        item.members,
        item.memberWardRecords,
        item.filteredHhFunds,
        dateText,
        tdpNameVal,
        wardNameVal,
        leaderName,
        leaderSigUrl
      );
      const isLast = idx === listToPrint.length - 1;
      return `
        <div class="receipt-bulk-item" style="${isLast ? '' : 'page-break-after: always;'}">
          ${receiptBody}
        </div>
      `;
    }).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In loạt phiếu thu tổng hợp theo Hộ</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 12mm;
            }
            html, body {
              margin: 0;
              padding: 0;
            }
            .receipt-bulk-item {
              page-break-inside: avoid !important;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.35;
            color: #000;
            padding: 5px;
          }
          .receipt-container {
            width: 100%;
            box-sizing: border-box;
          }
          .receipt-header-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .receipt-org-title {
            font-weight: bold;
            font-size: 10pt !important;
            line-height: 1.3;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9.5pt !important;
            line-height: 1.25;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 6px !important;
            margin-bottom: 6px !important;
          }
          .receipt-title {
            font-size: 15.5pt !important;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px !important;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 9.5pt !important;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 4px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0 !important;
            font-size: 10pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 4px 6px !important;
            font-size: 9.5pt !important;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px !important;
            page-break-inside: avoid !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 9.5pt !important;
            vertical-align: top;
            padding: 2px !important;
          }
        </style>
      </head>
      <body>
        ${receiptsHtml}
        <script>
          function docSoTien(number) {
            if (isNaN(number) || number === 0) return 'Không đồng';
            const arrays = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
            
            function readTriple(n, showZero) {
              let tram = Math.floor(n / 100);
              let chuc = Math.floor((n % 100) / 10);
              let donvi = n % 10;
              let res = "";
              if (tram > 0 || showZero) res += arrays[tram] + " trăm ";
              if (chuc === 0 && donvi > 0) res += "lẻ ";
              else if (chuc === 1) res += "mười ";
              else if (chuc > 1) res += arrays[chuc] + " mươi ";
              
              if (donvi === 1 && chuc > 1) res += "mốt";
              else if (donvi === 5 && chuc > 0) res += "lăm";
              else if (donvi > 0) res += arrays[donvi];
              return res.trim();
            }

            let str = "";
            let units = ["", " nghìn", " triệu", " tỷ"];
            let temp = Math.abs(Math.floor(number));
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
            if (!finalStr) return "Không đồng";
            return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
          }

          function recalculateReceiptTotals() {
            const containers = document.querySelectorAll('.receipt-container');
            if (containers.length === 0) return;

            containers.forEach(container => {
              const table = container.querySelector('.receipt-details-table');
              if (!table) return;

              const rows = Array.from(table.querySelectorAll('tbody tr'));
              if (rows.length === 0) return;

              let totalRow = table.querySelector('tr.receipt-total-row');
              if (!totalRow) {
                totalRow = rows.find(r => (r.textContent || r.innerText || '').toUpperCase().includes('TỔNG CỘNG'));
                if (totalRow) totalRow.classList.add('receipt-total-row');
              }

              let grandTotal = 0;
              let tdpTotal = 0;
              let wardTotal = 0;

              rows.forEach(row => {
                const rText = (row.textContent || row.innerText || '').toUpperCase();
                if (row === totalRow || row.classList.contains('receipt-total-row') || rText.includes('TỔNG CỘNG')) {
                  return;
                }

                const tds = Array.from(row.querySelectorAll('td'));
                if (tds.length < 2) return;

                let amountTd = row.querySelector('.receipt-amount-cell');
                if (!amountTd) {
                  if (tds.length >= 6) amountTd = tds[4];
                  else if (tds.length >= 4) amountTd = tds[2];
                  else amountTd = tds[tds.length - 2];
                }

                const cellText = amountTd ? (amountTd.textContent || amountTd.innerText || '') : '';
                const digits = cellText.replace(/[^\d]/g, '');
                const num = digits ? parseInt(digits, 10) : 0;

                const fundTypeAttr = row.getAttribute('data-fund-type');
                const fundName = (tds[1] ? (tds[1].textContent || tds[1].innerText || '') : '').toLowerCase();
                const isWard = fundTypeAttr === 'ward' || fundName.includes('ubnd') || fundName.includes('phường') || fundName.includes('thiên tai') || fundName.includes('đền ơn') || fundName.includes('cao tuổi');

                if (isWard) {
                  wardTotal += num;
                } else {
                  tdpTotal += num;
                }

                grandTotal += num;
              });

              if (totalRow) {
                const totalTds = totalRow.querySelectorAll('td');
                if (totalTds.length >= 2) {
                  const firstBodyRow = table.querySelector('tbody tr:not(.receipt-total-row)');
                  const ths = Array.from(table.querySelectorAll('thead th'));
                  const is6Col = ths.length >= 6 || (firstBodyRow && firstBodyRow.querySelectorAll('td').length >= 6);
                  
                  if (is6Col && totalTds.length >= 2) {
                    const labelTd = totalTds[0];
                    labelTd.setAttribute('colspan', '4');
                    labelTd.innerHTML = 'TỔNG CỘNG THỰC THU (TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ + UBND: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';

                    const amountTd = totalTds[1];
                    amountTd.innerHTML = grandTotal.toLocaleString('vi-VN') + ' đ';

                    if (totalTds.length >= 3) {
                      totalTds[2].innerHTML = '';
                    }
                  } else {
                    const labelTd = totalTds[0];
                    labelTd.innerHTML = 'TỔNG CỘNG CÁC KHOẢN';
                    const amountTd = totalTds[1];
                    amountTd.innerHTML = grandTotal.toLocaleString('vi-VN') + ' đ';
                  }
                }
              }

              const wordsContainer = container.querySelector('.receipt-amount-words') 
                || Array.from(container.querySelectorAll('div')).find(d => (d.textContent || d.innerText || '').includes('Số tiền bằng chữ'));
              
              if (wordsContainer) {
                const strongEl = wordsContainer.querySelector('strong');
                if (strongEl) {
                  strongEl.innerText = docSoTien(grandTotal);
                } else {
                  wordsContainer.innerHTML = 'Số tiền bằng chữ: <strong>' + docSoTien(grandTotal) + '</strong>';
                }
              }
            });
          }

          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // In Thông báo dự kiến thu các khoản đóng góp tự nguyện (Mẫu chuẩn gộp TDP & Phường)
  const handlePrintCombinedNotice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    
    let leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const today = new Date();
    const dateTextVal = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    // Quỹ TDP từ CSDL hoặc mẫu mặc định
    const tdpFundsList = (db as any).getFundList() || [];
    const defaultTdpItems = [
      { name: 'Điện của 7 nhà văn hóa', target: '....' },
      { name: 'Bảo vệ, vệ sinh Nhà văn hóa', target: '....' },
      { name: 'Internet', target: '....' },
      { name: 'Tiền chè nước cho các hội họp', target: '....' },
      { name: 'Quỹ đám hiếu', target: '....' },
      { name: 'Quỹ an sinh xã hội', target: '50.000' },
      { name: 'Quỹ khuyến học', target: '50.000' },
      { name: 'Quỹ văn hóa - thể thao của thanh thiếu niên', target: '50.000' }
    ];

    const tdpItemsToRender = tdpFundsList.length > 0 
      ? tdpFundsList.map((f: any) => ({ name: f.name, target: typeof f.target === 'number' ? f.target.toLocaleString('vi-VN') : (f.target || '....') }))
      : defaultTdpItems;

    const totalTdpNum = tdpItemsToRender.reduce((sum: number, item: any) => {
      const valStr = String(item.target || '').replace(/\D/g, '');
      const val = parseInt(valStr, 10);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    let tdpRowsHtml = tdpItemsToRender.map((item: any, idx: number) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${item.name}</td>
        <td style="text-align:right; font-weight:bold;">${item.target} đồng/hộ/năm</td>
      </tr>
    `).join('');

    if (totalTdpNum > 0) {
      tdpRowsHtml += `
        <tr style="font-weight: bold; background-color: #f9fafb;">
          <td colspan="2" style="text-align: center;">TỔNG CỘNG MỨC DỰ KIẾN (QUỸ TĐP)</td>
          <td style="text-align: right; color: #15803d;">${totalTdpNum.toLocaleString('vi-VN')} đồng/hộ/năm</td>
        </tr>
      `;
    }

    const totalNoticeText = totalTdpNum > 0
      ? `<b>${totalTdpNum.toLocaleString('vi-VN')}</b>`
      : '....................................';

    // Quỹ Phường từ CSDL hoặc mẫu mặc định
    const wardFundsList = (db as any).getWardFundList() || [];
    const defaultWardItems = [
      { name: 'Quỹ phòng chống thiên tai', target: 10000, scope: 'person', text: '10.000đ / khẩu / năm (Ở độ tuổi lao động – Có danh sách kèm theo)' },
      { name: 'Đền ơn đáp nghĩa', target: 20000, scope: 'person', text: '20.000đ / khẩu / năm (Ở độ tuổi lao động – Có danh sách kèm theo)' },
      { name: 'Chăm sóc người cao tuổi', target: 20000, scope: 'household', text: '20.000đ / hộ / năm' }
    ];

    let wardHouseholdTotal = 0;
    let wardPersonTotal = 0;

    const listToCalc = wardFundsList.length > 0 ? wardFundsList : defaultWardItems;
    listToCalc.forEach((wf: any) => {
      const isHousehold = wf.scope === 'household' || (wf.name && (wf.name.toLowerCase().includes('hộ') || wf.name.toLowerCase().includes('người cao tuổi')));
      const targetVal = typeof wf.target === 'number' ? wf.target : parseInt(String(wf.target || '').replace(/\D/g, ''), 10) || 0;
      if (isHousehold) {
        wardHouseholdTotal += targetVal;
      } else {
        wardPersonTotal += targetVal;
      }
    });

    const wardSummaryStr = (wardHouseholdTotal > 0 || wardPersonTotal > 0)
      ? `${wardHouseholdTotal > 0 ? `${wardHouseholdTotal.toLocaleString('vi-VN')}đ/hộ/năm` : ''}${wardHouseholdTotal > 0 && wardPersonTotal > 0 ? ' + ' : ''}${wardPersonTotal > 0 ? `${wardPersonTotal.toLocaleString('vi-VN')}đ/khẩu/năm (khẩu lao động)` : ''}`
      : '....................................';

    let wardListHtml = defaultWardItems.map((item) => `
      <li style="margin-bottom: 3px;"><b>${item.name}:</b> ${item.text}</li>
    `).join('');

    if (wardFundsList.length > 0) {
      wardListHtml = wardFundsList.map((wf: any) => {
        const isHousehold = wf.scope === 'household' || wf.name.toLowerCase().includes('hộ') || wf.name.toLowerCase().includes('người cao tuổi');
        const targetStr = typeof wf.target === 'number' ? wf.target.toLocaleString('vi-VN') + 'đ' : (wf.target ? wf.target + 'đ' : '....đ');
        const unitStr = isHousehold ? 'hộ' : 'khẩu';
        const noteStr = wf.age_range ? ` (${wf.age_range})` : (isHousehold ? '' : ' (Trong độ tuổi lao động – Có danh sách kèm theo)');
        return `<li style="margin-bottom: 3px;"><b>${wf.name}:</b> ${targetStr} / ${unitStr} / năm${noteStr}</li>`;
      }).join('');
    }

    // Tải nội dung đã lưu từ localStorage nếu có
    const savedHtml = localStorage.getItem(`notice_template_html_${selectedYear}`);
    const savedFontSize = localStorage.getItem(`notice_template_fontsize_${selectedYear}`) || '11.5pt';

    const defaultEditorHtml = `
          <table class="header-table">
            <tr>
              <td style="width: 45%; text-align: center;">
                <div style="font-weight: bold; font-size: 11pt;">UBND PHƯỜNG ${wardNameVal.toUpperCase().replace('PHƯỜNG ', '')}</div>
                <div style="font-weight: bold; font-size: 11pt;">TỔ DÂN PHỐ ${tdpNameVal.toUpperCase().replace('TỔ DÂN PHỐ ', '')}</div>
                <div style="font-size: 11pt;">Số: ...../TB-TDP</div>
              </td>
              <td style="width: 55%; text-align: center;">
                <div style="font-weight: bold; font-size: 11pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style="font-weight: bold; font-size: 11pt;">Độc lập - Tự do - Hạnh phúc</div>
                <div style="font-size: 11pt; margin-top: 1px;">------------------------</div>
              </td>
            </tr>
          </table>

          <div class="title-section">
            <div class="doc-title">THÔNG BÁO</div>
            <div class="doc-subtitle">Về việc dự kiến thu các khoản đóng góp tự nguyện năm ${selectedYear}</div>
          </div>

          <p style="margin-bottom: 4px;"><b>Kính gửi:</b> Các hộ gia đình và Nhân dân Tổ dân phố ${tdpNameVal}.</p>
          <p style="margin-bottom: 4px; text-indent: 20px;">Căn cứ kết quả cuộc họp Tổ dân phố ngày ..... tháng ..... năm ${selectedYear};</p>
          <p style="margin-bottom: 6px; text-indent: 20px;">Nhằm phục vụ các hoạt động chung của cộng đồng dân cư, Ban cán sự Tổ dân phố ${tdpNameVal} thông báo dự kiến các khoản đóng góp tự nguyện năm ${selectedYear} như sau:</p>

          <div class="section-heading">QUỸ TỔ DÂN PHỐ DỰ KIẾN THU</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px;">STT</th>
                <th>Nội dung khoản thu</th>
                <th style="width: 220px;">Mức dự kiến</th>
              </tr>
            </thead>
            <tbody>
              ${tdpRowsHtml}
            </tbody>
          </table>

          <div class="section-heading">CÁC KHOẢN UBND THU (Các công quỹ pháp lệnh của nhà nước gồm)</div>
          <ol style="margin-top: 2px; margin-bottom: 4px; padding-left: 18px; font-size: 10.5pt;">
            ${wardListHtml}
          </ol>
          <div style="font-size: 10.5pt; font-weight: bold; margin-bottom: 6px; padding-left: 18px; color: #1e40af;">
            ➔ Tổng khoản UBND dự kiến: ${wardSummaryStr}
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; font-size: 10.5pt;">
            <p style="margin: 0 0 3px 0;"><b>1. Tổ dân phố dự kiến:</b> <strong>${totalTdpNum > 0 ? totalTdpNum.toLocaleString('vi-VN') + ' đồng/hộ/năm' : '.... đồng/hộ/năm'}</strong></p>
            <p style="margin: 0 0 3px 0;"><b>2. UBND thu theo quy định:</b> <strong>${wardSummaryStr}</strong></p>
            <p style="margin: 3px 0 0 0; font-size: 11pt; color: #b91c1c;"><b>👉 TỔNG CỘNG DỰ KIẾN (TĐP + UBND):</b> <strong>${(totalTdpNum + wardHouseholdTotal).toLocaleString('vi-VN')} đồng/hộ/năm</strong> ${wardPersonTotal > 0 ? ` + <strong>${wardPersonTotal.toLocaleString('vi-VN')}đ / 1 khẩu lao động</strong>` : ''}</p>
          </div>

          <p style="margin-bottom: 4px; text-indent: 20px;">Các khoản trên là mức dự kiến để Nhân dân nghiên cứu, tham gia ý kiến và thống nhất thực hiện on tinh thần tự nguyện, dân chủ, công khai, minh bạch.</p>
          <p style="margin-bottom: 6px; text-indent: 20px;">Mọi ý kiến góp ý đề nghị gửi về Ban cán sự Tổ dân phố trước ngày ..... tháng ..... năm ${selectedYear}.</p>
          <p style="margin-bottom: 6px;">Trân trọng thông báo!</p>

          <table class="footer-table">
            <tr>
              <td style="width: 45%;"></td>
              <td style="width: 55%;">
                <div style="font-style: italic; margin-bottom: 3px; font-size: 10.5pt;">Nam Sầm Sơn, ${dateTextVal}</div>
                <div style="font-weight: bold; font-size: 11.5pt;">TỔ TRƯỜNG TỔ DÂN PHỐ</div>
                <div style="font-style: italic; font-size: 10pt; margin-bottom: 5px;">(Ký, ghi rõ họ tên)</div>
                <div style="height: 55px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; margin-top: 5px;">
                  ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 55px; max-height: 55px; max-width: 150px; object-fit: contain;" />` : '<div style="height: 55px;"></div>'}
                </div>
                <div style="font-weight: bold; font-size: 11.5pt;">${leaderName}</div>
              </td>
            </tr>
          </table>
    `;

    const editorContentHtml = savedHtml || defaultEditorHtml;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thông Báo Dự Kiến Thu Các Khoản Đóng Góp Năm ${selectedYear}</title>
        <meta charset="utf-8" />
        <style>
          :root {
            --editor-font-size: ${savedFontSize};
          }
          @media print {
            .editor-toolbar { display: none !important; }
            .editor-area {
              margin-top: 0 !important;
              padding: 5px !important;
              font-size: var(--editor-font-size) !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 14mm;
            }
            html, body {
              margin: 0;
              padding: 0;
              overflow: visible;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: var(--editor-font-size);
            line-height: 1.3;
            color: #000;
            margin: 0;
            padding: 0;
          }
          .editor-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1e40af, #1d4ed8);
            color: white;
            padding: 10px 16px;
            display: flex;
            gap: 10px;
            align-items: center;
            z-index: 9999;
            box-shadow: 0 3px 10px rgba(0,0,0,0.35);
            flex-wrap: wrap;
          }
          .editor-toolbar .toolbar-title {
            font-weight: bold;
            font-size: 13px;
            flex: 1;
            white-space: nowrap;
          }
          .toolbar-btn {
            padding: 7px 18px;
            border: none;
            border-radius: 7px;
            cursor: pointer;
            font-weight: 700;
            font-size: 13px;
            transition: all 0.15s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.25), inset 0 -2px 0 rgba(0,0,0,0.15);
          }
          .toolbar-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 -2px 0 rgba(0,0,0,0.15);
          }
          .toolbar-btn:active {
            transform: translateY(1px);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 3px rgba(0,0,0,0.2);
          }
          .btn-print { background: #10b981; color: white; }
          .btn-save { background: #3b82f6; color: white; }
          .btn-close { background: #ef4444; color: white; }
          
          .toolbar-btn-format {
            padding: 6px 12px;
            border: 1px solid rgba(255,255,255,0.25);
            background: rgba(255,255,255,0.12);
            color: white;
            border-radius: 7px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.15s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
          .toolbar-btn-format:hover {
            background: rgba(255,255,255,0.25);
            border-color: white;
            transform: translateY(-1px);
          }
          .toolbar-btn-format:active {
            transform: translateY(1px);
          }
          
          .toolbar-select {
            padding: 6px 10px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 7px;
            background: rgba(255,255,255,0.15);
            color: white;
            font-weight: 600;
            font-size: 13px;
            outline: none;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .toolbar-select option {
            background: #1e40af;
            color: white;
          }
          .toolbar-select:hover {
            background: rgba(255,255,255,0.25);
          }

          .editor-area {
            margin-top: 60px;
            padding: 10px 14px;
            outline: none;
            min-height: 90vh;
            font-size: var(--editor-font-size);
          }
          .editor-area:focus {
            outline: none;
          }
          .edit-hint {
            display: inline-block;
            background: #fef3c7;
            border: 1px dashed #d97706;
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 10px;
            color: #92400e;
            margin-left: 6px;
            font-style: normal;
          }
          .notice-container {
            width: 100%;
            box-sizing: border-box;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          .header-table td {
            vertical-align: top;
            border: none;
            padding: 0;
          }
          .title-section {
            text-align: center;
            margin-top: 4px;
            margin-bottom: 8px;
          }
          .doc-title {
            font-size: 15pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .doc-subtitle {
            font-size: 11.5pt;
            font-style: italic;
          }
          .section-heading {
            font-size: 11.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 6px;
            margin-bottom: 3px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 3px 6px;
            font-size: 10.5pt;
          }
          .data-table th {
            text-align: center;
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .footer-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            page-break-inside: avoid;
          }
          .footer-table td {
            border: none;
            vertical-align: top;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="editor-toolbar">
          <span class="toolbar-title">✏️ Sửa trực tiếp văn bản bên dưới:</span>
          
          <select id="fontSizeSelect" class="toolbar-select">
            <option value="10pt" ${savedFontSize === '10pt' ? 'selected' : ''}>Cỡ chữ: 10pt</option>
            <option value="11pt" ${savedFontSize === '11pt' ? 'selected' : ''}>Cỡ chữ: 11pt</option>
            <option value="11.5pt" ${savedFontSize === '11.5pt' ? 'selected' : ''}>Cỡ chữ: 11.5pt</option>
            <option value="12pt" ${savedFontSize === '12pt' ? 'selected' : ''}>Cỡ chữ: 12pt</option>
            <option value="13pt" ${savedFontSize === '13pt' ? 'selected' : ''}>Cỡ chữ: 13pt</option>
            <option value="14pt" ${savedFontSize === '14pt' ? 'selected' : ''}>Cỡ chữ: 14pt</option>
          </select>

          <button class="toolbar-btn btn-save" id="btnSave">💾 Lưu mẫu</button>
          <button class="toolbar-btn btn-print" onclick="window.print()">🖨️ In ngay</button>
          <button class="toolbar-btn btn-close" onclick="window.close()">✖️ Đóng</button>
          
          <div style="display: flex; gap: 6px; align-items: center; border-left: 1px solid rgba(255,255,255,0.3); padding-left: 10px; margin-left: 5px;">
            <!-- Bold, Italic, Underline -->
            <button class="toolbar-btn-format" onclick="document.execCommand('bold')" title="Chữ đậm (Ctrl+B)" style="font-weight: bold; width: 32px; padding: 6px 0; text-align: center;">B</button>
            <button class="toolbar-btn-format" onclick="document.execCommand('italic')" title="Chữ nghiêng (Ctrl+I)" style="font-style: italic; width: 32px; padding: 6px 0; text-align: center;">I</button>
            <button class="toolbar-btn-format" onclick="document.execCommand('underline')" title="Gạch chân (Ctrl+U)" style="text-decoration: underline; width: 32px; padding: 6px 0; text-align: center;">U</button>
            
            <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.25); margin: 0 4px;"></div>

            <!-- Alignment -->
            <button class="toolbar-btn-format" onclick="document.execCommand('justifyLeft')" title="Căn lề trái">◀️ Căn trái</button>
            <button class="toolbar-btn-format" onclick="document.execCommand('justifyCenter')" title="Căn giữa">🔼 Căn giữa</button>
            <button class="toolbar-btn-format" onclick="document.execCommand('justifyRight')" title="Căn lề phải">▶️ Căn phải</button>
            <button class="toolbar-btn-format" onclick="document.execCommand('justifyFull')" title="Căn đều hai bên">↔️ Căn đều</button>

            <select id="lineHeightSelect" class="toolbar-select" style="margin-left: 5px;">
              <option value="">Giãn dòng (Line Spacing)</option>
              <option value="1.0">Giãn dòng: 1.0</option>
              <option value="1.15">Giãn dòng: 1.15</option>
              <option value="1.2">Giãn dòng: 1.2</option>
              <option value="1.3">Giãn dòng: 1.3</option>
              <option value="1.4">Giãn dòng: 1.4</option>
              <option value="1.5">Giãn dòng: 1.5</option>
              <option value="1.6">Giãn dòng: 1.6</option>
              <option value="1.8">Giãn dòng: 1.8</option>
              <option value="2.0">Giãn dòng: 2.0</option>
              <option value="custom">Giãn dòng: Nhập số khác...</option>
            </select>
          </div>
        </div>
        <div class="editor-area" contenteditable="true" spellcheck="false">
          ${editorContentHtml}
        </div>

        <script>
          // Tự động cập nhật ngày tháng và chữ ký/tên Tổ trưởng mới nhất vào footer table
          (function() {
            let footerTable = document.querySelector('.editor-area .footer-table');
            if (!footerTable) {
              const tables = document.querySelectorAll('.editor-area table');
              if (tables.length > 0) {
                footerTable = tables[tables.length - 1];
              }
            }
            if (footerTable) {
              footerTable.outerHTML = '<table class="footer-table" style="width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid;">' +
                '<tr>' +
                  '<td style="width: 45%; border: none; vertical-align: top; text-align: center;"></td>' +
                  '<td style="width: 55%; border: none; vertical-align: top; text-align: center;">' +
                    '<div style="font-style: italic; margin-bottom: 3px; font-size: 10.5pt;">Nam Sầm Sơn, ${dateTextVal}</div>' +
                    '<div style="font-weight: bold; font-size: 11.5pt;">TỔ TRƯỜNG TỔ DÂN PHỐ</div>' +
                    '<div style="font-style: italic; font-size: 10pt; margin-bottom: 5px;">(Ký, ghi rõ họ tên)</div>' +
                    '<div style="height: 55px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; margin-top: 5px;">' +
                      '${leaderSigUrl ? '<img src="' + leaderSigUrl + '" alt="Chữ ký" style="height: 55px; max-height: 55px; max-width: 150px; object-fit: contain;" />' : '<div style="height: 55px;"></div>'}' +
                    '</div>' +
                    '<div style="font-weight: bold; font-size: 11.5pt;">${leaderName}</div>' +
                  '</td>' +
                '</tr>' +
              '</table>';
            }
          })();

          // Click to focus khi vào trang
          document.querySelector('.editor-area').addEventListener('click', function() {
            this.focus();
          });

          // Thay đổi cỡ chữ
          const fontSizeSelect = document.getElementById('fontSizeSelect');
          fontSizeSelect.addEventListener('change', function() {
            document.documentElement.style.setProperty('--editor-font-size', this.value);
          });

          // Lưu mẫu chỉnh sửa
          const btnSave = document.getElementById('btnSave');
          btnSave.addEventListener('click', function() {
            const editorContent = document.querySelector('.editor-area').innerHTML;
            const selectedFontSize = fontSizeSelect.value;
            
            localStorage.setItem('notice_template_html_${selectedYear}', editorContent);
            localStorage.setItem('notice_template_fontsize_${selectedYear}', selectedFontSize);
            
            // Phản hồi trực quan
            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = '💾 Đã lưu!';
            btnSave.style.backgroundColor = '#059669';
            setTimeout(() => {
              btnSave.innerHTML = originalText;
              btnSave.style.backgroundColor = '';
            }, 1200);
          });



          // Giãn dòng của phần được chọn
          const lineHeightSelect = document.getElementById('lineHeightSelect');
          lineHeightSelect.addEventListener('change', function() {
            let val = this.value;
            if (!val) return;
            
            if (val === 'custom') {
              const customVal = prompt('Nhập khoảng cách giãn dòng mong muốn (ví dụ: 1.25, 1.75):');
              if (customVal) {
                const parsed = parseFloat(customVal);
                if (!isNaN(parsed) && parsed > 0) {
                  val = parsed.toString();
                } else {
                  alert('Vui lòng nhập một số lớn hơn 0!');
                  this.value = "";
                  return;
                }
              } else {
                this.value = "";
                return;
              }
            }
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const editorArea = document.querySelector('.editor-area');
            const blocks = editorArea.querySelectorAll('p, div, td, tr, th, span');
            let applied = false;
            
            blocks.forEach(block => {
              if (selection.containsNode(block, true)) {
                block.style.lineHeight = val;
                applied = true;
              }
            });
            
            if (!applied || selection.isCollapsed) {
              let node = range.commonAncestorContainer;
              while (node && node.nodeType === 3) {
                node = node.parentNode;
              }
              while (node && node !== editorArea && node.tagName !== 'BODY') {
                if (node.tagName === 'P' || node.tagName === 'DIV' || node.tagName === 'TD' || node.tagName === 'TR' || node.tagName === 'TH' || node.tagName === 'SPAN') {
                  node.style.lineHeight = val;
                  break;
                }
                node = node.parentNode;
              }
            }
            this.value = ""; // reset select
          });

          // Keyboard shortcut: Ctrl+P to print
          document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
              e.preventDefault();
              window.print();
            }
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div style={{ 
      animation: 'fadeIn 0.25s ease-out',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)',
      minHeight: 'calc(100vh - var(--header-height) - 48px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <style>{`
        .premium-input-3d {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          font-size: 0.88rem;
          outline: none;
          background-color: #fff;
          color: var(--text-main);
          box-sizing: border-box;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }
        .premium-input-3d:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.15), inset 0 2px 4px rgba(0,0,0,0.02);
        }

        .premium-select-3d {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          background-color: #fff;
          font-size: 0.88rem;
          color: var(--text-main);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04), inset 0 -2px 0 rgba(0,0,0,0.05);
          transition: all 0.2s ease;
        }
        .premium-select-3d:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.06), inset 0 -2px 0 rgba(0,0,0,0.05);
        }
        .premium-select-3d:active {
          transform: translateY(1px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 2px rgba(0,0,0,0.1);
        }

        .btn-3d-data {
          padding: 8px 16px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1.5px solid #bfdbfe;
          color: #1e40af;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          box-shadow: 0 3px 6px rgba(37,99,235,0.1), inset 0 -2.5px 0 rgba(37,99,235,0.15);
          transition: all 0.15s ease;
        }
        .btn-3d-data:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 5px 10px rgba(37,99,235,0.15), inset 0 -2.5px 0 rgba(37,99,235,0.15);
        }
        .btn-3d-data:active {
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(37,99,235,0.08), inset 0 1.5px 3px rgba(37,99,235,0.25);
        }

        .btn-3d-print {
          padding: 8px 16px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border: 1.5px solid #ddd6fe;
          color: #6d28d9;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          box-shadow: 0 3px 6px rgba(124,58,237,0.1), inset 0 -2.5px 0 rgba(124,58,237,0.15);
          transition: all 0.15s ease;
        }
        .btn-3d-print:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 5px 10px rgba(124,58,237,0.15), inset 0 -2.5px 0 rgba(124,58,237,0.15);
        }
        .btn-3d-print:active {
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(124,58,237,0.08), inset 0 1.5px 3px rgba(124,58,237,0.25);
        }

        .btn-3d-delete {
          padding: 8px;
          border-radius: 10px;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1.5px solid #fecaca;
          color: #dc2626;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 6px rgba(220,38,38,0.08), inset 0 -2.5px 0 rgba(220,38,38,0.12);
          transition: all 0.15s ease;
        }
        .btn-3d-delete:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 5px 10px rgba(220,38,38,0.12), inset 0 -2.5px 0 rgba(220,38,38,0.12);
        }
        .btn-3d-delete:active {
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(220,38,38,0.05), inset 0 1.5px 3px rgba(220,38,38,0.2);
        }

        .segmented-control-3d {
          display: flex;
          background-color: #e2e8f0;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 16px;
          gap: 4px;
          width: 100%;
          box-sizing: border-box;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.08);
        }
        .segmented-control-btn-3d {
          flex: 1;
          padding: 10px 12px;
          border-radius: 9px;
          border: none;
          font-weight: 750;
          font-size: 0.86rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .segmented-control-btn-3d.active-blue {
          background-color: #fff;
          color: #2563eb;
          box-shadow: 0 3px 6px rgba(0,0,0,0.08), inset 0 -2px 0 rgba(37,99,235,0.06);
          transform: scale(1.01);
        }
        .segmented-control-btn-3d.active-green {
          background-color: #fff;
          color: #10b981;
          box-shadow: 0 3px 6px rgba(0,0,0,0.08), inset 0 -2px 0 rgba(16,185,129,0.06);
          transform: scale(1.01);
        }
        .segmented-control-btn-3d.inactive {
          background-color: transparent;
          color: #64748b;
        }
        .segmented-control-btn-3d.inactive:hover {
          background-color: rgba(255, 255, 255, 0.4);
          color: #334155;
        }
      `}</style>
      
      {/* Top Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        marginBottom: '10px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              backgroundColor: '#eff6ff', 
              color: '#3b82f6', 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Quản lý Quỹ Ủy thác từ Phường
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Theo dõi các khoản thu bắt buộc và tự nguyện dựa trên danh sách Phường giao
              </p>
            </div>
          </div>
        </div>

        {/* Year Select & Reload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: '#fff',
              fontSize: '0.9rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(yr => (
              <option key={yr} value={yr}>Năm {yr}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Dashboard (Dynamic summary cards) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px', 
        marginBottom: '10px' 
      }}>
        {fundStats.map((stat, index) => {
          const isPCTT = stat.name.includes('thiên tai');
          const bgColor = isPCTT ? '#f0fdf4' : '#fffdf5';
          const borderColor = isPCTT ? '#fef3c7' : '#fef3c7'; // clean border
          const textColor = isPCTT ? '#065f46' : '#78350f';
          const barColor = isPCTT ? '#10b981' : '#f59e0b';
          const trackColor = isPCTT ? '#e8f5e9' : '#fff8e1';
          
          return (
            <div 
              key={stat.name}
              style={{
                backgroundColor: bgColor,
                border: `1.5px solid ${isPCTT ? '#d1fae5' : '#fef3c7'}`,
                borderRadius: '14px',
                padding: '14px 18px',
                boxShadow: '0 2px 4px -1px rgba(0,0,0,0.008)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: textColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stat.name}
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: '850', color: '#1e293b' }}>
                    {formatCurrency(stat.target)} đ/{(stat as any).scope === 'household' ? 'hộ' : 'khẩu'}
                  </h3>
                </div>
                <div style={{
                  backgroundColor: isPCTT ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: barColor,
                  borderRadius: '10px',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  fontWeight: '800'
                }}>
                  Tiến độ {stat.percent}%
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', backgroundColor: trackColor, borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(stat.percent, 100)}%`, height: '100%', backgroundColor: barColor, borderRadius: '3px', transition: 'width 0.4s ease-out' }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>
                <span>Đã thu: <strong style={{ color: '#16a34a' }}>{formatCurrency(stat.actual)} đ</strong></span>
                <span>Phải thu: {formatCurrency(stat.expected)} đ</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 2 Sub-Tabs Segmented Control Style ─── */}
      <div className="segmented-control-3d">
        <button
          type="button"
          onClick={() => setSubTabMode('ward_list')}
          className={`segmented-control-btn-3d ${subTabMode === 'ward_list' ? 'active-blue' : 'inactive'}`}
        >
          📜 1. Danh sách gốc Phường giao ({funds.length} cá nhân)
        </button>
        <button
          type="button"
          onClick={() => setSubTabMode('household_list')}
          className={`segmented-control-btn-3d ${subTabMode === 'household_list' ? 'active-green' : 'inactive'}`}
        >
          🏡 2. Danh sách Quỹ thu theo Hộ ({households.length} hộ)
        </button>
      </div>

      {/* Toolbar Controls */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '12px',
        width: '100%'
      }}>
        {/* Row 1: Search and Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {/* Search Input */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px',
            minWidth: '200px'
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <DebouncedInput
              value={searchInput}
              onChange={setSearchInput}
              debounce={300}
              placeholder="Tìm theo tên người nộp, tên chủ hộ, địa chỉ..."
              className="premium-input-3d"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="premium-select-3d"
            style={{
              flex: '1 1 150px',
              minWidth: '140px'
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid_all">Đã nộp đủ các quỹ</option>
            <option value="unpaid_any">Chưa nộp đủ ít nhất 1 quỹ</option>
          </select>

          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="premium-select-3d"
            style={{
              flex: '1 1 150px',
              minWidth: '140px'
            }}
          >
            <option value="all">Tất cả các tổ</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Row 2: Stats and Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          width: '100%'
        }}>
          {/* Left Count */}
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            Đang hiển thị {filteredFunds.length} / {funds.length} {subTabMode === 'ward_list' ? 'cá nhân' : 'hộ'} phải nộp
          </div>

          {/* Right Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
            {/* Nút chuyển chế độ xem: Danh sách ↔ Gom theo Hộ */}
            {subTabMode === 'ward_list' && (
              <button
                type="button"
                onClick={() => setViewMode(m => m === 'list' ? 'grouped' : 'list')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${viewMode === 'grouped' ? '#a78bfa' : '#cbd5e1'}`,
                  background: viewMode === 'grouped'
                    ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)'
                    : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  color: viewMode === 'grouped' ? '#7c3aed' : '#64748b',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: viewMode === 'grouped'
                    ? '0 3px 6px rgba(124,58,237,0.15), inset 0 -2.5px 0 rgba(124,58,237,0.15)'
                    : '0 2px 4px rgba(0,0,0,0.05), inset 0 -2px 0 rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                title={viewMode === 'grouped' ? 'Xem danh sách thông thường' : 'Gom nhóm từng hộ gia đình'}
              >
                {viewMode === 'grouped' ? '📋 Xem danh sách' : '🏡 Gom theo Hộ'}
              </button>
            )}
            {!isGuest && (
              <button
                type="button"
                onClick={handleAddNewRecord}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  color: '#15803d',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(21, 128, 61, 0.15)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #dcfce7, #bbf7d0)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4, #dcfce7)'}
                title="Tự nhập bổ sung thêm cá nhân / hộ dân mới vào danh sách"
              >
                <PlusCircle size={16} /> Thêm người / Hộ mới
              </button>
            )}
            {/* Data Actions Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDataMenu(!showDataMenu);
                  setShowPrintMenu(false);
                }}
                className="btn-3d-data"
              >
                <Database size={16} /> Thao tác dữ liệu ▼
              </button>
              {showDataMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: '#fff',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                  padding: '6px',
                  width: '240px',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDataMenu(false);
                        handleAutoInitFromResidents();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#d97706',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Home size={14} /> Khởi tạo từ Hộ gia đình
                    </button>
                  )}
                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDataMenu(false);
                        handleAutoSyncWithDB();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#0284c7',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <RefreshCw size={14} /> Khớp & Đồng bộ với CSDL
                    </button>
                  )}
                  {!isGuest && subTabMode !== 'ward_list' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDataMenu(false);
                        handleSupplementMissingHouseholds();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#16a34a',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Home size={14} /> Bổ sung Hộ thiếu từ CSDL
                    </button>
                  )}
                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDataMenu(false);
                        fileInputRef.current?.click();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#2563eb',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Upload size={14} /> Nhập Excel Phường
                    </button>
                  )}
                  {canPrintExport && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDataMenu(false);
                        handleExportTemplate();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-main)',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Download size={14} /> Tải file mẫu Excel
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Print/Export Actions Dropdown */}
            {canPrintExport && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPrintMenu(!showPrintMenu);
                    setShowDataMenu(false);
                  }}
                  className="btn-3d-print"
                >
                  <Printer size={16} /> In ấn & Xuất bản ▼
                </button>
                {showPrintMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    backgroundColor: '#fff',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                    padding: '6px',
                    width: '280px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintMenu(false);
                        handleExportReport();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#16a34a',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <FileSpreadsheet size={14} /> Xuất báo cáo Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintMenu(false);
                        handlePrintCombinedNotice();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#7c3aed',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Printer size={14} /> In Thông báo dự kiến thu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintMenu(false);
                        handlePrintList();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-main)',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Printer size={14} /> In danh sách A4
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintMenu(false);
                        handlePrintBulkReceiptsA5_Ward();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#166534',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Printer size={14} /> In loạt phiếu A5 (Cá nhân)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintMenu(false);
                        handlePrintBulkReceiptsA5_Household();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#6d28d9',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Printer size={14} /> In loạt phiếu thu Hộ (A5)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Delete Year Button */}
            {!isGuest && funds.length > 0 && (
              <button
                type="button"
                onClick={handleClearYearData}
                title="Xóa hết danh sách năm nay"
                className="btn-3d-delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Grid Area */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '8px' }} />
          <div>Đang xử lý dữ liệu...</div>
        </div>
      ) : filteredFunds.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <AlertTriangle size={36} style={{ color: '#f59e0b', marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: '750', color: 'var(--text-main)' }}>
            Không tìm thấy dữ liệu quỹ Phường
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Năm {selectedYear} chưa có dữ liệu. Vui lòng tải file mẫu, điền danh sách rồi nhập vào hệ thống để bắt đầu theo dõi.
          </p>
          {!isGuest && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
              style={{
                marginTop: '16px',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}
            >
              Nhập Excel danh sách Phường giao ngay
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Statistics bar */}
          <div style={{ marginBottom: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'flex-end', fontWeight: '500' }}>
            <span>Đơn vị tính: Đồng (đ)</span>
          </div>

          {/* Table container with horizontal & vertical scroll scrollbar support */}
          {viewMode === 'grouped' && subTabMode === 'ward_list' ? (
            /* ===== CHẾ ĐỘ XEM GOM THEO HỘ GIA ĐÌNH ===== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {householdGroupedFunds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Không có dữ liệu.</div>
              ) : (
                <>
                  {householdGroupedFunds.slice(0, visibleCount).map(group => {
                    const totalExpected = group.members.reduce((sum, m) => {
                      const compExp = computedExpectedMap.get(m.id) || {};
                      return sum + activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) =>
                        s + (compExp[fund.name] ?? (m.contributions?.[fund.name]?.expected || 0)), 0);
                    }, 0);
                    const totalActual = group.members.reduce((sum, m) =>
                      sum + activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) =>
                        s + (m.contributions?.[fund.name]?.actual || 0), 0), 0);
                    
                    const tdpActiveFunds = (db as any).getFundList() || [];
                    const hhIdClean = group.householdId;
                    const hhTdpFunds = householdFunds.filter(hf => hf.household_id === hhIdClean && hf.year === selectedYear);
                    const allTdpPaid = tdpActiveFunds.length > 0 && tdpActiveFunds.every((fund: any) => {
                      const paid = hhTdpFunds.find(hf => hf.fund_name === fund.name);
                      return paid && paid.amount >= fund.target;
                    });
                    
                    const allWardPaid = totalActual >= totalExpected && totalExpected > 0;
                    const allPaid = allWardPaid && (tdpActiveFunds.length === 0 || allTdpPaid);
                    const hasPartial = (totalActual > 0 || hhTdpFunds.some(f => f.amount > 0)) && !allPaid;
                    const borderColor = allPaid ? '#86efac' : hasPartial ? '#fde68a' : '#e2e8f0';
                    const headerBg = allPaid
                      ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)'
                      : hasPartial
                      ? 'linear-gradient(135deg,#fef9c3,#fde68a)'
                      : 'linear-gradient(135deg,#eff6ff,#dbeafe)';

                return (
                  <div key={group.householdId} style={{ border: `1.5px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    {/* Header hộ */}
                    <div style={{ background: headerBg, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>🏡 {group.headName || group.address || 'Hộ gia đình'}</span>
                        {group.address && group.headName && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{group.address}</span>}
                        {group.groupName && <span style={{ fontSize: '0.75rem', background: '#e2e8f0', borderRadius: '6px', padding: '1px 8px', fontWeight: '600', color: '#475569' }}>{group.groupName}</span>}
                        <span style={{ fontSize: '0.75rem', background: allPaid ? '#16a34a' : hasPartial ? '#d97706' : '#dc2626', borderRadius: '10px', padding: '2px 9px', fontWeight: '700', color: 'white' }}>
                          {group.members.length} người
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: allPaid ? '#16a34a' : hasPartial ? '#92400e' : '#dc2626' }}>
                          {formatCurrency(totalActual)} / {formatCurrency(totalExpected)}
                        </span>
                        {group.householdId && !group.householdId.startsWith('addr__') && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handlePrintHouseholdReceipt(group.householdId, 'ward_only')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                              title="In biên lai thu riêng các quỹ của UBND Phường"
                            >
                              <Printer size={13} /> In biên lai Phường
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintHouseholdReceipt(group.householdId, 'combined')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#8b5cf6',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 4px rgba(139,92,246,0.3)',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = '#7c3aed'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = '#8b5cf6'; }}
                              title="In biên lai gộp các quỹ TDP và quỹ UBND Phường"
                            >
                              <Printer size={13} /> In biên lai gộp
                            </button>
                          </div>
                        )}
                        {!isGuest && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenAddMemberModal(group)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #0284c7',
                                background: '#f0f9ff',
                                color: '#0369a1',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e0f2fe'; }}
                              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
                              title="Thêm thành viên mới vào danh sách đóng quỹ của hộ này"
                            >
                              <UserPlus size={13} /> Thêm nhân khẩu
                            </button>
                            <button type="button" onClick={() => handleQuickPayHousehold(group.members, allPaid, group.householdId)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: allPaid ? '#e2e8f0' : '#10b981', color: allPaid ? '#64748b' : 'white', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', boxShadow: allPaid ? 'none' : '0 2px 4px rgba(16,185,129,0.3)' }}>
                              {allPaid ? '↩ Hủy' : '✓ Thu đủ cả nhà'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Danh sách thành viên */}
                    {group.members.map((member, idx) => {
                      const computedExp = computedExpectedMap.get(member.id) || {};
                      const mExp = activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) => s + (computedExp[fund.name] ?? (member.contributions?.[fund.name]?.expected || 0)), 0);
                      const mAct = activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) => s + (member.contributions?.[fund.name]?.actual || 0), 0);
                      const mPaid = mAct >= mExp && mExp > 0;
                      const isHead = headNamesSet.has(member.full_name.trim().toLowerCase());
                      return (
                        <div key={member.id} style={{ padding: '9px 16px', borderBottom: idx < group.members.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: mPaid ? '#f0fdf4' : 'white' }}>
                          <span style={{ color: '#94a3b8', fontWeight: '600', width: '22px', textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                          <div style={{ minWidth: '180px', flex: '1' }}>
                            <span style={{ fontWeight: isHead ? '800' : '600', fontSize: '0.88rem' }}>{isHead ? '👑 ' : ''}{member.full_name}</span>
                            {member.dob && <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '5px' }}>({formatDateVN(member.dob)})</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: '2' }}>
                            {activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').map(fund => {
                              const storedActual = member.contributions?.[fund.name]?.actual || 0;
                              // Dùng expected tính động theo tuổi/giới tính thực tế
                              const dynExpected = computedExp[fund.name] ?? (member.contributions?.[fund.name]?.expected || 0);
                              const paid = storedActual >= dynExpected && dynExpected > 0;
                              return (
                                <span key={fund.name} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', background: dynExpected === 0 ? '#f1f5f9' : paid ? '#dcfce7' : '#fee2e2', color: dynExpected === 0 ? '#94a3b8' : paid ? '#166534' : '#991b1b', whiteSpace: 'nowrap' }}>
                                  {fund.name.split(' ').slice(-2).join(' ')}: {dynExpected === 0 ? 'Miễn' : `${storedActual.toLocaleString('vi-VN')}/${dynExpected.toLocaleString('vi-VN')}đ`}
                                </span>
                              );
                            })}
                          </div>
                          {!isGuest && (
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                              <button onClick={() => handleQuickPay(member)} title={mPaid ? 'Hủy ghi nhận' : 'Thu đủ cá nhân'} style={{ background: mPaid ? '#e2e8f0' : '#10b981', border: 'none', color: mPaid ? '#64748b' : 'white', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Check size={14} />
                              </button>
                              <button onClick={() => handleOpenPay(member)} title="Cập nhật chi tiết" style={{ background: '#3b82f6', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteRecord(member.id, member.full_name)} title="Xóa nhân khẩu khỏi danh sách đóng quỹ" style={{ background: '#ef4444', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
                  })}
                  {householdGroupedFunds.length > visibleCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(c => c + 150)}
                      className="premium-button-3d"
                      style={{
                        margin: '12px auto',
                        display: 'block',
                        padding: '10px 24px',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        borderRadius: '10px',
                        border: 'none',
                        boxShadow: '0 4px 6px rgba(37,99,235,0.2)',
                        cursor: 'pointer'
                      }}
                    >
                      ⏬ Hiển thị thêm 150 hộ tiếp theo... (Còn {householdGroupedFunds.length - visibleCount} hộ)
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
          /* ===== STANDARD TABLE VIEW ===== */
          (() => {
            const displayedActiveFunds = activeFunds.filter((f: any) => {
              const isHouseholdScope = f.scope === 'household' || f.name.toLowerCase().includes('hộ') || f.name.toLowerCase().includes('người cao tuổi') || f.name.toLowerCase().includes('cao tuổi');
              if (subTabMode === 'ward_list') return !isHouseholdScope;
              if (subTabMode === 'household_list') return isHouseholdScope;
              return true;
            });

            return (
              <>
                <div style={{ 
                  overflow: 'auto', 
                  maxHeight: 'calc(100vh - 330px)',
                  border: '1.5px solid var(--border)', 
                  borderRadius: '12px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                }}>
                <table className="data-table" style={{ width: '100%', minWidth: `${600 + displayedActiveFunds.length * 200}px`, borderCollapse: 'collapse', margin: 0 }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ width: '60px', padding: '12px 10px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>STT</th>
                      <th style={{ width: '220px', padding: '12px 10px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Người phải nộp</th>
                      <th style={{ width: '90px', padding: '12px 10px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Năm sinh</th>
                      <th style={{ width: '240px', padding: '12px 10px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Địa chỉ</th>
                      
                      {displayedActiveFunds.map(fund => {
                        const isPCTT = fund.name.includes('thiên tai');
                        const isHousehold = (fund as any).scope === 'household' || fund.name.toLowerCase().includes('hộ') || fund.name.toLowerCase().includes('người cao tuổi') || fund.name.toLowerCase().includes('cao tuổi');
                        return (
                          <th key={fund.name} style={{ 
                            width: '180px', 
                            padding: '12px 10px',
                            textAlign: 'center', 
                            position: 'sticky', 
                            top: 0, 
                            zIndex: 10,
                            backgroundColor: isHousehold ? '#eff6ff' : (isPCTT ? '#ecfdf5' : '#fef3c7'), 
                            color: isHousehold ? '#1e40af' : (isPCTT ? '#065f46' : '#78350f') 
                          }}>
                            <div>{fund.name}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: '500', marginTop: '2px' }}>
                              {isHousehold ? '🏡 (Thu theo Hộ)' : '👤 (Thu theo Người)'}
                            </div>
                          </th>
                        );
                      })}
                      
                      <th style={{ width: '200px', padding: '12px 10px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Ghi chú</th>
                      {!isGuest && <th style={{ width: '130px', padding: '12px 10px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFunds.slice(0, visibleCount).map((item, idx) => {
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '500', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td 
                            style={{ padding: '12px 10px', cursor: 'pointer' }}
                            onClick={() => handleOpenPay(item)}
                            title="Bấm để cập nhật nộp tiền cho cá nhân này"
                          >
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.full_name}</div>
                            {(() => {
                              const info = findResidentGroupAndHead(item.full_name, item.dob || '');
                              if (info.headName) {
                                return (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    🏡 <span style={{ fontStyle: 'italic' }}>Chủ hộ:</span> <span style={{ fontWeight: '600' }}>{info.headName}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>{formatDateVN(item.dob) || '—'}</td>
                          <td style={{ padding: '12px 10px' }}>{item.address || '—'}</td>
                          
                          {displayedActiveFunds.map(fund => {
                            const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
                            const paid = contrib.actual >= contrib.expected && contrib.expected > 0;
                            const hasPartial = contrib.actual > 0 && contrib.actual < contrib.expected;
                            
                            return (
                              <td 
                                key={fund.name} 
                                style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }}
                                onClick={() => handleOpenPay(item)}
                                title={`Bấm để cập nhật nộp quỹ: ${fund.name}`}
                              >
                                <div style={{ 
                                  display: 'inline-block',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: paid ? '#dcfce7' : (hasPartial ? '#fef3c7' : (contrib.expected === 0 ? '#f1f5f9' : '#fee2e2')),
                                  color: paid ? '#166534' : (hasPartial ? '#92400e' : (contrib.expected === 0 ? '#64748b' : '#991b1b')),
                                  fontWeight: '600',
                                  fontSize: '0.85rem',
                                  transition: 'transform 0.1s',
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                  {contrib.expected === 0 ? (
                                    <span style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>Miễn / 0đ</span>
                                  ) : (
                                    <>
                                      {formatCurrency(contrib.actual)}
                                      <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>
                                        / {formatCurrency(contrib.expected)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          
                          <td style={{ padding: '12px 10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {(() => {
                              const isAllPaid = activeFunds.every(fund => {
                                const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
                                return contrib.actual >= contrib.expected && contrib.expected > 0;
                              });
                              if (!isAllPaid && item.note === 'Đã nộp đủ đợt tập trung') {
                                return '—';
                              }
                              return item.note || '—';
                            })()}
                          </td>
                          {!isGuest && (
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => handleQuickPay(item)}
                                  title="Ghi nhận nộp đủ nhanh"
                                  style={{
                                    background: '#10b981',
                                    border: 'none',
                                    color: '#fff',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleOpenPay(item)}
                                  title="Cập nhật chi tiết"
                                  style={{
                                    background: '#3b82f6',
                                    border: 'none',
                                    color: '#fff',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    const resident = residents.find(r => r.full_name === item.full_name && (!item.dob || r.dob === item.dob));
                                    if (resident?.household_id) {
                                      handlePrintHouseholdReceipt(resident.household_id);
                                    } else {
                                      handlePrintIndividualReceipt_Ward(item);
                                    }
                                  }}
                                  title={subTabMode === 'household_list' ? "In phiếu thu tổng hợp Hộ" : "In phiếu thu cá nhân"}
                                  style={{
                                    background: '#8b5cf6',
                                    border: 'none',
                                    color: '#fff',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Printer size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(item.id, item.full_name)}
                                  title="Xóa cá nhân này"
                                  style={{
                                    background: '#ef4444',
                                    border: 'none',
                                    color: '#fff',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredFunds.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 150)}
                  className="premium-button-3d"
                  style={{
                    margin: '12px auto',
                    display: 'block',
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 6px rgba(37,99,235,0.2)',
                    cursor: 'pointer'
                  }}
                >
                  ⏬ Hiển thị thêm 150 người tiếp theo... (Còn {filteredFunds.length - visibleCount} người)
                </button>
              )}
              </>
            );
          })()
          )}
        </div>
      )}

      {/* Modal: Ghi nhận đóng tiền chi tiết */}
      {editingRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200,
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            width: '90%',
            maxWidth: '520px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Cập nhật đóng quỹ Phường</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Hộ/Cá nhân: {editingRecord.full_name} {editingRecord.dob ? `(${formatDateVN(editingRecord.dob)})` : ''}
                </p>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form scrollable */}
            <form onSubmit={handleSavePayment} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              
              {/* Thông tin cá nhân */}
              <div style={{ 
                border: '1.5px solid var(--border)', 
                borderRadius: '12px', 
                padding: '12px 14px', 
                marginBottom: '16px',
                backgroundColor: 'var(--bg-main)'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Thông tin cá nhân
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Họ và tên
                    </label>
                    <input 
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--border)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Năm/Ngày sinh
                    </label>
                    <input 
                      type="text"
                      value={dobInput}
                      onChange={(e) => setDobInput(e.target.value)}
                      placeholder="VD: 1990"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--border)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Địa chỉ (Số nhà / Ngõ / Tổ)
                  </label>
                  <input 
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid var(--border)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Funds Fields */}
              {activeFunds.map(fund => {
                const input = contribInputs[fund.name] || { expected: '0', actual: '0', date: '' };
                const isPCTT = fund.name.includes('thiên tai');
                const fundColor = isPCTT ? '#065f46' : '#78350f';
                const borderColor = isPCTT ? '#a7f3d0' : '#fde047';
                const bgColor = isPCTT ? '#f0fdf4' : '#fffdf5';
                
                return (
                  <div key={fund.name} style={{ 
                    border: `1.5px solid ${borderColor}`, 
                    backgroundColor: bgColor,
                    borderRadius: '12px', 
                    padding: '12px 14px', 
                    marginBottom: '16px' 
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: fundColor, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      {fund.name}
                    </span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Mức phải đóng (đ)
                        </label>
                        <input 
                          type="text"
                          value={input.expected}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                expected: formatInputNumber(e.target.value)
                              }
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.88rem',
                            fontWeight: '700'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Thực nộp (đ)
                        </label>
                        <input 
                          type="text"
                          value={input.actual}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                actual: formatInputNumber(e.target.value)
                              }
                            });
                          }}
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.88rem',
                            fontWeight: '700',
                            color: fundColor
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Ngày nộp
                        </label>
                        <input 
                          type="date"
                          value={input.date}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                date: e.target.value
                              }
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.82rem'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Note / Chú thích */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Ghi chú đóng góp
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú (Ví dụ: Miễn nộp do gia đình chính sách...)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.88rem',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-main)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Xác nhận lưu
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM NHÂN KHẨU MỚI VÀO HỘ */}
      {isAddMemberModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            border: '1px solid var(--border)'
          }}>
            {/* Header Modal */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                  ➕ Thêm nhân khẩu vào hộ
                </h3>
                <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
                  {addMemberTargetGroup?.headName ? `Hộ: ${addMemberTargetGroup.headName}` : `Hộ tại: ${addMemberTargetGroup?.address}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveNewMember} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Họ và tên nhân khẩu <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Ánh"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Giới tính
                  </label>
                  <select
                    value={newMemberGender}
                    onChange={(e) => setNewMemberGender(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border)',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    <option value="Nữ">Nữ (Tuổi LĐ: 18 - 58)</option>
                    <option value="Nam">Nam (Tuổi LĐ: 18 - 61)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Ngày / Năm sinh
                  </label>
                  <input
                    type="text"
                    value={newMemberDob}
                    onChange={(e) => setNewMemberDob(e.target.value)}
                    placeholder="DD/MM/YYYY hoặc 1995"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Địa chỉ hộ
                </label>
                <input
                  type="text"
                  disabled
                  value={addMemberTargetGroup?.address || ''}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Nghề nghiệp / Ghi chú (Nếu là Hưu trí / Bảo trợ)
                </label>
                <input
                  type="text"
                  value={newMemberNote}
                  onChange={(e) => setNewMemberNote(e.target.value)}
                  placeholder="Ghi 'Hưu trí', 'Tàn tật'... nếu thuộc diện miễn Quỹ Phường"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-main)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    backgroundColor: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Thêm vào hộ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        style={{ display: 'none' }}
        accept=".xlsx, .xls"
      />
    </div>
  );
};

export default WardFunds;
