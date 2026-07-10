import { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Resident } from '../types';

const CCBElderly = () => {
  const [seniors, setSeniors] = useState<Resident[]>([]);
  const [veterans, setVeterans] = useState<Resident[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'seniors' | 'veterans'>('seniors');

  const currentYear = new Date().getFullYear();

  const loadData = async () => {
    try {
      const residents = await db.getResidents();
      const activeResidents = residents.filter(r => r.status !== 'deceased');

      // Seniors: age >= 60
      const seniorList = activeResidents.filter(r => {
        if (!r.dob) return false;
        const birthYear = parseInt(r.dob.substring(0, 4));
        return (currentYear - birthYear) >= 60;
      });

      // Veterans (CCB): occupation or notes contains CCB/Cựu chiến binh
      const veteranList = activeResidents.filter(r => {
        const occ = (r.occupation || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        const name = r.full_name.toLowerCase();
        return occ.includes('ccb') || occ.includes('cựu chiến') || occ.includes('bộ đội') ||
               notes.includes('ccb') || notes.includes('cựu chiến') ||
               // Fallback seeds for demo purposes
               name.includes('nguyễn kim tuyến') || name.includes('văn cường');
      });

      setSeniors(seniorList);
      setVeterans(veteranList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, []);

  const displayList = selectedTab === 'seniors' ? seniors : veterans;
  const filteredList = displayList.filter(m => 
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.cccd && m.cccd.includes(searchQuery)) ||
    (m.phone && m.phone.includes(searchQuery))
  );

  const getAge = (dob: string) => {
    if (!dob) return 0;
    return currentYear - parseInt(dob.substring(0, 4));
  };

  // Longevity category helper (Chúc thọ/Mừng thọ)
  const getLongevityCategory = (age: number) => {
    if (age >= 100) return 'Đại Thượng Thọ (100+)';
    if (age >= 90) return 'Thượng Thọ (90-99)';
    if (age >= 80) return 'Mừng Thọ (80-89)';
    if (age >= 70) return 'Chúc Thọ (70-79)';
    return 'Hội viên cao tuổi';
  };

  return (
    <div className="content-card" style={{ padding: '24px', display: 'block', minHeight: 'calc(100vh - 120px)', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>🎖️ Quản lý Cựu chiến binh & Người cao tuổi</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Hồ sơ chúc thọ/mừng thọ Người cao tuổi và danh sách hội viên Cựu chiến binh địa bàn</p>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <span className="label"><span className="dot" style={{ background: 'var(--accent-purple)' }}></span>Tổng số người cao tuổi ($\ge$60)</span>
          <div className="value">{seniors.length}</div>
          <div className="change neutral">Chiếm tỷ lệ cao trong cơ cấu dân số</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-blue)' }}>
          <span className="label"><span className="dot" style={{ background: 'var(--gov-blue)' }}></span>Hội viên Cựu chiến binh</span>
          <div className="value">{veterans.length}</div>
          <div className="change neutral">Bộ đội xuất ngũ hoạt động gương mẫu</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
          <span className="label"><span className="dot" style={{ background: 'var(--accent-teal)' }}></span>Cần mừng thọ năm nay ($\ge$70)</span>
          <div className="value">{seniors.filter(s => getAge(s.dob) >= 70 && getAge(s.dob) % 5 === 0).length}</div>
          <div className="change neutral">Hội viên tròn tuổi chúc thọ</div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <button 
          onClick={() => { setSelectedTab('seniors'); setSearchQuery(''); }}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            background: selectedTab === 'seniors' ? 'var(--gov-blue)' : 'white',
            color: selectedTab === 'seniors' ? 'white' : 'var(--text-secondary)',
            fontWeight: '600',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          👴 Hội Người cao tuổi ({seniors.length})
        </button>
        <button 
          onClick={() => { setSelectedTab('veterans'); setSearchQuery(''); }}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            background: selectedTab === 'veterans' ? 'var(--gov-blue)' : 'white',
            color: selectedTab === 'veterans' ? 'white' : 'var(--text-secondary)',
            fontWeight: '600',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          🎖️ Hội Cựu chiến binh ({veterans.length})
        </button>
      </div>

      {/* SEARCH AND TABLE */}
      <div className="card-gov">
        <div className="card-gov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title">
            <span className="title-dot"></span>
            {selectedTab === 'seniors' ? 'Danh sách Người cao tuổi' : 'Danh sách Hội viên Cựu chiến binh'} ({filteredList.length})
          </div>
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
                <th>Tuổi</th>
                <th>CCCD</th>
                <th>Điện thoại</th>
                <th>{selectedTab === 'seniors' ? 'Danh hiệu Mừng thọ' : 'Chức vụ / Công việc'}</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length > 0 ? (
                filteredList.map(m => {
                  const age = getAge(m.dob);
                  return (
                    <tr key={m.id}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{m.full_name}</td>
                      <td>{m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--gov-blue)' }}>{age} tuổi</td>
                      <td>{m.cccd || 'Chưa nhập'}</td>
                      <td>{m.phone || 'Chưa nhập'}</td>
                      <td style={{ fontWeight: selectedTab === 'seniors' && age >= 70 ? 600 : 400 }}>
                        {selectedTab === 'seniors' ? (
                          <span className={`status-pill ${age >= 80 ? 'pill-orange' : age >= 70 ? 'pill-blue' : 'pill-green'}`} style={{ fontSize: '11px' }}>
                            {getLongevityCategory(age)}
                          </span>
                        ) : (
                          m.occupation || 'Hội viên CCB'
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${m.status === 'resident' ? 'pill-green' : 'pill-orange'}`}>
                          {m.status === 'resident' ? 'Thường trú' : 'Tạm trú'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Không tìm thấy hội viên nào khớp kết quả tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default CCBElderly;
