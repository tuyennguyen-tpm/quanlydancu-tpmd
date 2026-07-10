import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Resident } from '../types';
import { Search, Zap, Users, Phone } from 'lucide-react';

const currentYear = new Date().getFullYear();

const YouthUnion = () => {
  const [members, setMembers] = useState<Resident[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const savedGroups = localStorage.getItem('tdp_groups_config');
  const groupsList = savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];

  const loadData = async () => {
    try {
      const residents = await db.getResidents();
      const dtMembers = residents.filter(r => {
        if (r.status === 'deceased') return false;
        const membership = r.association_membership || '';
        return membership.split(',').map(s => s.trim()).filter(Boolean).includes('dt');
      });
      setMembers(dtMembers);
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
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #dc2626, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={26} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#7f1d1d' }}>Chi đoàn Thanh niên</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Danh sách đoàn viên Chi đoàn Thanh niên Tổ dân phố Quảng Giao</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{members.length}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Tổng đoàn viên</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Đã đăng ký Chi đoàn Thanh niên</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f97316' }}>{members.filter(r => r.status === 'resident').length}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Đoàn viên thường trú</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Đang sinh hoạt tại địa phương</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #fca5a5' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#b91c1c' }}>3</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Ban chấp hành chi đoàn</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Bí thư, phó bí thư, ủy viên</div>
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} style={{ color: '#dc2626' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#7f1d1d' }}>
            Danh sách đoàn viên Thanh niên ({filteredMembers.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', outline: 'none', fontSize: '13px', color: '#7f1d1d', cursor: 'pointer' }}
          >
            <option value="all">Tất cả các tổ</option>
            {groupsList.map((g: string) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Tìm kiếm đoàn viên..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #fecaca', borderRadius: '8px', outline: 'none', fontSize: '13px', width: '200px' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fff1f2' }}>
              {['STT', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Tuổi', 'Điện thoại', 'Nghề nghiệp', 'Địa chỉ', 'Trạng thái'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: '14px' }}>
                  <Zap size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                  {searchQuery || groupFilter !== 'all'
                    ? 'Không tìm thấy đoàn viên nào khớp kết quả tìm kiếm.'
                    : 'Chưa có đoàn viên nào. Vào trang Nhân khẩu → chỉnh sửa → tích "Chi đoàn Thanh niên" để thêm.'}
                </td>
              </tr>
            ) : filteredMembers.map((m, idx) => {
              const dobFormatted = m.dob ? m.dob.split('-').reverse().join('/') : '—';
              const statusLabel = m.status === 'resident' ? 'Thường trú' : m.status === 'temporary_resident' ? 'Tạm trú' : m.status === 'temporary_absent' ? 'Tạm vắng' : m.status;
              const statusColor = m.status === 'resident' ? '#15803d' : m.status === 'temporary_absent' ? '#d97706' : '#6b7280';
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff1f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#6b7280' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{m.full_name}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{m.gender === 'female' ? 'Nữ' : 'Nam'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{dobFormatted}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', textAlign: 'center' }}>{getAge(m.dob)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>
                    {m.phone ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} />{m.phone}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{m.occupation || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6b7280', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.permanent_address || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
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
      <div style={{ marginTop: '20px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#7f1d1d' }}>💡 Hướng dẫn</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', lineHeight: 1.6 }}>
          Để thêm đoàn viên vào Chi đoàn Thanh niên: vào trang <strong>Nhân khẩu</strong> → chọn nhân khẩu → bấm <strong>Chỉnh sửa</strong> → tích chọn <strong>"Chi đoàn Thanh niên"</strong> trong mục "Thành viên Đoàn thể địa phương" → Lưu. Đoàn viên sẽ tự động xuất hiện trong danh sách này.
        </p>
      </div>
    </div>
  );
};

export default YouthUnion;
