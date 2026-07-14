import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { WardDocument } from '../types';

const WardDocuments = () => {
  const [documents, setDocuments] = useState<WardDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'party' | 'leader' | 'front'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<WardDocument>>({ category: 'party', target_scope: 'all' });
  const [isPhuongMode, setIsPhuongMode] = useState(localStorage.getItem('is_phuong_mode') === 'true'); // Simulate Phường mode

  const loadDocs = async () => {
    // Tạm thời mock data hoặc lấy từ localStorage (db layer will handle this)
    const stored = localStorage.getItem('ward_documents');
    let loaded: WardDocument[] = stored ? JSON.parse(stored) : [];
    
    // Khởi tạo data mẫu nếu trống
    if (loaded.length === 0) {
      loaded = [
        { id: 'wd-1', title: 'Nghị quyết tháng 7 về vệ sinh môi trường', category: 'party', target_scope: 'all', is_read: false, created_at: new Date().toISOString(), sender_name: 'Chi bộ Phường' },
        { id: 'wd-2', title: 'Công điện khẩn phòng chống bão', category: 'leader', target_scope: 'all', is_read: false, created_at: new Date().toISOString(), sender_name: 'UBND Phường' },
        { id: 'wd-3', title: 'Kế hoạch tổ chức tết Trung thu', category: 'front', target_scope: 'all', is_read: false, created_at: new Date().toISOString(), sender_name: 'Mặt trận Tổ quốc Phường' }
      ];
      localStorage.setItem('ward_documents', JSON.stringify(loaded));
    }
    
    setDocuments(loaded);
  };

  useEffect(() => {
    loadDocs();
    
    // TTS Notification Logic - Kiểm tra định kỳ mỗi 3 phút (180000ms)
    // Để test nhanh, ta để 10 giây (10000ms)
    const interval = setInterval(() => {
      checkUnreadAndSpeak();
    }, 180000); 

    return () => clearInterval(interval);
  }, []);

  const checkUnreadAndSpeak = () => {
    // Chỉ đọc nếu không phải màn hình của phường
    if (localStorage.getItem('is_phuong_mode') === 'true') return;

    const stored = localStorage.getItem('ward_documents');
    if (!stored) return;
    const docs: WardDocument[] = JSON.parse(stored);
    
    // Tìm một văn bản chưa đọc
    const unread = docs.find(d => !d.is_read);
    if (unread) {
      let prefix = '';
      if (unread.category === 'party') prefix = 'Bạn có công văn, nghị quyết mới từ Chi bộ Phường.';
      else if (unread.category === 'front') prefix = 'Bạn có công văn từ Ban công tác Mặt trận Phường.';
      else prefix = 'Bạn có công văn mới từ Ủy ban nhân dân Phường.';

      const msg = new SpeechSynthesisUtterance(`${prefix} Nội dung là: ${unread.title}. Vui lòng mở phần mềm để xem chi tiết.`);
      msg.lang = 'vi-VN';
      window.speechSynthesis.speak(msg);
    }
  };

  const handleMarkRead = (id: string) => {
    const updated = documents.map(d => d.id === id ? { ...d, is_read: true } : d);
    setDocuments(updated);
    localStorage.setItem('ward_documents', JSON.stringify(updated));
    // Dừng âm thanh nếu đang đọc
    window.speechSynthesis.cancel();
  };

  const filteredDocs = documents.filter(d => {
    if (activeTab === 'all') return true;
    return d.category === activeTab;
  });

  const handleAdd = () => {
    const doc: WardDocument = {
      id: `wd-${Date.now()}`,
      title: newDoc.title || 'Văn bản không tên',
      category: newDoc.category as any,
      target_scope: newDoc.target_scope as any,
      sender_name: 'Cán bộ Phường',
      is_read: false,
      created_at: new Date().toISOString()
    };
    const updated = [doc, ...documents];
    setDocuments(updated);
    localStorage.setItem('ward_documents', JSON.stringify(updated));
    setShowAddModal(false);
    
    // Phát âm thanh ngay lập tức cho tổ dân phố (nếu mô phỏng test chung một máy)
    setTimeout(() => { checkUnreadAndSpeak(); }, 2000);
  };

  return (
    <div className="content" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Công văn của Phường</h2>
        <div>
          <label style={{ marginRight: '15px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={isPhuongMode} onChange={(e) => {
              setIsPhuongMode(e.target.checked);
              localStorage.setItem('is_phuong_mode', e.target.checked.toString());
            }} />
            Chế độ gửi (Của Phường)
          </label>
          {isPhuongMode && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Gửi công văn mới</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={activeTab === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('all')}>Tất cả</button>
        <button className={activeTab === 'party' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('party')}>Đảng - Chi bộ</button>
        <button className={activeTab === 'leader' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('leader')}>Chính quyền - Tổ trưởng</button>
        <button className={activeTab === 'front' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('front')}>Mặt trận Tổ quốc</button>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 15px', fontWeight: '600' }}>Tên công văn</th>
              <th style={{ padding: '12px 15px', fontWeight: '600' }}>Khối gửi</th>
              <th style={{ padding: '12px 15px', fontWeight: '600' }}>Ngày nhận</th>
              <th style={{ padding: '12px 15px', fontWeight: '600' }}>Trạng thái</th>
              <th style={{ padding: '12px 15px', fontWeight: '600', textAlign: 'right' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Không có công văn nào</td></tr>
            ) : (
              filteredDocs.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0', background: d.is_read ? 'transparent' : '#fef2f2' }}>
                  <td style={{ padding: '12px 15px', fontWeight: d.is_read ? '400' : '600' }}>{d.title}</td>
                  <td style={{ padding: '12px 15px' }}>
                    {d.category === 'party' ? 'Đảng' : d.category === 'front' ? 'Mặt trận' : 'Chính quyền'}
                  </td>
                  <td style={{ padding: '12px 15px', fontSize: '13px' }}>{new Date(d.created_at).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '12px 15px' }}>
                    {d.is_read ? <span style={{ color: '#10b981', fontSize: '12px' }}>Đã xem</span> : <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>Chưa xem</span>}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                    {!d.is_read && !isPhuongMode && (
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleMarkRead(d.id)}>Đánh dấu đã xem</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Gửi công văn mới</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Trích yếu / Nội dung</label>
              <input type="text" className="input-field" style={{ width: '100%', padding: '8px' }} 
                value={newDoc.title || ''} onChange={e => setNewDoc({...newDoc, title: e.target.value})} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Thuộc khối</label>
              <select className="input-field" style={{ width: '100%', padding: '8px' }}
                value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}>
                <option value="party">Đảng - Chi bộ</option>
                <option value="leader">Chính quyền - Tổ trưởng</option>
                <option value="front">Mặt trận Tổ quốc</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleAdd}>Gửi công văn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardDocuments;
