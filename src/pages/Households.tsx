import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Plus, 
  MapPin, 
  Users, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  CreditCard,
  Printer,
  UserPlus
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Household, Resident } from '../types';

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

const Households = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [policyFilter, setPolicyFilter] = useState<string>('all');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [viewingMembersHousehold, setViewingMembersHousehold] = useState<Household | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Add Member Modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [targetHouseholdForMember, setTargetHouseholdForMember] = useState<Household | null>(null);
  
  // Add Member form fields
  const [mFullName, setMFullName] = useState('');
  const [mGender, setMGender] = useState<'male' | 'female' | 'other'>('male');
  const [mDob, setMDob] = useState('');
  const [mCccd, setMCccd] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mOccupation, setMOccupation] = useState('');
  const [mRelationship, setMRelationship] = useState('Con');
  const [mStatus, setMStatus] = useState<'resident' | 'temporary_absent' | 'temporary_resident' | 'deceased' | 'stay'>('resident');
  const [mPob, setMPob] = useState('');
  const [mNotes, setMNotes] = useState('');

  // Guest Mode checking
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');

  // State for Transfer / Split Household
  const [transferringMember, setTransferringMember] = useState<Resident | null>(null);
  const [targetHouseholdIdForTransfer, setTargetHouseholdIdForTransfer] = useState<string>('');

  const [splittingMember, setSplittingMember] = useState<Resident | null>(null);
  const [newHkNumberForSplit, setNewHkNumberForSplit] = useState<string>('');
  const [newAddressForSplit, setNewAddressForSplit] = useState<string>('');

  // Confirmation state for Report Deceased
  const [deceasedConfirmMember, setDeceasedConfirmMember] = useState<Resident | null>(null);
  // Suggested replacement head after a head is reported deceased
  const [suggestedNewHead, setSuggestedNewHead] = useState<{ household: Household; candidate: Resident } | null>(null);

  // New Head of Household details (for quick add)
  const [createNewHead, setCreateNewHead] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadGender, setNewHeadGender] = useState<'male' | 'female' | 'other'>('male');
  const [newHeadDob, setNewHeadDob] = useState('');
  const [newHeadCccd, setNewHeadCccd] = useState('');
  const [newHeadPhone, setNewHeadPhone] = useState('');
  const [newHeadOccupation, setNewHeadOccupation] = useState('');

  // Form fields
  const [householdNumber, setHouseholdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [policyType, setPolicyType] = useState<'none' | 'poor' | 'near_poor' | 'policy_family'>('none');
  const [headId, setHeadId] = useState('');
  const [lat, setLat] = useState('19.7420');
  const [lng, setLng] = useState('105.9230');
  const [fireSafetyGroup, setFireSafetyGroup] = useState('');
  const [selfManagementGroup, setSelfManagementGroup] = useState('');

  const handleNewHeadDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d/]/g, '');
    
    if (value.length === 2 && newHeadDob.length === 1) {
      value = value + '/';
    } else if (value.length === 5 && newHeadDob.length === 4) {
      value = value + '/';
    }
    
    if (value.length <= 10) {
      setNewHeadDob(value);
    }
  };

  const handleMDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d/]/g, '');
    
    if (value.length === 2 && mDob.length === 1) {
      value = value + '/';
    } else if (value.length === 5 && mDob.length === 4) {
      value = value + '/';
    }
    
    if (value.length <= 10) {
      setMDob(value);
    }
  };

  const loadData = async () => {
    try {
      const [hList, rList] = await Promise.all([
        db.getHouseholds(),
        db.getResidents()
      ]);
      setHouseholds(hList);
      setResidents(rList);
    } catch (e) {
      showToast('Lỗi tải dữ liệu!', 'danger');
    }
  };

  const [tdpName, setTdpName] = useState(
    localStorage.getItem('tdp_name') || 'Nam Sầm Sơn'
  );

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent;
      const hhId = customEvent.detail;
      const matched = households.find(h => h.id === hhId);
      if (matched) {
        const ownerName = getHeadName(matched);
        setSearchTerm(ownerName);
        setPolicyFilter('all');
        
        setTimeout(() => {
          const card = document.getElementById(`household-card-${hhId}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.borderColor = 'var(--primary)';
            card.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.2)';
            setTimeout(() => {
              card.style.borderColor = '';
              card.style.boxShadow = '';
            }, 3000);
          }
        }, 300);
      }
    };
    window.addEventListener('highlight-household', handleHighlight);
    return () => window.removeEventListener('highlight-household', handleHighlight);
  }, [households, residents]);

  const getHouseholdMembers = (hId: string) => {
    return residents
      .filter(r => r.household_id === hId)
      .sort((a, b) => {
        // Chủ hộ luôn lên đầu
        if (a.is_head && !b.is_head) return -1;
        if (!a.is_head && b.is_head) return 1;
        // Còn lại sắp xếp theo ngày thêm (created_at)
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
  };

  const getHeadName = (h: Household) => {
    const head = residents.find(r => r.id === h.head_of_household_id);
    if (head) return head.full_name;
    const fallbackHead = residents.find(r => r.household_id === h.id && r.is_head);
    return fallbackHead ? fallbackHead.full_name : 'Chưa xác định';
  };

  const handleOpenAdd = () => {
    setEditingHousehold(null);
    setHouseholdNumber(`HK-${Math.floor(10000 + Math.random() * 90000)}`);
    setAddress('');
    setPolicyType('none');
    setHeadId('');
    setLat((19.740 + Math.random() * 0.005).toFixed(4));
    setLng((105.920 + Math.random() * 0.005).toFixed(4));
    setFireSafetyGroup('');
    setSelfManagementGroup('');
    setCreateNewHead(false);
    setNewHeadName('');
    setNewHeadGender('male');
    setNewHeadDob('');
    setNewHeadCccd('');
    setNewHeadPhone('');
    setNewHeadOccupation('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (h: Household) => {
    setEditingHousehold(h);
    setHouseholdNumber(h.household_number);
    setAddress(h.address);
    setPolicyType(h.policy_type);
    setHeadId(h.head_of_household_id || '');
    setLat(h.latitude?.toString() || '19.7420');
    setLng(h.longitude?.toString() || '105.9230');
    setFireSafetyGroup(h.fire_safety_group || '');
    setSelfManagementGroup(h.self_management_group || '');
    setCreateNewHead(false);
    setNewHeadName('');
    setNewHeadGender('male');
    setNewHeadDob('');
    setNewHeadCccd('');
    setNewHeadPhone('');
    setNewHeadOccupation('');
    setIsFormOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      showToast('Vui lòng nhập địa chỉ!', 'warning');
      return;
    }

    if (!editingHousehold && createNewHead) {
      if (!newHeadName.trim()) {
        showToast('Vui lòng nhập họ tên chủ hộ mới!', 'warning');
        return;
      }
      if (!newHeadDob) {
        showToast('Vui lòng nhập ngày sinh chủ hộ mới!', 'warning');
        return;
      }
      if (!isValidDate(newHeadDob)) {
        showToast('Ngày sinh chủ hộ không đúng định dạng dd/mm/yyyy (Ví dụ: 02/01/1940)!', 'warning');
        return;
      }
    }

    try {
      const hhId = editingHousehold ? editingHousehold.id : generateUUID();
      let finalHeadId = headId;

      // Bước 1: Tạo hộ gia đình TRƯỚC (vì nhân khẩu có ràng buộc FK tới households)
      const payload: Household = {
        id: hhId,
        household_number: householdNumber,
        address,
        head_of_household_id: finalHeadId || null,
        group_id: db.getGroupId(),
        latitude: parseFloat(lat) || 19.7420,
        longitude: parseFloat(lng) || 105.9230,
        policy_type: policyType,
        fire_safety_group: fireSafetyGroup || undefined,
        self_management_group: selfManagementGroup || undefined,
        created_at: editingHousehold ? editingHousehold.created_at : new Date().toISOString()
      };
      await db.saveHousehold(payload);

      // Đồng bộ vai trò Chủ hộ và tự động chuyển đổi mối quan hệ thông minh trong danh sách nhân khẩu
      if (editingHousehold && finalHeadId) {
        const hhMembers = residents.filter(r => r.household_id === hhId);
        const newHead = hhMembers.find(r => r.id === finalHeadId);
        
        // Chuẩn hóa Unicode NFC và chữ thường để tránh lỗi lệch ký tự có dấu tiếng Việt
        const cleanRel = (str: string) => {
          return (str || '')
            .normalize('NFC')
            .toLowerCase()
            .trim();
        };

        const prevRel = cleanRel(newHead?.relationship_with_head || 'Con');

        for (const member of hhMembers) {
          let needsUpdate = false;
          let updatedIsHead = member.is_head;
          let updatedRelationship = member.relationship_with_head || 'Thành viên';
          const curRel = cleanRel(updatedRelationship);

          if (member.id === finalHeadId) {
            if (!member.is_head || curRel !== 'chủ hộ') {
              updatedIsHead = true;
              updatedRelationship = 'Chủ hộ';
              needsUpdate = true;
            }
          } else {
            // Tự động suy luận mối quan hệ mới cho các thành viên dựa trên chủ hộ mới
            let newRel = updatedRelationship;
            if (prevRel.includes('con')) {
              // Chủ hộ mới trước đây là Con
              if (member.id === editingHousehold.head_of_household_id || curRel === 'chủ hộ' || curRel === 'chồng') {
                newRel = 'Bố';
              } else if (curRel === 'vợ') {
                newRel = 'Mẹ';
              } else if (curRel.includes('con')) {
                // Anh chị em
                const getYear = (dStr: string) => {
                  if (!dStr) return 0;
                  const pts = dStr.split('-');
                  return pts.length === 3 ? parseInt(pts[0], 10) : 0;
                };
                const headY = getYear(newHead?.dob || '');
                const memberY = getYear(member.dob || '');
                if (headY && memberY) {
                  if (memberY < headY) {
                    newRel = member.gender === 'female' ? 'Chị' : 'Anh';
                  } else {
                    newRel = 'Em';
                  }
                } else {
                  newRel = 'Anh/Chị/Em';
                }
              } else if (curRel.includes('cháu')) {
                newRel = 'Cháu';
              }
            } else if (prevRel === 'vợ') {
              // Chủ hộ mới trước đây là Vợ
              if (member.id === editingHousehold.head_of_household_id || curRel === 'chủ hộ') {
                newRel = 'Chồng';
              } else if (curRel.includes('con')) {
                newRel = 'Con';
              } else if (curRel.includes('cháu')) {
                newRel = 'Cháu';
              }
            } else if (prevRel === 'chồng') {
              // Chủ hộ mới trước đây là Chồng
              if (member.id === editingHousehold.head_of_household_id || curRel === 'chủ hộ') {
                newRel = 'Vợ';
              } else if (curRel.includes('con')) {
                newRel = 'Con';
              }
            } else if (prevRel.includes('cháu')) {
              // Chủ hộ mới trước đây là Cháu
              if (member.id === editingHousehold.head_of_household_id || curRel === 'chủ hộ') {
                newRel = member.gender === 'female' ? 'Bà' : 'Ông';
              }
            } else if (prevRel === 'bố' || prevRel === 'mẹ') {
              // Chủ hộ mới trước đây là Bố hoặc Mẹ của chủ hộ cũ (quay lại hộ cũ)
              if (member.id === editingHousehold.head_of_household_id || curRel === 'chủ hộ') {
                newRel = 'Con';
              } else if (curRel === 'mẹ' && prevRel === 'bố') {
                newRel = 'Vợ';
              } else if (curRel === 'bố' && prevRel === 'mẹ') {
                newRel = 'Chồng';
              } else if (
                curRel === 'anh' ||
                curRel === 'chị' ||
                curRel === 'em'
              ) {
                newRel = 'Con';
              }
            }

            if (member.is_head || cleanRel(updatedRelationship) !== cleanRel(newRel)) {
              updatedIsHead = false;
              updatedRelationship = newRel;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            await db.saveResident({
              ...member,
              is_head: updatedIsHead,
              relationship_with_head: updatedRelationship
            });
          }
        }
      }

      // Bước 2: Tạo chủ hộ mới (nếu có), sau khi hộ đã được tạo thành công
      if (!editingHousehold && createNewHead) {
        const generatedHeadId = generateUUID();
        const dbNewHeadDob = formatToDbDate(newHeadDob);
        const headPayload: Omit<Resident, 'is_senior' | 'created_at'> & { is_senior?: boolean; created_at?: string } = {
          id: generatedHeadId,
          household_id: hhId,
          full_name: newHeadName.trim(),
          gender: newHeadGender,
          dob: dbNewHeadDob,
          cccd: newHeadCccd.trim(),
          phone: newHeadPhone.trim(),
          occupation: newHeadOccupation.trim(),
          permanent_address: address.trim(),
          is_head: true,
          relationship_with_head: 'Chủ hộ',
          status: 'resident',
          created_at: new Date().toISOString()
        };
        await db.saveResident(headPayload);
        finalHeadId = generatedHeadId;

        // Bước 3: Cập nhật lại hộ với head_of_household_id đúng
        await db.saveHousehold({ ...payload, head_of_household_id: finalHeadId });
      }
      showToast(editingHousehold ? 'Cập nhật hộ dân thành công!' : 'Thêm hộ dân mới thành công!', 'success');
      setIsFormOpen(false);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi lưu dữ liệu!', 'danger');
    }
  };

  const handleTransferHousehold = async () => {
    if (!transferringMember || !targetHouseholdIdForTransfer) return;
    try {
      const oldHh = households.find(h => h.id === transferringMember.household_id);
      
      const updatedResident: Resident = {
        ...transferringMember,
        household_id: targetHouseholdIdForTransfer,
        is_head: false,
        relationship_with_head: 'Thành viên'
      };
      await db.saveResident(updatedResident);
      
      if (oldHh && oldHh.head_of_household_id === transferringMember.id) {
        await db.saveHousehold({
          ...oldHh,
          head_of_household_id: null
        });
      }

      showToast(`Đã chuyển nhân khẩu ${transferringMember.full_name} sang hộ gia đình mới!`, 'success');
      setTransferringMember(null);
      setTargetHouseholdIdForTransfer('');
      setViewingMembersHousehold(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi chuyển hộ gia đình!', 'danger');
    }
  };

  const handleSplitHousehold = async () => {
    if (!splittingMember || !newHkNumberForSplit.trim() || !newAddressForSplit.trim()) {
      showToast('Vui lòng điền đầy đủ số sổ và địa chỉ hộ mới!', 'warning');
      return;
    }
    try {
      const newHhId = generateUUID();
      const oldHh = households.find(h => h.id === splittingMember.household_id);
      
      const newHh: Household = {
        id: newHhId,
        household_number: newHkNumberForSplit.trim(),
        address: newAddressForSplit.trim(),
        head_of_household_id: splittingMember.id,
        group_id: db.getGroupId(),
        latitude: 19.7420,
        longitude: 105.9230,
        policy_type: 'none',
        created_at: new Date().toISOString()
      };
      await db.saveHousehold(newHh);
      
      const updatedResident: Resident = {
        ...splittingMember,
        household_id: newHhId,
        is_head: true,
        relationship_with_head: 'Chủ hộ'
      };
      await db.saveResident(updatedResident);
      
      if (oldHh && oldHh.head_of_household_id === splittingMember.id) {
        await db.saveHousehold({
          ...oldHh,
          head_of_household_id: null
        });
      }

      showToast(`Đã tách hộ mới thành công cho ${splittingMember.full_name}!`, 'success');
      setSplittingMember(null);
      setNewHkNumberForSplit('');
      setNewAddressForSplit('');
      setViewingMembersHousehold(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi tách hộ khẩu mới!', 'danger');
    }
  };

  const executeReportDeceased = async (member: Resident) => {
    try {
      const updatedResident: Resident = {
        ...member,
        status: 'deceased',
        is_head: false
      };
      await db.saveResident(updatedResident);

      const hh = households.find(h => h.id === member.household_id);
      if (hh && hh.head_of_household_id === member.id) {
        // Xóa chủ hộ cũ
        await db.saveHousehold({
          ...hh,
          head_of_household_id: null
        });

        // Tìm người thay thế phù hợp nhất: ưu tiên Vợ/Chồng > Con lớn tuổi nhất
        const otherMembers = residents.filter(
          r => r.household_id === member.household_id && r.id !== member.id && r.status !== 'deceased'
        );
        const cleanR = (s: string) => (s || '').normalize('NFC').toLowerCase().trim();
        const spouseRels = ['vợ', 'chồng'];
        const childRels = ['con', 'con dâu', 'con rể'];
        
        let candidate: Resident | undefined =
          otherMembers.find(m => spouseRels.includes(cleanR(m.relationship_with_head || '')));

        if (!candidate) {
          // Tìm con lớn tuổi nhất
          const children = otherMembers.filter(m => childRels.some(c => cleanR(m.relationship_with_head || '').includes(c)));
          if (children.length > 0) {
            candidate = children.sort((a, b) => (a.dob || '') < (b.dob || '') ? -1 : 1)[0];
          }
        }

        if (!candidate && otherMembers.length > 0) {
          candidate = otherMembers[0];
        }

        if (candidate) {
          // Hiển thị modal gợi ý chọn chủ hộ mới
          setSuggestedNewHead({ household: { ...hh, head_of_household_id: null }, candidate });
        }
      }

      showToast(`Đã ghi nhận báo mất cho nhân khẩu ${member.full_name} thành công!`, 'success');
      setViewingMembersHousehold(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi thực hiện báo mất!', 'danger');
    }
  };

  const RELATIONSHIP_OPTIONS = [
    'Chủ hộ', 'Vợ', 'Chồng', 'Con', 'Con dâu', 'Con rể',
    'Bố', 'Mẹ', 'Anh', 'Chị', 'Em', 'Cháu',
    'Ông', 'Bà', 'Nội', 'Ngoại', 'Thành viên'
  ];

  const handleUpdateRelationship = async (member: Resident, newRelationship: string) => {
    try {
      await db.saveResident({
        ...member,
        relationship_with_head: newRelationship
      });
      showToast(`Đã cập nhật quan hệ của ${member.full_name} thành "${newRelationship}"!`, 'success');
      loadData();
    } catch (e) {
      showToast('Lỗi khi cập nhật mối quan hệ!', 'danger');
    }
  };

  const handlePrintHousehold = (h: Household) => {
    const members = getHouseholdMembers(h.id);
    const headName = getHeadName(h);
    const tdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const rowsHtml = members.map((r, index) => {
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
          <td>${r.occupation || ''}</td>
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
        <title>Sổ hộ khẩu - ${headName}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13px;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
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
            margin-top: 20px;
            margin-bottom: 25px;
          }
          .doc-title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .doc-subtitle {
            font-style: italic;
            font-size: 13px;
            margin: 0;
          }
          .info-table {
            width: 100%;
            margin-bottom: 20px;
          }
          .info-table td {
            padding: 4px 0;
            font-size: 14px;
          }
          .info-label {
            font-weight: bold;
            width: 180px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 30px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 8px 6px;
            font-size: 12px;
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
            margin-top: 40px;
            page-break-inside: avoid;
          }
          .signature-section td {
            border: none;
            text-align: center;
            width: 50%;
            font-size: 13px;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
            margin-bottom: 80px;
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
                UBND ${wardName.toUpperCase()}<br/>
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
          <h1 class="doc-title">THÔNG TIN HỘ KHẨU GIA ĐÌNH</h1>
          <p class="doc-subtitle">Số sổ: ${h.household_number}</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Chủ hộ gia đình:</td>
            <td><strong>${headName}</strong></td>
          </tr>
          <tr>
            <td class="info-label">Địa chỉ thường trú:</td>
            <td>${h.address}</td>
          </tr>
          <tr>
            <td class="info-label">Diện chính sách:</td>
            <td>${getPolicyLabel(h.policy_type)}</td>
          </tr>
          <tr>
            <td class="info-label">Tọa độ địa bàn:</td>
            <td>Vĩ độ: ${h.latitude || 'Chưa cập nhật'}, Kinh độ: ${h.longitude || 'Chưa cập nhật'}</td>
          </tr>
          <tr>
            <td class="info-label">Số thành viên:</td>
            <td>${members.length} nhân khẩu</td>
          </tr>
        </table>

        <h3 style="margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; font-size: 14px; text-transform: uppercase;">Danh sách nhân khẩu trong hộ</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 5%;">STT</th>
              <th style="width: 20%;">Họ và tên</th>
              <th style="width: 8%;">Giới tính</th>
              <th style="width: 12%;">Ngày sinh</th>
              <th style="width: 12%;">Số CCCD</th>
              <th style="width: 12%;">Số điện thoại</th>
              <th style="width: 12%;">Nghề nghiệp</th>
              <th style="width: 10%;">Quan hệ chủ hộ</th>
              <th style="width: 10%;">Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="10" style="text-align: center; padding: 20px;">Hộ gia đình chưa khai báo nhân khẩu</td></tr>'}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; border: none;"></td>
            <td style="width: 50%; border: none; text-align: center; font-style: italic; font-size: 13px;">
              ${wardName.replace(/Phường\s+/gi, '') || 'Sầm Sơn'}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
            </td>
          </tr>
        </table>

        <table class="signature-section" style="width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid;">
          <tr>
            <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
              <div class="signature-title" style="font-weight: bold;">NGƯỜI XÁC NHẬN</div>
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

  const handleOpenAddMember = (h: Household) => {
    setTargetHouseholdForMember(h);
    setMFullName('');
    setMGender('male');
    setMDob('');
    setMCccd('');
    setMPhone('');
    setMOccupation('');
    setMRelationship('Con');
    setMStatus('resident');
    setMPob('');
    setMNotes('');
    setIsAddMemberOpen(true);
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetHouseholdForMember) return;
    if (!mFullName.trim() || !mDob) {
      showToast('Vui lòng điền họ tên và ngày sinh!', 'warning');
      return;
    }

    if (!isValidDate(mDob)) {
      showToast('Ngày sinh thành viên không đúng định dạng dd/mm/yyyy (Ví dụ: 02/01/1940)!', 'warning');
      return;
    }

    const dbMDob = formatToDbDate(mDob);

    const payload: Omit<Resident, 'is_senior' | 'created_at'> & { is_senior?: boolean; created_at?: string } = {
      id: generateUUID(),
      household_id: targetHouseholdForMember.id,
      full_name: mFullName.trim(),
      gender: mGender,
      dob: dbMDob,
      cccd: mCccd.trim(),
      phone: mPhone.trim(),
      occupation: mOccupation.trim(),
      permanent_address: targetHouseholdForMember.address,
      is_head: mRelationship === 'Chủ hộ',
      relationship_with_head: mRelationship,
      status: mStatus,
      pob: mPob.trim(),
      notes: mNotes.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const saved = await db.saveResident(payload);

      if (mRelationship === 'Chủ hộ') {
        await db.saveHousehold({
          ...targetHouseholdForMember,
          head_of_household_id: saved.id
        });
      }

      showToast('Thêm thành viên mới thành công!', 'success');
      setIsAddMemberOpen(false);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi thêm thành viên!', 'danger');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hộ dân này? Hành động này sẽ đồng thời xóa hoặc giải liên kết tất cả nhân khẩu thuộc hộ này.')) {
      try {
        await db.deleteHousehold(id);
        showToast('Xóa hộ dân thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Không thể xóa hộ dân!', 'danger');
      }
    }
    setActiveMenuId(null);
  };

  // Filter & Search Logic
  // Trả về tên thành viên khớp với từ khóa (không phải chủ hộ), dùng để hiển thị badge
  const getMatchedMemberName = (hId: string, query: string): string | null => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const members = residents.filter(r => r.household_id === hId && !r.is_head);
    const matched = members.find(r => r.full_name.toLowerCase().includes(q));
    return matched ? matched.full_name : null;
  };

  const filteredHouseholds = households.filter(h => {
    const headName = getHeadName(h).toLowerCase();
    const addr = h.address.toLowerCase();
    const num = h.household_number.toLowerCase();
    const query = searchTerm.toLowerCase();

    // Tìm theo chủ hộ, địa chỉ, số sổ HOẶC bất kỳ thành viên nào trong hộ
    const matchesByHead = headName.includes(query) || addr.includes(query) || num.includes(query);
    const matchesByMember = !!getMatchedMemberName(h.id, searchTerm);
    const matchesSearch = matchesByHead || matchesByMember;

    const matchesPolicy = policyFilter === 'all' || h.policy_type === policyFilter;

    return matchesSearch && matchesPolicy;
  }).sort((a, b) => {
    // Sắp xếp theo số của Số sổ hộ khẩu (vd: HH000001 -> 1)
    const numA = parseInt(a.household_number.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.household_number.replace(/\D/g, '') || '0', 10);
    if (numA !== numB) return numA - numB;
    // Fallback nếu trùng số
    return a.id.localeCompare(b.id);
  });

  const getPolicyLabel = (type: string) => {
    switch (type) {
      case 'poor': return 'Hộ nghèo';
      case 'near_poor': return 'Hộ cận nghèo';
      case 'policy_family': return 'Gia đình chính sách';
      default: return 'Bình thường';
    }
  };

  return (
    <div className="households-page">
      <div className="page-header">
        <h1>Quản lý Hộ dân</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Danh sách các hộ gia đình đang sinh sống tại Tổ dân phố {tdpName}.
          </p>
          {!isGuest && (
            <button className="btn btn-primary" onClick={handleOpenAdd} style={{ flexShrink: 0 }}>
              <Plus size={18} /> Thêm hộ mới
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={20} />
          <input 
            type="text" 
            placeholder="Tìm theo chủ hộ, thành viên, số nhà, số sổ..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-tabs">
          <button className={`tab-mini ${policyFilter === 'all' ? 'active' : ''}`} onClick={() => setPolicyFilter('all')}>Tất cả</button>
          <button className={`tab-mini ${policyFilter === 'poor' ? 'active' : ''}`} onClick={() => setPolicyFilter('poor')}>Hộ nghèo</button>
          <button className={`tab-mini ${policyFilter === 'near_poor' ? 'active' : ''}`} onClick={() => setPolicyFilter('near_poor')}>Hộ cận nghèo</button>
          <button className={`tab-mini ${policyFilter === 'policy_family' ? 'active' : ''}`} onClick={() => setPolicyFilter('policy_family')}>Gia đình chính sách</button>
        </div>
      </div>

      <div className="household-grid">
        {filteredHouseholds.map(h => {
          const members = getHouseholdMembers(h.id);
          const headName = getHeadName(h);
          const matchedMember = getMatchedMemberName(h.id, searchTerm);
          return (
            <div key={h.id} id={`household-card-${h.id}`} className="household-card">
              <div className="card-top" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div className="head-avatar">
                    <Home size={24} />
                  </div>
                  <div className="household-quick-actions">
                    <button 
                      className="quick-action-btn print-btn" 
                      onClick={() => handlePrintHousehold(h)}
                      title="In thông tin hộ"
                    >
                      <Printer size={14} />
                      <span>In sổ</span>
                    </button>
                    {!isGuest && (
                      <button 
                        className="quick-action-btn add-member-btn" 
                        onClick={() => handleOpenAddMember(h)}
                        title="Thêm thành viên"
                      >
                        <UserPlus size={14} />
                        <span>Thêm thành viên</span>
                      </button>
                    )}
                  </div>
                </div>
                {!isGuest && (
                  <div className="card-menu-container">
                    <button className="icon-btn-sm" onClick={() => setActiveMenuId(activeMenuId === h.id ? null : h.id)}>
                      <MoreVertical size={16} />
                    </button>
                    {activeMenuId === h.id && (
                      <div className="dropdown-menu">
                        <button onClick={() => handleOpenEdit(h)}><Edit2 size={14} /> Chỉnh sửa</button>
                        <button className="delete-opt" onClick={() => handleDelete(h.id)}><Trash2 size={14} /> Xóa hộ</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="card-body">
                <div className="hk-number">Sổ: {h.household_number}</div>
                <h3 className="head-name">{headName}</h3>
                <div className="info-row">
                  <MapPin size={16} />
                  <span>{h.address}</span>
                </div>
                <div className="info-row">
                  <Users size={16} />
                  <span>{members.length} thành viên</span>
                </div>
                {matchedMember && searchTerm.trim() && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      border: '1px solid #bfdbfe',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      🔍 Tìm thấy qua: {matchedMember}
                    </span>
                  </div>
                )}
                {(h.self_management_group || h.fire_safety_group) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                    {h.self_management_group && (
                      <span style={{ fontSize: '0.72rem', backgroundColor: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', fontWeight: '600' }}>
                        👥 {h.self_management_group}
                      </span>
                    )}
                    {h.fire_safety_group && (
                      <span style={{ fontSize: '0.72rem', backgroundColor: '#fef2f2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: '600' }}>
                        🔥 {h.fire_safety_group}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="card-footer">
                 <span className={`type-tag ${h.policy_type === 'poor' ? 'danger' : h.policy_type === 'near_poor' ? 'warning' : h.policy_type === 'policy_family' ? 'info' : ''}`}>
                   {getPolicyLabel(h.policy_type)}
                 </span>
                 <button className="btn-detail" onClick={() => setViewingMembersHousehold(h)}>
                   Chi tiết <ChevronRight size={14} />
                 </button>
              </div>
            </div>
          );
        })}
        {filteredHouseholds.length === 0 && (
          <div className="empty-grid-placeholder">Không tìm thấy hộ dân nào trùng khớp.</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingHousehold ? 'Chỉnh sửa hộ dân' : 'Thêm hộ dân mới'}</h2>
              <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Số sổ hộ khẩu / Mã định danh hộ *</label>
                <input 
                  type="text" 
                  value={householdNumber} 
                  onChange={(e) => setHouseholdNumber(e.target.value)} 
                  placeholder="Ví dụ: HK-12345" 
                  required
                />
              </div>

              <div className="form-group">
                <label>Địa chỉ nhà *</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="Ví dụ: Số 45, Nam Sầm Sơn" 
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vĩ độ (Latitude)</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    value={lat} 
                    onChange={(e) => setLat(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Kinh độ (Longitude)</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    value={lng} 
                    onChange={(e) => setLng(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tổ tự quản liên kết</label>
                  <input 
                    type="text" 
                    value={selfManagementGroup} 
                    onChange={(e) => setSelfManagementGroup(e.target.value)} 
                    placeholder="Ví dụ: Tổ tự quản số 1" 
                  />
                </div>
                <div className="form-group">
                  <label>Tổ liên gia an toàn PCCC</label>
                  <input 
                    type="text" 
                    value={fireSafetyGroup} 
                    onChange={(e) => setFireSafetyGroup(e.target.value)} 
                    placeholder="Ví dụ: Tổ liên gia số 2" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Phân loại diện chính sách</label>
                <select value={policyType} onChange={(e: any) => setPolicyType(e.target.value)}>
                  <option value="none">Bình thường</option>
                  <option value="poor">Hộ nghèo</option>
                  <option value="near_poor">Hộ cận nghèo</option>
                  <option value="policy_family">Gia đình chính sách (Thương binh, Liệt sĩ...)</option>
                </select>
              </div>

              {!editingHousehold && (
                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input 
                      type="checkbox" 
                      checked={createNewHead} 
                      onChange={(e) => {
                        setCreateNewHead(e.target.checked);
                        if (e.target.checked) setHeadId('');
                      }} 
                    />
                    Tạo nhanh nhân khẩu chủ hộ mới
                  </label>
                  
                  {createNewHead && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Họ và tên chủ hộ *</label>
                        <input 
                          type="text" 
                          value={newHeadName} 
                          onChange={(e) => setNewHeadName(e.target.value)} 
                          placeholder="Ví dụ: Nguyễn Văn A"
                        />
                      </div>
                      
                      <div className="form-row" style={{ display: 'flex', gap: '12px', margin: 0 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Giới tính *</label>
                          <select value={newHeadGender} onChange={(e: any) => setNewHeadGender(e.target.value)}>
                            <option value="male">Nam</option>
                            <option value="female">Nữ</option>
                            <option value="other">Khác</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Ngày sinh *</label>
                          <input 
                            type="text" 
                            value={newHeadDob} 
                            onChange={handleNewHeadDobChange} 
                            placeholder="Ví dụ: 02/01/1940"
                            maxLength={10}
                          />
                        </div>
                      </div>

                      <div className="form-row" style={{ display: 'flex', gap: '12px', margin: 0 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Số CCCD / Định danh</label>
                          <input 
                            type="text" 
                            value={newHeadCccd} 
                            onChange={(e) => setNewHeadCccd(e.target.value)} 
                            placeholder="Số CCCD"
                          />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label>Số điện thoại</label>
                          <input 
                            type="text" 
                            value={newHeadPhone} 
                            onChange={(e) => setNewHeadPhone(e.target.value)} 
                            placeholder="Số điện thoại"
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nghề nghiệp chủ hộ</label>
                        <input 
                          type="text" 
                          value={newHeadOccupation} 
                          onChange={(e) => setNewHeadOccupation(e.target.value)} 
                          placeholder="Ví dụ: Kinh doanh, Ngư dân..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(!createNewHead || editingHousehold) && (
                <div className="form-group">
                  <label>Chủ hộ (Chọn từ nhân khẩu có sẵn trong hộ)</label>
                  <select value={headId} onChange={(e) => setHeadId(e.target.value)}>
                    <option value="">-- Chưa chọn / Chưa lập nhân khẩu --</option>
                    {(editingHousehold 
                      ? residents.filter(r => r.household_id === editingHousehold.id) 
                      : residents
                    ).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} ({r.relationship_with_head || 'Thành viên'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Members Modal */}
      {viewingMembersHousehold && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <div>
                <h2>Thành viên hộ: {getHeadName(viewingMembersHousehold)}</h2>
                <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px'}}>
                  Địa chỉ: {viewingMembersHousehold.address} | Mã sổ: {viewingMembersHousehold.household_number}
                  {viewingMembersHousehold.self_management_group && ` | 👥 ${viewingMembersHousehold.self_management_group}`}
                  {viewingMembersHousehold.fire_safety_group && ` | 🔥 ${viewingMembersHousehold.fire_safety_group}`}
                </p>
              </div>
              <button className="close-btn" onClick={() => setViewingMembersHousehold(null)}><X size={24} /></button>
            </div>
            
            <div className="members-modal-body">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Họ và tên</th>
                    <th>Quan hệ chủ hộ</th>
                    <th>Ngày sinh</th>
                    <th>CCCD</th>
                    <th>Số điện thoại</th>
                    <th>Nghề nghiệp</th>
                    <th>Trạng thái</th>
                    {!isGuest && <th>Biến động hộ</th>}
                  </tr>
                </thead>
                <tbody>
                  {getHouseholdMembers(viewingMembersHousehold.id).map(member => {
                    const isDeceased = member.status === 'deceased';
                    return (
                      <tr key={member.id} style={isDeceased ? { opacity: 0.65, backgroundColor: '#f8fafc' } : {}}>
                        <td style={{fontWeight: '600', color: isDeceased ? '#64748b' : '#0f172a', textDecoration: isDeceased ? 'line-through' : 'none'}}>
                          {member.full_name} {isDeceased && <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 'normal', textDecoration: 'none', display: 'inline-block', marginLeft: '6px' }}>🕯️ (Đã mất)</span>}
                        </td>
                        <td>
                          {member.is_head ? (
                            <span className="relation-badge head">Chủ hộ</span>
                          ) : isDeceased ? (
                            <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.85rem' }}>—</span>
                          ) : (
                            <select
                              className="relation-select"
                              value={member.relationship_with_head || 'Thành viên'}
                              onChange={(e) => handleUpdateRelationship(member, e.target.value)}
                              title="Thay đổi mối quan hệ với chủ hộ"
                            >
                              {RELATIONSHIP_OPTIONS.filter(o => o !== 'Chủ hộ').map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td style={{ color: '#475569' }}>{formatToDisplayDate(member.dob)}</td>
                        <td><code style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#334155' }}>{member.cccd || '—'}</code></td>
                        <td style={{ color: '#475569' }}>{member.phone || '—'}</td>
                        <td style={{ color: '#475569' }}>{member.occupation || 'Tự do'}</td>
                        <td>
                          <span className={`status-tag ${member.status}`}>
                            {member.status === 'resident' ? 'Thường trú' : member.status === 'temporary_resident' ? 'Tạm trú' : member.status === 'temporary_absent' ? 'Tạm vắng' : member.status === 'stay' ? 'Lưu trú' : 'Đã mất'}
                          </span>
                        </td>
                        {!isGuest && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="action-btn-sm transfer" 
                                onClick={() => {
                                  setTransferringMember(member);
                                  setTargetHouseholdIdForTransfer('');
                                }}
                                title="Chuyển sang hộ gia đình khác"
                              >
                                Chuyển hộ
                              </button>
                              <button 
                                className="action-btn-sm split" 
                                onClick={() => {
                                  setSplittingMember(member);
                                  setNewHkNumberForSplit('');
                                  setNewAddressForSplit('');
                                }}
                                title="Tách ra làm chủ hộ mới"
                              >
                                Tách hộ
                              </button>
                              {!isDeceased && (
                                <button 
                                  className="action-btn-sm deceased" 
                                  onClick={() => setDeceasedConfirmMember(member)}
                                  title="Báo nhân khẩu này đã mất"
                                >
                                  Báo mất
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {getHouseholdMembers(viewingMembersHousehold.id).length === 0 && (
                    <tr>
                      <td colSpan={isGuest ? 7 : 8} style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
                        Hộ gia đình này hiện chưa khai báo nhân khẩu. Vui lòng thêm nhân khẩu ở tab "Quản lý Nhân khẩu".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Member Modal */}
      {transferringMember && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Chuyển hộ khẩu</h2>
              <button className="close-btn" onClick={() => setTransferringMember(null)}><X size={24} /></button>
            </div>
            <div className="modal-form" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Chuyển nhân khẩu <strong>{transferringMember.full_name}</strong> sang hộ gia đình khác trong tổ dân phố:
              </p>
              
              <div className="form-group">
                <label>Chọn hộ gia đình chuyển đến *</label>
                <select 
                  value={targetHouseholdIdForTransfer} 
                  onChange={(e) => setTargetHouseholdIdForTransfer(e.target.value)}
                  required
                >
                  <option value="">-- Chọn hộ gia đình --</option>
                  {households
                    .filter(h => h.id !== transferringMember.household_id)
                    .map(h => {
                      const head = residents.find(r => r.id === h.head_of_household_id);
                      return (
                        <option key={h.id} value={h.id}>
                          Sổ: {h.household_number} - {h.address} (Chủ hộ: {head ? head.full_name : 'Chưa rõ'})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="form-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTransferringMember(null)}>Hủy</button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleTransferHousehold}
                  disabled={!targetHouseholdIdForTransfer}
                >
                  Xác nhận chuyển
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Member Modal */}
      {splittingMember && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Tách hộ khẩu mới</h2>
              <button className="close-btn" onClick={() => setSplittingMember(null)}><X size={24} /></button>
            </div>
            <div className="modal-form" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Tách nhân khẩu <strong>{splittingMember.full_name}</strong> ra làm chủ hộ cho một hộ gia đình mới:
              </p>
              
              <div className="form-group">
                <label>Số sổ hộ khẩu mới *</label>
                <input 
                  type="text" 
                  value={newHkNumberForSplit} 
                  onChange={(e) => setNewHkNumberForSplit(e.target.value)}
                  placeholder="Ví dụ: HK-9988"
                  required
                />
              </div>

              <div className="form-group">
                <label>Địa chỉ nhà mới *</label>
                <input 
                  type="text" 
                  value={newAddressForSplit} 
                  onChange={(e) => setNewAddressForSplit(e.target.value)}
                  placeholder="Ví dụ: Số 12, Ngõ 3 TDP Quảng Giao"
                  required
                />
              </div>

              <div className="form-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSplittingMember(null)}>Hủy</button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSplitHousehold}
                  disabled={!newHkNumberForSplit.trim() || !newAddressForSplit.trim()}
                >
                  Xác nhận tách hộ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deceased Confirmation Modal */}
      {deceasedConfirmMember && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '450px', borderRadius: '16px', border: '1px solid #bae6fd', boxShadow: '0 10px 25px -5px rgba(3, 105, 161, 0.1), 0 8px 10px -6px rgba(3, 105, 161, 0.05)' }}>
            <div className="modal-header" style={{ backgroundColor: '#e0f2fe', borderBottom: '1px solid #bae6fd', padding: '16px 24px', borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
              <h2 style={{ color: '#0369a1', margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🕯️ Xác nhận báo mất
              </h2>
              <button className="close-btn" style={{ color: '#0369a1' }} onClick={() => setDeceasedConfirmMember(null)}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: '1.6' }}>
                Bạn có chắc chắn muốn xác nhận nhân khẩu <strong>{deceasedConfirmMember.full_name}</strong> đã mất? 
                <br /><br />
                <span style={{ color: '#dc2626', fontWeight: '500' }}>Lưu ý:</span> Hệ thống sẽ tự động cập nhật trạng thái cư trú của họ thành <strong>"Đã mất"</strong> và gỡ vai trò chủ hộ nếu có.
              </p>
              
              <div style={{ margin: 0, border: 'none', padding: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setDeceasedConfirmMember(null)}
                  style={{ minHeight: '40px', padding: '0 20px', borderRadius: '8px', fontWeight: '600' }}
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => {
                    executeReportDeceased(deceasedConfirmMember);
                    setDeceasedConfirmMember(null);
                  }}
                  style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', color: 'white', minHeight: '40px', padding: '0 20px', borderRadius: '8px', fontWeight: '600' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0369a1'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested New Head Modal */}
      {suggestedNewHead && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '450px', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 10px 25px -5px rgba(22, 101, 52, 0.1)' }}>
            <div className="modal-header" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '16px 24px', borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
              <h2 style={{ color: '#166534', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏠 Chọn chủ hộ mới
              </h2>
              <button className="close-btn" style={{ color: '#166534' }} onClick={() => setSuggestedNewHead(null)}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#374151', lineHeight: '1.6' }}>
                Chủ hộ vừa được khai tử. Hệ thống gợi ý đặt <strong>{suggestedNewHead.candidate.full_name}</strong> ({suggestedNewHead.candidate.relationship_with_head}) làm <strong>Chủ hộ mới</strong> của hộ này.
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                Bạn có thể xác nhận ngay hoặc bỏ qua và tự chỉ định chủ hộ sau qua chức năng Sửa hộ gia đình.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setSuggestedNewHead(null)}
                  style={{ minHeight: '40px', padding: '0 20px', borderRadius: '8px', fontWeight: '600' }}
                >
                  Bỏ qua
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: 'white', minHeight: '40px', padding: '0 20px', borderRadius: '8px', fontWeight: '600' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                  onClick={async () => {
                    try {
                      const { household, candidate } = suggestedNewHead;
                      await db.saveHousehold({ ...household, head_of_household_id: candidate.id });
                      await db.saveResident({ ...candidate, is_head: true, relationship_with_head: 'Chủ hộ' });
                      showToast(`Đã đặt ${candidate.full_name} làm Chủ hộ mới!`, 'success');
                      setSuggestedNewHead(null);
                      loadData();
                      window.dispatchEvent(new CustomEvent('db-changed'));
                    } catch {
                      showToast('Lỗi khi cập nhật chủ hộ mới!', 'danger');
                    }
                  }}
                >
                  Xác nhận đặt làm Chủ hộ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isAddMemberOpen && targetHouseholdForMember && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2>Thêm thành viên mới</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hộ gia đình: <strong>{getHeadName(targetHouseholdForMember)}</strong> | Sổ: {targetHouseholdForMember.household_number}
                </p>
              </div>
              <button className="close-btn" onClick={() => setIsAddMemberOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddMemberSubmit} className="modal-form">
              <div className="form-group">
                <label>Họ và tên *</label>
                <input 
                  type="text" 
                  value={mFullName} 
                  onChange={(e) => setMFullName(e.target.value)} 
                  placeholder="Ví dụ: Nguyễn Văn A" 
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Giới tính *</label>
                  <select value={mGender} onChange={(e: any) => setMGender(e.target.value)} required>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày sinh *</label>
                  <input 
                    type="text" 
                    value={mDob} 
                    onChange={handleMDobChange} 
                    placeholder="Ví dụ: 02/01/1940"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số CCCD / Định danh</label>
                  <input 
                    type="text" 
                    value={mCccd} 
                    onChange={(e) => setMCccd(e.target.value)} 
                    placeholder="Ví dụ: 038065001234"
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input 
                    type="text" 
                    value={mPhone} 
                    onChange={(e) => setMPhone(e.target.value)} 
                    placeholder="Ví dụ: 0912345678"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quan hệ với chủ hộ *</label>
                  <select value={mRelationship} onChange={(e) => setMRelationship(e.target.value)} required>
                    <option value="Chủ hộ">Chủ hộ</option>
                    <option value="Vợ">Vợ</option>
                    <option value="Chồng">Chồng</option>
                    <option value="Con">Con</option>
                    <option value="Cháu">Cháu</option>
                    <option value="Bố">Bố</option>
                    <option value="Mẹ">Mẹ</option>
                    <option value="Anh">Anh</option>
                    <option value="Chị">Chị</option>
                    <option value="Em">Em</option>
                    <option value="Ông">Ông</option>
                    <option value="Bà">Bà</option>
                    <option value="Khác">Quan hệ khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nghề nghiệp</label>
                  <input 
                    type="text" 
                    value={mOccupation} 
                    onChange={(e) => setMOccupation(e.target.value)} 
                    placeholder="Ví dụ: Học sinh, Kinh doanh..."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Trạng thái cư trú *</label>
                  <select value={mStatus} onChange={(e: any) => setMStatus(e.target.value)} required>
                    <option value="resident">Thường trú</option>
                    <option value="temporary_resident">Tạm trú</option>
                    <option value="temporary_absent">Tạm vắng</option>
                    <option value="stay">Lưu trú (Khách vãng lai)</option>
                    <option value="deceased">Đã mất</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nơi sinh</label>
                  <input 
                    type="text" 
                    value={mPob} 
                    onChange={(e) => setMPob(e.target.value)} 
                    placeholder="Ví dụ: Bệnh viện Thanh Hóa"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea 
                  value={mNotes} 
                  onChange={(e) => setMNotes(e.target.value)} 
                  placeholder="Ghi chú thêm thông tin (nếu có)..."
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', outline: 'none', resize: 'none' }}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddMemberOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Thêm thành viên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .households-page { animation: fadeIn 0.4s ease-out; }
        .household-quick-actions {
          display: flex;
          gap: 4px;
          flex-wrap: nowrap;
          flex-shrink: 0;
        }
        .quick-action-btn {
          height: 28px;
          padding: 0 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .quick-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        .quick-action-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }
        .quick-action-btn.print-btn {
          background-color: #eff6ff;
          color: #1d4ed8;
          border-color: #3b82f6;
        }
        .quick-action-btn.print-btn:hover {
          background-color: #dbeafe;
          border-color: #2563eb;
          color: #1e40af;
        }
        .quick-action-btn.add-member-btn {
          background-color: #f0fdf4;
          color: #15803d;
          border-color: #22c55e;
        }
        .quick-action-btn.add-member-btn:hover {
          background-color: #dcfce7;
          border-color: #16a34a;
          color: #166534;
        }
        .filter-bar { 
          margin-bottom: 24px; 
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .search-box {
          background: white;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 400px;
          max-width: 800px;
        }
        .search-box input { border: none; outline: none; width: 100%; font-size: 1rem; }

        .filter-tabs { display: flex; gap: 8px; }
        .tab-mini {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
          background-color: white;
          border: 1px solid var(--border);
        }
        .tab-mini.active {
          background-color: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .household-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .household-card {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          padding: 20px;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }

        .household-card:hover {
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
          transform: translateY(-4px);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .head-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-menu-container {
          position: relative;
        }

        .dropdown-menu {
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

        .dropdown-menu button {
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

        .dropdown-menu button:hover {
          background-color: #f8fafc;
        }

        .dropdown-menu button.delete-opt {
          color: var(--danger);
        }

        .dropdown-menu button.delete-opt:hover {
          background-color: rgba(239, 68, 68, 0.05);
        }

        .hk-number {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .head-name { font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; color: var(--text-main); }
        .info-row { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.95rem; margin-bottom: 8px; }
        
        .card-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .type-tag {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          background-color: #f1f5f9;
        }

        .type-tag.danger { background-color: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .type-tag.warning { background-color: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .type-tag.info { background-color: rgba(59, 130, 246, 0.1); color: var(--info); }

        .btn-detail {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
          border: none;
          background: none;
        }

        .empty-grid-placeholder {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: var(--radius-lg);
          border: 1px dashed var(--border);
          color: var(--text-muted);
        }

        /* Modal styling is now global in App.css */


        /* Modal Table */
        .members-modal-body {
          overflow-x: auto;
        }

        .modal-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }
 
        .modal-table th {
          background-color: #f8fafc;
          padding: 14px 12px;
          font-weight: 700;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
        }
 
        .modal-table td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
 
        .relation-badge {
          font-size: 0.75rem;
          padding: 3px 10px;
          border-radius: 12px;
          background-color: #f1f5f9;
          font-weight: 600;
          white-space: nowrap;
          display: inline-block;
        }
 
        .relation-badge.head {
          background-color: #e0f2fe;
          color: #0369a1;
        }
 
        .status-tag {
          font-size: 0.75rem;
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 600;
          white-space: nowrap;
          display: inline-block;
        }
 
        .status-tag.resident { background-color: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-tag.temporary_resident { background-color: rgba(59, 130, 246, 0.1); color: var(--info); }
        .status-tag.temporary_absent { background-color: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .status-tag.stay { background-color: rgba(236, 72, 153, 0.1); color: #db2777; }
        .status-tag.deceased { background-color: #e2e8f0; color: #475569; }

        .action-btn-sm {
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          outline: none;
        }

        .action-btn-sm.transfer {
          background-color: #f0f9ff;
          color: #0369a1;
          border-color: #bae6fd;
        }

        .action-btn-sm.transfer:hover {
          background-color: #e0f2fe;
          border-color: #7dd3fc;
        }

        .action-btn-sm.split {
          background-color: #f0fdf4;
          color: #166534;
          border-color: #bbf7d0;
        }

        .action-btn-sm.split:hover {
          background-color: #dcfce7;
          border-color: #86efac;
        }

        .action-btn-sm.deceased {
          background-color: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .action-btn-sm.deceased:hover {
          background-color: #fee2e2;
          border-color: #fca5a5;
        }

        .relation-select {
          appearance: none;
          -webkit-appearance: none;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 26px 4px 10px;
          border-radius: 10px;
          border: 1.5px solid #bae6fd;
          background-color: #f0f9ff;
          color: #0369a1;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230369a1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 7px center;
          min-width: 90px;
        }

        .relation-select:hover {
          border-color: #7dd3fc;
          background-color: #e0f2fe;
        }

        .relation-select:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }

        .relation-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .search-box {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Households;
