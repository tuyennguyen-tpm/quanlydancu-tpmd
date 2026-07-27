import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Search, 
  Printer, 
  Download, 
  Calendar, 
  X, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Filter, 
  FileText, 
  User, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  CreditCard,
  Building,
  BookOpen,
  Trash2
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { formatDateVN } from '../utils/dateUtils';
import type { FinancialRecord, Resident, Household } from '../types';
import ExcelJS from 'exceljs';

export interface TreasurerManualNote {
  id: string;
  payer: string;
  category: string;
  amount: number;
  method: 'Tiền mặt' | 'Chuyển khoản';
  date: string;
  note: string;
  created_at: string;
}

export default function Treasurer() {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'thu_quy');
  const userRole = localStorage.getItem('user_role') || '';
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'thu_quy');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const isDemoRole = currentRole === 'demo' || currentRole === 'trang_chu';
  const isThuQuy = currentRole === 'thu_quy';
  const isAdminOrToTruong = currentRole === 'to_truong' || currentRole === 'admin' || userRole === 'to_truong' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'ward_admin';

  if (!isAdminOrToTruong) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Quyền truy cập bị hạn chế</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            Chỉ có <strong>Tổ trưởng dân phố</strong> và <strong>Quản trị hệ thống (Admin)</strong> mới được phép truy cập, xem, in hoặc tải thông tin Thủ quỹ.<br />
            Tất cả các Chi hội đoàn thể không có quyền truy cập phần này.
          </p>
        </div>
      </div>
    );
  }

  // State for System Financial Records
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  // State for Treasurer Manual Notebook Entries (Sổ tay thu ngoài lề - Không liên quan CSDL thu chi chính)
  const [manualNotes, setManualNotes] = useState<TreasurerManualNote[]>(() => {
    try {
      const saved = localStorage.getItem('treasurer_manual_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'manual' | 'all' | 'income' | 'expense'>('manual');
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'all'>('this_month');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'transfer'>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);

  // Modals (System)
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Form State - Sổ tay Thu tiền ngoài lề (Nhập tay)
  const [incPayer, setIncPayer] = useState('');
  const [incCategory, setIncCategory] = useState('Thu quỹ TDP + Phường');
  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [incDate, setIncDate] = useState(new Date().toISOString().slice(0, 10));
  const [incNote, setIncNote] = useState('');

  // Form State - Chi (Expense System)
  const [expPayee, setExpPayee] = useState('');
  const [expCategory, setExpCategory] = useState('Hoạt động chung TDP');
  const [expAmount, setExpAmount] = useState('');
  const [expMethod, setExpMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expApprover, setExpApprover] = useState('Tổ trưởng TDP');
  const [expNote, setExpNote] = useState('');

  // Load System Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [finRecs, resList, hhList] = await Promise.all([
        db.getFinancialRecords(),
        db.getResidents(),
        db.getHouseholds()
      ]);
      setRecords(finRecs || []);
      setResidents(resList || []);
      setHouseholds(hhList || []);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu Thủ quỹ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Manual Entry into Treasurer Notebook (Sổ tay ngoài lề)
  const handleSaveManualNote = () => {
    const amt = parseFloat(incAmount.replace(/[^0-9]/g, ''));
    if (!amt || amt <= 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '⚠️ Vui lòng nhập số tiền thu hợp lệ!', type: 'warning' }
      }));
      return;
    }

    const newNote: TreasurerManualNote = {
      id: generateUUID(),
      payer: incPayer.trim() || 'Người nộp tự do',
      category: incCategory.trim() || 'Thu tiền ngoài lề',
      amount: amt,
      method: incMethod,
      date: incDate,
      note: incNote.trim(),
      created_at: new Date().toISOString()
    };

    const updated = [newNote, ...manualNotes];
    setManualNotes(updated);
    localStorage.setItem('treasurer_manual_notes', JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: '✅ Đã ghi vào Sổ tay ngoài lề thành công! (Tách biệt khỏi CSDL ứng dụng)', type: 'success' }
    }));

    // Reset form
    setIncPayer('');
    setIncAmount('');
    setIncNote('');
  };

  // Delete Manual Entry from Treasurer Notebook
  const handleDeleteManualNote = (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa dòng ghi chép này khỏi Sổ tay ngoài lề?')) return;
    const updated = manualNotes.filter(n => n.id !== id);
    setManualNotes(updated);
    localStorage.setItem('treasurer_manual_notes', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: 'Đã xóa ghi chép khỏi Sổ tay ngoài lề', type: 'info' }
    }));
  };

  // Filtered Manual Entries (Sổ tay ngoài lề)
  const filteredManualNotes = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return manualNotes.filter(e => {
      const eDate = (e.date || e.created_at || '').slice(0, 10);
      if (dateFilter === 'today' && eDate !== todayStr) return false;
      if (dateFilter === 'this_week' && eDate < startOfWeekStr) return false;
      if (dateFilter === 'this_month' && eDate < startOfMonthStr) return false;

      if (methodFilter === 'cash' && e.method !== 'Tiền mặt') return false;
      if (methodFilter === 'transfer' && e.method !== 'Chuyển khoản') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchPayer = e.payer.toLowerCase().includes(q);
        const matchCat = e.category.toLowerCase().includes(q);
        const matchNote = e.note.toLowerCase().includes(q);
        const matchAmt = e.amount.toString().includes(q);
        if (!matchPayer && !matchCat && !matchNote && !matchAmt) return false;
      }
      return true;
    });
  }, [manualNotes, dateFilter, methodFilter, searchTerm]);

  // Total amount in Treasurer Notebook
  const manualTotalSum = useMemo(() => {
    return filteredManualNotes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredManualNotes]);

  // Consolidated system records for reference
  const processedSystemRecords = useMemo(() => {
    const manualRecords: FinancialRecord[] = [];
    const autoFundRecords: FinancialRecord[] = [];

    records.forEach(r => {
      if (r.description.includes('[QUY_') || r.recorded_by === 'Hệ thống tự động' || r.description.includes('[HỘ_')) {
        autoFundRecords.push(r);
      } else {
        manualRecords.push(r);
      }
    });

    const autoGroupsMap = new Map<string, { date: string; category: string; amount: number; count: number; created_at: string }>();
    autoFundRecords.forEach(r => {
      const cleanCat = r.category || 'Thu quỹ TDP';
      const rDate = (r.date || r.created_at || '').slice(0, 10);
      const key = `${rDate}_${cleanCat}`;
      
      const existing = autoGroupsMap.get(key);
      if (existing) {
        existing.amount += Number(r.amount) || 0;
        existing.count += 1;
      } else {
        autoGroupsMap.set(key, {
          date: rDate,
          category: cleanCat,
          amount: Number(r.amount) || 0,
          count: 1,
          created_at: r.created_at || new Date().toISOString()
        });
      }
    });

    const groupedAutoRecords: FinancialRecord[] = Array.from(autoGroupsMap.values()).map(g => ({
      id: `summary_${g.date}_${g.category.replace(/\s+/g, '_')}`,
      group_id: 'default',
      type: 'income',
      amount: g.amount,
      category: g.category,
      description: `Tổng thu ${g.category} trong ngày (Gom nhóm ${g.count} hộ nộp)`,
      recorded_by: 'Tổng hợp thu ngày',
      date: g.date,
      created_at: g.created_at
    }));

    return [...manualRecords, ...groupedAutoRecords].sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  }, [records]);

  // Format currency
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Export Sổ tay ngoài lề
  const handleExportManualExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('So_Tay_Thu_Ngoai_Le');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Ngày thu', key: 'date', width: 16 },
      { header: 'Người / Hộ nộp', key: 'payer', width: 25 },
      { header: 'Khoản thu / Hạng mục', key: 'category', width: 25 },
      { header: 'Phương thức', key: 'method', width: 16 },
      { header: 'Ghi chú', key: 'note', width: 35 },
      { header: 'Số tiền (VNĐ)', key: 'amount', width: 18 }
    ];

    filteredManualNotes.forEach((e, idx) => {
      worksheet.addRow({
        stt: idx + 1,
        date: formatDateVN(e.date || e.created_at),
        payer: e.payer,
        category: e.category,
        method: e.method,
        note: e.note || '-',
        amount: e.amount
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Tay_Thu_Ngoai_Le_Thu_Quy_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container" style={{ paddingBottom: '40px' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: 'white',
        padding: '24px 28px',
        borderRadius: '16px',
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
            flexShrink: 0
          }}>
            <Landmark size={30} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              Sổ Quỹ & Sổ Tay Thủ Quỹ
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Nhật ký nhập tay thu tiền hàng ngày ngoài lề và theo dõi tình hình thu chi ứng dụng
            </p>
          </div>
        </div>

        {/* Notice Card */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#a7f3d0',
          padding: '10px 16px',
          borderRadius: '12px',
          fontSize: '0.82rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldAlert size={18} color="#10b981" />
          <span>Sổ tay thu tiền nhập tay thủ công của Thủ quỹ được lưu trữ riêng biệt, hoàn toàn ngoài lề không làm ảnh hưởng đến CSDL ứng dụng.</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'white' }}>
        {/* Controls Header: Tabs & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {/* Top Control Bar: Tabs & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button
                onClick={() => setActiveTab('manual')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === 'manual' ? '#16a34a' : 'transparent',
                  color: activeTab === 'manual' ? 'white' : '#64748b',
                  boxShadow: activeTab === 'manual' ? '0 2px 4px rgba(22, 163, 74, 0.3)' : 'none'
                }}
              >
                📒 Sổ tay thu ngoài lề ({manualNotes.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === 'all' ? '#0f172a' : 'transparent',
                  color: activeTab === 'all' ? 'white' : '#64748b',
                  boxShadow: activeTab === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                📋 Thu chi ứng dụng CSDL ({records.length})
              </button>
            </div>

            {/* Excel Export Button for Manual Notebook */}
            {activeTab === 'manual' && manualNotes.length > 0 && (
              <button
                onClick={handleExportManualExcel}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <Download size={16} /> Xuất Sổ tay ngoài lề Excel
              </button>
            )}
          </div>

          {/* Sub Filters Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={activeTab === 'manual' ? "Tìm trong Sổ tay ngoài lề theo tên, lý do, số tiền..." : "Tìm trong CSDL ứng dụng..."}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="today">📅 Hôm nay</option>
              <option value="this_week">📆 Tuần này</option>
              <option value="this_month">🗓️ Tháng này</option>
              <option value="all">♾️ Toàn bộ thời gian</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
            >
              <option value="all">💰 Tất cả phương thức</option>
              <option value="cash">💵 Tiền mặt</option>
              <option value="transfer">💳 Chuyển khoản</option>
            </select>
          </div>
        </div>

        {/* TAB 1: SỔ TAY THU TIỀN NGOÀI LỀ (NHẬP TAY THỦ CÔNG) */}
        {activeTab === 'manual' && (
          <>
            {/* Form Nhập Tay Thu Tiền Trực Tiếp */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '20px 22px',
              marginBottom: '24px',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.08)'
            }}>
              <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#15803d', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📒 GHI CHÉP NHẬP TAY THU TIỀN HÀNG NGÀY (SỔ TAY NGOÀI LỀ)</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '16px', lineHeight: '1.4' }}>
                📌 <strong>Quy định Sổ tay ngoài lề:</strong> Đây là sổ chép tay cá nhân thủ công của Thủ quỹ. Dữ liệu nhập tại đây được lưu riêng biệt để theo dõi, <strong>KHÔNG ghi vào CSDL ứng dụng</strong> và KHÔNG làm ảnh hưởng đến báo cáo tài chính chính thức của Phường / Tổ.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Người nộp / Hộ dân:</label>
                  <input
                    type="text"
                    placeholder="Tên người hoặc hộ nộp..."
                    value={incPayer}
                    onChange={(e) => setIncPayer(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #4ade80', fontSize: '0.88rem', background: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Khoản thu (Hạng mục):</label>
                  <select
                    value={incCategory}
                    onChange={(e) => setIncCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #4ade80', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Thu quỹ TDP + Phường">Thu quỹ TDP + Phường</option>
                    <option value="Thu quỹ TDP">Thu quỹ TDP</option>
                    <option value="Thu quỹ Phường">Thu quỹ Phường</option>
                    <option value="Đóng góp tự nguyện">Đóng góp tự nguyện</option>
                    <option value="Ủng hộ lễ hội / Sự kiện">Ủng hộ lễ hội / Sự kiện</option>
                    <option value="Thu khác">Thu khác</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Số tiền (VNĐ):</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 200000"
                    value={incAmount}
                    onChange={(e) => setIncAmount(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #4ade80', fontSize: '0.92rem', fontWeight: 'bold', color: '#15803d', background: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Phương thức nhận:</label>
                  <select
                    value={incMethod}
                    onChange={(e) => setIncMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #4ade80', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Tiền mặt">💵 Tiền mặt</option>
                    <option value="Chuyển khoản">💳 Chuyển khoản</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Ngày thu nhận:</label>
                  <input
                    type="date"
                    value={incDate}
                    onChange={(e) => setIncDate(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #4ade80', fontSize: '0.88rem', background: 'white' }}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleSaveManualNote}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)',
                      height: '40px'
                    }}
                  >
                    ➕ Ghi vào Sổ tay
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Bar for Manual Notebook */}
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: '600' }}>
                Tổng cộng có <strong>{filteredManualNotes.length}</strong> khoản thu ghi trong Sổ tay ngoài lề
              </span>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#15803d' }}>
                Tổng thu Sổ tay: {formatVND(manualTotalSum)}
              </div>
            </div>

            {/* Table of Manual Entries */}
            {filteredManualNotes.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <BookOpen size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                <h3 style={{ margin: 0, color: '#334155', fontSize: '1rem' }}>Chưa có ghi chép nào trong Sổ tay ngoài lề</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Điền thông tin ở khung phía trên và nhấn "Ghi vào Sổ tay" để lưu lịch sử thu tiền thủ công của Thủ quỹ.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#ecfdf5', borderBottom: '2px solid #a7f3d0' }}>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', width: '50px' }}>STT</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', width: '110px' }}>Ngày thu</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', width: '180px' }}>Người / Hộ nộp</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', width: '180px' }}>Khoản thu / Hạng mục</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', width: '120px' }}>Phương thức</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700' }}>Ghi chú</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', textAlign: 'right', width: '150px' }}>Số tiền (VNĐ)</th>
                      <th style={{ padding: '10px 12px', color: '#065f46', fontWeight: '700', textAlign: 'center', width: '80px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManualNotes.map((entry, idx) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: '600' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
                          {formatDateVN(entry.date || entry.created_at)}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#1e293b' }}>
                          {entry.payer}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#047857', fontWeight: '600' }}>
                          {entry.category}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: entry.method === 'Chuyển khoản' ? '#eff6ff' : '#ecfdf5',
                            color: entry.method === 'Chuyển khoản' ? '#1d4ed8' : '#047857'
                          }}>
                            {entry.method === 'Chuyển khoản' ? '💳 Chuyển khoản' : '💵 Tiền mặt'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {entry.note || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: '#047857' }}>
                          +{formatVND(entry.amount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteManualNote(entry.id)}
                            title="Xóa khỏi sổ tay"
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* TAB 2: SỔ THU CHI CHÍNH CỦA ỨNG DỤNG CSDL */}
        {activeTab !== 'manual' && (
          <div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', marginBottom: '12px' }}>
              💡 <strong>Lưu ý:</strong> Đây là danh sách thu chi chính thức được lưu trong CSDL của ứng dụng (dùng chung cho Kế toán, Tổ trưởng và Báo cáo).
            </div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <Clock size={32} className="pulse" style={{ marginBottom: '8px' }} />
                <div>Đang tải dữ liệu CSDL thu chi...</div>
              </div>
            ) : processedSystemRecords.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Landmark size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                <h3 style={{ margin: 0, color: '#334155', fontSize: '1rem' }}>Chưa có chứng từ CSDL nào</h3>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '50px' }}>STT</th>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '110px' }}>Ngày lập</th>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '100px' }}>Phân loại</th>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '160px' }}>Hạng mục</th>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Diễn giải CSDL</th>
                      <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', textAlign: 'right', width: '140px' }}>Số tiền (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedSystemRecords.map((r, idx) => {
                      const isInc = r.type === 'income';
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>{formatDateVN(r.date || r.created_at)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: isInc ? '#ecfdf5' : '#fef2f2', color: isInc ? '#047857' : '#b91c1c' }}>
                              {isInc ? '📥 THU' : '📤 CHI'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '600' }}>{r.category}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{r.description}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: isInc ? '#047857' : '#b91c1c' }}>
                            {isInc ? '+' : '-'}{formatVND(r.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
