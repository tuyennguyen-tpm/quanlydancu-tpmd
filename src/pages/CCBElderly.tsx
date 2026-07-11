import { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import type { Resident, Household } from '../types';
import ExcelJS from 'exceljs';
import { FileUp, FileDown, Printer, UserPlus, X } from 'lucide-react';

const MILESTONE_AGES = [70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];

const getLongevityAge = (dobStr: string, targetYear: number) => {
  if (!dobStr) return -1;
  const parts = dobStr.split(/[-/]/);
  let yearStr = parts[0];
  if (parts.length === 3 && parts[2].length === 4) {
    yearStr = parts[2];
  }
  const birthYear = parseInt(yearStr, 10);
  if (isNaN(birthYear) || birthYear <= 0) return -1;
  return targetYear - birthYear;
};

const CCBElderly = () => {
  const [seniors, setSeniors] = useState<Resident[]>([]);
  const [veterans, setVeterans] = useState<Resident[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'seniors' | 'veterans'>('seniors');
  const [subFilter, setSubFilter] = useState<'all' | 'senior70' | 'longevity'>('all');
  const [longevityYear, setLongevityYear] = useState<number>(new Date().getFullYear());
  const [groupFilter, setGroupFilter] = useState('all');
  const savedGroups = localStorage.getItem('tdp_groups_config');
  const groupsList = savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states for adding member
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [newDob, setNewDob] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCccd, setNewCccd] = useState('');
  const [newOccupation, setNewOccupation] = useState('');
  const [newStatus, setNewStatus] = useState<'resident' | 'temporary_resident'>('resident');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [newRelationship, setNewRelationship] = useState('Thành viên');
  const [newAddress, setNewAddress] = useState('');

  // Form states for editing member
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | 'other'>('male');
  const [editDob, setEditDob] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCccd, setEditCccd] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editStatus, setEditStatus] = useState<'resident' | 'temporary_resident'>('resident');
  const [editHouseholdId, setEditHouseholdId] = useState('');
  const [editRelationship, setEditRelationship] = useState('Thành viên');
  const [editAddress, setEditAddress] = useState('');

  const [households, setHouseholds] = useState<Household[]>([]);
  const [allResidents, setAllResidents] = useState<Resident[]>([]);

  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  const currentYear = new Date().getFullYear();
  const getAge = (dob: string) => {
    if (!dob) return 0;
    return currentYear - parseInt(dob.substring(0, 4));
  };

  const loadData = async () => {
    try {
      const [residents, hhList] = await Promise.all([
        db.getResidents(),
        db.getHouseholds()
      ]);
      setAllResidents(residents);
      setHouseholds(hhList);
      
      const activeResidents = residents.filter(r => r.status !== 'deceased');

      // Seniors: only show residents with 'nct' in association_membership
      const seniorList = activeResidents.filter(r => {
        const membership = r.association_membership || '';
        return membership.split(',').map(s => s.trim()).includes('nct');
      });

      // Veterans (CCB): only show residents with 'ccb' in association_membership
      const veteranList = activeResidents.filter(r => {
        const membership = r.association_membership || '';
        return membership.split(',').map(s => s.trim()).includes('ccb');
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
  const filteredList = displayList.filter(m => {
    // Search query match
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.cccd && m.cccd.includes(searchQuery)) ||
                          (m.phone && m.phone.includes(searchQuery));
    
    if (!matchesSearch) return false;
    
    // Sub-filters for seniors
    if (selectedTab === 'seniors') {
      const age = getAge(m.dob);
      if (subFilter === 'senior70') {
        if (age < 70) return false;
      } else if (subFilter === 'longevity') {
        const longevityAge = getLongevityAge(m.dob, longevityYear);
        if (!MILESTONE_AGES.includes(longevityAge)) return false;
      }
    }
    
    // Group filter match
    if (groupFilter === 'all') return true;

    // Check household first
    const hh = households.find(h => h.id === m.household_id);
    const selfGroup = hh?.self_management_group || '';
    const address = m.permanent_address || '';

    // Smart matching or direct inclusion check
    const matchesGroup = selfGroup.toLowerCase().includes(groupFilter.toLowerCase()) || 
                         address.toLowerCase().includes(groupFilter.toLowerCase());
                          
    return matchesGroup;
  });


  // Longevity category helper (Chúc thọ/Mừng thọ)
  const getLongevityCategory = (age: number) => {
    if (age >= 100) return 'Đại Thượng Thọ (100+)';
    if (age >= 90) return 'Thượng Thọ (90-99)';
    if (age >= 80) return 'Mừng Thọ (80-89)';
    if (age >= 70) return 'Chúc Thọ (70-79)';
    return 'Hội viên cao tuổi';
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n');
    return lines.map(line => {
      const row: string[] = [];
      let inQuotes = false;
      let currentVal = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.trim());
      return row;
    }).filter(row => row.length > 0 && row.some(cell => cell !== ''));
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Tài khoản của bạn không có quyền nhập dữ liệu!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = async (event) => {
      let rows: string[][] = [];

      try {
        if (isXlsx) {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            const ev = new CustomEvent('show-toast', { 
              detail: { message: 'File Excel không có trang tính nào!', type: 'warning' } 
            });
            window.dispatchEvent(ev);
            return;
          }
          
          const maxCol = worksheet.columnCount;
          worksheet.eachRow((row) => {
            const rowValues: string[] = [];
            for (let c = 1; c <= maxCol; c++) {
              const cell = row.getCell(c);
              let val = cell.value;
              if (val && typeof val === 'object') {
                if ('result' in val) {
                  val = val.result;
                } else if ('richText' in val) {
                  val = (val.richText as any[]).map(t => t.text || '').join('');
                } else if ('text' in val) {
                  val = val.text;
                } else {
                  val = val.toString();
                }
              }
              rowValues.push(val !== undefined && val !== null ? val.toString() : '');
            }
            rows.push(rowValues);
          });
        } else {
          const text = event.target?.result as string;
          if (!text) {
            const ev = new CustomEvent('show-toast', { 
              detail: { message: 'File không có dữ liệu hoặc lỗi đọc file!', type: 'danger' } 
            });
            window.dispatchEvent(ev);
            return;
          }
          rows = parseCSV(text);
        }

        if (rows.length <= 1) {
          const ev = new CustomEvent('show-toast', { 
            detail: { message: 'File không chứa bản ghi hợp lệ!', type: 'warning' } 
          });
          window.dispatchEvent(ev);
          return;
        }

        const header = rows[0].map(h => h.toLowerCase().trim());
        const nameIdx = header.findIndex(h => h.includes('tên') || h.includes('name'));
        const genderIdx = header.findIndex(h => h.includes('giới tính') || h.includes('gender') || h.includes('nam/nữ'));
        const dobIdx = header.findIndex(h => h.includes('sinh') || h.includes('dob'));
        const phoneIdx = header.findIndex(h => h.includes('thoại') || h.includes('phone') || h.includes('sđt'));
        const occIdx = header.findIndex(h => h.includes('nghề') || h.includes('job') || h.includes('việc') || h.includes('chức vụ'));
        const addrIdx = header.findIndex(h => h.includes('chỉ') || h.includes('địa') || h.includes('address'));
        const cccdIdx = header.findIndex(h => h.includes('cccd') || h.includes('cmnd') || h.includes('căn cước'));
        
        let addedCount = 0;
        const membershipCode = selectedTab === 'seniors' ? 'nct' : 'ccb';
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = nameIdx >= 0 ? row[nameIdx] : row[1];
          if (!name || !name.trim()) continue;

          const dobVal = dobIdx >= 0 ? row[dobIdx] : '';
          let parsedDob = '';
          if (dobVal) {
            const matchDmy = dobVal.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (matchDmy) {
              parsedDob = `${matchDmy[3]}-${matchDmy[2].padStart(2, '0')}-${matchDmy[1].padStart(2, '0')}`;
            } else {
              const matchYmd = dobVal.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
              if (matchYmd) {
                parsedDob = `${matchYmd[1]}-${matchYmd[2].padStart(2, '0')}-${matchYmd[3].padStart(2, '0')}`;
              }
            }
          }

          const genderVal = genderIdx >= 0 ? row[genderIdx].toLowerCase().trim() : '';
          let gender: 'male' | 'female' = 'male';
          if (genderVal.includes('nữ') || genderVal.includes('female') || genderVal === 'f') {
            gender = 'female';
          }

          const newRes: Omit<Resident, 'created_at' | 'is_senior'> = {
            id: 'R_IMP_' + Math.random().toString(36).substring(2, 9),
            household_id: households[0]?.id || '',
            full_name: name.trim(),
            gender: gender,
            dob: parsedDob || '',
            phone: (phoneIdx >= 0 ? row[phoneIdx] : '').trim(),
            cccd: (cccdIdx >= 0 ? row[cccdIdx] : '').trim(),
            occupation: (occIdx >= 0 ? row[occIdx] : (selectedTab === 'seniors' ? 'Hội viên NCT' : 'Hội viên CCB')).trim(),
            permanent_address: (addrIdx >= 0 ? row[addrIdx] : 'TDP Quảng Giao').trim(),
            status: 'resident',
            is_head: false,
            relationship_with_head: 'Thành viên',
            association_membership: membershipCode
          };

          await db.saveResident(newRes);
          addedCount++;
        }

        loadData();
        
        const ev = new CustomEvent('show-toast', { 
          detail: { message: `Đã nhập thành công ${addedCount} hội viên từ file!`, type: 'success' } 
        });
        window.dispatchEvent(ev);
      } catch (err: any) {
        console.error(err);
        const ev = new CustomEvent('show-toast', { 
          detail: { message: `Lỗi đọc dữ liệu từ file: ${err.message || err}`, type: 'danger' } 
        });
        window.dispatchEvent(ev);
      }
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      let sheetName = selectedTab === 'seniors' ? 'NguoiCaoTuoi' : 'CuuChienBinh';
      if (selectedTab === 'seniors' && subFilter === 'senior70') sheetName = 'NguoiCaoTuoi_Tren70';
      if (selectedTab === 'seniors' && subFilter === 'longevity') sheetName = `MungTho_${longevityYear}`;
      const worksheet = workbook.addWorksheet(sheetName);

      const headers = [
        'STT', 
        'Họ và tên', 
        'Giới tính', 
        'Ngày sinh', 
        'Tuổi', 
        'Điện thoại', 
        'CCCD', 
        selectedTab === 'seniors' ? 'Danh hiệu Mừng thọ' : 'Chức vụ / Công việc', 
        'Địa chỉ cư trú', 
        'Trạng thái'
      ];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Segoe UI',
          size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      filteredList.forEach((m, idx) => {
        const dob = m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập';
        const age = getAge(m.dob);
        const genderText = m.gender === 'female' ? 'Nữ' : 'Nam';
        const statusText = m.status === 'resident' ? 'Thường trú' : 'Tạm trú';
        
        let detailVal = '';
        if (selectedTab === 'seniors') {
          detailVal = getLongevityCategory(age);
        } else {
          detailVal = m.occupation || 'Hội viên CCB';
        }

        const rowData = [
          idx + 1,
          m.full_name,
          genderText,
          dob,
          `${age} tuổi`,
          m.phone || '',
          m.cccd || '',
          detailVal,
          m.permanent_address || 'TDP Quảng Giao',
          statusText
        ];
        
        const row = worksheet.addRow(rowData);
        row.height = 22;
        
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: [1, 3, 4, 5, 6, 7, 10].includes(colNumber) ? 'center' : 'left'
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
      const filename = selectedTab === 'seniors' ? 'danh_sach_nguoi_cao_tuoi' : 'danh_sach_cuu_chien_binh';
      link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã xuất danh sách thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (e) {
      console.error(e);
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Lỗi xuất file Excel: ${e}`, type: 'danger' } 
      });
      window.dispatchEvent(ev);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    let titleText = selectedTab === 'seniors' ? 'DANH SÁCH NGƯỜI CAO TUỔI' : 'DANH SÁCH HỘI VIÊN CỰU CHIẾN BINH';
    if (selectedTab === 'seniors' && subFilter === 'senior70') titleText = 'DANH SÁCH NGƯỜI CAO TUỔI (≥70 TUỔI)';
    if (selectedTab === 'seniors' && subFilter === 'longevity') titleText = `DANH SÁCH NGƯỜI CAO TUỔI MỪNG THỌ NĂM ${longevityYear}`;

    let rowsHtml = '';
    filteredList.forEach((m, idx) => {
      const dob = m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập';
      const age = getAge(m.dob);
      const genderText = m.gender === 'female' ? 'Nữ' : 'Nam';
      const statusText = m.status === 'resident' ? 'Thường trú' : 'Tạm trú';
      
      let detailVal = '';
      if (selectedTab === 'seniors') {
        detailVal = getLongevityCategory(age);
      } else {
        detailVal = m.occupation || 'Hội viên CCB';
      }

      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; white-space: nowrap;">${m.full_name}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${genderText}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${dob}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${age} tuổi</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${m.phone || ''}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${m.cccd || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${detailVal}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.permanent_address || 'TDP Quảng Giao'}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${statusText}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin-top: 20mm;
                margin-bottom: 20mm;
                margin-left: 30mm;
                margin-right: 15mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { font-family: "Times New Roman", Times, serif; font-size: 14pt; padding: 20px; color: #000; }
            h2 { text-transform: uppercase; color: #000; margin-bottom: 5px; font-size: 16pt; font-weight: bold; text-align: center; }
            p { margin: 5px 0 20px 0; color: #000; font-size: 14pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13pt; border: 1px solid #000; }
            th, td { border: 1px solid #000 !important; padding: 8px; text-align: left; }
            th { background-color: transparent; color: #000; font-weight: bold; text-align: center; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <h3 style="margin: 0; text-transform: uppercase;">ỦY BAN NHÂN DÂN ${(wardName.toLowerCase().startsWith('phường') ? wardName : 'Phường ' + wardName).toUpperCase()}</h3>
              <h4 style="margin: 5px 0 0 0; text-decoration: underline;">TỔ DÂN PHỐ ${tdpName.toUpperCase()}</h4>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-style: italic;">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <h2 style="margin: 0;">${titleText}</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th>Họ và tên</th>
                <th style="width: 70px;">Giới tính</th>
                <th style="width: 100px;">Ngày sinh</th>
                <th style="width: 70px;">Tuổi</th>
                <th style="width: 110px;">Số điện thoại</th>
                <th style="width: 110px;">CCCD</th>
                <th>${selectedTab === 'seniors' ? 'Danh hiệu Mừng thọ' : 'Chức vụ / Công việc'}</th>
                <th>Địa chỉ cư trú</th>
                <th style="width: 90px;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="10" style="text-align: center; padding: 20px;">Không có dữ liệu.</td></tr>`}
            </tbody>
          </table>
          <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px;">
            <div style="text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">NGƯỜI LẬP BIỂU</p>
              <p style="font-style: italic; color: #999;">(Ký, ghi rõ họ tên)</p>
            </div>
            <div style="text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">TM. BAN LIÊN LẠC HỘI</p>
              <p style="font-style: italic; color: #999;">(Ký, đóng dấu nếu có)</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Vui lòng nhập họ và tên!');
      return;
    }

    try {
      const selectedHh = households.find(h => h.id === newHouseholdId);
      const membershipCode = selectedTab === 'seniors' ? 'nct' : 'ccb';
      const newRes: Omit<Resident, 'created_at' | 'is_senior'> = {
        id: 'R_' + Math.random().toString(36).substring(2, 9),
        household_id: newHouseholdId || '',
        full_name: newName.trim(),
        gender: newGender,
        dob: newDob || '',
        phone: newPhone.trim(),
        cccd: newCccd.trim(),
        occupation: newOccupation.trim() || (selectedTab === 'seniors' ? 'Hội viên NCT' : 'Hội viên CCB'),
        permanent_address: selectedHh?.address || newAddress.trim() || 'TDP Quảng Giao',
        status: newStatus,
        is_head: false,
        relationship_with_head: newRelationship,
        association_membership: membershipCode
      };

      await db.saveResident(newRes);
      
      setIsAddModalOpen(false);
      setNewName('');
      setNewGender('male');
      setNewDob('');
      setNewPhone('');
      setNewCccd('');
      setNewOccupation('');
      setNewStatus('resident');
      setNewHouseholdId('');
      setNewRelationship('Thành viên');
      setNewAddress('');

      loadData();

      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã thêm mới hội viên ${newName} thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra: ${err.message || err}`);
    }
  };

  const handleOpenEdit = (res: Resident) => {
    setEditingResident(res);
    setEditName(res.full_name);
    setEditGender(res.gender || 'male');
    setEditDob(res.dob || '');
    setEditPhone(res.phone || '');
    setEditCccd(res.cccd || '');
    setEditOccupation(res.occupation || '');
    setEditStatus(res.status as any);
    setEditHouseholdId(res.household_id || '');
    setEditRelationship(res.relationship_with_head || 'Thành viên');
    setEditAddress(res.permanent_address || '');
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResident) return;
    if (!editName.trim()) {
      alert('Vui lòng nhập họ và tên!');
      return;
    }

    try {
      const selectedHh = households.find(h => h.id === editHouseholdId);
      const updatedRes = {
        ...editingResident,
        full_name: editName.trim(),
        gender: editGender,
        dob: editDob,
        phone: editPhone.trim(),
        cccd: editCccd.trim(),
        occupation: editOccupation.trim(),
        household_id: editHouseholdId || '',
        relationship_with_head: editRelationship,
        permanent_address: selectedHh?.address || editAddress.trim() || editingResident.permanent_address || 'TDP Quảng Giao',
        status: editStatus
      };

      await db.saveResident(updatedRes);
      setIsEditModalOpen(false);
      setEditingResident(null);
      loadData();

      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã cập nhật thông tin hội viên thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra: ${err.message || err}`);
    }
  };

  const handleRemoveMember = async (res: Resident) => {
    const isSeniorTab = selectedTab === 'seniors';
    const assocName = isSeniorTab ? 'Hội Người cao tuổi' : 'Hội Cựu chiến binh';
    const assocCode = isSeniorTab ? 'nct' : 'ccb';

    const confirmRemove = window.confirm(`Bạn có chắc chắn muốn rút hội viên ${res.full_name} ra khỏi ${assocName}?`);
    if (!confirmRemove) return;

    try {
      const membership = res.association_membership || '';
      const updatedMembership = membership
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== assocCode && s !== '')
        .join(', ');

      const updatedRes = {
        ...res,
        association_membership: updatedMembership
      };

      await db.saveResident(updatedRes);
      loadData();
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã rút hội viên ${res.full_name} ra khỏi ${assocName} thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra khi rút hội viên: ${err.message || err}`);
    }
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
          onClick={() => { setSelectedTab('seniors'); setSearchQuery(''); setGroupFilter('all'); setSubFilter('all'); }}
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
          onClick={() => { setSelectedTab('veterans'); setSearchQuery(''); setGroupFilter('all'); setSubFilter('all'); }}
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

      {/* SUB-FILTERS FOR SENIORS */}
      {selectedTab === 'seniors' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSubFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: subFilter === 'all' ? 'var(--gov-blue)' : 'white',
              color: subFilter === 'all' ? 'white' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Tất cả Người cao tuổi
          </button>
          <button
            onClick={() => setSubFilter('senior70')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: subFilter === 'senior70' ? '#1d4ed8' : 'white',
              color: subFilter === 'senior70' ? 'white' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            👴 Người cao tuổi (≥70)
          </button>
          <button
            onClick={() => setSubFilter('longevity')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: subFilter === 'longevity' ? '#db2777' : 'white',
              color: subFilter === 'longevity' ? 'white' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🎉 Mừng thọ (70-150)
          </button>

          {subFilter === 'longevity' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)' }}>Năm mừng thọ:</span>
              <select
                value={longevityYear}
                onChange={(e) => setLongevityYear(parseInt(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'white'
                }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 1 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ACTIONS BAR */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        {!isGuest && (
          <button 
            onClick={() => fileInputRef.current?.click()} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', transition: 'all 0.15s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'none'; }}
          >
            <FileUp size={16} />
            Nhập Excel/CSV
          </button>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".csv,.txt,.xlsx,.xls" 
          onChange={handleImportCSV} 
        />
        
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

        {!isGuest && (
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', background: '#1d4ed8', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease', marginLeft: 'auto' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#1e40af'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'none'; }}
          >
            <UserPlus size={16} />
            Thêm hội viên
          </button>
        )}
      </div>

      {/* SEARCH AND TABLE */}
      <div className="card-gov">
        <div className="card-gov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title">
            <span className="title-dot"></span>
            {selectedTab === 'seniors' ? 'Danh sách Người cao tuổi' : 'Danh sách Hội viên Cựu chiến binh'} ({filteredList.length})
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '12.5px', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="all">Tất cả các tổ</option>
              {groupsList.map((g: string) => <option key={g} value={g}>{g}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', width: '240px' }}>
              <input 
                type="text" 
                placeholder="Tìm kiếm theo tên, số điện thoại..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: '12.5px', width: '100%' }}
              />
            </div>
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
                {!isGuest && <th style={{ width: '130px' }}>Hành động</th>}
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
                      {!isGuest && (
                        <td style={{ padding: '8px 14px', display: 'flex', gap: '6px', borderLeft: 'none' }}>
                          <button 
                            onClick={() => handleOpenEdit(m)}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', fontSize: '11px', cursor: 'pointer' }}
                          >
                            ✏️ Sửa
                          </button>
                          <button 
                            onClick={() => handleRemoveMember(m)}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '11px', cursor: 'pointer' }}
                          >
                            ❌ Rút
                          </button>
                        </td>
                      )}
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

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-content medium" style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '500px', maxWidth: '90%', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                ➕ Thêm hội viên mới ({selectedTab === 'seniors' ? 'Người cao tuổi' : 'Cựu chiến binh'})
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Nhập họ và tên hội viên..." 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Giới tính
                  </label>
                  <select 
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Ngày sinh
                  </label>
                  <input 
                    type="date" 
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số điện thoại
                  </label>
                  <input 
                    type="text" 
                    placeholder="Số điện thoại..." 
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số CCCD
                  </label>
                  <input 
                    type="text" 
                    placeholder="Số CCCD..." 
                    value={newCccd}
                    onChange={(e) => setNewCccd(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  {selectedTab === 'seniors' ? 'Nghề nghiệp / Công việc' : 'Chức vụ / Công việc'}
                </label>
                <input 
                  type="text" 
                  placeholder={selectedTab === 'seniors' ? 'Ví dụ: Hưu trí, Tự do...' : 'Ví dụ: Chi hội trưởng, Hội viên...'} 
                  value={newOccupation}
                  onChange={(e) => setNewOccupation(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  Liên kết Hộ gia đình
                </label>
                <select 
                  value={newHouseholdId}
                  onChange={(e) => setNewHouseholdId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="">-- Không liên kết / Chọn hộ gia đình --</option>
                  {households.map(hh => {
                    const head = allResidents.find(r => r.id === hh.head_of_household_id);
                    const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
                    return (
                      <option key={hh.id} value={hh.id}>
                        {hh.household_number} - Chủ hộ: {headName} ({hh.address})
                      </option>
                    );
                  })}
                </select>
              </div>

              {!newHouseholdId && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Địa chỉ cư trú (Nhập tay nếu không chọn hộ)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Tổ 4, TDP Quảng Giao..." 
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Trạng thái cư trú
                  </label>
                  <select 
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="resident">Thường trú</option>
                    <option value="temporary_resident">Tạm trú</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Quan hệ với chủ hộ
                  </label>
                  <input 
                    type="text" 
                    placeholder="Chủ hộ, Vợ, Con, Cháu..." 
                    value={newRelationship}
                    onChange={(e) => setNewRelationship(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--gov-blue)', color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Thêm mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {isEditModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-content medium" style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '500px', maxWidth: '90%', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                ✏️ Chỉnh sửa thông tin hội viên ({selectedTab === 'seniors' ? 'Người cao tuổi' : 'Cựu chiến binh'})
              </h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditingResident(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Nhập họ và tên hội viên..." 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Giới tính
                  </label>
                  <select 
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Ngày sinh
                  </label>
                  <input 
                    type="date" 
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số điện thoại
                  </label>
                  <input 
                    type="text" 
                    placeholder="Số điện thoại..." 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số CCCD
                  </label>
                  <input 
                    type="text" 
                    placeholder="Số CCCD..." 
                    value={editCccd}
                    onChange={(e) => setEditCccd(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  {selectedTab === 'seniors' ? 'Nghề nghiệp / Công việc' : 'Chức vụ / Công việc'}
                </label>
                <input 
                  type="text" 
                  placeholder={selectedTab === 'seniors' ? 'Ví dụ: Hưu trí, Tự do...' : 'Ví dụ: Chi hội trưởng, Hội viên...'} 
                  value={editOccupation}
                  onChange={(e) => setEditOccupation(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                  Liên kết Hộ gia đình
                </label>
                <select 
                  value={editHouseholdId}
                  onChange={(e) => setEditHouseholdId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="">-- Không liên kết / Chọn hộ gia đình --</option>
                  {households.map(hh => {
                    const head = allResidents.find(r => r.id === hh.head_of_household_id);
                    const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
                    return (
                      <option key={hh.id} value={hh.id}>
                        {hh.household_number} - Chủ hộ: {headName} ({hh.address})
                      </option>
                    );
                  })}
                </select>
              </div>

              {!editHouseholdId && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Địa chỉ cư trú (Nhập tay nếu không chọn hộ)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Tổ 4, TDP Quảng Giao..." 
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Trạng thái cư trú
                  </label>
                  <select 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="resident">Thường trú</option>
                    <option value="temporary_resident">Tạm trú</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Quan hệ với chủ hộ
                  </label>
                  <input 
                    type="text" 
                    placeholder="Chủ hộ, Vợ, Con, Cháu..." 
                    value={editRelationship}
                    onChange={(e) => setEditRelationship(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => { setIsEditModalOpen(false); setEditingResident(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--gov-blue)', color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CCBElderly;
