import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { WardDocument } from '../types';
import { X, Plus, Upload } from 'lucide-react';

const WardDocuments = () => {
  const [documents, setDocuments] = useState<WardDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'party' | 'leader' | 'front'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<WardDocument>>({ category: 'party', target_scope: 'all' });
  const [isPhuongMode, setIsPhuongMode] = useState(localStorage.getItem('is_phuong_mode') === 'true'); // Simulate Phường mode
  const [uploadingFile, setUploadingFile] = useState(false);

  const loadDocs = async () => {
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

  const checkUnreadAndSpeak = () => {
    // Chỉ đọc nếu không phải màn hình của phường
    if (localStorage.getItem('is_phuong_mode') === 'true') return;
    if (window.speechSynthesis.speaking) return;

    const stored = localStorage.getItem('ward_documents');
    if (!stored) return;
    const docs: WardDocument[] = JSON.parse(stored);
    
    const currentRole = localStorage.getItem('current_role') || '';
    
    // Tìm một văn bản chưa đọc thuộc quyền trách nhiệm của vai trò hiện tại
    const unread = docs.find(d => {
      if (d.is_read) return false;
      if (currentRole === 'bi_thu') return d.category === 'party';
      if (currentRole === 'to_truong' || currentRole === 'admin') return d.category === 'leader';
      if (currentRole === 'mat_tran') return d.category === 'front';
      return true; // Vai trò khác được thông báo tất cả
    });

    if (unread) {
      let prefix = '';
      if (unread.category === 'party') prefix = 'Thông báo. Khối Đảng Chi bộ có công văn nghị quyết mới.';
      else if (unread.category === 'front') prefix = 'Thông báo. Khối Mặt trận Tổ quốc có công văn mới.';
      else prefix = 'Thông báo. Khối Chính quyền có công văn mới.';

      const msg = new SpeechSynthesisUtterance(`${prefix} Trích yếu: ${unread.title}. Vui lòng mở phần mềm để xem chi tiết.`);
      msg.lang = 'vi-VN';
      
      const voices = window.speechSynthesis.getVoices();
      const viVoices = voices.filter(v => v.lang.includes('vi'));
      const googleVoice = viVoices.find(v => v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('online'));
      if (googleVoice) {
        msg.voice = googleVoice;
      } else if (viVoices.length > 0) {
        msg.voice = viVoices[0];
      }

      window.speechSynthesis.speak(msg);
    }
  };

  useEffect(() => {
    loadDocs();

    // Phát thông báo ngay lập tức sau 3 giây
    const tId = setTimeout(() => {
      checkUnreadAndSpeak();
    }, 3000);

    // Lặp lại cứ mỗi 1 phút (60000ms)
    const intervalId = setInterval(() => {
      checkUnreadAndSpeak();
    }, 60000);

    return () => {
      clearTimeout(tId);
      clearInterval(intervalId);
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleMarkRead = (id: string) => {
    // Cập nhật state trực tiếp
    setDocuments(prevDocs => {
      const updated = prevDocs.map(d => d.id === id ? { ...d, is_read: true } : d);
      localStorage.setItem('ward_documents', JSON.stringify(updated));
      return updated;
    });
    // Dừng âm thanh nếu đang đọc
    window.speechSynthesis.cancel();
  };

  const filteredDocs = documents.filter(d => {
    if (activeTab === 'all') return true;
    return d.category === activeTab;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Kích thước tệp quá lớn! Vui lòng chọn tệp dưới 5MB.");
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewDoc(prev => ({
        ...prev,
        file_url: event.target?.result as string,
        file_name: file.name
      }));
      setUploadingFile(false);
    };
    reader.onerror = () => {
      alert("Lỗi khi đọc tệp.");
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    const doc: WardDocument = {
      id: `wd-${Date.now()}`,
      title: newDoc.title || 'Văn bản không tên',
      category: newDoc.category as any,
      target_scope: newDoc.target_scope as any,
      sender_name: 'Cán bộ Phường',
      is_read: false,
      created_at: new Date().toISOString(),
      file_url: newDoc.file_url,
      file_name: newDoc.file_name
    };
    const updated = [doc, ...documents];
    setDocuments(updated);
    localStorage.setItem('ward_documents', JSON.stringify(updated));
    setShowAddModal(false);
    setNewDoc({ category: 'party', target_scope: 'all' });
    
    // Phát âm thanh ngay lập tức cho tổ dân phố (nếu đang ở máy giả lập của tổ)
    setTimeout(() => { checkUnreadAndSpeak(); }, 1500);
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
              <th style={{ padding: '12px 15px', fontWeight: '600' }}>Khối nhận</th>
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
                  <td style={{ padding: '12px 15px', fontWeight: d.is_read ? '400' : '600' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span>{d.title}</span>
                      {d.file_url && (
                        <div style={{ marginTop: '4px' }}>
                          <a 
                            href={d.file_url} 
                            download={d.file_name} 
                            onClick={() => handleMarkRead(d.id)}
                            style={{ 
                              textDecoration: 'none', 
                              color: '#2563eb', 
                              fontWeight: 700, 
                              fontSize: '12px',
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              padding: '4px 10px',
                              background: '#eff6ff',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              width: 'fit-content'
                            }}
                          >
                            📎 Tải về tệp: {d.file_name}
                          </a>
                        </div>
                      )}
                    </div>
                  </td>
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Trích yếu / Nội dung</label>
              <input type="text" className="input-field" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} 
                value={newDoc.title || ''} onChange={e => setNewDoc({...newDoc, title: e.target.value})} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Thuộc khối nhận</label>
              <select className="input-field" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}>
                <option value="party">Đảng - Chi bộ</option>
                <option value="leader">Chính quyền - Tổ trưởng</option>
                <option value="front">Mặt trận Tổ quốc</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Đính kèm tệp (Word, Excel, PDF, Ảnh...)</label>
              <input 
                type="file" 
                accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif"
                onChange={handleFileChange}
                style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
              />
              {uploadingFile && <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>Đang nạp tệp...</div>}
              {newDoc.file_name && <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '4px', fontWeight: '600' }}>✅ Đã nạp: {newDoc.file_name}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleAdd} disabled={uploadingFile}>Gửi công văn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardDocuments;

