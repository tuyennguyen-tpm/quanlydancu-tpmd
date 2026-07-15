import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/db';
import type { Resident, Household } from '../types';
import ExcelJS from 'exceljs';
import { 
  FileUp, 
  FileDown, 
  Printer, 
  UserPlus, 
  Search, 
  X 
} from 'lucide-react';

const WomenAssociation = () => {
  const [members, setMembers] = useState<Resident[]>([]);
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [residentSearchQuery, setResidentSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states for adding member
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
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
  const [editDob, setEditDob] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCccd, setEditCccd] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editStatus, setEditStatus] = useState<'resident' | 'temporary_resident'>('resident');
  const [editHouseholdId, setEditHouseholdId] = useState('');
  const [editRelationship, setEditRelationship] = useState('Thành viên');
  const [editAddress, setEditAddress] = useState('');

  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    executiveBoardCount: 3,
  });

  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'chi_hoi_phu_nu' && currentRole !== 'to_truong' && currentRole !== 'admin');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  const savedGroups = localStorage.getItem('tdp_groups_config');
  const groupsList = savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];

  const loadData = async () => {
    try {
      const [residents, hhList] = await Promise.all([
        db.getResidents(),
        db.getHouseholds()
      ]);
      
      // Debug: log all residents and their memberships
      console.log('[WomenAssociation] All residents:', residents.map(r => ({
        id: r.id, name: r.full_name, gender: r.gender, membership: r.association_membership
      })));
      
      const activeFemales = residents.filter(r => {
        if (r.status === 'deceased') return false;
        const membership = r.association_membership || '';
        const codes = membership.split(',').map(s => s.trim()).filter(Boolean);
        const hasPn = codes.includes('pn');
        console.log(`[WomenAssociation] ${r.full_name}: membership="${membership}", codes=[${codes}], hasPn=${hasPn}`);
        return hasPn;
      });
      
      console.log('[WomenAssociation] Filtered pn members:', activeFemales.map(r => r.full_name));
      
      setMembers(activeFemales);
      setHouseholds(hhList);
      setAllResidents(residents);
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

  const getAge = (dobString: string) => {
    if (!dobString) return '—';
    const year = parseInt(dobString.substring(0, 4));
    return isNaN(year) ? '—' : `${new Date().getFullYear() - year}`;
  };

  const residentSearchResults = useMemo(() => {
    if (residentSearchQuery.trim().length < 2) return [];
    return allResidents.filter(r => {
      if (r.status === 'deceased') return false;
      if (r.gender !== 'female') return false; // Women's Association is for women only!
      const codes = (r.association_membership || '').split(',').map(s => s.trim()).filter(Boolean);
      if (codes.includes('pn')) return false;
      return r.full_name.toLowerCase().includes(residentSearchQuery.toLowerCase());
    }).slice(0, 5);
  }, [residentSearchQuery, allResidents]);

  const handleAddPnMember = async (resident: Resident) => {
    if (isGuest) {
      alert('Tài khoản của bạn không có quyền sửa đổi danh sách!');
      return;
    }
    try {
      const currentCodes = (resident.association_membership || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
        
      if (!currentCodes.includes('pn')) {
        currentCodes.push('pn');
      }
      
      const updatedResident = {
        ...resident,
        association_membership: currentCodes.join(',')
      };
      
      await db.saveResident(updatedResident);
      setResidentSearchQuery(''); // clear search
      loadData();
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã thêm hội viên ${resident.full_name} vào Hội Phụ nữ thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra khi thêm hội viên: ${err.message || err}`);
    }
  };

  const filteredMembers = members.filter(m => {
    // Search query match
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.phone && m.phone.includes(searchQuery));
    
    // Group filter match
    let matchesGroup = true;
    if (groupFilter !== 'all') {
      const hh = households.find(h => h.id === m.household_id);
      if (!hh || !hh.self_management_group) {
        matchesGroup = false;
      } else {
        const smg = hh.self_management_group.trim().toLowerCase();
        const filterVal = groupFilter.trim().toLowerCase();

        if (smg === filterVal) {
          matchesGroup = true;
        } else {
          // So khớp thông minh theo số Tổ ở cuối chuỗi
          const extractNum = (s: string) => {
            const match = s.match(/(\d+)\s*$/);
            return match ? match[1] : null;
          };
          const extractName = (s: string) => {
            const lower = s.toLowerCase();
            if (lower.includes('việt trung')) return 'việt trung';
            return null;
          };

          const numFilter = extractNum(filterVal);
          const numSmg = extractNum(smg);
          const nameFilter = extractName(filterVal);
          const nameSmg = extractName(smg);

          if (nameFilter && nameSmg) {
            matchesGroup = nameFilter === nameSmg;
          } else if (nameFilter) {
            matchesGroup = smg.includes(nameFilter);
          } else if (numFilter && numSmg) {
            matchesGroup = numFilter === numSmg;
          } else {
            matchesGroup = false;
          }
        }
      }
    }
    
    return matchesSearch && matchesGroup;
  });

  // Printer function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const currentGroup = groupFilter === 'all' ? 'Tất cả các tổ' : groupFilter;

    let rowsHtml = '';
    filteredMembers.forEach((m, idx) => {
      const dob = m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập';
      const hh = households.find(h => h.id === m.household_id);
      const groupName = hh?.self_management_group || 'TDP Quảng Giao';
      const statusText = m.status === 'resident' ? 'Thường trú' : 'Tạm trú';
      rowsHtml += `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; white-space: nowrap;">${m.full_name}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${dob}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${m.phone || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.occupation || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${groupName}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${statusText}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>DANH SÁCH HỘI VIÊN PHỤ NỮ</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
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
            <h2 style="margin: 0;">DANH SÁCH HỘI VIÊN CHI HỘI PHỤ NỮ</h2>
            <p style="margin: 5px 0 0 0; font-weight: 500;">Bộ lọc: ${currentGroup}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">STT</th>
                <th>Họ và tên</th>
                <th style="width: 110px;">Ngày sinh</th>
                <th style="width: 120px;">Số điện thoại</th>
                <th>Nghề nghiệp</th>
                <th>Tổ dân phố</th>
                <th style="width: 100px;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">Không có dữ liệu hội viên phụ nữ.</td></tr>'}
            </tbody>
          </table>
          <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px;">
            <div style="text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">NGƯỜI LẬP BIỂU</p>
              <p style="font-style: italic; color: #999;">(Ký, ghi rõ họ tên)</p>
            </div>
            <div style="text-align: center;">
              <p style="font-weight: bold; margin-bottom: 60px;">TM. CHI HỘI PHỤ NỮ</p>
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

  // Excel export function
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('HoiVienPhuNu');

      const headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Điện thoại', 'Nghề nghiệp', 'Tổ dân phố', 'Địa chỉ cư trú', 'Trạng thái'];
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
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
      });

      filteredMembers.forEach((m, idx) => {
        const dob = m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập';
        const hh = households.find(h => h.id === m.household_id);
        const groupName = hh?.self_management_group || 'TDP Quảng Giao';
        const address = m.temporary_address || m.permanent_address || hh?.address || 'TDP Quảng Giao';
        const statusText = m.status === 'resident' ? 'Thường trú' : 'Tạm trú';

        const addedRow = worksheet.addRow([
          idx + 1,
          m.full_name,
          dob,
          m.phone || '',
          m.occupation || 'Tự do',
          groupName,
          address,
          statusText
        ]);
        
        addedRow.height = 24;
        addedRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 8 ? 'center' : 'left'
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
      link.setAttribute('download', `danh_sach_hoi_vien_phu_nu_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã xuất danh sách hội viên phụ nữ thành công!`, type: 'success' } 
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
        const dobIdx = header.findIndex(h => h.includes('sinh') || h.includes('dob'));
        const phoneIdx = header.findIndex(h => h.includes('thoại') || h.includes('phone') || h.includes('sđt'));
        const occIdx = header.findIndex(h => h.includes('nghề') || h.includes('job') || h.includes('việc'));
        const addrIdx = header.findIndex(h => h.includes('chỉ') || h.includes('địa') || h.includes('address'));
        
        let addedCount = 0;
        
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

          const newRes: Omit<Resident, 'created_at' | 'is_senior'> = {
            id: 'R_IMP_' + Math.random().toString(36).substring(2, 9),
            household_id: households[0]?.id || '',
            full_name: name.trim(),
            gender: 'female',
            dob: parsedDob || '',
            phone: (phoneIdx >= 0 ? row[phoneIdx] : '').trim(),
            occupation: (occIdx >= 0 ? row[occIdx] : 'Tự do').trim(),
            permanent_address: (addrIdx >= 0 ? row[addrIdx] : 'TDP Quảng Giao').trim(),
            status: 'resident',
            is_head: false,
            relationship_with_head: 'Thành viên',
            cccd: '',
            association_membership: 'pn'
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

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Vui lòng nhập họ và tên!');
      return;
    }

    try {
      const selectedHh = households.find(h => h.id === newHouseholdId);
      const newRes: Omit<Resident, 'created_at' | 'is_senior'> = {
        id: 'R_' + Math.random().toString(36).substring(2, 9),
        household_id: newHouseholdId || '',
        full_name: newName.trim(),
        gender: 'female',
        dob: newDob || '',
        phone: newPhone.trim(),
        cccd: newCccd.trim(),
        occupation: newOccupation.trim() || 'Tự do',
        permanent_address: selectedHh?.address || newAddress.trim() || 'TDP Quảng Giao',
        status: newStatus,
        is_head: false,
        relationship_with_head: newRelationship,
        association_membership: 'pn'
      };

      await db.saveResident(newRes);
      
      setIsAddModalOpen(false);
      setNewName('');
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
    const confirmRemove = window.confirm(`Bạn có chắc chắn muốn rút hội viên ${res.full_name} ra khỏi Hội Phụ nữ?`);
    if (!confirmRemove) return;

    try {
      const membership = res.association_membership || '';
      const updatedMembership = membership
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== 'pn' && s !== '')
        .join(', ');

      const updatedRes = {
        ...res,
        association_membership: updatedMembership
      };

      await db.saveResident(updatedRes);
      loadData();
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Đã rút hội viên ${res.full_name} ra khỏi Hội Phụ nữ thành công!`, type: 'success' } 
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>👩‍🦰 Quản lý Hội Phụ nữ Tổ dân phố</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Danh sách hội viên, ban chấp hành và các phong trào thi đua an sinh xã hội</p>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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

      {/* ACTIONS BAR (Mockup design alignment) */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
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

      {/* SEARCH, FILTER AND TABLE */}
      <div className="card-gov">
        <div className="card-gov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title"><span className="title-dot"></span>Danh sách hội viên Phụ nữ ({filteredMembers.length})</div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search to Add Dropdown */}
            {!isGuest && (
              <div style={{ position: 'relative', width: '280px', display: 'inline-block' }}>
                <div className="search-box" style={{ width: '100%', border: '1px solid var(--border)' }}>
                  <UserPlus size={14} style={{ color: '#D81B60' }} />
                  <input
                    type="text"
                    placeholder="Nhập tên nhân khẩu để thêm..."
                    value={residentSearchQuery}
                    onChange={e => setResidentSearchQuery(e.target.value)}
                    style={{ fontSize: '12.5px' }}
                  />
                </div>

                {residentSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 50,
                    marginTop: '4px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    textAlign: 'left'
                  }}>
                    {residentSearchResults.map((r: Resident) => {
                      const age = getAge(r.dob);
                      return (
                        <div 
                          key={r.id} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: '1px solid #fce4ec',
                            fontSize: '12.5px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.full_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {age} tuổi | {r.permanent_address || 'Không rõ địa chỉ'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddPnMember(r)}
                            style={{
                              padding: '3px 8px',
                              background: '#D81B60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Thêm
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lọc theo tổ */}
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '500',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả các tổ</option>
              {groupsList.map((g: string) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Tìm kiếm */}
            <div className="search-box" style={{ width: '220px' }}>
              <Search size={14} />
              <input 
                type="text" 
                placeholder="Tìm kiếm hội viên..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                <th>Điện thoại</th>
                <th>Nghề nghiệp</th>
                <th>Tổ dân phố</th>
                <th>Địa chỉ cư trú</th>
                <th>Trạng thái</th>
                {!isGuest && <th style={{ width: '130px' }}>Hành động</th>}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length > 0 ? (
                filteredMembers.map(m => {
                  const hh = households.find(h => h.id === m.household_id);
                  const groupName = hh?.self_management_group || 'TDP Quảng Giao';
                  const address = m.temporary_address || m.permanent_address || hh?.address || 'TDP Quảng Giao';
                  return (
                    <tr key={m.id}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{m.full_name}</td>
                      <td>{m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'Chưa nhập'}</td>
                      <td>{m.phone || 'Chưa nhập'}</td>
                      <td>{m.occupation || 'Tự do'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--gov-blue)' }}>{groupName}</td>
                      <td>{address}</td>
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
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy hội viên phụ nữ nào khớp kết quả tìm kiếm.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} style={{ color: '#2563eb' }} />
                Thêm Hội viên Phụ nữ Mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    Ngày sinh
                  </label>
                  <input 
                    type="date" 
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số điện thoại
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập số điện thoại..." 
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số CCCD
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập số CCCD..." 
                    value={newCccd}
                    onChange={(e) => setNewCccd(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Nghề nghiệp
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nghề nghiệp..." 
                    value={newOccupation}
                    onChange={(e) => setNewOccupation(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
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
                    placeholder="Ví dụ: Số 45, Nam Sầm Sơn..." 
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
                    placeholder="Vợ, Con, Cháu..." 
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✏️ Chỉnh sửa thông tin hội viên
              </h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditingResident(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    Ngày sinh
                  </label>
                  <input 
                    type="date" 
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số điện thoại
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập số điện thoại..." 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Số CCCD
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nhập số CCCD..." 
                    value={editCccd}
                    onChange={(e) => setEditCccd(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px', textAlign: 'left' }}>
                    Nghề nghiệp
                  </label>
                  <input 
                    type="text" 
                    placeholder="Nghề nghiệp..." 
                    value={editOccupation}
                    onChange={(e) => setEditOccupation(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
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
                    placeholder="Ví dụ: Số 45, Nam Sầm Sơn..." 
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
                    placeholder="Vợ, Con, Cháu..." 
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

export default WomenAssociation;
