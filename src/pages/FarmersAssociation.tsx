import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Resident } from '../types';
import { Search, Sprout, Users, Phone } from 'lucide-react';

const currentYear = new Date().getFullYear();

const FarmersAssociation = () => {
  const [members, setMembers] = useState<Resident[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const savedGroups = localStorage.getItem('tdp_groups_config');
  const groupsList = savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];

  const loadData = async () => {
    try {
      const residents = await db.getResidents();
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

  const filteredMembers = members.filter(m => {
    const matchSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (m.phone && m.phone.includes(searchQuery));
    if (!matchSearch) return false;
    if (groupFilter === 'all') return true;
    return (m.permanent_address || '').includes(groupFilter);
  });

  const getAge = (dob: string) => {
    if (!dob) return '—';
    const year = parseInt(dob.substring(0, 4));
    return isNaN(year) ? '—' : `${currentYear - year}`;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#14532d' }}>
            Danh sách hội viên Nông dân ({filteredMembers.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', outline: 'none', fontSize: '13px', color: '#14532d', cursor: 'pointer' }}
          >
            <option value="all">Tất cả các tổ</option>
            {groupsList.map((g: string) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Tìm kiếm hội viên..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #bbf7d0', borderRadius: '8px', outline: 'none', fontSize: '13px', width: '200px' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0fdf4' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STT</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Họ và tên</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ngày sinh</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tuổi</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Điện thoại</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nghề nghiệp</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Địa chỉ</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: '14px' }}>
                  <Sprout size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                  {searchQuery || groupFilter !== 'all'
                    ? 'Không tìm thấy hội viên nào khớp kết quả tìm kiếm.'
                    : 'Chưa có hội viên nào. Vào trang Nhân khẩu → chỉnh sửa → tích "Chi hội Nông dân" để thêm.'}
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
          Để thêm hội viên vào Chi hội Nông dân: vào trang <strong>Nhân khẩu</strong> → chọn nhân khẩu → bấm <strong>Chỉnh sửa</strong> → tích chọn <strong>"Chi hội Nông dân"</strong> trong mục "Thành viên Đoàn thể địa phương" → Lưu. Nhân khẩu sẽ tự động xuất hiện trong danh sách này.
        </p>
      </div>
    </div>
  );
};

export default FarmersAssociation;
