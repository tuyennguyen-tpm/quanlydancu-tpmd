import { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import type { WardDocument } from '../types';
import { X, Plus, Upload } from 'lucide-react';

const WardDocuments = () => {
  const [documents, setDocuments] = useState<WardDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'party' | 'leader' | 'front'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<WardDocument>>({ category: 'party', target_scope: 'all' });
  const [isPhuongMode, setIsPhuongMode] = useState(localStorage.getItem('is_phuong_mode') === 'true'); // Simulate Phường mode
  const [uploadingFile, setUploadingFile] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<WardDocument | null>(null);

  const getWardAdminUid = async (wardId: string): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'ward_admin')
        .eq('ward_id', wardId)
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0].id;
      }
    } catch (e) {
      console.error('Lỗi khi lấy ID admin Phường:', e);
    }
    return null;
  };

  const loadDocs = async () => {
    // 1. Tải từ local storage trước làm phương án dự phòng
    const stored = localStorage.getItem('ward_documents');
    let loaded: WardDocument[] = stored ? JSON.parse(stored) : [];

    if (supabase) {
      try {
        const myWardId = localStorage.getItem('user_ward_id') || localStorage.getItem('guest_ward_id');
        if (myWardId) {
          // Tìm ID của admin Phường
          const wardAdminUid = await getWardAdminUid(myWardId);
          if (wardAdminUid) {
            // Tải danh sách công văn từ app_config của admin Phường
            const { data: wardConfig, error: configError } = await supabase
              .from('app_config')
              .select('value')
              .eq('user_id', wardAdminUid)
              .eq('key', 'ward_documents')
              .maybeSingle();

            if (!configError && wardConfig && wardConfig.value) {
              try {
                loaded = JSON.parse(wardConfig.value);
              } catch (e) {
                console.error('Lỗi parse ward_documents:', e);
              }
            }

            // Đồng bộ trạng thái đã xem (is_read) & nhật ký đã xem (read_by_tdps)
            const currentUserId = localStorage.getItem('supabase_user_id');
            const currentUserRole = localStorage.getItem('user_role');

            if (currentUserRole === 'ward_admin' || currentUserRole === 'super_admin' || isPhuongMode) {
              // Đối với Phường: quét qua app_config của các TDP để lấy danh sách đã xem
              const tdpProfiles = await db.getTDPList(myWardId);
              const tdpUserIds = tdpProfiles.map(t => t.id);

              if (tdpUserIds.length > 0) {
                const { data: allTdpReads } = await supabase
                  .from('app_config')
                  .select('user_id, value')
                  .in('user_id', tdpUserIds)
                  .eq('key', 'read_doc_ids');

                if (allTdpReads) {
                  // Ánh xạ lại read_by_tdps cho từng công văn
                  loaded = loaded.map(doc => {
                    const readBy: { tdp_name: string; read_at: string }[] = [];
                    
                    allTdpReads.forEach(row => {
                      const tdp = tdpProfiles.find(t => t.id === row.user_id);
                      if (tdp && row.value) {
                        try {
                          const reads: { doc_id: string; read_at: string }[] = JSON.parse(row.value);
                          const matchedRead = reads.find(r => r.doc_id === doc.id);
                          if (matchedRead) {
                            readBy.push({
                              tdp_name: tdp.tdp_name,
                              read_at: matchedRead.read_at
                            });
                          }
                        } catch (e) {
                          console.error('Lỗi parse read_doc_ids:', e);
                        }
                      }
                    });

                    return { ...doc, read_by_tdps: readBy };
                  });
                }
              }
            } else if (currentUserId) {
              // Đối với TDP: tải danh sách đã xem của chính mình
              const { data: myReadsConfig } = await supabase
                .from('app_config')
                .select('value')
                .eq('user_id', currentUserId)
                .eq('key', 'read_doc_ids')
                .maybeSingle();

              if (myReadsConfig && myReadsConfig.value) {
                try {
                  const myReads: { doc_id: string; read_at: string }[] = JSON.parse(myReadsConfig.value);
                  loaded = loaded.map(doc => ({
                    ...doc,
                    is_read: myReads.some(r => r.doc_id === doc.id)
                  }));
                } catch (e) {
                  console.error('Lỗi parse my reads:', e);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Lỗi Supabase loadDocs, dùng dữ liệu local', err);
      }
    }

    // Khởi tạo data mẫu nếu trống
    if (loaded.length === 0) {
      loaded = [
        { id: 'wd-1', title: 'Nghị quyết tháng 7 về vệ sinh môi trường', category: 'party', target_scope: 'all', is_read: false, created_at: new Date(Date.now() - 3600000 * 2).toISOString(), sender_name: 'Chi bộ Phường', read_by_tdps: [] },
        { id: 'wd-2', title: 'Công điện khẩn phòng chống bão', category: 'leader', target_scope: 'all', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString(), sender_name: 'UBND Phường', read_by_tdps: [] },
        { id: 'wd-3', title: 'Kế hoạch tổ chức tết Trung thu', category: 'front', target_scope: 'all', is_read: false, created_at: new Date().toISOString(), sender_name: 'Mặt trận Tổ quốc Phường', read_by_tdps: [] }
      ];
      localStorage.setItem('ward_documents', JSON.stringify(loaded));
    }
    
    // Sắp xếp văn bản mới nhất lên đầu (giảm dần theo thời gian)
    loaded.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
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
      const viVoices = voices.filter(v => {
        const l = v.lang.toLowerCase().replace('_', '-');
        return l.includes('vi') || l.includes('vnm');
      });
      
      // Lọc tìm giọng nữ Việt Nam (Google, An, HoaiMy, Nữ) và loại trừ giọng Nam (male)
      const femaleViVoice = viVoices.find(v => {
        const name = v.name.toLowerCase();
        return (
          (name.includes('google') || name.includes('an') || name.includes('hoaimy') || name.includes('female') || name.includes('nữ')) &&
          !name.includes('nam') && 
          !name.includes('male')
        );
      }) || viVoices.find(v => !v.name.toLowerCase().includes('nam')) || viVoices[0];

      if (femaleViVoice) {
        msg.voice = femaleViVoice;
      }

      window.speechSynthesis.speak(msg);
    }
  };

  // Đồng bộ lại tài liệu khi chuyển chế độ hoặc tự động quét mỗi 3 giây
  useEffect(() => {
    loadDocs();
  }, [isPhuongMode]);

  useEffect(() => {
    // Nghe sự kiện đồng bộ từ service chạy ngầm ở App.tsx
    const handleSyncEvent = () => {
      loadDocs();
    };
    window.addEventListener('ward-docs-synced', handleSyncEvent);

    // Tự động tải lại tài liệu mỗi 3 giây để đồng bộ tức thời giữa các tab / chế độ
    const syncInterval = setInterval(() => {
      loadDocs();
    }, 3000);

    // Phát thông báo bằng tiếng nói ngay lập tức sau 3 giây
    const tId = setTimeout(() => {
      checkUnreadAndSpeak();
    }, 3000);

    // Lặp lại phát thông báo giọng nói cứ mỗi 1 phút (60000ms)
    const voiceIntervalId = setInterval(() => {
      checkUnreadAndSpeak();
    }, 60000);

    return () => {
      window.removeEventListener('ward-docs-synced', handleSyncEvent);
      clearInterval(syncInterval);
      clearTimeout(tId);
      clearInterval(voiceIntervalId);
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    const rawTdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    
    // Cập nhật state trực tiếp cục bộ trước
    setDocuments(prevDocs => {
      const updated = prevDocs.map(d => {
        if (d.id === id) {
          const currentReads = d.read_by_tdps || [];
          const alreadyRead = currentReads.some(r => r.tdp_name === rawTdpName);
          const newReads = alreadyRead 
            ? currentReads 
            : [...currentReads, { tdp_name: rawTdpName, read_at: new Date().toISOString() }];
          
          return { ...d, is_read: true, read_by_tdps: newReads };
        }
        return d;
      });
      localStorage.setItem('ward_documents', JSON.stringify(updated));
      return updated;
    });

    // Đồng bộ trạng thái đã xem lên Supabase
    if (supabase) {
      try {
        const currentUserId = localStorage.getItem('supabase_user_id');
        if (currentUserId) {
          const { data: myReadsConfig } = await supabase
            .from('app_config')
            .select('value')
            .eq('user_id', currentUserId)
            .eq('key', 'read_doc_ids')
            .maybeSingle();

          let myReads: { doc_id: string; read_at: string }[] = [];
          if (myReadsConfig && myReadsConfig.value) {
            try {
              myReads = JSON.parse(myReadsConfig.value);
            } catch (e) {
              console.error(e);
            }
          }

          if (!myReads.some(r => r.doc_id === id)) {
            myReads.push({ doc_id: id, read_at: new Date().toISOString() });
            await supabase
              .from('app_config')
              .upsert({
                user_id: currentUserId,
                key: 'read_doc_ids',
                value: JSON.stringify(myReads),
                updated_at: new Date().toISOString()
              });
          }
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ đã xem lên Supabase:', err);
      }
    }

    // Dừng âm thanh nếu đang đọc
    window.speechSynthesis.cancel();
  };

  const handleViewDoc = (d: WardDocument) => {
    setViewingDoc(d);
    if (!d.is_read && !isPhuongMode) {
      handleMarkRead(d.id);
    }
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

  const handleAdd = async () => {
    const doc: WardDocument = {
      id: `wd-${Date.now()}`,
      title: newDoc.title || 'Văn bản không tên',
      category: newDoc.category as any,
      target_scope: newDoc.target_scope as any,
      sender_name: 'Cán bộ Phường',
      is_read: false,
      created_at: new Date().toISOString(),
      file_url: newDoc.file_url,
      file_name: newDoc.file_name,
      read_by_tdps: []
    };
    const updated = [doc, ...documents];
    updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setDocuments(updated);
    localStorage.setItem('ward_documents', JSON.stringify(updated));

    // Đồng bộ lên Supabase
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uId = session?.user?.id;
        if (uId) {
          const docsToSave = updated.map(({ read_by_tdps, ...rest }) => rest);
          await supabase
            .from('app_config')
            .upsert({
              user_id: uId,
              key: 'ward_documents',
              value: JSON.stringify(docsToSave),
              updated_at: new Date().toISOString()
            });
        }
      } catch (err) {
        console.error('Lỗi khi lưu công văn lên Supabase:', err);
      }
    }

    setShowAddModal(false);
    setNewDoc({ category: 'party', target_scope: 'all' });
    
    setTimeout(() => { checkUnreadAndSpeak(); }, 1500);
  };


  return (
    <div className="content" style={{ padding: '20px' }}>
      <style>{`
        .btn-3d-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 0 #1e3a8a, 0 6px 10px rgba(37, 99, 235, 0.25);
          transition: all 0.1s ease;
          position: relative;
          top: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          outline: none;
        }
        .btn-3d-primary:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 4px 0 #1e3a8a, 0 8px 12px rgba(37, 99, 235, 0.35);
        }
        .btn-3d-primary:active {
          top: 3px;
          box-shadow: 0 1px 0 #1e3a8a, 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .btn-3d-tab-active {
          background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 750;
          font-size: 12.5px;
          cursor: pointer;
          box-shadow: 0 3px 0 #172554, 0 4px 6px rgba(0, 0, 0, 0.15);
          position: relative;
          top: 0;
          transition: all 0.1s ease;
          outline: none;
        }
        .btn-3d-tab-active:active {
          top: 2px;
          box-shadow: 0 1px 0 #172554, 0 2px 3px rgba(0, 0, 0, 0.1);
        }

        .btn-3d-tab-inactive {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          color: #475569;
          border: 1.5px solid #cbd5e1;
          padding: 7px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12.5px;
          cursor: pointer;
          box-shadow: 0 3px 0 #cbd5e1, 0 4px 6px rgba(0, 0, 0, 0.06);
          position: relative;
          top: 0;
          transition: all 0.1s ease;
          outline: none;
        }
        .btn-3d-tab-inactive:hover {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          color: #1e293b;
        }
        .btn-3d-tab-inactive:active {
          top: 2px;
          box-shadow: 0 1px 0 #cbd5e1, 0 2px 3px rgba(0, 0, 0, 0.05);
        }
      `}</style>

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
            <button className="btn-3d-primary" onClick={() => setShowAddModal(true)}>+ Gửi công văn mới</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '22px', paddingTop: '4px' }}>
        <button className={activeTab === 'all' ? 'btn-3d-tab-active' : 'btn-3d-tab-inactive'} onClick={() => setActiveTab('all')}>Tất cả</button>
        <button className={activeTab === 'party' ? 'btn-3d-tab-active' : 'btn-3d-tab-inactive'} onClick={() => setActiveTab('party')}>Đảng - Chi bộ</button>
        <button className={activeTab === 'leader' ? 'btn-3d-tab-active' : 'btn-3d-tab-inactive'} onClick={() => setActiveTab('leader')}>Chính quyền - Tổ trưởng</button>
        <button className={activeTab === 'front' ? 'btn-3d-tab-active' : 'btn-3d-tab-inactive'} onClick={() => setActiveTab('front')}>Mặt trận Tổ quốc</button>
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
                    {isPhuongMode ? (
                      d.read_by_tdps && d.read_by_tdps.length > 0 ? (
                        <div style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
                          🟢 {d.read_by_tdps.length} TDP đã xem
                        </div>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>🔴 Chưa TDP nào xem</span>
                      )
                    ) : (
                      d.is_read ? <span style={{ color: '#10b981', fontSize: '12px' }}>Đã xem</span> : <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>Chưa xem</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} 
                        onClick={() => handleViewDoc(d)}
                      >
                        👁️ Xem chi tiết
                      </button>
                      {!d.is_read && !isPhuongMode && (
                        <button 
                          className="btn-primary" 
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} 
                          onClick={() => handleMarkRead(d.id)}
                        >
                          Đánh dấu đã xem
                        </button>
                      )}
                    </div>
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

      {viewingDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#1e3a8a' }}>📋 Chi tiết công văn Phường</h3>
              <button onClick={() => setViewingDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#475569' }}>Trích yếu / Nội dung:</strong>
                <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b', lineHeight: '1.4' }}>{viewingDoc.title}</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Khối nhận:</strong>
                  <div style={{ marginTop: '4px', fontSize: '13.5px', fontWeight: '600' }}>
                    {viewingDoc.category === 'party' ? '🔴 Đảng - Chi bộ' : viewingDoc.category === 'front' ? '🟡 Mặt trận Tổ quốc' : '🔵 Chính quyền - Tổ trưởng'}
                  </div>
                </div>
                <div>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Ngày nhận:</strong>
                  <div style={{ marginTop: '4px', fontSize: '13.5px' }}>
                    {new Date(viewingDoc.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
              
              <div>
                <strong style={{ fontSize: '13px', color: '#475569' }}>Người gửi:</strong>
                <div style={{ marginTop: '4px', fontSize: '13.5px' }}>{viewingDoc.sender_name || 'Cán bộ Phường'}</div>
              </div>

              {viewingDoc.file_url && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Tệp đính kèm:</strong>
                  <div style={{ marginTop: '8px' }}>
                    {viewingDoc.file_name && (viewingDoc.file_name.toLowerCase().endsWith('.png') || viewingDoc.file_name.toLowerCase().endsWith('.jpg') || viewingDoc.file_name.toLowerCase().endsWith('.jpeg') || viewingDoc.file_name.toLowerCase().endsWith('.gif') || viewingDoc.file_name.toLowerCase().endsWith('.webp')) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <img 
                          src={viewingDoc.file_url} 
                          alt={viewingDoc.file_name} 
                          style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', background: '#f8fafc' }} 
                        />
                        <a 
                          href={viewingDoc.file_url} 
                          download={viewingDoc.file_name}
                          className="btn-3d-primary"
                          style={{ textDecoration: 'none', justifyContent: 'center' }}
                        >
                          📎 Tải ảnh xuống ({viewingDoc.file_name})
                        </a>
                      </div>
                    ) : (
                      <a 
                        href={viewingDoc.file_url} 
                        download={viewingDoc.file_name}
                        className="btn-3d-primary"
                        style={{ textDecoration: 'none', display: 'inline-flex', width: '100%', justifyContent: 'center' }}
                      >
                        📎 Tải tệp xuống ({viewingDoc.file_name})
                      </a>
                    )}
                  </div>
                </div>
              )}

              {isPhuongMode && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Nhật ký các TDP đã xem:</strong>
                  <div style={{ marginTop: '8px', maxHeight: '120px', overflowY: 'auto', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {viewingDoc.read_by_tdps && viewingDoc.read_by_tdps.length > 0 ? (
                      viewingDoc.read_by_tdps.map((r, i) => (
                        <div key={i} style={{ padding: '6px 0', borderBottom: i < (viewingDoc.read_by_tdps?.length || 0) - 1 ? '1px solid #e2e8f0' : 'none', fontSize: '11.5px', color: '#334155' }}>
                          🟢 <strong>TDP {r.tdp_name}</strong> - đã xem lúc {new Date(r.read_at).toLocaleTimeString('vi-VN')} ngày {new Date(r.read_at).toLocaleDateString('vi-VN')}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '11.5px', color: '#ef4444', fontStyle: 'italic' }}>Chưa có tổ dân phố nào xem.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setViewingDoc(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardDocuments;


