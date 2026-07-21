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
  Database
} from 'lucide-react';
import { db, generateUUID, supabase } from '../services/db';
import { showToast } from '../utils/toast';
import type { WardFund, Resident, Household } from '../types';
import ExcelJS from 'exceljs';

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
    const hhHeadMap = new Map<string, string>(); // household_id -> headName
    const hhGroupMap = new Map<string, string>(); // household_id -> self_management_group

    households.forEach(h => {
      hhGroupMap.set(h.id, (h.self_management_group || '').trim());
      const head = residents.find(r => r.id === h.head_of_household_id);
      if (head) {
        hhHeadMap.set(h.id, head.full_name);
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
    const headIds = new Set<string>();
    households.forEach(h => {
      if (h.head_of_household_id) headIds.add(h.head_of_household_id);
    });
    const headNames = new Set<string>();
    residents.forEach(r => {
      if (headIds.has(r.id)) {
        headNames.add(r.full_name.trim().toLowerCase());
      }
    });
    return headNames;
  }, [households, residents]);

  // Bảng tra cứu: name+year → thông tin hộ khẩu, dùng để gom nhóm theo hộ gia đình
  const residentToHouseholdMap = useMemo(() => {
    const hhMap = new Map<string, Household>();
    households.forEach(h => hhMap.set(h.id, h));
    const headNameForHH = new Map<string, string>();
    households.forEach(h => {
      const head = residents.find(r => r.id === h.head_of_household_id);
      if (head) headNameForHH.set(h.id, head.full_name);
    });
    const map = new Map<string, { householdId: string; address: string; headName: string; groupName: string }>();
    residents.forEach(r => {
      const year = (r.dob || '').match(/\d{4}/)?.[0] || '';
      const nameKey = r.full_name.trim().toLowerCase();
      const hh = hhMap.get(r.household_id);
      const info = {
        householdId: r.household_id,
        address: hh?.address || '',
        headName: headNameForHH.get(r.household_id) || '',
        groupName: (hh as any)?.self_management_group || ''
      };
      map.set(nameKey + '__' + year, info);
      if (!map.has(nameKey + '__')) map.set(nameKey + '__', info);
    });
    return map;
  }, [residents, households]);

  // A fast O(1) helper function to find resident info by name and dob
  const findResidentGroupAndHead = (name: string, dob: string) => {
    const nameKey = name.trim().toLowerCase();
    const list = residentsInfoLookup.get(nameKey);
    if (!list || list.length === 0) return { group: '', headName: '', isHead: false };
    
    const cleanDob = dob.trim();
    if (cleanDob) {
      const matched = list.find(r => r.dob.includes(cleanDob) || cleanDob.includes(r.dob));
      if (matched) return matched;
      // Nếu có năm sinh nhưng không trùng khớp với bất kỳ ai có năm sinh đó trong DB,
      // thì không được tự ý khớp bừa với người khác trùng tên nhưng khác năm sinh.
      // Chỉ cho phép khớp nếu người trong DB không có năm sinh.
      const noDobMatch = list.find(r => !r.dob);
      if (noDobMatch) return noDobMatch;
      return { group: '', headName: '', isHead: false };
    }
    
    // Nếu bản ghi quỹ không có DOB, chỉ tự động khớp nếu trong DB chỉ có duy nhất 1 người trùng tên
    if (list.length === 1) return list[0];
    return { group: '', headName: '', isHead: false };
  };

  // Helper to resolve group/tổ of a fund record
  const getGroupOfFundRecord = (f: WardFund) => {
    // 1. Quét địa chỉ trước để lấy tổ/cụm thực tế ghi trên địa chỉ (độ ưu tiên cao nhất, tránh khớp sai DB)
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

  // Filtered List
  const filteredFunds = useMemo(() => {
    const list = funds.filter(f => {
      const matchesSearch = 
        f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.address && f.address.toLowerCase().includes(searchTerm.toLowerCase()));
      
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
        const fundGroup = getGroupOfFundRecord(f);
        if (fundGroup !== groupFilter) return false;
      }

      return true;
    });

    // Lọc chỉ giữ lại chủ hộ nếu ở Tab thu theo Hộ:
    // Dùng headNamesSet để đối chiếu trực tiếp thay vì dùng name+dob matching dễ thất bại
    let filteredByMode: WardFund[];
    if (subTabMode === 'household_list') {
      const seenNames = new Set<string>();
      filteredByMode = list.filter(f => {
        const nameKey = f.full_name.trim().toLowerCase();
        // Kiểm tra xem người này có phải chủ hộ theo CSDL không
        if (!headNamesSet.has(nameKey)) return false;
        // Chỉ giữ lại 1 bản ghi per chủ hộ (loại bỏ trùng lặp nếu 1 chủ hộ có nhiều entries)
        if (seenNames.has(nameKey)) return false;
        seenNames.add(nameKey);
        return true;
      });
    } else {
      filteredByMode = list;
    }

    // Sắp xếp thứ tự ưu tiên theo Cụm/Tổ đã cấu hình (Ví dụ: Tổ Việt Trung -> Tổ 4 -> Tổ 5...)
    return filteredByMode.sort((a, b) => {
      const grpA = getGroupOfFundRecord(a);
      const grpB = getGroupOfFundRecord(b);
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === grpA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === grpB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // Cùng Tổ thì xếp theo Tên tiếng Việt A-Z
      return a.full_name.localeCompare(b.full_name, 'vi');
    });
  }, [funds, searchTerm, filterStatus, activeFunds, groupFilter, subTabMode, residents, households, groups, headNamesSet]);

  // Danh sách gom theo hộ gia đình cho chế độ xem “Thu gom theo Hộ”
  const householdGroupedFunds = useMemo(() => {
    type HHGroup = { householdId: string; headName: string; address: string; groupName: string; members: WardFund[] };
    const groupMap = new Map<string, HHGroup>();
    filteredFunds.forEach(f => {
      const year = (f.dob || '').match(/\d{4}/)?.[0] || '';
      const nameKey = f.full_name.trim().toLowerCase();
      const hhInfo = residentToHouseholdMap.get(nameKey + '__' + year)
                  || residentToHouseholdMap.get(nameKey + '__')
                  || null;
      const householdId = hhInfo?.householdId || ('addr__' + (f.address || '').trim().toLowerCase());
      const address = hhInfo?.address || f.address || '';
      const headName = hhInfo?.headName || '';
      const groupName = hhInfo?.groupName || getGroupOfFundRecord(f);
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
  }, [filteredFunds, residentToHouseholdMap, headNamesSet, groups]);

  // Calculate Statistics dynamically
  const fundStats = activeFunds.map(fund => {
    const expected = funds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.expected || 0), 0);
    const actual = funds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
    const percent = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    const remaining = expected - actual;
    return {
      name: fund.name,
      expected,
      actual,
      percent,
      remaining
    };
  });

  // Open Edit Modal
  const handleOpenPay = (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    setEditingRecord(record);
    setFullNameInput(record.full_name);
    setDobInput(record.dob || '');
    setAddressInput(record.address || '');
    setNote(record.note || '');

    // Khởi tạo các ô nhập tiền động cho các quỹ
    const inputs: Record<string, { expected: string; actual: string; date: string }> = {};
    activeFunds.forEach(fund => {
      const contrib = record.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
      inputs[fund.name] = {
        expected: contrib.expected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
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
        newContributions[fund.name] = {
          expected: existing.expected,
          actual: isCurrentlyPaid ? 0 : existing.expected, // Nếu đã đóng đủ thì hủy đóng, ngược lại đóng đủ
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

  // Thu nhanh toàn bộ thành viên của 1 hộ gia đình cùng 1 lần
  const handleQuickPayHousehold = async (members: WardFund[]) => {
    if (isGuest) { showToast('Khách không có quyền sửa!', 'warning'); return; }
    try {
      const allPaid = members.every(m =>
        activeFunds.every(fund => {
          const c = m.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          return c.actual >= c.expected && c.expected > 0;
        })
      );
      const today = new Date().toISOString().slice(0, 10);
      await Promise.all(members.map(async m => {
        const newC: Record<string, any> = { ...m.contributions };
        activeFunds.forEach(fund => {
          const c = m.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          newC[fund.name] = { expected: c.expected, actual: allPaid ? 0 : (c.expected || c.actual), date: allPaid ? '' : today };
        });
        await db.saveWardFund({ ...m, contributions: newC, note: allPaid ? '' : 'Đã nộp đủ đợt tập trung' });
      }));
      showToast(allPaid ? `Đã hủy ghi nhận thu của ${members.length} người` : `✅ Đã thu đủ ${members.length} người trong hộ!`, 'success');
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

  // Auto-initialize Ward Funds from Resident List based on age & policy exemptions
  const handleAutoInitFromResidents = async () => {
    if (isGuest) {
      showToast('Bạn không có quyền khởi tạo dữ liệu đóng quỹ!', 'warning');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn TỰ ĐỘNG KHỞI TẠO danh sách thu quỹ Phường năm ${selectedYear} từ dữ liệu Nhân khẩu không?\n` +
      `Lưu ý: Hệ thống sẽ tự động lọc độ tuổi lao động, loại trừ người cao tuổi, trẻ em, hộ nghèo, cận nghèo, gia đình chính sách và người hưởng lương hưu theo quy định của pháp luật.`)) {
      
      setIsLoading(true);
      try {
        // 1. Lấy danh sách nhân khẩu và hộ khẩu
        const resList = await db.getResidents();
        const hhList = await db.getHouseholds();

        // 2. Lấy danh sách chỉ tiêu quỹ hiện tại
        const activeFundsList = (db as any).getWardFundList();
        if (activeFundsList.length === 0) {
          showToast('Vui lòng cấu hình danh mục Quỹ Phường trước khi khởi tạo!', 'warning');
          setIsLoading(false);
          return;
        }

        const batchFunds: WardFund[] = [];
        let successCount = 0;

        // Định nghĩa các từ khóa nghề nghiệp/ghi chú của người về hưu hoặc hưởng lương hưu
        const pensionKeywords = ['hưu', 'hưu trí', 'lương hưu', 'mất sức', 'tàn tật', 'khuyết tật', 'trợ cấp xã hội', 'chế độ hưu'];

        resList.forEach(r => {
          // A. Bỏ qua nếu nhân khẩu đã mất
          if (r.status === 'deceased') return;

          // B. Lấy thông tin hộ khẩu
          const hh = hhList.find(h => h.id === r.household_id);
          const isPolicyHousehold = hh && (hh.policy_type === 'poor' || hh.policy_type === 'near_poor' || hh.policy_type === 'policy_family');

          // C. Tính tuổi của nhân khẩu trong năm selectedYear
          if (!r.dob) return;
          const dobYear = new Date(r.dob).getFullYear();
          if (isNaN(dobYear)) return;
          const age = selectedYear - dobYear;

          // D. Tính toán mức đóng góp của từng quỹ dựa trên quy định pháp luật
          const contributions: Record<string, any> = {};
          let shouldAdd = false;

          activeFundsList.forEach((fund: { name: string; target: number }) => {
            const isPCTT = fund.name.toLowerCase().includes('thiên tai');
            const isDOdn = fund.name.toLowerCase().includes('đền ơn đáp nghĩa') || fund.name.toLowerCase().includes('đền ơn');
            
            // Mặc định miễn đóng
            let expected = 0;

            // Kiểm tra miễn đóng theo luật Việt Nam:
            // 1. Hộ nghèo, cận nghèo, gia đình chính sách được miễn toàn bộ
            if (isPolicyHousehold) {
              expected = 0;
            } else {
              // 2. Kiểm tra nghề nghiệp/ghi chú về hưu
              const occLower = (r.occupation || '').toLowerCase();
              const notesLower = (r.notes || '').toLowerCase();
              const isPensioner = pensionKeywords.some(key => occLower.includes(key) || notesLower.includes(key));

              if (isPensioner) {
                // Người hưởng lương hưu được miễn Quỹ Thiên tai và Đền ơn đáp nghĩa
                expected = 0;
              } else {
                if (isPCTT) {
                  // Quỹ Thiên tai: Nam 18-61, Nữ 18-58 trong độ tuổi lao động
                  const isMaleInAge = r.gender === 'male' && age >= 18 && age <= 61;
                  const isFemaleInAge = r.gender === 'female' && age >= 18 && age <= 58;
                  if (isMaleInAge || isFemaleInAge) {
                    expected = fund.target;
                    shouldAdd = true;
                  }
                } else if (isDOdn) {
                  // Quỹ Đền ơn đáp nghĩa: Người trong độ tuổi lao động Nam 18-61, Nữ 18-58
                  const isMaleInAge = r.gender === 'male' && age >= 18 && age <= 61;
                  const isFemaleInAge = r.gender === 'female' && age >= 18 && age <= 58;
                  if (isMaleInAge || isFemaleInAge) {
                    expected = fund.target;
                    shouldAdd = true;
                  }
                } else {
                  // Các quỹ khác: Tự động phân biệt thu theo Hộ (chỉ Chủ hộ nộp) hoặc thu theo Đầu người
                  const isHouseholdScope = (fund as any).scope === 'household' || fund.name.toLowerCase().includes('hộ') || fund.name.toLowerCase().includes('người cao tuổi') || fund.name.toLowerCase().includes('cao tuổi');
                  if (isHouseholdScope) {
                    if (r.is_head && age >= 18) {
                      expected = fund.target;
                      shouldAdd = true;
                    }
                  } else {
                    if (age >= 18) {
                      expected = fund.target;
                      shouldAdd = true;
                    }
                  }
                }
              }
            }

            contributions[fund.name] = {
              expected,
              actual: 0
            };
          });

          // Nếu có ít nhất một quỹ phải đóng > 0, đưa vào danh sách
          const hasExpectedValue = Object.values(contributions).some((c: any) => c.expected > 0);
          if (hasExpectedValue) {
            batchFunds.push({
              id: generateUUID(),
              year: selectedYear,
              full_name: r.full_name.trim(),
              dob: r.dob ? r.dob.slice(0, 4) : undefined, // chỉ lấy năm sinh
              address: hh ? hh.address : undefined,
              user_id: r.user_id, // Gán trực tiếp cho TDP quản lý nhân khẩu này
              contributions
            });
            successCount++;
          }
        });

        if (batchFunds.length === 0) {
          showToast('Không có nhân khẩu nào đủ điều kiện đóng quỹ Phường theo quy định!', 'info');
        } else {
          // Lưu hàng loạt vào bảng ward_funds
          await db.saveWardFundsBatch(batchFunds);
          showToast(`Khởi tạo thành công! Đã thêm ${successCount} nhân khẩu thuộc diện phải đóng quỹ năm ${selectedYear}.`, 'success');
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

        worksheet.eachRow((row, rowNum) => {
          // Bỏ quan dòng tiêu đề và header
          if (rowNum < 4) return;

          const name = row.getCell(2).value?.toString() || '';
          const dobVal = row.getCell(3).value?.toString() || '';
          const addr = row.getCell(4).value?.toString() || '';

          // Bỏ qua dòng trống không có tên
          if (!name.trim()) return;

          // Phân loại dòng này thuộc về Tổ dân phố nào
          let matchedTdpId: string | undefined = undefined;
          if (tdpProfiles.length > 0) {
            // 1. Ưu tiên đối chiếu với danh sách nhân khẩu đã tải để tìm TDP
            const matchedResident = residents.find(r => 
              r.full_name.trim().toLowerCase() === name.trim().toLowerCase() &&
              (dobVal ? (r.dob && r.dob.includes(dobVal)) : true)
            );
            if (matchedResident && matchedResident.user_id) {
              matchedTdpId = matchedResident.user_id;
            } else {
              // 2. Nếu không khớp nhân khẩu, đối chiếu từ khóa địa chỉ với tên của TDP
              const addrLower = addr.toLowerCase();
              const matched = tdpProfiles.find(p => {
                const nameLower = (p.tdp_name || '').toLowerCase();
                if (nameLower && addrLower.includes(nameLower)) return true;
                const numMatch = nameLower.match(/\d+/);
                if (numMatch) {
                  const num = numMatch[0];
                  if (addrLower.includes(`tổ ${num}`) || addrLower.includes(`tổ: ${num}`) || addrLower.includes(`tổ tự quản ${num}`)) {
                    return true;
                  }
                }
                return false;
              });
              if (matched) {
                matchedTdpId = matched.id;
              }
            }
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
            dob: dobVal ? dobVal.trim() : undefined,
            address: addr ? addr.trim() : undefined,
            user_id: matchedTdpId, // Tự động gán cho TDP tương ứng
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
      const worksheet = workbook.addWorksheet(`Bao_Cao_Thu_Quy_${selectedYear}`);

      const totalCols = 5 + activeFunds.length * 3 + 1; // 5 cột cá nhân + 3 cột/quỹ + 1 ghi chú

      // Title block
      worksheet.getCell('A1').value = `BÁO CÁO THU QUỸ ỦY THÁC TỪ PHƯỜNG NĂM ${selectedYear}`;
      worksheet.getCell('A1').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF15803D' } };
      
      const lastColLetter = worksheet.getColumn(totalCols).letter;
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getRow(1).height = 30;

      worksheet.getCell('A2').value = `Tổ dân phố: ${localStorage.getItem('tdp_name') || 'Quảng Giao'} - Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
      worksheet.getCell('A2').font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF475569' } };
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getRow(2).height = 20;

      // Group Headers
      worksheet.getCell('A3').value = 'Thông tin cá nhân';
      worksheet.mergeCells('A3:E3');
      
      let currentColNum = 6;
      activeFunds.forEach(fund => {
        const startCellStr = worksheet.getColumn(currentColNum).letter + '3';
        const endCellStr = worksheet.getColumn(currentColNum + 2).letter + '3';
        worksheet.getCell(startCellStr).value = fund.name;
        worksheet.mergeCells(`${startCellStr}:${endCellStr}`);
        currentColNum += 3;
      });
      
      const noteCellStr = worksheet.getColumn(currentColNum).letter + '3';
      worksheet.getCell(noteCellStr).value = 'Ghi chú';

      const groupRow = worksheet.getRow(3);
      groupRow.height = 25;
      groupRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E40AF' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Sub Headers
      const subHeaders = ['STT', 'Họ và tên', 'Năm sinh', 'Cụm / Tổ', 'Địa chỉ'];
      activeFunds.forEach(() => {
        subHeaders.push('Phải nộp (đ)', 'Thực nộp (đ)', 'Ngày nộp');
      });
      subHeaders.push('Chú thích');
      
      const subHeaderRow = worksheet.addRow(subHeaders);
      subHeaderRow.height = 24;
      subHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF3B82F6' } }
        };
      });

      // Sắp xếp danh sách theo Cụm / Tổ trước khi ghi vào Excel
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

      let currentGroup = '';
      let sttCounter = 0;

      sortedFunds.forEach((f) => {
        const groupName = getGroupOfFundRecord(f) || '';

        // Tạo dòng tiêu đề cụm/tổ khi chuyển nhóm
        if (groupName !== currentGroup) {
          currentGroup = groupName;
          const groupLabel = groupName ? `TỔ/CỤM: ${groupName.toUpperCase()}` : 'CHƯA PHÂN NHÓM';
          const groupHeaderRow = worksheet.addRow([groupLabel]);
          groupHeaderRow.height = 22;
          worksheet.mergeCells(`A${groupHeaderRow.number}:${String.fromCharCode(64 + totalCols)}${groupHeaderRow.number}`);
          groupHeaderRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
          groupHeaderRow.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' } // Màu xanh Navy
          };
          groupHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        }

        const tdpNameStored = localStorage.getItem('tdp_name') || '';
        let displayAddress = f.address || '';
        
        // Loại bỏ phần Tổ/Cụm trùng lặp khỏi địa chỉ
        if (groupName) {
          // Xóa "Tổ X" hoặc "Cụm X" cụ thể của nhóm hiện tại
          const cleanGroup = groupName.replace(/^(tổ|cụm)\s*/gi, '').trim();
          const groupRegex = new RegExp(`\\b(tổ|cụm)?\\s*${cleanGroup}\\b`, 'gi');
          displayAddress = displayAddress.replace(groupRegex, '');
        }
        
        // Loại bỏ bất kỳ cụm từ "Tổ/Cụm [số]" nào khác để tránh lộn xộn, mâu thuẫn thông tin trên cùng một dòng
        displayAddress = displayAddress.replace(/\b(tổ|cụm|tổ tự quản|cụm tự quản)\s*\d+\b/gi, '');
        
        // Làm sạch các ký tự phân cách thừa (phẩy, gạch ngang, khoảng trắng) ở đầu/cuối và ở giữa
        displayAddress = displayAddress
          .replace(/^[-\s,·•/]+/g, '')
          .replace(/[-\s,·•/]+$/g, '')
          .replace(/\s*,\s*,+/g, ',')
          .trim();

        // Ghép thêm tên Tổ dân phố từ cài đặt nếu chưa có
        if (tdpNameStored && !displayAddress.toLowerCase().includes(tdpNameStored.toLowerCase())) {
          if (displayAddress) {
            displayAddress = `${displayAddress}, ${tdpNameStored}`;
          } else {
            displayAddress = tdpNameStored;
          }
        }
        
        // Dọn dẹp dấu phẩy hoặc gạch thừa một lần nữa
        displayAddress = displayAddress
          .replace(/^[-\s,·•]+/g, '')
          .replace(/[-\s,·•]+$/g, '')
          .trim();

        const rowData: any[] = [
          sttCounter,
          f.full_name,
          f.dob || '',
          groupName || '-',
          displayAddress
        ];
        
        activeFunds.forEach(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          const expectedVal = contrib.expected || fund.target;
          const actualVal = contrib.actual > 0 ? contrib.actual : '';
          rowData.push(
            expectedVal,
            actualVal,
            contrib.actual > 0 && contrib.date ? new Date(contrib.date).toLocaleDateString('vi-VN') : ''
          );
        });
        
        const isAllPaid = activeFunds.every(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          return contrib.actual >= contrib.expected && contrib.expected > 0;
        });
        const displayNote = (!isAllPaid && f.note === 'Đã nộp đủ đợt tập trung') ? '' : (f.note || '');
        rowData.push(displayNote);
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;

        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // STT
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; // Họ tên
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }; // Năm sinh
        dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }; // Cụm/Tổ
        dataRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' }; // Địa chỉ

        let cNum = 6;
        activeFunds.forEach(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          const expectedVal = contrib.expected || fund.target;
          
          dataRow.getCell(cNum).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(cNum).numFmt = '#,##0';
          
          dataRow.getCell(cNum + 1).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(cNum + 1).numFmt = '#,##0';
          
          dataRow.getCell(cNum + 2).alignment = { horizontal: 'center', vertical: 'middle' };

          if (contrib.actual >= expectedVal && expectedVal > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FF16A34A' }, bold: true };
          } else if (contrib.actual > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FFD97706' }, bold: true };
          } else if (expectedVal > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FFDC2626' } };
          }
          
          cNum += 3;
        });

        dataRow.getCell(cNum).alignment = { horizontal: 'left', vertical: 'middle' }; // Ghi chú
      });

      // Total Row
      const totalRowIndex = worksheet.rowCount + 1;
      const totalRowCells: any[] = ['Tổng cộng', '', '', '', ''];
      
      activeFunds.forEach(fund => {
        const totalExp = filteredFunds.reduce((sum, f) => {
          const contrib = f.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          return sum + (contrib.expected || fund.target);
        }, 0);
        const totalAcu = filteredFunds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
        totalRowCells.push(totalExp, totalAcu, '');
      });
      totalRowCells.push('');
      
      const totalRow = worksheet.addRow(totalRowCells);
      totalRow.height = 24;
      worksheet.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
      
      totalRow.getCell(1).font = { bold: true, name: 'Segoe UI' };
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
      worksheet.eachRow((row, rowNum) => {
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
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 6;      // STT
        else if (idx === 1) col.width = 25;  // Họ tên
        else if (idx === 2) col.width = 12;  // Năm sinh
        else if (idx === 3) col.width = 16;  // Cụm/Tổ
        else if (idx === 4) col.width = 25;  // Địa chỉ
        else if (idx < currentColNum - 1) {
          const mod = (idx - 5) % 3;
          if (mod === 2) col.width = 14;     // Ngày nộp
          else col.width = 15;               // Expected / Actual
        } else col.width = 20;               // Ghi chú
      });

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
      const amountPaid = contrib.actual || 0;
      wardTotal += amountPaid;
      const note = contrib.date 
        ? new Date(contrib.date).toLocaleDateString('vi-VN') 
        : '—';
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold; text-align: left;">[Quỹ Phường] ${fund.name} (${selectedYear})</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(amountPaid)} đ</td>
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
        const amountPaid = fundRec ? fundRec.amount : 0;
        tdpTotal += amountPaid;
        const note = fundRec?.paid_at ? new Date(fundRec.paid_at).toLocaleDateString('vi-VN') : '—';
        tdpRows.push(`
          <tr>
            <td style="text-align: center;">${wardRows.length + idx + 1}</td>
            <td style="font-weight: bold; text-align: left;">[Quỹ TDP] ${tf.name} (${selectedYear})</td>
            <td style="text-align: right; font-weight: bold;">${formatCurrency(amountPaid)} đ</td>
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

        <div style="font-size: 9.5pt; font-style: italic; margin-bottom: 4px; margin-top: 2px; text-align: left;">
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
            <td style="width: 20%;">Thủ trưởng đơn vị</td>
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

    const receiptHtml = generateWardStateReceiptHtml(item, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);

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
              height: 100%;
              overflow: hidden;
            }
            .receipt-container {
              max-height: 275mm !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.3;
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
        </style>
      </head>
      <body>
        ${receiptHtml}
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
            margin-bottom: 8px !important;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 4px 0 !important;
            font-size: 10.5pt !important;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px !important;
            margin-bottom: 8px !important;
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
            margin-top: 15px !important;
            page-break-inside: avoid !important;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 10pt !important;
            vertical-align: top;
            padding: 4px !important;
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
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
    } catch { /* ignore */ }

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

          <div class="section-heading">QUỸ PHƯỜNG THU (Các công quỹ pháp lệnh của nhà nước gồm)</div>
          <ol style="margin-top: 2px; margin-bottom: 4px; padding-left: 18px; font-size: 10.5pt;">
            ${wardListHtml}
          </ol>
          <div style="font-size: 10.5pt; font-weight: bold; margin-bottom: 6px; padding-left: 18px; color: #1e40af;">
            ➔ Tổng Quỹ Phường dự kiến: ${wardSummaryStr}
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; font-size: 10.5pt;">
            <p style="margin: 0 0 3px 0;"><b>1. Quỹ Tổ dân phố dự kiến:</b> <strong>${totalTdpNum > 0 ? totalTdpNum.toLocaleString('vi-VN') + ' đồng/hộ/năm' : '.... đồng/hộ/năm'}</strong></p>
            <p style="margin: 0 0 3px 0;"><b>2. Quỹ Phường thu theo quy định:</b> <strong>${wardSummaryStr}</strong></p>
            <p style="margin: 3px 0 0 0; font-size: 11pt; color: #b91c1c;"><b>👉 TỔNG CỘNG DỰ KIẾN (QUỸ TĐP + QUỸ PHƯỜNG):</b> <strong>${(totalTdpNum + wardHouseholdTotal).toLocaleString('vi-VN')} đồng/hộ/năm</strong> ${wardPersonTotal > 0 ? ` + <strong>${wardPersonTotal.toLocaleString('vi-VN')}đ / 1 khẩu lao động</strong>` : ''}</p>
          </div>

          <p style="margin-bottom: 4px; text-indent: 20px;">Các khoản trên là mức dự kiến để Nhân dân nghiên cứu, tham gia ý kiến và thống nhất thực hiện on tinh thần tự nguyện, dân chủ, công khai, minh bạch.</p>
          <p style="margin-bottom: 6px; text-indent: 20px;">Mọi ý kiến góp ý đề nghị gửi về Ban cán sự Tổ dân phố trước ngày ..... tháng ..... năm ${selectedYear}.</p>
          <p style="margin-bottom: 6px;">Trân trọng thông báo!</p>

          <table class="footer-table">
            <tr>
              <td style="width: 45%;"></td>
              <td style="width: 55%;">
                <div style="font-style: italic; margin-bottom: 3px; font-size: 10.5pt;">Nam Sầm Sơn, ngày ..... tháng ..... năm ${selectedYear}</div>
                <div style="font-weight: bold; font-size: 11.5pt;">TỔ TRƯỜNG TỔ DÂN PHỐ</div>
                <div style="font-style: italic; font-size: 10pt; margin-bottom: 30px;">(Ký, ghi rõ họ tên)</div>
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
          .btn-reset { background: #f59e0b; color: white; }
          .btn-close { background: #ef4444; color: white; }
          
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
          <button class="toolbar-btn btn-reset" id="btnReset">🔄 Khôi phục</button>
          <button class="toolbar-btn btn-print" onclick="window.print()">🖨️ In ngay</button>
          <button class="toolbar-btn btn-close" onclick="window.close()">✖️ Đóng</button>
        </div>
        <div class="editor-area" contenteditable="true" spellcheck="false">
          ${editorContentHtml}
        </div>

        <script>
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

          // Khôi phục mặc định
          const btnReset = document.getElementById('btnReset');
          btnReset.addEventListener('click', function() {
            if (confirm('Bạn có chắc chắn muốn khôi phục về mẫu thông báo mặc định không? Mọi chỉnh sửa đã lưu trước đó sẽ bị xóa.')) {
              localStorage.removeItem('notice_template_html_${selectedYear}');
              localStorage.removeItem('notice_template_fontsize_${selectedYear}');
              window.location.reload();
            }
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
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '850', color: '#1e293b' }}>
                    {formatCurrency(stat.actual)}
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
                <span>Phải thu: {formatCurrency(stat.expected)}</span>
                <span style={{ color: stat.remaining > 0 ? '#ef4444' : '#10b981' }}>
                  Còn thiếu: {formatCurrency(stat.remaining)}
                </span>
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
            <input
              type="text"
              placeholder="Tìm theo tên người dân, địa chỉ..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="premium-input-3d"
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
                      <Users size={14} /> Khởi tạo từ Nhân khẩu
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
                      <Printer size={14} /> In loạt phiếu A5
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
              ) : householdGroupedFunds.map(group => {
                const totalExpected = group.members.reduce((sum, m) =>
                  sum + activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) =>
                    s + (m.contributions?.[fund.name]?.expected || 0), 0), 0);
                const totalActual = group.members.reduce((sum, m) =>
                  sum + activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) =>
                    s + (m.contributions?.[fund.name]?.actual || 0), 0), 0);
                const allPaid = totalActual >= totalExpected && totalExpected > 0;
                const hasPartial = totalActual > 0 && totalActual < totalExpected;
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
                        {!isGuest && (
                          <button type="button" onClick={() => handleQuickPayHousehold(group.members)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: allPaid ? '#e2e8f0' : '#10b981', color: allPaid ? '#64748b' : 'white', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', boxShadow: allPaid ? 'none' : '0 2px 4px rgba(16,185,129,0.3)' }}>
                            {allPaid ? '↩ Hủy' : '✓ Thu đủ cả nhà'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Danh sách thành viên */}
                    {group.members.map((member, idx) => {
                      const mExp = activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) => s + (member.contributions?.[fund.name]?.expected || 0), 0);
                      const mAct = activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').reduce((s, fund) => s + (member.contributions?.[fund.name]?.actual || 0), 0);
                      const mPaid = mAct >= mExp && mExp > 0;
                      const isHead = headNamesSet.has(member.full_name.trim().toLowerCase());
                      return (
                        <div key={member.id} style={{ padding: '9px 16px', borderBottom: idx < group.members.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: mPaid ? '#f0fdf4' : 'white' }}>
                          <span style={{ color: '#94a3b8', fontWeight: '600', width: '22px', textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                          <div style={{ minWidth: '180px', flex: '1' }}>
                            <span style={{ fontWeight: isHead ? '800' : '600', fontSize: '0.88rem' }}>{isHead ? '👑 ' : ''}{member.full_name}</span>
                            {member.dob && <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '5px' }}>({member.dob})</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: '2' }}>
                            {activeFunds.filter((f: any) => !f.scope || f.scope !== 'household').map(fund => {
                              const c = member.contributions?.[fund.name] || { expected: 0, actual: 0 };
                              const paid = c.actual >= c.expected && c.expected > 0;
                              return (
                                <span key={fund.name} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', background: c.expected === 0 ? '#f1f5f9' : paid ? '#dcfce7' : '#fee2e2', color: c.expected === 0 ? '#94a3b8' : paid ? '#166534' : '#991b1b', whiteSpace: 'nowrap' }}>
                                  {fund.name.split(' ').slice(-2).join(' ')}: {c.expected === 0 ? 'Miễn' : `${c.actual.toLocaleString('vi-VN')}/${c.expected.toLocaleString('vi-VN')}đ`}
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
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
                    {filteredFunds.map((item, idx) => {
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
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>{item.dob || '—'}</td>
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
                                  onClick={() => handlePrintIndividualReceipt_Ward(item)}
                                  title="In phiếu thu"
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
                  Hộ/Cá nhân: {editingRecord.full_name} {editingRecord.dob ? `(${editingRecord.dob})` : ''}
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

    </div>
  );
};

export default WardFunds;
