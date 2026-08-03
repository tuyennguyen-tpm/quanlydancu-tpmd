import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartPulse, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Search, 
  PhoneCall, 
  CheckCircle2, 
  Edit, 
  Trash2, 
  Baby, 
  Syringe, 
  Ambulance, 
  Stethoscope, 
  RefreshCw,
  Heart,
  UserX,
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Filter,
  Download,
  Home,
  List,
  Users
} from 'lucide-react';


import ExcelJS from 'exceljs';
import { healthDb } from '../services/healthDb';
import { db } from '../services/db';
import type { HealthRecord, VaccinationCampaign, EpidemicReport, FertilityRecord, EmergencyContact } from '../types';

// Helper formatting date to DD/MM/YYYY (Chuẩn Việt Nam)
const formatDateVN = (dateStr?: string): string => {
  if (!dateStr || dateStr === '---' || dateStr.trim() === '') return '---';
  const str = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// 7 Cụm / Tổ tự quản chính thức của Tổ dân phố Quảng Giao
const OFFICIAL_TDP_GROUPS = ['Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];

const normalizeToOfficialGroup = (rawStr?: string): string => {
  if (!rawStr) return 'Tổ 4';
  const str = rawStr.toLowerCase().trim();
  if (str.includes('việt trung') || str.includes('viet trung') || str.includes('vt') || str.includes('tổ 1') || str.includes('thôn 1') || str.includes('cụm 1')) return 'Việt Trung';
  if (str.includes('4') || str.includes('tổ 4') || str.includes('thôn 4')) return 'Tổ 4';
  if (str.includes('5') || str.includes('tổ 5') || str.includes('thôn 5')) return 'Tổ 5';
  if (str.includes('6') || str.includes('tổ 6') || str.includes('thôn 6')) return 'Tổ 6';
  if (str.includes('7') || str.includes('tổ 7') || str.includes('thôn 7')) return 'Tổ 7';
  if (str.includes('8') || str.includes('tổ 8') || str.includes('thôn 8')) return 'Tổ 8';
  if (str.includes('9') || str.includes('tổ 9') || str.includes('thôn 9')) return 'Tổ 9';
  return 'Tổ 4';
};




const HealthCare: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bhyt' | 'chronic' | 'prevention' | 'fertility' | 'emergency'>('bhyt');
  
  // States
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationCampaign[]>([]);
  const [epidemicReports, setEpidemicReports] = useState<EpidemicReport[]>([]);
  const [fertilityRecords, setFertilityRecords] = useState<FertilityRecord[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [bhytFilter, setBhytFilter] = useState<'all' | 'has' | 'missing'>('all');
  const [diseaseFilter, setDiseaseFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'household' | 'flat'>('household');



  // Modals & Editing States
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);

  const [showVaccineModal, setShowVaccineModal] = useState<boolean>(false);
  const [editingVaccine, setEditingVaccine] = useState<VaccinationCampaign | null>(null);

  const [showEpidemicModal, setShowEpidemicModal] = useState<boolean>(false);
  const [editingEpidemic, setEditingEpidemic] = useState<EpidemicReport | null>(null);

  const [showFertilityModal, setShowFertilityModal] = useState<boolean>(false);
  const [editingFertility, setEditingFertility] = useState<FertilityRecord | null>(null);

  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [editingEmergency, setEditingEmergency] = useState<EmergencyContact | null>(null);

  // Excel Import State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<{
    totalRows: number;
    matchedCount: number;
    newCount: number;
    recordsToSave: HealthRecord[];
    logs: string[];
  } | null>(null);

  // Load Data
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [hrs, vacs, epis, ferts, emgs] = await Promise.all([
        healthDb.getHealthRecords(),
        healthDb.getVaccinations(),
        healthDb.getEpidemicReports(),
        healthDb.getFertilityRecords(),
        healthDb.getEmergencyContacts(),
      ]);
      setHealthRecords(hrs);
      setVaccinations(vacs);
      setEpidemicReports(epis);
      setFertilityRecords(ferts);
      setEmergencyContacts(emgs);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu y tế:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute BHYT Statistics
  const bhytStats = useMemo(() => {
    const total = healthRecords.length;
    const hasBhyt = healthRecords.filter(r => r.has_bhyt).length;
    const missingBhyt = total - hasBhyt;
    const percentage = total > 0 ? Math.round((hasBhyt / total) * 100) : 0;
    return { total, hasBhyt, missingBhyt, percentage };
  }, [healthRecords]);

  // Chronic Disease Statistics
  const chronicStats = useMemo(() => {
    const withChronic = healthRecords.filter(r => r.chronic_diseases && r.chronic_diseases.length > 0);
    const disabledCount = healthRecords.filter(r => r.is_disabled).length;
    return { withChronicCount: withChronic.length, disabledCount };
  }, [healthRecords]);

  // Extract 7 official Sub-groups / Cụm / Tổ
  const availableGroups = useMemo(() => OFFICIAL_TDP_GROUPS, []);

  // Compute detailed statistics per Sub-group / Cụm / Tổ (Đúng 7 Tổ chuẩn)
  const groupStatsList = useMemo(() => {
    const map = new Map<string, {
      groupName: string;
      households: Set<string>;
      totalResidents: number;
      hasBhytCount: number;
      missingBhytCount: number;
    }>();

    // Khởi tạo đầy đủ 7 Tổ chính thức
    OFFICIAL_TDP_GROUPS.forEach(gName => {
      map.set(gName, {
        groupName: gName,
        households: new Set(),
        totalResidents: 0,
        hasBhytCount: 0,
        missingBhytCount: 0
      });
    });

    healthRecords.forEach(r => {
      const grp = normalizeToOfficialGroup(r.address);
      if (!map.has(grp)) {
        map.set(grp, {
          groupName: grp,
          households: new Set(),
          totalResidents: 0,
          hasBhytCount: 0,
          missingBhytCount: 0
        });
      }

      const item = map.get(grp)!;
      if (r.household_number) item.households.add(r.household_number);
      item.totalResidents++;
      if (r.has_bhyt) item.hasBhytCount++;
      else item.missingBhytCount++;
    });

    return Array.from(map.values()).map(item => ({
      groupName: item.groupName,
      householdCount: item.households.size || Math.ceil(item.totalResidents / 3),
      totalResidents: item.totalResidents,
      hasBhytCount: item.hasBhytCount,
      missingBhytCount: item.missingBhytCount,
      percentage: item.totalResidents > 0 ? Math.round((item.hasBhytCount / item.totalResidents) * 100) : 0
    }));
  }, [healthRecords]);



  // Filtered Health Records
  const filteredHealthRecords = useMemo(() => {
    return healthRecords.filter(r => {
      const matchSearch = r.resident_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.address && r.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.bhyt_number && r.bhyt_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let matchBhyt = true;
      if (bhytFilter === 'has') matchBhyt = r.has_bhyt;
      if (bhytFilter === 'missing') matchBhyt = !r.has_bhyt;

      let matchDisease = true;
      if (diseaseFilter !== 'all') {
        if (diseaseFilter === 'disabled') matchDisease = r.is_disabled;
        else matchDisease = r.chronic_diseases && r.chronic_diseases.includes(diseaseFilter);
      }

      let matchGroup = true;
      if (groupFilter !== 'all') {
        matchGroup = r.address ? r.address.toLowerCase().includes(groupFilter.toLowerCase()) : false;
      }

      return matchSearch && matchBhyt && matchDisease && matchGroup;
    });
  }, [healthRecords, searchTerm, bhytFilter, diseaseFilter, groupFilter]);

  // Group Filtered Records by Household (Gom nhóm theo Hộ gia đình)
  const groupedHouseholdRecords = useMemo(() => {
    const map = new Map<string, {
      householdKey: string;
      headName: string;
      groupName: string;
      members: HealthRecord[];
    }>();

    filteredHealthRecords.forEach(rec => {
      const hkKey = rec.household_number || rec.address || 'HK-CHUA_PHAN_HO';
      if (!map.has(hkKey)) {
        let grp = normalizeToOfficialGroup(rec.address);


        let head = rec.resident_name;
        if (rec.health_status_note && rec.health_status_note.includes('Chủ hộ')) {
          const match = rec.health_status_note.match(/Chủ hộ\s+([^\n,;]+)/);
          if (match) head = match[1].trim();
        }

        map.set(hkKey, {
          householdKey: hkKey,
          headName: head,
          groupName: grp,
          members: []
        });
      }

      map.get(hkKey)!.members.push(rec);
    });

    return Array.from(map.values());
  }, [filteredHealthRecords]);



  // Form State for Health Record
  const [formData, setFormData] = useState<Partial<HealthRecord>>({
    resident_name: '',
    dob: '',
    gender: 'male',
    address: '',
    phone: '',
    has_bhyt: true,
    bhyt_number: '',
    bhyt_expiry: '',
    chronic_diseases: [],
    is_disabled: false,
    disability_type: '',
    health_status_note: ''
  });

  const [diseaseInput, setDiseaseInput] = useState<string>('');

  // Form State for Vaccine
  const [vacForm, setVacForm] = useState<Partial<VaccinationCampaign>>({
    campaign_name: '',
    vaccine_type: '',
    target_audience: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    location: 'Trạm Y tế Phường Nam Sầm Sơn',
    status: 'upcoming',
    notes: ''
  });

  // Form State for Epidemic
  const [epiForm, setEpiForm] = useState<Partial<EpidemicReport>>({
    disease_name: 'Sốt xuất huyết',
    area: 'Tổ dân phố Quảng Giao',
    case_count: 1,
    risk_level: 'medium',
    actions_taken: '',
    status: 'monitoring',
    reported_date: new Date().toISOString().slice(0, 10)
  });

  // Form State for Fertility
  const [fertForm, setFertForm] = useState<Partial<FertilityRecord>>({
    mother_name: '',
    address: 'Nam Sầm Sơn, Thanh Hóa',
    status: 'pregnant',
    expected_due_date: '',
    birth_date: '',
    child_name: '',
    child_gender: 'male',
    is_third_child_plus: false,
    notes: ''
  });

  // Form State for Emergency Contact
  const [emgForm, setEmgForm] = useState<Partial<EmergencyContact>>({
    name: '',
    role: '',
    phone: '',
    address: '',
    notes: ''
  });

  // Open Add/Edit Modals
  const openAddHealthModal = () => {
    setEditingRecord(null);
    setFormData({
      resident_name: '',
      dob: '',
      gender: 'male',
      address: 'Nam Sầm Sơn, Thanh Hóa',
      phone: '',
      has_bhyt: true,
      bhyt_number: '',
      bhyt_expiry: '2026-12-31',
      chronic_diseases: [],
      is_disabled: false,
      disability_type: '',
      health_status_note: ''
    });
    setDiseaseInput('');
    setShowHealthModal(true);
  };

  const openEditHealthModal = (rec: HealthRecord) => {
    setEditingRecord(rec);
    setFormData(rec);
    setDiseaseInput('');
    setShowHealthModal(true);
  };

  const openAddFertilityModal = () => {
    setEditingFertility(null);
    setFertForm({
      mother_name: '',
      address: 'Nam Sầm Sơn, Thanh Hóa',
      status: 'pregnant',
      expected_due_date: '',
      birth_date: '',
      child_name: '',
      child_gender: 'male',
      is_third_child_plus: false,
      notes: ''
    });
    setShowFertilityModal(true);
  };

  const openEditFertilityModal = (rec: FertilityRecord) => {
    setEditingFertility(rec);
    setFertForm(rec);
    setShowFertilityModal(true);
  };

  const openAddVaccineModal = () => {
    setEditingVaccine(null);
    setVacForm({
      campaign_name: '',
      vaccine_type: '',
      target_audience: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      location: 'Trạm Y tế Phường Nam Sầm Sơn',
      status: 'upcoming',
      notes: ''
    });
    setShowVaccineModal(true);
  };

  const openEditVaccineModal = (vac: VaccinationCampaign) => {
    setEditingVaccine(vac);
    setVacForm(vac);
    setShowVaccineModal(true);
  };

  const openAddEpidemicModal = () => {
    setEditingEpidemic(null);
    setEpiForm({
      disease_name: 'Sốt xuất huyết',
      area: 'Tổ dân phố Quảng Giao',
      case_count: 1,
      risk_level: 'medium',
      actions_taken: '',
      status: 'monitoring',
      reported_date: new Date().toISOString().slice(0, 10)
    });
    setShowEpidemicModal(true);
  };

  const openEditEpidemicModal = (epi: EpidemicReport) => {
    setEditingEpidemic(epi);
    setEpiForm(epi);
    setShowEpidemicModal(true);
  };

  const openAddEmergencyModal = () => {
    setEditingEmergency(null);
    setEmgForm({
      name: '',
      role: 'Cơ sở Y tế địa phương',
      phone: '',
      address: 'Phường Nam Sầm Sơn, TP. Sầm Sơn',
      notes: ''
    });
    setShowEmergencyModal(true);
  };

  const openEditEmergencyModal = (c: EmergencyContact) => {
    setEditingEmergency(c);
    setEmgForm(c);
    setShowEmergencyModal(true);
  };

  // Excel Parse & Strict Verification Handler with CSDL Household Matching
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingExcel(true);
    try {
      // Load CSDL Hộ gia đình và Dân cư chính của TDP Quảng Giao
      let dbHouseholds: any[] = [];
      let dbResidents: any[] = [];
      try {
        [dbHouseholds, dbResidents] = await Promise.all([db.getHouseholds(), db.getResidents()]);
      } catch (err) {
        console.warn('Lỗi đọc CSDL hộ dân chính:', err);
      }

      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const currentRecords = [...healthRecords];
      const recordsToSave: HealthRecord[] = [];
      const logs: string[] = [];
      let totalRows = 0;
      let matchedCount = 0;
      let newCount = 0;

      // Fast O(1) Hash Map lookup indices
      const dbResByCccdMap = new Map<string, any>();
      const dbResByNameMap = new Map<string, any>();
      dbResidents.forEach(r => {
        const cccd = (r.identity_card || r.cccd || '').trim();
        if (cccd) dbResByCccdMap.set(cccd, r);
        if (r.full_name) dbResByNameMap.set(r.full_name.toLowerCase().trim(), r);
      });

      const dbHhByIdMap = new Map<string, any>();
      const dbHhByHeadNameMap = new Map<string, any>();
      dbHouseholds.forEach(h => {
        dbHhByIdMap.set(h.id, h);
        if (h.household_number) dbHhByIdMap.set(h.household_number, h);
        const head = (h as any).household_head_name;
        if (head) dbHhByHeadNameMap.set(head.toLowerCase().trim(), h);
      });

      const currentByBhytMap = new Map<string, number>();
      const currentByNameMap = new Map<string, number>();
      currentRecords.forEach((rec, i) => {
        if (rec.bhyt_number) currentByBhytMap.set(rec.bhyt_number.trim(), i);
        if (rec.resident_name) currentByNameMap.set(rec.resident_name.toLowerCase().trim(), i);
      });

      for (const worksheet of workbook.worksheets) {
        const sheetName = worksheet.name;
        let colName = -1;
        let colBhyt = -1;
        let colDob = -1;
        let colAddress = -1;
        let colCccd = -1;

        // Find headers in first 5 rows
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber <= 5 && colName === -1) {
            row.eachCell((cell, colNumber) => {
              const val = String(cell.value || '').toLowerCase().trim();
              if (val.includes('họ') || val.includes('tên') || val.includes('người')) colName = colNumber;
              if (val.includes('mã') || val.includes('bảo hiểm') || val.includes('bhyt') || val.includes('thẻ')) colBhyt = colNumber;
              if (val.includes('sinh') || val.includes('tuổi') || val.includes('dob')) colDob = colNumber;
              if (val.includes('chỉ') || val.includes('tổ') || val.includes('cụm') || val.includes('thôn')) colAddress = colNumber;
              if (val.includes('cccd') || val.includes('căn cước') || val.includes('cmnd')) colCccd = colNumber;
            });
          }
        });

        if (colName === -1) colName = 4;
        if (colBhyt === -1) colBhyt = 5;

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rawRowValues = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {});
          const rowVals = rawRowValues.map((v: any) => {
            if (v && typeof v === 'object') {
              if (v.richText && Array.isArray(v.richText)) return v.richText.map((rt: any) => rt.text).join('');
              if (v.result !== undefined) return v.result;
            }
            return v;
          });

          const rawName = String(rowVals[colName - 1] || rowVals[3] || '').trim();
          const rawBhyt = String(rowVals[colBhyt - 1] || rowVals[4] || '').trim();
          const rawDob = colDob !== -1 ? String(rowVals[colDob - 1] || '').trim() : String(rowVals[5] || '').trim();
          const rawCccd = colCccd !== -1 ? String(rowVals[colCccd - 1] || '').trim() : String(rowVals[8] || '').trim();
          const rawAddress = colAddress !== -1 ? String(rowVals[colAddress - 1] || '').trim() : `Tổ/Cụm ${sheetName}`;

          if (!rawName || rawName.length < 2 || rawName.toLowerCase().includes('họ và tên') || rawName.toLowerCase().includes('tên chủ hộ')) return;
          if (!rawBhyt || !/^\d+$/.test(rawBhyt)) return;

          totalRows++;
          const normName = rawName.toLowerCase().trim();

          // Fast O(1) Map Lookups
          const matchedDbResident = (rawCccd ? dbResByCccdMap.get(rawCccd.trim()) : null) || dbResByNameMap.get(normName);
          const matchedDbHousehold = dbHhByHeadNameMap.get(normName) || (matchedDbResident ? dbHhByIdMap.get(matchedDbResident.household_id) : null);

          const finalGroup = normalizeToOfficialGroup((matchedDbHousehold as any)?.self_management_group || matchedDbHousehold?.group_name || rawAddress);
          const finalAddress = `${finalGroup}, TDP Quảng Giao`;
          const householdNo = matchedDbHousehold?.household_number || matchedDbResident?.household_id || `HK-${sheetName}`;

          // Fast O(1) Current Health Records Lookup
          const matchedIdx = (rawBhyt ? currentByBhytMap.get(rawBhyt.trim()) : undefined) ?? currentByNameMap.get(normName);

          if (matchedIdx !== undefined && matchedIdx >= 0) {
            matchedCount++;
            const existing = currentRecords[matchedIdx];
            const updated: HealthRecord = {
              ...existing,
              has_bhyt: true,
              bhyt_number: rawBhyt,
              address: finalAddress,
              household_number: householdNo,
              health_status_note: `Đã đối soát khớp CSDL Hộ gia đình: ${matchedDbHousehold?.household_head_name ? 'Chủ hộ ' + matchedDbHousehold.household_head_name : finalGroup}`,
              updated_at: new Date().toISOString()
            };
            currentRecords[matchedIdx] = updated;

            recordsToSave.push(updated);
            logs.push(`✅ [ĐÃ KHỚP CSDL HỘ DÂN] ${rawName} (${finalGroup}) -> Mã BHYT: ${rawBhyt}`);
          } else {
            newCount++;
            const newRec: HealthRecord = {
              id: `HR_${rawBhyt}`,
              resident_id: rawCccd ? `R_${rawCccd}` : `R_${rawBhxhKey(rawBhyt)}`,
              resident_name: rawName,
              dob: rawDob || '1985-01-01',
              gender: 'female',
              household_number: householdNo,
              address: finalAddress,
              has_bhyt: true,
              bhyt_number: rawBhyt,
              bhyt_expiry: '2026-12-31',
              chronic_diseases: [],
              is_disabled: false,
              health_status_note: `Tự động phân bổ vào ${finalGroup}. Thuộc CSDL Hộ gia đình TDP Quảng Giao`,
              updated_at: new Date().toISOString()
            };
            currentRecords.push(newRec);
            recordsToSave.push(newRec);
            logs.push(`➕ [PHÂN BỔ MỚI VÀO CỤM/TỔ] ${rawName} -> ${finalAddress} (Mã BHYT: ${rawBhyt})`);
          }
        });
      }

      setImportPreview({
        totalRows,
        matchedCount,
        newCount,
        recordsToSave,
        logs
      });
      setShowImportModal(true);
    } catch (err) {
      console.error('Lỗi đọc file Excel:', err);
      alert('Không thể đọc file Excel này. Vui lòng kiểm tra định dạng .xlsx hoặc .xls');
    } finally {
      setIsProcessingExcel(false);
      e.target.value = '';
    }
  };

  const rawBhxhKey = (bh: string) => bh || Date.now().toString();


  const confirmImportExcel = async () => {
    if (!importPreview) return;
    setIsProcessingExcel(true);
    try {
      for (const rec of importPreview.recordsToSave) {
        await healthDb.saveHealthRecord(rec);
      }
      alert(`Đã cập nhật an toàn 100% thành công ${importPreview.recordsToSave.length} hồ sơ BHYT vào CSDL TDP Quảng Giao!`);
      setShowImportModal(false);
      loadAllData();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra trong quá trình lưu dữ liệu.');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Automated Sync: Map CSDL Households & Residents to Health BHYT Records
  const handleSyncHouseholdsWithBHYT = async () => {
    setIsProcessingExcel(true);
    try {
      const [dbHouseholds, dbResidents] = await Promise.all([db.getHouseholds(), db.getResidents()]);
      const currentHealth = await healthDb.getHealthRecords();
      let updatedCount = 0;
      let newAddedCount = 0;

      const healthMapByName = new Map<string, HealthRecord>();
      const healthMapByCccd = new Map<string, HealthRecord>();
      const healthMapByBhyt = new Map<string, HealthRecord>();

      currentHealth.forEach(rec => {
        if (rec.resident_name) healthMapByName.set(rec.resident_name.toLowerCase().trim(), rec);
        if (rec.bhyt_number) healthMapByBhyt.set(rec.bhyt_number.trim(), rec);
        if (rec.resident_id && rec.resident_id.startsWith('R_')) {
          const cccd = rec.resident_id.replace('R_', '').trim();
          if (cccd) healthMapByCccd.set(cccd, rec);
        }
      });

      const updatedHealthRecords: HealthRecord[] = [...currentHealth];

      // 1. Process every Resident in DB Households
      for (const res of dbResidents) {
        const normName = (res.full_name || '').toLowerCase().trim();
        if (!normName) continue;

        const resCccd = (res as any).identity_card || res.cccd || '';
        const resAddress = (res as any).address || res.permanent_address || '';

        const matchedHh = dbHouseholds.find(h => h.id === res.household_id || h.household_number === res.household_id);
        const rawGroup = (matchedHh as any)?.self_management_group || (matchedHh as any)?.group_name || resAddress;
        const officialGroup = normalizeToOfficialGroup(rawGroup);
        const hhNumber = matchedHh?.household_number || res.household_id || 'HK-CHUA_PHAN_HO';
        const headName = (matchedHh as any)?.household_head_name || 'Chủ hộ';

        // Check if resident is already in Health Records
        let existingRec = healthMapByCccd.get(resCccd.trim()) ||
                          healthMapByName.get(normName);

        if (existingRec) {
          // Update resident's group, household_number, and note
          const existingIdx = updatedHealthRecords.findIndex(r => r.id === existingRec!.id);
          if (existingIdx >= 0) {
            updatedHealthRecords[existingIdx] = {
              ...existingRec,
              household_number: hhNumber,
              address: `${officialGroup}, TDP Quảng Giao`,
              health_status_note: `Đã phân bổ chuẩn Hộ ông/bà ${headName} (${officialGroup})`,
              updated_at: new Date().toISOString()
            };
            updatedCount++;
          }
        } else {
          // Add resident to Health Records as member of Household
          const newHealthRec: HealthRecord = {
            id: `HR_${resCccd || Date.now()}_${Math.floor(Math.random() * 1000)}`,
            resident_id: resCccd ? `R_${resCccd}` : `R_${res.id}`,
            resident_name: res.full_name,
            dob: res.dob || '1985-01-01',
            gender: res.gender === 'female' ? 'female' : 'male',
            household_number: hhNumber,
            address: `${officialGroup}, TDP Quảng Giao`,
            phone: res.phone || '',
            has_bhyt: false,
            bhyt_number: '',
            chronic_diseases: [],
            is_disabled: false,
            health_status_note: `Tự động phân bổ từ CSDL Hộ gia đình chính thức (${officialGroup}). Hộ: ${headName}`,
            updated_at: new Date().toISOString()
          };
          updatedHealthRecords.push(newHealthRec);
          newAddedCount++;
        }
      }

      // 2. Process existing Health BHYT records and map unlinked records to DB Households
      for (let i = 0; i < updatedHealthRecords.length; i++) {
        const rec = updatedHealthRecords[i];
        const normName = rec.resident_name.toLowerCase().trim();
        const matchedHh = dbHouseholds.find(h => 
          h.household_number === rec.household_number || 
          ((h as any).household_head_name && (h as any).household_head_name.toLowerCase().trim() === normName)
        );

        if (matchedHh) {
          const officialGroup = normalizeToOfficialGroup((matchedHh as any).self_management_group || (matchedHh as any).group_name);
          updatedHealthRecords[i] = {
            ...rec,
            household_number: matchedHh.household_number,
            address: `${officialGroup}, TDP Quảng Giao`
          };
        } else {
          const officialGroup = normalizeToOfficialGroup(rec.address);
          updatedHealthRecords[i] = {
            ...rec,
            address: `${officialGroup}, TDP Quảng Giao`
          };
        }
      }


      // Save all updated health records
      for (const rec of updatedHealthRecords) {
        await healthDb.saveHealthRecord(rec);
      }

      alert(`Đã hoàn tất tự động phân bổ 100% dữ liệu!\n- Cập nhật phân Hộ & Tổ cho: ${updatedCount} nhân khẩu.\n- Phân bổ mới từ CSDL Hộ gia đình: ${newAddedCount} người.\n- Tất cả đã đưa về đúng 7 Cụm/Tổ chính thức của TDP Quảng Giao!`);
      loadAllData();
    } catch (err) {
      console.error('Lỗi tự động phân bổ CSDL:', err);
      alert('Có lỗi xảy ra trong quá trình đồng bộ phân bổ CSDL.');
    } finally {
      setIsProcessingExcel(false);
    }
  };


  // Export Official Household-Structured Excel BHYT File Handler (Chuẩn BHXH Hộ Gia Đình)
  const handleExportExcelBHYT = async () => {
    try {
      // Load CSDL Hộ gia đình và Dân cư chính để lấy thông tin Chủ hộ & Quan hệ
      let dbHouseholds: any[] = [];
      let dbResidents: any[] = [];
      try {
        [dbHouseholds, dbResidents] = await Promise.all([db.getHouseholds(), db.getResidents()]);
      } catch (err) {
        console.warn('Lỗi tải CSDL Hộ dân:', err);
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('BHYT Ho Gia Dinh');

      // Title & Sub-header Block (Chuẩn Mẫu BHXH Việt Nam)
      sheet.addRow(['Tổ dân phố: Tổ dân phố Quảng Giao']);
      sheet.mergeCells('A1:I1');
      sheet.getRow(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF475569' } };

      sheet.addRow(['THỐNG KÊ DANH SÁCH HỘ GIA ĐÌNH THAM GIA BHYT']);
      sheet.mergeCells('A2:I2');
      const titleRow = sheet.getRow(2);
      titleRow.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF047857' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 32;

      sheet.addRow([`Tổ dân phố Quảng Giao - Cập nhật ngày ${new Date().toLocaleDateString('vi-VN')}`]);
      sheet.mergeCells('A3:I3');
      const subTitleRow = sheet.getRow(3);
      subTitleRow.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF64748B' } };
      subTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.addRow([]); // Blank line

      // Table Header Row (Mẫu chuẩn BHXH)
      const headerRow = sheet.addRow([
        'STT Hộ',
        'STT Thành viên',
        'Họ và tên thành viên',
        'Mã số BHXH / BHYT',
        'Ngày tháng năm sinh',
        'Giới tính',
        'Mối quan hệ với chủ hộ',
        'Số CMND / Căn cước',
        'Tổ / Cụm cư trú',
        'Trạng thái BHYT'
      ]);

      headerRow.height = 26;
      headerRow.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF059669' } },
          left: { style: 'thin', color: { argb: 'FF059669' } },
          bottom: { style: 'medium', color: { argb: 'FF059669' } },
          right: { style: 'thin', color: { argb: 'FF059669' } }
        };
      });

      const listToExport = filteredHealthRecords.length > 0 ? filteredHealthRecords : healthRecords;

      // Group records by Household (Gộp theo Hộ gia đình)
      const householdGroups = new Map<string, HealthRecord[]>();
      listToExport.forEach(rec => {
        const key = rec.household_number || rec.address || 'HK-CHUA_PHAN_HO';
        if (!householdGroups.has(key)) householdGroups.set(key, []);
        householdGroups.get(key)!.push(rec);
      });

      let householdIndex = 0;
      householdGroups.forEach((members, householdKey) => {
        householdIndex++;

        // Tìm thông tin Chủ hộ trong CSDL Hộ gia đình chính
        let matchedHh = dbHouseholds.find(h => 
          h.household_number === householdKey || 
          h.id === householdKey ||
          members.some(m => m.resident_name.toLowerCase().trim() === h.household_head_name?.toLowerCase().trim())
        );

        let headName = matchedHh?.household_head_name || members[0]?.resident_name || 'Chưa rõ';
        let groupName = (matchedHh as any)?.self_management_group || members[0]?.address || 'TDP Quảng Giao';

        // Add Household Section Banner Row (Dòng Tiêu đề Hộ Gia Đình)
        const hhBannerRow = sheet.addRow([
          householdIndex,
          '',
          `Tên chủ hộ: ${headName}  ;  Mã hộ gia đình: ${householdKey.replace('HK-', '')}  ;  Đơn vị: ${groupName}`,
          '', '', '', '', '', '', ''
        ]);
        
        sheet.mergeCells(`C${hhBannerRow.number}:J${hhBannerRow.number}`);
        hhBannerRow.height = 22;
        hhBannerRow.eachCell(cell => {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0369A1' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBAE6FD' } },
            bottom: { style: 'thin', color: { argb: 'FFBAE6FD' } }
          };
        });

        // Add Member Rows under Household
        members.forEach((m, mIdx) => {
          let matchedRes = dbResidents.find(r => 
            r.full_name?.toLowerCase().trim() === m.resident_name.toLowerCase().trim()
          );

          let relation = matchedRes?.relation_with_head || (m.resident_name.toLowerCase().trim() === headName.toLowerCase().trim() ? 'Chủ hộ' : 'Thành viên');
          let cccd = matchedRes?.identity_card || (m.resident_id.startsWith('R_') ? m.resident_id.replace('R_', '') : '');

          const row = sheet.addRow([
            '',
            mIdx + 1,
            m.resident_name,
            m.bhyt_number || 'Chưa có',
            m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : '---',
            m.gender === 'female' ? 'Nữ' : 'Nam',
            relation,
            cccd || '---',
            groupName,
            m.has_bhyt ? 'Đã có BHYT' : 'Chưa có BHYT'
          ]);

          row.height = 20;
          row.eachCell((cell, colNum) => {
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: colNum === 2 || colNum === 4 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 10 ? 'center' : 'left' 
            };
            cell.font = { name: 'Calibri', size: 11 };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        });
      });

      // Auto Column Widths
      sheet.columns.forEach((col, cIdx) => {
        let maxLen = 12;
        col.eachCell!({ includeEmpty: false }, cell => {
          const val = String(cell.value || '');
          if (val.length > maxLen && !val.includes('Tên chủ hộ:')) maxLen = val.length;
        });
        col.width = Math.min(Math.max(maxLen + 4, 12), 35);
      });

      // Trigger Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thong_ke_BHYT_HoGiaDinh_TDP_Quang_Giao_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi xuất file Excel BHYT Hộ gia đình:', err);
      alert('Có lỗi xảy ra khi xuất file Excel BHYT Hộ gia đình.');
    }
  };



  // Save & Delete Handlers
  const handleSaveHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resident_name) return;

    const recordToSave: HealthRecord = {
      id: editingRecord ? editingRecord.id : `HR_${Date.now()}`,
      resident_id: formData.resident_id || `R_${Date.now()}`,
      resident_name: formData.resident_name || '',
      dob: formData.dob,
      gender: formData.gender || 'male',
      household_number: formData.household_number || '',
      address: formData.address || '',
      phone: formData.phone || '',
      has_bhyt: formData.has_bhyt ?? true,
      bhyt_number: formData.bhyt_number || '',
      bhyt_expiry: formData.bhyt_expiry || '',
      chronic_diseases: formData.chronic_diseases || [],
      is_disabled: formData.is_disabled ?? false,
      disability_type: formData.disability_type || '',
      health_status_note: formData.health_status_note || '',
      updated_at: new Date().toISOString()
    };

    await healthDb.saveHealthRecord(recordToSave);
    setShowHealthModal(false);
    loadAllData();
  };

  const handleDeleteHealthRecord = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ y tế này?')) {
      await healthDb.deleteHealthRecord(id);
      loadAllData();
    }
  };

  const handleClearAllHealthRecords = async () => {
    if (window.confirm('⚠️ CẢNH BÁO NGUY HẠI:\n\nBạn có chắc chắn muốn XÓA TOÀN BỘ DANH SÁCH Bảo hiểm Y tế (BHYT) hiện tại không?\n\nThao tác này sẽ dọn sạch danh sách BHYT trong hệ thống!')) {
      await healthDb.clearAllHealthRecords();
      setHealthRecords([]);
      loadAllData();
    }
  };


  const handleSaveVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacForm.campaign_name || !vacForm.vaccine_type) return;
    const campaignToSave: VaccinationCampaign = {
      id: editingVaccine ? editingVaccine.id : `VAC_${Date.now()}`,
      campaign_name: vacForm.campaign_name,
      vaccine_type: vacForm.vaccine_type,
      target_audience: vacForm.target_audience || 'Toàn dân TDP',
      start_date: vacForm.start_date || new Date().toISOString().slice(0, 10),
      end_date: vacForm.end_date || new Date().toISOString().slice(0, 10),
      location: vacForm.location || 'Trạm Y tế Phường Nam Sầm Sơn',
      status: vacForm.status || 'upcoming',
      total_target: Number(vacForm.total_target) || 0,
      total_completed: Number(vacForm.total_completed) || 0,
      notes: vacForm.notes || '',
      created_at: editingVaccine ? editingVaccine.created_at : new Date().toISOString()
    };
    await healthDb.saveVaccination(campaignToSave);
    setShowVaccineModal(false);
    loadAllData();
  };

  const handleDeleteVaccine = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đợt tiêm chủng này?')) {
      await healthDb.deleteVaccination(id);
      loadAllData();
    }
  };

  const handleSaveEpidemic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epiForm.disease_name || !epiForm.area) return;
    const reportToSave: EpidemicReport = {
      id: editingEpidemic ? editingEpidemic.id : `EPI_${Date.now()}`,
      disease_name: epiForm.disease_name,
      area: epiForm.area,
      case_count: Number(epiForm.case_count) || 1,
      risk_level: epiForm.risk_level || 'medium',
      actions_taken: epiForm.actions_taken || 'Đã khoanh vùng và phun thuốc diệt muỗi/khử khuẩn.',
      status: epiForm.status || 'monitoring',
      reported_date: epiForm.reported_date || new Date().toISOString().slice(0, 10)
    };
    await healthDb.saveEpidemicReport(reportToSave);
    setShowEpidemicModal(false);
    loadAllData();
  };

  const handleDeleteEpidemic = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa cảnh báo dịch bệnh này?')) {
      await healthDb.deleteEpidemicReport(id);
      loadAllData();
    }
  };

  const handleSaveFertility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fertForm.mother_name) return;
    const fertToSave: FertilityRecord = {
      id: editingFertility ? editingFertility.id : `FER_${Date.now()}`,
      mother_name: fertForm.mother_name,
      address: fertForm.address || 'Quảng Giao',
      status: fertForm.status || 'pregnant',
      expected_due_date: fertForm.expected_due_date,
      birth_date: fertForm.birth_date,
      child_name: fertForm.child_name,
      child_gender: fertForm.child_gender || 'male',
      is_third_child_plus: fertForm.is_third_child_plus ?? false,
      notes: fertForm.notes || '',
      created_at: editingFertility ? editingFertility.created_at : new Date().toISOString()
    };
    await healthDb.saveFertilityRecord(fertToSave);
    setShowFertilityModal(false);
    loadAllData();
  };

  const handleDeleteFertilityRecord = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ thai sản/sinh con này?')) {
      await healthDb.deleteFertilityRecord(id);
      loadAllData();
    }
  };

  const handleSaveEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emgForm.name || !emgForm.phone) return;
    const contactToSave: EmergencyContact = {
      id: editingEmergency ? editingEmergency.id : `EMG_${Date.now()}`,
      name: emgForm.name,
      role: emgForm.role || 'Cơ sở Y tế',
      phone: emgForm.phone,
      address: emgForm.address || '',
      notes: emgForm.notes || ''
    };
    await healthDb.saveEmergencyContact(contactToSave);
    setShowEmergencyModal(false);
    loadAllData();
  };

  const handleDeleteEmergencyContact = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa số hotline liên hệ này?')) {
      await healthDb.deleteEmergencyContact(id);
      loadAllData();
    }
  };

  const addDiseaseTag = () => {
    if (!diseaseInput.trim()) return;
    const current = formData.chronic_diseases || [];
    if (!current.includes(diseaseInput.trim())) {
      setFormData({ ...formData, chronic_diseases: [...current, diseaseInput.trim()] });
    }
    setDiseaseInput('');
  };

  const removeDiseaseTag = (tag: string) => {
    const current = formData.chronic_diseases || [];
    setFormData({ ...formData, chronic_diseases: current.filter(t => t !== tag) });
  };

  return (
    <div className="healthcare-page fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* HEADER SECTION */}
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #10b981, #059669)', 
            color: 'white', 
            padding: '14px', 
            borderRadius: '14px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <HeartPulse size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
              Y tế cơ sở & Sức khỏe cộng đồng
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.95rem' }}>
              Quản lý BHYT toàn dân, bệnh mãn tính, tiêm chủng, dịch bệnh & phản ứng y tế khẩn cấp Tổ dân phố Quảng Giao
            </p>
          </div>
        </div>

        {/* RIGHT TOOLBAR: 2-TIER ALIGNED BUTTON GROUP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          {/* TIER 1: MAIN ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={handleSyncHouseholdsWithBHYT}
              className="btn btn-outline" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '9px 16px', 
                borderRadius: '10px',
                background: '#fdf4ff',
                color: '#c026d3',
                border: '1px solid #e879f9',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(217, 70, 239, 0.12)'
              }}
              title="Tự động phân bổ 100% CSDL Hộ gia đình & BHYT theo 7 Cụm/Tổ"
            >
              <RefreshCw size={16} className={isProcessingExcel ? 'spin' : ''} /> Phân bổ CSDL Hộ Dân

            </button>

            {activeTab === 'prevention' ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={openAddVaccineModal}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: '#8b5cf6', border: 'none', color: 'white', fontWeight: 700 }}
                >
                  <Plus size={16} /> Thêm Lịch tiêm
                </button>
                <button 
                  onClick={openAddEpidemicModal}
                  className="btn btn-danger"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 700 }}
                >
                  <Plus size={16} /> Báo Dịch bệnh
                </button>
              </div>
            ) : activeTab === 'fertility' ? (
              <button 
                onClick={openAddFertilityModal}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', background: '#ec4899', border: 'none', color: 'white', fontWeight: 700 }}
              >
                <Plus size={18} /> Thêm Thai sản
              </button>
            ) : activeTab === 'emergency' ? (
              <button 
                onClick={openAddEmergencyModal}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 700 }}
              >
                <Plus size={18} /> Thêm Hotline
              </button>
            ) : (
              <button 
                onClick={openAddHealthModal}
                className="btn btn-primary"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '9px 18px', 
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Plus size={18} /> Thêm Hồ sơ Y tế
              </button>
            )}
          </div>

          {/* TIER 2: EXCEL & UTILITY BUTTONS */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={handleExportExcelBHYT}
              className="btn btn-outline" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '7px 14px', 
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #93c5fd',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              title="Xuất file Excel danh sách BHYT chuẩn mẫu BHXH"
            >
              <Download size={15} /> 📊 Xuất Excel BHYT
            </button>

            <label className="btn btn-outline" style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '7px 14px', 
              borderRadius: '8px',
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #6ee7b7',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}>
              <Upload size={15} />
              {isProcessingExcel ? 'Đang đọc...' : '📥 Import Excel BHYT'}
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleExcelFileUpload} 
                disabled={isProcessingExcel}
                style={{ display: 'none' }} 
              />
            </label>

            <button 
              onClick={loadAllData}
              className="btn btn-outline"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '7px 14px', 
                borderRadius: '8px',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #475569)',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Làm mới
            </button>
          </div>
        </div>

      </div>

      {/* STATS OVERVIEW CARDS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div className="stat-card" style={{ 
          background: 'var(--card-bg, #ffffff)', 
          padding: '20px', 
          borderRadius: '14px', 
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ background: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '12px' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Phủ BHYT Toàn dân</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
              {bhytStats.percentage}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
              {bhytStats.hasBhyt}/{bhytStats.total} nhân khẩu đã có thẻ
            </div>
          </div>
        </div>

        <div className="stat-card" style={{ 
          background: 'var(--card-bg, #ffffff)', 
          padding: '20px', 
          borderRadius: '14px', 
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '12px' }}>
            <UserX size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Cần Vận động BHYT</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
              {bhytStats.missingBhyt} hộ/người
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>Đang lên danh sách vận động</div>
          </div>
        </div>

        <div className="stat-card" style={{ 
          background: 'var(--card-bg, #ffffff)', 
          padding: '20px', 
          borderRadius: '14px', 
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '12px', borderRadius: '12px' }}>
            <Stethoscope size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Bệnh nền / Mãn tính</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>
              {chronicStats.withChronicCount} trường hợp
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>Cần cấp thuốc định kỳ</div>
          </div>
        </div>

        <div className="stat-card" style={{ 
          background: 'var(--card-bg, #ffffff)', 
          padding: '20px', 
          borderRadius: '14px', 
          border: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ background: '#fce7f3', color: '#ec4899', padding: '12px', borderRadius: '12px' }}>
            <Baby size={26} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Dân số & Thai sản</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ec4899', marginTop: '2px' }}>
              {fertilityRecords.length} hồ sơ
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>Theo dõi chăm sóc SKSS</div>
          </div>
        </div>
      </div>

      {/* 3D NAVIGATION TABS SYSTEM */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '28px',
        overflowX: 'auto',
        padding: '6px 4px 12px 4px',
        maxWidth: '100%'
      }}>
        {[
          { id: 'bhyt', label: 'Bảo hiểm Y tế (BHYT)', icon: ShieldCheck, count: bhytStats.total, activeGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', activeShadow: 'rgba(16, 185, 129, 0.4)', activeColor: '#10b981' },
          { id: 'chronic', label: 'Bệnh nền & Sức khỏe đặc biệt', icon: Heart, count: chronicStats.withChronicCount, activeGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', activeShadow: 'rgba(59, 130, 246, 0.4)', activeColor: '#3b82f6' },
          { id: 'prevention', label: 'Tiêm chủng & Dịch bệnh TDP', icon: Syringe, count: vaccinations.length + epidemicReports.length, activeGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', activeShadow: 'rgba(139, 92, 246, 0.4)', activeColor: '#8b5cf6' },
          { id: 'fertility', label: 'Dân số & Thai sản', icon: Baby, count: fertilityRecords.length, activeGradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', activeShadow: 'rgba(236, 72, 153, 0.4)', activeColor: '#ec4899' },
          { id: 'emergency', label: 'Hotline Y tế & Khẩn cấp', icon: Ambulance, count: emergencyContacts.length, activeGradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', activeShadow: 'rgba(239, 68, 68, 0.4)', activeColor: '#ef4444' }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '14px',
                flexShrink: 0,
                border: isActive ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid var(--border-color, #e2e8f0)',
                background: isActive ? tab.activeGradient : 'var(--card-bg, #ffffff)',
                color: isActive ? 'white' : 'var(--text-main, #334155)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                whiteSpace: 'nowrap',
                boxShadow: isActive 
                  ? `0 8px 20px -4px ${tab.activeShadow}, 0 4px 6px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.2)`
                  : '0 4px 10px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -2px 0 rgba(0,0,0,0.05)',
                transform: isActive ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.03)';
                }
              }}
            >
              <div style={{
                background: isActive ? 'rgba(255, 255, 255, 0.22)' : '#f1f5f9',
                padding: '6px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'none'
              }}>
                <Icon size={20} color={isActive ? 'white' : tab.activeColor} />
              </div>
              <span style={{ textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{ 
                  background: isActive ? 'rgba(255, 255, 255, 0.28)' : '#e2e8f0', 
                  color: isActive ? 'white' : '#475569', 
                  fontSize: '0.8rem', 
                  padding: '3px 10px', 
                  borderRadius: '20px',
                  fontWeight: 800,
                  boxShadow: isActive ? 'inset 0 1px 2px rgba(0,0,0,0.15)' : 'none',
                  border: isActive ? '1px solid rgba(255,255,255,0.4)' : 'none'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SEARCH AND FILTER BAR FOR TAB 1 & 2 */}
      {(activeTab === 'bhyt' || activeTab === 'chronic') && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '12px', 
          marginBottom: '20px',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Tìm theo tên nhân khẩu, mã BHYT, địa chỉ..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {/* DROPDOWN LỌC CỤM / TỔ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} color="#3b82f6" />
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #3b82f6',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.1)'
              }}
            >
              <option value="all">🏡 Tất cả Cụm / Tổ TDP ({healthRecords.length})</option>
              {availableGroups.map((grp, idx) => (
                <option key={idx} value={grp}>
                  📍 {grp}
                </option>
              ))}
            </select>
          </div>


          {activeTab === 'bhyt' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ XEM GỘP THEO HỘ GIA ĐÌNH */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg, #ffffff)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color, #cbd5e1)' }}>
                <button
                  onClick={() => setViewMode('household')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: viewMode === 'household' ? '#3b82f6' : 'transparent',
                    color: viewMode === 'household' ? 'white' : 'var(--text-muted, #64748b)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Chế độ gom nhóm thành viên theo từng Hộ Gia Đình"
                >
                  <Home size={15} /> Gom theo Hộ
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: viewMode === 'flat' ? '#3b82f6' : 'transparent',
                    color: viewMode === 'flat' ? 'white' : 'var(--text-muted, #64748b)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Dạng bảng phẳng toàn bộ danh sách"
                >
                  <List size={15} /> Dạng Bảng
                </button>
              </div>

              {/* FILTER TRẠNG THÁI BHYT */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--card-bg, #ffffff)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color, #cbd5e1)' }}>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'has', label: 'Đã có BHYT' },
                  { id: 'missing', label: 'Chưa có BHYT' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setBhytFilter(f.id as any)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: bhytFilter === f.id ? '#10b981' : 'transparent',
                      color: bhytFilter === f.id ? 'white' : 'var(--text-muted, #64748b)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>


              {/* NÚT XÓA TOÀN BỘ DANH SÁCH BHYT */}
              <button 
                onClick={handleClearAllHealthRecords}
                className="btn btn-danger"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  padding: '9px 16px', 
                  borderRadius: '10px', 
                  background: '#fef2f2', 
                  color: '#ef4444', 
                  border: '1px solid #fca5a5', 
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.1)'
                }}
                title="Xóa toàn bộ danh sách Bảo hiểm Y tế hiện tại"
              >
                <Trash2 size={16} /> Xóa toàn bộ danh sách BHYT
              </button>
            </div>
          )}


          {activeTab === 'chronic' && (
            <select
              value={diseaseFilter}
              onChange={e => setDiseaseFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #1e293b)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              <option value="all">Tất cả bệnh nền</option>
              <option value="Cao huyết áp">Cao huyết áp</option>
              <option value="Tim mạch">Tim mạch</option>
              <option value="Tiểu đường Tuýp 2">Tiểu đường</option>
              <option value="Xương khớp">Xương khớp</option>
              <option value="disabled">Người khuyết tật</option>
            </select>
          )}
        </div>
      )}

      {/* TAB 1: BẢO HIỂM Y TẾ (BHYT) */}
      {activeTab === 'bhyt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* DANH SÁCH BHYT: GOM THEO HỘ GIA ĐÌNH HOẶC DẠNG BẢNG PHẲNG */}
          {viewMode === 'household' ? (


            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groupedHouseholdRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--card-bg, #ffffff)', borderRadius: '14px', color: 'var(--text-muted, #94a3b8)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  Không tìm thấy hồ sơ BHYT phù hợp với bộ lọc.
                </div>
              ) : (
                groupedHouseholdRecords.map((hh, idx) => (
                  <div key={idx} style={{ 
                    background: 'var(--card-bg, #ffffff)', 
                    borderRadius: '14px', 
                    border: '1px solid var(--border-color, #e2e8f0)', 
                    overflow: 'hidden', 
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
                  }}>
                    {/* HỘ GIA ĐÌNH BANNER HEADER */}
                    <div style={{ 
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08))', 
                      padding: '12px 18px', 
                      borderBottom: '1px solid var(--border-color, #e2e8f0)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Home size={18} color="#10b981" />
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-main, #1e293b)' }}>
                          Hộ ông/bà: <span style={{ color: '#047857' }}>{hh.headName}</span>
                        </span>
                        <span style={{ fontSize: '0.82rem', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          📍 {hh.groupName}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                          Mã HK: {hh.householdKey.replace('HK-', '')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 800, 
                          color: '#047857', 
                          background: '#ecfdf5', 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          border: '1px solid #a7f3d0' 
                        }}>
                          👥 {hh.members.length} thành viên ({hh.members.filter(m => m.has_bhyt).length} đã có BHYT)
                        </span>
                      </div>
                    </div>

                    {/* TABLE BẢNG THÀNH VIÊN TRONG HỘ */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                            <th style={{ padding: '10px 16px', fontWeight: 700 }}>Họ và tên thành viên</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700 }}>Ngày sinh / Giới tính</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700 }}>Mã số & Hạn thẻ BHYT</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700 }}>Trạng thái BHYT</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Thao tác</th>

                          </tr>
                        </thead>
                        <tbody>
                          {hh.members.map(rec => (
                            <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-main, #1e293b)' }}>
                                {rec.resident_name}
                                {rec.resident_name.toLowerCase().trim() === hh.headName.toLowerCase().trim() && (
                                  <span style={{ marginLeft: '6px', fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    CHỦ HỘ
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 16px', color: 'var(--text-muted, #64748b)' }}>
                                {formatDateVN(rec.dob)} ({rec.gender === 'female' ? 'Nữ' : 'Nam'})
                              </td>
                              <td style={{ padding: '10px 16px' }}>
                                {rec.bhyt_number ? (
                                  <div>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{rec.bhyt_number}</div>
                                    {rec.bhyt_expiry && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                                        Hạn: {formatDateVN(rec.bhyt_expiry)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted, #cbd5e1)', fontStyle: 'italic' }}>Chưa cập nhật</span>
                                )}
                              </td>

                              <td style={{ padding: '10px 16px' }}>
                                {rec.has_bhyt ? (
                                  <span style={{ background: '#ecfdf5', color: '#10b981', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} /> Đã có BHYT
                                  </span>
                                ) : (
                                  <span style={{ background: '#fef2f2', color: '#ef4444', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={13} /> Cần vận động
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                <button onClick={() => openEditHealthModal(rec)} style={{ border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', padding: '4px' }} title="Sửa hồ sơ"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteHealthRecord(rec.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px', marginLeft: '4px' }} title="Xóa hồ sơ"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* BẢNG PHẲNG TOÀN BỘ DANH SÁCH */
            <div className="card-container" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                      <th style={{ padding: '14px 16px', fontWeight: 700 }}>Họ và tên</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700 }}>Ngày sinh / Giới tính</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700 }}>Địa chỉ / Điện thoại</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700 }}>Trạng thái BHYT</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700 }}>Mã số & Hạn thẻ</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Thao tác</th>

                    </tr>
                  </thead>
                  <tbody>
                    {filteredHealthRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted, #94a3b8)' }}>
                          Khởi tạo danh sách hoặc không tìm thấy hồ sơ BHYT phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredHealthRecords.map(rec => (
                        <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-main, #1e293b)' }}>
                            {rec.resident_name}
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-muted, #64748b)' }}>
                            {formatDateVN(rec.dob)} 
                            <span style={{ marginLeft: '6px', fontSize: '0.85rem' }}>
                              ({rec.gender === 'female' ? 'Nữ' : 'Nam'})
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div>{rec.address || 'Quảng Giao'}</div>
                            {rec.phone && <div style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>📞 {rec.phone}</div>}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {rec.has_bhyt ? (
                              <span style={{ 
                                background: '#ecfdf5', 
                                color: '#10b981', 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                fontWeight: 700, 
                                fontSize: '0.85rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <CheckCircle2 size={14} /> Đã có BHYT
                              </span>
                            ) : (
                              <span style={{ 
                                background: '#fef3c7', 
                                color: '#d97706', 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                fontWeight: 700, 
                                fontSize: '0.85rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <AlertTriangle size={14} /> Cần vận động
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {rec.bhyt_number ? (
                              <div>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{rec.bhyt_number}</div>
                                {rec.bhyt_expiry && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                                    Hạn: {formatDateVN(rec.bhyt_expiry)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #cbd5e1)', fontStyle: 'italic' }}>Chưa cập nhật</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button 
                              onClick={() => openEditHealthModal(rec)}
                              style={{ border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', padding: '6px' }}
                              title="Chỉnh sửa hồ sơ"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteHealthRecord(rec.id)}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '6px', marginLeft: '6px' }}
                              title="Xóa hồ sơ"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}




      {/* TAB 2: BỆNH NỀN & SỨC KHỎE ĐẶC BIỆT */}
      {activeTab === 'chronic' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredHealthRecords.filter(r => (r.chronic_diseases && r.chronic_diseases.length > 0) || r.is_disabled).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', background: 'var(--card-bg, #ffffff)', borderRadius: '14px', color: 'var(--text-muted, #94a3b8)' }}>
              Không có hồ sơ bệnh nền / sức khỏe đặc biệt trùng khớp với tìm kiếm.
            </div>
          ) : (
            filteredHealthRecords.filter(r => (r.chronic_diseases && r.chronic_diseases.length > 0) || r.is_disabled).map(rec => (
              <div 
                key={rec.id}
                style={{ 
                  background: 'var(--card-bg, #ffffff)', 
                  borderRadius: '14px', 
                  border: '1px solid var(--border-color, #e2e8f0)',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
                        {rec.resident_name}
                      </h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                        {rec.address}
                      </span>
                    </div>
                    {rec.has_bhyt && (
                      <span style={{ background: '#ecfdf5', color: '#10b981', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                        BHYT OK
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '6px' }}>
                      BỆNH MÃN TÍNH / TÌNH TRẠNG SỨC KHỎE:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {rec.chronic_diseases && rec.chronic_diseases.map((d, i) => (
                        <span key={i} style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>
                          ❤️ {d}
                        </span>
                      ))}
                      {rec.is_disabled && (
                        <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>
                          ♿ Người khuyết tật ({rec.disability_type || 'Đặc biệt'})
                        </span>
                      )}
                    </div>
                  </div>

                  {rec.health_status_note && (
                    <div style={{ 
                      background: 'var(--bg-main, #f8fafc)', 
                      padding: '10px 12px', 
                      borderRadius: '8px', 
                      fontSize: '0.85rem', 
                      color: 'var(--text-main, #334155)',
                      marginBottom: '12px'
                    }}>
                      📝 {rec.health_status_note}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                    📞 {rec.phone || 'Chưa cập nhật SĐT'}
                  </span>
                  <button 
                    onClick={() => openEditHealthModal(rec)}
                    style={{ border: 'none', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Chỉnh sửa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: TIÊM CHỦNG & DỊCH BỆNH */}
      {activeTab === 'prevention' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* CỘT 1: LỊCH TIÊM CHỦNG MỞ RỘNG */}
          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Syringe size={20} color="#8b5cf6" /> Lịch Tiêm chủng mở rộng
              </h3>
              <button 
                onClick={openAddVaccineModal}
                style={{ background: '#f3e8ff', color: '#8b5cf6', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={16} /> Thêm Lịch tiêm
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vaccinations.map(vac => (
                <div key={vac.id} style={{ background: 'var(--bg-main, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main, #1e293b)' }}>
                      {vac.campaign_name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        background: vac.status === 'completed' ? '#ecfdf5' : '#eff6ff', 
                        color: vac.status === 'completed' ? '#10b981' : '#3b82f6', 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px', 
                        fontWeight: 700 
                      }}>
                        {vac.status === 'completed' ? 'Đã hoàn thành' : 'Sắp diễn ra'}
                      </span>
                      <button onClick={() => openEditVaccineModal(vac)} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px' }} title="Sửa"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteVaccine(vac.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', margin: '6px 0' }}>
                    💊 Vắc xin: <strong>{vac.vaccine_type}</strong> ({vac.target_audience})
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', display: 'flex', gap: '12px' }}>
                    <span>📅 {new Date(vac.start_date).toLocaleDateString('vi-VN')}</span>
                    <span>📍 {vac.location}</span>
                  </div>
                  {vac.notes && <div style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '6px' }}>📌 {vac.notes}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* CỘT 2: GIÁM SÁT DỊCH BỆNH & Y TẾ DỰ PHÒNG */}
          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="#ef4444" /> Cảnh báo Ổ dịch & Y tế Dự phòng
              </h3>
              <button 
                onClick={openAddEpidemicModal}
                style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={16} /> Báo Dịch bệnh
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {epidemicReports.map(epi => (
                <div key={epi.id} style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fca5a5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#991b1b' }}>
                      🚨 {epi.disease_name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                        Rủi ro: {epi.risk_level.toUpperCase()}
                      </span>
                      <button onClick={() => openEditEpidemicModal(epi)} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px' }} title="Sửa"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteEpidemic(epi.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: '6px 0', fontWeight: 600 }}>
                    📍 Khu vực: {epi.area} ({epi.case_count} ca ghi nhận)
                  </div>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.82rem', color: '#334155' }}>
                    🛡️ <strong>Đã xử lý:</strong> {epi.actions_taken}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: DÂN SỐ & THAI SẢN */}
      {activeTab === 'fertility' && (
        <div className="card-container" style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Baby size={22} color="#ec4899" /> Hồ sơ Chăm sóc Sức khỏe Sinh sản & Dân số TDP
            </h3>
            <button 
              onClick={openAddFertilityModal}
              style={{ background: '#fce7f3', color: '#ec4899', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Thêm Hồ sơ Thai sản / Sinh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tên mẹ / Hộ gia đình</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Địa chỉ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Dự sinh / Ngày sinh</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thông tin con</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Con thứ 3+</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {fertilityRecords.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{f.mother_name}</td>
                    <td style={{ padding: '12px 16px' }}>{f.address}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.status === 'pregnant' ? (
                        <span style={{ background: '#fce7f3', color: '#ec4899', padding: '3px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>
                          🤰 Đang mang thai
                        </span>
                      ) : (
                        <span style={{ background: '#ecfdf5', color: '#10b981', padding: '3px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>
                          👶 Đã sinh con
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.status === 'pregnant' ? (
                        <span>Dự sinh: {f.expected_due_date ? new Date(f.expected_due_date).toLocaleDateString('vi-VN') : '---'}</span>
                      ) : (
                        <span>Ngày sinh: {f.birth_date ? new Date(f.birth_date).toLocaleDateString('vi-VN') : '---'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.child_name ? `${f.child_name} (${f.child_gender === 'male' ? 'Bé trai' : 'Bé gái'})` : '---'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.is_third_child_plus ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ Có</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Không</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => openEditFertilityModal(f)}
                        style={{ border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', padding: '6px' }}
                        title="Chỉnh sửa hồ sơ thai sản"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteFertilityRecord(f.id)}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '6px', marginLeft: '6px' }}
                        title="Xóa hồ sơ thai sản"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DANH BẠ Y TẾ KHẨN CẤP */}
      {activeTab === 'emergency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall size={22} color="#ef4444" /> Danh bạ Hotline Cấp cứu & Y tế Địa phương
            </h3>
            <button 
              onClick={openAddEmergencyModal}
              style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Thêm Hotline Khẩn cấp
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {emergencyContacts.map(c => (
              <div 
                key={c.id}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(245, 158, 11, 0.05))', 
                  padding: '20px', 
                  borderRadius: '14px', 
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '4px' }}>
                  <button onClick={() => openEditEmergencyModal(c)} style={{ border: 'none', background: 'white', color: '#3b82f6', cursor: 'pointer', padding: '6px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} title="Sửa Hotline"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteEmergencyContact(c.id)} style={{ border: 'none', background: 'white', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} title="Xóa Hotline"><Trash2 size={16} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '10px' }}>
                    <PhoneCall size={22} />
                  </div>
                  <div style={{ paddingRight: '50px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
                      {c.name}
                    </h4>
                    <span style={{ fontSize: '0.82rem', color: '#d97706', fontWeight: 600 }}>{c.role}</span>
                  </div>
                </div>

                <div style={{ 
                  background: 'white', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  textAlign: 'center', 
                  marginBottom: '10px',
                  border: '1px solid #fee2e2'
                }}>
                  <a 
                    href={`tel:${c.phone}`} 
                    style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', textDecoration: 'none', display: 'block' }}
                  >
                    📞 {c.phone}
                  </a>
                </div>

                {c.address && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>📍 {c.address}</div>}
                {c.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontStyle: 'italic', marginBottom: '12px' }}>ℹ️ {c.notes}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                  <button 
                    onClick={() => openEditEmergencyModal(c)}
                    style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit size={14} /> Chỉnh sửa
                  </button>
                  <button 
                    onClick={() => handleDeleteEmergencyContact(c.id)}
                    style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL ĐỐI SOÁT CHÍNH XÁC 100% */}
      {showImportModal && importPreview && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={22} /> Báo cáo Đối soát BHYT từ File Excel
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Kiểm tra & xác nhận chính xác trước khi lưu vào CSDL TDP Quảng Giao</span>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tổng số dòng đọc</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{importPreview.totalRows}</div>
              </div>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>Đã khớp đúng 100%</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{importPreview.matchedCount} người</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600 }}>Thêm mới nhân khẩu</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>{importPreview.newCount} người</div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '280px', overflowY: 'auto', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>NHẬT KÝ ĐỐI SOÁT CHI TIẾT TỪNG DÒNG:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {importPreview.logs.map((log, idx) => (
                  <div key={idx} style={{ fontSize: '0.82rem', fontFamily: 'monospace', padding: '6px 10px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0', color: log.includes('✅') ? '#047857' : '#1d4ed8' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowImportModal(false)} className="btn btn-outline" style={{ padding: '10px 20px' }}>Hủy bỏ</button>
              <button 
                onClick={confirmImportExcel} 
                className="btn btn-primary" 
                disabled={isProcessingExcel}
                style={{ padding: '10px 24px', background: '#10b981', border: 'none', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CheckCircle size={18} />
                {isProcessingExcel ? 'Đang lưu...' : 'Xác nhận Cập nhật 100% Chính xác'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: THÊM / SỬA HỒ SƠ Y TẾ */}
      {showHealthModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{ 
            background: 'var(--card-bg, #ffffff)', 
            borderRadius: '16px', 
            maxWidth: '650px', 
            width: '100%', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
              {editingRecord ? 'Chỉnh sửa Hồ sơ Y tế' : 'Tạo Hồ sơ Y tế Dân cư mới'}
            </h2>

            <form onSubmit={handleSaveHealthRecord} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Họ và tên nhân khẩu *</label>
                <input 
                  type="text" 
                  required
                  value={formData.resident_name || ''} 
                  onChange={e => setFormData({ ...formData, resident_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ngày sinh</label>
                  <input 
                    type="date" 
                    value={formData.dob || ''} 
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Giới tính</label>
                  <select 
                    value={formData.gender || 'male'} 
                    onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Địa chỉ / Số nhà</label>
                  <input 
                    type="text" 
                    value={formData.address || ''} 
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Số 45, Nam Sầm Sơn..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Số điện thoại liên hệ</label>
                  <input 
                    type="text" 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0912..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* SECTION BHYT */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="has_bhyt_cb" 
                    checked={formData.has_bhyt ?? true} 
                    onChange={e => setFormData({ ...formData, has_bhyt: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="has_bhyt_cb" style={{ fontWeight: 700, cursor: 'pointer' }}>Đã có Thẻ Bảo hiểm Y tế (BHYT)</label>
                </div>

                {formData.has_bhyt && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Mã số thẻ BHYT</label>
                      <input 
                        type="text" 
                        value={formData.bhyt_number || ''} 
                        onChange={e => setFormData({ ...formData, bhyt_number: e.target.value })}
                        placeholder="GD4380..."
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Ngày hết hạn thẻ</label>
                      <input 
                        type="date" 
                        value={formData.bhyt_expiry || ''} 
                        onChange={e => setFormData({ ...formData, bhyt_expiry: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION BỆNH MÃN TÍNH */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Bệnh mãn tính / Bệnh nền (Nhấn Enter hoặc thêm tag)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    value={diseaseInput} 
                    onChange={e => setDiseaseInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDiseaseTag(); } }}
                    placeholder="Nhập tên bệnh: Cao huyết áp, Tim mạch..."
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button type="button" onClick={addDiseaseTag} className="btn btn-outline" style={{ padding: '8px 14px' }}>
                    Thêm
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {formData.chronic_diseases && formData.chronic_diseases.map((tag, idx) => (
                    <span key={idx} style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {tag}
                      <span onClick={() => removeDiseaseTag(tag)} style={{ cursor: 'pointer', fontWeight: 800 }}>×</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* SECTION KHUYẾT TẬT & GHI CHÚ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="is_disabled_cb"
                  checked={formData.is_disabled ?? false} 
                  onChange={e => setFormData({ ...formData, is_disabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_disabled_cb" style={{ fontWeight: 700, cursor: 'pointer' }}>Là người khuyết tật / Đối tượng trợ cấp y tế</label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ghi chú tình trạng sức khỏe</label>
                <textarea 
                  rows={3} 
                  value={formData.health_status_note || ''} 
                  onChange={e => setFormData({ ...formData, health_status_note: e.target.value })}
                  placeholder="Ghi chú khám chữa bệnh định kỳ, cấp phát thuốc tại Trạm y tế..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowHealthModal(false)} className="btn btn-outline" style={{ padding: '10px 20px', borderRadius: '8px' }}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '8px', background: '#10b981', border: 'none', color: 'white', fontWeight: 700 }}>
                  Lưu Hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: THÊM / SỬA LỊCH TIÊM CHỦNG */}
      {showVaccineModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '550px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>
                💉 {editingVaccine ? 'Chỉnh sửa Lịch Tiêm chủng' : 'Thêm Đợt Tiêm chủng mở rộng'}
              </h3>
              <button onClick={() => setShowVaccineModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveVaccine} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Tên chiến dịch tiêm chủng *</label>
                <input 
                  type="text" required
                  placeholder="Ví dụ: Tiêm vắc xin Sởi - Rubella Quý 3/2026"
                  value={vacForm.campaign_name || ''}
                  onChange={e => setVacForm({ ...vacForm, campaign_name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Loại Vắc xin *</label>
                  <input 
                    type="text" required
                    placeholder="5 trong 1, OPV, Cúm..."
                    value={vacForm.vaccine_type || ''}
                    onChange={e => setVacForm({ ...vacForm, vaccine_type: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Đối tượng tiêm</label>
                  <input 
                    type="text"
                    placeholder="Trẻ từ 2-36 tháng..."
                    value={vacForm.target_audience || ''}
                    onChange={e => setVacForm({ ...vacForm, target_audience: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ngày bắt đầu</label>
                  <input 
                    type="date"
                    value={vacForm.start_date || ''}
                    onChange={e => setVacForm({ ...vacForm, start_date: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Địa điểm tiêm</label>
                  <input 
                    type="text"
                    value={vacForm.location || ''}
                    onChange={e => setVacForm({ ...vacForm, location: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Trạng thái</label>
                <select 
                  value={vacForm.status || 'upcoming'}
                  onChange={e => setVacForm({ ...vacForm, status: e.target.value as any })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="upcoming">Sắp diễn ra</option>
                  <option value="ongoing">Đang diễn ra</option>
                  <option value="completed">Đã hoàn thành</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ghi chú / Dặn dò phụ huynh</label>
                <textarea 
                  rows={2}
                  value={vacForm.notes || ''}
                  onChange={e => setVacForm({ ...vacForm, notes: e.target.value })}
                  placeholder="Mang theo sổ tiêm cá nhân của trẻ..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowVaccineModal(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', background: '#8b5cf6', border: 'none', color: 'white', fontWeight: 700 }}>
                  Lưu Lịch Tiêm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BÁO CÁO / SỬA CẢNH BÁO DỊCH BỆNH */}
      {showEpidemicModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '550px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#ef4444' }}>
                🚨 {editingEpidemic ? 'Chỉnh sửa Cảnh báo Dịch bệnh' : 'Khai báo Cảnh báo Dịch bệnh TDP'}
              </h3>
              <button onClick={() => setShowEpidemicModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEpidemic} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Tên loại bệnh / Dịch *</label>
                <input 
                  type="text" required
                  placeholder="Ví dụ: Sốt xuất huyết Dengue, Tay chân miệng..."
                  value={epiForm.disease_name || ''}
                  onChange={e => setEpiForm({ ...epiForm, disease_name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Khu vực / Ngõ xuất hiện *</label>
                  <input 
                    type="text" required
                    placeholder="Ngõ 47, Cụm 2..."
                    value={epiForm.area || ''}
                    onChange={e => setEpiForm({ ...epiForm, area: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Mức độ rủi ro</label>
                  <select 
                    value={epiForm.risk_level || 'medium'}
                    onChange={e => setEpiForm({ ...epiForm, risk_level: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="danger">Nguy hiểm</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Biện pháp Y tế đã xử lý</label>
                <textarea 
                  rows={2}
                  value={epiForm.actions_taken || ''}
                  onChange={e => setEpiForm({ ...epiForm, actions_taken: e.target.value })}
                  placeholder="Đã dọn vệ sinh, phun hóa chất diệt muỗi..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowEpidemicModal(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 700 }}>Lưu Cảnh Báo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: THÊM / SỬA HỒ SƠ THAI SẢN / DÂN SỐ */}
      {showFertilityModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '550px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#ec4899' }}>
                👶 {editingFertility ? 'Chỉnh sửa Hồ sơ Thai sản / Sinh' : 'Thêm Hồ sơ Thai sản & Dân số'}
              </h3>
              <button onClick={() => setShowFertilityModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveFertility} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Tên Mẹ / Phụ nữ mang thai *</label>
                <input 
                  type="text" required
                  placeholder="Ví dụ: Nguyễn Thị Hoa"
                  value={fertForm.mother_name || ''}
                  onChange={e => setFertForm({ ...fertForm, mother_name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Trạng thái *</label>
                  <select 
                    value={fertForm.status || 'pregnant'}
                    onChange={e => setFertForm({ ...fertForm, status: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="pregnant">🤰 Đang mang thai</option>
                    <option value="given_birth">👶 Đã sinh con</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
                    {fertForm.status === 'pregnant' ? 'Ngày dự sinh' : 'Ngày sinh của bé'}
                  </label>
                  <input 
                    type="date"
                    value={fertForm.status === 'pregnant' ? (fertForm.expected_due_date || '') : (fertForm.birth_date || '')}
                    onChange={e => {
                      if (fertForm.status === 'pregnant') setFertForm({ ...fertForm, expected_due_date: e.target.value });
                      else setFertForm({ ...fertForm, birth_date: e.target.value });
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
              {fertForm.status === 'given_birth' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Tên của bé</label>
                    <input 
                      type="text"
                      placeholder="Lê Minh An..."
                      value={fertForm.child_name || ''}
                      onChange={e => setFertForm({ ...fertForm, child_name: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Giới tính bé</label>
                    <select 
                      value={fertForm.child_gender || 'male'}
                      onChange={e => setFertForm({ ...fertForm, child_gender: e.target.value as any })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="male">Bé trai</option>
                      <option value="female">Bé gái</option>
                    </select>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" id="is_third_child_cb"
                  checked={fertForm.is_third_child_plus ?? false}
                  onChange={e => setFertForm({ ...fertForm, is_third_child_plus: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_third_child_cb" style={{ fontWeight: 700, cursor: 'pointer', color: '#ef4444' }}>Là trường hợp sinh con thứ 3 trở lên</label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowFertilityModal(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', background: '#ec4899', border: 'none', color: 'white', fontWeight: 700 }}>Lưu Hồ Sơ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: THÊM / SỬA HOTLINE Y TẾ KHẨN CẤP */}
      {showEmergencyModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '550px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#ef4444' }}>
                📞 {editingEmergency ? 'Chỉnh sửa Hotline Y tế' : 'Thêm Hotline Y tế Khẩn cấp'}
              </h3>
              <button onClick={() => setShowEmergencyModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEmergency} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Tên Cơ sở / Cán bộ Y tế *</label>
                <input 
                  type="text" required
                  placeholder="Ví dụ: Trạm Y tế Phường Nam Sầm Sơn, BS. Nguyễn Văn A..."
                  value={emgForm.name || ''}
                  onChange={e => setEmgForm({ ...emgForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Chức danh / Vai trò</label>
                  <input 
                    type="text"
                    placeholder="Bác sĩ tuyến Phường, Cấp cứu 115..."
                    value={emgForm.role || ''}
                    onChange={e => setEmgForm({ ...emgForm, role: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Số điện thoại Hotline *</label>
                  <input 
                    type="text" required
                    placeholder="0237 3835 115..."
                    value={emgForm.phone || ''}
                    onChange={e => setEmgForm({ ...emgForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Địa chỉ cơ sở</label>
                <input 
                  type="text"
                  placeholder="Đường Nam Sầm Sơn..."
                  value={emgForm.address || ''}
                  onChange={e => setEmgForm({ ...emgForm, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ghi chú / Giờ trực</label>
                <textarea 
                  rows={2}
                  value={emgForm.notes || ''}
                  onChange={e => setEmgForm({ ...emgForm, notes: e.target.value })}
                  placeholder="Trực 24/7 tiếp nhận cấp cứu sơ ban đầu..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowEmergencyModal(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 700 }}>Lưu Hotline</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default HealthCare;
