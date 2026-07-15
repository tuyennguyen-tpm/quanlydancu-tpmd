import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import type { Household, Resident } from '../types';
import { Search, Filter, Users } from 'lucide-react';

const InvitationTemplates: React.FC = () => {
  const rawWardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
  const rawTdpName  = localStorage.getItem('tdp_name')  || 'Quảng Giao';
  const rawLeader   = localStorage.getItem('leader_name') || 'Nguyễn Viết Châu';

  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const yy  = String(now.getFullYear());

  const [invitationNumber, setInvitationNumber] = useState('');
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

  // Database loading states
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedHhIds, setSelectedHhIds] = useState<Set<string>>(new Set());
  const [previewHhId, setPreviewHhId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [recipientPattern, setRecipientPattern] = useState('Đại diện hộ gia đình ông/bà {ten_chu_ho}');

  const [groups, setGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('tdp_groups_config');
    return saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  });

  useEffect(() => {
    const handleGroupsChange = () => {
      const saved = localStorage.getItem('tdp_groups_config');
      setGroups(saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9']);
    };
    window.addEventListener('tdp-groups-changed', handleGroupsChange);
    return () => window.removeEventListener('tdp-groups-changed', handleGroupsChange);
  }, []);

  const loadData = async () => {
    try {
      const [hList, rList] = await Promise.all([
        db.getHouseholds(),
        db.getResidents()
      ]);
      setHouseholds(hList);
      setResidents(rList);
    } catch (e) {
      console.error('Lỗi tải dữ liệu cho giấy mời:', e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, []);

  const householdHeadNameMap = useMemo(() => {
    const resMap = new Map<string, Resident>();
    residents.forEach(r => {
      resMap.set(r.id, r);
    });

    const hhHeadMap = new Map<string, Resident>();
    residents.forEach(r => {
      if (r.is_head) {
        hhHeadMap.set(r.household_id, r);
      }
    });

    const nameMap = new Map<string, string>();
    households.forEach(h => {
      let head = h.head_of_household_id ? resMap.get(h.head_of_household_id) : undefined;
      if (!head) {
        head = hhHeadMap.get(h.id);
      }
      if (head) {
        const name = head.status === 'deceased' ? `${head.full_name} (Đã mất)` : head.full_name;
        nameMap.set(h.id, name);
      } else {
        nameMap.set(h.id, 'Chưa xác định');
      }
    });
    return nameMap;
  }, [households, residents]);

  const getHeadName = (h: Household) => {
    return householdHeadNameMap.get(h.id) || 'Chưa xác định';
  };

  const filteredHouseholds = useMemo(() => {
    return households.filter(h => {
      const headName = getHeadName(h).toLowerCase();
      const address = h.address.toLowerCase();
      const query = searchInput.toLowerCase();
      const matchesSearch = headName.includes(query) || address.includes(query) || h.household_number.toLowerCase().includes(query);
      
      const matchesGroup = groupFilter === 'all' || h.self_management_group === groupFilter;
      return matchesSearch && matchesGroup;
    }).sort((a, b) => {
      const numA = parseInt(a.household_number.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.household_number.replace(/\D/g, '') || '0', 10);
      if (numA !== numB) return numA - numB;
      return a.id.localeCompare(b.id);
    });
  }, [households, householdHeadNameMap, searchInput, groupFilter]);

  useEffect(() => {
    if (filteredHouseholds.length > 0) {
      if (!previewHhId || !filteredHouseholds.some(h => h.id === previewHhId)) {
        setPreviewHhId(filteredHouseholds[0].id);
      }
    } else {
      setPreviewHhId(null);
    }
  }, [filteredHouseholds, previewHhId]);

  const getRecipientName = (h: Household) => {
    const name = getHeadName(h);
    return recipientPattern.replace(/{ten_chu_ho}/g, name);
  };

  const selectedHhList = useMemo(() => {
    return households.filter(h => selectedHhIds.has(h.id));
  }, [households, selectedHhIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedHhIds);
      filteredHouseholds.forEach(h => newSelected.add(h.id));
      setSelectedHhIds(newSelected);
    } else {
      const newSelected = new Set(selectedHhIds);
      filteredHouseholds.forEach(h => newSelected.delete(h.id));
      setSelectedHhIds(newSelected);
    }
  };

  const handleToggleHh = (id: string) => {
    const newSelected = new Set(selectedHhIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedHhIds(newSelected);
  };

  const handleRowClick = (id: string) => {
    setPreviewHhId(id);
  };

  const previewHh = useMemo(() => {
    return households.find(h => h.id === previewHhId) || null;
  }, [households, previewHhId]);

  // Synchronize recipientTitle with the resolved name of the preview household
  useEffect(() => {
    if (previewHh) {
      setRecipientTitle(getRecipientName(previewHh));
    } else {
      setRecipientTitle('hộ gia đình_ông, bà');
    }
  }, [previewHhId, recipientPattern]);

  const getHouseholdsToPrint = () => {
    return selectedHhList;
  };

  // A5 dimensions based on orientation
  const cardW = orientation === 'portrait' ? '148mm' : '210mm';
  const cardH = orientation === 'portrait' ? '210mm' : '148mm';
  const cardPad = orientation === 'portrait' ? '22mm 18mm 18mm' : '10mm 15mm 10mm';
  const isLandscape = orientation === 'landscape';

  // ── Decorative green border frame ─────────────────────────────────
  const BorderFrame = () => (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      border: isLandscape ? '5px solid #2d6a2d' : '7px solid #2d6a2d', 
      borderRadius: '4px', boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'absolute', inset: isLandscape ? '4px' : '6px',
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
          width: isLandscape ? 30 : 38, height: isLandscape ? 30 : 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#2d6a2d', fontSize: isLandscape ? 20 : 26, lineHeight: 1
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
      <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '9pt' : '10pt' }}>ĐẢNG BỘ {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '9pt' : '10pt' }}>CHI BỘ {rawTdpName.toUpperCase()}</p>
    </>
  ) : activeTab === 'front' ? (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '8.5pt' }}>UBMTTQ VN {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '8.5pt' }}>BAN CÔNG TÁC MẶT TRẬN</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '8.5pt' }}>{rawTdpName.toUpperCase()}</p>
    </>
  ) : (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '9pt' : '10pt' }}>UBND {rawWardName.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '9pt' : '10pt' }}>TỔ DÂN PHỐ {rawTdpName.toUpperCase()}</p>
    </>
  );

  // ── A5 card (dimensions depend on orientation) ───────────────────
  const InvitationCard = ({ recipient }: { recipient: string }) => (
    <div style={{
      position: 'relative',
      width: cardW, 
      height: cardH, // fixed height for printing to prevent overflow
      margin: '0 auto', background: 'white',
      padding: cardPad,
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: isLandscape ? '9.5pt' : '11.5pt', 
      lineHeight: isLandscape ? 1.45 : 1.6,
      color: '#111', boxSizing: 'border-box',
      overflow: 'hidden' // hide overflow during print preview
    }}>
      <BorderFrame />

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isLandscape ? '8px' : '14px' }}>
        <div style={{ textAlign: 'center', width: '44%' }}>
          {leftOrg}
          <div style={{ width: '50px', borderBottom: '1px solid #111', margin: '3px auto 4px' }} />
          <p style={{ margin: 0, fontSize: '8.5pt' }}>Số: {invitationNumber || '.....'}/GM-TDP</p>
        </div>
        <div style={{ textAlign: 'center', width: '52%' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '10pt' : '11pt' }}>
            {activeTab === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}
          </p>
          {activeTab !== 'party' && (
            <p style={{ margin: 0, fontWeight: 700, fontSize: isLandscape ? '9.5pt' : '10.5pt', textDecoration: 'underline' }}>
              Độc lập – Tự do – <strong>Hạnh phúc</strong>
            </p>
          )}
          <div style={{ width: '120px', borderBottom: '1px solid #111', margin: '4px auto' }} />
        </div>
      </div>

      {/* TITLE */}
      <h1 style={{ 
        textAlign: 'center', fontWeight: 700, 
        fontSize: isLandscape ? '16pt' : '19pt', 
        margin: isLandscape ? '4px 0 6px' : '8px 0 10px', 
        letterSpacing: '2px' 
      }}>
        GIẤY MỜI
      </h1>

      {/* KÍNH GỬI */}
      <p style={{ margin: isLandscape ? '0 0 6px' : '0 0 8px', fontWeight: 700 }}>
        Kính gửi :{' '}
        <span style={{ textDecoration: 'underline' }}>{recipient}</span>
      </p>

      {/* BODY */}
      <p style={{ margin: isLandscape ? '0 0 6px' : '0 0 8px', textIndent: '1.5em', textAlign: 'justify' }}>
        Trân trọng: kính mời đại diện gia đình ,đến dự hội nghi họp tdp{' '}
        <span style={{ textDecoration: 'underline' }}>{rawTdpName}</span>,{' '}
        <span style={{ textDecoration: 'underline' }}>{rawWardName}</span>
      </p>

      <p style={{ margin: '0 0 4px' }}>
        <span style={{ textDecoration: 'underline' }}>Thời gian</span>{' '}
        <strong>{meetingTime}</strong> ngày <strong>{meetingDay}/{meetingMonth}/{meetingYear}</strong>
      </p>

      <p style={{ margin: '0 0 4px' }}>
        <span style={{ textDecoration: 'underline' }}>Địa điểm</span>:{' '}
        <span style={{ textDecoration: 'underline' }}>{location}</span>
      </p>

      <p style={{ margin: '0 0 4px' }}>
        <span style={{ textDecoration: 'underline' }}>Nội dung</span>{' '}
        <span style={{ textDecoration: 'underline' }}>{content}</span>
      </p>

      <p style={{ margin: isLandscape ? '0 0 10px' : '0 0 18px', textIndent: '1.5em', textAlign: 'justify' }}>
        <span style={{ textDecoration: 'underline' }}>{closingNote}</span>
      </p>

      {/* SIGNATURE */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: isLandscape ? '2px' : '0' }}>
        <div style={{ textAlign: 'center', minWidth: '190px' }}>
          <p style={{ margin: '0 0 2px', fontStyle: 'italic', fontSize: isLandscape ? '8.5pt' : '9.5pt' }}>{locationDate}</p>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: isLandscape ? '9.5pt' : '10.5pt' }}>{signerTitle}</p>
          <div style={{ height: isLandscape ? '32px' : '58px' }} />
          <p style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: isLandscape ? '9.5pt' : '10.5pt' }}>{signerName}</p>
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
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: ${orientation === 'portrait' ? '148mm' : '210mm'} !important;
            display: block !important;
          }
          .print-card-wrapper {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card-wrapper:last-child {
            page-break-after: avoid !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        .main-grid {
          display: grid;
          grid-template-columns: 320px 340px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .main-grid {
            grid-template-columns: 1fr;
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
          >🖨️ {selectedHhList.length > 0 ? `In hàng loạt (${selectedHhList.length} bản)` : 'In giấy mời'} ({orientation === 'portrait' ? 'Dọc' : 'Ngang'})</button>
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
      <div className="main-grid">

        {/* LEFT COLUMN: Household Checklist & Filters */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, color: '#1e40af', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} /> Danh sách chủ hộ
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              {filteredHouseholds.length} hộ
            </span>
          </div>

          {/* Group Filter */}
          <div>
            <label className="inv-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Lọc theo Tổ:
            </label>
            <select
              className="inv-input"
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="all">── Tất cả các tổ ──</option>
              {groups.map((g, i) => (
                <option key={i} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <div>
            <label className="inv-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Tìm chủ hộ / địa chỉ:
            </label>
            <input
              className="inv-input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Nhập tên chủ hộ, số hộ khẩu..."
            />
          </div>

          {/* Checklist Select All */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              <input
                type="checkbox"
                checked={filteredHouseholds.length > 0 && filteredHouseholds.every(h => selectedHhIds.has(h.id))}
                onChange={e => handleSelectAll(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Chọn tất cả
            </label>
            <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700 }}>
              Đã chọn: {selectedHhList.length}
            </span>
          </div>

          {/* Scrollable list */}
          <div style={{
            maxHeight: '380px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px',
            scrollbarWidth: 'thin'
          }}>
            {filteredHouseholds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                Không tìm thấy hộ dân nào
              </div>
            ) : (
              filteredHouseholds.map(h => {
                const isSelected = selectedHhIds.has(h.id);
                const isPreview = h.id === previewHhId;
                const headName = getHeadName(h);
                return (
                  <div
                    key={h.id}
                    onClick={() => handleRowClick(h.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isPreview ? '#3b82f6' : '#e2e8f0',
                      background: isPreview ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={e => e.stopPropagation()}
                      onChange={() => handleToggleHh(h.id)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: isPreview ? '#1d4ed8' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {headName}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
                          {h.household_number}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        📍 {h.address.replace(', Nam Sầm Sơn, Thanh Hóa', '')}
                      </div>
                      {h.self_management_group && (
                        <div style={{ display: 'inline-block', fontSize: '9px', background: isPreview ? '#dbeafe' : '#f1f5f9', color: isPreview ? '#1e40af' : '#475569', padding: '1px 5px', borderRadius: '4px', marginTop: '4px', fontWeight: 600 }}>
                          👥 {h.self_management_group}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Form */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 14px', color: '#1e40af', fontSize: '14px' }}>✏️ Soạn nội dung giấy mời</h3>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Số giấy mời (Số: __/GM-TDP):</label>
            <input className="inv-input" value={invitationNumber}
              onChange={e => setInvitationNumber(e.target.value)}
              placeholder="VD: 01, 15, 28..." />
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Định dạng kính gửi tự động (dùng &#123;ten_chu_ho&#125;):</label>
            <input className="inv-input" value={recipientPattern}
              onChange={e => setRecipientPattern(e.target.value)}
              placeholder="VD: Đại diện hộ gia đình ông/bà {ten_chu_ho}" />
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label className="inv-label">Người nhận (Kính gửi):</label>
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

        {/* RIGHT COLUMN: Preview & Printing */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div style={{
            background: '#f1f5f9', borderRadius: '14px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
            minHeight: '400px', border: '1px solid #e2e8f0'
          }}>
            {/* Preview Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
              <div style={{ color: '#475569', fontWeight: 600 }}>
                {previewHh ? (
                  <span>👁️ Xem trước: <strong style={{ color: '#1e40af' }}>{getHeadName(previewHh)}</strong></span>
                ) : (
                  <span>👁️ Xem trước bản mẫu thủ công</span>
                )}
              </div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>
                Tổng in: <strong>{getHouseholdsToPrint().length > 0 ? `${getHouseholdsToPrint().length} hộ` : '1 bản'}</strong>
              </div>
            </div>

            {/* Screen Preview */}
            <div className="screen-only" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <InvitationCard recipient={recipientTitle} />
            </div>

            {/* Print-only Batch Container */}
            <div className="inv-print-area print-only" ref={printRef}>
              {getHouseholdsToPrint().length > 0 ? (
                getHouseholdsToPrint().map(h => (
                  <div key={h.id} className="print-card-wrapper">
                    <InvitationCard recipient={getRecipientName(h)} />
                  </div>
                ))
              ) : (
                <div className="print-card-wrapper">
                  <InvitationCard recipient={recipientTitle} />
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: '12px', background: '#fffbeb', borderRadius: '10px', padding: '12px', fontSize: '11.5px', color: '#b45309', border: '1px solid #fef3c7', lineHeight: 1.5 }}>
            <strong>💡 Mẹo in đẹp không bị tràn trang:</strong><br />
            1. Khi bảng in hiện ra, chọn đúng khổ giấy <strong>A5</strong>.<br />
            2. Chọn hướng in phù hợp (<strong>Dọc</strong> hoặc <strong>Ngang</strong>) giống như nút bạn vừa chọn ở trên.<br />
            3. Tắt mục <strong>"Tiêu đề đầu trang và chân trang"</strong> (Headers & Footers).<br />
            4. Đặt mục <strong>"Lề" (Margins)</strong> thành <strong>"Không có" (None)</strong> để viền xanh được in khít trang và không bị nhảy sang trang 2.
          </div>
        </div>

      </div>
    </div>
  );
};

export default InvitationTemplates;
