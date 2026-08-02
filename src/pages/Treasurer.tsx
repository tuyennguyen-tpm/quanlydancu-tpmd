import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { 
  Landmark, 
  Search, 
  Download, 
  X, 
  ShieldAlert, 
  BookOpen, 
  Trash2,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  Calculator
} from 'lucide-react';
import { Calculator3DModal } from '../components/Calculator3DModal';
import { db, generateUUID } from '../services/db';
import { formatDateVN } from '../utils/dateUtils';
import { docSoTien } from '../utils/financialEngine';
import ExcelJS from 'exceljs';

export interface TreasurerManualNote {
  id: string;
  type?: 'income' | 'expense';
  payer: string;
  category: string;
  amount: number;
  method: 'Tiền mặt' | 'Chuyển khoản';
  date: string;
  note: string;
  created_at: string;
}

const formatNumberWithDots = (val: string) => {
  const rawDigits = val.replace(/\D/g, '');
  if (!rawDigits) return '';
  return rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function Treasurer() {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'thu_quy');
  const [show3DCalculator, setShow3DCalculator] = useState(false);
  const userRole = localStorage.getItem('user_role') || '';
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'thu_quy');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const isAuthorizedForTreasurer = currentRole === 'to_truong' || currentRole === 'admin' || currentRole === 'thu_quy' || userRole === 'to_truong' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'ward_admin';
  const isAdmin = currentRole === 'admin' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'ward_admin';
  const canEditOrDelete = isAdmin;

  if (!isAuthorizedForTreasurer) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Quyền truy cập bị hạn chế</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            Chỉ có <strong>Thủ quỹ</strong>, <strong>Tổ trưởng dân phố</strong> và <strong>Quản trị hệ thống (Admin)</strong> mới được phép truy cập.<br />
            Tất cả các Chi hội đoàn thể không có quyền truy cập phần này.
          </p>
        </div>
      </div>
    );
  }

  // State for Treasurer Manual Notebook Entries (Sổ tay thu chi ngoài lề)
  const [manualNotes, setManualNotes] = useState<TreasurerManualNote[]>(() => {
    try {
      const saved = localStorage.getItem('treasurer_manual_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Đồng bộ Sổ tay thủ quỹ với CSDL đám mây (Supabase)
  const fetchCloudNotes = async (showToast = false) => {
    setIsSyncing(true);
    try {
      const cloudNotes = await db.getTreasurerManualNotes();
      if (cloudNotes && Array.isArray(cloudNotes)) {
        setManualNotes(cloudNotes);
        if (showToast) {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: `✅ Đã đồng bộ an toàn ${cloudNotes.length} chứng từ từ CSDL đám mây!`, type: 'success' }
          }));
        }
      }
    } catch (e) {
      console.error('Lỗi tải dữ liệu Sổ tay thủ quỹ:', e);
      if (showToast) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: '⚠️ Lỗi kết nối CSDL đám mây.', type: 'warning' }
        }));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchCloudNotes(false);
  }, []);

  // Print Voucher Modal State
  const [printModalNote, setPrintModalNote] = useState<TreasurerManualNote | null>(null);
  const [printLienCount, setPrintLienCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('treasurer_print_lien_count');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  const handleLienCountChange = (count: number) => {
    setPrintLienCount(count);
    localStorage.setItem('treasurer_print_lien_count', count.toString());
  };

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'all'>('this_month');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'transfer'>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);

  // Form State - Sổ tay Thu/Chi ngoài lề (Nhập tay)
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [incPayer, setIncPayer] = useState('');
  const [incCategory, setIncCategory] = useState('Thu quỹ TDP + Phường');
  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [incDate, setIncDate] = useState(new Date().toISOString().slice(0, 10));
  const [incNote, setIncNote] = useState('');

  // Update default category when switching type
  const handleTypeChange = (type: 'income' | 'expense') => {
    setEntryType(type);
    if (type === 'income') {
      setIncCategory('Thu quỹ TDP + Phường');
    } else {
      setIncCategory('Chi hoạt động TDP');
    }
  };

  // Save Manual Entry into Treasurer Notebook (Sổ tay ngoài lề)
  const handleSaveManualNote = async () => {
    const amt = parseFloat(incAmount.replace(/[^0-9]/g, ''));
    if (!amt || amt <= 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '⚠️ Vui lòng nhập số tiền hợp lệ!', type: 'warning' }
      }));
      return;
    }

    const isInc = entryType === 'income';
    if (!isInc) {
      if (!incPayer.trim()) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: '⚠️ Vui lòng nhập tên Người nhận tiền / Đơn vị nhận tiền!', type: 'warning' }
        }));
        return;
      }
      const p = incPayer.trim().toLowerCase();
      const creator = (officialsConfig.keToan.name || officialsConfig.thuQuy.name || '').trim().toLowerCase();
      if (p && creator && p === creator) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: '⚠️ Theo quy định tài chính, Người nhận tiền và Người lập phiếu không được là cùng 1 người!', type: 'warning' }
        }));
        alert('⚠️ Quy định quản lý tài chính:\n\n"Người nhận tiền" và "Người lập phiếu" KHÔNG ĐƯỢC LÀ CÙNG 1 NGƯỜI.\nVui lòng kiểm tra lại tên Người nhận tiền thực tế!');
        return;
      }
    }
    const newNote: TreasurerManualNote = {
      id: generateUUID(),
      type: entryType,
      payer: incPayer.trim() || (isInc ? 'Người nộp tự do' : 'Người nhận tiền'),
      category: incCategory.trim() || (isInc ? 'Thu khác' : 'Chi khác'),
      amount: amt,
      method: incMethod,
      date: incDate,
      note: incNote.trim(),
      created_at: new Date().toISOString()
    };

    const updated = [newNote, ...manualNotes];
    setManualNotes(updated);
    await db.saveTreasurerManualNotes(updated);

    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { 
        message: `✅ Đã lập ${isInc ? 'Phiếu Thu' : 'Phiếu Chi'} Sổ tay thành công & Đồng bộ liên máy!`, 
        type: 'success' 
      }
    }));

    // Reset form
    setIncPayer('');
    setIncAmount('');
    setIncNote('');
  };

  // Delete Manual Entry from Treasurer Notebook (Only Admin allowed)
  const handleDeleteManualNote = async (id: string) => {
    if (!isAdmin) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '🔒 Quyền bị hạn chế: Tổ trưởng và Thủ quỹ không có quyền xóa phiếu thu/chi của Thủ quỹ! Chỉ Admin mới có quyền xóa.', type: 'warning' }
      }));
      alert('🔒 Quyền bị hạn chế:\n\nTổ trưởng dân phố và Thủ quỹ không được phép xóa phiếu thu, phiếu chi của Thủ quỹ.\nChỉ có Quản trị hệ thống (Admin) mới được phép xóa các chứng từ này.');
      return;
    }
    if (!window.confirm('Bạn có chắc muốn xóa dòng chứng từ này khỏi Sổ tay ngoài lề?')) return;
    const updated = manualNotes.filter(n => n.id !== id);
    setManualNotes(updated);
    await db.saveTreasurerManualNotes(updated);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: 'Đã xóa chứng từ khỏi Sổ tay ngoài lề & Cập nhật liên máy', type: 'info' }
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
      const eType = e.type || 'income';
      if (typeFilter === 'income' && eType !== 'income') return false;
      if (typeFilter === 'expense' && eType !== 'expense') return false;

      const eDate = (e.date || e.created_at || '').slice(0, 10);
      if (dateFilter === 'today' && eDate !== todayStr) return false;
      if (dateFilter === 'this_week' && eDate < startOfWeekStr) return false;
      if (dateFilter === 'this_month' && eDate < startOfMonthStr) return false;

      if (methodFilter === 'cash' && e.method !== 'Tiền mặt') return false;
      if (methodFilter === 'transfer' && e.method !== 'Chuyển khoản') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchPayer = (e.payer || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        const matchNote = (e.note || '').toLowerCase().includes(q);
        const matchAmt = (e.amount || 0).toString().includes(q);
        if (!matchPayer && !matchCat && !matchNote && !matchAmt) return false;
      }
      return true;
    });
  }, [manualNotes, typeFilter, dateFilter, methodFilter, searchTerm]);

  // Statistics calculation for Manual Notebook
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    filteredManualNotes.forEach(item => {
      const amt = Number(item.amount) || 0;
      if ((item.type || 'income') === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    });
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  }, [filteredManualNotes]);

  // Format currency
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Dynamic Officers & Unit configuration from Settings (localStorage)
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

  // Export Sổ tay ngoài lề
  const handleExportManualExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('So_Tay_Thu_Chi_Ngoai_Le');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Ngày lập', key: 'date', width: 16 },
      { header: 'Loại chứng từ', key: 'type', width: 16 },
      { header: 'Người nộp / nhận tiền', key: 'payer', width: 25 },
      { header: 'Hạng mục Thu / Chi', key: 'category', width: 25 },
      { header: 'Phương thức', key: 'method', width: 16 },
      { header: 'Ghi chú / Diễn giải', key: 'note', width: 35 },
      { header: 'Số tiền Thu (VNĐ)', key: 'incAmount', width: 18 },
      { header: 'Số tiền Chi (VNĐ)', key: 'expAmount', width: 18 }
    ];

    filteredManualNotes.forEach((e, idx) => {
      const isInc = (e.type || 'income') === 'income';
      worksheet.addRow({
        stt: idx + 1,
        date: formatDateVN(e.date || e.created_at),
        type: isInc ? 'PHIẾU THU' : 'PHIẾU CHI',
        payer: e.payer,
        category: e.category,
        method: e.method,
        note: e.note || '-',
        incAmount: isInc ? e.amount : 0,
        expAmount: !isInc ? e.amount : 0
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Tay_Thu_Chi_Ngoai_Le_Thu_Quy_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container" style={{ paddingBottom: '40px' }}>
      {/* Dynamic print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-voucher, #printable-voucher * {
            visibility: visible !important;
          }
          #printable-voucher {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            padding: 20px !important;
            background: white !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .lien-break {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

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
              Sổ Tay Thu Chi Thủ Quỹ
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Nhật ký lập phiếu Thu - Chi tiền nhập tay thủ công ngoài lề của Thủ quỹ
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
          <span>Sổ tay thu chi thủ công của Thủ quỹ được lưu trữ an toàn riêng biệt trên CSDL Đám mây Supabase, độc lập và không làm ảnh hưởng đến CSDL Thu Chi TDP.</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'white' }}>
        
        {/* Statistics Bar for Manual Notebook */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #bbf7d0',
            padding: '16px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>TỔNG THU SỔ TAY</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>+{formatVND(totalIncome)}</div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%)',
            border: '1px solid #fecdd3',
            padding: '16px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <TrendingDown size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: '700', textTransform: 'uppercase' }}>TỔNG CHI SỔ TAY</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#b91c1c', marginTop: '2px' }}>-{formatVND(totalExpense)}</div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            padding: '16px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Wallet size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: '700', textTransform: 'uppercase' }}>TỒN QUỸ SỔ TAY</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: balance >= 0 ? '#1d4ed8' : '#b91c1c', marginTop: '2px' }}>
                {formatVND(balance)}
              </div>
            </div>
          </div>
        </div>

        {/* FORM NHẬP THU / CHI THỦ CÔNG */}
        <div style={{
          background: entryType === 'income' ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
          border: entryType === 'income' ? '1.5px solid #86efac' : '1.5px solid #feb2b2',
          borderRadius: '14px',
          padding: '20px 22px',
          marginBottom: '24px',
          boxShadow: entryType === 'income' ? '0 4px 14px rgba(22, 163, 74, 0.08)' : '0 4px 14px rgba(220, 38, 38, 0.08)'
        }}>
          {/* Voucher Type Selector Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '800', fontSize: '0.95rem', color: entryType === 'income' ? '#15803d' : '#9b2c2c', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📒 LẬP PHIẾU THU / PHIẾU CHI THỦ CÔNG (SỔ TAY NGOÀI LỀ)</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.7)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)' }}>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.83rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: entryType === 'income' ? '#16a34a' : 'transparent',
                  color: entryType === 'income' ? 'white' : '#475569',
                  boxShadow: entryType === 'income' ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none'
                }}
              >
                📥 LẬP PHIẾU THU
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.83rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: entryType === 'expense' ? '#dc2626' : 'transparent',
                  color: entryType === 'expense' ? 'white' : '#475569',
                  boxShadow: entryType === 'expense' ? '0 2px 6px rgba(220, 38, 38, 0.3)' : 'none'
                }}
              >
                📤 LẬP PHIẾU CHI
              </button>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: entryType === 'income' ? '#166534' : '#742a2a', marginBottom: '16px', lineHeight: '1.4' }}>
            📌 <strong>Quy định:</strong> Dữ liệu lập phiếu tại đây để ghi chép nội bộ Thủ quỹ và có thể <strong>in phiếu chi/thu có đủ 4 chữ ký</strong> (Tổ trưởng TDP, Thủ quỹ, Người lập, Người nộp/nhận).
          </div>

          {/* Form Inputs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: entryType === 'income' ? '#15803d' : '#9b2c2c', marginBottom: '4px' }}>
                {entryType === 'income' ? 'Người nộp / Hộ dân:' : 'Người nhận tiền / Đơn vị:'}
              </label>
              <input
                type="text"
                placeholder={entryType === 'income' ? 'Tên người nộp tiền...' : 'Tên người nhận tiền...'}
                value={incPayer}
                onChange={(e) => setIncPayer(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: entryType === 'income' ? '1px solid #4ade80' : '1px solid #feb2b2', fontSize: '0.88rem', background: 'white' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: entryType === 'income' ? '#15803d' : '#9b2c2c', marginBottom: '4px' }}>
                Hạng mục ({entryType === 'income' ? 'Thu' : 'Chi'}):
              </label>
              {entryType === 'income' ? (
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
              ) : (
                <select
                  value={incCategory}
                  onChange={(e) => setIncCategory(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #feb2b2', fontSize: '0.88rem', background: 'white' }}
                >
                  <option value="Chi hoạt động TDP">Chi hoạt động TDP</option>
                  <option value="Chi thăm hỏi / Ốm đau / Hiếu hỷ">Chi thăm hỏi / Ốm đau / Hiếu hỷ</option>
                  <option value="Chi tiếp khách / Hội nghị">Chi tiếp khách / Hội nghị</option>
                  <option value="Chi sửa chữa / Sắm thiết bị">Chi sửa chữa / Sắm thiết bị</option>
                  <option value="Chi hỗ trợ phong trào">Chi hỗ trợ phong trào</option>
                  <option value="Chi khác">Chi khác</option>
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: entryType === 'income' ? '#15803d' : '#9b2c2c', marginBottom: '4px' }}>Số tiền (VNĐ):</label>
              <input
                type="text"
                placeholder="Ví dụ: 500.000"
                value={incAmount}
                onChange={(e) => setIncAmount(formatNumberWithDots(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: entryType === 'income' ? '1px solid #4ade80' : '1px solid #feb2b2',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  color: entryType === 'income' ? '#15803d' : '#b91c1c',
                  background: 'white'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: entryType === 'income' ? '#15803d' : '#9b2c2c', marginBottom: '4px' }}>Phương thức:</label>
              <select
                value={incMethod}
                onChange={(e) => setIncMethod(e.target.value as any)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: entryType === 'income' ? '1px solid #4ade80' : '1px solid #feb2b2', fontSize: '0.88rem', background: 'white' }}
              >
                <option value="Tiền mặt">💵 Tiền mặt</option>
                <option value="Chuyển khoản">💳 Chuyển khoản</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: entryType === 'income' ? '#15803d' : '#9b2c2c', marginBottom: '4px' }}>
                Ngày {entryType === 'income' ? 'thu' : 'chi'}:
              </label>
              <input
                type="date"
                value={incDate}
                onChange={(e) => setIncDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: entryType === 'income' ? '1px solid #4ade80' : '1px solid #feb2b2', fontSize: '0.88rem', background: 'white' }}
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
                  background: entryType === 'income' ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.88rem',
                  boxShadow: entryType === 'income' ? '0 4px 10px rgba(22, 163, 74, 0.3)' : '0 4px 10px rgba(220, 38, 38, 0.3)',
                  height: '40px'
                }}
              >
                ➕ {entryType === 'income' ? 'Ghi Phiếu Thu' : 'Ghi Phiếu Chi'}
              </button>
            </div>
          </div>

          {/* Note Row */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: (incCategory === 'Chi khác' || incCategory === 'Thu khác') ? '#dc2626' : '#475569', marginBottom: '4px' }}>
              {(incCategory === 'Chi khác' || incCategory === 'Thu khác') 
                ? `✏️ Nội dung chi tiết cần ${entryType === 'income' ? 'thu' : 'chi'} (ghi vào đây):`
                : `Ghi chú / Diễn giải chi tiết:`}
            </label>
            <input
              type="text"
              placeholder={
                (incCategory === 'Chi khác' || incCategory === 'Thu khác') 
                  ? (entryType === 'expense' ? "Nhập nội dung chi tiết cần chi tại đây (VD: Chi mua loa kéo, sửa mái NVH...)..." : "Nhập nội dung chi tiết cần thu tại đây...")
                  : (entryType === 'income' ? "Ghi chú chi tiết cho khoản thu (nếu có)..." : "Lý do / Diễn giải chi tiết cho khoản chi...")
              }
              value={incNote}
              onChange={(e) => setIncNote(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: (incCategory === 'Chi khác' || incCategory === 'Thu khác')
                  ? (entryType === 'income' ? '1.5px solid #16a34a' : '1.5px solid #dc2626')
                  : (entryType === 'income' ? '1px solid #a7f3d0' : '1px solid #fecca9'),
                fontSize: '0.85rem',
                background: 'white',
                boxShadow: (incCategory === 'Chi khác' || incCategory === 'Thu khác') ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            />
          </div>
        </div>

        {/* Controls Header: Search & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {/* Sub Filters Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tìm trong Sổ tay theo tên người, lý do, số tiền..."
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

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white', fontWeight: '600' }}
            >
              <option value="all">📂 Tất cả Thu & Chi</option>
              <option value="income">📥 Chỉ xem PHIẾU THU</option>
              <option value="expense">📤 Chỉ xem PHIẾU CHI</option>
            </select>

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

            {/* Sync Cloud & Excel Export Buttons */}
            <button
              onClick={() => fetchCloudNotes(true)}
              disabled={isSyncing}
              className="btn btn-secondary"
              title="Tải & Đồng bộ toàn bộ dữ liệu Sổ Tay Thủ Quỹ từ CSDL Đám mây Supabase"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ CSDL'}
            </button>

            {manualNotes.length > 0 && (
              <button
                onClick={handleExportManualExcel}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <Download size={16} /> Xuất Sổ tay Excel
              </button>
            )}
          </div>
        </div>

        {/* Table of Manual Entries */}
        {filteredManualNotes.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <BookOpen size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
            <h3 style={{ margin: 0, color: '#334155', fontSize: '1rem' }}>Chưa có ghi chép chứng từ nào trong Sổ tay</h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Điền thông tin ở khung phía trên và nhấn "Ghi Phiếu Thu" hoặc "Ghi Phiếu Chi" để lưu nhật ký Thủ quỹ.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '45px' }}>STT</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '100px' }}>Ngày lập</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '90px' }}>Loại</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '170px' }}>Người nộp / nhận</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '170px' }}>Hạng mục</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', width: '110px' }}>Phương thức</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Ghi chú</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', textAlign: 'right', width: '140px' }}>Số tiền (VNĐ)</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', textAlign: 'center', width: '120px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredManualNotes.map((entry, idx) => {
                  const isInc = (entry.type || 'income') === 'income';
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: '600' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatDateVN(entry.date || entry.created_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isInc ? '#dcfce7' : '#fee2e2',
                          color: isInc ? '#15803d' : '#b91c1c',
                          display: 'inline-block'
                        }}>
                          {isInc ? '📥 THU' : '📤 CHI'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#1e293b' }}>
                        {entry.payer}
                      </td>
                      <td style={{ padding: '10px 12px', color: isInc ? '#047857' : '#b91c1c', fontWeight: '600' }}>
                        {entry.category}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: entry.method === 'Chuyển khoản' ? '#eff6ff' : '#f8fafc',
                          color: entry.method === 'Chuyển khoản' ? '#1d4ed8' : '#475569',
                          border: '1px solid #cbd5e1'
                        }}>
                          {entry.method === 'Chuyển khoản' ? '💳 CK' : '💵 Tiền mặt'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {entry.note || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: isInc ? '#047857' : '#b91c1c' }}>
                        {isInc ? '+' : '-'}{formatVND(entry.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setPrintModalNote(entry)}
                            title="In phiếu chứng từ (có 4 chữ ký)"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #bbf7d0',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}
                          >
                            <Printer size={14} /> In
                          </button>
                          {canEditOrDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteManualNote(entry.id)}
                              title="Xóa chứng từ (Quyền Quản trị viên / Admin)"
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteManualNote(entry.id)}
                              title="🔒 Tổ trưởng và Thủ quỹ không có quyền xóa chứng từ của Thủ quỹ (Chỉ Admin)"
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', cursor: 'pointer' }}
                            >
                              🔒
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINT VOUCHER MODAL */}
      {printModalNote && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '820px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Control Header (Hidden when printing) */}
            <div className="no-print" style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Top Row: Title & Close Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                  <Printer size={22} color={printModalNote.type === 'expense' ? '#dc2626' : '#16a34a'} />
                  Mẫu In {printModalNote.type === 'expense' ? 'PHIẾU CHI' : 'PHIẾU THU'}
                  <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#475569', background: '#e2e8f0', padding: '2px 10px', borderRadius: '12px' }}>
                    Sổ tay ngoài lề
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPrintModalNote(null)}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Đóng"
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>

              {/* Bottom Row: Actions Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                background: '#ffffff',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>📋 Số liên in:</span>
                  <select
                    value={printLienCount}
                    onChange={(e) => handleLienCountChange(parseInt(e.target.value, 10))}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #0284c7',
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      color: '#0284c7',
                      background: '#f0f9ff',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Chọn số liên muốn in cho mỗi phiếu thu/chi"
                  >
                    <option value={1}>📄 In 1 Liên (Bản đơn)</option>
                    <option value={2}>📄📄 In 2 Liên (Liên 1 + Liên 2)</option>
                    <option value={3}>📄📄📄 In 3 Liên (Liên 1 + 2 + 3)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShow3DCalculator(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#0284c7',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                    title="Mở máy tính 3D cầm tay để tính số tiền"
                  >
                    <Calculator size={16} /> Máy tính 3D
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: printModalNote.type === 'expense' ? '#dc2626' : '#16a34a',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Printer size={16} /> In Phiếu Ngay ({printLienCount} liên)
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Edit Hint Banner */}
            <div style={{
              padding: '8px 14px',
              backgroundColor: '#eff6ff',
              border: '1px dashed #3b82f6',
              borderRadius: '8px',
              margin: '10px 0 14px 0',
              fontSize: '0.82rem',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>✏️ <strong>Sửa trực tiếp:</strong> Bạn có thể nhấp chuột vào bất kỳ chữ/số nào trên Mẫu Phiếu bên dưới (họ tên, lý do, số tiền, chữ viết, ngày tháng...) để tự do gõ sửa trực tiếp trước khi bấm "In Phiếu Ngay"! (Đang chọn: <strong>{printLienCount} Liên</strong>)</span>
            </div>

            {/* Printable Voucher Paper Container */}
            <div
              id="printable-voucher"
              contentEditable={true}
              suppressContentEditableWarning={true}
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
                boxSizing: 'border-box',
                outline: 'none'
              }}
            >
              {Array.from({ length: printLienCount }, (_, idx) => idx + 1).map((lienNum) => (
                <div key={`lien-${lienNum}`} style={{ marginBottom: lienNum < printLienCount ? '24px' : '0' }}>
                  {lienNum > 1 && (
                    <div className="lien-break" style={{ pageBreakBefore: 'always', margin: '24px 0 20px 0', borderTop: '2px dashed #94a3b8', paddingTop: '16px' }}></div>
                  )}

                  {/* Voucher Header Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.98rem', textTransform: 'uppercase' }}>{officialsConfig.tdpName}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>{officialsConfig.wardName}</div>
                      <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: '#444' }}>(Sổ tay theo dõi nội bộ Thủ quỹ)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Mẫu số 02 - TT</div>
                      <div style={{ fontSize: '0.75rem', color: '#444', fontStyle: 'italic' }}>
                        (Ban hành theo TT 200 & 133/BTC)<br />
                        Số: <strong>#{printModalNote.id.slice(0, 8).toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Title Header */}
                  <div style={{ textAlign: 'center', margin: '10px 0 12px 0' }}>
                    <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px', color: printModalNote.type === 'expense' ? '#991b1b' : '#14532d' }}>
                      {printModalNote.type === 'expense' ? 'PHIẾU CHI' : 'PHIẾU THU'}
                    </h2>
                    {printLienCount > 1 && (
                      <div style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#1e3a8a', marginTop: '2px' }}>
                        {lienNum === 1
                          ? 'Liên 1: TDP lưu trữ'
                          : lienNum === 2
                            ? `Liên 2: Giao cho người ${printModalNote.type === 'expense' ? 'nhận tiền' : 'nộp tiền'}`
                            : 'Liên 3: Kế toán / Lưu hồ sơ'}
                      </div>
                    )}
                    <div style={{ fontSize: '0.88rem', fontStyle: 'italic', marginTop: '2px' }}>
                      {formatDateVN(printModalNote.date || printModalNote.created_at)}
                    </div>
                  </div>

                  {/* Content Detail Lines */}
                  <div style={{ fontSize: '0.96rem', lineHeight: '1.0', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: '200px', fontWeight: 'bold' }}>
                        Họ và tên người {printModalNote.type === 'expense' ? 'nhận tiền' : 'nộp tiền'}:
                      </span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #555', fontWeight: 'bold', fontSize: '1.05rem', paddingLeft: '6px' }}>
                        {printModalNote.payer}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: '200px', fontWeight: 'bold' }}>Địa chỉ / Đơn vị:</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #555', paddingLeft: '6px' }}>
                        {officialsConfig.tdpName}, {officialsConfig.wardName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: '200px', fontWeight: 'bold' }}>Lý do {printModalNote.type === 'expense' ? 'chi' : 'thu'}:</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #555', paddingLeft: '6px' }}>
                        {printModalNote.category} {printModalNote.note ? `— ${printModalNote.note}` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: '200px', fontWeight: 'bold' }}>Số tiền {printModalNote.type === 'expense' ? 'chi' : 'thu'}:</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #555', fontWeight: 'bold', fontSize: '1.12rem', color: printModalNote.type === 'expense' ? '#b91c1c' : '#047857', paddingLeft: '6px' }}>
                        {formatVND(printModalNote.amount)} <span style={{ fontSize: '0.88rem', fontWeight: 'normal', color: '#444' }}>({printModalNote.method})</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                      <span style={{ width: '200px', fontWeight: 'bold' }}>Viết bằng chữ:</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #555', fontStyle: 'italic', fontWeight: 'bold', paddingLeft: '6px' }}>
                        {docSoTien(printModalNote.amount)}
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
                    {officialsConfig.wardName}, {formatDateVN(printModalNote.date || printModalNote.created_at)}
                  </div>

                  {/* 4 Signatures Grid with Officers Names & Signatures from Settings */}
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
                        {officialsConfig.thuQuy.name || '(Thủ quỹ)'}
                      </div>
                    </div>

                    {/* 3. Người lập phiếu */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>NGƯỜI LẬP PHIẾU</div>
                        <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                      </div>
                      <div style={{ margin: '4px 0' }}>
                        {officialsConfig.keToan.signatureUrl ? (
                          <img src={officialsConfig.keToan.signatureUrl} alt="Chữ ký" style={{ maxHeight: '42px', objectFit: 'contain', margin: '0 auto' }} />
                        ) : (
                          <div style={{ height: '35px' }}></div>
                        )}
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                        {officialsConfig.keToan.name || '(Người lập)'}
                      </div>
                    </div>

                    {/* 4. Người nhận tiền / Nộp tiền */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {printModalNote.type === 'expense' ? 'NGƯỜI NHẬN TIỀN' : 'NGƯỜI NỘP TIỀN'}
                        </div>
                        <div style={{ fontSize: '0.73rem', fontStyle: 'italic', color: '#555' }}>(Ký, ghi rõ họ tên)</div>
                      </div>
                      <div style={{ margin: '4px 0', height: '35px' }}></div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                        {printModalNote.payer}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
      <Calculator3DModal
        isOpen={show3DCalculator}
        onClose={() => setShow3DCalculator(false)}
      />
    </div>
  );
}
