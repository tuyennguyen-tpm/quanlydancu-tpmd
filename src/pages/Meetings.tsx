import { useState, useEffect } from 'react';
import { Calendar, Users, MapPin, Clock, Plus, X, ListCollapse, FileText } from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { Meeting } from '../types';

const Meetings = ({ type = 'general' }: { type?: 'general' | 'party' | 'front' }) => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10) + 'T19:30');
  const [location, setLocation] = useState('Nhà văn hóa Tổ dân phố');
  const [attendanceCount, setAttendanceCount] = useState('0');

  const loadData = async () => {
    try {
      const list = await db.getMeetings();
      setMeetings(list);
    } catch (e) {
      showToast('Lỗi tải danh sách cuộc họp!', 'danger');
    }
  };

  const [tdpName, setTdpName] = useState(
    localStorage.getItem('tdp_name') || 'Nam Sầm Sơn'
  );

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung cuộc họp!', 'warning');
      return;
    }

    const payload: Meeting = {
      id: `M-${Date.now()}`,
      group_id: db.getGroupId(),
      title,
      content,
      date: new Date(date).toISOString(),
      location,
      attendance_count: parseInt(attendanceCount) || 0,
      created_at: new Date().toISOString(),
      type
    };

    try {
      await db.saveMeeting(payload);
      showToast('Tạo cuộc họp mới thành công!', 'success');
      setIsFormOpen(false);
      setTitle('');
      setContent('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi lưu cuộc họp!', 'danger');
    }
  };

  const handleCreateMinutes = (meetingId?: string, meetingType?: string) => {
    if (meetingId) {
      localStorage.setItem('selected_meeting_minutes_id', meetingId);
    } else {
      localStorage.removeItem('selected_meeting_minutes_id');
    }
    if (meetingType) {
      localStorage.setItem('selected_meeting_minutes_type', meetingType);
    } else {
      localStorage.removeItem('selected_meeting_minutes_type');
    }
    window.dispatchEvent(new CustomEvent('change-tab', { detail: 'meetings-minutes' }));
  };

  const now = new Date();
  
  // Sort meetings: upcoming vs past
  const upcomingMeetings = meetings
    .filter(m => (m.type || 'general') === type && new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastMeetings = meetings
    .filter(m => (m.type || 'general') === type && new Date(m.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="meetings-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
          {type === 'party' ? 'Họp chi bộ' : type === 'front' ? 'Họp mặt trận' : 'Quản lý họp dân'}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            {type === 'party' 
              ? `Tổ chức và quản lý thông tin các cuộc họp Chi bộ Tổ dân phố ${tdpName}.`
              : type === 'front'
                ? `Tổ chức và quản lý thông tin các cuộc họp Mặt trận Tổ quốc Tổ dân phố ${tdpName}.`
                : `Tổ chức và quản lý thông tin các cuộc họp Tổ dân phố ${tdpName}.`
            }
          </p>
          {!isGuest && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleCreateMinutes(undefined, type)}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  height: 'auto',
                  minHeight: '36px',
                  border: '2px solid var(--border)',
                  background: 'white',
                  color: 'var(--text-main)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <FileText size={16} /> Tạo biên bản
              </button>
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
                <Plus size={16} /> Tạo cuộc họp mới
              </button>
            </div>
          )}
        </div>
      </div>

      {upcomingMeetings.length > 0 ? (
        upcomingMeetings.map(m => (
          <div key={m.id} className="upcoming-meeting">
             <div className="up-badge">Sắp diễn ra</div>
             <h2 className="up-title">{m.title}</h2>
             <p style={{fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', marginBottom: '16px'}}>{m.content}</p>
             <div className="up-details">
                <div className="d-item"><Calendar size={16} /> {new Date(m.date).toLocaleDateString('vi-VN')}</div>
                <div className="d-item"><Clock size={16} /> {new Date(m.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</div>
                <div className="d-item"><MapPin size={16} /> {m.location}</div>
             </div>
             <div className="up-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span>Trạng thái: Đang chuẩn bị</span>
                 {!isGuest && (
                   <button
                     className="btn btn-secondary btn-sm"
                     onClick={() => handleCreateMinutes(m.id, type)}
                     style={{
                       padding: '4px 10px',
                       fontSize: '0.8rem',
                       background: 'rgba(255, 255, 255, 0.15)',
                       borderColor: 'rgba(255, 255, 255, 0.25)',
                       color: 'white',
                       height: '28px',
                       display: 'inline-flex',
                       alignItems: 'center',
                       gap: '6px'
                     }}
                     onMouseOver={(e) => {
                       e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                     }}
                     onMouseOut={(e) => {
                       e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                     }}
                   >
                     <FileText size={14} /> Lập biên bản
                   </button>
                 )}
              </div>
          </div>
        ))
      ) : (
        <div className="no-upcoming-meeting">
          Không có cuộc họp nào sắp diễn ra.
        </div>
      )}

      <div className="past-meetings">
         <h3>Nhật ký cuộc họp trước đó</h3>
         <div className="meetings-list-wrapper">
           {pastMeetings.map(m => (
              <div key={m.id} className="meeting-row">
                 <div className="m-date">
                   {new Date(m.date).getDate()}/{new Date(m.date).getMonth() + 1}
                 </div>
                 <div className="m-main">
                    <div className="m-t">{m.title}</div>
                    <div style={{fontSize: '0.9rem', color: '#475569', margin: '4px 0'}}>{m.content}</div>
                    <div className="m-s" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span>{m.attendance_count} hộ tham gia - Địa điểm: {m.location}</span>
                       {!isGuest && (
                         <button
                           className="btn btn-secondary btn-sm"
                           onClick={() => handleCreateMinutes(m.id, type)}
                           style={{
                             padding: '4px 10px',
                             fontSize: '0.8rem',
                             height: '28px',
                             border: '1.5px solid var(--border)',
                             display: 'inline-flex',
                             alignItems: 'center',
                             gap: '6px',
                             background: 'white',
                             color: 'var(--text-main)',
                             fontWeight: '600'
                           }}
                           onMouseOver={(e) => {
                             e.currentTarget.style.transform = 'translateY(-1px)';
                           }}
                           onMouseOut={(e) => {
                             e.currentTarget.style.transform = 'translateY(0)';
                           }}
                         >
                           <FileText size={14} /> Lập biên bản
                         </button>
                       )}
                     </div>
                 </div>
                 <span className="past-badge">Đã xong</span>
              </div>
           ))}
           {pastMeetings.length === 0 && (
             <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
               Chưa có cuộc họp cũ nào được lưu.
             </div>
           )}
         </div>
      </div>

      {/* New Meeting Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{type === 'party' ? 'Tạo cuộc họp chi bộ mới' : type === 'front' ? 'Tạo cuộc họp mặt trận mới' : 'Tạo cuộc họp dân mới'}</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Tiêu đề cuộc họp *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Họp định kỳ tháng 06/2026..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Nội dung cuộc họp *</label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ghi rõ các nội dung chính cần bàn thảo trong cuộc họp..."
                  style={{height: '100px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'}}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Thời gian họp *</label>
                  <input 
                    type="datetime-local" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Địa điểm họp *</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Số lượng hộ gia đình tham gia dự kiến / thực tế</label>
                <input 
                  type="number" 
                  value={attendanceCount}
                  onChange={(e) => setAttendanceCount(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Tạo lịch họp</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .meetings-page { animation: fadeIn 0.4s ease-out; }
        
        .upcoming-meeting { 
          background: linear-gradient(135deg, var(--bg-sidebar), #334155);
          color: white;
          padding: 32px;
          border-radius: var(--radius-lg);
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }
        .up-badge { background: var(--primary); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; width: fit-content; margin-bottom: 20px; }
        .up-title { font-size: 1.5rem; margin-bottom: 12px; }
        .up-details { display: flex; gap: 24px; margin-bottom: 24px; opacity: 0.8; }
        .d-item { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
        .up-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.15); }
        
        .no-upcoming-meeting {
          background: white;
          border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          text-align: center;
          color: var(--text-muted);
          font-weight: 500;
          margin-bottom: 32px;
        }

        .past-meetings h3 { margin-bottom: 20px; }
        .meeting-row { display: flex; align-items: center; gap: 20px; padding: 16px; background: white; border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 12px; }
        .m-date { width: 60px; height: 60px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--primary); font-size: 0.95rem; text-align: center; line-height: 1; }
        .m-main { flex: 1; }
        .m-t { font-weight: 700; color: var(--text-main); font-size: 1.05rem; }
        .m-s { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        
        .past-badge {
          background-color: #f1f5f9;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
};

export default Meetings;
