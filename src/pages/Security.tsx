import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Eye, 
  ShieldAlert, 
  X, 
  Trash2, 
  Users, 
  Plus, 
  Phone,
  Search,
  FileDown,
  Printer
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import type { SecurityLog } from '../services/db';
import type { Resident } from '../types';
import { showToast } from '../utils/toast';
import ExcelJS from 'exceljs';

const Security = () => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
                  (currentRole !== 'to_truong' && currentRole !== 'admin' && currentRole !== 'an_ninh');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [militiaMembers, setMilitiaMembers] = useState<Resident[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subTab, setSubTab] = useState<'logs' | 'militia'>('logs');
  
  // Roster states
  const [searchMilitia, setSearchMilitia] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [searchResidentQuery, setSearchResidentQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'ok' | 'alert'>('alert');

  const loadData = async () => {
    try {
      const [list, resList] = await Promise.all([
        db.getSecurityLogs(),
        db.getResidents()
      ]);
      setLogs(list);
      setResidents(resList);

      // Lọc danh sách dân quân tự vệ (có mã dqtv trong hội viên đoàn thể)
      const filteredMilitia = resList.filter(r => {
        if (r.status === 'deceased') return false;
        const membership = r.association_membership || '';
        return membership.split(',').map(s => s.trim()).filter(Boolean).includes('dqtv');
      });
      setMilitiaMembers(filteredMilitia);
    } catch (e) {
      showToast('Lỗi tải dữ liệu an ninh!', 'danger');
    }
  };

  const handleDeleteSecurityLog = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhật ký an ninh này không?')) {
      try {
        await db.deleteSecurityLog(id);
        showToast('Xóa nhật ký an ninh thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa nhật ký!', 'danger');
      }
    }
  };

  const handleAddMilitia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Tài khoản không có quyền chỉnh sửa lực lượng!', 'warning');
      return;
    }
    if (!selectedResidentId) {
      showToast('Vui lòng chọn một nhân khẩu để thêm!', 'warning');
      return;
    }

    try {
      const targetRes = residents.find(r => r.id === selectedResidentId);
      if (!targetRes) return;

      const currentAssoc = targetRes.association_membership ? targetRes.association_membership.split(',') : [];
      if (!currentAssoc.includes('dqtv')) {
        currentAssoc.push('dqtv');
      }

      const updated = {
        ...targetRes,
        association_membership: currentAssoc.join(',')
      };

      await db.saveResident(updated);
      showToast(`Đã thêm ${targetRes.full_name} vào Lực lượng Dân quân tự vệ!`, 'success');
      setSelectedResidentId('');
      setSearchResidentQuery('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (err) {
      showToast('Lỗi khi thêm đội viên!', 'danger');
    }
  };

  const handleRemoveMilitia = async (id: string, name: string) => {
    if (isGuest) {
      showToast('Tài khoản không có quyền chỉnh sửa lực lượng!', 'warning');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn đưa ${name} ra khỏi Lực lượng Dân quân tự vệ không?`)) {
      try {
        const targetRes = residents.find(r => r.id === id);
        if (!targetRes) return;

        const currentAssoc = targetRes.association_membership ? targetRes.association_membership.split(',') : [];
        const updatedAssoc = currentAssoc.filter(a => a !== 'dqtv');

        const updated = {
          ...targetRes,
          association_membership: updatedAssoc.join(',')
        };

        await db.saveResident(updated);
        showToast(`Đã đưa ${name} ra khỏi Lực lượng Dân quân tự vệ!`, 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (err) {
        showToast('Lỗi khi xóa đội viên!', 'danger');
      }
    }
  };

  // Printer function for Militia
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';

    let rowsHtml = '';
    filteredMilitiaMembers.forEach((m, idx) => {
      const dobFormatted = m.dob ? m.dob.split('-').reverse().join('/') : '—';
      const age = m.dob ? `${new Date().getFullYear() - parseInt(m.dob.substring(0, 4))}` : '—';
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #000; font-weight: bold; white-space: nowrap;">${m.full_name}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${dobFormatted}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${age}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${m.phone || ''}</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.permanent_address || ''}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>DANH SÁCH LỰC LƯỢNG DÂN QUÂN TỰ VỆ</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin-top: 20mm;
                margin-bottom: 20mm;
                margin-left: 20mm;
                margin-right: 15mm;
              }
              body { margin: 0; padding: 0; }
            }
            body { font-family: "Times New Roman", Times, serif; font-size: 12pt; padding: 20px; color: #000; }
            h2 { text-transform: uppercase; color: #000; margin-bottom: 5px; font-size: 15pt; font-weight: bold; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11pt; border: 1.5px solid #000; }
            th, td { border: 1px solid #000 !important; padding: 6px 8px; text-align: left; }
            th { font-weight: bold; text-align: center; background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <h3 style="margin: 0; text-transform: uppercase; font-size: 12pt;">UBND ${(wardName.toLowerCase().startsWith('phường') ? wardName : 'Phường ' + wardName).toUpperCase()}</h3>
              <h4 style="margin: 5px 0 0 0; text-decoration: underline; font-size: 12pt;">TỔ DÂN PHỐ ${tdpName.toUpperCase()}</h4>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-style: italic; font-size: 11pt;">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
          
          <h2 style="margin-top: 30px; text-align: center;">DANH SÁCH LỰC LƯỢNG DÂN QUÂN TỰ VỆ / TỰ QUẢN</h2>
          <p style="text-align: center; font-style: italic; margin-top: 5px; margin-bottom: 25px;">Đơn vị: Tổ dân phố ${tdpName}</p>
          
          <table>
            <thead>
              <tr>
                <th style="width: 5%">STT</th>
                <th style="width: 25%">Họ và tên</th>
                <th style="width: 15%">Ngày sinh</th>
                <th style="width: 10%">Tuổi</th>
                <th style="width: 18%">Điện thoại</th>
                <th style="width: 27%">Địa chỉ thường trú</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 12pt; page-break-inside: avoid;">
            <div style="width: 40%; text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">CHỈ HUY TRƯỞNG QUÂN SỰ</p>
              <p style="font-style: italic; color: #555;">(Ký, ghi rõ họ tên)</p>
            </div>
            <div style="width: 45%; text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">TỔ TRƯỞNG TỔ DÂN PHỐ</p>
              <p style="font-style: italic; color: #555;">(Ký, ghi rõ họ tên)</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Excel export function for Militia
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('LucLuongDanQuan');

      const headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Tuổi', 'Điện thoại', 'Địa chỉ thường trú'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' } // Blue for Security
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Segoe UI',
          size: 11
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
      });

      filteredMilitiaMembers.forEach((m, idx) => {
        const dob = m.dob ? m.dob.split('-').reverse().join('/') : '—';
        const age = m.dob ? `${new Date().getFullYear() - parseInt(m.dob.substring(0, 4))}` : '—';

        const addedRow = worksheet.addRow([
          idx + 1,
          m.full_name,
          dob,
          age,
          m.phone || '',
          m.permanent_address || ''
        ]);
        
        addedRow.height = 24;
        addedRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 ? 'center' : 'left'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });
      });

      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx === 0) {
          column.width = 6;
        } else {
          let maxLen = 0;
          column.values?.forEach(v => {
            const valStr = v ? v.toString() : '';
            if (valStr.length > maxLen) {
              maxLen = valStr.length;
            }
          });
          column.width = Math.min(Math.max(maxLen + 4, 12), 40);
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `danh_sach_dan_quan_tu_ve_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export Excel error', e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => {
      window.removeEventListener('db-changed', loadData);
    };
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

  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const filteredMilitiaMembers = militiaMembers.filter(m => {
    const q = searchMilitia.toLowerCase().trim();
    return m.full_name.toLowerCase().includes(q) || 
           (m.phone && m.phone.includes(q)) || 
           (m.permanent_address && m.permanent_address.toLowerCase().includes(q));
  });

  const nonMilitiaResidents = residents.filter(r => {
    if (r.status === 'deceased') return false;
    const membership = r.association_membership || '';
    return !membership.split(',').map(s => s.trim()).filter(Boolean).includes('dqtv');
  });

  const filteredNonMilitiaResidents = nonMilitiaResidents.filter(r => {
    const q = searchResidentQuery.toLowerCase().trim();
    if (!q) return true;
    return r.full_name.toLowerCase().includes(q) || 
           (r.phone && r.phone.includes(q)) || 
           (r.permanent_address && r.permanent_address.toLowerCase().includes(q));
  });

  return (
    <div className="security-page" style={{ padding: '20px', fontFamily: "'Inter', sans-serif" }}>
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>An ninh trật tự</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Giám sát tình hình trật tự trị an, quản lý lực lượng tự quản và lưu vết nhật ký tuần tra bảo vệ khu dân cư.
          </p>
          {subTab === 'logs' && !isGuest && (
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

      <div className="security-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
         <div className="security-card stat" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ShieldCheck size={32} color={alertCount > 0 ? "var(--warning)" : "var(--success)"} />
            <div className="txt">
               <div className="l" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tình trạng địa bàn</div>
               <div className="v" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{alertCount > 0 ? `Có ${alertCount} cảnh báo gần đây` : 'Ổn định, an toàn'}</div>
            </div>
         </div>
         <div className="security-card stat" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Users size={32} color="var(--primary)" />
            <div className="txt">
               <div className="l" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tổng lực lượng dân quân</div>
               <div className="v" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{militiaMembers.length} cán bộ, chiến sĩ</div>
            </div>
         </div>
      </div>

      {/* Điều hướng tab cấp 2 */}
      <div className="security-tabs-nav" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border)', marginBottom: '24px' }}>
        <button 
          className={`security-tab-btn ${subTab === 'logs' ? 'active' : ''}`}
          onClick={() => setSubTab('logs')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: subTab === 'logs' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: subTab === 'logs' ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Nhật ký sự vụ & tuần tra
        </button>
        <button 
          className={`security-tab-btn ${subTab === 'militia' ? 'active' : ''}`}
          onClick={() => setSubTab('militia')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: subTab === 'militia' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: subTab === 'militia' ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Đội ngũ Dân quân tự vệ
        </button>
      </div>

      {subTab === 'logs' ? (
        <div className="incident-list">
           <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '700' }}>Nhật ký sự vụ gần đây</h3>
           <div className="list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedLogs.map(log => (
                 <div key={log.id} className="incident-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      {log.type === 'alert' ? (
                        <ShieldAlert size={22} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <ShieldCheck size={22} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <div className="det">
                         <div className="t" style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{log.title}</div>
                         <div className="d" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(log.date).toLocaleDateString('vi-VN')} - {log.description}</div>
                      </div>
                    </div>
                    {!isGuest && (
                      <button 
                        onClick={() => handleDeleteSecurityLog(log.id)}
                        style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', flexShrink: 0 }}
                        title="Xóa nhật ký"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                 </div>
              ))}
             {logs.length === 0 && (
               <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'white', borderRadius: '12px', border: '1px solid var(--border)'}}>
                 Chưa ghi nhận sự kiện an ninh nào.
               </div>
             )}
           </div>
        </div>
      ) : (
        <div className="militia-roster-section">
          {/* Click-away overlay for custom dropdown */}
          {isDropdownOpen && (
            <div 
              onClick={() => setIsDropdownOpen(false)} 
              style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 998 }}
            />
          )}

          {/* Form thêm Dân quân mới (chỉ hiện với vai trò cho phép) */}
          {!isGuest && (
            <form onSubmit={handleAddMilitia} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', position: 'relative', zIndex: 999 }}>
              <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
                  <Search size={16} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Nhập tên hoặc địa chỉ để tìm nhân khẩu kết nạp..."
                    value={searchResidentQuery}
                    onChange={(e) => {
                      setSearchResidentQuery(e.target.value);
                      setIsDropdownOpen(true);
                      setSelectedResidentId('');
                    }}
                    onFocus={(e) => {
                      setIsDropdownOpen(true);
                      e.target.select();
                    }}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', background: 'transparent' }}
                  />
                  {(searchResidentQuery || selectedResidentId) && (
                    <button 
                      type="button" 
                      onClick={() => { setSelectedResidentId(''); setSearchResidentQuery(''); }} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {isDropdownOpen && filteredNonMilitiaResidents.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    marginTop: '4px'
                  }}>
                    {filteredNonMilitiaResidents.map(r => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedResidentId(r.id);
                          setSearchResidentQuery(`${r.full_name} (${r.dob ? r.dob.slice(0, 4) : '—'}) - ${r.permanent_address || 'TDP Quảng Giao'}`);
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          background: selectedResidentId === r.id ? '#eff6ff' : 'white',
                          transition: 'background 0.2s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedResidentId === r.id ? '#eff6ff' : 'white'; }}
                      >
                        <div style={{ fontWeight: '700', color: '#1e3a8a' }}>{r.full_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Năm sinh: {r.dob ? r.dob.slice(0, 4) : '—'} | SĐT: {r.phone || '—'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Đ/c: {r.permanent_address || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isDropdownOpen && searchResidentQuery && filteredNonMilitiaResidents.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    padding: '12px',
                    textAlign: 'center',
                    background: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    marginTop: '4px',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem'
                  }}>
                    Không tìm thấy nhân khẩu phù hợp
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minHeight: '38px', fontWeight: '600' }}>
                <Plus size={16} /> Kết nạp đội viên
              </button>
            </form>
          )}

          {/* Roster list header & search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>Danh sách cán bộ, chiến sĩ Dân quân tự quản</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={handleExportExcel} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#ecfeff', border: '1px solid #c5f2f7', color: '#0891b2', transition: 'all 0.15s ease' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#cffafe'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ecfeff'; e.currentTarget.style.transform = 'none'; }}
              >
                <FileDown size={16} />
                Xuất Excel/CSV
              </button>

              <button 
                type="button"
                onClick={handlePrint} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', transition: 'all 0.15s ease' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.transform = 'none'; }}
              >
                <Printer size={16} />
                In danh sách
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', width: '220px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc SĐT..."
                  value={searchMilitia}
                  onChange={(e) => setSearchMilitia(e.target.value)}
                  style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.85rem', background: 'transparent' }}
                />
              </div>
            </div>
          </div>

          {/* Roster table */}
          <div style={{ overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: '12px', background: 'white' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)', height: '42px' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '60px', fontSize: '0.85rem' }}>STT</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.85rem' }}>Họ và tên</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '100px', fontSize: '0.85rem' }}>Năm sinh</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', width: '160px', fontSize: '0.85rem' }}>Số điện thoại</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '0.85rem' }}>Địa chỉ thường trú</th>
                  {!isGuest && <th style={{ padding: '12px 10px', textAlign: 'center', width: '100px', fontSize: '0.85rem' }}>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMilitiaMembers.map((m, index) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ textAlign: 'center', padding: '12px 10px', fontSize: '0.88rem' }}>{index + 1}</td>
                    <td style={{ fontWeight: '700', color: '#1e3a8a', padding: '12px 10px', fontSize: '0.88rem' }}>{m.full_name}</td>
                    <td style={{ textAlign: 'center', padding: '12px 10px', fontSize: '0.88rem' }}>{m.dob ? m.dob.slice(0, 4) : '—'}</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: 'none' }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} /> {m.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '0.88rem' }}>{m.permanent_address || '—'}</td>
                    {!isGuest && (
                      <td style={{ textAlign: 'center', padding: '12px 10px' }}>
                        <button
                          onClick={() => handleRemoveMilitia(m.id, m.full_name)}
                          style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                          title="Đưa ra khỏi lực lượng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredMilitiaMembers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Chưa có đội viên nào trong lực lượng Dân quân.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Incident Modal */}
      {isFormOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Báo cáo sự vụ / tuần tra</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Loại sự vụ *</label>
                <select value={type} onChange={(e: any) => setType(e.target.value)}>
                  <option value="alert">🚨 Cảnh báo / Vụ việc mất an ninh trật tự</option>
                  <option value="ok">🟢 Nhật ký tuần tra đêm an toàn</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tiêu đề báo cáo *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Tuần tra đêm 12/07 an toàn"
                  required
                />
              </div>

              <div className="form-group">
                <label>Chi tiết vụ việc / Diễn biến tuần tra *</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả diễn biến cụ thể sự việc hoặc kết quả tuần tra bảo vệ..."
                  style={{ minHeight: '120px' }}
                  required
                />
              </div>

              <div className="form-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Ghi sổ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Security;
