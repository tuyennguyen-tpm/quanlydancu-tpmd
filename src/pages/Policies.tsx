import { useState, useEffect } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Calendar,
  Gift,
  AlertCircle,
  X,
  Plus,
  HeartHandshake
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Resident, Household } from '../types';

interface ActivityProgram {
  id: string;
  title: string;
  desc: string;
  targetGroup: string;
  date: string;
}

const Policies = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activities, setActivities] = useState<ActivityProgram[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [targetGroup, setTargetGroup] = useState('poor');

  const getAge = (dobString: string) => {
    if (!dobString) return 0;
    return new Date().getFullYear() - new Date(dobString).getFullYear();
  };

  const loadData = async () => {
    try {
      const rList = await db.getResidents();
      const hList = await db.getHouseholds();
      setResidents(rList);
      setHouseholds(hList);

      // Load activities program from database
      const list = await db.getActivityPrograms();
      setActivities(list);
    } catch (e) {
      showToast('Lỗi tải dữ liệu chính sách!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Khách không có quyền lập chương trình hỗ trợ!', 'warning');
      return;
    }
    if (!title.trim() || !desc.trim()) {
      showToast('Vui lòng nhập đầy đủ thông tin chương trình!', 'warning');
      return;
    }

    const newActivity: ActivityProgram = {
      id: generateUUID(),
      title,
      desc,
      targetGroup,
      date: new Date().toISOString().slice(0, 10),
    };

    try {
      await db.saveActivityProgram(newActivity);
      showToast('Tạo chương trình hỗ trợ thành công!', 'success');
      setIsFormOpen(false);
      setTitle('');
      setDesc('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Không thể tạo chương trình hỗ trợ!', 'danger');
    }
  };

  // Live Stats calculations
  const seniorCount = residents.filter(r => getAge(r.dob) >= 80).length;
  const poorCount = households.filter(h => h.policy_type === 'poor').length;
  const nearPoorCount = households.filter(h => h.policy_type === 'near_poor').length;
  const policyFamilyCount = households.filter(h => h.policy_type === 'policy_family').length;

  const policyGroups = [
    { title: 'Người cao tuổi (≥ 80 tuổi)', count: seniorCount, icon: Calendar, color: 'blue' },
    { title: 'Hộ nghèo', count: poorCount, icon: Heart, color: 'red' },
    { title: 'Hộ cận nghèo', count: nearPoorCount, icon: AlertCircle, color: 'orange' },
    { title: 'Gia đình chính sách', count: policyFamilyCount, icon: ShieldCheck, color: 'indigo' },
  ];

  const getTargetGroupLabel = (group: string) => {
    switch (group) {
      case 'poor': return 'Hộ nghèo';
      case 'near_poor': return 'Hộ cận nghèo';
      case 'policy_family': return 'Gia đình chính sách';
      case 'seniors': return 'Người cao tuổi';
      default: return 'Tất cả';
    }
  };

  return (
    <div className="policy-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Chế độ & Chính sách An sinh</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Quản lý các nhóm đối tượng ưu tiên, bảo trợ xã hội và lập chương trình hỗ trợ cộng đồng.
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
              <Gift size={16} /> Lập chương trình hỗ trợ
            </button>
          )}
        </div>
      </div>

      <div className="policy-groups">
        {policyGroups.map((g, i) => (
          <div key={i} className="policy-card">
            <div className={`p-icon ${g.color}`}><g.icon size={28} /></div>
            <div className="p-info">
              <h3>{g.title}</h3>
              <div className="p-count">
                <span className="number">{g.count}</span>
                <span className="unit">{i === 0 ? 'nhân khẩu' : 'hộ gia đình'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="recent-activities">
         <h2>Chương trình hỗ trợ an sinh xã hội tháng này</h2>
         <div className="activity-list">
            {activities.map(act => (
              <div key={act.id} className="act-item">
                 <div className="act-header-row">
                   <div className="act-header">{act.title}</div>
                   <span className="target-badge">{getTargetGroupLabel(act.targetGroup)}</span>
                 </div>
                 <div className="act-desc">{act.desc}</div>
                 <div className="act-date">Ngày tạo: {new Date(act.date).toLocaleDateString('vi-VN')}</div>
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
                Chưa có hoạt động an sinh nào được lập trong tháng.
              </div>
            )}
         </div>
      </div>

      {/* New Activity Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Lập chương trình hỗ trợ mới</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateActivity} className="modal-form">
              <div className="form-group">
                <label>Tên chương trình hỗ trợ *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Tặng quà Trung thu cho các cháu, Phát gạo..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Nhóm đối tượng thụ hưởng *</label>
                <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
                  <option value="poor">Danh sách Hộ nghèo</option>
                  <option value="near_poor">Danh sách Hộ cận nghèo</option>
                  <option value="policy_family">Danh sách Hộ chính sách (Thương binh, Liệt sĩ)</option>
                  <option value="seniors">Người cao tuổi (≥ 80 tuổi)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Nội dung chi tiết chương trình *</label>
                <textarea 
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ghi rõ định mức quà tặng, thời gian và địa điểm cấp phát cụ thể..."
                  style={{height: '100px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'}}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary"><HeartHandshake size={16} /> Xác nhận phát động</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .policy-page { animation: fadeIn 0.4s ease-out; }
        .policy-groups {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .policy-card {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .p-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .p-icon.blue { background: rgba(37, 99, 235, 0.1); color: var(--primary); }
        .p-icon.red { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .p-icon.orange { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .p-icon.indigo { background: rgba(129, 140, 248, 0.1); color: #6366f1; }

        .p-info h3 { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 4px; }
        .p-count .number { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
        .p-count .unit { font-size: 0.8rem; margin-left: 4px; color: var(--text-muted); }

        .recent-activities {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }
        .recent-activities h2 { font-size: 1.2rem; margin-bottom: 20px; }
        .activity-list { display: flex; flex-direction: column; gap: 16px; }
        .act-item {
          padding: 16px;
          background: #f8fafc;
          border-radius: var(--radius-md);
          border-left: 4px solid var(--primary);
        }
        .act-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .act-header { font-weight: 700; color: var(--text-main); }
        
        .target-badge {
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .act-desc { font-size: 0.92rem; color: #475569; line-height: 1.5; }
        .act-date { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }
      `}</style>
    </div>
  );
};

export default Policies;
