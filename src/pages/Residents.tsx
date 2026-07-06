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
  Printer,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { db, generateUUID, mapToUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Resident, Household } from '../types';
import ExcelJS from 'exceljs';

const MILESTONE_AGES = [70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];

const getLongevityAge = (dobStr: string, targetYear: number) => {
  if (!dobStr) return -1;
  const parts = dobStr.split(/[-/]/);
  // Đối với định dạng YYYY-MM-DD, phần tử đầu tiên là năm. 
  // Đối với định dạng DD/MM/YYYY, phần tử cuối cùng là năm.
  let yearStr = parts[0];
  if (parts.length === 3 && parts[2].length === 4) {
    yearStr = parts[2];
  }
  const birthYear = parseInt(yearStr, 10);
  if (isNaN(birthYear) || birthYear <= 0) return -1;
  return targetYear - birthYear;
};

const parseCSV = (text: string) => {
  const lines: string[][] = [];
  
  const firstLine = text.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';
  if (firstLine.split('\t').length > firstLine.split(delimiter).length) delimiter = '\t';
  
  const rawLines = text.split(/\r\n|\n|\r/);
  
  for (let l = 0; l < rawLines.length; l++) {
    const line = rawLines[l];
    if (!line.trim()) continue;

    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i+1];
      
      if (c === '"') {
        if (!inQuotes && entry.trim() === '') {
          inQuotes = true;
        } else if (inQuotes) {
          if (next === '"') {
            entry += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          entry += '"';
        }
      } else if (c === delimiter && !inQuotes) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    
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
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
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

const SearchableHouseholdSelect = ({ households, residents, value, onChange }: { households: Household[], residents: Resident[], value: string, onChange: (val: string) => void }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedHousehold = households.find(h => h.id === value);
  let displayValue = '-- Chọn hộ dân cư trú --';
  if (selectedHousehold) {
    const headRes = residents.find(r => r.id === selectedHousehold.head_of_household_id);
    displayValue = `${selectedHousehold.address} (Chủ hộ: ${headRes ? headRes.full_name : selectedHousehold.household_number})`;
  }

  const filtered = households.filter(h => {
    if (!search) return true;
    const headRes = residents.find(r => r.id === h.head_of_household_id);
    const text = `${h.address} ${headRes ? headRes.full_name : h.household_number}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }).slice(0, 50);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '10px', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          backgroundColor: 'white', 
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayValue}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>▼</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          zIndex: 50,
          maxHeight: '280px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <input
            type="text"
            placeholder="Tìm theo tên chủ hộ, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ margin: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none' }}
            autoFocus
          />
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '8px' }}>
            <div 
              onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
            >
              -- Không chọn hộ dân --
            </div>
            {filtered.map(h => {
              const headRes = residents.find(r => r.id === h.head_of_household_id);
              return (
                <div 
                  key={h.id}
                  onClick={() => { onChange(h.id); setIsOpen(false); setSearch(''); }}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                >
                  {h.address} (Chủ hộ: <strong>{headRes ? headRes.full_name : h.household_number}</strong>)
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy hộ dân nào khớp!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Residents = () => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'senior' | 'child' | 'military' | 'longevity'>('all');
  const [householdFilter, setHouseholdFilter] = useState<string>('all');
  const [showDeceased, setShowDeceased] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [longevityYear, setLongevityYear] = useState<number>(new Date().getFullYear());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, householdFilter, showDeceased, groupFilter, longevityYear]);

  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [importAlertData, setImportAlertData] = useState<{
    isOpen: boolean;
    addedCount: number;
    updatedCount: number;
    addedNames: string[];
  } | null>(null);

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
  const [status, setStatus] = useState<'resident' | 'temporary_absent' | 'temporary_resident' | 'deceased' | 'stay'>('resident');
  const [householdId, setHouseholdId] = useState('');
  const [pob, setPob] = useState('');
  const [notes, setNotes] = useState('');

  // Các trường thông tin hành chính Việt Nam mới bổ sung
  const [nativePlace, setNativePlace] = useState('');
  const [ethnicity, setEthnicity] = useState('Kinh');
  const [religion, setReligion] = useState('Không');
  const [nationality, setNationality] = useState('Việt Nam');
  const [educationLevel, setEducationLevel] = useState('12/12');
  const [militaryService, setMilitaryService] = useState<'in_age' | 'serving' | 'completed' | 'exempted' | 'none'>('none');
  const [healthInsuranceNumber, setHealthInsuranceNumber] = useState('');
  const [hasHealthInsurance, setHasHealthInsurance] = useState(true);
  const [temporaryResidenceExpiry, setTemporaryResidenceExpiry] = useState('');
  const [associationMembership, setAssociationMembership] = useState('');
  const [deathDate, setDeathDate] = useState('');

  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d/]/g, '');
    
    if (value.length === 2 && temporaryResidenceExpiry.length === 1) {
      value = value + '/';
    } else if (value.length === 5 && temporaryResidenceExpiry.length === 4) {
      value = value + '/';
    }
    
    if (value.length <= 10) {
      setTemporaryResidenceExpiry(value);
    }
  };

  const handleDeathDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d/]/g, '');
    
    if (value.length === 2 && deathDate.length === 1) {
      value = value + '/';
    } else if (value.length === 5 && deathDate.length === 4) {
      value = value + '/';
    }
    
    if (value.length <= 10) {
      setDeathDate(value);
    }
  };

  const associations = associationMembership ? associationMembership.split(',') : [];
  const hasAssociation = (code: string) => associations.includes(code);
  const toggleAssociation = (code: string) => {
    const current = associationMembership ? associationMembership.split(',') : [];
    let updated;
    if (current.includes(code)) {
      updated = current.filter(c => c !== code);
    } else {
      updated = [...current, code];
    }
    setAssociationMembership(updated.join(','));
  };

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
      const [rList, hList] = await Promise.all([
        db.getResidents(),
        db.getHouseholds()
      ]);
      setResidents(rList);
      setHouseholds(hList);
    } catch (e) {
      showToast('Lỗi tải dữ liệu nhân khẩu!', 'danger');
    }
  };

  const getDbMatchSuggestions = (name: string) => {
    const cleanName = (str: string) => {
      return (str || '')
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };
    const target = cleanName(name);
    const matches = residents.filter(r => cleanName(r.full_name) === target);
    if (matches.length > 0) {
      return `Có ${matches.length} người trùng tên trong hệ thống hiện tại (Có Ngày sinh là: ${matches.map(m => m.dob ? formatToDisplayDate(m.dob) : 'Trống').join(', ')})`;
    }
    return 'Không tìm thấy ai có tên này trong dữ liệu hiện tại trên Web!';
  };

  const handleOpenAddRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadData();

    // Listen to quick add event from Dashboard — use ref to avoid stale closure
    const handleOpenQuickAdd = () => {
      handleOpenAddRef.current();
    };
    window.addEventListener('open-add-resident-modal', handleOpenQuickAdd);

    // Tự động tải lại dữ liệu khi trang Hộ gia đình hoặc trang khác thay đổi dữ liệu
    const handleDbChanged = () => {
      loadData();
    };
    window.addEventListener('db-changed', handleDbChanged);

    return () => {
      window.removeEventListener('open-add-resident-modal', handleOpenQuickAdd);
      window.removeEventListener('db-changed', handleDbChanged);
    };
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
    setPermanentAddress('Quảng Giao, Sầm Sơn, Thanh Hóa');
    setTemporaryAddress('');
    setRelationshipWithHead('Con');
    setIsHead(false);
    setStatus('resident');
    setHouseholdId('');
    setPob('');
    setNotes('');

    // Khởi tạo các trường mới
    setNativePlace('Quảng Giao, Sầm Sơn, Thanh Hóa');
    setEthnicity('Kinh');
    setReligion('Không');
    setNationality('Việt Nam');
    setEducationLevel('12/12');
    setMilitaryService('none');
    setHealthInsuranceNumber('');
    setHasHealthInsurance(true);
    setTemporaryResidenceExpiry('');
    setDeathDate('');
    setAssociationMembership('');
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

    // Khởi tạo trường mới từ đối tượng r
    setNativePlace(r.native_place || '');
    setEthnicity(r.ethnicity || 'Kinh');
    setReligion(r.religion || 'Không');
    setNationality(r.nationality || 'Việt Nam');
    setEducationLevel(r.education_level || '12/12');
    setMilitaryService(r.military_service || 'none');
    setHealthInsuranceNumber(r.health_insurance_number || '');
    setHasHealthInsurance(r.has_health_insurance !== false);
    setTemporaryResidenceExpiry(r.temporary_residence_expiry ? formatToDisplayDate(r.temporary_residence_expiry) : '');
    setDeathDate(r.death_date ? formatToDisplayDate(r.death_date) : '');
    setAssociationMembership(r.association_membership || '');
    setIsFormOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast('Tài khoản của bạn không có quyền chỉnh sửa nhân khẩu!', 'warning');
      return;
    }
    if (!fullName.trim() || !dob) {
      showToast('Vui lòng điền họ tên và ngày sinh!', 'warning');
      return;
    }

    if (!isValidDate(dob)) {
      showToast('Ngày sinh không đúng định dạng dd/mm/yyyy (Ví dụ: 02/01/1940)!', 'warning');
      return;
    }

    const dbDob = formatToDbDate(dob);
    const dbExpiry = temporaryResidenceExpiry ? formatToDbDate(temporaryResidenceExpiry) : '';

    if (cccd.trim() && !/^\d{12}$/.test(cccd.trim())) {
      showToast('Số CCCD / Định danh cá nhân phải có đúng 12 chữ số!', 'warning');
      return;
    }

    if (status === 'temporary_resident' && temporaryResidenceExpiry && !isValidDate(temporaryResidenceExpiry)) {
      showToast('Thời hạn tạm trú không đúng định dạng dd/mm/yyyy!', 'warning');
      return;
    }

    if (status === 'deceased' && deathDate && !isValidDate(deathDate)) {
      showToast('Ngày mất không đúng định dạng dd/mm/yyyy!', 'warning');
      return;
    }

    const dbDeathDate = (status === 'deceased' && deathDate) ? formatToDbDate(deathDate) : '';

    const payload: Omit<Resident, 'is_senior' | 'created_at'> & { is_senior?: boolean; created_at?: string } = {
      id: editingResident ? editingResident.id : generateUUID(),
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
      
      // Các trường thông tin mới
      native_place: nativePlace,
      ethnicity,
      religion,
      nationality,
      education_level: educationLevel,
      military_service: militaryService,
      health_insurance_number: healthInsuranceNumber,
      has_health_insurance: hasHealthInsurance,
      temporary_residence_expiry: dbExpiry || undefined,
      death_date: dbDeathDate || undefined,
      association_membership: associationMembership,

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
    if (isGuest) {
      showToast('Tài khoản của bạn không có quyền xóa nhân khẩu!', 'warning');
      return;
    }
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

  const handleDeleteAll = async () => {
    if (isGuest) {
      showToast('Tài khoản của bạn không có quyền xóa toàn bộ dữ liệu!', 'warning');
      return;
    }
    if (window.confirm('CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn XÓA SẠCH TOÀN BỘ dữ liệu nhân khẩu và hộ gia đình khỏi hệ thống không? Hành động này KHÔNG THỂ PHỤC HỒI!')) {
      const confirmText = window.prompt('Vui lòng gõ chữ XOA (viết hoa, không dấu) vào ô bên dưới để xác nhận xóa toàn bộ dữ liệu:');
      if (confirmText === 'XOA') {
        try {
          showToast('Đang tiến hành xóa toàn bộ dữ liệu...', 'warning');
          await (db as any).deleteAllData();
          showToast('Đã xóa sạch toàn bộ dữ liệu thành công!', 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        } catch (e) {
          showToast('Lỗi khi xóa dữ liệu!', 'danger');
        }
      } else {
        showToast('Đã hủy thao tác xóa vì xác nhận không chính xác.', 'info');
      }
    }
  };

  // Export to Excel/CSV Functionality
  const handleExportCSV = async () => {
    if (filteredResidents.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    showToast('Đang khởi tạo file Excel...', 'info');

    const headers = [
      'Số sổ hộ khẩu', 'Họ tên', 'Giới tính', 'Ngày sinh', 'Quan hệ chủ hộ', 'CCCD / Định danh', 'SĐT', 
      'Nghề nghiệp', 'Cụm/Tổ', 'Thường trú', 
      'Nơi sinh', 'Quê quán', 'Dân tộc', 'Tôn giáo', 'Quốc tịch', 
      'Trình độ học vấn', 'Nghĩa vụ quân sự', 'Bảo hiểm y tế', 'Thời hạn tạm trú', 'Trạng thái cư trú', 
      'Ngày mất', 'Tuổi khi mất', 'Ghi chú'
    ];

    const rows = filteredResidents.map(r => {
      const hh = households.find(h => h.id === r.household_id);
      const hhNum = hh ? hh.household_number : '';
      
      // Tính tuổi khi mất nếu đã mất và có ngày sinh + ngày mất
      let ageAtDeath = '';
      if (r.status === 'deceased' && r.dob && r.death_date) {
        const birthYear = new Date(r.dob).getFullYear();
        const deathYear = new Date(r.death_date).getFullYear();
        if (birthYear > 0 && deathYear > 0) {
          ageAtDeath = (deathYear - birthYear).toString();
        }
      }

      return [
        hhNum || '',
        r.full_name,
        r.gender === 'male' ? 'Nam' : r.gender === 'female' ? 'Nữ' : 'Khác',
        r.dob ? formatToDisplayDate(r.dob) : '',
        r.relationship_with_head,
        r.cccd || '',
        r.phone || '',
        r.occupation || '',
        hh?.self_management_group || '', // Cụm/Tổ
        r.permanent_address || '', // Thường trú
        r.pob || '',
        r.native_place || '',
        r.ethnicity || 'Kinh',
        r.religion || 'Không',
        r.nationality || 'Việt Nam',
        r.education_level || '12/12',
        r.military_service === 'in_age' ? 'Trong độ tuổi quân sự' : r.military_service === 'serving' ? 'Đang tại ngũ' : r.military_service === 'completed' ? 'Đã hoàn thành' : r.military_service === 'exempted' ? 'Tạm hoãn/Miễn' : 'Không',
        r.has_health_insurance ? (r.health_insurance_number || 'Đã có BHYT') : 'Chưa có BHYT',
        r.temporary_residence_expiry ? formatToDisplayDate(r.temporary_residence_expiry) : '',
        r.status === 'resident' ? 'Thường trú' : r.status === 'temporary_resident' ? 'Tạm trú' : r.status === 'temporary_absent' ? 'Tạm vắng' : r.status === 'stay' ? 'Lưu trú' : 'Đã mất',
        r.status === 'deceased' && r.death_date ? formatToDisplayDate(r.death_date) : '',
        ageAtDeath,
        r.notes || ''
      ];
    });

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách nhân khẩu');

      // Tạo cấu trúc cột
      worksheet.columns = headers.map(h => ({ header: h, key: h }));

      // Thêm các dòng dữ liệu và thiết lập kiểu dáng
      rows.forEach((row, rowIndex) => {
        const addedRow = worksheet.addRow(row);
        const resident = filteredResidents[rowIndex];

        // Nếu là chủ hộ, tô màu nền xanh lá nhạt và chữ xanh đậm
        if (resident.is_head) {
          addedRow.eachCell(cell => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE6F4EA' } // Xanh lá nhạt #E6F4EA
            };
            cell.font = {
              bold: true,
              color: { argb: 'FF137333' }, // Xanh lá đậm #137333
              name: 'Segoe UI',
              size: 11
            };
          });
        } else {
          addedRow.eachCell(cell => {
            cell.font = {
              name: 'Segoe UI',
              size: 11
            };
          });
        }
      });

      // Căn chỉnh tiêu đề dòng đầu tiên
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' } // Màu Teal tối #0F766E
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }, // Chữ trắng
          name: 'Segoe UI',
          size: 11
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
      });

      // Áp dụng đường viền lưới cho toàn bộ các ô và tự động co giãn độ rộng cột
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
          if (rowNumber > 1) {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left'
            };
          }
        });
      });

      // Tự co giãn độ rộng cột
      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.values?.forEach(v => {
          const valStr = v ? v.toString() : '';
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        });
        column.width = Math.min(Math.max(maxLen + 4, 12), 40); // Giới hạn tối thiểu 12 và tối đa 40 ký tự
      });

      // Tạo Buffer và tải xuống
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const tdpName = localStorage.getItem('tdp_name') || 'quang_giao';
      const filenameTdp = tdpName.toLowerCase().replace(/\s+/g, '_');
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `danh_sach_nhan_khau_${filenameTdp}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('Xuất báo cáo Excel thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel!', 'danger');
    }
  };

  const handleExportLongevityExcel = async () => {
    // Lọc danh sách các cụ mừng thọ theo năm đã chọn
    const longevityResidents = filteredResidents.filter(r => {
      const age = getLongevityAge(r.dob, longevityYear);
      return MILESTONE_AGES.includes(age) && r.status !== 'deceased';
    });

    if (longevityResidents.length === 0) {
      showToast('Không có dữ liệu người cao tuổi mừng thọ để xuất!', 'warning');
      return;
    }

    showToast('Đang khởi tạo file Excel mừng thọ...', 'info');

    const headers = [
      'STT', 'Họ tên', 'Ngày sinh', 'Tuổi mừng thọ', 'Cụm/Tổ', 'Địa chỉ', 'CCCD / Định danh', 'SĐT', 'Ghi chú'
    ];

    const rows = longevityResidents.map((r, idx) => {
      const hh = households.find(h => h.id === r.household_id);
      const age = getLongevityAge(r.dob, longevityYear);
      return [
        idx + 1,
        r.full_name,
        r.dob ? formatToDisplayDate(r.dob) : '',
        `${age} tuổi`,
        hh?.self_management_group || '',
        hh?.address || '',
        r.cccd || '',
        r.phone || '',
        r.notes || ''
      ];
    });

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Mừng thọ năm ${longevityYear}`);

      // Tiêu đề lớn của bảng
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `DANH SÁCH CÁC CỤ MỪNG THỌ NĂM ${longevityYear}`;
      titleCell.font = { bold: true, name: 'Segoe UI', size: 16, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      // Hàng tiêu đề bảng (hàng 3)
      const headerRowNumber = 3;
      worksheet.getRow(2).height = 15;
      
      const headerRow = worksheet.getRow(headerRowNumber);
      headerRow.height = 28;
      
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
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

      // Thêm dữ liệu
      rows.forEach((row) => {
        const addedRow = worksheet.addRow(row);
        addedRow.height = 24;
        addedRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 11 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 ? 'center' : 'left'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });
      });

      // Tự co giãn độ rộng cột
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

      // Tạo Buffer và tải xuống
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const tdpName = localStorage.getItem('tdp_name') || 'quang_giao';
      const filenameTdp = tdpName.toLowerCase().replace(/\s+/g, '_');
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `danh_sach_mung_tho_${longevityYear}_${filenameTdp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('Xuất báo cáo mừng thọ thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel mừng thọ!', 'danger');
    }
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
    } else if (categoryFilter === 'military') {
      filterSubtitle = 'Danh sách Thanh niên trong độ tuổi Nghĩa vụ quân sự (18-27 tuổi)';
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
          <td style="text-align: center;">${r.relationship_with_head}</td>
          <td style="text-align: center;">${r.cccd || ''}</td>
          <td style="text-align: center;">${r.phone || ''}</td>
          <td>${r.pob || ''}</td>
          <td>${r.permanent_address || ''}</td>
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
              <th style="width: 8%;">Quan hệ với chủ hộ</th>
              <th style="width: 9%;">Số CCCD</th>
              <th style="width: 8%;">Số điện thoại</th>
              <th style="width: 13%;">Nơi sinh</th>
              <th style="width: 15%;">Thường trú</th>
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
    if (isGuest) {
      showToast('Tài khoản của bạn không có quyền nhập dữ liệu!', 'warning');
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
            showToast('File Excel không có trang tính nào!', 'warning');
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
            showToast('File không có dữ liệu hoặc lỗi đọc file!', 'danger');
            return;
          }
          rows = parseCSV(text);
        }

        if (rows.length <= 1) {
          showToast('File không chứa bản ghi nhân khẩu hợp lệ!', 'warning');
          return;
        }

        const [currentResidents, currentHouseholds] = await Promise.all([
          db.getResidents(),
          db.getHouseholds()
        ]);
        let addedCount = 0;
        let updatedCount = 0;
        let skipCount = 0;
        const addedNames: string[] = [];

        const householdsToSave: Household[] = [];
        const residentsToSave: Resident[] = [];

        let currentHouseholdId = '';
        let currentHouseholdNumber = Date.now();
        let lastCsvHhNum = '';

        // 1. Phân tích để tìm dòng tiêu đề (Header Row)
        let nameIdx = 0, genderIdx = 1, dobIdx = 2, addressIdx = 3, cccdIdx = 4, phoneIdx = 5, relIdx = 6, occIdx = 7, pobIdx = 8, statusIdx = 9, notesIdx = 10, hhNumIdx = -1, deathDateIdx = -1, selfManagementGroupIdx = -1;
        
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const r = rows[i];
          if (r.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('họ') || cell.toLowerCase().includes('tên') || cell.toLowerCase().includes('quan hệ') || cell.toLowerCase().includes('giới tính')))) {
            headerRowIdx = i;
            break;
          }
        }
        
        let startIdx = 0;

        if (headerRowIdx !== -1) {
          startIdx = headerRowIdx + 1;
          const headers = rows[headerRowIdx].map(h => (typeof h === 'string' ? h.toLowerCase() : ''));
          const findIdx = (keywords: string[], fallback: number) => {
            const idx = headers.findIndex(h => keywords.some(kw => h.includes(kw)));
            return idx !== -1 ? idx : fallback;
          };
          
          nameIdx = findIdx(['họ', 'tên', 'name'], 0);
          genderIdx = findIdx(['giới', 'nam', 'nữ', 'gender'], 1);
          dobIdx = findIdx(['sinh', 'dob', 'date'], 2);
          addressIdx = findIdx(['địa chỉ', 'thường trú', 'nơi ở', 'address'], -1);
          cccdIdx = findIdx(['cccd', 'cmnd', 'căn cước', 'định danh'], -1);
          phoneIdx = findIdx(['điện thoại', 'sđt', 'phone'], -1);
          relIdx = findIdx(['quan hệ', 'chủ hộ', 'relation'], 6);
          occIdx = findIdx(['nghề', 'công việc', 'job'], -1);
          pobIdx = findIdx(['nơi sinh', 'quê'], -1);
          statusIdx = findIdx(['trạng thái', 'cư trú', 'status'], -1);
          notesIdx = findIdx(['ghi chú', 'note'], -1);
          hhNumIdx = findIdx(['sổ hộ khẩu', 'mã hộ', 'số hộ'], -1);
          deathDateIdx = findIdx(['ngày mất', 'ngày qua đời', 'death_date', 'mất'], -1);
          selfManagementGroupIdx = findIdx(['cụm', 'tổ', 'tổ tự quản'], -1);
        } else if (rows.length > 0) {
          const firstData = rows[0].map(c => (typeof c === 'string' ? c.toLowerCase().trim() : ''));
          
          const findByRegex = (regex: RegExp, fallback: number) => {
            const idx = firstData.findIndex(c => regex.test(c));
            return idx !== -1 ? idx : fallback;
          };
          const findByKeywords = (keywords: string[], fallback: number) => {
            const idx = firstData.findIndex(c => keywords.some(kw => c === kw || c.includes(kw)));
            return idx !== -1 ? idx : fallback;
          };

          genderIdx = findByKeywords(['nam', 'nữ', 'male', 'female'], 1);
          relIdx = findByKeywords(['chủ hộ', 'vợ', 'chồng', 'con', 'cháu', 'bố', 'mẹ', 'ông', 'bà', 'anh', 'chị', 'em'], 6);
          dobIdx = findByRegex(/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\w{3}-\d{4})$/, 2);
          cccdIdx = findByRegex(/^\d{9,12}$/, -1);
          phoneIdx = findByRegex(/^\d{10,11}$/, -1);
          addressIdx = -1;
          hhNumIdx = -1;
          deathDateIdx = -1;
          
          const usedIndices = [genderIdx, relIdx, dobIdx, cccdIdx];
          const possibleNameIdx = firstData.findIndex((c, idx) => c.length > 3 && !usedIndices.includes(idx) && !/^\d/.test(c));
          if (possibleNameIdx !== -1) nameIdx = possibleNameIdx;
        }

        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[nameIdx]?.trim()) {
            skipCount++;
            continue;
          }

          const fullName = row[nameIdx]?.trim();
          const csvGender = row[genderIdx]?.trim().toLowerCase() || '';
          const gender = (csvGender === 'nam' || csvGender === 'male') ? 'male' : (csvGender === 'nữ' || csvGender === 'female') ? 'female' : 'other';
          
           let rawDob = row[dobIdx]?.trim() || '';
          let finalDob = '';

          const parseDateString = (dStr: string) => {
            const cleanStr = dStr.trim();
            if (!cleanStr) return '';
            
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
              return cleanStr;
            }
            
            const parts = cleanStr.split(/[\/\-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                const d = parseInt(parts[2], 10);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12) {
                  return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                }
              }
              if (parts[2].length === 4 || parts[2].length === 2 || parts[2].length === 3) {
                let d = parseInt(parts[0], 10);
                let m = parseInt(parts[1], 10);
                let y = parseInt(parts[2], 10);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                  if (m > 12) {
                    const temp = d;
                    d = m;
                    m = temp;
                  }
                  
                  if (y === 60 || y === 160) y = 1960;
                  else if (y === 0 || y === 200 || y === 2) y = 2000;
                  else if (y < 100) {
                    y = y >= 30 ? 1900 + y : 2000 + y;
                  }
                  
                  if (m >= 1 && m <= 12) {
                    const daysInMonth = new Date(y, m, 0).getDate();
                    const finalD = d > daysInMonth ? daysInMonth : d;
                    return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${finalD.toString().padStart(2, '0')}`;
                  }
                }
              }
            } else if (parts.length === 1 && /^\d{4}$/.test(cleanStr)) {
              // Nếu chỉ có năm (ví dụ: 1990) -> chuyển thành 1990-01-01
              return `${cleanStr}-01-01`;
            }
            
            // Fallback cuối cùng bằng JS Date
            const dateObj = new Date(cleanStr);
            if (!isNaN(dateObj.getTime())) {
              return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            }
            return '';
          };

          finalDob = parseDateString(rawDob);
          
          const dob = finalDob || '2000-01-01';

          const permAddress = addressIdx !== -1 ? row[addressIdx]?.trim() : '';
          const cccd = cccdIdx !== -1 ? row[cccdIdx]?.trim() : '';
          const phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() : '';
          const relWithHead = row[relIdx]?.trim() || 'Con';
          const occupation = occIdx !== -1 ? row[occIdx]?.trim() : '';
          const pob = pobIdx !== -1 ? row[pobIdx]?.trim() : '';
          const csvDeathDate = deathDateIdx !== -1 ? row[deathDateIdx]?.trim() : '';
          const deathDateParsed = csvDeathDate ? parseDateString(csvDeathDate) : '';

          const csvStatus = statusIdx !== -1 ? row[statusIdx]?.trim().toLowerCase() : '';
          const status = csvStatus.includes('thường trú') ? 'resident' :
                         csvStatus.includes('tạm trú') ? 'temporary_resident' :
                         csvStatus.includes('tạm vắng') ? 'temporary_absent' :
                         (csvStatus.includes('mất') || csvStatus.includes('deceased') || deathDateParsed) ? 'deceased' : 'resident';
          const notes = notesIdx !== -1 ? row[notesIdx]?.trim() : '';
          const isHead = relWithHead.toLowerCase().includes('chủ hộ') || relWithHead.toLowerCase() === 'chủ' || relWithHead.toLowerCase() === 'bản thân';

          // Đối chiếu xem nhân khẩu đã tồn tại hay chưa (ưu tiên CCCD, sau đó tới Họ tên + Ngày sinh)
          const matched = currentResidents.find(r => {
            // 1. Đối chiếu theo số CCCD (nếu cả hai đều có và không rỗng)
            const cleanCsvCccd = cccd ? cccd.trim() : '';
            const cleanDbCccd = r.cccd ? r.cccd.trim() : '';
            if (cleanCsvCccd !== '' && cleanDbCccd !== '') {
              if (cleanCsvCccd === cleanDbCccd) return true;
            }

            // 2. Đối chiếu bằng Họ tên + Ngày sinh (đã chuẩn hóa khoảng trắng, Unicode NFC và loại bỏ ký tự tàng hình)
            const cleanNameStr = (str: string) => {
              return (str || '')
                .normalize('NFC')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
            };
            const normDbName = cleanNameStr(r.full_name);
            const normCsvName = cleanNameStr(fullName);
            const isNameMatch = normDbName === normCsvName;

            const normalizeYearInDate = (dStr: string) => {
              if (!dStr) return '';
              const pts = dStr.split('-');
              if (pts.length === 3) {
                let y = parseInt(pts[0], 10);
                if (y === 160 || y === 60) y = 1960;
                if (y === 200 || y === 0 || y === 2) y = 2000;
                return `${y.toString().padStart(4, '0')}-${pts[1]}-${pts[2]}`;
              }
              return dStr;
            };

            const cleanDbDob = normalizeYearInDate(r.dob);
            const cleanCsvDob = normalizeYearInDate(dob);

            const isDbDobEmpty = !r.dob || r.dob === '2000-01-01' || cleanDbDob === '2000-01-01';
            const isCsvDobEmpty = !rawDob || cleanCsvDob === '2000-01-01';

            if (isNameMatch) {
              if (isDbDobEmpty && isCsvDobEmpty) return true;
              return cleanDbDob === cleanCsvDob;
            }
            return false;
          });

          const residentId = mapToUUID(matched ? matched.id : generateUUID());
          const csvHhNum = hhNumIdx !== -1 ? row[hhNumIdx]?.trim() : '';
          const selfManagementGroupVal = selfManagementGroupIdx !== -1 ? row[selfManagementGroupIdx]?.trim() : '';

          if (csvHhNum && csvHhNum !== lastCsvHhNum) {
            currentHouseholdId = '';
            lastCsvHhNum = csvHhNum;
          }

          // Xử lý tạo và nhóm hộ gia đình tự động
          let isNewHousehold = false;
          if (isHead) {
            currentHouseholdId = mapToUUID((matched && matched.household_id) ? matched.household_id : generateUUID());
            const existingHh = currentHouseholds.find(h => h.id === currentHouseholdId);

            const baseHh = existingHh || {
              group_id: 'default',
              policy_type: 'none'
            };

            householdsToSave.push({
              ...baseHh,
              id: currentHouseholdId,
              household_number: csvHhNum || (existingHh ? existingHh.household_number : `HH${(currentHouseholdNumber).toString().slice(-6)}`),
              address: permAddress || (existingHh ? existingHh.address : ''),
              self_management_group: selfManagementGroupVal || (existingHh ? existingHh.self_management_group : ''),
              head_of_household_id: residentId,
              created_at: new Date(Date.now() + i * 1000).toISOString()
            } as Household);

            if (!matched || !matched.household_id) {
              isNewHousehold = true;
              currentHouseholdNumber++;
            }
          } else if (!currentHouseholdId) {
             currentHouseholdId = mapToUUID((matched && matched.household_id) ? matched.household_id : generateUUID());
             const existingHh = currentHouseholds.find(h => h.id === currentHouseholdId);

             const baseHh = existingHh || {
               group_id: 'default',
               policy_type: 'none'
             };

             householdsToSave.push({
               ...baseHh,
               id: currentHouseholdId,
               household_number: csvHhNum || (existingHh ? existingHh.household_number : `HH${(currentHouseholdNumber).toString().slice(-6)}`),
               address: permAddress || (existingHh ? existingHh.address : ''),
               self_management_group: selfManagementGroupVal || (existingHh ? existingHh.self_management_group : ''),
               head_of_household_id: existingHh ? existingHh.head_of_household_id : null,
               created_at: new Date(Date.now() + i * 1000).toISOString()
             } as Household);

             if (!matched || !matched.household_id) {
               currentHouseholdNumber++;
             }
          }

          const baseResident = matched || {};
          const payload: Resident = {
            ...baseResident,
            id: residentId,
            household_id: currentHouseholdId,
            full_name: fullName,
            gender,
            dob,
            pob,
            cccd: cccd || (matched ? matched.cccd : ''),
            phone: phone || (matched ? matched.phone : ''),
            is_head: matched ? matched.is_head : isHead,
            relationship_with_head: matched ? matched.relationship_with_head : relWithHead,
            occupation: occupation || (matched ? matched.occupation : ''),
            status: status || (matched ? matched.status : 'resident'),
            permanent_address: permAddress || (matched ? matched.permanent_address : ''),
            notes: notes || (matched ? matched.notes : ''),
            death_date: deathDateParsed || (matched ? matched.death_date : undefined),
            created_at: new Date(Date.now() + i * 1000).toISOString()
          } as Resident;

          residentsToSave.push(payload as Resident);

          // Cập nhật lại ID chủ hộ trong mảng tạm nếu đã có household
          if (isHead) {
            const tempHh = householdsToSave.find(h => h.id === currentHouseholdId);
            if (tempHh) {
              tempHh.head_of_household_id = residentId;
            }
          }

          if (matched) {
            updatedCount++;
          } else {
            addedCount++;
            addedNames.push(fullName);
          }
        }

        if (householdsToSave.length > 0 || residentsToSave.length > 0) {
          showToast(`Đang đẩy dữ liệu lên máy chủ... (Xin đợi ít phút, không tắt trình duyệt)`, 'success');
          
          // Loại bỏ các bản ghi trùng lặp ID (giữ lại bản ghi cuối cùng) để tránh lỗi ON CONFLICT DO UPDATE của PostgreSQL
          const uniqueHouseholds = Array.from(new Map(householdsToSave.map(h => [h.id, h])).values());
          const uniqueResidents = Array.from(new Map(residentsToSave.map(r => [r.id, r])).values());

          // Lưu Household có head = null trước để tránh lỗi khoá ngoại
          const householdsWithoutHead = uniqueHouseholds.map(h => ({...h, head_of_household_id: null}));
          await (db as any).saveHouseholdsBulk(householdsWithoutHead);
          
          // Lưu Resident
          await (db as any).saveResidentsBulk(uniqueResidents);
          
          // Cập nhật lại Household với head_of_household_id chuẩn xác
          const householdsWithHead = uniqueHouseholds.filter(h => h.head_of_household_id !== null);
          if (householdsWithHead.length > 0) {
            await (db as any).saveHouseholdsBulk(householdsWithHead);
          }
        }

        if (addedCount > 0) {
          setImportAlertData({
            isOpen: true,
            addedCount,
            updatedCount,
            addedNames
          });
        } else {
          showToast(`Nhập dữ liệu hoàn tất! Đã cập nhật toàn bộ ${updatedCount} nhân khẩu.`, 'success');
        }
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (err) {
        showToast(`Lỗi nhập dữ liệu: ${err instanceof Error ? err.message : 'Không rõ nguyên nhân'}`, 'danger');
        console.error(err);
      }
    };

    // Bắt đầu đọc file sau khi đã đăng ký sự kiện onload
    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'utf-8');
    }

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
    const query = searchTerm.toLowerCase().trim();
    
    let matchesSearch = false;
    // Kiểm tra gõ tắt tìm kiếm mừng thọ dạng "70-150"
    const isLongevityShortcut = /^70\s*-\s*150$/.test(query);
    if (isLongevityShortcut) {
      const longevityAge = getLongevityAge(r.dob, longevityYear);
      matchesSearch = MILESTONE_AGES.includes(longevityAge);
    } else {
      matchesSearch = name.includes(query) || cccdCode.includes(query) || phoneNum.includes(query);
    }

    // Category filter matches (bỏ qua với người đã mất khi showDeceased = true)
    const age = getAge(r.dob);
    let matchesCategory = true;
    if (categoryFilter === 'senior') {
      matchesCategory = age >= 80;
    } else if (categoryFilter === 'child') {
      matchesCategory = age < 16;
    } else if (categoryFilter === 'military') {
      matchesCategory = r.gender === 'male' && age >= 18 && age <= 27 && (!r.military_service || r.military_service === 'none' || r.military_service === 'in_age');
    } else if (categoryFilter === 'longevity') {
      const longevityAge = getLongevityAge(r.dob, longevityYear);
      matchesCategory = MILESTONE_AGES.includes(longevityAge);
    }
    // Nếu người đã mất và đang bật "Hiện người đã mất" thì không bị ảnh hưởng bởi categoryFilter
    if (showDeceased && r.status === 'deceased') {
      matchesCategory = true;
    }

    // Household filter matches
    let matchesHousehold = true;
    if (householdFilter !== 'all') {
      matchesHousehold = r.household_id === householdFilter;
    }

    // Deceased filter matches (Bật checkbox showDeceased sẽ CHỈ hiện người đã mất)
    let matchesDeceased = true;
    if (showDeceased) {
      matchesDeceased = r.status === 'deceased';
    } else {
      matchesDeceased = r.status !== 'deceased';
    }

    // Group filter matches
    let matchesGroup = true;
    if (groupFilter !== 'all') {
      const hh = households.find(h => h.id === r.household_id);
      if (!hh || !hh.self_management_group) {
        matchesGroup = false;
      } else {
        const smg = hh.self_management_group.trim().toLowerCase();
        const filterVal = groupFilter.trim().toLowerCase();

        // Chuẩn hoá: cả hai phía đều bỏ dấu cách thừa
        if (smg === filterVal) {
          matchesGroup = true;
        } else if (smg.includes(filterVal) || filterVal.includes(smg)) {
          matchesGroup = true;
        } else {
          // So khớp thông minh theo số Tổ ở cuối chuỗi
          // Ví dụ: "tổ 4" vs "tổ tự quản số 4" hoặc "4"
          const extractNum = (s: string) => {
            const m = s.match(/(\d+)\s*$/);
            return m ? m[1] : null;
          };
          const extractName = (s: string) => {
            // Kiểm tra xem có phải là tên đặc biệt (Việt Trung, ...)
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

    return matchesSearch && matchesCategory && matchesHousehold && matchesDeceased && matchesGroup;
  }).sort((a, b) => {
    // Nhóm theo hộ gia đình (sắp xếp cùng hộ ở cạnh nhau)
    if (a.household_id !== b.household_id) {
      const idA = a.household_id || '';
      const idB = b.household_id || '';
      if (idA && idB) {
        const hhA = households.find(h => h.id === idA);
        const hhB = households.find(h => h.id === idB);
        if (hhA && hhB) {
          const timeA = new Date(hhA.created_at || 0).getTime();
          const timeB = new Date(hhB.created_at || 0).getTime();
          if (timeA !== timeB) return timeA - timeB;
        }
      }
      return idA.localeCompare(idB);
    }
    // Trong cùng hộ: chủ hộ lên đầu
    if (a.is_head && !b.is_head) return -1;
    if (!a.is_head && b.is_head) return 1;
    // Sau đó theo ngày thêm vào (created_at)
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });

  const totalPages = Math.ceil(filteredResidents.length / pageSize) || 1;
  const paginatedResidents = filteredResidents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getHouseholdAddress = (hId: string) => {
    const hh = households.find(h => h.id === hId);
    return hh ? hh.address : 'Chưa định vị hộ';
  };

  const getHouseholdInfo = (hId: string) => {
    const hh = households.find(h => h.id === hId);
    if (!hh) return 'Chưa có hộ';
    const head = residents.find(r => r.id === hh.head_of_household_id);
    const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
    const shortAddress = hh.address.split(',')[0];
    return `Chủ hộ: ${headName} (${shortAddress})`;
  };

  const getStatusText = (statusVal: string) => {
    switch (statusVal) {
      case 'resident': return 'Thường trú';
      case 'temporary_resident': return 'Tạm trú';
      case 'temporary_absent': return 'Tạm vắng';
      case 'stay': return 'Lưu trú';
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
            {!isGuest && (
              <button className="btn btn-secondary btn-import-excel" onClick={() => fileInputRef.current?.click()}>
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
            <button className="btn btn-secondary btn-print-list" onClick={handlePrint}>
              <Printer size={16} />
              In danh sách
            </button>
          </div>
          {categoryFilter === 'longevity' ? (
            <button className="btn btn-secondary btn-export-excel" style={{ borderColor: '#eab308', color: '#854d0e', background: '#fef9c3' }} onClick={handleExportLongevityExcel}>
              <FileDown size={16} style={{ color: '#ca8a04' }} />
              Xuất Excel Mừng Thọ
            </button>
          ) : (
            <button className="btn btn-secondary btn-export-excel" onClick={handleExportCSV}>
              <FileDown size={16} />
              Xuất Excel/CSV
            </button>
          )}
          {!isGuest && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <UserPlus size={16} />
              Thêm nhân khẩu
            </button>
          )}
        </div>
      </div>

      <div className="filter-section">
          <div className="search-box">
            <Search size={20} />
            <input 
              type="text" 
              placeholder="Tìm theo tên, số CCCD, Sđt..." 
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

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 14px', 
            backgroundColor: '#f1f5f9', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            cursor: 'pointer',
            height: '42px',
            boxSizing: 'border-box'
          }}>
            <input 
              type="checkbox" 
              id="show-deceased-checkbox"
              checked={showDeceased} 
              onChange={(e) => setShowDeceased(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
            />
            <label htmlFor="show-deceased-checkbox" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
              🕯️ Chỉ hiện người đã mất {residents.filter(r => r.status === 'deceased').length > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '0.75rem', marginLeft: '4px' }}>
                  {residents.filter(r => r.status === 'deceased').length}
                </span>
              )}
            </label>
          </div>

          <div className="filter-btns">
            <select 
              className={`filter-btn ${categoryFilter === 'all' || groupFilter !== 'all' ? 'active' : ''}`}
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
              }}
              style={{
                paddingRight: '28px',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                background: `url("data:image/svg+xml;utf8,<svg fill='${categoryFilter === 'all' || groupFilter !== 'all' ? '%232563eb' : '%2364748b'}' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>") no-repeat right 8px center`,
                backgroundSize: '16px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">👥 Tất Cả</option>
              <option value="Tổ Việt Trung">👥 Tổ Việt Trung</option>
              <option value="Tổ 4">👥 Tổ 4</option>
              <option value="Tổ 5">👥 Tổ 5</option>
              <option value="Tổ 6">👥 Tổ 6</option>
              <option value="Tổ 7">👥 Tổ 7</option>
              <option value="Tổ 8">👥 Tổ 8</option>
              <option value="Tổ 9">👥 Tổ 9</option>
            </select>
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
            <button 
              className={`filter-btn ${categoryFilter === 'military' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('military')}
            >
              <ShieldAlert size={16} /> Thanh niên NVQS (18-27)
            </button>
            <button 
              className={`filter-btn ${categoryFilter === 'longevity' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('longevity')}
            >
              🎉 Mừng thọ (70-150)
            </button>

            {categoryFilter === 'longevity' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-dark)' }}>Năm mừng thọ:</span>
                <select
                  value={longevityYear}
                  onChange={(e) => setLongevityYear(parseInt(e.target.value))}
                  className="filter-btn"
                  style={{ padding: '6px 12px', minWidth: '80px', height: '38px' }}
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 1 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            )}
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
              <th>Địa chỉ hộ dân</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {paginatedResidents.map((resident) => {
              const isDeceased = resident.status === 'deceased';
              return (
                <tr 
                  key={resident.id} 
                  id={`resident-row-${resident.id}`}
                  style={isDeceased ? { opacity: 0.65, backgroundColor: '#f8fafc' } : {}}
                >
                  <td>
                    <div className="resident-name-cell">
                      <div className="avatar-sm" style={isDeceased ? { backgroundColor: '#cbd5e1', color: '#64748b' } : {}}>{resident.full_name.charAt(0)}</div>
                      <div>
                        <div className="name" style={isDeceased ? { color: '#64748b', textDecoration: 'line-through' } : {}}>
                          {resident.full_name} {isDeceased && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 'normal', textDecoration: 'none', display: 'inline-block', marginLeft: '6px' }}>🕯️ (Đã mất)</span>}
                        </div>
                        <div className="subtext">
                          <span>{resident.phone ? `SĐT: ${resident.phone}` : 'Chưa có SĐT'}</span>
                          <span className="mobile-household-info"> | {getHouseholdInfo(resident.household_id)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span>{resident.gender === 'male' ? 'Nam' : 'Nữ'}</span>
                    <span className="age-badge">
                      ({categoryFilter === 'longevity' 
                        ? `${getLongevityAge(resident.dob, longevityYear)} tuổi mừng thọ` 
                        : `${getAge(resident.dob)} tuổi`
                      })
                    </span>
                  </td>
                  <td>{formatToDisplayDate(resident.dob)}</td>
                  <td><code className="cccd-code">{resident.cccd || 'Chưa cấp'}</code></td>
                  <td>
                    <span className={`relation-badge ${resident.is_head ? 'head' : ''}`}>
                      {resident.relationship_with_head}
                    </span>
                  </td>
                  <td style={{maxWidth: '200px'}}>
                    {(() => {
                      const hh = households.find(h => h.id === resident.household_id);
                      if (!hh) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có hộ</span>;
                      const headRes = residents.find(r => r.id === hh.head_of_household_id);
                      const headName = headRes ? headRes.full_name : 'Chưa rõ chủ hộ';
                      return (
                        <div style={{ lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🏠 {headName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {hh.address}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: '500', marginTop: '1px' }}>
                            Sổ: {hh.household_number}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`status-dot ${resident.status === 'resident' ? 'green' : resident.status === 'temporary_resident' ? 'blue' : resident.status === 'stay' ? 'pink' : 'orange'}`}></span>
                    {getStatusText(resident.status)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="icon-btn-sm" 
                        onClick={() => {
                          setSelectedResident(resident);
                          setIsDetailOpen(true);
                        }} 
                        title="Xem lý lịch chi tiết"
                        style={{ 
                          border: '1px solid var(--border)', 
                          background: '#f8fafc',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(15, 118, 110, 0.08)';
                          e.currentTarget.style.borderColor = '#0f766e';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        <Eye size={14} style={{ color: '#0f766e' }} />
                      </button>
                      {!isGuest && (
                        <>
                          <button 
                            className="icon-btn-sm" 
                            onClick={() => handleOpenEdit(resident)} 
                            title="Chỉnh sửa hồ sơ"
                            style={{ 
                              border: '1px solid var(--border)', 
                              background: '#f8fafc',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
                              e.currentTarget.style.borderColor = 'var(--primary-light)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <Edit2 size={14} style={{ color: 'var(--primary)' }} />
                          </button>
                          <button 
                            className="icon-btn-sm" 
                            onClick={() => handleDelete(resident.id)} 
                            title="Xóa nhân khẩu"
                            style={{ 
                              border: '1px solid rgba(239, 68, 68, 0.2)', 
                              background: 'rgba(239, 68, 68, 0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                              e.currentTarget.style.borderColor = 'var(--danger)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                          >
                            <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {/* Pagination Controls */}
      {filteredResidents.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Hiển thị <strong>{Math.min(filteredResidents.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredResidents.length, currentPage * pageSize)}</strong> trong số <strong>{filteredResidents.length}</strong> nhân khẩu
          </div>
          <div className="pagination-buttons">
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ◄ Trang trước
            </button>
            <span className="pagination-page-indicator">
              Trang {currentPage} / {totalPages}
            </span>
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Trang sau ►
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content medium" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h2>{editingResident ? 'Chỉnh sửa nhân khẩu' : 'Thêm nhân khẩu mới'}</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>1. Thông tin lý lịch</h3>
              
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

              <div className="form-row">
                <div className="form-group">
                  <label>Dân tộc</label>
                  <input 
                    type="text" 
                    value={ethnicity} 
                    onChange={(e) => setEthnicity(e.target.value)} 
                    placeholder="Ví dụ: Kinh" 
                  />
                </div>
                <div className="form-group">
                  <label>Tôn giáo</label>
                  <input 
                    type="text" 
                    value={religion} 
                    onChange={(e) => setReligion(e.target.value)} 
                    placeholder="Ví dụ: Không, Phật giáo..." 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quốc tịch</label>
                  <input 
                    type="text" 
                    value={nationality} 
                    onChange={(e) => setNationality(e.target.value)} 
                    placeholder="Ví dụ: Việt Nam" 
                  />
                </div>
                <div className="form-group">
                  <label>Trình độ học vấn</label>
                  <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                    <option value="12/12">12/12</option>
                    <option value="Đại học">Đại học</option>
                    <option value="Cao đẳng">Cao đẳng</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Khác">Khác / Chưa đi học</option>
                  </select>
                </div>
              </div>

              <h3 style={{ margin: '16px 0 12px 0', fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>2. Cư trú & Liên hệ</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Nơi sinh</label>
                  <input 
                    type="text" 
                    value={pob} 
                    onChange={(e) => setPob(e.target.value)} 
                    placeholder="Ví dụ: Xã Quảng Giao, Quảng Xương, Thanh Hóa" 
                  />
                </div>
                <div className="form-group">
                  <label>Quê quán</label>
                  <input 
                    type="text" 
                    value={nativePlace} 
                    onChange={(e) => setNativePlace(e.target.value)} 
                    placeholder="Ví dụ: Xã Quảng Giao, Quảng Xương, Thanh Hóa" 
                  />
                </div>
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
                    placeholder="Ví dụ: Kinh doanh tự do, Hưu trí..." 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hộ gia đình cư trú liên kết</label>
                <SearchableHouseholdSelect 
                  households={households} 
                  residents={residents} 
                  value={householdId} 
                  onChange={setHouseholdId} 
                />
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

              <div className="form-row">
                <div className="form-group">
                  <label>Trạng thái cư trú</label>
                  <select value={status} onChange={(e: any) => setStatus(e.target.value)}>
                    <option value="resident">Thường trú</option>
                    <option value="temporary_resident">Tạm trú</option>
                    <option value="temporary_absent">Tạm vắng (Có đăng ký)</option>
                    <option value="stay">Lưu trú (Khách vãng lai)</option>
                    <option value="deceased">Đã qua đời</option>
                  </select>
                </div>
                {status === 'temporary_resident' && (
                  <div className="form-group">
                    <label>Thời hạn tạm trú (dd/mm/yyyy)</label>
                    <input 
                      type="text" 
                      value={temporaryResidenceExpiry} 
                      onChange={handleExpiryChange} 
                      placeholder="Ví dụ: 31/12/2026"
                      maxLength={10}
                    />
                  </div>
                )}
                {status === 'deceased' && (
                  <div className="form-group">
                    <label>Ngày mất (dd/mm/yyyy)</label>
                    <input 
                      type="text" 
                      value={deathDate} 
                      onChange={handleDeathDateChange} 
                      placeholder="Ví dụ: 25/06/2026"
                      maxLength={10}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Địa chỉ thường trú gốc (Nếu tạm trú / lưu trú)</label>
                <input 
                  type="text" 
                  value={permanentAddress} 
                  onChange={(e) => setPermanentAddress(e.target.value)} 
                  placeholder="Địa chỉ ghi trên sổ hộ khẩu gốc" 
                />
              </div>

              <h3 style={{ margin: '16px 0 12px 0', fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>3. An sinh & Đoàn thể</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Nghĩa vụ quân sự</label>
                  <select value={militaryService} onChange={(e: any) => setMilitaryService(e.target.value)}>
                    <option value="none">Không thuộc diện / Nữ</option>
                    <option value="in_age">Trong độ tuổi gọi nhập ngũ (18-27)</option>
                    <option value="serving">Đang phục vụ tại ngũ</option>
                    <option value="completed">Đã hoàn thành nghĩa vụ quân sự</option>
                    <option value="exempted">Tạm hoãn hoặc Miễn nghĩa vụ</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '600' }}>
                    <input 
                      type="checkbox" 
                      checked={hasHealthInsurance} 
                      onChange={(e) => setHasHealthInsurance(e.target.checked)} 
                    />
                    Đã có Bảo hiểm y tế (BHYT)
                  </label>
                  {hasHealthInsurance && (
                    <input 
                      type="text" 
                      value={healthInsuranceNumber} 
                      onChange={(e) => setHealthInsuranceNumber(e.target.value)} 
                      placeholder="Mã số thẻ BHYT (nếu có)" 
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                    />
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Thành viên Đoàn thể địa phương</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0', backgroundColor: '#f8fafc', borderRadius: '8px', paddingLeft: '12px', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={hasAssociation('nct')} onChange={() => toggleAssociation('nct')} />
                    Chi hội Người cao tuổi
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={hasAssociation('ccb')} onChange={() => toggleAssociation('ccb')} />
                    Chi hội Cựu chiến binh
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={hasAssociation('pn')} onChange={() => toggleAssociation('pn')} />
                    Chi hội Phụ nữ
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={hasAssociation('dt')} onChange={() => toggleAssociation('dt')} />
                    Chi đoàn Thanh niên
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={hasAssociation('nd')} onChange={() => toggleAssociation('nd')} />
                    Chi hội Nông dân
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Nhập thông tin ghi chú về nhân khẩu..." 
                  style={{ height: '60px', resize: 'none', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu hồ sơ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {isDetailOpen && selectedResident && (
        <div className="modal-overlay">
          <div className="modal-content medium" style={{ maxWidth: '680px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #0f766e', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar-sm" style={{ width: '42px', height: '42px', fontSize: '1.2rem', backgroundColor: 'rgba(15, 118, 110, 0.1)', color: '#0f766e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {selectedResident.full_name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>{selectedResident.full_name}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lý lịch trích ngang nhân khẩu</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsDetailOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="detail-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 0', maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="detail-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Column 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#0f766e', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: '700' }}>Thông tin nhân thân</h3>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Tên gọi khác:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.other_name || '—'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Ngày sinh:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{formatToDisplayDate(selectedResident.dob)}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Giới tính:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.gender === 'male' ? 'Nam' : selectedResident.gender === 'female' ? 'Nữ' : 'Khác'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Dân tộc:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.ethnicity || 'Kinh'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Tôn giáo:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.religion || 'Không'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Quốc tịch:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.nationality || 'Việt Nam'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nghề nghiệp:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.occupation || '—'}</span></div>
                </div>

                {/* Column 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#0f766e', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: '700' }}>Giấy tờ & Liên lạc</h3>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Số CCCD/Định danh:</span> <span className="val" style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--text-main)' }}>{selectedResident.cccd || 'Chưa cấp'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Số điện thoại:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.phone || '—'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Trình độ học vấn:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.education_level || '12/12'}</span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nghĩa vụ quân sự:</span> <span className="val" style={{ color: 'var(--text-main)' }}>
                    {selectedResident.military_service === 'in_age' ? 'Trong độ tuổi gọi nhập ngũ' : 
                     selectedResident.military_service === 'serving' ? 'Đang phục vụ tại ngũ' :
                     selectedResident.military_service === 'completed' ? 'Đã hoàn thành' :
                     selectedResident.military_service === 'exempted' ? 'Được tạm hoãn hoặc miễn' : 'Không'}
                  </span></div>
                  <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Bảo hiểm y tế:</span> <span className="val" style={{ color: 'var(--text-main)' }}>
                    {selectedResident.has_health_insurance ? `Đã có BHYT (Thẻ số: ${selectedResident.health_insurance_number || '—'})` : 'Chưa tham gia BHYT'}
                  </span></div>
                </div>
              </div>

              {/* Cư trú đầy đủ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0f766e', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: '700' }}>Thông tin Cư trú</h3>
                <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Trạng thái cư trú:</span> <span className="val" style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {selectedResident.status === 'resident' ? 'Thường trú' : 
                   selectedResident.status === 'temporary_resident' ? 'Tạm trú' :
                   selectedResident.status === 'temporary_absent' ? 'Tạm vắng (Đã đăng ký)' : 
                   selectedResident.status === 'stay' ? 'Lưu trú (Khách vãng lai)' : 'Đã mất'}
                </span></div>
                {selectedResident.status === 'temporary_resident' && (
                  <div className="detail-item" style={{ backgroundColor: '#f0fdfa', padding: '8px 12px', borderRadius: '6px', border: '1px dashed #5eead4', fontSize: '0.95rem' }}>
                    <span className="label" style={{ color: '#0f766e', fontWeight: '600' }}>Thời hạn tạm trú đến ngày:</span> 
                    <span className="val" style={{ color: '#0f766e', fontWeight: 'bold' }}>{selectedResident.temporary_residence_expiry ? formatToDisplayDate(selectedResident.temporary_residence_expiry) : 'Chưa cập nhật'}</span>
                  </div>
                )}
                {selectedResident.status === 'deceased' && (
                  <div className="detail-item" style={{ backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px dashed #fca5a5', fontSize: '0.95rem' }}>
                    <span className="label" style={{ color: '#b91c1c', fontWeight: '600' }}>Ngày qua đời:</span> 
                    <span className="val" style={{ color: '#b91c1c', fontWeight: 'bold' }}>{selectedResident.death_date ? formatToDisplayDate(selectedResident.death_date) : 'Chưa cập nhật'}</span>
                  </div>
                )}
                <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Hộ gia đình cư trú:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{getHouseholdAddress(selectedResident.household_id)} ({selectedResident.relationship_with_head})</span></div>
                <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Nơi sinh:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.pob || '—'}</span></div>
                <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Quê quán:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.native_place || '—'}</span></div>
                <div className="detail-item" style={{ fontSize: '0.95rem' }}><span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Địa chỉ thường trú gốc:</span> <span className="val" style={{ color: 'var(--text-main)' }}>{selectedResident.permanent_address || '—'}</span></div>
              </div>

              {/* Các hội đoàn thể tham gia */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0f766e', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: '700' }}>Thành viên đoàn thể địa phương</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
                  {selectedResident.association_membership ? selectedResident.association_membership.split(',').map((code) => {
                    let label = '';
                    if (code === 'nct') { label = 'Hội Người cao tuổi'; }
                    else if (code === 'ccb') { label = 'Hội Cựu chiến binh'; }
                    else if (code === 'pn') { label = 'Hội Liên hiệp Phụ nữ'; }
                    else if (code === 'dt') { label = 'Đoàn Thanh niên'; }
                    else if (code === 'nd') { label = 'Hội Nông dân'; }
                    if (!label) return null;
                    return (
                      <span key={code} style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        backgroundColor: code === 'nct' ? '#dbeafe' : code === 'ccb' ? '#d1fae5' : code === 'pn' ? '#fce7f3' : code === 'nd' ? '#fef3c7' : '#e0f2fe',
                        color: code === 'nct' ? '#1e40af' : code === 'ccb' ? '#065f46' : code === 'pn' ? '#9d174d' : code === 'nd' ? '#92400e' : '#0369a1'
                      }}>
                        {label}
                      </span>
                    );
                  }) : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chưa đăng ký tham gia hội đoàn thể nào.</span>}
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f766e', fontWeight: '700' }}>Ghi chú hành chính</h3>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-main)', minHeight: '50px', whiteSpace: 'pre-line' }}>
                  {selectedResident.notes || 'Không có ghi chú nào.'}
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '0' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>Đóng lại</button>
              {!isGuest && (
                <button type="button" className="btn btn-primary" onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenEdit(selectedResident);
                }} style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', border: 'none', color: 'white' }}>Chỉnh sửa hồ sơ</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone: Xoá toàn bộ */}
      {!isGuest && (
        <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px dashed #ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <p style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>Vùng Nguy Hiểm: Dọn dẹp rác hệ thống</p>
          <button className="btn btn-danger" onClick={handleDeleteAll} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '6px 16px', fontSize: '0.85rem' }}>
            <Trash2 size={14} />
            Xóa Toàn Bộ Dữ Liệu
          </button>
        </div>
      )}

      {importAlertData && importAlertData.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '500px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
              padding: '20px',
              borderBottom: '1px solid #bae6fd',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.25rem'
              }}>
                ℹ
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0369a1', fontWeight: '700' }}>Kết quả nhập dữ liệu</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#075985' }}>
                  Đã đối chiếu và cập nhật {importAlertData.updatedCount} nhân khẩu.
                </p>
              </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e0f2fe',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#0369a1', fontWeight: '600' }}>
                  ⚠️ Có {importAlertData.addedCount} nhân khẩu được thêm mới:
                </p>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {importAlertData.addedNames.map((name, idx) => (
                    <div key={idx} style={{ fontSize: '0.9rem', color: '#334155', fontWeight: '500' }}>
                      {idx + 1}. <span style={{ color: '#0369a1', fontWeight: '600' }}>{name}</span>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '16px', marginTop: '2px', fontStyle: 'italic' }}>
                        👉 {getDbMatchSuggestions(name)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                fontSize: '0.85rem',
                color: '#075985',
                lineHeight: '1.4',
                backgroundColor: '#e0f2fe',
                padding: '12px',
                borderRadius: '8px',
                borderLeft: '4px solid #0284c7'
              }}>
                <strong>Lưu ý:</strong> Nếu đây là những người đã có sẵn trên Web nhưng bị tạo trùng, vui lòng kiểm tra lại xem <strong>Họ tên</strong> hoặc <strong>Ngày sinh</strong> trong file Excel của họ có bị gõ sai so với dữ liệu trên hệ thống hay không nhé!
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #bae6fd',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setImportAlertData(null)}
                style={{
                  backgroundColor: '#0284c7',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                Xác nhận & Đóng
              </button>
            </div>
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
          flex-wrap: wrap;
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
          min-width: 250px;
          max-width: 350px;
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
          min-width: 180px;
          max-width: 220px;
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
          flex-wrap: wrap;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-muted);
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-btn:hover {
          background-color: #f1f5f9;
          color: var(--text-dark);
          border-color: #cbd5e1;
        }

        .filter-btn.active {
          background-color: #eff6ff;
          color: var(--primary);
          border-color: #3b82f6;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.05);
        }

        .table-container {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th {
          background-color: #f8fafc;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
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
        .status-dot.pink { background-color: #ec4899; }
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


        .mobile-household-info {
          display: none;
        }

        @media (max-width: 1024px) {
          .data-table th:nth-child(4),
          .data-table td:nth-child(4) { display: none; }
          .data-table th:nth-child(6),
          .data-table td:nth-child(6) { display: none; }
          .mobile-household-info {
            display: inline;
          }
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
