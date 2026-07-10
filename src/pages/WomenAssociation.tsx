import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Resident } from '../types';

const WomenAssociation = () => {
  const [members, setMembers] = useState<Resident[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    executiveBoardCount: 3,
  });

  const loadData = async () => {
    try {
      const residents = await db.getResidents();
      const activeFemales = residents.filter(r => r.gender === 'female' && r.status !== 'deceased');
      setMembers(activeFemales);
      setStats({
        totalMembers: activeFemales.length,
        activeMembers: activeFemales.filter(r => r.status === 'resident').length,
        executiveBoardCount: Math.min(3, activeFemales.length),
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, []);

  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.phone && m.phone.includes(searchQuery))
  );

  return (
    <div className="content-card" style={{ padding: '24px', display: 'block', minHeight: 'calc(100vh - 120px)', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>👩‍🦰 Quản lý Hội Phụ nữ Tổ dân phố</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Danh sách hội viên, ban chấp hành và các phong trào thi đua an sinh xã hội</p>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #D81B60' }}>
          <span className="label"><span className="dot" style={{ background: '#D81B60' }}></span>Tổng số hội viên phụ nữ</span>
          <div className="value">{stats.totalMembers}</div>
          <div className="change neutral">Sinh hoạt thường kỳ tại địa bàn</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-green)' }}>
          <span className="label"><span className="dot" style={{ background: 'var(--gov-green)' }}></span>Hội viên nòng cốt</span>
          <div className="value">{stats.activeMembers}</div>
          <div className="change neutral">Tích cực tham gia các phong trào</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
          <span className="label"><span className="dot" style={{ background: 'var(--accent-orange)' }}></span>Ban chấp hành chi hội</span>
          <div className="value">{stats.executiveBoardCount}</div>
          <div className="change neutral">Chi hội trưởng, chi hội phó, ủy viên</div>
        </div>
      </div>

      {/* MOVEMENTS CARD */}
      <div className="card-gov" style={{ marginBottom: '24px' }}>
        <div className="card-gov-header">
          <div className="card-title"><span className="title-dot" style={{ background: '#D81B60' }}></span>Các phong trào thi đua trọng điểm</div>
        </div>
        <div className="card-gov-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '14px', background: '#FCE4EC', border: '1px solid #F8BBD0', borderRadius: '10px', textAlign: 'left' }}>
              <h4 style={{ color: '#C2185B', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>🌸 Phong trào "5 không 3 sạch"</h4>
              <p style={{ fontSize: '12px', color: '#880e4f', lineHeight: 1.4 }}>Tuyên truyền các tiêu chí: Không đói nghèo, Không vi phạm pháp luật & tệ nạn, Không bạo lực gia đình, Không sinh con thứ ba, Không trẻ suy dinh dưỡng. Sạch nhà, Sạch bếp, Sạch ngõ.</p>
            </div>
            <div style={{ padding: '14px', background: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: '10px', textAlign: 'left' }}>
              <h4 style={{ color: '#2E7D32', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>🧹 Ngày Chủ nhật Xanh dọn dẹp vệ sinh bãi biển</h4>
              <p style={{ fontSize: '12px', color: '#1B5E20', lineHeight: 1.4 }}>Hội Phụ nữ làm nòng cốt phối hợp cùng thanh niên tổ chức dọn vệ sinh rác thải nhựa dọc bờ biển Quảng Giao định kỳ tuần thứ 2 hàng tháng.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH AND TABLE */}
      <div className="card-gov">
        <div className="card-gov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title"><span className="title-dot"></span>Danh sách hội viên Phụ nữ ({filteredMembers.length})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', width: '260px' }}>
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên, số điện thoại..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: '12.5px', width: '100%' }}
            />
          </div>
        </div>
        <div className="card-gov-body" style={{ padding: 0 }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th style={{ padding: '10px 14px' }}>Họ và tên</th>
                <th>Ngày sinh</th>
                <th>Điện thoại</th>
                <th>Nghề nghiệp</th>
                <th>Địa chỉ cư trú</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length > 0 ? (
                filteredMembers.map(m => (
                  <tr key={m.id}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{m.full_name}</td>
                    <td>{m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập'}</td>
                    <td>{m.phone || 'Chưa nhập'}</td>
                    <td>{m.occupation || 'Tự do'}</td>
                    <td>{m.temporary_address || m.permanent_address || 'TDP Quảng Giao'}</td>
                    <td>
                      <span className={`status-pill ${m.status === 'resident' ? 'pill-green' : 'pill-orange'}`}>
                        {m.status === 'resident' ? 'Thường trú' : 'Tạm trú'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy hội viên phụ nữ nào khớp kết quả tìm kiếm.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default WomenAssociation;
