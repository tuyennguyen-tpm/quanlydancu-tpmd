import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  Search, 
  Filter, 
  Plus, 
  X,
  FileCheck,
  Send,
  Trash2
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Complaint } from '../types';

const Complaints = () => {
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
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'resolved'>('all');

  // Debounce searchInput -> searchTerm
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Modals state
  const [isNewComplaintOpen, setIsNewComplaintOpen] = useState(false);
  const [replyingComplaint, setReplyingComplaint] = useState<Complaint | null>(null);

  // Form states
  const [residentName, setResidentName] = useState('');
  const [content, setContent] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<Complaint['status']>('resolved');

  const loadData = async () => {
    try {
      const list = await db.getComplaints();
      setComplaints(list);
    } catch (e) {
      showToast('Lỗi tải phản ánh kiến nghị!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentName.trim() || !content.trim()) {
      showToast('Vui lòng nhập đầy đủ họ tên và nội dung phản ánh!', 'warning');
      return;
    }

    const payload: Complaint = {
      id: generateUUID(),
      resident_id: `R-GUEST`,
      resident_name: residentName,
      content,
      status: 'pending',
      response: '',
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };

    try {
      await db.saveComplaint(payload);
      showToast('Gửi phản ánh kiến nghị thành công!', 'success');
      setIsNewComplaintOpen(false);
      setResidentName('');
      setContent('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi gửi phản ánh!', 'danger');
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingComplaint) return;
    if (!replyText.trim()) {
      showToast('Vui lòng nhập nội dung trả lời!', 'warning');
      return;
    }

    const payload: Complaint = {
      ...replyingComplaint,
      status: replyStatus,
      response: replyText,
    };

    try {
      await db.saveComplaint(payload);
      showToast('Gửi phản hồi thành công!', 'success');
      setReplyingComplaint(null);
      setReplyText('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi gửi phản hồi!', 'danger');
    }
  };

  const handleOpenReply = (c: Complaint) => {
    setReplyingComplaint(c);
    setReplyText(c.response || '');
    setReplyStatus(c.status === 'pending' ? 'resolved' : c.status);
  };

  const handleDeleteComplaint = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phản ánh kiến nghị này khỏi hệ thống?')) {
      try {
        await db.deleteComplaint(id);
        showToast('Xóa kiến nghị thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa kiến nghị!', 'danger');
      }
    }
  };

  // Filter and Search
  const filteredComplaints = complaints.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch = c.resident_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    const dateA = new Date(a.created_at || a.date).getTime();
    const dateB = new Date(b.created_at || b.date).getTime();
    return dateB - dateA;
  });

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'pending': return 'Đang chờ';
      case 'processing': return 'Đang xử lý';
      case 'resolved': return 'Đã xong';
      default: return 'Từ chối';
    }
  };

  return (
    <div className="complaints-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Phản ánh kiến nghị của bà con</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Kênh tiếp nhận ý kiến phản ánh, đóng góp xây dựng và khiếu nại của nhân dân.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsNewComplaintOpen(true)}
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
            <Plus size={16} /> Gửi ý kiến mới
          </button>
        </div>
      </div>

      <div className="complaints-filters">
         <div className="search-mini">
           <Search size={18} /> 
           <input 
             type="text" 
             placeholder="Tìm theo tên người gửi, nội dung..." 
             value={searchInput}
             onChange={(e) => setSearchInput(e.target.value)}
           />
         </div>
         <div className="filter-group">
            <button className={`f-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>Tất cả</button>
            <button className={`f-btn ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Chưa xử lý</button>
            <button className={`f-btn ${statusFilter === 'processing' ? 'active' : ''}`} onClick={() => setStatusFilter('processing')}>Đang xử lý</button>
            <button className={`f-btn ${statusFilter === 'resolved' ? 'active' : ''}`} onClick={() => setStatusFilter('resolved')}>Đã xong</button>
         </div>
      </div>

      <div className="complaints-list">
         {sortedComplaints.map(c => (
            <div key={c.id} className="complaint-card">
               <div className="c-left">
                  <div className="c-user">{c.resident_name.charAt(0)}</div>
               </div>
               <div className="c-main">
                  <div className="c-header">
                     <span className="c-name">{c.resident_name}</span>
                     <span className="c-date">{new Date(c.created_at || c.date).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <p className="c-content">{c.content}</p>
                  
                  {c.response && (
                    <div className="c-reply-box">
                      <div className="reply-header">
                        <strong>Ban cán sự TDP phản hồi:</strong>
                      </div>
                      <p className="reply-text">{c.response}</p>
                    </div>
                  )}

                  <div className="c-footer">
                     <span className={`c-status ${c.status}`}>
                        {c.status === 'pending' ? <Clock size={14} /> : c.status === 'resolved' ? <CheckCircle size={14} /> : <FileCheck size={14} />}
                        {getStatusLabel(c.status)}
                     </span>
                       {!isGuest && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button className="btn-reply" onClick={() => handleOpenReply(c)}>
                            {c.response ? 'Sửa phản hồi' : 'Phản hồi / Xử lý'}
                          </button>
                          <button 
                            onClick={() => handleDeleteComplaint(c.id)}
                            style={{ border: 'none', background: 'none', color: 'var(--danger)', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      )}
                  </div>
               </div>
            </div>
         ))}
         {filteredComplaints.length === 0 && (
           <div className="empty-complaints-placeholder">
              <MessageSquare size={40} style={{color: 'var(--border)', marginBottom: '12px'}} />
              <p>Chưa có phản ánh kiến nghị nào được gửi.</p>
           </div>
         )}
      </div>

      {/* New Complaint Modal */}
      {isNewComplaintOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Gửi phản ánh kiến nghị mới</h2>
              <button className="close-btn" onClick={() => setIsNewComplaintOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateComplaint} className="modal-form">
              <div className="form-group">
                <label>Họ và tên người kiến nghị *</label>
                <input 
                  type="text" 
                  value={residentName}
                  onChange={(e) => setResidentName(e.target.value)}
                  placeholder="Nhập tên của bạn hoặc hộ dân đại diện"
                  required
                />
              </div>

              <div className="form-group">
                <label>Nội dung phản ánh, kiến nghị *</label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ghi rõ thông tin sự việc, vị trí ngõ xóm và nội dung kiến nghị cụ thể..."
                  style={{height: '120px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'}}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewComplaintOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Gửi đi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyingComplaint && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Giải quyết phản ánh kiến nghị</h2>
              <button className="close-btn" onClick={() => setReplyingComplaint(null)}><X size={24} /></button>
            </div>
            <div style={{marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)'}}>
              <strong style={{fontSize: '0.85rem'}}>Nội dung người dân gửi:</strong>
              <p style={{fontSize: '0.9rem', color: '#475569', marginTop: '6px'}}>{replyingComplaint.content}</p>
            </div>
            <form onSubmit={handleReplySubmit} className="modal-form">
              <div className="form-group">
                <label>Cập nhật trạng thái giải quyết</label>
                <select value={replyStatus} onChange={(e: any) => setReplyStatus(e.target.value)}>
                  <option value="resolved">Đã giải quyết xong (Hoàn thành)</option>
                  <option value="processing">Đang tiến hành xử lý</option>
                  <option value="rejected">Từ chối giải quyết (Không hợp lệ)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Nội dung phản hồi chính thức *</label>
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Nhập thông tin phản hồi của Tổ trưởng/Ban cán sự..."
                  style={{height: '120px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'}}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setReplyingComplaint(null)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary"><Send size={16} /> Gửi phản hồi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .complaints-page { animation: fadeIn 0.4s ease-out; }
        .complaints-filters { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px; }
        .search-mini { flex: 1; background: white; border: 1px solid var(--border); padding: 10px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px; max-width: 400px; }
        .search-mini input { border: none; outline: none; width: 100%; }
        
        .filter-group { display: flex; gap: 8px; }
        .f-btn { padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; background: white; border: 1px solid var(--border); color: var(--text-muted); }
        .f-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

        .complaints-list { display: flex; flex-direction: column; gap: 16px; }
        .complaint-card { background: white; padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); display: flex; gap: 20px; }
        .c-user { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; color: var(--primary); font-weight: 800; display: flex; align-items: center; justify-content: center; }
        .c-main { flex: 1; }
        .c-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .c-name { font-weight: 700; color: var(--text-main); }
        .c-date { font-size: 0.8rem; color: var(--text-muted); }
        .c-content { font-size: 0.95rem; color: #475569; line-height: 1.5; margin-bottom: 16px; }
        
        .c-reply-box {
          background-color: #f8fafc;
          border-left: 4px solid var(--primary);
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 16px;
        }
        .reply-header { font-size: 0.85rem; color: var(--text-main); margin-bottom: 4px; }
        .reply-text { font-size: 0.9rem; color: #475569; }

        .c-footer { display: flex; justify-content: space-between; align-items: center; }
        .c-status { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; padding: 4px 12px; border-radius: 20px; }
        .c-status.pending { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .c-status.resolved { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .c-status.processing { background: rgba(59, 130, 246, 0.1); color: var(--info); }
        
        .btn-reply { color: var(--primary); font-weight: 700; font-size: 0.9rem; border: none; background: none; }
        .btn-reply:hover { text-decoration: underline; }

        .empty-complaints-placeholder {
          background: white;
          border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .complaints-filters { flex-direction: column; align-items: stretch; gap: 16px; }
        }
      `}</style>
    </div>
  );
};

export default Complaints;
