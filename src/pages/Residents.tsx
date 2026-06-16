import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { 
  Search, 
  Filter, 
  UserPlus, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  FileDown,
  FileUp,
  UserCheck,
  Baby,
  Users2,
  X,
  Printer
} from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { Resident, Household } from '../types';

const parseCSV = (text: string) => {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(entry.trim());
      entry = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      row.push(entry.trim());
      if (row.length > 0 && row.some(cell => cell !== '')) {
        lines.push(row);
      }
      row = [];
      entry = '';
    } else {
      entry += c;
    }
  }
  if (entry || row.length > 0) {
    row.push(entry.trim());
    if (row.some(cell => cell !== '')) {
      lines.push(row);
    }
  }
  return lines;
};

const formatToDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
};

const formatToDbDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
};

const isValidDate = (dateStr: string) => {
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  if (!dateRegex.test(dateStr.trim())) {
    return false;
  }
  const match = dateStr.trim().match(dateRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1850 || year > new Date().getFullYear()) {
      return false;
    }
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }
  }
  return true;
};

const Residents = () => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'senior' | 'child'>('all');
  const [householdFilter, setHouseholdFilter] = useState<string>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dob, setDob] = useState('');
  const [cccd, setCccd] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [temporaryAddress, setTemporaryAddress] = useState('');
  const [relationshipWithHead, setRelationshipWithHead] = useState('Thành viên');
  const [isHead, setIsHead] = useState(false);
  const [status, setStatus] = useState<'resident' | 'temporary_absent' | 'temporary_resident' | 'deceased'>('resident');
  const [householdId, setHouseholdId] = useState('');
  const [pob, setPob] = useState('');
  const [notes, setNotes] = useState('');

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d/]/g, '');
    
    if (value.length === 2 && dob.length === 1) {
      value = value + '/';
    } else if (value.length === 5 && dob.length === 4) {
      value = value + '/';
    }
    
    if (value.length <= 10) {
      setDob(value);
    }
  };

  const loadData = async () => {
    try {
      const rList = await db.getResidents();
      const hList = await db.getHouseholds();
      setResidents(rList);
      setHouseholds(hList);
    } catch (e) {
      showToast('Lỗi tải dữ liệu nhân khẩu!', 'danger');
    }
  };

  const handleOpenAddRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadData();

    // Listen to quick add event from Dashboard — use ref to avoid stale closure
    const handleOpenQuickAdd = () => {
      handleOpenAddRef.current();
    };
    window.addEventListener('open-add-resident-modal', handleOpenQuickAdd);
    return () => window.removeEventListener('open-add-resident-modal', handleOpenQuickAdd);
  }, []);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent;
      const residentId = customEvent.detail;
      const matched = residents.find(r => r.id === residentId);
      if (matched) {
        setSearchTerm(matched.full_name);
        setCategoryFilter('all');
        
        setTimeout(() => {
          const row = document.getElementById(`resident-row-${residentId}`);
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = '#fef08a';
            setTimeout(() => {
              row.style.transition = 'background-color 1.5s ease';
              row.style.backgroundColor = '';
            }, 2000);
          }
        }, 300);
      }
    };
    window.addEventListener('highlight-resident', handleHighlight);
    return () => window.removeEventListener('highlight-resident', handleHighlight);
  }, [residents]);

  const getAge = (dobString: string) => {
    if (!dobString) return 0;
    const birthYear = new Date(dobString).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  const handleOpenAdd = () => {
    setEditingResident(null);
    setFullName('');
    setGender('male');
    setDob('');
    setCccd('');
    setPhone('');
    setOccupation('');
    setPermanentAddress('Nam Sầm Sơn, Thanh Hóa');
    setTemporaryAddress('');
    setRelationshipWithHead('Con');
    setIsHead(false);
    setStatus('resident');
    setHouseholdId('');
    setPob('');
    setNotes('');
    setIsFormOpen(true);
  };

  // Keep ref synced with latest handleOpenAdd
  handleOpenAddRef.current = handleOpenAdd;

  const handleOpenEdit = (r: Resident) => {
    setEditingResident(r);
    setFullName(r.full_name);
    setGender(r.gender);
    setDob(formatToDisplayDate(r.dob));
    setCccd(r.cccd || '');
    setPhone(r.phone || '');
    setOccupation(r.occupation || '');
    setPermanentAddress(r.permanent_address);
    setTemporaryAddress(r.temporary_address || '');
    setRelationshipWithHead(r.relationship_with_head);
    setIsHead(r.is_head || false);
    setStatus(r.status);
    setHouseholdId(r.household_id || '');
    setPob(r.pob || '');
    setNotes(r.notes || '');
    setIsFormOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !dob) {
      showToast('Vui lòng điền họ tên và ngày sinh!', 'warning');
      return;
    }

    if (!isValidDate(dob)) {
      showToast('Ngày sinh không đúng định dạng dd/mm/yyyy (Ví dụ: 02/01/1940)!', 'warning');
      return;
    }

    const dbDob = formatToDbDate(dob);

    const payload: Omit<Resident, 'is_senior' | 'created_at'> & { is_senior?: boolean; created_at?: string } = {
      id: editingResident ? editingResident.id : `R-${Date.now()}`,
      household_id: householdId,
      full_name: fullName,
      gender,
      dob: dbDob,
      cccd,
      phone,
      occupation,
      permanent_address: permanentAddress,
      temporary_address: temporaryAddress,
      is_head: isHead,
      relationship_with_head: isHead ? 'Chủ hộ' : relationshipWithHead,
      status,
      pob,
      notes,
      created_at: editingResident ? editingResident.created_at : new Date().toISOString()
    };

    try {
      const saved = await db.saveResident(payload);
      
      // If isHead is checked, update household's head_of_household_id
      if (isHead && householdId) {
        const hh = households.find(h => h.id === householdId);
        if (hh && hh.head_of_household_id !== saved.id) {
          await db.saveHousehold({
            ...hh,
            head_of_household_id: saved.id
          });
        }
      }

      showToast(editingResident ? 'Cập nhật nhân khẩu thành công!' : 'Thêm nhân khẩu mới thành công!', 'success');
      setIsFormOpen(false);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi lưu dữ liệu!', 'danger');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân khẩu này khỏi hệ thống?')) {
      try {
        await db.deleteResident(id);
        showToast('Xóa nhân khẩu thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi xóa nhân khẩu!', 'danger');
      }
    }
    setActiveMenuId(null);
  };

  // Export to Excel/CSV Functionality
  const handleExportCSV = () => {
    if (filteredResidents.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    const headers = ['Họ tên', 'Giới tính', 'Ngày sinh', 'Thường trú', 'CCCD', 'SĐT', 'Quan hệ chủ hộ', 'Nghề nghiệp', 'Nơi sinh', 'Thường trú', 'Ghi chú'];
    const rows = filteredResidents.map(r => [
      r.full_name,
      r.gender === 'male' ? 'Nam' : r.gender === 'female' ? 'Nữ' : 'Khác',
      r.dob || '',
      r.permanent_address || '',
      r.cccd || '',
      r.phone || '',
      r.relationship_with_head,
      r.occupation || '',
      r.pob || '',
      r.status === 'resident' ? 'Thường trú' : r.status === 'temporary_resident' ? 'Tạm trú' : r.status === 'temporary_absent' ? 'Tạm vắng' : 'Đã mất',
      r.notes || ''
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tdpName = localStorage.getItem('tdp_name') || 'nam_sam_son';
    const filenameTdp = tdpName.toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_nhan_khau_${filenameTdp}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất báo cáo thành công!', 'success');
  };

  // Print function
  const handlePrint = () => {
    if (filteredResidents.length === 0) {
      showToast('Không có dữ liệu để in!', 'warning');
      return;
    }

    const tdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    
    // Determine the subtitle based on filters
    let filterSubtitle = 'Tất cả nhân khẩu';
    if (householdFilter !== 'all') {
      const selectedHh = households.find(h => h.id === householdFilter);
      if (selectedHh) {
        const headRes = residents.find(r => r.id === selectedHh.head_of_household_id);
        filterSubtitle = `Hộ gia đình: ${selectedHh.address} (${headRes ? `Chủ hộ: ${headRes.full_name}` : `Hộ số: ${selectedHh.household_number}`})`;
      }
    } else if (categoryFilter === 'senior') {
      filterSubtitle = 'Danh sách Người cao tuổi (≥80 tuổi)';
    } else if (categoryFilter === 'child') {
      filterSubtitle = 'Danh sách Trẻ em (<16 tuổi)';
    }

    if (searchTerm.trim()) {
      filterSubtitle += ` (Tìm kiếm theo từ khóa: "${searchTerm}")`;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const rowsHtml = filteredResidents.map((r, index) => {
      const formattedDob = r.dob ? formatToDisplayDate(r.dob) : '';
      const statusText = r.status === 'resident' ? 'Thường trú' :
                         r.status === 'temporary_resident' ? 'Tạm trú' :
                         r.status === 'temporary_absent' ? 'Tạm vắng' : 'Đã mất';
      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="font-weight: bold;">${r.full_name}</td>
          <td style="text-align: center;">${r.gender === 'male' ? 'Nam' : r.gender === 'female' ? 'Nữ' : 'Khác'}</td>
          <td style="text-align: center;">${formattedDob}</td>
          <td style="text-align: center;">${r.cccd || ''}</td>
          <td style="text-align: center;">${r.phone || ''}</td>
          <td>${r.pob || ''}</td>
          <td>${r.permanent_address || ''}</td>
          <td style="text-align: center;">${r.relationship_with_head}</td>
          <td style="text-align: center;">${statusText}</td>
          <td>${r.notes || ''}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In danh sách nhân khẩu - ${tdpName}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 12mm 8mm 12mm 8mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12px;
            line-height: 1.3;
            color: #000;
            margin: 0;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .org-title {
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
          }
          .motto {
            text-align: center;
            font-size: 12px;
          }
          .motto-main {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .motto-sub {
            font-weight: bold;
          }
          .line-separator {
            width: 80px;
            height: 1px;
            background-color: #000;
            margin: 4px auto 0 auto;
          }
          .line-separator-long {
            width: 150px;
            height: 1px;
            background-color: #000;
            margin: 4px auto 0 auto;
          }
          .doc-title-container {
            text-align: center;
            margin-top: 15px;
            margin-bottom: 15px;
          }
          .doc-title {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .doc-subtitle {
            font-style: italic;
            font-size: 12px;
            margin: 0;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            font-size: 11px;
            vertical-align: middle;
          }
          .data-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f2f2f2;
            text-transform: uppercase;
          }
          .signature-section {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            page-break-inside: avoid;
          }
          .signature-section td {
            border: none;
            text-align: center;
            width: 50%;
            font-size: 12px;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
            margin-bottom: 60px;
          }
          .signature-name {
            font-weight: bold;
          }
          .date-placeholder {
            font-style: italic;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 45%;">
              <div class="org-title">
                ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}<br/>
                TỔ DÂN PHỐ ${tdpName.toUpperCase()}
                <div class="line-separator"></div>
              </div>
            </td>
            <td style="width: 10%;">&nbsp;</td>
            <td style="width: 45%;">
              <div class="motto">
                <div class="motto-main">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div class="motto-sub">Độc lập - Tự do - Hạnh phúc</div>
                <div class="line-separator-long"></div>
              </div>
            </td>
          </tr>
        </table>

        <div class="doc-title-container">
          <h1 class="doc-title">DANH SÁCH NHÂN KHẨU</h1>
          <p class="doc-subtitle">(${filterSubtitle})</p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 3%;">STT</th>
              <th style="width: 14%;">Họ và tên</th>
              <th style="width: 5%;">Giới tính</th>
              <th style="width: 8%;">Ngày sinh</th>
              <th style="width: 9%;">Số CCCD</th>
              <th style="width: 8%;">Số điện thoại</th>
              <th style="width: 13%;">Nơi sinh</th>
              <th style="width: 15%;">Thường trú</th>
              <th style="width: 8%;">Quan hệ với chủ hộ</th>
              <th style="width: 8%;">Trạng thái</th>
              <th style="width: 9%;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; border: none;"></td>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 12px;">
              ${wardName.replace(/Phường\s+/gi, '') || 'Sầm Sơn'}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
            </td>
          </tr>
        </table>

        <table class="signature-section" style="width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
              <div class="signature-title" style="font-weight: bold;">NGƯỜI LẬP BIỂU</div>
              <div style="height: 80px;"></div>
              <div class="signature-name" style="font-weight: normal; font-style: italic; font-size: 12px; color: #000;">(Ký, ghi rõ họ tên)</div>
            </td>
            <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
              <div class="signature-title" style="font-weight: bold;">TỔ TRƯỞNG TỔ DÂN PHỐ</div>
              <div style="height: 80px;"></div>
              <div class="signature-name" style="font-weight: bold;">${leaderName}</div>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        showToast('File không có dữ liệu hoặc lỗi đọc file!', 'danger');
        return;
      }

      try {
        const rows = parseCSV(text);
        if (rows.length <= 1) {
          showToast('File không chứa bản ghi nhân khẩu hợp lệ!', 'warning');
          return;
        }

        let importCount = 0;
        let skipCount = 0;

        // Bỏ qua dòng tiêu đề nếu dòng đầu tiên có chữ "họ" hoặc "họ tên"
        const startIdx = (rows[0][0]?.toLowerCase().includes('họ') || rows[0][0]?.toLowerCase().includes('name')) ? 1 : 0;

        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[0]?.trim()) {
            skipCount++;
            continue;
          }

          const fullName = row[0]?.trim();
          const csvGender = row[1]?.trim().toLowerCase();
          const gender = csvGender === 'nam' ? 'male' : csvGender === 'nữ' ? 'female' : 'other';
          let dob = row[2]?.trim() || new Date().toISOString().slice(0, 10);
          if (dob.includes('/')) {
            const parts = dob.split('/');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              dob = `${year}-${month}-${day}`;
            }
          }
          const permAddress = row[3]?.trim() || '';
          const cccd = row[4]?.trim() || '';
          const phone = row[5]?.trim() || '';
          const relWithHead = row[6]?.trim() || 'Con';
          const occupation = row[7]?.trim() || '';
          const pob = row[8]?.trim() || '';
          const csvStatus = row[9]?.trim().toLowerCase();
          const status = csvStatus.includes('thường trú') ? 'resident' :
                         csvStatus.includes('tạm trú') ? 'temporary_resident' :
                         csvStatus.includes('tạm vắng') ? 'temporary_absent' :
                         csvStatus.includes('mất') || csvStatus.includes('deceased') ? 'deceased' : 'resident';
          const notes = row[10]?.trim() || '';
          const isHead = relWithHead.toLowerCase().includes('chủ hộ') || relWithHead.toLowerCase() === 'chủ' || relWithHead.toLowerCase() === 'bản thân';

          const payload: Omit<Resident, 'is_senior' | 'created_at'> & { is_senior?: boolean; created_at?: string } = {
            id: `R-IMP-${Date.now()}-${i}`,
            household_id: '',
            full_name: fullName,
            gender,
            dob,
            pob,
            cccd,
            phone,
            is_head: isHead,
            relationship_with_head: relWithHead,
            occupation,
            status,
            permanent_address: permAddress,
            notes,
            created_at: new Date().toISOString()
          };

          await db.saveResident(payload);
          importCount++;
        }

        showToast(`Nhập dữ liệu thành công! Đã thêm ${importCount} nhân khẩu${skipCount > 0 ? ` (bỏ qua ${skipCount} dòng lỗi)` : ''}.`, 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (err) {
        showToast('Lỗi khi phân tích cú pháp file CSV!', 'danger');
        console.error(err);
      }
    };

    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filters calculation
  const filteredResidents = residents.filter(r => {
    // Search query matches
    const name = r.full_name.toLowerCase();
    const cccdCode = (r.cccd || '').toLowerCase();
    const phoneNum = (r.phone || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesSearch = name.includes(query) || cccdCode.includes(query) || phoneNum.includes(query);

    // Category filter matches
    const age = getAge(r.dob);
    let matchesCategory = true;
    if (categoryFilter === 'senior') {
      matchesCategory = age >= 80;
    } else if (categoryFilter === 'child') {
      matchesCategory = age < 16;
    }

    // Household filter matches
    let matchesHousehold = true;
    if (householdFilter !== 'all') {
      matchesHousehold = r.household_id === householdFilter;
    }

    return matchesSearch && matchesCategory && matchesHousehold;
  });

  const getHouseholdAddress = (hId: string) => {
    const hh = households.find(h => h.id === hId);
    return hh ? hh.address : 'Chưa định vị hộ';
  };

  const getStatusText = (statusVal: string) => {
    switch (statusVal) {
      case 'resident': return 'Thường trú';
      case 'temporary_resident': return 'Tạm trú';
      case 'temporary_absent': return 'Tạm vắng';
      default: return 'Đã mất';
    }
  };

  return (
    <div className="residents-container">
      <div className="page-header">
        <div className="header-info">
          <h1>Danh sách Nhân khẩu</h1>
          <p>Quản lý thông tin chi tiết của từng cư dân cư trú tại Tổ dân phố.</p>
        </div>
        <div className="header-actions">
          <div className="vertical-actions-group">
            <button className="btn btn-secondary btn-import-excel" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} />
              Nhập Excel/CSV
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv,.txt" 
              onChange={handleImportCSV} 
            />
            <button className="btn btn-secondary btn-print-list" onClick={handlePrint}>
              <Printer size={16} />
              In danh sách
            </button>
          </div>
          <button className="btn btn-secondary btn-export-excel" onClick={handleExportCSV}>
            <FileDown size={16} />
            Xuất Excel/CSV
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <UserPlus size={16} />
            Thêm nhân khẩu
          </button>
        </div>
      </div>

      <div className="filter-section">
          <div className="search-box">
            <Search size={20} />
            <input 
              type="text" 
              placeholder="Tìm theo tên, số CCCD hoặc số điện thoại..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-dropdown-box">
            <Filter size={18} style={{ color: 'var(--text-muted)' }} />
            <select 
              value={householdFilter} 
              onChange={(e) => setHouseholdFilter(e.target.value)}
              className="household-select-filter"
            >
              <option value="all">Tất cả hộ gia đình</option>
              {households.map(h => {
                const headRes = residents.find(r => r.id === h.head_of_household_id);
                return (
                  <option key={h.id} value={h.id}>
                    {h.address} ({headRes ? `Chủ hộ: ${headRes.full_name}` : `Hộ số: ${h.household_number}`})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="filter-btns">
              <button 
                className={`filter-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
              <Users2 size={16} /> Tất cả
            </button>
            <button 
              className={`filter-btn ${categoryFilter === 'senior' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('senior')}
            >
              <UserCheck size={16} /> Người cao tuổi (≥80)
            </button>
            <button 
              className={`filter-btn ${categoryFilter === 'child' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('child')}
            >
              <Baby size={16} /> Trẻ em (&lt;16)
            </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Họ và tên</th>
              <th>Giới tính / Tuổi</th>
              <th>Ngày sinh</th>
              <th>CCCD / Định danh</th>
              <th>Quan hệ chủ hộ</th>
              <th>Địa chỉ Hộ dân</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredResidents.map((resident) => (
              <tr key={resident.id} id={`resident-row-${resident.id}`}>
                <td>
                  <div className="resident-name-cell">
                    <div className="avatar-sm">{resident.full_name.charAt(0)}</div>
                    <div>
                      <div className="name">{resident.full_name}</div>
                      <div className="subtext">{resident.phone || 'Chưa có SĐT'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span>{resident.gender === 'male' ? 'Nam' : 'Nữ'}</span>
                  <span className="age-badge">({getAge(resident.dob)} tuổi)</span>
                </td>
                <td>{formatToDisplayDate(resident.dob)}</td>
                <td><code className="cccd-code">{resident.cccd || 'Chưa cấp'}</code></td>
                <td>
                  <span className={`relation-badge ${resident.is_head ? 'head' : ''}`}>
                    {resident.relationship_with_head}
                  </span>
                </td>
                <td style={{maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {getHouseholdAddress(resident.household_id)}
                </td>
                <td>
                  <span className={`status-dot ${resident.status === 'resident' ? 'green' : resident.status === 'temporary_resident' ? 'blue' : 'orange'}`}></span>
                  {getStatusText(resident.status)}
                </td>
                <td>
                  <div className="action-menu-container">
                    <button className="icon-btn-sm" onClick={() => setActiveMenuId(activeMenuId === resident.id ? null : resident.id)}>
                      <MoreHorizontal size={16} />
                    </button>
                    {activeMenuId === resident.id && (
                      <div className="dropdown-menu-res">
                        <button onClick={() => handleOpenEdit(resident)}><Edit2 size={14} /> Chỉnh sửa</button>
                        <button className="delete-opt" onClick={() => handleDelete(resident.id)}><Trash2 size={14} /> Xóa hồ sơ</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredResidents.length === 0 && (
              <tr>
                <td colSpan={8} style={{textAlign: 'center', padding: '32px', color: 'var(--text-muted)'}}>
                  Không tìm thấy nhân khẩu nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content medium">
            <div className="modal-header">
              <h2>{editingResident ? 'Chỉnh sửa nhân khẩu' : 'Thêm nhân khẩu mới'}</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Họ và tên *</label>
                  <input 
                    type="text" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Ví dụ: Nguyễn Kim Tuyến" 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Giới tính *</label>
                  <select value={gender} onChange={(e: any) => setGender(e.target.value)} required>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngày sinh *</label>
                  <input 
                    type="text" 
                    value={dob} 
                    onChange={handleDobChange} 
                    placeholder="Ví dụ: 02/01/1940"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CCCD / Định danh cá nhân</label>
                  <input 
                    type="text" 
                    value={cccd} 
                    onChange={(e) => setCccd(e.target.value)} 
                    placeholder="12 chữ số" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nơi sinh</label>
                <input 
                  type="text" 
                  value={pob} 
                  onChange={(e) => setPob(e.target.value)} 
                  placeholder="Ví dụ: Xã Quảng Giao, Huyện Quảng Xương, Tỉnh Thanh Hóa" 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="Ví dụ: 0912345678" 
                  />
                </div>
                <div className="form-group">
                  <label>Nghề nghiệp</label>
                  <input 
                    type="text" 
                    value={occupation} 
                    onChange={(e) => setOccupation(e.target.value)} 
                    placeholder="Ví dụ: Công nhân, Kinh doanh" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hộ gia đình liên kết</label>
                <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
                  <option value="">-- Chọn hộ dân cư trú --</option>
                  {households.map(h => {
                    const headRes = residents.find(r => r.id === h.head_of_household_id);
                    return (
                      <option key={h.id} value={h.id}>
                        {h.address} (Chủ hộ: {headRes ? headRes.full_name : h.household_number})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{alignSelf: 'center', flexDirection: 'row', gap: '8px', paddingTop: '16px'}}>
                  <input 
                    type="checkbox" 
                    id="isHeadCheck"
                    checked={isHead} 
                    onChange={(e) => {
                      setIsHead(e.target.checked);
                      if (e.target.checked) setRelationshipWithHead('Chủ hộ');
                    }} 
                  />
                  <label htmlFor="isHeadCheck" style={{cursor: 'pointer'}}>Là chủ hộ của gia đình</label>
                </div>
                {!isHead && (
                  <div className="form-group">
                    <label>Quan hệ với chủ hộ</label>
                    <input 
                      type="text" 
                      value={relationshipWithHead} 
                      onChange={(e) => setRelationshipWithHead(e.target.value)} 
                      placeholder="Con, Vợ, Chồng, Cháu..." 
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Trạng thái cư trú</label>
                <select value={status} onChange={(e: any) => setStatus(e.target.value)}>
                  <option value="resident">Thường trú</option>
                  <option value="temporary_resident">Tạm trú</option>
                  <option value="temporary_absent">Tạm vắng (Có đăng ký)</option>
                  <option value="deceased">Đã qua đời</option>
                </select>
              </div>

              <div className="form-group">
                <label>Địa chỉ thường trú gốc (Nếu tạm trú)</label>
                <input 
                  type="text" 
                  value={permanentAddress} 
                  onChange={(e) => setPermanentAddress(e.target.value)} 
                  placeholder="Địa chỉ ghi trên sổ hộ khẩu" 
                />
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Nhập thông tin ghi chú về nhân khẩu..." 
                  style={{ height: '70px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu hồ sơ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .residents-container {
          animation: fadeIn 0.4s ease-out;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .header-actions .btn {
          padding: 8px 14px !important;
          font-size: 0.85rem !important;
          height: auto !important;
          min-height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          border-radius: 6px !important;
          transition: all 0.2s ease !important;
          font-weight: 600 !important;
        }

        .vertical-actions-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
        }

        /* Customize Nhập Excel/CSV button */
        .btn-import-excel {
          background-color: #f0fdf4 !important;
          border: 1px solid #bbf7d0 !important;
          color: #166534 !important;
        }
        .btn-import-excel:hover {
          background-color: #dcfce7 !important;
          border-color: #86efac !important;
          transform: translateY(-1px);
        }

        /* Customize In danh sách button */
        .btn-print-list {
          background-color: #e0e7ff !important;
          border: 1px solid #c7d2fe !important;
          color: #3730a3 !important;
        }
        .btn-print-list:hover {
          background-color: #e0e7ff !important;
          border-color: #a5b4fc !important;
          opacity: 0.95;
          transform: translateY(-1px);
        }

        /* Customize Xuất Excel/CSV button */
        .btn-export-excel {
          background-color: #f0fdfa !important;
          border: 1px solid #ccfbf1 !important;
          color: #0f766e !important;
        }
        .btn-export-excel:hover {
          background-color: #ccfbf1 !important;
          border-color: #99f6e4 !important;
          transform: translateY(-1px);
        }

        /* Align Thêm nhân khẩu button size */
        .header-actions .btn-primary {
          background: linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%) !important;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2) !important;
          color: white !important;
          border: none !important;
        }
        .header-actions .btn-primary:hover {
          box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3) !important;
          transform: translateY(-1px);
        }

        .filter-section {
          background: white;
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 20px;
        }

        .search-box {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background-color: #f8fafc;
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          max-width: 450px;
        }

        .search-box input {
          border: none;
          background: none;
          outline: none;
          width: 100%;
          font-size: 1rem;
        }

        .filter-dropdown-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          min-width: 280px;
          max-width: 320px;
        }

        .household-select-filter {
          border: none;
          background: none;
          outline: none;
          width: 100%;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-dark);
          cursor: pointer;
        }

        .filter-btns {
          display: flex;
          gap: 8px;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
          background-color: white;
          border: 1px solid var(--border);
        }

        .filter-btn.active {
          background-color: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .table-container {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th {
          background-color: #f8fafc;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border);
        }

        .data-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          font-size: 0.95rem;
        }

        .resident-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar-sm {
          width: 36px;
          height: 36px;
          background-color: rgba(37, 99, 235, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--primary);
        }

        .name {
          font-weight: 600;
          color: var(--text-main);
        }

        .subtext {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .age-badge {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-left: 4px;
        }

        .cccd-code {
          font-family: monospace;
          background-color: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .relation-badge {
          font-size: 0.8rem;
          padding: 4px 10px;
          border-radius: 20px;
          background-color: #f1f5f9;
          font-weight: 600;
        }

        .relation-badge.head {
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary);
        }

        .status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }

        .status-dot.green { background-color: var(--success); }
        .status-dot.blue { background-color: var(--info); }
        .status-dot.orange { background-color: var(--warning); }

        .action-menu-container {
          position: relative;
        }

        .dropdown-menu-res {
          position: absolute;
          right: 0;
          top: 100%;
          background: white;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
          border-radius: 8px;
          width: 140px;
          z-index: 10;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .dropdown-menu-res button {
          padding: 10px 16px;
          font-size: 0.85rem;
          text-align: left;
          width: 100%;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-main);
        }

        .dropdown-menu-res button:hover {
          background-color: #f8fafc;
        }

        .dropdown-menu-res button.delete-opt {
          color: var(--danger);
        }

        .dropdown-menu-res button.delete-opt:hover {
          background-color: rgba(239, 68, 68, 0.05);
        }

        .icon-btn-sm {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          color: var(--text-muted);
        }

        .icon-btn-sm:hover {
          background-color: #f1f5f9;
          color: var(--primary);
        }

        /* Modal styling is now global in App.css */


        @media (max-width: 1024px) {
          .data-table th:nth-child(4),
          .data-table td:nth-child(4) { display: none; }
          .data-table th:nth-child(6),
          .data-table td:nth-child(6) { display: none; }
        }

        @media (max-width: 768px) {
          .filter-section {
            flex-direction: column;
            align-items: stretch;
          }
          .page-header {
            flex-direction: column;
            gap: 16px;
          }
          .header-actions {
            width: 100%;
          }
          .header-actions .btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Residents;
