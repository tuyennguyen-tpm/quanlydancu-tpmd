import { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { FinancialRecord } from '../types';

const Finance = () => {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

  // Form states
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [recordedBy, setRecordedBy] = useState('Ban Quản lý');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    try {
      const list = await db.getFinancialRecords();
      setRecords(list);
    } catch (e) {
      showToast('Lỗi tải dữ liệu tài chính!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setType('income');
    setAmount('');
    setCategory('');
    setDescription('');
    setRecordedBy('Ban Quản lý');
    setDate(new Date().toISOString().slice(0, 10));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
    setEditingRecord(record);
    setType(record.type);
    setAmount(record.amount.toString());
    setCategory(record.category);
    setDescription(record.description);
    setRecordedBy(record.recorded_by);
    setDate(record.date);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
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
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'warning');
      return;
    }
    if (!category.trim() || !description.trim()) {
      showToast('Vui lòng nhập đầy đủ danh mục và nội dung!', 'warning');
      return;
    }

    const payload: FinancialRecord = {
      id: editingRecord ? editingRecord.id : `F-${Date.now()}`,
      group_id: db.getGroupId(),
      type,
      amount: parsedAmount,
      category,
      description,
      recorded_by: recordedBy,
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

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    const headers = ['Ngày lập', 'Loại phiếu', 'Nội dung', 'Danh mục', 'Người lập', 'Số tiền (VND)'];
    const rows = filteredRecords.map(r => [
      r.date,
      r.type === 'income' ? 'Thu' : 'Chi',
      r.description,
      r.category,
      r.recorded_by,
      (r.type === 'income' ? '+' : '-') + r.amount
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `so_thu_chi_nam_sam_son_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất báo cáo Sổ thu chi thành công!', 'success');
  };

  // Calculations
  const totalIncome = records
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const balance = totalIncome - totalExpense;

  const filteredRecords = records.filter(r => {
    const matchesType = activeType === 'all' || r.type === activeType;
    const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.recorded_by.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amt);
  };

  return (
    <div className="finance-container">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Thu chi cộng đồng</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Quản lý và công khai minh bạch tài chính của Tổ dân phố.
          </p>
          <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleExportCSV}
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
          </div>
        </div>
      </div>

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
      </div>

      <div className="content-filters">
        <div className="filter-tabs">
          <button className={`tab ${activeType === 'all' ? 'active' : ''}`} onClick={() => setActiveType('all')}>Tất cả</button>
          <button className={`tab ${activeType === 'income' ? 'active' : ''}`} onClick={() => setActiveType('income')}>Khoản thu</button>
          <button className={`tab ${activeType === 'expense' ? 'active' : ''}`} onClick={() => setActiveType('expense')}>Khoản chi</button>
        </div>
        <div className="search-and-date">
            <div className="search-mini">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Tìm nội dung, danh mục..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="date-filter"><Calendar size={16} /> Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</button>
        </div>
      </div>

      <div className="finance-table-wrapper">
         <table className="data-table">
            <thead>
               <tr>
                  <th>Ngày lập</th>
                  <th>Nội dung</th>
                  <th>Danh mục</th>
                  <th>Người lập</th>
                  <th style={{textAlign: 'right'}}>Số tiền</th>
                  <th style={{textAlign: 'right', paddingRight: '20px'}}>Hành động</th>
               </tr>
            </thead>
            <tbody>
               {filteredRecords.map(t => (
                  <tr key={t.id}>
                     <td className="date-cell">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                     <td className="title-cell">
                        <div className={`type-indicator ${t.type}`}></div>
                        {t.description}
                     </td>
                     <td><span className="category-tag">{t.category}</span></td>
                     <td>{t.recorded_by}</td>
                     <td className={`amount-cell ${t.type === 'income' ? 'success' : 'danger'}`}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                     </td>
                     <td style={{textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '16px'}}>
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
          <div className="modal-content">
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

              <div className="form-group">
                <label>Số tiền (VND) *</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ví dụ: 500000"
                  required
                />
              </div>

              <div className="form-group">
                <label>Danh mục quỹ *</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ví dụ: Phí vệ sinh, Quỹ vận động, Thiết bị"
                  required
                />
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
                  <label>Người lập phiếu</label>
                  <input 
                    type="text" 
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ngày ghi nhận</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu phiếu</button>
              </div>
            </form>
          </div>
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
          background-color: #f8fafc;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
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
      `}</style>
    </div>
  );
};

export default Finance;
