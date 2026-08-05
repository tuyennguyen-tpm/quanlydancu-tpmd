import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import type { Household, Resident } from '../types';
import { Search, Filter, Users, Sparkles } from 'lucide-react';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { parseInvitationFromSpeech } from '../services/ai';
import { showToast } from '../utils/toast';


const InvitationTemplates: React.FC = () => {
  const rawWardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
  const rawTdpName  = localStorage.getItem('tdp_name')  || 'Quảng Giao';
  const rawLeader   = localStorage.getItem('leader_name') || 'Nguyễn Viết Châu';

  // Format TDP and Ward names nicely to have diacritics and spaces
  const formatTdpName = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '');
    if (clean === 'tdpquanggiao' || clean === 'quanggiao') {
      return 'Quảng Giao';
    }
    return name;
  };

  const formatWardName = (name: string) => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '');
    if (clean === 'namsamson' || clean === 'phuongnamsamson') {
      return 'Phường Nam Sầm Sơn';
    }
    return name;
  };

  const tdpNameFormatted = formatTdpName(rawTdpName);
  const wardNameFormatted = formatWardName(rawWardName);

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
  const [location, setLocation]             = useState(`nhà VH Tổ dân phố việt trung cũ ,nay là tdp ,${tdpNameFormatted.toLowerCase()}.`);
  const [content, setContent]               = useState('nghe công bố các quyết định của ĐẢNG UY ,HDND,UBND.UBMT TỔ QUỐC VN thành lập tổ dân phố mới và  thống nhất kế hoạch ,hoạt động của tdp trong thời gian tới .');
  const [closingNote, setClosingNote]       = useState('đây là hội nghị quan trọng và ý nghĩa vậy rất mong ông bà đến đúng giờ');
  const [signerTitle, setSignerTitle]       = useState('Tổ trưởng tdp');
  const [signerName, setSignerName]         = useState(rawLeader.toUpperCase());
  const [locationDate, setLocationDate]     = useState(`${wardNameFormatted.replace('Phường ', '')}, ngày ${dd}/${mm}/${yy}`);
  const [activeTab, setActiveTab]           = useState<'leader' | 'party' | 'front'>('leader');
  const [orientation, setOrientation]       = useState<'portrait' | 'landscape'>('portrait');
  const [paperSize, setPaperSize]           = useState<'a5_half' | 'a4_full'>('a5_half');
  const printRef                            = useRef<HTMLDivElement>(null);

  // Database loading states
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedHhIds, setSelectedHhIds] = useState<Set<string>>(new Set());
  const [previewHhId, setPreviewHhId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [recipientPattern, setRecipientPattern] = useState('Đại diện hộ gia đình ông/bà {ten_chu_ho}');
  const [showBorder, setShowBorder] = useState(true);
  const [showLeftHeader, setShowLeftHeader] = useState(true);

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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!');
      return;
    }

    const cardsToPrint = getHouseholdsToPrint();
    const isLandscape = orientation === 'landscape';
    const isA4 = paperSize === 'a4_full';

    // Generate HTML for each invitation card
    let cardsHtml = '';
    
    const renderCardHtml = (recipientName: string) => {
      const leftOrgFontSize = isA4 ? (isLandscape ? '12.5pt' : '14pt') : (isLandscape ? '10.5pt' : '11.5pt');
      const docTitleFontSize = isA4 ? (isLandscape ? '13pt' : '14.5pt') : (isLandscape ? '11pt' : '11.5pt');
      const docSubtitleFontSize = isA4 ? (isLandscape ? '12.5pt' : '14pt') : (isLandscape ? '10.5pt' : '11.5pt');
      const titleFontSize = isA4 ? (isLandscape ? '28pt' : '34pt') : (isLandscape ? '22pt' : '26pt');
      const bodyMarginBottom = isA4 ? '10px' : (isLandscape ? '6px' : '8px');
      const closingMarginBottom = isA4 ? (isLandscape ? '18px' : '28px') : (isLandscape ? '10px' : '18px');
      const signatureMarginTop = isA4 ? (isLandscape ? '15px' : '35px') : (isLandscape ? '2px' : '0');
      const signerTitleFontSize = isA4 ? (isLandscape ? '13.5pt' : '15pt') : (isLandscape ? '12pt' : '13.5pt');
      const locationDateFontSize = isA4 ? (isLandscape ? '12.5pt' : '13.5pt') : (isLandscape ? '11pt' : '12pt');
      
      const borderWidth = isA4 ? (isLandscape ? '7px solid #2d6a2d' : '9px solid #2d6a2d') : (isLandscape ? '5px solid #2d6a2d' : '7px solid #2d6a2d');
      const borderInset = isA4 ? (isLandscape ? '6px' : '8px') : (isLandscape ? '4px' : '6px');
      const flowerSize = isA4 ? (isLandscape ? '38px' : '46px') : (isLandscape ? '30px' : '38px');
      const flowerFontSize = isA4 ? (isLandscape ? '26px' : '32px') : (isLandscape ? '20px' : '26px');

      const leftOrgHtml = activeTab === 'party' ? `
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">ĐẢNG BỘ ${rawWardName.toUpperCase()}</p>
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">CHI BỘ ${rawTdpName.toUpperCase()}</p>
      ` : activeTab === 'front' ? `
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">UBMTTQ VN ${rawWardName.toUpperCase()}</p>
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">BAN CÔNG TÁC MẶT TRẬN</p>
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">${rawTdpName.toUpperCase()}</p>
      ` : `
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">UBND ${rawWardName.toUpperCase()}</p>
        <p style="margin: 0; font-weight: 700; font-size: ${leftOrgFontSize}; white-space: nowrap;">TỔ DÂN PHỐ ${rawTdpName.toUpperCase()}</p>
      `;

      const docTitle = activeTab === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      const docSubtitleHtml = activeTab !== 'party' ? `
        <p style="margin: 0; font-weight: 700; font-size: ${docSubtitleFontSize}; text-decoration: underline; white-space: nowrap;">
          Độc lập – Tự do – Hạnh phúc
        </p>
      ` : '';

      return `
        <div class="card-body">
          ${showBorder ? `
          <!-- Border Frame -->
          <div class="border-frame" style="position: absolute; inset: 0; pointer-events: none; border: ${borderWidth}; border-radius: 4px; box-sizing: border-box;">
            <div class="border-frame-inner" style="position: absolute; inset: ${borderInset}; border: 2px solid #2d6a2d; border-radius: 2px; box-sizing: border-box;"></div>
            <div class="corner-flower" style="position: absolute; top: 0; left: 0; width: ${flowerSize}; height: ${flowerSize}; display: flex; align-items: center; justify-content: center; color: #2d6a2d; font-size: ${flowerFontSize}; line-height: 1;">✿</div>
            <div class="corner-flower" style="position: absolute; top: 0; right: 0; width: ${flowerSize}; height: ${flowerSize}; display: flex; align-items: center; justify-content: center; color: #2d6a2d; font-size: ${flowerFontSize}; line-height: 1;">✿</div>
            <div class="corner-flower" style="position: absolute; bottom: 0; left: 0; width: ${flowerSize}; height: ${flowerSize}; display: flex; align-items: center; justify-content: center; color: #2d6a2d; font-size: ${flowerFontSize}; line-height: 1;">✿</div>
            <div class="corner-flower" style="position: absolute; bottom: 0; right: 0; width: ${flowerSize}; height: ${flowerSize}; display: flex; align-items: center; justify-content: center; color: #2d6a2d; font-size: ${flowerFontSize}; line-height: 1;">✿</div>
            <div class="top-center-ornament" style="position: absolute; top: -3px; left: 50%; transform: translateX(-50%); color: #2d6a2d; font-size: 16px;">⬦</div>
            <div class="bottom-center-ornament" style="position: absolute; bottom: -3px; left: 50%; transform: translateX(-50%); color: #2d6a2d; font-size: 16px;">⬦</div>
          </div>
          ` : ''}

          <!-- Header -->
          ${showLeftHeader ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: ${isA4 ? (isLandscape ? '14px' : '22px') : (isLandscape ? '8px' : '14px')}; flex-wrap: nowrap;">
            <div style="text-align: center; width: 38%; flex-shrink: 0;">
              ${leftOrgHtml}
              <div style="width: 60px; border-bottom: 1px solid #111; margin: 4px auto 6px;"></div>
              <p style="margin: 0; font-size: ${isA4 ? '12.5pt' : '10.5pt'}; white-space: nowrap;">Số: ${invitationNumber || '.....'}/GM-TDP</p>
            </div>
            <div style="text-align: center; width: 60%; flex-shrink: 0;">
              <p style="margin: 0; font-weight: 700; font-size: ${docTitleFontSize}; white-space: nowrap;">
                ${docTitle}
              </p>
              ${docSubtitleHtml}
              <div style="width: 140px; border-bottom: 1px solid #111; margin: 6px auto;"></div>
            </div>
          </div>
          ` : `
          <div style="text-align: center; margin-bottom: ${isA4 ? '20px' : (isLandscape ? '10px' : '16px')}; width: 100%;">
            <p style="margin: 0; font-weight: 700; font-size: ${docTitleFontSize}; white-space: nowrap;">
              ${docTitle}
            </p>
            ${activeTab !== 'party' ? `
              <p style="margin: 3px 0 0; font-weight: 700; font-size: ${docSubtitleFontSize}; text-decoration: underline; white-space: nowrap;">
                Độc lập – Tự do – Hạnh phúc
              </p>
            ` : ''}
            <div style="width: 160px; border-bottom: 1px solid #111; margin: 8px auto 0;"></div>
          </div>
          `}

          <!-- Title -->
          <h1 style="text-align: center; font-weight: 700; font-size: ${titleFontSize}; margin: ${isA4 ? (isLandscape ? '10px 0 14px' : '16px 0 20px') : (isLandscape ? '4px 0 6px' : '8px 0 10px')}; letter-spacing: 3px;">
            GIẤY MỜI
          </h1>

          <!-- Kính gửi -->
          <p style="margin: 0 0 ${bodyMarginBottom}; font-weight: 700;">
            Kính gửi : <span style="text-decoration: underline;">${recipientName}</span>
          </p>

          <!-- Body -->
          <p style="margin: 0 0 ${bodyMarginBottom}; text-indent: 1.5em; text-align: justify;">
            Trân trọng: kính mời đại diện gia đình ,đến dự hội nghi họp tdp <span style="text-decoration: underline;">${tdpNameFormatted}</span>, <span style="text-decoration: underline;">${wardNameFormatted}</span>
          </p>

          <p style="margin: 0 0 ${isA4 ? '8px' : '4px'};">
            <span style="text-decoration: underline;">Thời gian</span> <strong>${meetingTime}</strong> ngày <strong>${meetingDay}/${meetingMonth}/${meetingYear}</strong>
          </p>

          <p style="margin: 0 0 ${isA4 ? '8px' : '4px'};">
            <span style="text-decoration: underline;">Địa điểm</span>: <span style="text-decoration: underline;">${location}</span>
          </p>

          <p style="margin: 0 0 ${isA4 ? '8px' : '4px'};">
            <span style="text-decoration: underline;">Nội dung</span>: <span style="text-decoration: underline; white-space: pre-wrap;">${content}</span>
          </p>

          <p style="margin: 0 0 ${closingMarginBottom}; text-indent: 1.5em; text-align: justify; white-space: pre-wrap;">
            <span style="text-decoration: underline;">${closingNote}</span>
          </p>

          <!-- Signature -->
          <div style="display: flex; justify-content: flex-end; margin-top: ${signatureMarginTop};">
            <div style="text-align: center; min-width: 220px;">
              <p style="margin: 0 0 4px; font-style: italic; font-size: ${locationDateFontSize};">${locationDate}</p>
              <p style="margin: 0 0 4px; font-weight: 700; font-size: ${signerTitleFontSize};">${signerTitle}</p>
              <div style="height: ${isA4 ? (isLandscape ? '35px' : '50px') : (isLandscape ? '20px' : '30px')};"></div>
              <p style="margin: 0; font-weight: 700; text-transform: uppercase; font-size: ${signerTitleFontSize};">${signerName}</p>
            </div>
          </div>
        </div>
      `;
    };

    if (isA4) {
      const list = cardsToPrint.length > 0 ? cardsToPrint : [null];
      cardsHtml = list.map(h => {
        const name = h ? getRecipientName(h) : recipientTitle;
        return `
          <div class="a4-page-wrapper">
            ${renderCardHtml(name)}
          </div>
        `;
      }).join('');
    } else {
      const pairs: { card1: string; card2?: string }[] = [];
      for (let i = 0; i < cardsToPrint.length; i += 2) {
        pairs.push({
          card1: getRecipientName(cardsToPrint[i]),
          card2: cardsToPrint[i + 1] ? getRecipientName(cardsToPrint[i + 1]) : undefined
        });
      }

      if (cardsToPrint.length === 0) {
        pairs.push({ card1: recipientTitle });
      }

      cardsHtml = pairs.map(pair => {
        const secondCardHtml = pair.card2 
          ? renderCardHtml(pair.card2) 
          : `<div style="width: ${isLandscape ? '210mm' : '148mm'}; height: ${isLandscape ? '148mm' : '210mm'}; flex-shrink: 0;"></div>`;
          
        const secondCardStyled = pair.card2 
          ? secondCardHtml.replace('class="card-body"', `class="card-body" style="${isLandscape ? 'border-top: 1px dashed #cbd5e1;' : 'border-left: 1px dashed #cbd5e1;'}"`)
          : secondCardHtml;

        return `
          <div class="a4-page-wrapper">
            ${renderCardHtml(pair.card1)}
            ${secondCardStyled}
          </div>
        `;
      }).join('');
    }

    const pageCssSize = isA4
      ? (isLandscape ? 'A4 landscape' : 'A4 portrait')
      : (isLandscape ? 'A4 portrait' : 'A4 landscape');

    const wrapperWidth = isA4
      ? (isLandscape ? '297mm' : '210mm')
      : (isLandscape ? '210mm' : '297mm');

    const wrapperHeight = isA4
      ? (isLandscape ? '210mm' : '297mm')
      : (isLandscape ? '297mm' : '210mm');

    const wrapperFlexDirection = isA4
      ? 'column'
      : (isLandscape ? 'column' : 'row');

    const cardWidth = isA4
      ? (isLandscape ? '297mm' : '210mm')
      : (isLandscape ? '210mm' : '148mm');

    const cardHeight = isA4
      ? (isLandscape ? '210mm' : '297mm')
      : (isLandscape ? '148mm' : '210mm');

    const cardPadding = isA4
      ? (isLandscape ? '14mm 22mm 14mm' : '18mm 25mm 18mm')
      : (isLandscape ? '8mm 15mm 8mm' : '10mm 15mm 10mm');

    const cardFontSize = isA4
      ? (isLandscape ? '15pt' : '17pt')
      : (isLandscape ? '13pt' : '14.5pt');

    const cardLineHeight = isA4
      ? '1.55'
      : (isLandscape ? '1.4' : '1.45');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Giấy Mời</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: ${pageCssSize};
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .a4-page-wrapper {
            width: ${wrapperWidth};
            height: ${wrapperHeight};
            box-sizing: border-box;
            position: relative;
            page-break-after: always;
            page-break-inside: avoid;
            margin: 0 auto;
            overflow: hidden;
            background: white;
            display: flex;
            flex-direction: ${wrapperFlexDirection};
            gap: 0;
          }
          .a4-page-wrapper:last-child {
            page-break-after: avoid;
          }
          
          /* Card inner styles */
          .card-body {
            position: relative;
            width: ${cardWidth};
            height: ${cardHeight};
            padding: ${cardPadding};
            font-family: "Times New Roman", Times, serif;
            font-size: ${cardFontSize};
            line-height: ${cardLineHeight};
            color: #111;
            box-sizing: border-box;
            background: white;
            flex-shrink: 0;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const isA4 = paperSize === 'a4_full';
  const isLandscape = orientation === 'landscape';

  // Card dimensions based on paper size & orientation
  const cardW = isA4 
    ? (isLandscape ? '297mm' : '210mm') 
    : (isLandscape ? '210mm' : '148mm');
  const cardH = isA4 
    ? (isLandscape ? '210mm' : '297mm') 
    : (isLandscape ? '148mm' : '210mm');
  const cardPad = isA4 
    ? (isLandscape ? '14mm 22mm 14mm' : '18mm 25mm 18mm') 
    : (isLandscape ? '8mm 15mm 8mm' : '10mm 15mm 10mm');

  // ── Decorative green border frame ─────────────────────────────────
  const BorderFrame = () => {
    const borderWidth = isA4 ? (isLandscape ? '7px solid #2d6a2d' : '9px solid #2d6a2d') : (isLandscape ? '5px solid #2d6a2d' : '7px solid #2d6a2d');
    const borderInset = isA4 ? (isLandscape ? '6px' : '8px') : (isLandscape ? '4px' : '6px');
    const flowerSize = isA4 ? (isLandscape ? 38 : 46) : (isLandscape ? 30 : 38);
    const flowerFontSize = isA4 ? (isLandscape ? 26 : 32) : (isLandscape ? 20 : 26);

    return (
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        border: borderWidth, borderRadius: '4px', boxSizing: 'border-box'
      }}>
        <div style={{
          position: 'absolute', inset: borderInset,
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
            width: flowerSize, height: flowerSize,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2d6a2d', fontSize: flowerFontSize, lineHeight: 1
          }}>✿</div>
        ))}
        {/* top & bottom center ornament */}
        <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', color: '#2d6a2d', fontSize: isA4 ? 20 : 16 }}>⬦</div>
        <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', color: '#2d6a2d', fontSize: isA4 ? 20 : 16 }}>⬦</div>
      </div>
    );
  };

  // ── Left org block (varies by tab) ────────────────────────────────
  const leftOrgFontSize = isA4 ? (isLandscape ? '12.5pt' : '14pt') : (isLandscape ? '10.5pt' : '11.5pt');
  const leftOrg = activeTab === 'party' ? (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>ĐẢNG BỘ {wardNameFormatted.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>CHI BỘ {tdpNameFormatted.toUpperCase()}</p>
    </>
  ) : activeTab === 'front' ? (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>UBMTTQ VN {wardNameFormatted.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>BAN CÔNG TÁC MẶT TRẬN</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>{tdpNameFormatted.toUpperCase()}</p>
    </>
  ) : (
    <>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>UBND {wardNameFormatted.toUpperCase()}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: leftOrgFontSize, whiteSpace: 'nowrap' }}>TỔ DÂN PHỐ {tdpNameFormatted.toUpperCase()}</p>
    </>
  );

  const docTitleFontSize = isA4 ? (isLandscape ? '13pt' : '14.5pt') : (isLandscape ? '11pt' : '11.5pt');
  const docSubtitleFontSize = isA4 ? (isLandscape ? '12.5pt' : '14pt') : (isLandscape ? '10.5pt' : '11.5pt');
  const titleFontSize = isA4 ? (isLandscape ? '28pt' : '34pt') : (isLandscape ? '22pt' : '26pt');
  const bodyMarginBottom = isA4 ? '10px' : (isLandscape ? '6px' : '6px');
  const closingMarginBottom = isA4 ? (isLandscape ? '18px' : '28px') : (isLandscape ? '0 0 6px' : '0 0 10px');
  const signatureMarginTop = isA4 ? (isLandscape ? '15px' : '35px') : (isLandscape ? '2px' : '0');
  const signerTitleFontSize = isA4 ? (isLandscape ? '13.5pt' : '15pt') : (isLandscape ? '12pt' : '13.5pt');
  const locationDateFontSize = isA4 ? (isLandscape ? '12.5pt' : '13.5pt') : (isLandscape ? '11pt' : '12pt');

  // ── Invitation Card Component ───────────────────
  const InvitationCard = ({ recipient }: { recipient: string }) => (
    <div style={{
      position: 'relative',
      width: cardW, 
      height: cardH,
      margin: '0 auto', background: 'white',
      padding: cardPad,
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: isA4 ? (isLandscape ? '15pt' : '17pt') : (isLandscape ? '13pt' : '14.5pt'), 
      lineHeight: isA4 ? 1.55 : (isLandscape ? 1.4 : 1.45),
      color: '#111', boxSizing: 'border-box',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {showBorder && <BorderFrame />}

      {/* HEADER */}
      {showLeftHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isA4 ? (isLandscape ? '14px' : '22px') : (isLandscape ? '8px' : '14px'), flexWrap: 'nowrap' }}>
          <div style={{ textAlign: 'center', width: '38%', flexShrink: 0 }}>
            {leftOrg}
            <div style={{ width: isA4 ? '60px' : '50px', borderBottom: '1px solid #111', margin: '3px auto 4px' }} />
            <p style={{ margin: 0, fontSize: isA4 ? '12.5pt' : '10.5pt', whiteSpace: 'nowrap' }}>Số: {invitationNumber || '.....'}/GM-TDP</p>
          </div>
          <div style={{ textAlign: 'center', width: '60%', flexShrink: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: docTitleFontSize, whiteSpace: 'nowrap' }}>
              {activeTab === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}
            </p>
            {activeTab !== 'party' && (
              <p style={{ margin: 0, fontWeight: 700, fontSize: docSubtitleFontSize, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                Độc lập – Tự do – <strong>Hạnh phúc</strong>
              </p>
            )}
            <div style={{ width: isA4 ? '140px' : '120px', borderBottom: '1px solid #111', margin: '4px auto' }} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: isA4 ? '20px' : (isLandscape ? '10px' : '16px'), width: '100%' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: docTitleFontSize, whiteSpace: 'nowrap' }}>
            {activeTab === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}
          </p>
          {activeTab !== 'party' && (
            <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: docSubtitleFontSize, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Độc lập – Tự do – Hạnh phúc
            </p>
          )}
          <div style={{ width: isA4 ? '160px' : '150px', borderBottom: '1px solid #111', margin: '6px auto 0' }} />
        </div>
      )}

      {/* TITLE */}
      <h1 style={{ 
        textAlign: 'center', fontWeight: 700, 
        fontSize: titleFontSize, 
        margin: isA4 ? (isLandscape ? '10px 0 14px' : '16px 0 20px') : (isLandscape ? '4px 0 6px' : '4px 0 8px'), 
        letterSpacing: '3px' 
      }}>
        GIẤY MỜI
      </h1>

      {/* KÍNH GỬI */}
      <p style={{ margin: 0, marginBottom: bodyMarginBottom, fontWeight: 700 }}>
        Kính gửi :{' '}
        <span style={{ textDecoration: 'underline' }}>{recipient}</span>
      </p>

      {/* BODY */}
      <p style={{ margin: 0, marginBottom: bodyMarginBottom, textIndent: '1.5em', textAlign: 'justify' }}>
        Trân trọng: kính mời đại diện gia đình ,đến dự hội nghi họp tdp{' '}
        <span style={{ textDecoration: 'underline' }}>{tdpNameFormatted}</span>,{' '}
        <span style={{ textDecoration: 'underline' }}>{wardNameFormatted}</span>
      </p>

      <p style={{ margin: 0, marginBottom: isA4 ? '8px' : '3px' }}>
        <span style={{ textDecoration: 'underline' }}>Thời gian</span>{' '}
        <strong>{meetingTime}</strong> ngày <strong>{meetingDay}/{meetingMonth}/{meetingYear}</strong>
      </p>

      <p style={{ margin: 0, marginBottom: isA4 ? '8px' : '3px' }}>
        <span style={{ textDecoration: 'underline' }}>Địa điểm</span>:{' '}
        <span style={{ textDecoration: 'underline' }}>{location}</span>
      </p>

      <p style={{ margin: 0, marginBottom: isA4 ? '8px' : '3px' }}>
        <span style={{ textDecoration: 'underline' }}>Nội dung</span>:{' '}
        <span style={{ textDecoration: 'underline', whiteSpace: 'pre-wrap' }}>{content}</span>
      </p>

      <p style={{ margin: 0, marginBottom: closingMarginBottom, textIndent: '1.5em', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
        <span style={{ textDecoration: 'underline' }}>{closingNote}</span>
      </p>

      {/* SIGNATURE */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: signatureMarginTop }}>
        <div style={{ textAlign: 'center', minWidth: isA4 ? '220px' : '190px' }}>
          <p style={{ margin: '0 0 2px', fontStyle: 'italic', fontSize: locationDateFontSize }}>{locationDate}</p>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: signerTitleFontSize }}>{signerTitle}</p>
          <div style={{ height: isA4 ? (isLandscape ? '35px' : '50px') : (isLandscape ? '20px' : '30px') }} />
          <p style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: signerTitleFontSize }}>{signerName}</p>
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
          @page { size: ${isA4 ? `A4 ${orientation}` : `A5 ${orientation}`}; margin: 0; }
          .inv-print-area {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: ${cardW} !important;
            display: block !important;
          }
          .print-card-wrapper {
            width: ${cardW} !important;
            height: ${cardH} !important;
            box-sizing: border-box !important;
            position: relative !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 auto !important;
            overflow: hidden !important;
            background: white !important;
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
          grid-template-columns: 320px 1fr;
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
        <h2 style={{ margin: 0, fontSize: '18px' }}>📋 Mẫu Giấy Mời {isA4 ? '(Khổ A4 toàn trang)' : '(Khổ A5 - 2 bản/A4)'}</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Paper Size toggle */}
          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setPaperSize('a5_half')}
              title="Khổ A5 (In 2 giấy mời ghép trên 1 tờ A4)"
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '12px', transition: 'all 0.15s',
                background: paperSize === 'a5_half' ? '#0d9488' : 'transparent',
                color: paperSize === 'a5_half' ? 'white' : '#475569',
              }}
            >📄 A5 (2 bản/A4)</button>
            <button
              onClick={() => setPaperSize('a4_full')}
              title="Khổ A4 (In 1 giấy mời vừa toàn bộ 1 tờ A4)"
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '12px', transition: 'all 0.15s',
                background: paperSize === 'a4_full' ? '#0d9488' : 'transparent',
                color: paperSize === 'a4_full' ? 'white' : '#475569',
              }}
            >📜 A4 (1 bản/A4)</button>
          </div>

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
          {!(localStorage.getItem('current_role') === 'demo' || localStorage.getItem('current_role') === 'trang_chu') && (
            <button
              onClick={handlePrint}
              style={{
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: 'white', border: 'none',
                padding: '9px 22px', borderRadius: '8px',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                transition: 'opacity 0.15s'
              }}
            >🖨️ {selectedHhList.length > 0 ? `In hàng loạt (${selectedHhList.length} bản)` : 'In giấy mời'} ({isA4 ? 'A4' : 'A5'} {orientation === 'portrait' ? 'Dọc' : 'Ngang'})</button>
          )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="inv-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                Tìm chủ hộ / địa chỉ:
              </label>
              <VoiceInputButton
                currentValue={searchInput}
                size="sm"
                showAiRefine={false}
                onTranscript={(text) => setSearchInput(text)}
              />
            </div>
            <input
              className="inv-input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Nhập hoặc đọc tên chủ hộ, số hộ khẩu..."
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
            maxHeight: '160px',
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

        {/* RIGHT COLUMN: Form & Preview stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Soạn nội dung giấy mời (Nằm ngang) */}
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, color: '#1e40af', fontSize: '15px', fontWeight: 700 }}>
                ✏️ Soạn nội dung giấy mời
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <VoiceInputButton
                  title="Đọc toàn bộ nội dung Giấy mời bằng giọng nói để AI tự động điền"
                  aiContext="giấy mời họp"
                  size="sm"
                  onTranscript={async (spokenText) => {
                    showToast('🤖 AI đang phân tích câu nói để điền Giấy mời...', 'info');
                    const parsed = await parseInvitationFromSpeech(spokenText);
                    if (parsed.reason || parsed.title) setContent(parsed.reason || parsed.title || spokenText);
                    if (parsed.location) setLocation(parsed.location);
                    if (parsed.time) setMeetingTime(parsed.time);
                    if (parsed.date) {
                      const parts = parsed.date.split('-');
                      if (parts.length === 3) {
                        setMeetingYear(parts[0]);
                        setMeetingMonth(parts[1]);
                        setMeetingDay(parts[2]);
                      }
                    }
                    showToast('Đã tự động bóc tách và điền Giấy mời!', 'success');
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
              {/* Hàng 1 */}
              <div style={{ gridColumn: 'span 3' }}>
                <label className="inv-label">Số giấy mời:</label>
                <input className="inv-input" value={invitationNumber}
                  onChange={e => setInvitationNumber(e.target.value)}
                  placeholder="VD: 01, 15, 28..." />
              </div>

              <div style={{ gridColumn: 'span 5' }}>
                <label className="inv-label">Định dạng kính gửi tự động:</label>
                <input className="inv-input" value={recipientPattern}
                  onChange={e => setRecipientPattern(e.target.value)}
                  placeholder="Đại diện hộ gia đình ông/bà {ten_chu_ho}" />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label className="inv-label">Người nhận (Kính gửi):</label>
                <input className="inv-input" value={recipientTitle}
                  onChange={e => setRecipientTitle(e.target.value)}
                  placeholder="VD: hộ gia đình_ông, bà" />
              </div>

              {/* Hàng 2 */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="inv-label">Giờ họp:</label>
                <input className="inv-input" value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)} placeholder="20 h" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="inv-label">Ngày:</label>
                <input className="inv-input" value={meetingDay}
                  onChange={e => setMeetingDay(e.target.value)} placeholder="15" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="inv-label">Tháng:</label>
                <input className="inv-input" value={meetingMonth}
                  onChange={e => setMeetingMonth(e.target.value)} placeholder="07" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="inv-label">Năm:</label>
                <input className="inv-input" value={meetingYear}
                  onChange={e => setMeetingYear(e.target.value)} placeholder="2026" />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label className="inv-label">Địa điểm:</label>
                <input className="inv-input" value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Nhà VH Tổ dân phố..." />
              </div>

              {/* Hàng 3 */}
              <div style={{ gridColumn: 'span 6' }}>
                <label className="inv-label">Nội dung cuộc họp:</label>
                <textarea className="inv-input" value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={2} style={{ resize: 'vertical' }}
                  placeholder="Nội dung hội nghị..." />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label className="inv-label">Lời kết (ghi chú cuối):</label>
                <textarea className="inv-input" value={closingNote}
                  onChange={e => setClosingNote(e.target.value)}
                  rows={2} style={{ resize: 'vertical' }}
                  placeholder="VD: rất mong ông bà đến đúng giờ" />
              </div>

              {/* Hàng 4 */}
              <div style={{ gridColumn: 'span 4' }}>
                <label className="inv-label">Địa danh, ngày ký:</label>
                <input className="inv-input" value={locationDate}
                  onChange={e => setLocationDate(e.target.value)}
                  placeholder="Nam Sầm Sơn, ngày 17/7/2026" />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label className="inv-label">Chức danh người ký:</label>
                <input className="inv-input" value={signerTitle}
                  onChange={e => setSignerTitle(e.target.value)}
                  placeholder="Tổ trưởng tdp" />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label className="inv-label">Họ và tên (in hoa):</label>
                <input className="inv-input" value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="NGUYỄN VIẾT CHÂU" />
              </div>
            </div>

            <div style={{ marginTop: '14px', background: '#f0f9ff', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#0369a1', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <strong>ℹ️ Cấu hình địa bàn:</strong>
              <span>Tổ dân phố: <strong>{rawTdpName}</strong></span>
              <span>Phường: <strong>{rawWardName}</strong></span>
              <span>Tổ trưởng: <strong>{rawLeader}</strong></span>
              
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}>
                  <input type="checkbox" checked={showBorder} onChange={e => setShowBorder(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Khung viền trang trí
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}>
                  <input type="checkbox" checked={showLeftHeader} onChange={e => setShowLeftHeader(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Đơn vị gửi bên trái
                </label>
              </div>
            </div>
          </div>

          {/* Xem trước & In ấn */}
          <div style={{
            background: '#f1f5f9', borderRadius: '14px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
            border: '1px solid #e2e8f0', alignItems: 'center'
          }}>
            {/* Preview Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ color: '#475569', fontWeight: 600 }}>
                {previewHh ? (
                  <span>👁️ Xem trước giấy mời của hộ: <strong style={{ color: '#1e40af' }}>{getHeadName(previewHh)}</strong></span>
                ) : (
                  <span>👁️ Xem trước bản mẫu thủ công</span>
                )}
              </div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>
                Tổng in: <strong>{getHouseholdsToPrint().length > 0 ? `${getHouseholdsToPrint().length} hộ` : '1 bản'}</strong>
              </div>
            </div>

            {/* Screen Preview (Full scale or scaled to fit container) */}
            <div className="screen-only" style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              width: '100%',
              padding: '10px 0',
              flexShrink: 0
            }}>
              <div style={{
                width: isA4 ? (isLandscape ? '635px' : '475px') : (isLandscape ? '635px' : '475px'),
                height: isA4 ? (isLandscape ? '449px' : '672px') : (isLandscape ? '447px' : '675px'),
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: isA4 
                    ? (isLandscape ? 'scale(0.57)' : 'scale(0.6)') 
                    : (isLandscape ? 'scale(0.8)' : 'scale(0.85)'),
                  transformOrigin: 'top left',
                  width: cardW,
                  height: cardH
                }}>
                  <InvitationCard recipient={recipientTitle} />
                </div>
              </div>
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

            <div style={{ width: '100%', background: '#fffbeb', borderRadius: '10px', padding: '12px', fontSize: '11.5px', color: '#b45309', border: '1px solid #fef3c7', lineHeight: 1.5, boxSizing: 'border-box' }}>
              <strong>💡 Mẹo in chuẩn đẹp không bị tràn trang:</strong><br />
              1. <strong>Chế độ in hiện tại:</strong> {isA4 ? 'Khổ A4 toàn trang (1 giấy mời/tờ A4)' : 'Khổ A5 (Ghép 2 giấy mời/tờ A4)'}.<br />
              2. Khi cửa sổ in mở ra, chọn đúng hướng giấy (<strong>{orientation === 'portrait' ? 'Dọc (Portrait)' : 'Ngang (Landscape)'}</strong>) và khổ giấy (<strong>A4</strong>).<br />
              3. Bắt buộc bỏ tích chọn mục <strong>"Tiêu đề đầu trang và chân trang"</strong> (Headers & Footers).<br />
              4. Đặt mục <strong>"Lề" (Margins)</strong> thành <strong>"Không có" (None)</strong> hoặc <strong>"Mặc định"</strong> để khung viền xanh in đẹp mắt.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InvitationTemplates;
