import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Eye, ShieldAlert, X } from 'lucide-react';
import { db, generateUUID } from '../services/db';
import type { SecurityLog } from '../services/db';
import { showToast } from '../utils/toast';

const Security = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'ok' | 'alert'>('alert');

  const loadData = async () => {
    try {
      const list = await db.getSecurityLogs();
      setLogs(list);
    } catch (e) {
      showToast('Lỗi tải nhật ký an ninh!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Khách không có quyền báo cáo sự vụ an ninh!', 'warning');
      return;
    }
    if (!title.trim() || !description.trim()) {
      showToast('Vui lòng nhập đầy đủ thông tin báo cáo!', 'warning');
      return;
    }

    const payload: SecurityLog = {
      id: generateUUID(),
      title,
      description,
      type,
      date: new Date().toISOString().slice(0, 10)
    };

    try {
      await db.saveSecurityLog(payload);
      showToast('Ghi nhận sự vụ an ninh thành công!', 'success');
      setIsFormOpen(false);
      setTitle('');
      setDescription('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi lưu báo cáo an ninh!', 'danger');
    }
  };

  const alertCount = logs.filter(l => l.type === 'alert').length;

  return (
    <div className="security-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>An ninh trật tự</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Giám sát tình hình trật tự xã hội và lưu trữ nhật ký tuần tra bảo vệ khu dân cư.
          </p>
          {!isGuest && (
            <button 
              className="btn btn-primary" 
              onClick={() => setIsFormOpen(true)}
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
                minHeight: '36px'
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
              <AlertTriangle size={16} /> Báo cáo vụ việc
            </button>
          )}
        </div>
      </div>

      <div className="security-grid">
         <div className="security-card stat">
            <ShieldCheck size={32} color={alertCount > 0 ? "var(--warning)" : "var(--success)"} />
            <div className="txt">
               <span className="l">Tình trạng địa bàn</span>
               <span className="v">{alertCount > 0 ? `Có ${alertCount} cảnh báo gần đây` : 'Ổn định, an toàn'}</span>
            </div>
         </div>
         <div className="security-card stat">
            <Eye size={32} color="var(--primary)" />
            <div className="txt">
               <span className="l">Lịch tuần tra đêm tự quản</span>
               <span className="v">21:00 - 23:00 hàng ngày</span>
            </div>
         </div>
      </div>

      <div className="incident-list">
         <h3>Nhật ký an ninh & tuần tra gần đây</h3>
         <div className="list-wrapper">
           {logs.map(log => (
              <div key={log.id} className="incident-item">
                 {log.type === 'alert' ? (
                   <ShieldAlert size={20} className="icon-red" />
                 ) : (
                   <ShieldCheck size={20} className="icon-green" />
                 )}
                 <div className="det">
                    <div className="t">{log.title}</div>
                    <div className="d">{new Date(log.date).toLocaleDateString('vi-VN')} - {log.description}</div>
                 </div>
              </div>
           ))}
           {logs.length === 0 && (
             <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
               Chưa ghi nhận sự kiện an ninh nào.
             </div>
           )}
         </div>
      </div>

      {/* New Incident Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Báo cáo sự vụ / tuần tra</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Loại nhật ký *</label>
                <select value={type} onChange={(e: any) => setType(e.target.value)}>
                  <option value="alert">Cảnh báo mất an ninh (Trộm cắp, gây rối...)</option>
                  <option value="ok">Báo cáo tuần tra bình thường (An toàn)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tiêu đề sự kiện *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Tuần tra đêm địa bàn, Mất trộm xe đạp..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Chi tiết nội dung vụ việc *</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả cụ thể thời gian xảy ra, đối tượng liên quan và cách thức xử lý..."
                  style={{height: '100px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'}}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu báo cáo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .security-page { animation: fadeIn 0.4s ease-out; }
        .security-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .security-card { background: white; padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; }
        .txt { display: flex; flex-direction: column; }
        .l { font-size: 0.85rem; color: var(--text-muted); }
        .v { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
        
        .incident-list { background: white; padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border); }
        .incident-item { display: flex; gap: 16px; padding: 16px; border-bottom: 1px solid #f1f5f9; }
        .incident-item:last-child { border-bottom: none; }
        .icon-red { color: var(--danger); }
        .icon-green { color: var(--success); }
        .det .t { font-weight: 700; margin-bottom: 4px; color: var(--text-main); }
        .det .d { font-size: 0.9rem; color: #475569; line-height: 1.4; }
        
        @media (max-width: 768px) {
          .security-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Security;
