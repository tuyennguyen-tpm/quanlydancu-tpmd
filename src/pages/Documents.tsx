import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { FileText, Download, Eye, Search, FileDown, X, Plus } from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Document } from '../types';

const Documents = () => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  const [docs, setDocs] = useState<Document[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'directive' | 'plan' | 'report' | 'other'>('directive');

  const loadData = async () => {
    try {
      const list = await db.getDocuments();
      setDocs(list);
    } catch (e) {
      showToast('Lỗi tải danh mục tài liệu!', 'danger');
    }
  };

  const [tdpName, setTdpName] = useState(
    localStorage.getItem('tdp_name') || 'Nam Sầm Sơn'
  );
  const [wardName, setWardName] = useState(
    localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn'
  );

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
      setWardName(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    window.addEventListener('ward-name-changed', handleStorageChange);
    window.addEventListener('db-changed', loadData);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
      window.removeEventListener('ward-name-changed', handleStorageChange);
      window.removeEventListener('db-changed', loadData);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Khách không có quyền tải văn bản lên!', 'warning');
      return;
    }
    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề văn bản!', 'warning');
      return;
    }

    const payload: Document = {
      id: generateUUID(),
      group_id: db.getGroupId(),
      title,
      type,
      file_url: '#',
      uploaded_at: new Date().toISOString()
    };

    try {
      await db.saveDocument(payload);
      showToast('Tải văn bản lên hệ thống thành công!', 'success');
      setIsFormOpen(false);
      setTitle('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi tải tài liệu lên!', 'danger');
    }
  };

  const filteredDocs = useMemo(() => docs.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase())
  ), [docs, searchTerm]);

  const getDocTypeLabel = (t: string) => {
    switch (t) {
      case 'directive': return 'Chỉ thị / Nghị quyết';
      case 'plan': return 'Kế hoạch công tác';
      case 'report': return 'Báo cáo / Công văn';
      default: return 'Khác';
    }
  };

  const getSimulatedDocContent = (d: Document) => {
    return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
UBND ${wardName.toUpperCase()}
Ban cán sự Tổ dân phố ${tdpName}

Hồ sơ văn bản lưu trữ số: ${d.id}
Ngày ghi nhận: ${new Date(d.uploaded_at).toLocaleDateString('vi-VN')}

Tên tài liệu:
${d.title.toUpperCase()}

PHẦN NỘI DUNG TÀI LIỆU (MÔ PHỎNG):
1. Căn cứ theo quyết định chỉ đạo của UBND ${wardName} và Đảng ủy tổ dân phố.
2. Ban cán sự Tổ dân phố đã tiến hành phổ biến, lập biên bản và biểu quyết thống nhất thông qua nội dung kế hoạch hành động.
3. Kế hoạch này được niêm yết công khai tại Nhà văn hóa Tổ dân phố ${tdpName} và gửi bản mềm điện tử đến đại diện các hộ gia đình.

Ban hành bởi:
Ban điều hành Tổ dân phố ${tdpName}.
(Hệ thống lưu trữ tự động văn bản số)
    `;
  };

  const handleDownloadTextFile = (d: Document) => {
    const textContent = getSimulatedDocContent(d);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${d.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tải file tài liệu (.txt) thành công!', 'success');
  };

  return (
    <div className="docs-page">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Văn bản - Nghị quyết</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Kho lưu trữ trực tuyến các văn bản chỉ đạo, nghị quyết, báo cáo của Tổ dân phố {tdpName}.
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
              <FileDown size={16} /> Tải văn bản lên
            </button>
          )}
        </div>
      </div>

      <div className="doc-search-bar">
         <Search size={20} />
         <input 
           type="text" 
           placeholder="Tìm kiếm theo tiêu đề văn bản..." 
           value={searchInput}
           onChange={(e) => setSearchInput(e.target.value)}
         />
      </div>

      <div className="docs-list">
         {filteredDocs.map(doc => (
            <div key={doc.id} className="doc-item">
               <div className="doc-icon"><FileText size={24} /></div>
               <div className="doc-main">
                  <h4>{doc.title}</h4>
                  <div className="doc-meta">
                     <span>{getDocTypeLabel(doc.type)}</span>
                     <span className="dot">•</span>
                     <span>Ngày tải lên: {new Date(doc.uploaded_at).toLocaleDateString('vi-VN')}</span>
                  </div>
               </div>
               <div className="doc-btns">
                  <button className="icon-btn-sm" onClick={() => setViewingDoc(doc)} title="Xem chi tiết"><Eye size={18} /></button>
                  <button className="icon-btn-sm" onClick={() => handleDownloadTextFile(doc)} title="Tải về máy (.txt)"><Download size={18} /></button>
               </div>
            </div>
         ))}
         {filteredDocs.length === 0 && (
           <div style={{textAlign: 'center', padding: '32px', color: 'var(--text-muted)', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)'}}>
             Không tìm thấy tài liệu nào.
           </div>
         )}
      </div>

      {/* New Document Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Tải văn bản lên hệ thống</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Tiêu đề văn bản/tài liệu *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch tổng vệ sinh chào mừng ngày lễ..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Loại văn bản *</label>
                <select value={type} onChange={(e: any) => setType(e.target.value)}>
                  <option value="directive">Chỉ thị / Nghị quyết TDP</option>
                  <option value="plan">Kế hoạch công tác</option>
                  <option value="report">Công văn / Báo cáo</option>
                  <option value="other">Văn bản khác</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Xác nhận tải lên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doc Viewer Modal */}
      {viewingDoc && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>Xem văn bản số: {viewingDoc.title}</h2>
              <button className="close-btn" onClick={() => setViewingDoc(null)}><X size={24} /></button>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'Times New Roman, serif',
              fontSize: '1.05rem',
              padding: '20px',
              border: '1px solid var(--border)',
              background: '#fafafa',
              maxHeight: '400px',
              overflowY: 'auto',
              color: '#334155',
              lineHeight: '1.5'
            }}>
              {getSimulatedDocContent(viewingDoc)}
            </pre>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => handleDownloadTextFile(viewingDoc)}><Download size={16} /> Tải văn bản (.txt)</button>
              <button type="button" className="btn btn-secondary" onClick={() => setViewingDoc(null)}>Đóng lại</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .docs-page { animation: fadeIn 0.4s ease-out; }
        .doc-search-bar { background: white; padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; align-items: center; gap: 12px; margin-bottom: 24px; max-width: 500px; }
        .doc-search-bar input { border: none; outline: none; width: 100%; }
        
        .docs-list { display: flex; flex-direction: column; gap: 12px; }
        .doc-item { background: white; padding: 16px 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); display: flex; align-items: center; gap: 20px; transition: all 0.2s; }
        .doc-item:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
        .doc-icon { width: 48px; height: 48px; border-radius: 12px; background: #f8fafc; color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
        .doc-main { flex: 1; }
        .doc-main h4 { margin-bottom: 4px; color: var(--text-main); font-weight: 700; }
        .doc-meta { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; font-weight: 500; }
        .doc-meta .dot { font-size: 1.2rem; }
        .doc-btns { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
};

export default Documents;
