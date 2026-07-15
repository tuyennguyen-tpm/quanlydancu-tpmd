import React, { useState, useRef } from 'react';

const InvitationTemplates: React.FC = () => {
  const rawWardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
  const rawTdpName  = localStorage.getItem('tdp_name')  || 'Quảng Giao';
  const rawLeader   = localStorage.getItem('leader_name') || 'Nguyễn Viết Châu';

  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const yy  = String(now.getFullYear());

  const [recipientTitle, setRecipientTitle] = useState('hộ gia đình_ông, bà');
  const [meetingTime,    setMeetingTime]    = useState('20 h');
  const [meetingDay,     setMeetingDay]     = useState(dd);
  const [meetingMonth,   setMeetingMonth]   = useState(mm);
  const [meetingYear,    setMeetingYear]    = useState(yy);
  const [location, setLocation]             = useState('nhà VH Tổ dân phố việt trung cũ ,nay là tdp ,quảng giao.');
  const [content, setContent]               = useState('nghe công bố các quyết định của ĐẢNG UY ,HDND,UBND.UBMT TỔ QUỐC VN thành lập tổ dân phố mới và  thống nhất kế hoạch ,hoạt động của tdp trong thời gian tới .');
  const [closingNote, setClosingNote]       = useState('đây là hội nghị quan trọng và ý nghĩa vậy rất mong ông bà đến đúng giờ');
  const [signerTitle, setSignerTitle]       = useState('Tổ trưởng tdp');
  const [signerName, setSignerName]         = useState(rawLeader.toUpperCase());
  const [locationDate, setLocationDate]     = useState(`${rawWardName}, ngày ${dd}/${mm}/${yy}`);
  const [activeTab, setActiveTab]           = useState<'leader' | 'party' | 'front'>('leader');
  const [orientation, setOrientation]       = useState<'portrait' | 'landscape'>('portrait');
  const printRef                            = useRef<HTMLDivElement>(null);

  // A5 dimensions based on orientation
  const cardW = orientation === 'portrait' ? '148mm' : '210mm';
  const cardH = orientation === 'portrait' ? '210mm' : '148mm';
  const cardPad = orientation === 'portrait' ? '22mm 18mm 18mm' : '16mm 20mm 14mm';

  // ── Decorative green border frame ─────────────────────────────────
  const BorderFrame = () => (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      border: '7px solid #2d6a2d', borderRadius: '4px', boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'absolute', inset: '6px',
        border: '2px solid #2d6a2d', borderRadius: '2px', boxSizing: 'border-box'
      }} />
      {[
        { top: 0,    left: 0  } as React.CSSProperties,
        { top: 0,    right: 0 } as React.CSSProperties,
        { bottom: 0, left: 0  } as React.CSSProperties,
        { bottom: 0, right: 0 } as React.CSSProperties,
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#2d6a2d', fontSize: 26, lineHeight: 1
        }}>✿</div>
      ))}
      {/* top & bottom center ornament */}
      <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', color: '#2d6a2d', fontSize: 16 }}>⬦</div>
      <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', color: '#2d6a2d', fontSize: 16 }}>⬦</div>
    </div>
  );

  // ── Left org block (varies by tab) ────────────────────────────────
  const leftOrg = activeTab === 'party' ? (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>ĐẢNG BỘ {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>CHI BỘ {rawTdpName.toUpperCase()}</p>
    </>
  ) : activeTab === 'front' ? (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '9pt' }}>UBMTTQ VN {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '9pt' }}>BAN CÔNG TÁC MẶT TRẬN</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '9pt' }}>{rawTdpName.toUpperCase()}</p>
    </>
  ) : (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>UBND {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '10pt' }}>TỔ DÂN PHỐ {rawTdpName.toUpperCase()}</p>
    </>
  );

  // ── A5 card (dimensions depend on orientation) ───────────────────
  const InvitationCard = () => (
    <div style={{
      position: 'relative',
      width: cardW, minHeight: cardH,
      margin: '0 auto', background: 'white',
      padding: cardPad,
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: orientation === 'landscape' ? '10.5pt' : '11.5pt', lineHeight: 1.6,
      color: '#111', boxSizing: 'border-box',
    }}>
      <BorderFrame />

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ textAlign: 'center', width: '44%' }}>
          {leftOrg}
          <div style={{ width: '50px', borderBottom: '1px solid #111', margin: '3px auto 4px' }} />
          <p style={{ margin: 0, fontSize: '9pt' }}>Số: ...../GM-TDP</p>
        </div>
        <div style={{ textAlign: 'center', width: '52%' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '11pt' }}>
            {activeTab === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}
          </p>
          {activeTab !== 'party' && (
            <p style={{ margin: 0, fontWeight: 700, fontSize: '10.5pt', textDecoration: 'underline' }}>
              Độc lập – Tự do – <strong>Hạnh phúc</strong>
            </p>
          )}
          <div style={{ width: '120px', borderBottom: '1px solid #111', margin: '4px auto' }} />
        </div>
      </div>

      {/* TITLE */}
      <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '19pt', margin: '8px 0 10px', letterSpacing: '2px' }}>
        GIẤY MỜI
      </h1>

      {/* KÍNH GỬI */}
      <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
        Kính gửi :{' '}
        <span style={{ textDecoration: 'underline' }}>{recipientTitle}</span>
      </p>

      {/* BODY */}
      <p style={{ margin: '0 0 8px', textIndent: '1.5em', textAlign: 'justify' }}>
        Trân trọng: kính mời đại diện gia đình ,đến dự hội nghi họp tdp{' '}
        <span style={{ textDecoration: 'underline' }}>{rawTdpName}</span>,{' '}
        <span style={{ textDecoration: 'underline' }}>{rawWardName}</span>
      </p>

      <p style={{ margin: '0 0 5px' }}>
        <span style={{ textDecoration: 'underline' }}>Thời gian</span>{' '}
        <strong>{meetingTime}</strong> ngày <strong>{meetingDay}/{meetingMonth}/{meetingYear}</strong>
      </p>

      <p style={{ margin: '0 0 5px' }}>
        <span style={{ textDecoration: 'underline' }}>Địa điểm</span>:{' '}
        <span style={{ textDecoration: 'underline' }}>{location}</span>
      </p>

      <p style={{ margin: '0 0 5px' }}>
        <span style={{ textDecoration: 'underline' }}>Nội dung</span>{' '}
        <span style={{ textDecoration: 'underline' }}>{content}</span>
      </p>

      <p style={{ margin: '0 0 18px', textIndent: '1.5em', textAlign: 'justify' }}>
        <span style={{ textDecoration: 'underline' }}>{closingNote}</span>
      </p>

      {/* SIGNATURE */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', minWidth: '190px' }}>
          <p style={{ margin: '0 0 2px', fontStyle: 'italic' }}>{locationDate}</p>
          <p style={{ margin: '0 0 2px', fontWeight: 700 }}>{signerTitle}</p>
          <div style={{ height: '58px' }} />
          <p style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>{signerName}</p>
        </div>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="content" style={{ padding: '20px' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .inv-print-area, .inv-print-area * { visibility: visible !important; }
          @page { size: A5 ${orientation}; margin: 0; }
          .inv-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: ${orientation === 'portrait' ? '148mm' : '210mm'} !important;
          }
        }
        .inv-input {
          width: 100%; padding: 6px 10px; border-radius: 8px;
          border: 1px solid #e2e8f0; font-size: 13px;
          box-sizing: border-box; font-family: inherit;
          background: #fafafa;
        }
        .inv-input:focus {
          outline: none; border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
          background: white;
        }
        .inv-label {
          display: block; font-weight: 600;
          margin-bottom: 4px; font-size: 12px; color: #374151;
        }
      `}</style>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>📋 Mẫu Giấy Mời (A5)</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Orientation toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setOrientation('portrait')}
              title="In dọc (Portrait)"
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '12px', transition: 'all 0.15s',
                background: orientation === 'portrait' ? '#1e40af' : 'transparent',
                color: orientation === 'portrait' ? 'white' : '#64748b',
              }}
            >📄 In dọc</button>
            <button
              onClick={() => setOrientation('landscape')}
              title="In ngang (Landscape)"
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '12px', transition: 'all 0.15s',
                background: orientation === 'landscape' ? '#1e40af' : 'transparent',
                color: orientation === 'landscape' ? 'white' : '#64748b',
              }}
            >🖼️ In ngang</button>
          </div>
          {/* Print button */}
          <button
            onClick={() => window.print()}
            style={{
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: 'white', border: 'none',
              padding: '9px 22px', borderRadius: '8px',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
              transition: 'opacity 0.15s'
            }}
          >🖨️ In A5 ({orientation === 'portrait' ? 'Dọc' : 'Ngang'})</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {(['leader', 'party', 'front'] as const).map(id => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '7px 18px', borderRadius: '8px', fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', border: 'none',
            background: activeTab === id ? '#1e40af' : '#f1f5f9',
            color: activeTab === id ? 'white' : '#374151',
            boxShadow: activeTab === id ? '0 2px 8px rgba(30,64,175,0.25)' : 'none',
            transition: 'all 0.15s'
          }}>
            {id === 'leader' ? '🏘️ Tổ dân phố' : id === 'party' ? '🔴 Chi bộ Đảng' : '🟡 Mặt trận TQ'}
          </button>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* LEFT: Form */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 14px', color: '#1e40af', fontSize: '14px' }}>✏️ Soạn nội dung giấy mời</h3>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Kính gửi:</label>
            <input className="inv-input" value={recipientTitle}
              onChange={e => setRecipientTitle(e.target.value)}
              placeholder="VD: hộ gia đình_ông, bà" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '11px' }}>
            <div>
              <label className="inv-label">Giờ họp:</label>
              <input className="inv-input" value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)} placeholder="20 h" />
            </div>
            <div>
              <label className="inv-label">Ngày:</label>
              <input className="inv-input" value={meetingDay}
                onChange={e => setMeetingDay(e.target.value)} placeholder="17" />
            </div>
            <div>
              <label className="inv-label">Tháng/Năm:</label>
              <input className="inv-input"
                value={`${meetingMonth}/${meetingYear}`}
                onChange={e => {
                  const p = e.target.value.split('/');
                  setMeetingMonth(p[0] || '');
                  setMeetingYear(p[1] || '');
                }}
                placeholder="7/2026" />
            </div>
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Địa điểm:</label>
            <input className="inv-input" value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Nhà VH Tổ dân phố..." />
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Nội dung cuộc họp:</label>
            <textarea className="inv-input" value={content}
              onChange={e => setContent(e.target.value)}
              rows={4} style={{ resize: 'vertical' }}
              placeholder="Nội dung hội nghị..." />
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Lời kết (ghi chú cuối):</label>
            <textarea className="inv-input" value={closingNote}
              onChange={e => setClosingNote(e.target.value)}
              rows={2} style={{ resize: 'vertical' }}
              placeholder="VD: rất mong ông bà đến đúng giờ" />
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>✍️ Chữ ký</h4>
            <div style={{ marginBottom: '8px' }}>
              <label className="inv-label">Địa danh, ngày ký:</label>
              <input className="inv-input" value={locationDate}
                onChange={e => setLocationDate(e.target.value)}
                placeholder="Nam Sầm Sơn, ngày 17/7/2026" />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label className="inv-label">Chức danh người ký:</label>
              <input className="inv-input" value={signerTitle}
                onChange={e => setSignerTitle(e.target.value)}
                placeholder="Tổ trưởng tdp" />
            </div>
            <div>
              <label className="inv-label">Họ và tên (in hoa):</label>
              <input className="inv-input" value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="NGUYỄN VIẾT CHÂU" />
            </div>
          </div>

          <div style={{ marginTop: '14px', background: '#f0f9ff', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#0369a1' }}>
            <strong>ℹ️ Thông tin từ cài đặt:</strong><br />
            • TDP: <strong>{rawTdpName}</strong><br />
            • Phường: <strong>{rawWardName}</strong><br />
            • Tổ trưởng: <strong>{rawLeader}</strong>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div>
          <div style={{
            background: '#f1f5f9', borderRadius: '14px',
            padding: '28px', display: 'flex', justifyContent: 'center',
            minHeight: '400px'
          }}>
            <div className="inv-print-area" ref={printRef}>
              <InvitationCard />
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
            Xem trước – nhấn <strong>🖨️ In Giấy Mời (A5)</strong> để in
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvitationTemplates;
