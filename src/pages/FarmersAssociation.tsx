import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import type { Resident, Household } from '../types';
import { Search, Sprout, Users, Phone, FileDown, Printer, UserPlus } from 'lucide-react';
import ExcelJS from 'exceljs';

const currentYear = new Date().getFullYear();

const FarmersAssociation = () => {
  const [members, setMembers] = useState<Resident[]>([]);
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [residentSearchQuery, setResidentSearchQuery] = useState('');

  const savedGroups = localStorage.getItem('tdp_groups_config');
  const groupsList = savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];

  const loadData = async () => {
    try {
      const [residents, hhList] = await Promise.all([
        db.getResidents(),
        db.getHouseholds()
      ]);
      setAllResidents(residents);
      setHouseholds(hhList);
      const ndMembers = residents.filter(r => {
        if (r.status === 'deceased') return false;
        const membership = r.association_membership || '';
        return membership.split(',').map(s => s.trim()).filter(Boolean).includes('nd');
      });
      setMembers(ndMembers);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, []);

  const residentSearchResults = useMemo(() => {
    if (residentSearchQuery.trim().length < 2) return [];
    return allResidents.filter(r => {
      if (r.status === 'deceased') return false;
      const codes = (r.association_membership || '').split(',').map(s => s.trim()).filter(Boolean);
      if (codes.includes('nd')) return false;
      return r.full_name.toLowerCase().includes(residentSearchQuery.toLowerCase());
    }).slice(0, 5);
  }, [residentSearchQuery, allResidents]);

  const filteredMembers = members.filter(m => {
    const matchSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (m.phone && m.phone.includes(searchQuery));
    if (!matchSearch) return false;
    if (groupFilter === 'all') return true;
    const hh = households.find(h => h.id === m.household_id);
    if (!hh || !hh.self_management_group) return false;
    return hh.self_management_group.trim().toLowerCase() === groupFilter.trim().toLowerCase();
  });

  const getAge = (dob: string) => {
    if (!dob) return '—';
    const year = parseInt(dob.substring(0, 4));
    return isNaN(year) ? '—' : `${currentYear - year}`;
  };

  const currentRole = localStorage.getItem('current_role') || 'demo';
  const isGuest = localStorage.getItem('guest_mode') === 'true';

  const handleAddMember = async (resident: Resident) => {
    if (isGuest) {
      alert('Tài khoản của bạn không có quyền sửa đổi danh sách!');
      return;
    }
    try {
      const currentCodes = (resident.association_membership || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
        
      if (!currentCodes.includes('nd')) {
        currentCodes.push('nd');
      }
      
      const updatedResident = {
        ...resident,
        association_membership: currentCodes.join(',')
      };
      
      await db.saveResident(updatedResident);
      setResidentSearchQuery(''); // clear search
      loadData();
      
      // Trigger a custom event to notify other components of database change
      window.dispatchEvent(new Event('db-changed'));
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra khi thêm hội viên: ${err.message || err}`);
    }
  };

  const handleRemoveMember = async (resident: Resident) => {
    if (isGuest) {
      alert('Tài khoản của bạn không có quyền sửa đổi danh sách!');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn cho hội viên "${resident.full_name}" thôi tham gia Chi hội Nông dân?`)) {
      return;
    }
    try {
      const currentCodes = (resident.association_membership || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
        
      const updatedCodes = currentCodes.filter(c => c !== 'nd');
      
      const updatedResident = {
        ...resident,
        association_membership: updatedCodes.join(',')
      };
      
      await db.saveResident(updatedResident);
      loadData();
      
      // Trigger custom event
      window.dispatchEvent(new Event('db-changed'));
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra khi rút tên hội viên: ${err.message || err}`);
    }
  };

  // Printer function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const currentGroup = groupFilter === 'all' ? 'Tất cả các tổ' : groupFilter;

    let rowsHtml = '';
    filteredMembers.forEach((m, idx) => {
      const dobFormatted = m.dob ? m.dob.split('-').reverse().join('/') : '—';
      const age = getAge(m.dob);
      const statusText = m.status === 'resident' ? 'Thường trú' : m.status === 'temporary_resident' ? 'Tạm trú' : m.status === 'temporary_absent' ? 'Tạm vắng' : m.status;
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #000; font-weight: bold; white-space: nowrap;">${m.full_name}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${dobFormatted}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${age}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${m.phone || ''}</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.occupation || ''}</td>
          <td style="padding: 8px; border: 1px solid #000;">${m.permanent_address || ''}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #000;">${statusText}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>DANH SÁCH CHI HỘI VIÊN NÔNG DÂN</title>
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
          
          <h2 style="margin-top: 30px; text-align: center;">DANH SÁCH CHI HỘI VIÊN NÔNG DÂN</h2>
          <p style="text-align: center; font-style: italic; margin-top: 5px; margin-bottom: 25px;">Tổ/Nhóm: ${currentGroup}</p>
          
          <table>
            <thead>
              <tr>
                <th style="width: 5%">STT</th>
                <th style="width: 20%">Họ và tên</th>
                <th style="width: 12%">Ngày sinh</th>
                <th style="width: 8%">Tuổi</th>
                <th style="width: 13%">Điện thoại</th>
                <th style="width: 15%">Nghề nghiệp</th>
                <th style="width: 17%">Địa chỉ</th>
                <th style="width: 10%">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 12pt; page-break-inside: avoid;">
            <div style="width: 40%; text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">CHI HỘI TRƯỞNG</p>
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

  // Excel export function
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('HoiVienNongDan');

      const headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Tuổi', 'Điện thoại', 'Nghề nghiệp', 'Địa chỉ cư trú', 'Trạng thái'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF16A34A' } // Green for Farmers
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

      filteredMembers.forEach((m, idx) => {
        const dob = m.dob ? m.dob.split('-').reverse().join('/') : '—';
        const age = getAge(m.dob);
        const statusText = m.status === 'resident' ? 'Thường trú' : m.status === 'temporary_resident' ? 'Tạm trú' : m.status === 'temporary_absent' ? 'Tạm vắng' : m.status;

        const addedRow = worksheet.addRow([
          idx + 1,
          m.full_name,
          dob,
          age,
          m.phone || '',
          m.occupation || '',
          m.permanent_address || '',
          statusText
        ]);
        
        addedRow.height = 24;
        addedRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 8 ? 'center' : 'left'
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
      link.setAttribute('download', `danh_sach_hoi_vien_nong_dan_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export Excel error', e);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #16a34a, #4ade80)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sprout size={26} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#14532d' }}>Hội Nông dân</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Danh sách hội viên Chi hội Nông dân Tổ dân phố Quảng Giao</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{members.length}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Tổng hội viên</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Đã đăng ký Chi hội Nông dân</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e' }}>{members.filter(r => r.status === 'resident').length}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Hội viên thường trú</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Đang hoạt động thường xuyên</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #86efac' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>3</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Ban chấp hành chi hội</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Chi hội trưởng, chi hội phó, ủy viên</div>
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#14532d' }}>
              Danh sách hội viên Nông dân ({filteredMembers.length})
            </span>
          </div>

          {/* Search to Add Dropdown */}
          {!isGuest && (
            <div style={{ position: 'relative', width: '280px', display: 'inline-block' }}>
              <div className="search-box" style={{ width: '100%', border: '1px solid #bbf7d0', background: 'white' }}>
                <UserPlus size={14} style={{ color: '#16a34a' }} />
                <input
                  type="text"
                  placeholder="Nhập tên nhân khẩu để thêm..."
                  value={residentSearchQuery}
                  onChange={e => setResidentSearchQuery(e.target.value)}
                  style={{ fontSize: '12.5px' }}
                />
              </div>

              {residentSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  zIndex: 50,
                  marginTop: '4px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  textAlign: 'left'
                }}>
                  {residentSearchResults.map(r => {
                    const age = getAge(r.dob);
                    return (
                      <div 
                        key={r.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderBottom: '1px solid #f0fdf4',
                          fontSize: '12.5px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{r.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {age} tuổi | {r.gender === 'female' ? 'Nữ' : 'Nam'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(r)}
                          style={{
                            padding: '3px 8px',
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Thêm
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={handleExportExcel} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#ecfeff', border: '1px solid #c5f2f7', color: '#0891b2', transition: 'all 0.15s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#cffafe'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#ecfeff'; e.currentTarget.style.transform = 'none'; }}
          >
            <FileDown size={16} />
            Xuất Excel/CSV
          </button>

          <button 
            onClick={handlePrint} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', transition: 'all 0.15s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.transform = 'none'; }}
          >
            <Printer size={16} />
            In danh sách
          </button>

          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', outline: 'none', fontSize: '13px', color: '#14532d', cursor: 'pointer' }}
          >
            <option value="all">Tất cả các tổ</option>
            {groupsList.map((g: string) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="search-box" style={{ width: '200px' }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Tìm kiếm hội viên..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0fdf4' }}>
              {['STT', 'Họ và tên', 'Ngày sinh', 'Tuổi', 'Điện thoại', 'Nghề nghiệp', 'Địa chỉ', 'Trạng thái', ...(!isGuest ? ['Hành động'] : [])].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={!isGuest ? 9 : 8} style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: '14px' }}>
                  <Sprout size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                  {searchQuery || groupFilter !== 'all'
                    ? 'Không tìm thấy hội viên nào khớp kết quả tìm kiếm.'
                    : 'Chưa có hội viên nào. Nhập tên nhân khẩu ở ô tìm kiếm bên trên để thêm nhanh.'}
                </td>
              </tr>
            ) : filteredMembers.map((m, idx) => {
              const dobFormatted = m.dob ? m.dob.split('-').reverse().join('/') : '—';
              const statusLabel = m.status === 'resident' ? 'Thường trú' : m.status === 'temporary_resident' ? 'Tạm trú' : m.status === 'temporary_absent' ? 'Tạm vắng' : m.status;
              const statusColor = m.status === 'resident' ? '#15803d' : m.status === 'temporary_absent' ? '#d97706' : '#6b7280';
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{m.full_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{dobFormatted}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151', textAlign: 'center' }}>{getAge(m.dob)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>
                    {m.phone ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} />{m.phone}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{m.occupation || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.permanent_address || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: statusColor, background: statusColor + '18', padding: '3px 10px', borderRadius: '20px' }}>
                      {statusLabel}
                    </span>
                  </td>
                  {!isGuest && (
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        onClick={() => handleRemoveMember(m)}
                        style={{
                          padding: '4px 8px',
                          background: '#fef2f2',
                          border: '1px solid #fee2e2',
                          color: '#dc2626',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = '#fee2e2')}
                        onMouseOut={e => (e.currentTarget.style.background = '#fef2f2')}
                      >
                        ❌ Rút
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info panel */}
      <div style={{ marginTop: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#14532d' }}>💡 Hướng dẫn</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#15803d', lineHeight: 1.6 }}>
          Nhập tên nhân khẩu ở ô tìm kiếm nhanh bên trên để thêm nhanh hội viên vào Chi hội Nông dân địa bàn.
        </p>
      </div>
    </div>
  );
};

export default FarmersAssociation;
