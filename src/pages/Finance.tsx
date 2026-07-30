import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download,
  Calendar,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Printer,
  MapPin,
  Filter,
  Check,
  BookOpen,
  Users,
  HeartHandshake
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import { calculateExactAge, formatDateVN, autoFormatDateInput } from '../utils/dateUtils';
import { calculateHouseholdFinancialSummary, generateUnifiedHouseholdReceiptHtml, applyWardFundPrefixToHtml, docSoTien } from '../utils/financialEngine';
import type { FinancialRecord, Household, Resident, HouseholdFund, WardFund } from '../types';
import ExcelJS from 'exceljs';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

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

const Finance = () => {
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

  const userRole = localStorage.getItem('user_role') || '';
  const currentActionRole = localStorage.getItem('current_role') || userRole;
  // Cấu hình tạm ẩn Thu chi TDP đối với vai trò Tổ Trưởng (Đổi thành false nếu muốn mở lại)
  const HIDE_FINANCE_FOR_TO_TRUONG = false;

  if (HIDE_FINANCE_FOR_TO_TRUONG && (currentActionRole === 'to_truong' || userRole === 'to_truong')) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Quyền truy cập bị hạn chế</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            Tính năng <strong>Quản lý Thu chi TDP</strong> đang tạm ẩn đối với vai trò Tổ trưởng dân phố.
          </p>
        </div>
      </div>
    );
  }

  const isAdminOrToTruong = currentActionRole === 'to_truong' || currentActionRole === 'admin' || userRole === 'to_truong' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'ward_admin';

  if (!isAdminOrToTruong) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Quyền truy cập bị hạn chế</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            Chỉ có <strong>Tổ trưởng dân phố</strong> và <strong>Quản trị hệ thống (Admin)</strong> mới được phép truy cập Quản lý Thu chi TDP.<br />
            Tất cả các vai trò khác không có quyền truy cập phần này.
          </p>
        </div>
      </div>
    );
  }
  const isWardUser = userRole === 'ward_admin' || userRole === 'super_admin';
  const isKeToan = currentRole === 'ke_toan' || userRole === 'ke_toan';
  const isThuQuy = currentRole === 'thu_quy' || userRole === 'thu_quy';
  const isTrangChuDemo = currentRole === 'demo' || currentRole === 'trang_chu' || userRole === 'demo';
  const isToTruongOrAdmin = currentRole === 'to_truong' || currentRole === 'admin' || userRole === 'to_truong' || userRole === 'admin';
  const isGuest = localStorage.getItem('guest_mode') === 'true' || isThuQuy || 
                  (!isToTruongOrAdmin && !isKeToan && currentRole !== 'chung' && currentRole !== 'all' && currentRole !== 'can_bo_chung') ||
                  isWardUser;
  const isCanBoChung = isToTruongOrAdmin || isKeToan || currentRole === 'chung' || currentRole === 'all' || currentRole === 'can_bo_chung';
  const canPrintExport = !isThuQuy && (isCanBoChung || isKeToan || isToTruongOrAdmin) && localStorage.getItem('guest_mode') !== 'true';
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);
  const [recordedByFilter, setRecordedByFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [printModalRecord, setPrintModalRecord] = useState<FinancialRecord | null>(null);

  const officialsConfig = useMemo(() => {
    const tdpName = localStorage.getItem('tdp_name') || localStorage.getItem('unit_name') || 'TỔ DÂN PHỐ QUẢNG GIAO';
    const wardName = localStorage.getItem('ward_name') || 'Phường Quảng Giao';
    const leaderName = localStorage.getItem('leader_name') || '';

    let sigs: any[] = [];
    try {
      sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
    } catch { sigs = []; }

    const getOfficial = (id: string, defaultName = '', defaultTitle = '') => {
      const found = sigs.find((s: any) => s.id === id);
      return {
        name: found?.name?.trim() || defaultName,
        title: found?.title?.trim() || defaultTitle,
        signatureUrl: found?.signatureUrl?.trim() || ''
      };
    };

    return {
      tdpName,
      wardName,
      toTruong: getOfficial('to_truong', leaderName || 'Nguyễn Kim Tuyến', 'Tổ trưởng dân phố'),
      thuQuy: getOfficial('thu_quy', '', 'Thủ quỹ'),
      keToan: getOfficial('ke_toan', '', 'Kế toán trưởng')
    };
  }, []);

  // Form states
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [recordedBy, setRecordedBy] = useState(localStorage.getItem('user_full_name') || 'Nguyễn Kim Tuyến');
  const [payer, setPayer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [formItems, setFormItems] = useState<Array<{ id: string; name: string; amount: string }>>([]);

  // Phân hệ Quản lý đóng quỹ mới bổ sung
  const [subTab, setSubTab] = useState<'ledger' | 'funds'>('ledger');

  useEffect(() => {
    if (isTrangChuDemo && subTab === 'funds') {
      setSubTab('ledger');
    }
  }, [isTrangChuDemo, subTab]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [householdFunds, setHouseholdFunds] = useState<HouseholdFund[]>([]);
  const [fundYear, setFundYear] = useState<number>(new Date().getFullYear());
  const [fundSearchInput, setFundSearchInput] = useState('');
  const fundSearchTerm = useDeferredValue(fundSearchInput);
  const [fundFilterStatus, setFundFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [fundGroupFilter, setFundGroupFilter] = useState<string>('all');
  const [tdpList, setTdpList] = useState<any[]>([]);
  const [tdpMap, setTdpMap] = useState<Record<string, string>>({});
  const [tdpFilter, setTdpFilter] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('tdp_groups_config');
    return saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  });

  // Form đóng quỹ hộ dân
  const [editingFund, setEditingFund] = useState<{ householdId: string, fundName: string } | null>(null);
  const [fundAmountInput, setFundAmountInput] = useState<string>('');
  const [fundNoteInput, setFundNoteInput] = useState<string>('');
  const [fundDateInput, setFundDateInput] = useState<string>(new Date().toISOString().slice(0, 10));

  const [fundNames, setFundNames] = useState<string[]>([]);
  const [fundList, setFundList] = useState<{ name: string; target: number }[]>([]);

  // Lazy rendering state to prevent DOM bloating and typing lag
  const [visibleCount, setVisibleCount] = useState(150);

  useEffect(() => {
    setVisibleCount(150);
  }, [fundSearchTerm, fundFilterStatus, fundGroupFilter, tdpFilter, subTab]);

  useEffect(() => {
    const loadFunds = () => {
      const list = db.getFundList();
      setFundNames(list.map(f => f.name));
      setFundList(list);
    };
    loadFunds();
    window.addEventListener('fund-targets-changed', loadFunds);
    return () => {
      window.removeEventListener('fund-targets-changed', loadFunds);
    };
  }, []);

  // 0. Tối ưu hóa hiệu năng: Tạo Map tra cứu nhanh tên chủ hộ của từng hộ gia đình
  const headNameMap = useMemo(() => {
    const resMap = new Map<string, Resident>();
    residents.forEach(r => resMap.set(r.id, r));
    
    const map = new Map<string, string>();
    households.forEach(hh => {
      if (hh.head_of_household_id) {
        const head = resMap.get(hh.head_of_household_id);
        if (head) {
          map.set(hh.id, head.full_name);
        }
      }
    });
    return map;
  }, [residents, households]);

  const getHouseholdHeadName = (hh: Household) => {
    return headNameMap.get(hh.id) || 'Hộ số: ' + hh.household_number;
  };

  const handleOpenFundPay = (hhId: string, fundName: string) => {
    if (isGuest || isKeToan) {
      showToast(isKeToan ? 'Vai trò Kế toán chỉ có quyền xem dữ liệu thu quỹ hộ dân, không được chỉnh sửa!' : 'Khách không có quyền sửa đổi dữ liệu thu quỹ!', 'warning');
      return;
    }
    const existing = householdFunds.find(f => f.household_id === hhId && f.fund_name === fundName && f.year === fundYear);
    setEditingFund({ householdId: hhId, fundName });
    setFundAmountInput(existing ? formatInputNumber(existing.amount.toString()) : '');
    setFundNoteInput(existing ? existing.note || '' : '');
    setFundDateInput(existing ? existing.paid_at || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFund) return;
    if (isKeToan) {
      showToast('Vai trò Kế toán chỉ có quyền xem dữ liệu thu quỹ hộ dân, không được chỉnh sửa!', 'warning');
      return;
    }
    const parsedAmount = parseInt(fundAmountInput.replace(/\./g, ''));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showToast('Số tiền không hợp lệ!', 'warning');
      return;
    }

    try {
      const existing = householdFunds.find(f => f.household_id === editingFund.householdId && f.fund_name === editingFund.fundName && f.year === fundYear);
      const targetId = existing ? existing.id : generateUUID();
      const payload: HouseholdFund = {
        id: targetId,
        household_id: editingFund.householdId,
        year: fundYear,
        fund_name: editingFund.fundName,
        amount: parsedAmount,
        paid_at: fundDateInput,
        note: fundNoteInput
      };

      await db.saveHouseholdFund(payload);
      showToast('Ghi nhận đóng quỹ thành công!', 'success');
      setEditingFund(null);
      
      // Đồng bộ sang sổ quỹ chung tự động để thay đổi trực quan số dư
      const hh = households.find(h => h.id === editingFund.householdId);
      const headName = hh ? getHouseholdHeadName(hh) : '';
      const flagText = `[QUY_${targetId}]`;
      const matchedGeneral = records.find(r => r.description.includes(flagText));

      if (parsedAmount > 0) {
        const generalRecord: FinancialRecord = {
          id: matchedGeneral ? matchedGeneral.id : generateUUID(),
          group_id: db.getGroupId(),
          type: 'income',
          amount: parsedAmount,
          category: editingFund.fundName,
          description: `Thu ${editingFund.fundName} - Hộ ${headName} ${flagText}`,
          recorded_by: 'Hệ thống tự động',
          date: fundDateInput,
          created_at: matchedGeneral ? matchedGeneral.created_at : new Date().toISOString()
        };
        await db.saveFinancialRecord(generalRecord);
      } else {
        // Nếu số tiền bằng 0 và đã có bản ghi trong sổ quỹ chung trước đó -> Tiến hành xóa
        if (matchedGeneral) {
          await db.deleteFinancialRecord(matchedGeneral.id);
        }
        await db.deleteHouseholdFund(targetId);
      }

      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (err) {
      showToast('Không thể ghi nhận đóng quỹ!', 'danger');
    }
  };

  const loadData = async () => {
    try {
      const [list, hList, rList, fList] = await Promise.all([
        db.getFinancialRecords(),
        db.getHouseholds(),
        db.getResidents(),
        db.getHouseholdFunds()
      ]);
      setRecords(list);
      setHouseholds(hList);
      setResidents(rList);
      setHouseholdFunds(fList);

      const wardId = localStorage.getItem('user_ward_id');
      if (wardId) {
        const list = await db.getTDPList(wardId);
        const map: Record<string, string> = {};
        list.forEach(item => {
          map[item.id] = item.tdp_name || item.full_name || 'Tổ dân phố';
        });
        setTdpMap(map);
        setTdpList(list);
      }
    } catch (e) {
      showToast('Lỗi tải dữ liệu tài chính!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);

    const handleSaveNoticeMessage = async (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'SAVE_NOTICE_TEMPLATE') return;
      const { year, html, fontSize } = event.data;
      if (year && html) {
        if (typeof (db as any).saveNoticeCustomization === 'function') {
          await (db as any).saveNoticeCustomization(year, html, fontSize);
        } else {
          localStorage.setItem(`notice_template_html_${year}`, html);
          if (fontSize) localStorage.setItem(`notice_template_fontsize_${year}`, fontSize);
        }
        showToast('Đã lưu vĩnh viễn mẫu Thông báo dự kiến thu vào CSDL Supabase!', 'success');
      }
    };
    window.addEventListener('message', handleSaveNoticeMessage);

    return () => {
      window.removeEventListener('db-changed', loadData);
      window.removeEventListener('message', handleSaveNoticeMessage);
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setType('income');
    setAmount('');
    setCategory('');
    setDescription('');
    setRecordedBy('Ban Quản lý');
    setPayer('');
    setDate(new Date().toISOString().slice(0, 10));
    setFormItems([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
    setEditingRecord(record);
    setType(record.type);
    setAmount(formatInputNumber(record.amount.toString()));
    setCategory(record.category);
    setDescription(record.description);
    setRecordedBy(record.recorded_by);
    setPayer(record.payer || '');
    setDate(record.date);
    setFormItems([]);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const recordToDelete = records.find(r => r.id === id);
    const isAdmin = currentActionRole === 'admin' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'ward_admin';
    const isToTruong = currentActionRole === 'to_truong' || userRole === 'to_truong';
    
    const recBy = (recordToDelete?.recorded_by || '').toLowerCase();
    const isRecordedByThuQuy = recBy.includes('thủ quỹ') || recBy.includes('thu_quy') || recBy.includes('thu quy');

    if (isToTruong && !isAdmin && isRecordedByThuQuy) {
      showToast('🔒 Vai trò Tổ trưởng không được phép xóa phiếu thu, phiếu chi của Thủ quỹ! Chỉ Admin mới có quyền xóa.', 'warning');
      alert('🔒 Quyền bị hạn chế:\n\nVai trò Tổ trưởng dân phố không được phép xóa phiếu thu, phiếu chi do Thủ quỹ lập.\nChỉ có Quản trị hệ thống (Admin) mới có quyền xóa chứng từ này.');
      return;
    }

    if (window.confirm('Bạn có chắc chắn muốn xóa phiếu thu/chi này khỏi hệ thống?')) {
      try {
        await db.deleteFinancialRecord(id);
        showToast('Xóa phiếu thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi xóa giao dịch!', 'danger');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount.replace(/\./g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'warning');
      return;
    }
    if (!category.trim() || !description.trim()) {
      showToast('Vui lòng nhập đầy đủ danh mục và nội dung!', 'warning');
      return;
    }

    if (type === 'expense') {
      if (!payer.trim()) {
        showToast('Vui lòng nhập tên Người nhận tiền / Đơn vị nhận tiền!', 'warning');
        return;
      }
      if (payer.trim().toLowerCase() === recordedBy.trim().toLowerCase()) {
        showToast('⚠️ Theo quy định tài chính, Người nhận tiền và Người lập phiếu không được là 1 người!', 'warning');
        alert('⚠️ Quy định quản lý tài chính:\n\n"Người nhận tiền" và "Người lập phiếu" KHÔNG ĐƯỢC THUỘC VỀ CÙNG 1 NGƯỜI.\nVui lòng kiểm tra lại họ tên Người nhận tiền / Đơn vị thụ hưởng thực tế!');
        return;
      }
    }

    const payload: FinancialRecord = {
      id: editingRecord ? editingRecord.id : generateUUID(),
      group_id: db.getGroupId(),
      type,
      amount: parsedAmount,
      category,
      description,
      recorded_by: recordedBy,
      payer: payer.trim(),
      date,
      created_at: editingRecord ? editingRecord.created_at : new Date().toISOString()
    };

    try {
      await db.saveFinancialRecord(payload);
      showToast(editingRecord ? 'Cập nhật phiếu thành công!' : 'Lập phiếu thu/chi thành công!', 'success');
      setIsFormOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi lưu giao dịch!', 'danger');
    }
  };

  const formatToDisplayDate = (dateStr: string) => {
    return formatDateVN(dateStr);
  };

  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    showToast('Đang khởi tạo file Excel chuyên nghiệp...', 'info');

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sổ Thu Chi TDP');

      const tdpNameStored = localStorage.getItem('tdp_name') || 'Tổ dân phố';
      const wardNameStored = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
      const leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
      const today = new Date();
      const exportDateStr = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

      // 1. HEADER CHÍNH QUY
      const row1 = worksheet.addRow([`Đơn vị: UBND ${wardNameStored.toUpperCase()}`, '', '', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM']);
      row1.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
      row1.getCell(7).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
      row1.getCell(7).alignment = { horizontal: 'right' };

      const row2 = worksheet.addRow([`Tổ dân phố: ${tdpNameStored.toUpperCase()}`, '', '', '', '', '', 'Độc lập - Tự do - Hạnh phúc']);
      row2.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
      row2.getCell(7).font = { italic: true, name: 'Segoe UI', size: 10, color: { argb: 'FF475569' } };
      row2.getCell(7).alignment = { horizontal: 'right' };

      worksheet.addRow([]); // Dòng trống

      // 2. TIÊU ĐỀ BÁO CÁO
      const isFilteredByUser = recordedByFilter !== 'all';
      const mainReportTitle = isFilteredByUser 
        ? `SỔ THEO DÕI THU - CHI (NGƯỜI LẬP: ${recordedByFilter.toUpperCase()})` 
        : 'SỔ THEO DÕI THU - CHI TỔ DÂN PHỐ';

      const titleRow = worksheet.addRow([mainReportTitle]);
      worksheet.mergeCells(`A4:G4`);
      titleRow.height = 32;
      const titleCell = titleRow.getCell(1);
      titleCell.font = { bold: true, name: 'Segoe UI', size: 15, color: { argb: 'FF0F766E' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      const subTitleRow = worksheet.addRow([`(Thời điểm xuất báo cáo: ${exportDateStr}${isFilteredByUser ? ` - Người lập: ${recordedByFilter}` : ''})`]);
      worksheet.mergeCells(`A5:G5`);
      const subTitleCell = subTitleRow.getCell(1);
      subTitleCell.font = { italic: true, name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };
      subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.addRow([]); // Dòng trống

      // 3. THỐNG KÊ TỔNG QUAN (KPI BOXES)
      // Nếu lọc theo người lập -> Lấy danh sách của người lập. Nếu chọn Tất cả -> Lấy toàn bộ như cũ
      const targetSourceRecords = isFilteredByUser 
        ? records.filter(r => (r.recorded_by || '').trim().toLowerCase() === recordedByFilter.trim().toLowerCase())
        : records;

      const manualRecords: FinancialRecord[] = [];
      const autoFundRecords: FinancialRecord[] = [];

      targetSourceRecords.forEach(r => {
        if (r.description.includes('[QUY_') || r.recorded_by === 'Hệ thống tự động') {
          autoFundRecords.push(r);
        } else {
          manualRecords.push(r);
        }
      });

      // Gom nhóm chứng từ thu quỹ tự động theo Ngày + Danh mục quỹ
      const autoFundGroupsMap = new Map<string, { date: string; category: string; amount: number; count: number }>();
      autoFundRecords.forEach(r => {
        const cleanCat = r.category || 'Thu quỹ TDP';
        const key = `${r.date}_${cleanCat}`;
        const existing = autoFundGroupsMap.get(key);
        if (existing) {
          existing.amount += r.amount;
          existing.count += 1;
        } else {
          autoFundGroupsMap.set(key, {
            date: r.date,
            category: cleanCat,
            amount: r.amount,
            count: 1
          });
        }
      });

      // Chuyển các nhóm thu quỹ tự động thành danh sách dòng tổng hợp theo ngày
      const groupedAutoRecords: FinancialRecord[] = Array.from(autoFundGroupsMap.values()).map(g => ({
        id: `auto_${g.date}_${g.category}`,
        group_id: db.getGroupId(),
        type: 'income',
        amount: g.amount,
        category: g.category,
        description: `Tổng thu ${g.category} (Tổng ${g.count} hộ nộp trong ngày)`,
        recorded_by: 'Hệ thống tự động (Tổng hợp ngày)',
        date: g.date,
        created_at: new Date().toISOString()
      }));

      // Kết hợp ghi tay + gôm nhóm tự động và sắp xếp theo ngày tăng dần
      const exportRecords = [...manualRecords, ...groupedAutoRecords].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.type.localeCompare(b.type);
      });

      const totalIncome = exportRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = exportRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
      const balance = totalIncome - totalExpense;

      const kpiRow1 = worksheet.addRow(['THỐNG KÊ TỔNG QUAN GIAO DỊCH (SỔ TỔNG TÍCH LŨY):', '', '', '', '', '', '']);
      kpiRow1.getCell(1).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF1E293B' } };

      const kpiRow2 = worksheet.addRow(['TỔNG THU TÍCH LŨY:', totalIncome, '', 'TỔNG CHI TÍCH LŨY:', totalExpense, 'SỐ DƯ QUỸ HIỆN TẠI:', balance]);
      kpiRow2.height = 24;
      
      // Style KPI Total Income
      kpiRow2.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FF15803D' } };
      kpiRow2.getCell(2).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF15803D' } };
      kpiRow2.getCell(2).numFmt = '#,##0 "đ"';
      kpiRow2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

      // Style KPI Total Expense
      kpiRow2.getCell(4).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFB91C1C' } };
      kpiRow2.getCell(5).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FFB91C1C' } };
      kpiRow2.getCell(5).numFmt = '#,##0 "đ"';
      kpiRow2.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

      // Style KPI Balance
      kpiRow2.getCell(6).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: balance >= 0 ? 'FF0369A1' : 'FFB91C1C' } };
      kpiRow2.getCell(7).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: balance >= 0 ? 'FF0369A1' : 'FFB91C1C' } };
      kpiRow2.getCell(7).numFmt = '#,##0 "đ"';
      kpiRow2.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: balance >= 0 ? 'FFE0F2FE' : 'FFFEE2E2' } };

      worksheet.addRow([]); // Dòng trống

      // 4. BẢNG DỮ LIỆU CHI TIẾT
      const headers = ['STT', 'Ngày lập', 'Loại phiếu', 'Nội dung khoản Thu / Chi', 'Danh mục', 'Người lập', 'Số tiền (VND)'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' } // Deep Teal
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      // Render từng dòng chứng từ
      exportRecords.forEach((r, idx) => {
        const rowData = [
          idx + 1,
          formatToDisplayDate(r.date),
          r.type === 'income' ? 'THU' : 'CHI',
          cleanDescription(r.description),
          r.category || '—',
          r.recorded_by || 'Ban quản lý',
          r.amount
        ];
        const row = worksheet.addRow(rowData);
        row.height = 22;

        const isEven = idx % 2 === 1;
        const bgArgb = r.type === 'income' 
          ? (isEven ? 'FFF0FDF4' : 'FFDCFCE7') 
          : (isEven ? 'FFFFF1F2' : 'FFFEE2E2');

        row.eachCell((cell, colIndex) => {
          cell.font = { name: 'Segoe UI', size: 10.5 };

          // Border nhẹ cho từng ô
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // STT & Ngày lập
          if (colIndex === 1 || colIndex === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Loại phiếu (cột 3)
          if (colIndex === 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { bold: true, name: 'Segoe UI', size: 10.5, color: { argb: r.type === 'income' ? 'FF15803D' : 'FFB91C1C' } };
          }

          // Nội dung & Danh mục & Người lập
          if (colIndex === 4 || colIndex === 5 || colIndex === 6) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }

          // Số tiền (cột 7)
          if (colIndex === 7) {
            cell.numFmt = '#,##0';
            cell.font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: r.type === 'income' ? 'FF15803D' : 'FFB91C1C' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
          }
        });
      });

      // 5. DÒNG TỔNG CỘNG VÀ TỒN QUỸ DƯỚI BẢNG
      worksheet.addRow([]); // Dòng trống

      const totalRowIncome = worksheet.addRow(['', '', '', 'TỔNG CỘNG THU:', '', '', totalIncome]);
      totalRowIncome.height = 24;
      worksheet.mergeCells(`D${totalRowIncome.number}:F${totalRowIncome.number}`);
      totalRowIncome.getCell(4).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF15803D' } };
      totalRowIncome.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRowIncome.getCell(7).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF15803D' } };
      totalRowIncome.getCell(7).numFmt = '#,##0 "đ"';
      totalRowIncome.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

      const totalRowExpense = worksheet.addRow(['', '', '', 'TỔNG CỘNG CHI:', '', '', totalExpense]);
      totalRowExpense.height = 24;
      worksheet.mergeCells(`D${totalRowExpense.number}:F${totalRowExpense.number}`);
      totalRowExpense.getCell(4).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FFB91C1C' } };
      totalRowExpense.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRowExpense.getCell(7).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FFB91C1C' } };
      totalRowExpense.getCell(7).numFmt = '#,##0 "đ"';
      totalRowExpense.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

      const totalRowBalance = worksheet.addRow(['', '', '', 'CÂN ĐỐI TỒN QUỸ (THU - CHI):', '', '', balance]);
      totalRowBalance.height = 26;
      worksheet.mergeCells(`D${totalRowBalance.number}:F${totalRowBalance.number}`);
      totalRowBalance.getCell(4).font = { bold: true, name: 'Segoe UI', size: 11.5, color: { argb: balance >= 0 ? 'FF0369A1' : 'FFB91C1C' } };
      totalRowBalance.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRowBalance.getCell(7).font = { bold: true, name: 'Segoe UI', size: 12, color: { argb: balance >= 0 ? 'FF0369A1' : 'FFB91C1C' } };
      totalRowBalance.getCell(7).numFmt = '#,##0 "đ"';
      totalRowBalance.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRowBalance.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: balance >= 0 ? 'FFE0F2FE' : 'FFFEE2E2' } };

      // Kẻ viền tổng cộng
      [totalRowIncome, totalRowExpense, totalRowBalance].forEach(r => {
        r.getCell(4).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        r.getCell(7).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });

      // 6. KHỐI CHỮ KÝ XÁC NHẬN CHÍNH THỨC
      worksheet.addRow([]);
      worksheet.addRow([]);

      const dateSignRow = worksheet.addRow(['', '', '', '', '', '', `${tdpNameStored}, ${exportDateStr}`]);
      dateSignRow.getCell(7).font = { italic: true, name: 'Segoe UI', size: 10, color: { argb: 'FF475569' } };
      dateSignRow.getCell(7).alignment = { horizontal: 'center' };

      const signTitleRow = worksheet.addRow(['NGƯỜI LẬP SỔ', '', 'KẾ TOÁN / THỦ QUỸ', '', '', '', 'TỔ TRƯỜNG TỔ DÂN PHỐ']);
      signTitleRow.height = 24;
      worksheet.mergeCells(`A${signTitleRow.number}:B${signTitleRow.number}`);
      worksheet.mergeCells(`C${signTitleRow.number}:E${signTitleRow.number}`);
      worksheet.mergeCells(`F${signTitleRow.number}:G${signTitleRow.number}`);

      signTitleRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10.5 };
      signTitleRow.getCell(1).alignment = { horizontal: 'center' };
      signTitleRow.getCell(3).font = { bold: true, name: 'Segoe UI', size: 10.5 };
      signTitleRow.getCell(3).alignment = { horizontal: 'center' };
      signTitleRow.getCell(6).font = { bold: true, name: 'Segoe UI', size: 10.5 };
      signTitleRow.getCell(6).alignment = { horizontal: 'center' };

      const signNoteRow = worksheet.addRow(['(Ký, ghi rõ họ tên)', '', '(Ký, ghi rõ họ tên)', '', '', '', '(Ký, đóng dấu, ghi rõ họ tên)']);
      worksheet.mergeCells(`A${signNoteRow.number}:B${signNoteRow.number}`);
      worksheet.mergeCells(`C${signNoteRow.number}:E${signNoteRow.number}`);
      worksheet.mergeCells(`F${signNoteRow.number}:G${signNoteRow.number}`);

      signNoteRow.getCell(1).font = { italic: true, name: 'Segoe UI', size: 9.5, color: { argb: 'FF64748B' } };
      signNoteRow.getCell(1).alignment = { horizontal: 'center' };
      signNoteRow.getCell(3).font = { italic: true, name: 'Segoe UI', size: 9.5, color: { argb: 'FF64748B' } };
      signNoteRow.getCell(3).alignment = { horizontal: 'center' };
      signNoteRow.getCell(6).font = { italic: true, name: 'Segoe UI', size: 9.5, color: { argb: 'FF64748B' } };
      signNoteRow.getCell(6).alignment = { horizontal: 'center' };

      // Chừa khoảng trống để ký tên
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.addRow([]);

      const nameRow = worksheet.addRow(['', '', '', '', '', '', leaderName]);
      worksheet.mergeCells(`F${nameRow.number}:G${nameRow.number}`);
      nameRow.getCell(6).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF1E293B' } };
      nameRow.getCell(6).alignment = { horizontal: 'center' };

      // Set độ rộng cố định cho các cột chuẩn đẹp
      worksheet.getColumn(1).width = 8;   // STT
      worksheet.getColumn(2).width = 14;  // Ngày
      worksheet.getColumn(3).width = 12;  // Loại phiếu
      worksheet.getColumn(4).width = 42;  // Nội dung
      worksheet.getColumn(5).width = 22;  // Danh mục
      worksheet.getColumn(6).width = 22;  // Người lập
      worksheet.getColumn(7).width = 22;  // Số tiền

      // Ghi workbook ra file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filenameTdp = (localStorage.getItem('tdp_name') || 'nam_sam_son').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `so_thu_chi_${filenameTdp}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Xuất báo cáo Sổ thu chi Excel chuyên nghiệp thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel!', 'danger');
    }
  };

  const handleExportFundsExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Thu Quỹ ${fundYear}`);
      
      const tdpNameStored = localStorage.getItem('tdp_name') || 'Tiến Quảng Giao';
      const wardNameStored = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
      
      // 1. Tiêu đề Tổ dân phố
      const titleRow1 = worksheet.addRow([`TỔ DÂN PHỐ ${tdpNameStored.toUpperCase()} - ${wardNameStored.toUpperCase()}`]);
      titleRow1.getCell(1).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF475569' } };
      
      // 2. Tiêu đề chính
      const titleRow2 = worksheet.addRow([`BÁO CÁO THU NỘP CÁC LOẠI QUỸ NĂM ${fundYear}`]);
      titleRow2.getCell(1).font = { bold: true, name: 'Segoe UI', size: 16, color: { argb: 'FF15803D' } };
      worksheet.addRow([]); // Dòng trống
      
      // 3. Headers
      const headers = ['STT', 'Hộ gia đình / Chủ hộ', 'Địa chỉ', 'Tổng đã nộp', ...fundNames];
      const headerRow = worksheet.addRow(headers);
      
      // Định dạng dòng header
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF15803D' } // Màu xanh lá của Excel
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      
      // 4. Sắp xếp hộ dân theo Tổ/Cụm rồi mới xuất
      // Tiền xử lý Map thanh toán O(1) cho Excel để tránh đứng trang
      const excelPayMap = new Map<string, number>();
      householdFunds.forEach(f => {
        if (f.year === fundYear) {
          excelPayMap.set(`${f.household_id}_${f.fund_name}`, f.amount);
        }
      });

      const sortedHouseholds = [...filteredHouseholdsForFunds].sort((a, b) => {
        const gA = a.self_management_group || '';
        const gB = b.self_management_group || '';
        
        const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
        const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
        
        const rankA = idxA !== -1 ? idxA : 999;
        const rankB = idxB !== -1 ? idxB : 999;
        
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        
        const nameA = getHouseholdHeadName(a).toLowerCase();
        const nameB = getHouseholdHeadName(b).toLowerCase();
        return nameA.localeCompare(nameB, 'vi');
      });

      let currentGroup = '';
      let sttCounter = 0;

      sortedHouseholds.forEach((hh) => {
        const group = hh.self_management_group || '';

        // Khi sang tổ/cụm mới → thêm dòng tiêu đề nhóm
        if (group !== currentGroup) {
          currentGroup = group;
          const groupLabel = group ? `TỔ/CỤM: ${group.toUpperCase()}` : 'CHƯA PHÂN NHÓM';
          const groupHeaderRow = worksheet.addRow([groupLabel]);
          groupHeaderRow.height = 22;
          worksheet.mergeCells(`A${groupHeaderRow.number}:${String.fromCharCode(64 + headers.length)}${groupHeaderRow.number}`);
          groupHeaderRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
          groupHeaderRow.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
          };
          groupHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        }

        sttCounter++;
        const headName = getHouseholdHeadName(hh);
        const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear && fundNames.includes(f.fund_name));
        const totalPaid = hhFundsList.reduce((sum, f) => sum + f.amount, 0);
        
        const tdpNameStoredInLocal = localStorage.getItem('tdp_name') || '';
        let displayAddress = hh.address || '';
        
        // Loại bỏ phần Tổ/Cụm trùng lặp khỏi địa chỉ (sử dụng biến group đã khai báo ở trên)
        if (group) {
          const cleanGroup = group.replace(/^(tổ|cụm)\s*/gi, '').trim();
          const groupRegex = new RegExp(`\\b(tổ|cụm)?\\s*${cleanGroup}\\b`, 'gi');
          displayAddress = displayAddress.replace(groupRegex, '');
        }

        // Loại bỏ bất kỳ cụm từ "Tổ/Cụm [số]" nào khác để tránh lộn xộn, mâu thuẫn thông tin trên cùng một dòng
        displayAddress = displayAddress.replace(/\b(tổ|cụm|tổ tự quản|cụm tự quản)\s*\d+\b/gi, '');

        // Làm sạch các ký tự phân cách thừa
        displayAddress = displayAddress
          .replace(/^[-\s,·•/]+/g, '')
          .replace(/[-\s,·•/]+$/g, '')
          .replace(/\s*,\s*,+/g, ',')
          .trim();

        // Ghép thêm tên Tổ dân phố từ cài đặt nếu chưa có
        if (tdpNameStoredInLocal && !displayAddress.toLowerCase().includes(tdpNameStoredInLocal.toLowerCase())) {
          if (displayAddress) {
            displayAddress = `${displayAddress}, ${tdpNameStoredInLocal}`;
          } else {
            displayAddress = tdpNameStoredInLocal;
          }
        }

        // Dọn dẹp dấu phẩy hoặc gạch thừa một lần nữa
        displayAddress = displayAddress
          .replace(/^[-\s,·•]+/g, '')
          .replace(/[-\s,·•]+$/g, '')
          .trim();

        const rowData: (string | number)[] = [
          sttCounter,
          headName,
          displayAddress,
          totalPaid
        ];
        
        fundNames.forEach(fundName => {
          const amount = excelPayMap.get(`${hh.id}_${fundName}`) || 0;
          rowData.push(amount);
        });
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;
        
        // Căn chỉnh các ô dữ liệu
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // STT
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; // Hộ gia đình
        dataRow.getCell(2).font = { bold: true };
        dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }; // Địa chỉ
        dataRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }; // Tổng đã nộp
        dataRow.getCell(4).font = { bold: true, color: { argb: totalPaid > 0 ? 'FF15803D' : 'FF94A3B8' } };
        dataRow.getCell(4).numFmt = '#,##0';
        
        // Căn chỉnh số tiền cho các loại quỹ
        for (let i = 5; i <= headers.length; i++) {
          const cell = dataRow.getCell(i);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          const val = cell.value as number;
          cell.numFmt = '#,##0';
          if (val > 0) {
            cell.font = { color: { argb: 'FF15803D' }, name: 'Segoe UI' };
          } else {
            cell.font = { color: { argb: 'FF94A3B8' }, name: 'Segoe UI' };
          }
        }
      });

      
      // 5. Dòng tổng cộng ở cuối
      const totalRowData = ['Tổng cộng', '', '', 0];
      // Điền số 0 cho từng quỹ
      fundNames.forEach(() => totalRowData.push(0));
      
      const totalRow = worksheet.addRow(totalRowData);
      totalRow.height = 24;
      worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      totalRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10 };
      
      // Tính toán tổng cộng cho từng cột
      let grandTotal = 0;
      filteredHouseholdsForFunds.forEach(hh => {
        const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear && fundNames.includes(f.fund_name));
        grandTotal += hhFundsList.reduce((sum, f) => sum + f.amount, 0);
      });
      totalRow.getCell(4).value = grandTotal;
      totalRow.getCell(4).font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
      totalRow.getCell(4).numFmt = '#,##0';
      totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      
      fundNames.forEach((fundName, idx) => {
        let colSum = 0;
        filteredHouseholdsForFunds.forEach(hh => {
          const paidAmount = excelPayMap.get(`${hh.id}_${fundName}`) || 0;
          colSum += paidAmount;
        });
        const cellIndex = 5 + idx;
        totalRow.getCell(cellIndex).value = colSum;
        totalRow.getCell(cellIndex).font = { bold: true, name: 'Segoe UI' };
        totalRow.getCell(cellIndex).numFmt = '#,##0';
        totalRow.getCell(cellIndex).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      
      // Tô viền lưới cho toàn bộ bảng
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (row.number >= 4) { // Bắt đầu từ dòng header
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          }
        });
      });
      
      // Tự động căn rộng cột
      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx === 0) { // STT
          column.width = 6;
        } else if (colIdx === 1) { // Hộ gia đình
          column.width = 25;
        } else if (colIdx === 2) { // Địa chỉ
          column.width = 30;
        } else { // Các cột tiền
          column.width = 16;
        }
      });
      
      // Ghi workbook ra file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filenameTdp = (localStorage.getItem('tdp_name') || 'nam_sam_son').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `thu_quy_ho_dan_${filenameTdp}_${fundYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Xuất báo cáo thu quỹ hộ dân thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel thu quỹ!', 'danger');
    }
  };

  const handlePrintFundsList = () => {
    if (filteredHouseholdsForFunds.length === 0) {
      showToast('Không có dữ liệu để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Trình duyệt đang chặn popup. Vui lòng cho phép popup để in!', 'warning');
      return;
    }
    const tdpNameVal = isWardUser 
      ? (tdpFilter !== 'all' ? (tdpMap[tdpFilter] || 'Tổ dân phố') : 'Tất cả TDP')
      : (localStorage.getItem('tdp_name') || 'Tổ dân phố');
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const groupLabel = isWardUser
      ? (tdpFilter !== 'all' ? ` – ${tdpMap[tdpFilter] || 'TDP'}` : '')
      : (fundGroupFilter !== 'all' ? ` – ${fundGroupFilter}` : '');
    const today = new Date().toLocaleDateString('vi-VN');
    
    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const fundHeadersHtml = fundNames.map(name => `<th>${name}</th>`).join('');
    
    const rowsHtml = filteredHouseholdsForFunds.map((hh, idx) => {
      const headName = getHouseholdHeadName(hh);
      const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
      
      const fundCellsHtml = fundNames.map(fundName => {
        const paidFund = hhFunds.find(f => f.fund_name === fundName);
        const amountPaid = paidFund ? paidFund.amount : 0;
        return `<td style="text-align: right;">${amountPaid > 0 ? formatCurrency(amountPaid) : '—'}</td>`;
      }).join('');

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold;">${headName}</td>
          <td>${hh.address}</td>
          <td style="text-align: right; font-weight: bold;">${totalPaid > 0 ? formatCurrency(totalPaid) : '—'}</td>
          ${fundCellsHtml}
        </tr>
      `;
    }).join('');

    let grandTotal = 0;
    filteredHouseholdsForFunds.forEach(hh => {
      const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      grandTotal += hhFundsList.reduce((sum, f) => sum + f.amount, 0);
    });

    const fundTotalsCellsHtml = fundNames.map(fundName => {
      let colSum = 0;
      filteredHouseholdsForFunds.forEach(hh => {
        const paid = householdFunds.find(f => f.household_id === hh.id && f.fund_name === fundName && f.year === fundYear);
        if (paid) colSum += paid.amount;
      });
      return `<td style="text-align: right; font-weight: bold;">${colSum > 0 ? formatCurrency(colSum) : '—'}</td>`;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Báo cáo thu nộp quỹ ${fundYear} – ${tdpNameVal}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin-top: 15mm;
              margin-bottom: 15mm;
              margin-left: 20mm;
              margin-right: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13pt;
            line-height: 1.3;
            color: #000;
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
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .doc-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .doc-subtitle {
            font-style: italic;
            font-size: 12pt;
            margin: 0;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 25px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 11pt;
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
            font-size: 12pt;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
            margin-bottom: 70px;
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
                UBND ${wardNameVal.toUpperCase()}<br/>
                TỔ DÂN PHỐ ${tdpNameVal.toUpperCase()}
                <div class="line-separator"></div>
              </div>
            </td>
            <td style="width: 2%;">&nbsp;</td>
            <td style="width: 60%;">
              <div class="motto">
                <div class="motto-main">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style="font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
                <div class="line-separator-long"></div>
              </div>
            </td>
          </tr>
        </table>

        <div class="doc-title-container">
          <h1 class="doc-title">BÁO CÁO THU NỘP CÁC LOẠI QUỸ NĂM ${fundYear}</h1>
          <p class="doc-subtitle">${tdpNameVal}${groupLabel} &nbsp;|&nbsp; Ngày in: ${today} &nbsp;|&nbsp; Tổng cộng đã thu: <strong>${formatCurrency(grandTotal)} đ</strong></p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">STT</th>
              <th style="width: 200px;">Hộ gia đình / Chủ hộ</th>
              <th>Địa chỉ</th>
              <th style="width: 110px;">Tổng đã nộp</th>
              ${fundHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9fafb;">
              <td colspan="3" style="text-align: center;">TỔNG CỘNG</td>
              <td style="text-align: right;">${formatCurrency(grandTotal)}</td>
              ${fundTotalsCellsHtml}
            </tr>
          </tbody>
        </table>

        <table class="signature-section">
          <tr>
            <td>
              <div class="signature-title">NGƯỜI LẬP PHIẾU</div>
              <div style="font-style: italic; font-size: 11pt; color: #555; margin-top: -65px; margin-bottom: 50px;">(Ký, ghi rõ họ tên)</div>
              <div class="signature-name" style="margin-top: 80px;">Ban Quản lý Quỹ</div>
            </td>
            <td>
              <div class="signature-title">TỔ TRƯỞNG TỔ DÂN PHỐ</div>
              <div style="font-style: italic; font-size: 11pt; color: #555; margin-top: -65px; margin-bottom: 50px;">(Ký, đóng dấu, ghi rõ họ tên)</div>
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px auto;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 80px; max-height: 80px; max-width: 180px; object-fit: contain;" />` : ''}
              </div>
              <div class="signature-name">${leaderName}</div>
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
    printMode: 'ward_only' | 'tdp_only' | 'combined' = 'combined'
  ) => {
    const tdpActiveFunds = (db as any).getFundList() || [];
    const wardActiveFunds = (db as any).getWardFundList() || [];

    const summary = calculateHouseholdFinancialSummary(
      household,
      members,
      memberWardRecords,
      householdPaidFunds,
      tdpActiveFunds,
      wardActiveFunds,
      fundYear,
      residents
    );

    return generateUnifiedHouseholdReceiptHtml(
      summary,
      dateText,
      tdpNameVal,
      wardNameVal,
      leaderName,
      leaderSigUrl,
      printMode
    );
  };

  const handlePrintHouseholdReceipt = async (
    householdIdOrHh: string | Household,
    printMode: 'tdp_only' | 'combined' = 'combined'
  ) => {
    const household = typeof householdIdOrHh === 'string'
      ? households.find(h => h.id === householdIdOrHh)
      : householdIdOrHh;
    if (!household) {
      showToast('Không tìm thấy thông tin hộ gia đình!', 'danger');
      return;
    }
    const householdId = household.id;

    const members = residents.filter(r => r.household_id === householdId);
    if (members.length === 0) {
      showToast('Hộ gia đình chưa có nhân khẩu nào đăng ký!', 'warning');
      return;
    }

    const normalizeDateToCompare = (dStr: string | undefined): string => {
      if (!dStr) return '';
      const clean = dStr.trim();
      if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts.length === 3) {
          return `${parseInt(parts[2], 10)}-${parseInt(parts[1], 10)}-${parts[0]}`;
        }
      }
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 3) {
          return `${parseInt(parts[0], 10)}-${parseInt(parts[1], 10)}-${parts[2]}`;
        }
      }
      return clean;
    };

    let wardFundsList: WardFund[] = [];
    try {
      wardFundsList = await db.getWardFunds(fundYear);
    } catch { /* ignore */ }

    const memberWardRecords = wardFundsList.filter(f => {
      const nameKey = f.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
      const dobClean = (f.dob || '').trim();
      
      return members.some(m => {
        const mName = m.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
        if (mName !== nameKey) return false;
        
        if (f.user_id && m.user_id !== f.user_id) return false;
        
        if (dobClean) {
          const normClean = normalizeDateToCompare(dobClean);
          const normM = normalizeDateToCompare(m.dob);
          if (normM !== normClean && !m.dob.includes(dobClean) && !dobClean.includes(m.dob)) {
            return false;
          }
        }
        return true;
      });
    });

    const filteredHhFunds = householdFunds.filter(hf => hf.household_id === householdId && hf.year === fundYear);

    const totalTdp = filteredHhFunds.reduce((sum, hf) => sum + hf.amount, 0);
    const wardActiveFunds = (db as any).getWardFundList();
        const totalWard = memberWardRecords.reduce((sum, r) => {
      let rSum = 0;
      wardActiveFunds.forEach((fund: any) => {
        rSum += r.contributions?.[fund.name]?.actual || 0;
      });
      return sum + rSum;
    }, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const tdpNameVal = isWardUser 
      ? (tdpFilter !== 'all' ? (tdpMap[tdpFilter] || 'Tổ dân phố') : 'Tất cả TDP')
      : (localStorage.getItem('tdp_name') || 'Tổ dân phố');
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

    const activeMemberIds = new Set(memberWardRecords.map(f => f.user_id).filter(Boolean));
    const activeMemberNames = new Set(memberWardRecords.map(f => (f.full_name || '').trim().toLowerCase()));

    const activeMembers = memberWardRecords.length > 0
      ? members.filter(r => {
          if (r.id === household.head_of_household_id || r.is_head || (r.relationship_with_head && r.relationship_with_head.trim().toLowerCase() === 'chủ hộ')) return true;
          if (r.id && activeMemberIds.has(r.id)) return true;
          if (r.full_name && activeMemberNames.has(r.full_name.trim().toLowerCase())) return true;
          return false;
        })
      : members;

    const freshReceiptHtml = generateHouseholdReceiptHtml(
      household,
      activeMembers,
      memberWardRecords,
      filteredHhFunds,
      dateText,
      tdpNameVal,
      wardNameVal,
      leaderName,
      leaderSigUrl,
      printMode
    );

    const SAVE_KEY = `receipt_html_${householdId}_${fundYear}_${printMode}`;
    let savedReceiptHtml: string | null = null;
    try {
      savedReceiptHtml = localStorage.getItem(SAVE_KEY);
      if (!savedReceiptHtml && (db as any).getReceiptCustomization) {
        savedReceiptHtml = await (db as any).getReceiptCustomization(SAVE_KEY);
      }
    } catch { /* ignore */ }

    const hasSavedVersion = Boolean(savedReceiptHtml);
    let receiptHtml = savedReceiptHtml || freshReceiptHtml;

    const hhGroupStr = (household as any).self_management_group || '';
    if (savedReceiptHtml && hhGroupStr) {
      const formattedGroup = hhGroupStr.trim().toLowerCase().startsWith('tổ') || hhGroupStr.trim().toLowerCase().startsWith('cụm') 
        ? hhGroupStr.trim() 
        : `Tổ ${hhGroupStr.trim()}`;
      if (!savedReceiptHtml.includes(formattedGroup)) {
        receiptHtml = savedReceiptHtml.replace(/(Họ và tên người nộp tiền:\s*<\/td>\s*<td[^>]*>\s*<strong>[^<]+<\/strong>\s*(?:\([^)]+\))?)/i, `$1 ${formattedGroup}`);
      }
    }

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
            .print-toolbar, #saved-notice, #custom-2d-toast, .no-print, [id*="toast"] {
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
          <button class="toolbar-btn btn-load" id="btn-load">📂 Mở bản đã lưu</button>
          <button class="toolbar-btn btn-reset" id="btn-reset">🔄 Đặt lại mẫu phiếu in gốc</button>
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
          <button class="toolbar-btn btn-close" id="btn-close">❌ Đóng</button>
        </div>

        <div id="saved-notice" style="${hasSavedVersion ? 'display:flex;' : 'display:none;'}background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;padding:8px 16px;margin-bottom:10px;font-size:9pt;font-family:Arial,sans-serif;align-items:center;gap:10px;color:#92400e;">
          ⚠️ <strong>Đang hiển thị dữ liệu mới nhất từ hệ thống.</strong> ${hasSavedVersion ? 'Có 1 bản đã lưu trước đó của phiếu này. Nhấn <strong>📂 Mở bản đã lưu</strong> để xem lại bản cũ.' : ''}
        </div>
        
        <div class="editor-area" contenteditable="true" style="outline: none;">
          ${receiptHtml}
        </div>
        
        <script>
          const SAVE_KEY = 'receipt_html_${householdId}_${fundYear}_${printMode}';
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

                const ths = Array.from(table.querySelectorAll('thead th'));
                let amountColIdx = -1;
                ths.forEach((th, idx) => {
                  const text = (th.textContent || th.innerText || '').toLowerCase();
                  if (text.includes('số tiền') || text.includes('thành tiền') || text.includes('mức nộp')) {
                    amountColIdx = idx;
                  }
                });

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

                if (grandTotal === 0) {
                  let activeEl = document.activeElement;
                  const isEditingTable = activeEl && table.contains(activeEl);
                  if (!isEditingTable) {
                    return;
                  }
                }

                const activePrintMode = (typeof currentPrintMode !== 'undefined') ? currentPrintMode : 'combined';
                let effectiveTotal = grandTotal;
                if (activePrintMode === 'tdp_only') {
                  effectiveTotal = tdpTotal;
                } else if (activePrintMode === 'ward_only') {
                  effectiveTotal = wardTotal;
                }

                if (totalRow) {
                  const totalTds = totalRow.querySelectorAll('td');
                  if (totalTds.length >= 2) {
                    const existingText = totalTds[1].textContent || totalTds[1].innerText || '';
                    const existingDigits = existingText.replace(/[^\d]/g, '');
                    const existingNum = existingDigits ? parseInt(existingDigits, 10) : 0;

                    if (effectiveTotal === 0 && existingNum > 0) {
                      const hasAnyNonEmptyRow = rows.some(r => {
                        if (r === totalRow || r.classList.contains('receipt-total-row')) return false;
                        const cell = r.querySelector('.receipt-amount-cell') || r.querySelectorAll('td')[4] || r.querySelectorAll('td')[3];
                        const cellDigits = cell ? (cell.textContent || '').replace(/[^\d]/g, '') : '';
                        return cellDigits.length > 0;
                      });
                      if (hasAnyNonEmptyRow) {
                        effectiveTotal = existingNum;
                      }
                    }

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

          ['input', 'keyup', 'change', 'blur', 'paste'].forEach(function(evtType) {
            document.addEventListener(evtType, recalculateReceiptTotals, true);
          });

          try {
            recalculateReceiptTotals();
          } catch (e) {}



          function safeSaveStorage(key, val) {
            try {
              localStorage.setItem(key, val);
              return true;
            } catch (e) {
              try {
                if (window.opener && window.opener.localStorage) {
                  window.opener.localStorage.setItem(key, val);
                  return true;
                }
              } catch (err) {}
            }
            return false;
          }

          function safeGetStorage(key) {
            try {
              const val = localStorage.getItem(key);
              if (val) return val;
            } catch (e) {}
            try {
              if (window.opener && window.opener.localStorage) {
                return window.opener.localStorage.getItem(key);
              }
            } catch (err) {}
            return null;
          }

          function safeRemoveStorage(key) {
            try {
              localStorage.removeItem(key);
            } catch (e) {}
            try {
              if (window.opener && window.opener.localStorage) {
                window.opener.localStorage.removeItem(key);
              }
            } catch (err) {}
          }

          function show2DToast(msg, type = 'success') {
            let toast = document.getElementById('custom-2d-toast');
            if (!toast) {
              toast = document.createElement('div');
              toast.id = 'custom-2d-toast';
              toast.className = 'no-print';
              toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;box-shadow:0 10px 25px -5px rgba(0,0,0,0.15),0 8px 10px -6px rgba(0,0,0,0.1);display:flex;align-items:center;gap:10px;transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1);transform:translateY(-20px) scale(0.95);opacity:0;';
              document.body.appendChild(toast);
            }
            const isSuccess = type === 'success';
            toast.style.background = isSuccess ? '#ecfdf5' : '#fffbe8';
            toast.style.color = isSuccess ? '#065f46' : '#92400e';
            toast.style.border = isSuccess ? '1.5px solid #10b981' : '1.5px solid #f59e0b';
            toast.innerHTML = isSuccess ? '<span style="font-size:16px;">✅</span> <span>' + msg + '</span>' : '<span style="font-size:16px;">ℹ️</span> <span>' + msg + '</span>';
            requestAnimationFrame(() => {
              toast.style.opacity = '1';
              toast.style.transform = 'translateY(0) scale(1)';
            });
            if (toast.timeoutId) clearTimeout(toast.timeoutId);
            toast.timeoutId = setTimeout(() => {
              toast.style.opacity = '0';
              toast.style.transform = 'translateY(-20px) scale(0.95)';
            }, 2800);
          }

          btnSave.addEventListener('click', function() {
            const ok = safeSaveStorage(SAVE_KEY, editor.innerHTML);
            try {
              if (window.opener && window.opener.db && window.opener.db.saveReceiptCustomization) {
                window.opener.db.saveReceiptCustomization(SAVE_KEY, editor.innerHTML);
              }
            } catch (err) {}

            const notice = document.getElementById('saved-notice');
            if (notice) {
              notice.style.display = 'flex';
              notice.style.background = '#dcfce7';
              notice.style.border = '1.5px solid #16a34a';
              notice.style.color = '#14532d';
              notice.innerHTML = '✅ <strong>Đã lưu vĩnh viễn vào CSDL thành công!</strong> Không bao giờ bị mất khi xóa cache hay đổi máy.';
            }
            show2DToast('Đã lưu vĩnh viễn bản chỉnh sửa phiếu thu vào CSDL thành công!', 'success');
          });

          if (btnLoad) {
            btnLoad.addEventListener('click', async function() {
              let saved = safeGetStorage(SAVE_KEY);
              if (!saved && window.opener && window.opener.db && window.opener.db.getReceiptCustomization) {
                try {
                  saved = await window.opener.db.getReceiptCustomization(SAVE_KEY);
                } catch (err) {}
              }
              if (saved) {
                editor.innerHTML = saved;
                recalculateReceiptTotals();
                const notice = document.getElementById('saved-notice');
                if (notice) {
                  notice.style.display = 'flex';
                  notice.style.background = '#dcfce7';
                  notice.style.border = '1.5px solid #16a34a';
                  notice.style.color = '#14532d';
                  notice.innerHTML = '✅ Đang hiển thị <strong>bản chỉnh sửa đã lưu trước đó từ CSDL</strong>.';
                }
                show2DToast('Đã mở bản chỉnh sửa đã lưu trước đó!', 'success');
              } else {
                show2DToast('Chưa có bản chỉnh sửa nào được lưu cho phiếu thu này.', 'info');
              }
            });
          }

          btnReset.addEventListener('click', function() {
            if (confirm('Bạn có chắc chắn muốn xóa bản chỉnh sửa đã lưu và tải lại dữ liệu mới nhất từ hệ thống không?')) {
              safeRemoveStorage(SAVE_KEY);
              try {
                if (window.opener && window.opener.db && window.opener.db.deleteReceiptCustomization) {
                  window.opener.db.deleteReceiptCustomization(SAVE_KEY);
                }
              } catch (err) {}
              editor.innerHTML = freshHtml;
              recalculateReceiptTotals();
              const notice = document.getElementById('saved-notice');
              if (notice) notice.style.display = 'none';
              show2DToast('Đã khôi phục về dữ liệu gốc từ hệ thống!', 'success');
            }
          });

          const btnClose = document.getElementById('btn-close');
          if (btnClose) {
            btnClose.addEventListener('click', function() {
              try { window.close(); } catch (e) {}
              try { self.close(); } catch (e) {}
              try { top.close(); } catch (e) {}
            });
          }


        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleQuickPayHouseholdFinance = async (hh: Household, forceCancel?: boolean) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu thu quỹ!', 'warning');
      return;
    }
    const householdId = hh.id;
    try {
      const members = residents.filter(r => r.household_id === householdId);
      const today = new Date().toISOString().slice(0, 10);

      // --- 1. Ghi nhận đóng Quỹ Phường ---
      let wardFundsList: WardFund[] = [];
      try {
        wardFundsList = await db.getWardFunds(fundYear);
      } catch { /* ignore */ }

      const memberNames = members.map(m => m.full_name.trim().toLowerCase());
      const memberWardRecords = wardFundsList.filter(f => {
        const nameKey = f.full_name.trim().toLowerCase();
        return memberNames.includes(nameKey);
      });

      const wardActiveFunds = (db as any).getWardFundList() || [];

      const allWardPaid = memberWardRecords.length > 0 && memberWardRecords.every(m =>
        wardActiveFunds.every((fund: any) => {
          const isHouseholdScope = (fund as any).scope ? (fund as any).scope === 'household' : (fund.name.toLowerCase().includes('hộ gia đình') || fund.name.toLowerCase().includes('chủ hộ') || fund.name.toLowerCase().includes('người cao tuổi') || fund.name.toLowerCase().includes('cao tuổi'));
          if (isHouseholdScope) return true;
          const c = m.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
          const exp = c.expected || 0;
          if (exp === 0) return true;
          return c.actual >= exp;
        })
      );

      // --- 2. Ghi nhận đóng Quỹ TDP ---
      const tdpActiveFunds = (db as any).getFundList() || [];
      const filteredHhFunds = householdFunds.filter(hf => hf.household_id === householdId && hf.year === fundYear);

      const allTdpPaid = tdpActiveFunds.every((fund: any) => {
        const paidFund = filteredHhFunds.find(hf => hf.fund_name === fund.name);
        return paidFund && paidFund.amount >= fund.target;
      });

      const shouldPay = forceCancel !== undefined ? !forceCancel : (!allWardPaid || !allTdpPaid);

      // Lưu quỹ Phường (nếu có thành viên)
      if (members.length > 0) {
        await Promise.all(members.map(async m => {
          const nameKey = m.full_name.trim().toLowerCase();
          const wardRec = memberWardRecords.find(f => f.full_name.trim().toLowerCase() === nameKey);
          if (!wardRec) return;

          const newContributions: Record<string, any> = { ...wardRec.contributions };
          wardActiveFunds.forEach((fund: any) => {
            const c = wardRec.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
            newContributions[fund.name] = {
              expected: c.expected,
              actual: shouldPay ? (c.expected || c.actual) : 0,
              date: shouldPay ? today : ''
            };
          });

          await db.saveWardFund({
            ...wardRec,
            contributions: newContributions,
            note: shouldPay ? 'Đã nộp đủ đợt tập trung' : ''
          });
        }));
      }

      // Lưu quỹ TDP & Sổ quỹ chung
      const headResident = members.find(r => r.id === hh.head_of_household_id || r.is_head);
      const headName = headResident ? headResident.full_name : getHouseholdHeadName(hh);

      for (const fund of tdpActiveFunds) {
        const existing = filteredHhFunds.find(hf => hf.fund_name === fund.name);
        const targetId = existing ? existing.id : generateUUID();
        const flagText = `[QUY_${targetId}]`;
        const matchedGeneral = records.find(r => r.description.includes(flagText));

        const isKhuyenHoc = fund.name.toLowerCase().includes('khuyến học') || fund.name.toLowerCase().includes('khuyen hoc');
        const hhAddr = ((hh?.address || '') + ' ' + ((hh as any)?.self_management_group || '') + ' ' + ((hh as any)?.group_name || '') + ' ' + (members?.[0]?.permanent_address || '')).toLowerCase();
        const isGroup8 = hhAddr.includes('tổ 8') || hhAddr.includes('to 8') || hhAddr.includes('tổ: 8') || ((hh as any)?.self_management_group || '').trim() === 'Tổ 8' || ((hh as any)?.self_management_group || '').trim() === '8';
        const isExemptTdpGroup8 = isKhuyenHoc && isGroup8 && Number(fundYear) === 2026;

        const fundAmount = isExemptTdpGroup8 ? 0 : fund.target;
        const fundNote = isExemptTdpGroup8 ? 'Đã thu trước' : 'Đã thu đủ theo thông báo';

        if (shouldPay) {
          const payload: HouseholdFund = {
            id: targetId,
            household_id: householdId,
            year: fundYear,
            fund_name: fund.name,
            amount: fundAmount,
            paid_at: today,
            note: fundNote
          };
          await db.saveHouseholdFund(payload);

          const generalRecord: FinancialRecord = {
            id: matchedGeneral ? matchedGeneral.id : generateUUID(),
            group_id: db.getGroupId(),
            type: 'income',
            amount: fundAmount,
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

      showToast(
        shouldPay 
          ? `✅ Đã thu đủ các khoản TDP & Phường cho hộ ${headName}!` 
          : `↩ Đã hủy ghi nhận đóng quỹ cho hộ ${headName}!`, 
        'success'
      );

      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (err) {
      showToast('Có lỗi xảy ra khi cập nhật thu nhanh!', 'danger');
    }
  };

  // In Thông báo dự kiến thu các khoản đóng góp tự nguyện (Mẫu chuẩn gộp TDP & Phường)
  const handlePrintCombinedNotice = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    try {
      printWindow.document.write('<div style="font-family: system-ui, sans-serif; padding: 40px; text-align: center; color: #1e40af; font-size: 16px;">⏳ Đang tải mẫu thông báo từ CSDL...</div>');
    } catch (e) {}

    // Tải nội dung đã lưu từ CSDL Supabase hoặc localStorage nếu có
    let customNotice: { html: string | null; fontSize: string | null } | null = null;
    try {
      if (typeof (db as any).getNoticeCustomization === 'function') {
        customNotice = await (db as any).getNoticeCustomization(fundYear);
      }
    } catch (e) {
      console.warn('Failed to get notice customization:', e);
    }
    const savedHtml = customNotice?.html || localStorage.getItem(`notice_template_html_${fundYear}`);
    const savedFontSize = customNotice?.fontSize || localStorage.getItem(`notice_template_fontsize_${fundYear}`) || '11.5pt';

    const tdpNameVal = isWardUser 
      ? (tdpFilter !== 'all' ? (tdpMap[tdpFilter] || 'Tổ dân phố') : 'Tất cả TDP')
      : (localStorage.getItem('tdp_name') || 'Tổ dân phố');
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    
    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
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
      const isHousehold = wf.scope ? wf.scope === 'household' : (wf.name && (wf.name.toLowerCase().includes('hộ gia đình') || wf.name.toLowerCase().includes('chủ hộ') || wf.name.toLowerCase().includes('người cao tuổi')));
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

    const rawWardFundPrefix = localStorage.getItem('ward_fund_prefix');
    const wardFundPrefix = rawWardFundPrefix !== null ? rawWardFundPrefix.trim() : '';
    const wardPrefixStr = wardFundPrefix ? wardFundPrefix + ' ' : '';

    let wardListHtml = defaultWardItems.map((item) => `
      <li style="margin-bottom: 3px;"><b>${wardPrefixStr}${item.name}:</b> ${item.text}</li>
    `).join('');

    if (wardFundsList.length > 0) {
      wardListHtml = wardFundsList.map((wf: any) => {
        const isHousehold = wf.scope ? wf.scope === 'household' : (wf.name.toLowerCase().includes('hộ gia đình') || wf.name.toLowerCase().includes('chủ hộ') || wf.name.toLowerCase().includes('người cao tuổi'));
        const targetStr = typeof wf.target === 'number' ? wf.target.toLocaleString('vi-VN') + 'đ' : (wf.target ? wf.target + 'đ' : '....đ');
        const unitStr = isHousehold ? 'hộ' : 'khẩu';
        const noteStr = wf.age_range ? ` (${wf.age_range})` : (isHousehold ? '' : ' (Trong độ tuổi lao động – Có danh sách kèm theo)');
        return `<li style="margin-bottom: 3px;"><b>${wardPrefixStr}${wf.name}:</b> ${targetStr} / ${unitStr} / năm${noteStr}</li>`;
      }).join('');
    }

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
            <div class="doc-subtitle">Về việc dự kiến thu các khoản đóng góp tự nguyện năm ${fundYear}</div>
          </div>

          <p style="margin-bottom: 4px;"><b>Kính gửi:</b> Các hộ gia đình và Nhân dân Tổ dân phố ${tdpNameVal}.</p>
          <p style="margin-bottom: 4px; text-indent: 20px;">Căn cứ kết quả cuộc họp Tổ dân phố ngày ..... tháng ..... năm ${fundYear};</p>
          <p style="margin-bottom: 6px; text-indent: 20px;">Nhằm phục vụ các hoạt động chung của cộng đồng dân cư, Ban cán sự Tổ dân phố ${tdpNameVal} thông báo dự kiến các khoản đóng góp tự nguyện năm ${fundYear} như sau:</p>

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

          <p style="margin-bottom: 4px; text-indent: 20px;">Các khoản trên là mức dự kiến để Nhân dân nghiên cứu, tham gia ý kiến và thống nhất thực hiện trên tinh thần tự nguyện, dân chủ, công khai, minh bạch.</p>
          <p style="margin-bottom: 6px; text-indent: 20px;">Mọi ý kiến góp ý đề nghị gửi về Ban cán sự Tổ dân phố trước ngày ..... tháng ..... năm ${fundYear}.</p>
          <p style="margin-bottom: 6px;">Trân trọng thông báo!</p>

          <table class="footer-table">
            <tr>
              <td style="width: 45%;"></td>
              <td style="width: 55%;">
                <div style="font-style: italic; margin-bottom: 3px; font-size: 10.5pt;">Nam Sầm Sơn, ${dateTextVal}</div>
                <div style="font-weight: bold; font-size: 11.5pt;">TỔ TRƯỜNG TỔ DÂN PHỐ</div>
                <div style="font-style: italic; font-size: 10pt; margin-bottom: 5px;">(Ký, ghi rõ họ tên)</div>
                <div style="height: 55px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; margin-top: 5px;">
                  ${leaderSigUrl ? ('<img src="' + leaderSigUrl + '" alt="Chữ ký" style="height: 55px; max-height: 55px; max-width: 150px; object-fit: contain;" />') : '<div style="height: 55px;"></div>'}
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
        <title>Thông Báo Dự Kiến Thu Các Khoản Đóng Góp Năm ${fundYear}</title>
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
              const sigImg = ${JSON.stringify(leaderSigUrl ? ('<img src="' + leaderSigUrl + '" alt="Chữ ký" style="height: 55px; max-height: 55px; max-width: 150px; object-fit: contain;" />') : '<div style="height: 55px;"></div>')};
              footerTable.outerHTML = '<table class="footer-table" style="width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid;">' +
                '<tr>' +
                  '<td style="width: 45%; border: none; vertical-align: top; text-align: center;"></td>' +
                  '<td style="width: 55%; border: none; vertical-align: top; text-align: center;">' +
                    '<div style="font-style: italic; margin-bottom: 3px; font-size: 10.5pt;">Nam Sầm Sơn, ${dateTextVal}</div>' +
                    '<div style="font-weight: bold; font-size: 11.5pt;">TỔ TRƯỜNG TỔ DÂN PHỐ</div>' +
                    '<div style="font-style: italic; font-size: 10pt; margin-bottom: 5px;">(Ký, ghi rõ họ tên)</div>' +
                    '<div style="height: 55px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; margin-top: 5px;">' +
                      sigImg +
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
            
            localStorage.setItem('notice_template_html_${fundYear}', editorContent);
            localStorage.setItem('notice_template_fontsize_${fundYear}', selectedFontSize);
            
            if (window.opener) {
              window.opener.postMessage({
                type: 'SAVE_NOTICE_TEMPLATE',
                year: '${fundYear}',
                html: editorContent,
                fontSize: selectedFontSize
              }, '*');
            }

            // Phản hồi trực quan
            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = '💾 Đã lưu vào CSDL!';
            btnSave.style.backgroundColor = '#059669';
            setTimeout(() => {
              btnSave.innerHTML = originalText;
              btnSave.style.backgroundColor = '';
            }, 1500);
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

    try {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (e) {
      console.error('Lỗi khi ghi cửa sổ in:', e);
    }
  };

  const generateStateReceiptHtml = (hh: Household, dateText: string, tdpNameVal: string, wardNameVal: string, leaderName: string, leaderSigUrl: string) => {
    const headName = getHouseholdHeadName(hh);
    const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
    const totalPaid = hhFunds.reduce((sum, f) => {
      const raw = f.amount ?? 0;
      const val = typeof raw === 'number' ? raw : (parseInt(String(raw || '0').replace(/[^\d]/g, ''), 10) || 0);
      return sum + val;
    }, 0);

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

    const paidFundsRowsHtml = fundNames.map((fundName, idx) => {
      const fundRecord = hhFunds.find(f => f.fund_name === fundName);
      const rawPaid = fundRecord ? fundRecord.amount : 0;
      const amountPaid = typeof rawPaid === 'number' ? rawPaid : (parseInt(String(rawPaid || '0').replace(/[^\d]/g, ''), 10) || 0);
      const note = fundRecord ? fundRecord.note || '—' : '—';
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold; text-align: left;">Đóng góp ${fundName} (${fundYear})</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(amountPaid)} đ</td>
          <td style="text-align: left;">${note}</td>
        </tr>
      `;
    }).join('');

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

    const textAmountWords = docSoTien(totalPaid);

    return `
      <div class="receipt-container">
        <table class="receipt-header-table">
          <tr>
            <td style="width: 50%;">
              <div class="receipt-org-title">
                Đơn vị: UBND ${wardNameVal.toUpperCase()}<br/>
                Tổ dân phố: ${tdpNameVal.toUpperCase()}<br/>
                Địa chỉ: ${hh.address || tdpNameVal}
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
            <td style="text-align: left;"><strong>${headName}</strong> (Đại diện Hộ gia đình)${hh.self_management_group ? ` ${hh.self_management_group.trim().toLowerCase().startsWith('tổ') || hh.self_management_group.trim().toLowerCase().startsWith('cụm') ? hh.self_management_group.trim() : `Tổ ${hh.self_management_group.trim()}`}` : ''}</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Địa chỉ:</td>
            <td style="text-align: left;">${hh.address || tdpNameVal} (Sổ hộ khẩu số: ${hh.household_number || '—'})</td>
          </tr>
          <tr>
            <td class="receipt-info-label" style="font-weight: bold; text-align: left;">Lý do nộp:</td>
            <td style="text-align: left;">Nộp các khoản đóng góp năm ${fundYear}</td>
          </tr>
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
              <td colspan="2" style="text-align: center; font-weight: bold;">TỔNG CỘNG</td>
              <td style="text-align: right; font-weight: bold; color: #15803d;">${formatCurrency(totalPaid)} đ</td>
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
            <td style="width: 20%;">Tổ Trưởng Tổ Dân phố</td>
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
            <td style="vertical-align: bottom; height: 55px; padding-top: 4px;">
              <div style="height: 38px; display: flex; align-items: center; justify-content: center; margin-bottom: 1px;">
                ${thuQuySigUrl ? `<img src="${thuQuySigUrl}" alt="Chữ ký" style="height: 38px; max-height: 38px; max-width: 100px; object-fit: contain;" />` : ''}
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

  const handlePrintBulkReceiptsA5 = async () => {
    if (filteredHouseholdsForFunds.length === 0) {
      showToast('Không có dữ liệu hộ dân nào để in!', 'warning');
      return;
    }

    let wardFundsList: WardFund[] = [];
    try {
      wardFundsList = await db.getWardFunds(fundYear);
    } catch { /* ignore */ }

    let freshDbResidents: Resident[] = [];
    try {
      freshDbResidents = await db.getResidents();
    } catch {
      freshDbResidents = residents;
    }

    const isResidentActiveInHousehold = (r: Resident, hhId: string) => {
      if (String(r.household_id || '') !== String(hhId)) return false;
      const status = (r.status || 'resident').toString().toLowerCase().trim();
      if (['deceased', 'qua_doi', 'moved_out', 'chuyen_di', 'inactive', 'deleted', 'tam_vang'].includes(status)) {
        return false;
      }
      return true;
    };

    const listToPrint: Array<{
      household: Household;
      members: Resident[];
      memberWardRecords: WardFund[];
      filteredHhFunds: HouseholdFund[];
    }> = [];

    for (const hh of filteredHouseholdsForFunds) {
      const hhFunds = householdFunds.filter(hf => String(hf.household_id) === String(hh.id) && hf.year === fundYear);
      const totalTdp = hhFunds.reduce((sum, hf) => sum + hf.amount, 0);

      const householdResidents = freshDbResidents.filter(r => isResidentActiveInHousehold(r, hh.id));

      const memberWardRecords = wardFundsList.filter(f => {
        if (f.year !== fundYear) return false;
        if (f.user_id && householdResidents.some(m => m.id === f.user_id)) return true;
        if (f.full_name && householdResidents.some(m => m.full_name.trim().toLowerCase() === f.full_name.trim().toLowerCase())) return true;
        return false;
      });

      const activeMemberIds = new Set(memberWardRecords.map(f => f.user_id).filter(Boolean));
      const activeMemberNames = new Set(memberWardRecords.map(f => (f.full_name || '').trim().toLowerCase()));

      const activeMembers = memberWardRecords.length > 0
        ? householdResidents.filter(r => {
            if (r.id && activeMemberIds.has(r.id)) return true;
            if (r.full_name && activeMemberNames.has(r.full_name.trim().toLowerCase())) return true;
            return false;
          })
        : householdResidents;

      if (activeMembers.length === 0) continue;

      const totalWard = memberWardRecords.reduce((sum, r) => {
        let rSum = 0;
        const wardActiveFunds = (db as any).getWardFundList();
        wardActiveFunds.forEach((fund: any) => {
          rSum += r.contributions?.[fund.name]?.actual || 0;
        });
        return sum + rSum;
      }, 0);

      if (totalTdp + totalWard > 0) {
        listToPrint.push({
          household: hh,
          members: activeMembers,
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

    const sortedList = [...listToPrint].sort((a, b) => {
      const gA = a.household.self_management_group || '';
      const gB = b.household.self_management_group || '';
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      const rA = idxA !== -1 ? idxA : 999;
      const rB = idxB !== -1 ? idxB : 999;
      if (rA !== rB) return rA - rB;
      const nameA = getHouseholdHeadName(a.household).toLowerCase();
      const nameB = getHouseholdHeadName(b.household).toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const receiptsHtml = sortedList.map((item, idx) => {
      const tdpNameVal = tdpMap[item.household.user_id || ''] || localStorage.getItem('tdp_name') || 'Tổ dân phố';
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
      const isLast = idx === sortedList.length - 1;
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
                    labelTd.innerHTML = 'TỔNG CỘNG THỰC THU (TDP: ' + tdpTotal.toLocaleString('vi-VN') + ' đ + PHƯỜNG: ' + wardTotal.toLocaleString('vi-VN') + ' đ)';

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

  const handlePrintBulkReceiptsA4_1PerPage = () => {
    if (filteredHouseholdsForFunds.length === 0) {
      showToast('Không có dữ liệu hộ dân nào để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

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

    // Sắp xếp hộ dân theo Tổ/Cụm rồi đến tên chủ hộ trước khi in
    const sortedHouseholds = [...filteredHouseholdsForFunds].sort((a, b) => {
      const gA = a.self_management_group || '';
      const gB = b.self_management_group || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = getHouseholdHeadName(a).toLowerCase();
      const nameB = getHouseholdHeadName(b).toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const householdsToPrint = sortedHouseholds.filter(hh => {
      const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
      return totalPaid > 0;
    });

    if (householdsToPrint.length === 0) {
      showToast('Không có hộ gia đình nào đã nộp tiền trong danh sách để in phiếu thu!', 'warning');
      printWindow.close();
      return;
    }

    const receiptsHtml = householdsToPrint.map(hh => {
      const tdpNameVal = tdpMap[hh.user_id || ''] || localStorage.getItem('tdp_name') || 'Tổ dân phố';
      return generateStateReceiptHtml(hh, dateText, tdpNameVal, wardNameVal, leaderName, leaderSigUrl);
    }).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In loạt phiếu thu A4 (1 phiếu/trang) - ${householdsToPrint.length} hộ</title>
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

  const handlePrintBulkReceiptsA4 = () => {
    if (filteredHouseholdsForFunds.length === 0) {
      showToast('Không có dữ liệu hộ dân nào để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

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

    // Sắp xếp hộ dân theo Tổ/Cụm rồi đến tên chủ hộ trước khi in
    const sortedHouseholds = [...filteredHouseholdsForFunds].sort((a, b) => {
      const gA = a.self_management_group || '';
      const gB = b.self_management_group || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const nameA = getHouseholdHeadName(a).toLowerCase();
      const nameB = getHouseholdHeadName(b).toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const householdsToPrint = sortedHouseholds.filter(hh => {
      const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
      return totalPaid > 0;
    });

    if (householdsToPrint.length === 0) {
      showToast('Không có hộ gia đình nào đã nộp tiền trong danh sách để in phiếu thu!', 'warning');
      printWindow.close();
      return;
    }

    const pagesHtmlList: string[] = [];
    for (let i = 0; i < householdsToPrint.length; i += 2) {
      const hh1 = householdsToPrint[i];
      const tdpName1 = tdpMap[hh1.user_id || ''] || localStorage.getItem('tdp_name') || 'Tổ dân phố';
      const receipt1 = generateStateReceiptHtml(hh1, dateText, tdpName1, wardNameVal, leaderName, leaderSigUrl);

      const hh2 = householdsToPrint[i + 1];
      let receipt2 = '';
      if (hh2) {
        const tdpName2 = tdpMap[hh2.user_id || ''] || localStorage.getItem('tdp_name') || 'Tổ dân phố';
        receipt2 = generateStateReceiptHtml(hh2, dateText, tdpName2, wardNameVal, leaderName, leaderSigUrl);
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
        <title>In loạt phiếu thu A4 (2 phiếu/trang) - ${filteredHouseholdsForFunds.length} hộ</title>
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
            font-size: 9.5pt;
            line-height: 1.3;
            text-align: left;
          }
          .receipt-form-title {
            text-align: right;
            font-size: 9pt;
            line-height: 1.2;
          }
          .receipt-title-container {
            text-align: center;
            margin-top: 6px;
            margin-bottom: 8px;
          }
          .receipt-title {
            font-size: 13.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 2px 0;
            letter-spacing: 0.5px;
          }
          .receipt-subtitle {
            font-style: italic;
            font-size: 9.5pt;
            margin: 0;
          }
          .receipt-info-table {
            width: 100%;
            margin-bottom: 6px;
            border-collapse: collapse;
          }
          .receipt-info-table td {
            padding: 2px 0;
            font-size: 10pt;
          }
          .receipt-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            margin-bottom: 6px;
          }
          .receipt-details-table th, .receipt-details-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            font-size: 9.5pt;
            vertical-align: middle;
          }
          .receipt-details-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
          }
          .receipt-total-row {
            font-weight: bold;
            background-color: #fafafa;
          }
          .receipt-signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            page-break-inside: avoid;
          }
          .receipt-signatures-table td {
            border: none;
            text-align: center;
            font-size: 9.5pt;
            vertical-align: top;
            padding: 2px;
          }
          .cut-line {
            border-top: 1px dashed #64748b;
            text-align: center;
            font-size: 8pt;
            color: #64748b;
            margin: 5mm 0;
            user-select: none;
            position: relative;
          }
          .cut-line span {
            position: relative;
            top: -9px;
            background: #fff;
            padding: 0 10px;
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

  // Calculations
  const totalIncome = records
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const balance = totalIncome - totalExpense;

  const sponsorTotal = useMemo(() => {
    return records
      .filter(r => r.type === 'income')
      .filter(r => {
        const cat = (r.category || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        return cat.includes('mạnh thường quân') || 
               cat.includes('tài trợ') || 
               cat.includes('ủng hộ') || 
               cat.includes('mừng') || 
               cat.includes('quyên góp') ||
               desc.includes('mạnh thường quân') || 
               desc.includes('tài trợ') || 
               desc.includes('ủng hộ') || 
               desc.includes('mừng') ||
               desc.includes('quyên góp');
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }, [records]);

  const recordedByOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.recorded_by && r.recorded_by.trim() && r.recorded_by !== 'Hệ thống tự động') {
        set.add(r.recorded_by.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  const creatorStats = useMemo(() => {
    if (recordedByFilter === 'all') return null;
    const userRecords = records.filter(r => (r.recorded_by || '').trim().toLowerCase() === recordedByFilter.trim().toLowerCase());
    const income = userRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const expense = userRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const count = userRecords.length;
    return {
      name: recordedByFilter,
      income,
      expense,
      balance: income - expense,
      count
    };
  }, [records, recordedByFilter]);

  const filteredRecords = useMemo(() => records.filter(r => {
    // Ẩn các bản ghi tự động đồng bộ từ việc đóng quỹ của các hộ dân
    if (r.description.includes('[QUY_') || r.recorded_by === 'Hệ thống tự động') {
      return false;
    }
    const matchesType = activeType === 'all' || r.type === activeType;
    const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.recorded_by.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRecordedBy = recordedByFilter === 'all' || (r.recorded_by || '').trim().toLowerCase() === recordedByFilter.trim().toLowerCase();
    return matchesType && matchesSearch && matchesRecordedBy;
  }), [records, activeType, searchTerm, recordedByFilter]);

  const formatCurrency = (amt: number) => {
    if (amt === undefined || amt === null || isNaN(amt)) return '0';
    return new Intl.NumberFormat('vi-VN').format(amt);
  };

  const cleanDescription = (desc: string) => {
    if (!desc) return '';
    return desc.replace(/\[QUY_[^\]]+\]/g, '').trim();
  };

  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(clean));
  };

  // 1. Tối ưu hóa hiệu năng: Tạo Map tra cứu tổng số tiền đã nộp theo householdId & year (chỉ tính các quỹ đang hoạt động)
  const totalPaidLookup = useMemo(() => {
    const map = new Map<string, number>();
    const activeSet = new Set(fundNames);
    householdFunds.forEach(f => {
      if (activeSet.has(f.fund_name)) {
        const key = `${f.household_id}_${f.year}`;
        map.set(key, (map.get(key) || 0) + f.amount);
      }
    });
    return map;
  }, [householdFunds, fundNames]);

  // 2. Tối ưu hóa hiệu năng: Tạo Map tra cứu danh sách các khoản nộp của từng hộ trong năm hiện tại (chỉ lấy quỹ đang hoạt động)
  const hhFundsMap = useMemo(() => {
    const map = new Map<string, typeof householdFunds>();
    const activeSet = new Set(fundNames);
    householdFunds.forEach(f => {
      if (f.year === fundYear && activeSet.has(f.fund_name)) {
        if (!map.has(f.household_id)) {
          map.set(f.household_id, []);
        }
        map.get(f.household_id)!.push(f);
      }
    });
    return map;
  }, [householdFunds, fundYear, fundNames]);

  // 3. Tối ưu hóa hiệu năng: Tạo Map tra cứu nhanh các khoản nộp của hộ để tính toán thống kê (chỉ lấy quỹ đang hoạt động)
  const fundPaymentsLookup = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const activeSet = new Set(fundNames);
    householdFunds.forEach(f => {
      if (f.year === fundYear && f.amount > 0 && activeSet.has(f.fund_name)) {
        if (!map.has(f.household_id)) {
          map.set(f.household_id, new Map());
        }
        map.get(f.household_id)!.set(f.fund_name, f.amount);
      }
    });
    return map;
  }, [householdFunds, fundYear, fundNames]);

  const filteredHouseholdsForFunds = useMemo(() => {
    const list = households.filter(hh => {
      const headName = getHouseholdHeadName(hh).toLowerCase();
      const address = (hh.address || '').toLowerCase();
      const householdNumber = (hh.household_number || '').toLowerCase();
      const search = fundSearchTerm.toLowerCase();
      const matchesSearch = headName.includes(search) || address.includes(search) || householdNumber.includes(search);
      
      if (!matchesSearch) return false;
      
      const totalPaid = totalPaidLookup.get(`${hh.id}_${fundYear}`) || 0;
      
      if (fundFilterStatus === 'paid') {
        if (totalPaid === 0) return false;
      } else if (fundFilterStatus === 'unpaid') {
        if (totalPaid > 0) return false;
      }

      // Lọc theo phân quyền Tổ (cấp TDP) hoặc TDP (cấp phường)
      const matchesTdp = !isWardUser || tdpFilter === 'all' || hh.user_id === tdpFilter;
      const matchesGroup = isWardUser || fundGroupFilter === 'all' || hh.self_management_group === fundGroupFilter;
      
      return matchesTdp && matchesGroup;
    });

    return list.sort((a, b) => {
      const gA = a.self_management_group || '';
      const gB = b.self_management_group || '';
      
      const idxA = groups.findIndex(g => g.trim().toLowerCase() === gA.trim().toLowerCase());
      const idxB = groups.findIndex(g => g.trim().toLowerCase() === gB.trim().toLowerCase());
      
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      // Nếu cùng tổ thì xếp theo tên chủ hộ
      const nameA = getHouseholdHeadName(a).toLowerCase();
      const nameB = getHouseholdHeadName(b).toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [households, totalPaidLookup, fundSearchTerm, fundYear, fundFilterStatus, fundGroupFilter, tdpFilter, isWardUser, groups]);

  // 4. Tối ưu hóa hiệu năng: Tính toán nhanh thông số thống kê cho các thẻ 3D
  const fundStatistics = useMemo(() => {
    const stats: Record<string, { paidCount: number; totalCollected: number }> = {};
    fundNames.forEach(name => {
      stats[name] = { paidCount: 0, totalCollected: 0 };
    });
    filteredHouseholdsForFunds.forEach(hh => {
      const hhPayments = fundPaymentsLookup.get(hh.id);
      if (hhPayments) {
        hhPayments.forEach((amount, fundName) => {
          if (stats[fundName]) {
            stats[fundName].paidCount += 1;
            stats[fundName].totalCollected += amount;
          }
        });
      }
    });
    return stats;
  }, [filteredHouseholdsForFunds, fundNames, fundPaymentsLookup]);

  return (
    <div className="finance-container">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Thu chi cộng đồng</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Quản lý và công khai minh bạch tài chính của Tổ dân phố.
          </p>
          {subTab === 'ledger' && (
            <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {canPrintExport && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleExportExcel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    color: '#0f766e',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    height: 'auto',
                    minHeight: '36px',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#ccfbf1';
                    e.currentTarget.style.borderColor = '#99f6e4';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdfa';
                    e.currentTarget.style.borderColor = '#ccfbf1';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Download size={16} /> Sổ thu chi
                </button>
              )}
              {!isGuest && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleOpenAdd}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    height: 'auto',
                    minHeight: '36px',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(37, 99, 235, 0.35)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.25)';
                  }}
                >
                  <Plus size={16} /> Lập phiếu mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Điều hướng tab cấp 2 - Phong cách 3D / 2D Premium */}
      <div className="finance-tabs-nav" style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '24px',
        padding: '6px',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        width: 'fit-content',
        flexWrap: 'wrap'
      }}>
        <button 
          className={`finance-tab-btn ${subTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setSubTab('ledger')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 24px',
            borderRadius: '12px',
            border: subTab === 'ledger' ? 'none' : '1.5px solid var(--border)',
            cursor: 'pointer',
            fontSize: '0.92rem',
            fontWeight: '750',
            background: subTab === 'ledger' 
              ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' 
              : 'var(--bg-main)',
            color: subTab === 'ledger' ? '#ffffff' : 'var(--text-main)',
            boxShadow: subTab === 'ledger' 
              ? '0 6px 16px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -3px 0 rgba(0,0,0,0.2)' 
              : '0 2px 4px rgba(0,0,0,0.02)',
            transform: subTab === 'ledger' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <BookOpen size={17} /> 📙 Sổ quỹ thu chi
        </button>
        {!isTrangChuDemo && (
          <button 
            className={`finance-tab-btn ${subTab === 'funds' ? 'active' : ''}`}
            onClick={() => setSubTab('funds')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 24px',
              borderRadius: '12px',
              border: subTab === 'funds' ? 'none' : '1.5px solid var(--border)',
              cursor: 'pointer',
              fontSize: '0.92rem',
              fontWeight: '750',
              background: subTab === 'funds' 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : 'var(--bg-main)',
              color: subTab === 'funds' ? '#ffffff' : 'var(--text-main)',
              boxShadow: subTab === 'funds' 
                ? '0 6px 16px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -3px 0 rgba(0,0,0,0.2)' 
                : '0 2px 4px rgba(0,0,0,0.02)',
              transform: subTab === 'funds' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Users size={17} /> 🏡 Quản lý thu Quỹ theo Hộ dân
          </button>
        )}
      </div>

      {subTab === 'ledger' ? (
        <>
          <div className="finance-stats">
            <div className="finance-stat-card total">
              <div className="stat-icon"><DollarSign size={24} /></div>
              <div className="stat-details">
                 <span className="label">Số dư quỹ hiện tại</span>
                 <h2 className="value">{formatCurrency(balance)}</h2>
              </div>
            </div>
            <div className="finance-stat-card income">
              <div className="stat-icon"><TrendingUp size={24} /></div>
              <div className="stat-details">
                 <span className="label">Tổng thu tích lũy</span>
                 <h2 className="value text-success">{formatCurrency(totalIncome)}</h2>
              </div>
            </div>
            <div className="finance-stat-card expense">
              <div className="stat-icon"><TrendingDown size={24} /></div>
              <div className="stat-details">
                 <span className="label">Tổng chi tích lũy</span>
                 <h2 className="value text-danger">{formatCurrency(totalExpense)}</h2>
              </div>
            </div>
            <div className="finance-stat-card sponsor" style={{
              borderLeft: '4px solid #16a34a',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
            }}>
              <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                <HeartHandshake size={24} />
              </div>
              <div className="stat-details">
                 <span className="label" style={{ fontWeight: '600', color: '#15803d' }}>
                   🎁 Ủng hộ / Mạnh thường quân
                 </span>
                 <h2 className="value" style={{ color: '#15803d', fontWeight: '800' }}>
                   {formatCurrency(sponsorTotal)}
                 </h2>
              </div>
            </div>
          </div>

          <div className="content-filters" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="filter-tabs">
              <button className={`tab ${activeType === 'all' ? 'active' : ''}`} onClick={() => setActiveType('all')}>Tất cả</button>
              <button className={`tab ${activeType === 'income' ? 'active' : ''}`} onClick={() => setActiveType('income')}>Khoản thu</button>
              <button className={`tab ${activeType === 'expense' ? 'active' : ''}`} onClick={() => setActiveType('expense')}>Khoản chi</button>
            </div>
            
            {/* Bộ lọc theo người lập phiếu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-card)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                👤 Người lập:
              </span>
              <select 
                value={recordedByFilter}
                onChange={(e) => setRecordedByFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-main)',
                  color: recordedByFilter !== 'all' ? '#1d4ed8' : 'var(--text-main)',
                  fontSize: '0.83rem',
                  fontWeight: recordedByFilter !== 'all' ? '700' : '600',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="all">Tất cả người lập</option>
                {recordedByOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="search-and-date">
                <div className="search-mini">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Tìm nội dung, danh mục..." 
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <button className="date-filter"><Calendar size={16} /> Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</button>
            </div>
          </div>

          {/* Banner Thống kê riêng cho Người Lập Phiếu được chọn */}
          {creatorStats && (
            <div style={{
              marginBottom: '16px',
              padding: '14px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1.5px solid #93c5fd',
              boxShadow: '0 4px 12px rgba(37,99,235,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  👤 THỐNG KÊ GIAO DỊCH CỦA NGƯỜI LẬP: <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>{creatorStats.name}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '3px' }}>
                  Tổng cộng <strong>{creatorStats.count}</strong> chứng từ đã lập
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '600' }}>🟢 Tổng Thu: </span>
                  <strong style={{ fontSize: '0.95rem', color: '#15803d' }}>{formatCurrency(creatorStats.income)} đ</strong>
                </div>
                <div style={{ background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: '600' }}>🔴 Tổng Chi: </span>
                  <strong style={{ fontSize: '0.95rem', color: '#b91c1c' }}>{formatCurrency(creatorStats.expense)} đ</strong>
                </div>
                <div style={{ background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '600' }}>🔵 Cân Đối: </span>
                  <strong style={{ fontSize: '0.95rem', color: creatorStats.balance >= 0 ? '#1d4ed8' : '#b91c1c' }}>{formatCurrency(creatorStats.balance)} đ</strong>
                </div>
                <button 
                  onClick={() => setRecordedByFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    background: '#ffffff',
                    color: '#1d4ed8',
                    fontWeight: '600',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  ✖ Bỏ lọc người lập
                </button>
              </div>
            </div>
          )}

          <div className="finance-table-wrapper">
             <table className="data-table">
                <thead>
                   <tr>
                      <th>Ngày lập</th>
                      <th>Nội dung</th>
                      <th>Danh mục</th>
                      <th>Người lập</th>
                      <th style={{textAlign: 'right'}}>Số tiền</th>
                      {!isGuest && <th style={{textAlign: 'right', paddingRight: '20px'}}>Hành động</th>}
                   </tr>
                </thead>
                <tbody>
                   {filteredRecords.map(t => (
                      <tr key={t.id}>
                         <td className="date-cell">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                         <td className="title-cell">
                            <div className={`type-indicator ${t.type}`}></div>
                            {cleanDescription(t.description)}
                         </td>
                         <td><span className="category-tag">{t.category}</span></td>
                         <td>{t.recorded_by}</td>
                         <td className={`amount-cell ${t.type === 'income' ? 'success' : 'danger'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                         </td>
                         {!isGuest && (
                           <td style={{textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '16px'}}>
                              <button type="button" onClick={() => setPrintModalRecord(t)} title="In phiếu chứng từ (mẫu chuẩn 4 chữ ký)" style={{ marginRight: '6px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700' }}><Printer size={13} /> In</button>
                               <button 
                                className="icon-btn-action edit-btn" 
                                onClick={() => handleOpenEdit(t)}
                                title="Chỉnh sửa phiếu"
                                style={{marginRight: '6px'}}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                className="icon-btn-action delete-btn" 
                                onClick={() => handleDelete(t.id)}
                                title="Xóa phiếu"
                              >
                                <Trash2 size={13} />
                              </button>
                           </td>
                         )}
                      </tr>
                   ))}
                   {filteredRecords.length === 0 && (
                     <tr>
                       <td colSpan={6} style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
                         Không tìm thấy giao dịch nào.
                       </td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>

          {/* New Voucher Modal */}
          {isFormOpen && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '650px', width: '90%' }}>
                <div className="modal-header">
                  <h2>{editingRecord ? 'Chỉnh sửa phiếu thu / chi' : 'Lập phiếu thu / chi mới'}</h2>
                  <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                  <div className="form-group">
                    <label>Loại phiếu *</label>
                    <select value={type} onChange={(e: any) => setType(e.target.value)}>
                      <option value="income">Phiếu Thu (Cộng tiền vào quỹ)</option>
                      <option value="expense">Phiếu Chi (Trừ tiền khỏi quỹ)</option>
                    </select>
                  </div>

                  {/* Bảng chi tiết các khoản - Tự động tính tổng */}
                  <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontWeight: 'bold', color: '#1e293b', margin: 0, fontSize: '0.9rem' }}>
                        📋 Chi tiết các khoản {type === 'income' ? 'thu' : 'chi'} (Tự động cộng tổng)
                      </label>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          setFormItems([...formItems, { id: generateUUID(), name: '', amount: '' }]);
                        }}
                      >
                        <Plus size={14} /> Thêm khoản
                      </button>
                    </div>

                    {formItems.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {formItems.map((item, index) => (
                          <div key={item.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '18px', color: '#64748b' }}>{index + 1}.</span>
                            <input 
                              type="text" 
                              placeholder="Tên khoản (VD: Quỹ VSMT, Quỹ An ninh...)" 
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[index].name = e.target.value;
                                setFormItems(newItems);
                                const validItems = newItems.filter(i => i.name.trim() || i.amount);
                                if (validItems.length > 0) {
                                  const autoDesc = validItems.map(i => `${i.name || 'Khoản thu'}${i.amount ? ` (${i.amount}đ)` : ''}`).join(', ');
                                  setDescription(autoDesc);
                                }
                              }}
                              style={{ flex: 2, padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                            <input 
                              type="text" 
                              placeholder="Số tiền (VND)" 
                              value={item.amount}
                              onChange={(e) => {
                                const formatted = formatInputNumber(e.target.value);
                                const newItems = [...formItems];
                                newItems[index].amount = formatted;
                                setFormItems(newItems);

                                const total = newItems.reduce((sum, it) => {
                                  const num = parseInt((it.amount || '').replace(/[^\d]/g, ''), 10) || 0;
                                  return sum + num;
                                }, 0);

                                if (total > 0) {
                                  setAmount(total.toLocaleString('vi-VN'));
                                } else {
                                  setAmount('');
                                }
                              }}
                              style={{ flex: 1.2, padding: '6px 10px', fontSize: '0.85rem', textAlign: 'right', fontWeight: '600', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                            <button 
                              type="button"
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              onClick={() => {
                                const newItems = formItems.filter(i => i.id !== item.id);
                                setFormItems(newItems);
                                const total = newItems.reduce((sum, it) => {
                                  const num = parseInt((it.amount || '').replace(/[^\d]/g, ''), 10) || 0;
                                  return sum + num;
                                }, 0);
                                setAmount(total > 0 ? total.toLocaleString('vi-VN') : '');
                              }}
                              title="Xóa khoản này"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: '#15803d', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                          👉 Tổng cộng các khoản: <span style={{ fontSize: '1rem', color: '#b91c1c' }}>{formItems.reduce((sum, it) => sum + (parseInt((it.amount || '').replace(/[^\d]/g, ''), 10) || 0), 0).toLocaleString('vi-VN')}</span> VNĐ
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                        Bấm "+ Thêm khoản" nếu muốn nhập danh sách chi tiết các khoản thu/chi để hệ thống tự động tính tổng tiền.
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Tổng số tiền (VND) * {formItems.length > 0 && <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 'normal' }}>(Đã tự động tính tổng)</span>}</label>
                    <input 
                      type="text" 
                      value={amount}
                      onChange={(e) => setAmount(formatInputNumber(e.target.value))}
                      placeholder="Ví dụ: 500.000"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Danh mục {type === 'income' ? 'thu' : 'chi'} *</label>
                    <input 
                      type="text" 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={type === 'expense' ? "Ví dụ: Chi hoạt động TDP, Chi khác: Mua loa kéo..." : "Ví dụ: Mạnh thường quân ủng hộ, Thu khác..."}
                      required
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Gợi ý nhanh:</span>
                      {type === 'income' ? (
                        <>
                          <button type="button" onClick={() => setCategory('Mạnh thường quân ủng hộ')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🎁 Mạnh thường quân ủng hộ</button>
                          <button type="button" onClick={() => setCategory('Đơn vị mừng / Tài trợ')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>💐 Đơn vị mừng / Tài trợ</button>
                          <button type="button" onClick={() => setCategory('Ủng hộ / Quyên góp')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fef08a', background: '#fefce8', color: '#a16207', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🤝 Ủng hộ / Quyên góp</button>
                          <button type="button" onClick={() => setCategory('Thu khác')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>Thu khác</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setCategory('Chi hoạt động TDP')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>📢 Chi hoạt động TDP</button>
                          <button type="button" onClick={() => setCategory('Chi thăm hỏi / Hiếu hỷ')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>❤️ Chi thăm hỏi / Hiếu hỷ</button>
                          <button type="button" onClick={() => setCategory('Chi sửa chữa / Sắm thiết bị')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #e9d5ff', background: '#faf5ff', color: '#7e22ce', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🛠️ Chi sửa chữa / Sắm thiết bị</button>
                          <button type="button" onClick={() => setCategory('Chi khác')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>Chi khác</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Nội dung chi tiết *</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ví dụ: Thu phí vệ sinh ngõ 45 quý 2"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>{type === 'expense' ? 'Người nhận tiền / Đơn vị nhận *' : 'Người nộp tiền / Đơn vị nộp'}</label>
                      <input 
                        type="text" 
                        value={payer}
                        onChange={(e) => setPayer(e.target.value)}
                        placeholder={type === 'expense' ? "Tên người nhận tiền thực tế..." : "Tên người nộp tiền..."}
                        required={type === 'expense'}
                      />
                    </div>
                    <div className="form-group">
                      <label>Người lập phiếu *</label>
                      <input 
                        type="text" 
                        value={recordedBy}
                        onChange={(e) => setRecordedBy(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {type === 'expense' && payer.trim() && recordedBy.trim() && payer.trim().toLowerCase() === recordedBy.trim().toLowerCase() && (
                    <div style={{ padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>
                      ⚠️ Lưu ý: Theo quy định tài chính, Người nhận tiền không được trùng tên với Người lập phiếu!
                    </div>
                  )}

                  <div className="form-group">
                    <label>Ngày ghi nhận *</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                    <button type="submit" className="btn btn-primary">Lưu phiếu</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="funds-matrix-view" style={{ animation: 'fadeIn 0.3s ease' }}>
          {isKeToan && (
            <div style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ℹ️ <strong>Chế độ Kế toán:</strong> Bạn đang xem danh sách thu quỹ theo hộ dân (Chế độ chỉ xem thông tin, không được phép ghi nhận/chỉnh sửa).
            </div>
          )}
          {/* Thống kê Quỹ nổi 3D */}
          {!isWardUser && canPrintExport && (
            <div className="fund-stats-3d-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {fundNames.map((fundName, index) => {
                const stats = fundStatistics[fundName] || { paidCount: 0, totalCollected: 0 };
                const totalCollectedForFund = stats.totalCollected;
                const paidCount = stats.paidCount;

                // Tính toán tỷ lệ % thu được
                const fundList = db.getFundList();
                const fundConfig = fundList.find(f => f.name === fundName);
                const targetAmount = fundConfig ? fundConfig.target : 0;
                
                let percent = 0;
                const totalHouseholdsInScope = filteredHouseholdsForFunds.length;
                if (totalHouseholdsInScope > 0) {
                  if (targetAmount > 0) {
                    percent = Math.round((totalCollectedForFund / (totalHouseholdsInScope * targetAmount)) * 100);
                  } else {
                    percent = Math.round((paidCount / totalHouseholdsInScope) * 100);
                  }
                }

                const colors = [
                  { text: '#1e3a8a', border: '#dbeafe' }, // Blue
                  { text: '#166534', border: '#dcfce7' }, // Green
                  { text: '#78350f', border: '#fef3c7' }, // Yellow
                  { text: '#581c87', border: '#e9d5ff' }, // Purple
                  { text: '#831843', border: '#fbcfe8' }, // Pink
                  { text: '#742a2a', border: '#fed7d7' }  // Red
                ];
                const color = colors[index % colors.length];

                return (
                  <div 
                    key={fundName} 
                    className="fund-3d-card"
                    style={{
                      backgroundColor: 'white',
                      border: `1.5px solid ${color.border}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      boxShadow: `0 4px 0 ${color.border}, 0 8px 12px -4px rgba(0, 0, 0, 0.05)`,
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: '75px',
                      cursor: 'default',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(2px)';
                      e.currentTarget.style.boxShadow = `0 2px 0 ${color.border}, 0 4px 8px -3px rgba(0, 0, 0, 0.04)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 4px 0 ${color.border}, 0 8px 12px -4px rgba(0, 0, 0, 0.05)`;
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>
                        {fundName}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        backgroundColor: percent >= 100 ? '#dcfce7' : '#eff6ff',
                        color: percent >= 100 ? '#15803d' : '#1d4ed8',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        border: percent >= 100 ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
                      }}>
                        {percent}%
                      </div>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: color.text, lineHeight: '1.2' }}>
                      {targetAmount > 0 ? `${formatCurrency(targetAmount)} đ/hộ` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginTop: '4px' }}>
                      Đã thu: <strong style={{ color: '#16a34a' }}>{formatCurrency(totalCollectedForFund)} đ</strong> ({paidCount} hộ)
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {/* Hàng 1: Bộ lọc năm, trạng thái, tổ và tổng số tiền thu được */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Năm đóng quỹ:</label>
                <select 
                  value={fundYear} 
                  onChange={(e) => setFundYear(parseInt(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none' }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Trạng thái:</label>
                <select 
                  value={fundFilterStatus} 
                  onChange={(e) => setFundFilterStatus(e.target.value as any)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none' }}
                >
                  <option value="all">Tất cả các hộ</option>
                  <option value="paid">Hộ đã nộp</option>
                  <option value="unpaid">Hộ chưa nộp</option>
                </select>
              </div>
              
              {/* Lọc Tổ / TDP tùy theo phân quyền */}
              {isWardUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Tổ dân phố:</label>
                  <select 
                    value={tdpFilter} 
                    onChange={(e) => setTdpFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none', minWidth: '150px' }}
                  >
                    <option value="all">Tất cả TDP</option>
                    {tdpList.map(t => (
                      <option key={t.id} value={t.id}>{t.tdp_name || t.full_name || 'Tổ dân phố'}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Tổ tự quản:</label>
                  <select 
                    value={fundGroupFilter} 
                    onChange={(e) => setFundGroupFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none', minWidth: '130px' }}
                  >
                    <option value="all">Tất cả Tổ</option>
                    {groups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dòng chữ Tổng thu quỹ địa phương đẩy về bên phải */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Tổng thu quỹ địa phương {fundYear}: <strong style={{ color: 'var(--success)' }}>
                    {formatCurrency(
                      householdFunds
                        .filter(f => f.year === fundYear)
                        .reduce((sum, f) => sum + f.amount, 0)
                    )}
                  </strong>
                </span>
              </div>
            </div>

            {/* Hàng 2: Tìm kiếm bên trái (ngắn lại) và các nút in ấn / Excel sát ngay bên phải nó */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ width: '240px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px' }} />
                <DebouncedInput
                  value={fundSearchInput}
                  onChange={setFundSearchInput}
                  debounce={300}
                  placeholder="Tìm theo tên chủ hộ, địa chỉ..."
                  style={{ paddingLeft: '38px', paddingRight: fundSearchInput ? '36px' : '12px' }}
                />
                {fundSearchInput && (
                  <button
                    type="button"
                    onClick={() => { setFundSearchInput(''); }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {canPrintExport && (
                <>
                  <button 
                    onClick={handlePrintCombinedNotice}
                    title="In mẫu Thông báo dự kiến thu các khoản đóng góp tự nguyện gộp Quỹ TDP & Quỹ Phường"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#8b5cf6',
                      border: '1.5px solid #7c3aed',
                      color: '#fff',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#7c3aed';
                      e.currentTarget.style.borderColor = '#6d28d9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#8b5cf6';
                      e.currentTarget.style.borderColor = '#7c3aed';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Printer size={16} /> In Thông báo dự kiến thu (Mẫu chuẩn)
                  </button>

                  <button 
                    onClick={handlePrintFundsList}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Printer size={16} /> In danh sách A4
                  </button>

                  <button 
                    onClick={handlePrintBulkReceiptsA5}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.borderColor = '#86efac';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#bbf7d0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Printer size={16} /> In loạt phiếu A5
                  </button>

                  <button 
                    onClick={handleExportFundsExcel}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#16a34a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.borderColor = '#86efac';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#bbf7d0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Download size={16} style={{ color: '#16a34a' }} /> Xuất Excel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Matrix table */}
          <div className="finance-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <table className="data-table" style={{ minWidth: '1300px', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f0fdf4', color: '#166534' }}>
                  <th style={{ width: '250px', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Hộ gia đình / Chủ hộ</th>
                  <th style={{ width: '130px', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Tổng đã nộp</th>
                  {fundNames.map((name, i) => {
                    const fundConfig = fundList.find(f => f.name === name);
                    const targetAmt = fundConfig ? fundConfig.target : 0;
                    return (
                      <th key={i} style={{ textAlign: 'center', fontSize: '0.8rem', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>
                        <div>{name}</div>
                        {targetAmt > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#4b7c59', fontWeight: '600', marginTop: '2px', fontStyle: 'italic' }}>
                            {formatCurrency(targetAmt)}đ/hộ
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th style={{ width: '110px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Biên lai</th>
                </tr>
              </thead>
              <tbody>
                {filteredHouseholdsForFunds.slice(0, visibleCount).map((hh) => {
                  const headName = getHouseholdHeadName(hh);
                  const hhFunds = hhFundsMap.get(hh.id) || [];
                  const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
                  const isAllTdpPaid = fundList.length > 0 && fundList.every((fund) => {
                    const paidFund = hhFunds.find(f => f.fund_name === fund.name);
                    return paidFund && paidFund.amount >= fund.target;
                  });
                  
                  return (
                    <tr key={hh.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{headName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{hh.address}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: totalPaid > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatCurrency(totalPaid)}
                      </td>
                      {fundNames.map((fundName, idx) => {
                        const paidFund = hhFunds.find(f => f.fund_name === fundName);
                        const amountPaid = paidFund ? paidFund.amount : 0;
                        const fundConfig = fundList.find(f => f.name === fundName);
                        const targetAmt = fundConfig ? fundConfig.target : 0;
                        
                        return (
                          <td key={idx} style={{ textAlign: 'center' }}>
                            {amountPaid > 0 ? (
                              <button 
                                onClick={() => handleOpenFundPay(hh.id, fundName)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  border: 'none',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  color: 'var(--success)',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; }}
                                title="Bấm để sửa đổi hoặc xóa"
                              >
                                {formatCurrency(amountPaid)}
                              </button>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <button 
                                  onClick={() => handleOpenFundPay(hh.id, fundName)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    border: '1px dashed var(--border)',
                                    backgroundColor: '#f8fafc',
                                    color: 'var(--text-muted)',
                                    fontWeight: '600',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                >
                                  Chưa nộp
                                </button>
                                {targetAmt > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: '#dc2626', fontStyle: 'italic', fontWeight: '600' }}>
                                    {formatCurrency(targetAmt)}đ
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* Cột in biên lai */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handlePrintHouseholdReceipt(hh, 'tdp_only')}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1.5px solid #cbd5e1',
                              backgroundColor: '#fff',
                              color: '#374151',
                              fontWeight: '700',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: '100px',
                              justifyContent: 'center'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            title="In biên lai thu riêng các quỹ của TDP"
                          >
                            <Printer size={12} />
                            <span>In biên lai TDP</span>
                          </button>
                          <button 
                            onClick={() => handlePrintHouseholdReceipt(hh, 'combined')}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1.5px solid #c084fc',
                              backgroundColor: '#faf5ff',
                              color: '#6b21a8',
                              fontWeight: '700',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: '100px',
                              justifyContent: 'center'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3e8ff'; e.currentTarget.style.borderColor = '#a855f7'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#faf5ff'; e.currentTarget.style.borderColor = '#c084fc'; }}
                            title="In biên lai gộp các quỹ TDP và quỹ UBND Phường"
                          >
                            <Printer size={12} />
                            <span>In biên lai gộp</span>
                          </button>
                          {!isGuest && (
                            <button 
                              onClick={() => handleQuickPayHouseholdFinance(hh, isAllTdpPaid)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: isAllTdpPaid ? '#e2e8f0' : '#10b981',
                                color: isAllTdpPaid ? '#64748b' : '#fff',
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: '95px',
                                justifyContent: 'center',
                                boxShadow: isAllTdpPaid ? 'none' : '0 2px 4px rgba(16,185,129,0.2)'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isAllTdpPaid ? '#cbd5e1' : '#059669'; }}
                              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = isAllTdpPaid ? '#e2e8f0' : '#10b981'; }}
                              title={isAllTdpPaid ? "Hủy ghi nhận đóng quỹ cho hộ này" : "Ghi nhận thu nhanh toàn bộ các quỹ TDP và Phường theo thông báo"}
                            >
                              {isAllTdpPaid ? <X size={13} /> : <Check size={13} />}
                              <span>{isAllTdpPaid ? 'Hủy' : 'Thu đủ'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredHouseholdsForFunds.length === 0 && (
                  <tr>
                    <td colSpan={3 + fundNames.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      {households.length === 0 ? 'Chưa có dữ liệu hộ gia đình nào để thu quỹ.' : 'Không tìm thấy hộ gia đình nào khớp với từ khóa tìm kiếm.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredHouseholdsForFunds.length > visibleCount && (
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
              ⏬ Hiển thị thêm 150 hộ tiếp theo... (Còn {filteredHouseholdsForFunds.length - visibleCount} hộ)
            </button>
          )}

          {/* Matrix pay modal */}
          {editingFund && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '420px' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h2 style={{ fontSize: '1.15rem' }}>Ghi nhận thu Quỹ</h2>
                  <button className="close-btn" onClick={() => setEditingFund(null)}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveFund} className="modal-form" style={{ paddingTop: '12px' }}>
                  <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hộ gia đình:</div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', margin: '2px 0 6px' }}>
                      {households.find(h => h.id === editingFund.householdId) ? getHouseholdHeadName(households.find(h => h.id === editingFund.householdId)!) : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Khoản quỹ:</div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--primary)' }}>{editingFund.fundName} ({fundYear})</div>
                  </div>

                  <div className="form-group">
                    <label>Số tiền đóng (VND) *</label>
                    <input 
                      type="text" 
                      value={fundAmountInput}
                      onChange={(e) => setFundAmountInput(formatInputNumber(e.target.value))}
                      placeholder="Nhập số tiền đóng, ví dụ: 100.000"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Ngày nộp (DD/MM/YYYY) *</label>
                    <input 
                      type="text" 
                      placeholder="dd/mm/yyyy"
                      value={fundDateInput}
                      onChange={(e) => setFundDateInput(autoFormatDateInput(e.target.value))}
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Ghi chú</label>
                    <input 
                      type="text" 
                      value={fundNoteInput}
                      onChange={(e) => setFundNoteInput(e.target.value)}
                      placeholder="Ví dụ: Ông A nộp trực tiếp..."
                    />
                  </div>

                  <div className="form-actions" style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingFund(null)} style={{ flex: 1 }}>Hủy</button>
                    {householdFunds.some(f => f.household_id === editingFund.householdId && f.fund_name === editingFund.fundName && f.year === fundYear) && (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={async () => {
                          if (window.confirm('Xóa ghi nhận đóng quỹ này? Số tiền sẽ được đưa về 0 và xóa khỏi sổ quỹ.')) {
                            setFundAmountInput('0');
                            setTimeout(() => {
                              const submitBtn = document.getElementById('save-fund-submit-btn');
                              if (submitBtn) submitBtn.click();
                            }, 100);
                          }
                        }} 
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'none' }}
                      >
                        Xóa
                      </button>
                    )}
                    <button type="submit" id="save-fund-submit-btn" className="btn btn-primary" style={{ flex: 1 }}>Lưu lại</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .finance-container { animation: fadeIn 0.4s ease-out; }
        .icon-btn-action {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          background-color: #f8fafc;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }
        .icon-btn-action:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .icon-btn-action.edit-btn:hover {
          background-color: rgba(37, 99, 235, 0.08);
          border-color: var(--primary);
          color: var(--primary);
        }
        .icon-btn-action.delete-btn:hover {
          background-color: rgba(239, 68, 68, 0.08);
          border-color: var(--danger);
          color: var(--danger);
        }
        
        .finance-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .finance-stat-card {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .finance-stat-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-4px);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          color: var(--secondary);
        }

        .income .stat-icon { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .expense .stat-icon { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .total .stat-icon { background: rgba(37, 99, 235, 0.1); color: var(--primary); }

        .stat-details .label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        .stat-details .value { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }
        .text-success { color: var(--success); }
        .text-danger { color: var(--danger); }

        .content-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .filter-tabs {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
        }

        .tab {
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .tab.active {
          background: white;
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .search-and-date { display: flex; gap: 12px; }
        .search-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid var(--border);
          padding: 0 12px;
          border-radius: 8px;
        }
        .search-mini input { border: none; outline: none; padding: 8px 0; font-size: 0.9rem; width: 180px; }
        .date-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .finance-table-wrapper {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th {
          background-color: #f0fdf4;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: #166534;
          border-bottom: 2px solid #bbf7d0;
        }

        .data-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          font-size: 0.95rem;
        }

        .date-cell { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .title-cell { display: flex; align-items: center; gap: 12px; font-weight: 600; }
        .type-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .type-indicator.income { background: var(--success); }
        .type-indicator.expense { background: var(--danger); }
        .category-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; color: #475569; }
        .amount-cell { font-weight: 700; text-align: right; }
        .amount-cell.success { color: var(--success); }
        .amount-cell.danger { color: var(--danger); }

        @media (max-width: 768px) {
          .content-filters { flex-direction: column; align-items: stretch; gap: 16px; }
          .search-mini input { width: 100%; }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #printable-voucher, #printable-voucher * {
            visibility: visible;
          }
          #printable-voucher {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* PRINT VOUCHER MODAL */}
      {printModalRecord && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Control Header (Hidden when printing) */}
            <div className="no-print" style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} color={printModalRecord.type === 'expense' ? '#dc2626' : '#16a34a'} />
                Mẫu In {printModalRecord.type === 'expense' ? 'PHIẾU CHI' : 'PHIẾU THU'} (Thu chi TDP)
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: printModalRecord.type === 'expense' ? '#dc2626' : '#16a34a',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={16} /> In Phiếu Ngay
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalRecord(null)}
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper - Compact Half A4 (A5) Standard Design */}
            <div
              id="printable-voucher"
              style={{
                padding: '24px 30px',
                background: 'white',
                color: '#000',
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: '13.5px',
                border: '2px double #1e293b',
                borderRadius: '8px',
                margin: '0 auto',
                maxWidth: '720px',
                boxSizing: 'border-box'
              }}
            >
              {/* Voucher Header Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.98rem', textTransform: 'uppercase' }}>{officialsConfig.tdpName}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>{officialsConfig.wardName}</div>
                  <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: '#444' }}>(Sổ theo dõi Thu chi TDP)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Mẫu số 02 - TT</div>
                  <div style={{ fontSize: '0.75rem', color: '#444', fontStyle: 'italic' }}>
                    (Ban hành theo TT 200 & 133/BTC)<br />
                    Số: <strong>#{printModalRecord.id.slice(0, 8).toUpperCase()}</strong>
                  </div>
                </div>
              </div>

              {/* Title Header */}
              <div style={{ textAlign: 'center', margin: '10px 0 12px 0' }}>
                <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px', color: printModalRecord.type === 'expense' ? '#991b1b' : '#14532d' }}>
                  {printModalRecord.type === 'expense' ? 'PHIẾU CHI' : 'PHIẾU THU'}
                </h2>
                <div style={{ fontSize: '0.88rem', fontStyle: 'italic', marginTop: '2px' }}>
                  {formatDateVN(printModalRecord.date || printModalRecord.created_at)}
                </div>
              </div>

              {/* Content Detail Lines */}
              <div style={{ fontSize: '0.96rem', lineHeight: '1.8', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>
                    Họ và tên người {printModalRecord.type === 'expense' ? 'nhận tiền' : 'nộp tiền'}:
                  </span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', fontWeight: 'bold', fontSize: '1.05rem', paddingLeft: '6px' }}>
                    {printModalRecord.recorded_by || 'Ban Quản lý TDP'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>Địa chỉ / Đơn vị:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', paddingLeft: '6px' }}>
                    {officialsConfig.tdpName}, {officialsConfig.wardName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>Hạng mục / Diễn giải:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', paddingLeft: '6px' }}>
                    {printModalRecord.category} {cleanDescription(printModalRecord.description) ? `— ${cleanDescription(printModalRecord.description)}` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>Số tiền {printModalRecord.type === 'expense' ? 'chi' : 'thu'}:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', fontWeight: 'bold', fontSize: '1.12rem', color: printModalRecord.type === 'expense' ? '#b91c1c' : '#047857', paddingLeft: '6px' }}>
                    {formatCurrency(printModalRecord.amount)} VNĐ
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>Viết bằng chữ:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', fontStyle: 'italic', fontWeight: 'bold', paddingLeft: '6px' }}>
                    {docSoTien(printModalRecord.amount)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ width: '200px', fontWeight: 'bold' }}>Kèm theo:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #555', paddingLeft: '6px' }}>
                    ......................................................................................... chứng từ gốc.
                  </span>
                </div>
              </div>

              {/* Date Place Footer */}
              <div style={{ textAlign: 'right', marginTop: '14px', fontSize: '0.9rem', fontStyle: 'italic' }}>
                {officialsConfig.wardName}, {formatDateVN(printModalRecord.date || printModalRecord.created_at)}
              </div>

              {/* 4 Signatures Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                marginTop: '12px',
                textAlign: 'center',
                fontSize: '0.83rem'
              }}>
                {/* 1. Tổ trưởng TDP */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>TỔ TRƯỜNG TDP</div>
                    <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div style={{ margin: '4px 0' }}>
                    {officialsConfig.toTruong.signatureUrl ? (
                      <img src={officialsConfig.toTruong.signatureUrl} alt="Chữ ký" style={{ maxHeight: '42px', objectFit: 'contain', margin: '0 auto' }} />
                    ) : (
                      <div style={{ height: '35px' }}></div>
                    )}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                    {officialsConfig.toTruong.name || 'Nguyễn Kim Tuyến'}
                  </div>
                </div>

                {/* 2. Thủ quỹ */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>THỦ QUỸ</div>
                    <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div style={{ margin: '4px 0' }}>
                    {officialsConfig.thuQuy.signatureUrl ? (
                      <img src={officialsConfig.thuQuy.signatureUrl} alt="Chữ ký" style={{ maxHeight: '42px', objectFit: 'contain', margin: '0 auto' }} />
                    ) : (
                      <div style={{ height: '35px' }}></div>
                    )}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                    {officialsConfig.thuQuy.name || 'Thủ quỹ'}
                  </div>
                </div>

                {/* 3. Người lập phiếu */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>NGƯỜI LẬP PHIẾU</div>
                    <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                    {printModalRecord.recorded_by || 'Ban Quản lý'}
                  </div>
                </div>

                {/* 4. Người nộp / nhận tiền */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                      NGƯỜI {printModalRecord.type === 'expense' ? 'NHẬN TIỀN' : 'NỘP TIỀN'}
                    </div>
                    <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                    {printModalRecord.payer || '.........................'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
