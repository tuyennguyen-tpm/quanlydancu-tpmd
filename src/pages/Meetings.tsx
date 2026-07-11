import { useState, useEffect } from 'react';
import { Calendar, Users, MapPin, Clock, Plus, X, ListCollapse, FileText, Trash2, Pencil, FileDown, Printer, UserPlus } from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Meeting } from '../types';

const Meetings = ({ type = 'general' }: { type?: 'general' | 'party' | 'front' }) => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
                  currentRole === 'demo' || 
                  (type === 'party' && currentRole !== 'admin' && currentRole !== 'bi_thu') ||
                  (type === 'front' && currentRole !== 'admin' && currentRole !== 'mat_tran') ||
                  (type === 'general' && currentRole !== 'admin' && currentRole !== 'to_truong');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [activeFrontTab, setActiveFrontTab] = useState<'meetings' | 'committee'>('meetings');
  const [committeeMembers, setCommitteeMembers] = useState<any[]>([]);

  // Form states for committee members
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberDob, setMemberDob] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberPosition, setMemberPosition] = useState('');

  const INITIAL_COMMITTEE = [
    { id: 'fc_1', name: 'Ngô Văn Quyết', dob: '', phone: '', position: 'Trưởng ban Công tác Mặt trận (TBCTMT)' },
    { id: 'fc_2', name: 'Lê Bá Tâm', dob: '', phone: '', position: 'Chi hội trưởng Hội Nông dân' },
    { id: 'fc_3', name: 'Nguyễn Thị Hằng', dob: '', phone: '', position: 'Chi hội trưởng Chi hội Phụ nữ' },
    { id: 'fc_4', name: 'Lê Minh Nguyệt', dob: '', phone: '', position: 'Chi hội Cựu chiến binh' },
    { id: 'fc_5', name: 'Ngô Huy Giao', dob: '', phone: '', position: 'Chi hội Người cao tuổi' },
    { id: 'fc_6', name: 'Nguyễn Đường Dự', dob: '', phone: '', position: 'Chi hội trưởng Thanh niên xung phong' },
    { id: 'fc_7', name: 'Ngô Sỹ Nam', dob: '', phone: '', position: 'Hội trưởng Hội Khuyến học' },
    { id: 'fc_8', name: 'Ngô Sỹ Thanh', dob: '', phone: '', position: 'Hội Chữ thập đỏ' },
    { id: 'fc_9', name: 'Trần Văn Toản', dob: '', phone: '', position: 'Công dân tiêu biểu' },
    { id: 'fc_10', name: 'Nguyễn Trọng Duy', dob: '', phone: '', position: 'Đại diện doanh nghiệp' },
    { id: 'fc_11', name: 'Nguyễn Duy Chung', dob: '', phone: '', position: 'Công dân tiêu biểu' },
    { id: 'fc_12', name: 'Trần Văn Ngọc', dob: '', phone: '', position: 'Đại biểu HĐND - Phó ban Công tác Mặt trận' },
    { id: 'fc_13', name: 'Nguyễn Thị Thúy', dob: '', phone: '', position: 'Bí thư Chi đoàn' }
  ];

  // Load committee members
  useEffect(() => {
    if (type === 'front') {
      const saved = localStorage.getItem('front_committee_members');
      if (saved) {
        try {
          setCommitteeMembers(JSON.parse(saved));
        } catch {
          setCommitteeMembers(INITIAL_COMMITTEE);
        }
      } else {
        setCommitteeMembers(INITIAL_COMMITTEE);
        localStorage.setItem('front_committee_members', JSON.stringify(INITIAL_COMMITTEE));
      }
    }
  }, [type]);

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
    if (!title.trim() || !content.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung cuộc họp!', 'warning');
      return;
    }

    const payload: Meeting = {
      id: generateUUID(),
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

  const handleDeleteMeeting = async (id: string, title: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa cuộc họp "${title}" không?`)) {
      try {
        await db.deleteMeeting(id);
        showToast('Xóa cuộc họp thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa cuộc họp!', 'danger');
      }
    }
  };

  const saveCommittee = async (updatedList: any[]) => {
    setCommitteeMembers(updatedList);
    const jsonStr = JSON.stringify(updatedList);
    localStorage.setItem('front_committee_members', jsonStr);
    
    // Sync to Supabase app_config table
    const { supabase } = await import('../services/db');
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uId = session?.user?.id;
        if (uId) {
          await supabase.from('app_config').upsert({
            user_id: uId,
            key: 'front_committee_members',
            value: jsonStr,
            updated_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Lỗi đồng bộ app_config:', err);
      }
    }
  };

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberName('');
    setMemberDob('');
    setMemberPhone('');
    setMemberPosition('');
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (m: any) => {
    setEditingMember(m);
    setMemberName(m.name);
    setMemberDob(m.dob || '');
    setMemberPhone(m.phone || '');
    setMemberPosition(m.position || '');
    setIsMemberModalOpen(true);
  };

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      alert('Vui lòng nhập họ và tên!');
      return;
    }

    let updated: any[];
    if (editingMember) {
      updated = committeeMembers.map(m => m.id === editingMember.id ? {
        ...m,
        name: memberName.trim(),
        dob: memberDob.trim(),
        phone: memberPhone.trim(),
        position: memberPosition.trim()
      } : m);
      showToast('Cập nhật thành viên thành công!', 'success');
    } else {
      const newMember = {
        id: 'fc_' + Math.random().toString(36).substring(2, 9),
        name: memberName.trim(),
        dob: memberDob.trim(),
        phone: memberPhone.trim(),
        position: memberPosition.trim()
      };
      updated = [...committeeMembers, newMember];
      showToast('Thêm thành viên mới thành công!', 'success');
    }

    await saveCommittee(updated);
    setIsMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi Ban công tác Mặt trận?`)) {
      const updated = committeeMembers.filter(m => m.id !== id);
      await saveCommittee(updated);
      showToast('Xóa thành viên thành công!', 'success');
    }
  };

  const handleExportCommitteeExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ban công tác Mặt trận');
      
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Họ và tên', key: 'name', width: 25 },
        { header: 'Năm sinh', key: 'dob', width: 15 },
        { header: 'Số điện thoại', key: 'phone', width: 20 },
        { header: 'Chức vụ / Thành phần', key: 'position', width: 35 }
      ];

      worksheet.insertRow(1, []);
      worksheet.insertRow(2, ['DANH SÁCH BAN CHẤP HÀNH / BAN CÔNG TÁC MẶT TRẬN']);
      worksheet.mergeCells('A2:E2');
      
      const titleRow = worksheet.getRow(2);
      titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      titleRow.height = 40;
      
      worksheet.getCell('A2').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      };

      const headerRow = worksheet.getRow(4);
      headerRow.values = ['STT', 'Họ và tên', 'Năm sinh', 'Số điện thoại', 'Chức vụ / Thành phần'];
      headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;
      
      ['A4', 'B4', 'C4', 'D4', 'E4'].forEach(cellRef => {
        const cell = worksheet.getCell(cellRef);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563EB' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      committeeMembers.forEach((m, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          m.name,
          m.dob || '',
          m.phone || '',
          m.position || ''
        ]);
        
        row.height = 22;
        row.font = { name: 'Arial', size: 11 };
        
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(2).font = { bold: true };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
        
        for (let i = 1; i <= 5; i++) {
          row.getCell(i).border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Danh_sach_Ban_cong_tac_Mat_tran_${tdpName.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Xuất file Excel thành công!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi xuất file Excel: ' + err.message, 'danger');
    }
  };

  const handlePrintCommittee = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>Danh sách Ban công tác Mặt trận</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin-top: 20mm;
                margin-bottom: 20mm;
                margin-left: 30mm;
                margin-right: 15mm;
              }
              body { margin: 0; padding: 0; }
            }
            body { font-family: "Times New Roman", Times, serif; padding: 30px; color: #000; font-size: 14pt; }
            h1 { text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #000; }
            th, td { border: 1px solid #000 !important; padding: 8px; text-align: left; font-size: 13pt; }
            th { background-color: transparent; text-align: center; font-weight: bold; }
            td.center { text-align: center; }
            .header-info { text-align: center; margin-bottom: 30px; font-weight: bold; font-size: 14pt; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header-info">
            ỦY BAN MẶT TRẬN TỔ QUỐC VIỆT NAM ${(wardName.toLowerCase().startsWith('phường') ? wardName : 'Phường ' + wardName).toUpperCase()}<br>
            BAN CÔNG TÁC MẶT TRẬN TỔ DÂN PHỐ ${tdpName.toUpperCase()}
          </div>
          <h1>DANH SÁCH BAN CHẤP HÀNH / BAN CÔNG TÁC MẶT TRẬN</h1>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">STT</th>
                <th>Họ và tên</th>
                <th style="width: 100px;">Năm sinh</th>
                <th style="width: 120px;">Số điện thoại</th>
                <th>Chức vụ / Thành phần</th>
              </tr>
            </thead>
            <tbody>
              ${committeeMembers.map((m, idx) => `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td style="font-weight: bold; white-space: nowrap;">${m.name}</td>
                  <td class="center">${m.dob || ''}</td>
                  <td class="center">${m.phone || ''}</td>
                  <td>${m.position || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
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
          {!isGuest && (type !== 'front' || activeFrontTab !== 'committee') && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => handleCreateMinutes(undefined, type)}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontWeight: '600'
                }}
              >
                <FileText size={16} /> Tạo biên bản
              </button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={() => setIsFormOpen(true)}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontWeight: '600'
                }}
              >
                <Plus size={16} /> Tạo cuộc họp mới
              </button>
            </div>
          )}
        </div>
      </div>

      {type === 'front' && (
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '20px', gap: '16px' }}>
          <button 
            type="button"
            onClick={() => setActiveFrontTab('meetings')}
            style={{
              padding: '10px 16px',
              fontSize: '14.5px',
              fontWeight: '600',
              border: 'none',
              background: 'none',
              borderBottom: activeFrontTab === 'meetings' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeFrontTab === 'meetings' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Calendar size={16} />
            Cuộc họp Mặt trận
          </button>
          <button 
            type="button"
            onClick={() => setActiveFrontTab('committee')}
            style={{
              padding: '10px 16px',
              fontSize: '14.5px',
              fontWeight: '600',
              border: 'none',
              background: 'none',
              borderBottom: activeFrontTab === 'committee' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeFrontTab === 'committee' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={16} />
            Ban công tác Mặt trận
          </button>
        </div>
      )}

      {type === 'front' && activeFrontTab === 'committee' ? (
        <div className="card-gov" style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginTop: '8px', marginBottom: '32px' }}>
          <div className="card-gov-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-main)' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
              <span style={{ width: '4px', height: '16px', background: 'var(--primary)', borderRadius: '2px', display: 'inline-block' }}></span>
              DANH SÁCH BAN CHẤP HÀNH / BAN CÔNG TÁC MẶT TRẬN ({committeeMembers.length})
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                type="button"
                onClick={handleExportCommitteeExcel} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#ecfeff', border: '1px solid #c5f2f7', color: '#0891b2' }}
              >
                <FileDown size={14} />
                Xuất Excel
              </button>

              <button 
                type="button"
                onClick={handlePrintCommittee} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6' }}
              >
                <Printer size={14} />
                In danh sách
              </button>

              {!isGuest && (
                <button 
                  type="button"
                  onClick={handleOpenAddMember} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  <UserPlus size={14} />
                  Thêm thành viên
                </button>
              )}
            </div>
          </div>
          
          <div className="card-gov-body" style={{ overflowX: 'auto' }}>
            <table className="mini-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', width: '50px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#475569' }}>STT</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Họ và tên</th>
                  <th style={{ padding: '10px 14px', width: '100px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Năm sinh</th>
                  <th style={{ padding: '10px 14px', width: '130px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Số điện thoại</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Chức vụ / Thành phần</th>
                  {!isGuest && <th style={{ padding: '10px 14px', width: '120px', textAlign: 'center', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {committeeMembers.length > 0 ? (
                  committeeMembers.map((m, idx) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: '600', fontSize: '13.5px', color: 'var(--text-main)' }}>{m.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>{m.dob || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>{m.phone || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: '#334155' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', fontWeight: '500' }}>
                          {m.position}
                        </span>
                      </td>
                      {!isGuest && (
                        <td style={{ padding: '8px 14px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center', borderLeft: 'none' }}>
                          <button 
                            type="button"
                            onClick={() => handleOpenEditMember(m)}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Pencil size={11} /> Sửa
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteMember(m.id, m.name)}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Trash2 size={11} /> Xóa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={!isGuest ? 6 : 5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có thành viên nào trong danh sách.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
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
                       <div style={{ display: 'flex', gap: '8px' }}>
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
                         <button
                           className="btn btn-danger btn-sm"
                           onClick={() => handleDeleteMeeting(m.id, m.title)}
                           style={{
                             padding: '4px 8px',
                             fontSize: '0.8rem',
                             background: 'rgba(239, 68, 68, 0.2)',
                             borderColor: 'rgba(239, 68, 68, 0.4)',
                             color: '#f87171',
                             height: '28px',
                             display: 'inline-flex',
                             alignItems: 'center',
                             gap: '4px',
                             cursor: 'pointer'
                           }}
                           onMouseOver={(e) => {
                             e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)';
                           }}
                           onMouseOut={(e) => {
                             e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                           }}
                         >
                           <Trash2 size={14} /> Xóa
                         </button>
                       </div>
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
                           <span>
                             {m.attendance_count}{' '}
                             {type === 'party' 
                               ? 'Đảng viên tham gia' 
                               : type === 'front' 
                                 ? 'thành viên tham gia' 
                                 : 'hộ tham gia'}{' '}
                             - Địa điểm: {m.location}
                           </span>
                           {!isGuest && (
                             <div style={{ display: 'flex', gap: '8px' }}>
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
                               <button
                                 className="btn btn-danger btn-sm"
                                 onClick={() => handleDeleteMeeting(m.id, m.title)}
                                 style={{
                                   padding: '4px 8px',
                                   fontSize: '0.8rem',
                                   height: '28px',
                                   border: '1.5px solid var(--border)',
                                   display: 'inline-flex',
                                   alignItems: 'center',
                                   gap: '6px',
                                   background: 'white',
                                   color: '#ef4444',
                                   fontWeight: '600'
                                 }}
                                 onMouseOver={(e) => {
                                   e.currentTarget.style.transform = 'translateY(-1px)';
                                 }}
                                 onMouseOut={(e) => {
                                   e.currentTarget.style.transform = 'translateY(0)';
                                 }}
                               >
                                 <Trash2 size={14} /> Xóa
                               </button>
                             </div>
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
        </>
      )}

      {/* Add/Edit Member Modal */}
      {isMemberModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>{editingMember ? 'Chỉnh sửa thông tin thành viên' : 'Thêm thành viên Ban CT Mặt trận'}</h2>
              <button className="close-btn" onClick={() => setIsMemberModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmitMember} className="modal-form">
              <div className="form-group">
                <label>Họ và tên *</label>
                <input 
                  type="text" 
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ví dụ: Ngô Văn Quyết..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Năm sinh</label>
                <input 
                  type="text" 
                  value={memberDob}
                  onChange={(e) => setMemberDob(e.target.value)}
                  placeholder="Ví dụ: 1975..."
                />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input 
                  type="text" 
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="Ví dụ: 0912..."
                />
              </div>
              <div className="form-group">
                <label>Chức vụ / Thành phần đại diện *</label>
                <input 
                  type="text" 
                  value={memberPosition}
                  onChange={(e) => setMemberPosition(e.target.value)}
                  placeholder="Ví dụ: Trưởng ban Công tác Mặt trận, Đại biểu HĐND..."
                  required
                />
              </div>
              <div className="form-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsMemberModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingMember ? 'Lưu thay đổi' : 'Thêm mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label>
                  {type === 'party' 
                    ? 'Số lượng Đảng viên tham gia dự kiến / thực tế' 
                    : type === 'front' 
                      ? 'Số lượng thành viên tham gia dự kiến / thực tế' 
                      : 'Số lượng hộ gia đình tham gia dự kiến / thực tế'}
                </label>
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
