import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Household, Resident } from '../types';

interface HouseholdWithHead extends Household {
  headName: string;
}

const InvitationTemplates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leader' | 'party' | 'front'>('leader');
  const [households, setHouseholds] = useState<HouseholdWithHead[]>([]);
  const [selectedHouseholds, setSelectedHouseholds] = useState<Set<string>>(new Set());
  const [meetingContent, setMeetingContent] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingMonth, setMeetingMonth] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'setup' | 'preview'>('setup');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  // Load config
  const rawWardName = localStorage.getItem('ward_name') || 'Quảng Đại';
  const rawTdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';

  const toUpper = (s: string) => s.toUpperCase();

  const formatTdpHeader = (name: string) => {
    const u = toUpper(name);
    if (u.startsWith('TỔ DÂN PHỐ') || u.startsWith('THÔN') || u.startsWith('KHU DÂN CƯ')) return u;
    return `TỔ DÂN PHỐ ${u}`;
  };
  const formatWardHeader = (name: string) => {
    const u = toUpper(name);
    if (u.startsWith('PHƯỜNG') || u.startsWith('XÃ') || u.startsWith('THỊ TRẤN')) return u;
    return `PHƯỜNG ${u}`;
  };

  const tdpHeader = formatTdpHeader(rawTdpName);
  const wardHeader = formatWardHeader(rawWardName);
  const partyTdpHeader = tdpHeader.startsWith('CHI BỘ') ? tdpHeader : `CHI BỘ ${toUpper(rawTdpName)}`;

  // Load official names
  let biThuName = '';
  let toTruongName = localStorage.getItem('leader_name') || '';
  let matTranName = '';
  const savedSigs = localStorage.getItem('official_signatures');
  if (savedSigs) {
    try {
      const sigs = JSON.parse(savedSigs);
      const bt = sigs.find((s: any) => s.id === 'bi_thu');
      if (bt?.name) biThuName = bt.name;
      const tt = sigs.find((s: any) => s.id === 'to_truong');
      if (tt?.name) toTruongName = tt.name;
      const mt = sigs.find((s: any) => s.id === 'mat_tran');
      if (mt?.name) matTranName = mt.name;
    } catch (e) {}
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hList, rList] = await Promise.all([
          db.getHouseholds(),
          db.getResidents()
        ]);
        const residentMap: Record<string, Resident> = {};
        rList.forEach(r => {
          if (r.is_head) residentMap[r.household_id] = r;
          else if (!residentMap[r.household_id]) residentMap[r.household_id] = r;
        });
        const mapped: HouseholdWithHead[] = hList.map(h => ({
          ...h,
          headName: residentMap[h.id]?.full_name || 'Chưa có thông tin'
        }));
        setHouseholds(mapped);
        setSelectedHouseholds(new Set(mapped.map(h => h.id)));
        // Default location
        setMeetingLocation(`Nhà văn hóa ${rawTdpName}`);
        setMeetingTime('19:00');
        setMeetingDate(String(currentDay).padStart(2, '0'));
        setMeetingMonth(String(currentMonth).padStart(2, '0'));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handlePrint = () => window.print();

  const toggleHousehold = (id: string) => {
    setSelectedHouseholds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedHouseholds(new Set(households.map(h => h.id)));
  const clearAll = () => setSelectedHouseholds(new Set());

  const selectedList = households.filter(h => selectedHouseholds.has(h.id));

  const signatureName = activeTab === 'party' ? biThuName
    : activeTab === 'front' ? matTranName
    : toTruongName;

  const signerTitle = activeTab === 'party' ? 'BÍ THƯ'
    : activeTab === 'front' ? 'TRƯỞNG BAN'
    : 'TỔ TRƯỞNG';

  const signerOrg = activeTab === 'party' ? 'T/M CHI ỦY (CHI BỘ)'
    : activeTab === 'front' ? 'TM. BAN CÔNG TÁC MẶT TRẬN'
    : '';

  const subjectLabel = activeTab === 'party' ? 'Dự sinh hoạt Chi bộ định kỳ/chuyên đề'
    : activeTab === 'front' ? 'V/v: Dự hội nghị họp dân / Đại đoàn kết toàn dân tộc'
    : `V/v: ${meetingContent || '..........................................................................'}`;

  const openingText = activeTab === 'party'
    ? `Chi ủy ${partyTdpHeader.toLowerCase()} trân trọng kính mời Đồng chí tới tham dự kỳ họp sinh hoạt Chi bộ định kỳ/chuyên đề với nội dung chi tiết như sau:`
    : activeTab === 'front'
    ? `Ban công tác Mặt trận ${tdpHeader.toLowerCase()} trân trọng kính mời Ông/Bà tới tham dự hội nghị họp dân bàn công tác mặt trận với nội dung chi tiết như sau:`
    : `Tổ trưởng ${tdpHeader.toLowerCase()} trân trọng kính mời Ông/Bà tới tham dự cuộc họp với nội dung chi tiết như sau:`;

  const leftOrgBlock = activeTab === 'party' ? (
    <>
      <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '11pt' }}>ĐẢNG BỘ {wardHeader}</p>
      <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>{partyTdpHeader}</p>
    </>
  ) : activeTab === 'front' ? (
    <>
      <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '10pt' }}>UBMTTQ VN {wardHeader}</p>
      <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '10pt' }}>BAN CÔNG TÁC MẶT TRẬN</p>
      <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '10pt' }}>{tdpHeader}</p>
    </>
  ) : (
    <>
      <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '11pt' }}>UBND {wardHeader}</p>
      <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>{tdpHeader}</p>
    </>
  );

  const rightHeaderBlock = activeTab === 'party' ? (
    <>
      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase' }}>ĐẢNG CỘNG SẢN VIỆT NAM</p>
      <div style={{ width: '130px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
    </>
  ) : (
    <>
      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', display: 'inline-block' }}>Độc lập - Tự do - Hạnh phúc</p>
      <div style={{ width: '160px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
    </>
  );

  const renderSingleInvitation = (h: HouseholdWithHead, index: number) => (
    <div key={h.id} className="invitation-page" style={{
      pageBreakAfter: index < selectedList.length - 1 ? 'always' : 'auto',
      padding: '50px 60px',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '13pt',
      lineHeight: '1.6',
      color: '#000',
      background: 'white',
      minHeight: '650px',
      border: mode === 'preview' ? '1px dashed #ccc' : 'none',
      marginBottom: mode === 'preview' ? '20px' : '0'
    }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          {leftOrgBlock}
          <div style={{ width: '60px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
          <p style={{ margin: 0, fontSize: '10pt' }}>Số: ....../GM-{activeTab === 'party' ? 'CB' : activeTab === 'front' ? 'MTTQ' : 'TDP'}</p>
        </div>
        <div style={{ textAlign: 'center', width: '50%' }}>
          {rightHeaderBlock}
          <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12pt' }}>{rawWardName}, ngày {meetingDate} tháng {meetingMonth} năm {currentYear}</p>
        </div>
      </div>

      {/* TITLE */}
      <h1 style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', margin: '20px 0 8px' }}>GIẤY MỜI</h1>
      <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13pt', margin: '0 0 20px' }}>{subjectLabel}</p>

      {/* KÍNH GỬI */}
      <div style={{ marginBottom: '15px', paddingLeft: '30px' }}>
        <p style={{ margin: '0 0 5px' }}>
          <strong>Kính gửi: </strong>
          {activeTab === 'party' ? `Đồng chí ${h.headName}` : `Ông/Bà: ${h.headName}`}
        </p>
        <p style={{ margin: 0, paddingLeft: '20px' }}>
          Đại diện hộ gia đình tại: <strong>{h.address}</strong>
        </p>
      </div>

      {/* NỘI DUNG */}
      <p style={{ textIndent: '30px', margin: '0 0 12px', textAlign: 'justify' }}>{openingText}</p>

      <div style={{ paddingLeft: '30px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 8px' }}>
          <strong>1. Nội dung {activeTab === 'party' ? 'sinh hoạt' : 'cuộc họp'}:</strong>{' '}
          {meetingContent || '..........................................................................................'}
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <strong>2. Thời gian:</strong> {meetingTime} giờ, ngày {meetingDate} tháng {meetingMonth} năm {currentYear}
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <strong>3. Địa điểm:</strong> {meetingLocation || `Nhà văn hóa ${rawTdpName}`}
        </p>
        {activeTab === 'party' && (
          <p style={{ margin: 0 }}>
            <strong>4. Yêu cầu:</strong> Mang theo sổ tay Đảng viên, trang phục chỉnh tề.
          </p>
        )}
      </div>

      <p style={{ textIndent: '30px', margin: '0 0 30px', textAlign: 'justify' }}>
        {activeTab === 'party'
          ? 'Đề nghị Đồng chí sắp xếp công việc tham dự đầy đủ và đúng giờ để buổi sinh hoạt đạt chất lượng tốt./.'
          : 'Sự có mặt của Ông/Bà là yếu tố quan trọng góp phần vào thành công của cuộc họp. Rất mong Ông/Bà sắp xếp thời gian đến dự đúng giờ./.'}
      </p>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '45%', paddingLeft: '10px' }}>
          <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 3px', fontSize: '11pt' }}>Nơi nhận:</p>
          <p style={{ margin: 0, fontSize: '11pt' }}>
            - {activeTab === 'party' ? `Đ/c ${h.headName}` : `Ông/Bà ${h.headName}`};
          </p>
          <p style={{ margin: 0, fontSize: '11pt' }}>
            - {activeTab === 'party' ? `Đảng ủy ${wardHeader.toLowerCase()}` : `UBND ${wardHeader.toLowerCase()}`} (b/c);
          </p>
          <p style={{ margin: 0, fontSize: '11pt' }}>- Lưu: {activeTab === 'party' ? 'CB' : activeTab === 'front' ? 'Ban CTMT' : 'TDP'}.</p>
        </div>
        <div style={{ width: '45%', textAlign: 'center' }}>
          {signerOrg && <p style={{ fontWeight: 'bold', margin: 0, fontSize: '11pt' }}>{signerOrg}</p>}
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: '11pt' }}>{signerTitle}</p>
          <p style={{ fontStyle: 'italic', margin: 0, fontSize: '10pt' }}>(Chữ ký, họ và tên)</p>
          <div style={{ height: '70px' }}></div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{signatureName || '.....................................'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="content" style={{ padding: '20px' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%;
          }
          .invitation-page {
            border: none !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>📋 Mẫu Giấy Mời</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={mode === 'setup' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode('setup')}
          >⚙️ Soạn thảo</button>
          <button
            className={mode === 'preview' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode('preview')}
          >👁️ Xem trước ({selectedList.length} hộ)</button>
          <button className="btn-primary" onClick={handlePrint} style={{ background: '#10b981' }}>
            🖨️ In {selectedList.length} giấy mời
          </button>
        </div>
      </div>

      {/* TAB */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {([['leader', 'Tổ dân phố'], ['party', 'Chi bộ Đảng'], ['front', 'Mặt trận Tổ quốc']] as const).map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab(id)}
          >{label}</button>
        ))}
      </div>

      {mode === 'setup' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Cột trái: Thông tin cuộc họp */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e40af' }}>📝 Thông tin cuộc họp</h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Nội dung cuộc họp / V/v:</label>
              <textarea
                value={meetingContent}
                onChange={e => setMeetingContent(e.target.value)}
                placeholder="VD: Tổng kết công tác tháng 7, bàn biện pháp vệ sinh môi trường..."
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', resize: 'vertical', minHeight: '70px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Giờ họp:</label>
                <input
                  value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)}
                  placeholder="VD: 19:00"
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Ngày:</label>
                <input
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  placeholder={String(currentDay)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Tháng:</label>
                <input
                  value={meetingMonth}
                  onChange={e => setMeetingMonth(e.target.value)}
                  placeholder={String(currentMonth)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Địa điểm:</label>
              <input
                value={meetingLocation}
                onChange={e => setMeetingLocation(e.target.value)}
                placeholder={`Nhà văn hóa ${rawTdpName}`}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#0369a1' }}>
              <strong>ℹ️ Thông tin tự động điền:</strong><br/>
              • Tên TDP: <strong>{tdpHeader}</strong><br/>
              • Tên Phường: <strong>{wardHeader}</strong><br/>
              • Tổ trưởng: <strong>{toTruongName || 'Chưa cài đặt'}</strong><br/>
              {activeTab === 'party' && <span>• Bí thư: <strong>{biThuName || 'Chưa cài đặt'}</strong><br/></span>}
              {activeTab === 'front' && <span>• Trưởng ban MTTQ: <strong>{matTranName || 'Chưa cài đặt'}</strong><br/></span>}
            </div>
          </div>

          {/* Cột phải: Danh sách hộ gia đình */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#1e40af' }}>🏠 Chọn hộ gia đình ({selectedHouseholds.size}/{households.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={selectAll} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', fontSize: '12px', cursor: 'pointer' }}>Chọn tất cả</button>
                <button onClick={clearAll} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>Bỏ chọn</button>
              </div>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>⏳ Đang tải danh sách hộ gia đình...</p>
            ) : households.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có hộ gia đình nào trong hệ thống.</p>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {households.map(h => (
                  <label key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: selectedHouseholds.has(h.id) ? '#eff6ff' : '#f8fafc',
                    border: selectedHouseholds.has(h.id) ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    transition: 'all 0.15s'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedHouseholds.has(h.id)}
                      onChange={() => toggleHousehold(h.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{h.headName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{h.address || 'Chưa có địa chỉ'} {h.household_number ? `· HK: ${h.household_number}` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PREVIEW / PRINT */
        <div>
          {selectedList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <p style={{ fontSize: '2rem' }}>📋</p>
              <p>Chưa chọn hộ gia đình nào. Vui lòng quay lại tab <strong>Soạn thảo</strong> để chọn.</p>
            </div>
          ) : (
            <div className="print-area">
              {selectedList.map((h, i) => renderSingleInvitation(h, i))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvitationTemplates;
