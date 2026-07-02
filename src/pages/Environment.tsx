import { useState, useEffect } from 'react';
import { Trash2, Calendar, Droplets, X, Leaf, RefreshCw } from 'lucide-react';
import { db, generateUUID } from '../services/db';
import type { EnvironmentLog } from '../services/db';
import { showToast } from '../utils/toast';

const Environment = () => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || currentRole === 'demo';

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  const [logs, setLogs] = useState<EnvironmentLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<'ok' | 'warning' | 'danger'>('ok');

  const loadData = async () => {
    try {
      const list = await db.getEnvironmentLogs();
      setLogs(list);
    } catch (e) {
      showToast('Lỗi tải dữ liệu môi trường!', 'danger');
    }
  };

  const handleDeleteEnvironmentLog = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lịch dọn dẹp và theo dõi của khu vực này không?')) {
      try {
        await db.deleteEnvironmentLog(id);
        showToast('Xóa khu vực thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa lịch dọn dẹp!', 'danger');
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Khách không có quyền lên lịch dọn dẹp vệ sinh!', 'warning');
      return;
    }
    if (!area.trim()) {
      showToast('Vui lòng nhập tên khu vực!', 'warning');
      return;
    }

    const payload: EnvironmentLog = {
      id: generateUUID(),
      area,
      status,
      last_cleaned: new Date().toISOString().slice(0, 10)
    };

    try {
      await db.saveEnvironmentLog(payload);
      showToast('Lên lịch dọn dẹp khu vực thành công!', 'success');
      setIsFormOpen(false);
      setArea('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi lưu lịch dọn dẹp!', 'danger');
    }
  };

  const handleToggleStatus = async (log: EnvironmentLog) => {
    if (isGuest) {
      showToast('Khách không có quyền thay đổi trạng thái vệ sinh!', 'warning');
      return;
    }
    const nextStatusMap: Record<'ok' | 'warning' | 'danger', 'ok' | 'warning' | 'danger'> = {
      'ok': 'warning',
      'warning': 'danger',
      'danger': 'ok'
    };
    
    const updated: EnvironmentLog = {
      ...log,
      status: nextStatusMap[log.status],
      last_cleaned: new Date().toISOString().slice(0, 10)
    };

    try {
      await db.saveEnvironmentLog(updated);
      showToast(`Đã cập nhật trạng thái vệ sinh của ${log.area}!`, 'success');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Không thể cập nhật trạng thái vệ sinh!', 'danger');
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'ok': return 'Sạch sẽ';
      case 'warning': return 'Cần dọn dẹp';
      default: return 'Ô nhiễm / Có rác';
    }
  };

  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.last_cleaned).getTime();
    const dateB = new Date(b.last_cleaned).getTime();
    return dateB - dateA;
  });

  return (
    <div className="env-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Vệ sinh môi trường</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Giám sát vệ sinh ngõ xóm, lên lịch quét dọn định kỳ xây dựng khu dân cư xanh - sạch - đẹp.
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
              <Calendar size={16} /> Lên lịch dọn vệ sinh
            </button>
          )}
        </div>
      </div>

      <div className="env-grid">
         <div className="env-card">
            <div className="e-icon"><Trash2 size={28} /></div>
            <div className="e-info">
               <h3>Lịch thu gom rác thải</h3>
               <p>Hàng ngày (17:30 - 18:30) xe rác đi qua trục chính.</p>
            </div>
         </div>
         <div className="env-card">
            <div className="e-icon secondary"><Droplets size={28} /></div>
            <div className="e-info">
               <h3>Ngày Chủ Nhật Xanh</h3>
               <p>Tổng vệ sinh toàn tổ dân phố vào Chủ nhật cuối tháng.</p>
            </div>
         </div>
      </div>

      <div className="env-status">
         <h3>{isGuest ? 'Tình hình vệ sinh các ngõ xóm' : 'Tình hình vệ sinh các ngõ xóm (Bấm nút cập nhật để đổi trạng thái)'}</h3>
         <div className="list-wrapper">
           {sortedLogs.map(log => (
              <div key={log.id} className="status-box">
                 <div>
                   <div className="s-header">{log.area}</div>
                   <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>
                     Quét dọn gần nhất: {new Date(log.last_cleaned).toLocaleDateString('vi-VN')}
                   </div>
                 </div>
                 <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <span className={`s-badge ${log.status}`}>
                       {getStatusLabel(log.status)}
                    </span>
                     {!isGuest && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="icon-btn-sm" onClick={() => handleToggleStatus(log)} title="Đổi trạng thái">
                          <RefreshCw size={14} />
                        </button>
                        <button 
                          className="icon-btn-sm" 
                          onClick={() => handleDeleteEnvironmentLog(log.id)} 
                          title="Xóa khu vực"
                          style={{ color: 'var(--danger)', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                     )}
                 </div>
              </div>
           ))}
           {logs.length === 0 && (
             <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
               Chưa thiết lập khu vực giám sát vệ sinh nào.
             </div>
           )}
         </div>
      </div>

      {/* New Event Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Lên lịch dọn dẹp khu vực</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateLog} className="modal-form">
              <div className="form-group">
                <label>Khu vực / Ngõ xóm *</label>
                <input 
                  type="text" 
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Ví dụ: Khu vực cổng chào, Ngõ 49..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Đánh giá trạng thái ban đầu *</label>
                <select value={status} onChange={(e: any) => setStatus(e.target.value)}>
                  <option value="ok">Sạch sẽ, gọn gàng</option>
                  <option value="warning">Cần quét dọn / Phát quang</option>
                  <option value="danger">Ô nhiễm / Điểm đen rác thải</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary"><Leaf size={16} /> Lưu kế hoạch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .env-page { animation: fadeIn 0.4s ease-out; }
        .env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .env-card { background: white; padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; }
        .e-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(16, 185, 129, 0.1); color: var(--success); display: flex; align-items: center; justify-content: center; }
        .e-icon.secondary { background: rgba(59, 130, 246, 0.1); color: var(--info); }
        .e-info h3 { font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--text-main); }
        .e-info p { font-size: 0.85rem; color: var(--text-muted); }
        
        .env-status { background: white; padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border); }
        .status-box { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 12px; }
        .status-box:last-child { margin-bottom: 0; }
        .s-header { font-weight: 700; color: var(--text-main); }
        .s-badge { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
        .s-badge.ok { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .s-badge.warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .s-badge.danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        
        @media (max-width: 768px) {
          .env-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Environment;
