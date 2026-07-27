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
  Building
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { formatDateVN } from '../utils/dateUtils';
import type { FinancialRecord, Resident, Household } from '../types';
import ExcelJS from 'exceljs';

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
  const isReadOnly = isDemoRole || localStorage.getItem('guest_mode') === 'true';

  // State
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'all'>('this_month');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'transfer'>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);

  // Modals
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [printingRecord, setPrintingRecord] = useState<FinancialRecord | null>(null);

  // Form State - Thu (Income)
  const [incPayer, setIncPayer] = useState('');
  const [incCategory, setIncCategory] = useState('Thu quỹ TDP');
  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [incDate, setIncDate] = useState(new Date().toISOString().slice(0, 10));
  const [incNote, setIncNote] = useState('');

  // Form State - Chi (Expense)
  const [expPayee, setExpPayee] = useState('');
  const [expCategory, setExpCategory] = useState('Hoạt động chung TDP');
  const [expAmount, setExpAmount] = useState('');
  const [expMethod, setExpMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expApprover, setExpApprover] = useState('Tổ trưởng TDP');
  const [expNote, setExpNote] = useState('');

  // Load Data
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

  // Filtered Records based on date, method, search, tab
  const filteredRecords = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    
    // Start of week (Monday)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);

    // Start of month
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return records.filter(r => {
      // Type tab
      if (activeTab === 'income' && r.type !== 'income') return false;
      if (activeTab === 'expense' && r.type !== 'expense') return false;

      // Date filter
      const rDate = (r.date || r.created_at || '').slice(0, 10);
      if (dateFilter === 'today' && rDate !== todayStr) return false;
      if (dateFilter === 'this_week' && rDate < startOfWeekStr) return false;
      if (dateFilter === 'this_month' && rDate < startOfMonthStr) return false;

      // Method filter (parsed from description if embedded)
      if (methodFilter === 'cash' && r.description.includes('Chuyển khoản')) return false;
      if (methodFilter === 'transfer' && !r.description.includes('Chuyển khoản')) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCat = r.category.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchBy = r.recorded_by.toLowerCase().includes(q);
        const matchAmt = r.amount.toString().includes(q);
        if (!matchCat && !matchDesc && !matchBy && !matchAmt) return false;
      }

      return true;
    });
  }, [records, activeTab, dateFilter, methodFilter, searchTerm]);

  // Overall Statistics Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let todayIncome = 0;
    let todayExpense = 0;
    let cashBalance = 0;
    let bankBalance = 0;

    records.forEach(r => {
      const amt = Number(r.amount) || 0;
      const isCash = !r.description.includes('Chuyển khoản');
      const rDate = (r.date || r.created_at || '').slice(0, 10);

      if (r.type === 'income') {
        totalIncome += amt;
        if (rDate === todayStr) todayIncome += amt;
        if (isCash) cashBalance += amt;
        else bankBalance += amt;
      } else {
        totalExpense += amt;
        if (rDate === todayStr) todayExpense += amt;
        if (isCash) cashBalance -= amt;
        else bankBalance -= amt;
      }
    });

    return {
      totalIncome,
      totalExpense,
      todayIncome,
      todayExpense,
      totalBalance: totalIncome - totalExpense,
      cashBalance,
      bankBalance
    };
  }, [records]);

  // Handle Save Income
  const handleSaveIncome = async () => {
    const amt = parseFloat(incAmount.replace(/[^0-9]/g, ''));
    if (!amt || amt <= 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '⚠️ Vui lòng nhập số tiền thu hợp lệ!', type: 'warning' }
      }));
      return;
    }

    const payerText = incPayer.trim() ? ` [Người nộp: ${incPayer.trim()}]` : '';
    const methodText = ` [HÌNH THỨC: ${incMethod}]`;
    const noteText = incNote.trim() ? ` (${incNote.trim()})` : '';

    const newRecord: FinancialRecord = {
      id: generateUUID(),
      group_id: 'default',
      type: 'income',
      amount: amt,
      category: incCategory,
      description: `Thu tiền: ${incCategory}${payerText}${methodText}${noteText}`,
      recorded_by: 'Thủ quỹ TDP',
      date: incDate,
      created_at: new Date().toISOString()
    };

    try {
      await db.saveFinancialRecord(newRecord);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '✅ Đã lập phiếu Thu tiền thành công!', type: 'success' }
      }));
      setShowIncomeModal(false);
      // Reset form
      setIncPayer('');
      setIncAmount('');
      setIncNote('');
      loadData();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ Lỗi ghi thu: ${err.message || err}`, type: 'danger' }
      }));
    }
  };

  // Handle Save Expense
  const handleSaveExpense = async () => {
    const amt = parseFloat(expAmount.replace(/[^0-9]/g, ''));
    if (!amt || amt <= 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '⚠️ Vui lòng nhập số tiền chi hợp lệ!', type: 'warning' }
      }));
      return;
    }

    const payeeText = expPayee.trim() ? ` [Người/Đơn vị nhận: ${expPayee.trim()}]` : '';
    const methodText = ` [HÌNH THỨC: ${expMethod}]`;
    const approverText = ` [Người duyệt: ${expApprover}]`;
    const noteText = expNote.trim() ? ` (Lý do: ${expNote.trim()})` : '';

    const newRecord: FinancialRecord = {
      id: generateUUID(),
      group_id: 'default',
      type: 'expense',
      amount: amt,
      category: expCategory,
      description: `Chi tiền: ${expCategory}${payeeText}${approverText}${methodText}${noteText}`,
      recorded_by: 'Thủ quỹ TDP',
      date: expDate,
      created_at: new Date().toISOString()
    };

    try {
      await db.saveFinancialRecord(newRecord);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '✅ Đã lập phiếu Chi tiền thành công!', type: 'success' }
      }));
      setShowExpenseModal(false);
      // Reset form
      setExpPayee('');
      setExpAmount('');
      setExpNote('');
      loadData();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ Lỗi ghi chi: ${err.message || err}`, type: 'danger' }
      }));
    }
  };

  // Handle Delete Record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này khỏi sổ quỹ không?')) return;
    try {
      await db.deleteFinancialRecord(id);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Đã xóa khoản giao dịch khỏi sổ quỹ', type: 'info' }
      }));
      loadData();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ Lỗi xóa giao dịch: ${err.message || err}`, type: 'danger' }
      }));
    }
  };

  // Format currency
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Export Excel Cash Book (Sổ Quỹ Tiền Mặt)
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('So_Quy_Tien_Mat');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Ngày chứng từ', key: 'date', width: 16 },
      { header: 'Hạng mục', key: 'category', width: 22 },
      { header: 'Diễn giải / Nội dung thu chi', key: 'description', width: 45 },
      { header: 'Thu (VNĐ)', key: 'income', width: 18 },
      { header: 'Chi (VNĐ)', key: 'expense', width: 18 },
      { header: 'Người thực hiện', key: 'recorded_by', width: 18 }
    ];

    filteredRecords.forEach((r, idx) => {
      worksheet.addRow({
        stt: idx + 1,
        date: formatDateVN(r.date || r.created_at),
        category: r.category,
        description: r.description,
        income: r.type === 'income' ? r.amount : 0,
        expense: r.type === 'expense' ? r.amount : 0,
        recorded_by: r.recorded_by || 'Thủ quỹ'
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Quy_Thu_Quy_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print Receipt / Voucher HTML Window
  const handlePrintVoucher = (r: FinancialRecord) => {
    const isInc = r.type === 'income';
    const title = isInc ? 'PHIẾU THU TIỀN' : 'PHIẾU CHI TIỀN';
    const subtitle = isInc ? 'Chứng từ thu nhận quỹ & đóng góp' : 'Chứng từ thanh toán & chi quỹ';
    
    // Signatures
    let sigs: any[] = [];
    try {
      sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
    } catch {}
    const tq = sigs.find((s: any) => s.id === 'thu_quy')?.name || 'Thủ quỹ';
    const kt = sigs.find((s: any) => s.id === 'ke_toan')?.name || 'Kế toán';
    const tt = sigs.find((s: any) => s.id === 'to_truong')?.name || 'Tổ trưởng TDP';

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${r.id.slice(0, 8)}</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #000; }
          .header { text-align: center; margin-bottom: 25px; }
          .header h2 { margin: 0; font-size: 22px; text-transform: uppercase; }
          .header p { margin: 5px 0; font-style: italic; font-size: 14px; }
          .title { text-align: center; margin: 20px 0; }
          .title h1 { margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; }
          .title p { margin: 4px 0 0 0; font-style: italic; font-size: 14px; }
          .content-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 16px; }
          .content-table td { padding: 8px 4px; vertical-align: top; }
          .content-table td.label { width: 160px; font-weight: bold; }
          .amount-box { border: 2px solid #000; padding: 12px; font-size: 18px; font-weight: bold; margin: 15px 0; text-align: center; background: #f8fafc; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
          .sig-box { flex: 1; }
          .sig-box h4 { margin: 0; font-size: 15px; text-transform: uppercase; }
          .sig-box p { margin: 4px 0 0 0; font-style: italic; font-size: 13px; color: #555; }
          .sig-space { height: 70px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div className="header">
          <h2>TỔ DÂN PHỐ QUẢNG GIAO</h2>
          <p>Phường Nam Sầm Sơn – TP. Sầm Sơn</p>
        </div>

        <div className="title">
          <h1>${title}</h1>
          <p>${subtitle}</p>
          <p style="font-size: 13px; margin-top: 6px;">Mã chứng từ: <strong>#${r.id.slice(0, 8).toUpperCase()}</strong> | Ngày lập: ${formatDateVN(r.date || r.created_at)}</p>
        </div>

        <table className="content-table">
          <tr>
            <td className="label">${isInc ? 'Họ tên người nộp:' : 'Người / Đơn vị nhận:'}</td>
            <td><strong>${r.description.includes('[Người nộp:') ? r.description.split('[Người nộp:')[1].split(']')[0] : r.description.includes('[Người/Đơn vị nhận:') ? r.description.split('[Người/Đơn vị nhận:')[1].split(']')[0] : 'Nhiều hộ / Đại diện'}</strong></td>
          </tr>
          <tr>
            <td className="label">Nội dung ${isInc ? 'thu:' : 'chi:'}</td>
            <td>${r.category} (${r.description})</td>
          </tr>
          <tr>
            <td className="label">Hình thức:</td>
            <td>${r.description.includes('Chuyển khoản') ? '💳 Chuyển khoản ngân hàng' : '💵 Tiền mặt'}</td>
          </tr>
          <tr>
            <td className="label">Số tiền:</td>
            <td><strong style="font-size: 18px;">${formatVND(r.amount)}</strong></td>
          </tr>
        </table>

        <div className="amount-box">
          BẰNG CHỮ: ${formatVND(r.amount)} (Đã bao gồm xác nhận từ Thủ quỹ TDP)
        </div>

        <div className="signatures">
          <div className="sig-box">
            <h4>${isInc ? 'Người Nộp Tiền' : 'Người Nhận Tiền'}</h4>
            <p>(Ký & ghi rõ họ tên)</p>
            <div className="sig-space"></div>
          </div>
          <div className="sig-box">
            <h4>Thủ Quỹ</h4>
            <p>(Ký & ghi rõ họ tên)</p>
            <div className="sig-space"></div>
            <strong>${tq}</strong>
          </div>
          <div className="sig-box">
            <h4>Kế Toán</h4>
            <p>(Ký & ghi rõ họ tên)</p>
            <div className="sig-space"></div>
            <strong>${kt}</strong>
          </div>
          <div className="sig-box">
            <h4>Tổ Trưởng TDP</h4>
            <p>(Duyệt & Đóng dấu)</p>
            <div className="sig-space"></div>
            <strong>${tt}</strong>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
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
              Sổ Quỹ & Quản Lý Thủ Quỹ
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Theo dõi tiền mặt hàng ngày, lập phiếu thu nhận tiền và ghi nhận các khoản chi tiêu của Tổ dân phố
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowIncomeModal(true)}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Plus size={18} /> Lập Phiếu Thu (Nhận tiền)
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="btn btn-secondary"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} /> Lập Phiếu Chi (Xuất tiền)
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Today Income */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #10b981', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Thu hôm nay</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={20} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#047857', marginTop: '10px' }}>
            {formatVND(stats.todayIncome)}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Tự động ghi nhận tiền vào sổ</span>
        </div>

        {/* Card 2: Today Expense */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #ef4444', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Chi hôm nay</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={20} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#b91c1c', marginTop: '10px' }}>
            {formatVND(stats.todayExpense)}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Khoản xuất chi đã duyệt</span>
        </div>

        {/* Card 3: Cash Balance */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #3b82f6', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Tồn quỹ Tiền Mặt</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} color="#3b82f6" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1d4ed8', marginTop: '10px' }}>
            {formatVND(stats.cashBalance)}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Tiền mặt Thủ quỹ đang giữ</span>
        </div>

        {/* Card 4: Total Treasury Balance */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #8b5cf6', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Tổng Số Dư Quỹ</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={20} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#6d28d9', marginTop: '10px' }}>
            {formatVND(stats.totalBalance)}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Tất cả các nguồn quỹ hiện có</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'white' }}>
        {/* Controls Header: Search & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {/* Top Control Bar: Tabs & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === 'all' ? 'white' : 'transparent',
                  color: activeTab === 'all' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                📋 Tất cả nhật ký ({records.length})
              </button>
              <button
                onClick={() => setActiveTab('income')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === 'income' ? '#ecfdf5' : 'transparent',
                  color: activeTab === 'income' ? '#047857' : '#64748b',
                  boxShadow: activeTab === 'income' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                📥 Sổ thu nhận tiền
              </button>
              <button
                onClick={() => setActiveTab('expense')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === 'expense' ? '#fef2f2' : 'transparent',
                  color: activeTab === 'expense' ? '#b91c1c' : '#64748b',
                  boxShadow: activeTab === 'expense' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                📤 Nhật ký chi tiền
              </button>
            </div>

            {/* Excel Download & Export */}
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <Download size={16} /> Xuất Sổ Quỹ Excel
            </button>
          </div>

          {/* Sub Filters Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tìm theo người nộp, người nhận, lý do, số tiền..."
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
              <option value="today">📅 Thu Chi Hôm nay</option>
              <option value="this_week">📆 Thu Chi Tuần này</option>
              <option value="this_month">🗓️ Thu Chi Tháng này</option>
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

        {/* Transactions Table */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Clock size={32} className="pulse" style={{ marginBottom: '8px' }} />
            <div>Đang tải dữ liệu sổ quỹ...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <Landmark size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
            <h3 style={{ margin: 0, color: '#334155', fontSize: '1rem' }}>Chưa có chứng từ thu/chi nào phù hợp</h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Hãy nhấn nút "Lập Phiếu Thu" hoặc "Lập Phiếu Chi" để bắt đầu ghi nhận nhật ký Thủ quỹ.
            </p>
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
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Diễn giải / Nội dung thu chi</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', textAlign: 'right', width: '140px' }}>Số tiền (VNĐ)</th>
                  <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '700', textAlign: 'center', width: '130px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const isInc = r.type === 'income';
                  const isTransfer = r.description.includes('Chuyển khoản');

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: '600' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: '600', color: '#334155' }}>
                        {formatDateVN(r.date || r.created_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: isInc ? '#ecfdf5' : '#fef2f2',
                          color: isInc ? '#047857' : '#b91c1c',
                          border: isInc ? '1px solid #a7f3d0' : '1px solid #fecaca'
                        }}>
                          {isInc ? '📥 THU' : '📤 CHI'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>
                        {r.category}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155', lineHeight: '1.4' }}>
                        <div>{r.description}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span>{isTransfer ? '💳 Chuyển khoản' : '💵 Tiền mặt'}</span>
                          <span>• Người ghi: {r.recorded_by || 'Thủ quỹ'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: isInc ? '#047857' : '#b91c1c' }}>
                        {isInc ? '+' : '-'}{formatVND(r.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handlePrintVoucher(r)}
                            title="In phiếu chứng từ"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: 'white',
                              color: '#3b82f6',
                              cursor: 'pointer'
                            }}
                          >
                            <Printer size={15} />
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r.id)}
                              title="Xóa giao dịch này"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={15} />
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

      {/* Modal 1: Lập Phiếu Thu tiền hàng ngày */}
      {showIncomeModal && (
        <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }}>
          <div className="modal-content" style={{ background: 'white', borderRadius: '16px', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📥 Lập Phiếu Thu Tiền (Thủ Quỹ Nhận Tiền)
              </h3>
              <button onClick={() => setShowIncomeModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Họ tên người nộp / Hộ dân / Đơn vị:</label>
                <input
                  type="text"
                  placeholder="Nhập tên người nộp tiền (VD: Nguyễn Văn A - Hộ 12)..."
                  value={incPayer}
                  onChange={(e) => setIncPayer(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Khoản thu (Hạng mục):</label>
                  <select
                    value={incCategory}
                    onChange={(e) => setIncCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Thu quỹ TDP">Thu quỹ TDP</option>
                    <option value="Thu quỹ Phường">Thu quỹ Phường</option>
                    <option value="Đóng góp tự nguyện">Đóng góp tự nguyện</option>
                    <option value="Ủng hộ sự kiện / Lễ hội">Ủng hộ sự kiện / Lễ hội</option>
                    <option value="Thu nộp phạt / Khác">Thu nộp phạt / Khác</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Phương thức nhận tiền:</label>
                  <select
                    value={incMethod}
                    onChange={(e) => setIncMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Tiền mặt">💵 Tiền mặt</option>
                    <option value="Chuyển khoản">💳 Chuyển khoản</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Số tiền thu (VNĐ):</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 200000"
                    value={incAmount}
                    onChange={(e) => setIncAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'bold', color: '#047857' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Ngày thu nhận:</label>
                  <input
                    type="date"
                    value={incDate}
                    onChange={(e) => setIncDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Ghi chú / Số chứng từ:</label>
                <input
                  type="text"
                  placeholder="Ghi chú bổ sung (nếu có)..."
                  value={incNote}
                  onChange={(e) => setIncNote(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveIncome}
                  className="btn btn-primary"
                  style={{ flex: 1.5, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
                >
                  Xác nhận Lập Phiếu Thu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Lập Phiếu Chi tiền (Chi như thế nào) */}
      {showExpenseModal && (
        <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)' }}>
          <div className="modal-content" style={{ background: 'white', borderRadius: '16px', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📤 Lập Phiếu Chi Tiền (Chi Như Thế Nào)
              </h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Người / Đơn vị nhận tiền chi:</label>
                <input
                  type="text"
                  placeholder="Nhập tên đối tượng nhận chi (VD: Cửa hàng văn phòng phẩm X)..."
                  value={expPayee}
                  onChange={(e) => setExpPayee(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Nội dung chi (Hạng mục):</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Hoạt động chung TDP">Hoạt động chung TDP</option>
                    <option value="Mua sắm vật tư / Dụng cụ">Mua sắm vật tư / Dụng cụ</option>
                    <option value="Chi tiền điện nước / Sinh hoạt">Chi tiền điện nước / Sinh hoạt</option>
                    <option value="Chi tiếp khách / Lễ hội">Chi tiếp khách / Lễ hội</option>
                    <option value="Chi hỗ trợ thăm hỏi">Chi hỗ trợ thăm hỏi</option>
                    <option value="Nộp quỹ cấp trên">Nộp quỹ cấp trên</option>
                    <option value="Chi khác">Chi khác</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Hình thức thanh toán:</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}
                  >
                    <option value="Tiền mặt">💵 Tiền mặt</option>
                    <option value="Chuyển khoản">💳 Chuyển khoản</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Số tiền chi (VNĐ):</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 500000"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'bold', color: '#b91c1c' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Ngày chi xuất tiền:</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Người phê duyệt chi:</label>
                <select
                  value={expApprover}
                  onChange={(e) => setExpApprover(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}
                >
                  <option value="Tổ trưởng TDP">Tổ trưởng TDP</option>
                  <option value="Bí thư Chi bộ">Bí thư Chi bộ</option>
                  <option value="Kế toán">Kế toán</option>
                  <option value="Ban CT Mặt trận">Ban CT Mặt trận</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Lý do chi chi tiết:</label>
                <textarea
                  placeholder="Mô tả cụ thể lý do chi, hóa đơn đính kèm (nếu có)..."
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveExpense}
                  className="btn btn-primary"
                  style={{ flex: 1.5, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none' }}
                >
                  Xác nhận Lập Phiếu Chi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
