import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download,
  Calendar,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Printer,
  MapPin,
  Filter
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { FinancialRecord, Household, Resident, HouseholdFund } from '../types';
import ExcelJS from 'exceljs';

const Finance = () => {
  const currentYear = new Date().getFullYear();
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const userRole = localStorage.getItem('user_role') || '';
  const isWardUser = userRole === 'ward_admin' || userRole === 'super_admin';
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
                  (currentRole !== 'to_truong' && currentRole !== 'admin' && currentRole !== 'ke_toan') ||
                  isWardUser;
  const canPrintExport = currentRole !== 'demo' && localStorage.getItem('guest_mode') !== 'true';
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

  // Form states
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [recordedBy, setRecordedBy] = useState('Ban Quản lý');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Phân hệ Quản lý đóng quỹ mới bổ sung
  const [subTab, setSubTab] = useState<'ledger' | 'funds'>('ledger');
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [householdFunds, setHouseholdFunds] = useState<HouseholdFund[]>([]);
  const [fundYear, setFundYear] = useState<number>(new Date().getFullYear());
  const [fundSearchTerm, setFundSearchTerm] = useState('');
  const [fundSearchInput, setFundSearchInput] = useState('');
  const [fundFilterStatus, setFundFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [fundGroupFilter, setFundGroupFilter] = useState<string>('all');
  const [tdpList, setTdpList] = useState<any[]>([]);
  const [tdpMap, setTdpMap] = useState<Record<string, string>>({});
  const [tdpFilter, setTdpFilter] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('tdp_groups_config');
    return saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  });

  // Debounce fundSearchInput -> fundSearchTerm
  useEffect(() => {
    const t = setTimeout(() => setFundSearchTerm(fundSearchInput), 300);
    return () => clearTimeout(t);
  }, [fundSearchInput]);

  // Form đóng quỹ hộ dân
  const [editingFund, setEditingFund] = useState<{ householdId: string, fundName: string } | null>(null);
  const [fundAmountInput, setFundAmountInput] = useState<string>('');
  const [fundNoteInput, setFundNoteInput] = useState<string>('');
  const [fundDateInput, setFundDateInput] = useState<string>(new Date().toISOString().slice(0, 10));

  const [fundNames, setFundNames] = useState<string[]>([]);

  useEffect(() => {
    const loadFunds = () => {
      const list = db.getFundList();
      setFundNames(list.map(f => f.name));
    };
    loadFunds();
    window.addEventListener('fund-targets-changed', loadFunds);
    return () => {
      window.removeEventListener('fund-targets-changed', loadFunds);
    };
  }, []);

  const getHouseholdHeadName = (hh: Household) => {
    const head = residents.find(r => r.id === hh.head_of_household_id);
    return head ? head.full_name : 'Hộ số: ' + hh.household_number;
  };

  const handleOpenFundPay = (hhId: string, fundName: string) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu thu quỹ!', 'warning');
      return;
    }
    const existing = householdFunds.find(f => f.household_id === hhId && f.fund_name === fundName && f.year === fundYear);
    setEditingFund({ householdId: hhId, fundName });
    setFundAmountInput(existing ? formatInputNumber(existing.amount.toString()) : '');
    setFundNoteInput(existing ? existing.note || '' : '');
    setFundDateInput(existing ? existing.paid_at || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFund) return;
    const parsedAmount = parseInt(fundAmountInput.replace(/\./g, ''));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showToast('Số tiền không hợp lệ!', 'warning');
      return;
    }

    try {
      const existing = householdFunds.find(f => f.household_id === editingFund.householdId && f.fund_name === editingFund.fundName && f.year === fundYear);
      const targetId = existing ? existing.id : generateUUID();
      const payload: HouseholdFund = {
        id: targetId,
        household_id: editingFund.householdId,
        year: fundYear,
        fund_name: editingFund.fundName,
        amount: parsedAmount,
        paid_at: fundDateInput,
        note: fundNoteInput
      };

      await db.saveHouseholdFund(payload);
      showToast('Ghi nhận đóng quỹ thành công!', 'success');
      setEditingFund(null);
      
      // Đồng bộ sang sổ quỹ chung tự động để thay đổi trực quan số dư
      const hh = households.find(h => h.id === editingFund.householdId);
      const headName = hh ? getHouseholdHeadName(hh) : '';
      const flagText = `[QUY_${targetId}]`;
      const matchedGeneral = records.find(r => r.description.includes(flagText));

      if (parsedAmount > 0) {
        const generalRecord: FinancialRecord = {
          id: matchedGeneral ? matchedGeneral.id : generateUUID(),
          group_id: db.getGroupId(),
          type: 'income',
          amount: parsedAmount,
          category: editingFund.fundName,
          description: `Thu ${editingFund.fundName} - Hộ ${headName} ${flagText}`,
          recorded_by: 'Hệ thống tự động',
          date: fundDateInput,
          created_at: matchedGeneral ? matchedGeneral.created_at : new Date().toISOString()
        };
        await db.saveFinancialRecord(generalRecord);
      } else {
        // Nếu số tiền bằng 0 và đã có bản ghi trong sổ quỹ chung trước đó -> Tiến hành xóa
        if (matchedGeneral) {
          await db.deleteFinancialRecord(matchedGeneral.id);
        }
        await db.deleteHouseholdFund(targetId);
      }

      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (err) {
      showToast('Không thể ghi nhận đóng quỹ!', 'danger');
    }
  };

  const loadData = async () => {
    try {
      const [list, hList, rList, fList] = await Promise.all([
        db.getFinancialRecords(),
        db.getHouseholds(),
        db.getResidents(),
        db.getHouseholdFunds()
      ]);
      setRecords(list);
      setHouseholds(hList);
      setResidents(rList);
      setHouseholdFunds(fList);

      const wardId = localStorage.getItem('user_ward_id');
      if (wardId) {
        const list = await db.getTDPList(wardId);
        const map: Record<string, string> = {};
        list.forEach(item => {
          map[item.id] = item.tdp_name || item.full_name || 'Tổ dân phố';
        });
        setTdpMap(map);
        setTdpList(list);
      }
    } catch (e) {
      showToast('Lỗi tải dữ liệu tài chính!', 'danger');
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => {
      window.removeEventListener('db-changed', loadData);
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setType('income');
    setAmount('');
    setCategory('');
    setDescription('');
    setRecordedBy('Ban Quản lý');
    setDate(new Date().toISOString().slice(0, 10));
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: FinancialRecord) => {
    setEditingRecord(record);
    setType(record.type);
    setAmount(formatInputNumber(record.amount.toString()));
    setCategory(record.category);
    setDescription(record.description);
    setRecordedBy(record.recorded_by);
    setDate(record.date);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phiếu thu/chi này khỏi hệ thống?')) {
      try {
        await db.deleteFinancialRecord(id);
        showToast('Xóa phiếu thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi xóa giao dịch!', 'danger');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount.replace(/\./g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'warning');
      return;
    }
    if (!category.trim() || !description.trim()) {
      showToast('Vui lòng nhập đầy đủ danh mục và nội dung!', 'warning');
      return;
    }

    const payload: FinancialRecord = {
      id: editingRecord ? editingRecord.id : generateUUID(),
      group_id: db.getGroupId(),
      type,
      amount: parsedAmount,
      category,
      description,
      recorded_by: recordedBy,
      date,
      created_at: editingRecord ? editingRecord.created_at : new Date().toISOString()
    };

    try {
      await db.saveFinancialRecord(payload);
      showToast(editingRecord ? 'Cập nhật phiếu thành công!' : 'Lập phiếu thu/chi thành công!', 'success');
      setIsFormOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi lưu giao dịch!', 'danger');
    }
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

  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }

    showToast('Đang khởi tạo file Excel...', 'info');

    const headers = ['Ngày lập', 'Loại phiếu', 'Nội dung', 'Danh mục', 'Người lập', 'Số tiền (VND)'];
    const rows = filteredRecords.map(r => [
      formatToDisplayDate(r.date),
      r.type === 'income' ? 'Thu' : 'Chi',
      cleanDescription(r.description),
      r.category,
      r.recorded_by,
      r.amount
    ]);

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sổ thu chi');

      // Tạo cấu trúc cột
      worksheet.columns = headers.map(h => ({ header: h, key: h }));

      // Thêm các dòng dữ liệu và thiết lập kiểu dáng
      rows.forEach((row, rowIndex) => {
        const addedRow = worksheet.addRow(row);
        const record = filteredRecords[rowIndex];

        addedRow.eachCell((cell, colIndex) => {
          cell.font = {
            name: 'Segoe UI',
            size: 11
          };

          // Định dạng số tiền (cột 6)
          if (colIndex === 6) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }

          // Căn giữa cột Ngày lập và Loại phiếu
          if (colIndex === 1 || colIndex === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Tô màu nền tùy loại phiếu thu / chi
          if (record.type === 'income') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE6F4EA' } // Xanh lá nhạt #E6F4EA
            };
            if (colIndex === 6 || colIndex === 2) {
              cell.font = {
                bold: true,
                color: { argb: 'FF137333' }, // Xanh lá đậm #137333
                name: 'Segoe UI',
                size: 11
              };
            }
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFCE8E6' } // Đỏ nhạt #FCE8E6
            };
            if (colIndex === 6 || colIndex === 2) {
              cell.font = {
                bold: true,
                color: { argb: 'FFC5221F' }, // Đỏ đậm #C5221F
                name: 'Segoe UI',
                size: 11
              };
            }
          }
        });
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
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Tính toán tổng số liệu của danh sách đang xuất
      const totalIncome = filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
      const balance = totalIncome - totalExpense;

      // Thêm dòng trống làm khoảng giãn cách
      worksheet.addRow([]);

      // Thêm dòng Tổng Thu
      const rowIncome = worksheet.addRow(['', '', '', '', 'Tổng Thu (VND):', totalIncome]);
      rowIncome.eachCell((cell, colIndex) => {
        if (colIndex >= 5) {
          cell.font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF137333' } };
          if (colIndex === 6) {
            cell.numFmt = '#,##0';
          }
        }
      });

      // Thêm dòng Tổng Chi
      const rowExpense = worksheet.addRow(['', '', '', '', 'Tổng Chi (VND):', totalExpense]);
      rowExpense.eachCell((cell, colIndex) => {
        if (colIndex >= 5) {
          cell.font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FFC5221F' } };
          if (colIndex === 6) {
            cell.numFmt = '#,##0';
          }
        }
      });

      // Thêm dòng Còn Dư (Tồn Quỹ)
      const rowBalance = worksheet.addRow(['', '', '', '', 'Còn dư (Tồn quỹ):', balance]);
      rowBalance.eachCell((cell, colIndex) => {
        if (colIndex >= 5) {
          cell.font = { 
            bold: true, 
            name: 'Segoe UI', 
            size: 11, 
            color: { argb: balance >= 0 ? 'FF137333' : 'FFC5221F' } 
          };
          if (colIndex === 6) {
            cell.numFmt = '#,##0';
          }
          // Tô màu nền xám rất nhẹ làm nổi bật
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
      });

      // Áp dụng đường viền lưới cho toàn bộ các ô (tránh kẻ viền ô trống bên trái dòng tổng hợp)
      worksheet.eachRow((row) => {
        row.eachCell((cell, colIndex) => {
          const isSummaryRow = row.number > rows.length + 1;
          if (!isSummaryRow || colIndex >= 5) {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          }
        });
      });

      // Tự động căn rộng cột
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.values?.forEach(v => {
          let valStr = '';
          if (v !== null && v !== undefined) {
            if (typeof v === 'number') {
              valStr = new Intl.NumberFormat('vi-VN').format(v);
            } else {
              valStr = v.toString();
            }
          }
          const columnLength = valStr.length;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.max(maxLength + 4, 12);
      });

      // Ghi workbook ra file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filenameTdp = (localStorage.getItem('tdp_name') || 'nam_sam_son').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `so_thu_chi_${filenameTdp}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Xuất báo cáo Sổ thu chi thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel!', 'danger');
    }
  };

  const handleExportFundsExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Thu Quỹ ${fundYear}`);
      
      const tdpNameStored = localStorage.getItem('tdp_name') || 'Tiến Quảng Giao';
      const wardNameStored = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
      
      // 1. Tiêu đề Tổ dân phố
      const titleRow1 = worksheet.addRow([`TỔ DÂN PHỐ ${tdpNameStored.toUpperCase()} - ${wardNameStored.toUpperCase()}`]);
      titleRow1.getCell(1).font = { bold: true, name: 'Segoe UI', size: 11, color: { argb: 'FF475569' } };
      
      // 2. Tiêu đề chính
      const titleRow2 = worksheet.addRow([`BÁO CÁO THU NỘP CÁC LOẠI QUỸ NĂM ${fundYear}`]);
      titleRow2.getCell(1).font = { bold: true, name: 'Segoe UI', size: 16, color: { argb: 'FF15803D' } };
      worksheet.addRow([]); // Dòng trống
      
      // 3. Headers
      const headers = ['STT', 'Hộ gia đình / Chủ hộ', 'Địa chỉ', 'Tổng đã nộp', ...fundNames];
      const headerRow = worksheet.addRow(headers);
      
      // Định dạng dòng header
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF15803D' } // Màu xanh lá của Excel
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      
      // 4. Data Rows
      filteredHouseholdsForFunds.forEach((hh, index) => {
        const headName = getHouseholdHeadName(hh);
        const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
        const totalPaid = hhFundsList.reduce((sum, f) => sum + f.amount, 0);
        
        const rowData = [
          index + 1,
          headName,
          hh.address,
          totalPaid
        ];
        
        fundNames.forEach(fundName => {
          const paid = hhFundsList.find(f => f.fund_name === fundName);
          rowData.push(paid ? paid.amount : 0);
        });
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;
        
        // Căn chỉnh các ô dữ liệu
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // STT
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; // Hộ gia đình
        dataRow.getCell(2).font = { bold: true };
        dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }; // Địa chỉ
        dataRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }; // Tổng đã nộp
        dataRow.getCell(4).font = { bold: true, color: { argb: totalPaid > 0 ? 'FF15803D' : 'FF94A3B8' } };
        dataRow.getCell(4).numFmt = '#,##0';
        
        // Căn chỉnh số tiền cho các loại quỹ
        for (let i = 5; i <= headers.length; i++) {
          const cell = dataRow.getCell(i);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          const val = cell.value as number;
          cell.numFmt = '#,##0';
          if (val > 0) {
            cell.font = { color: { argb: 'FF15803D' }, name: 'Segoe UI' };
          } else {
            cell.font = { color: { argb: 'FF94A3B8' }, name: 'Segoe UI' };
          }
        }
      });
      
      // 5. Dòng tổng cộng ở cuối
      const totalRowData = ['Tổng cộng', '', '', 0];
      // Điền số 0 cho từng quỹ
      fundNames.forEach(() => totalRowData.push(0));
      
      const totalRow = worksheet.addRow(totalRowData);
      totalRow.height = 24;
      worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      totalRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10 };
      
      // Tính toán tổng cộng cho từng cột
      let grandTotal = 0;
      filteredHouseholdsForFunds.forEach(hh => {
        const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
        grandTotal += hhFundsList.reduce((sum, f) => sum + f.amount, 0);
      });
      totalRow.getCell(4).value = grandTotal;
      totalRow.getCell(4).font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
      totalRow.getCell(4).numFmt = '#,##0';
      totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      
      fundNames.forEach((fundName, idx) => {
        let colSum = 0;
        filteredHouseholdsForFunds.forEach(hh => {
          const paid = householdFunds.find(f => f.household_id === hh.id && f.fund_name === fundName && f.year === fundYear);
          if (paid) colSum += paid.amount;
        });
        const cellIndex = 5 + idx;
        totalRow.getCell(cellIndex).value = colSum;
        totalRow.getCell(cellIndex).font = { bold: true, name: 'Segoe UI' };
        totalRow.getCell(cellIndex).numFmt = '#,##0';
        totalRow.getCell(cellIndex).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      
      // Tô viền lưới cho toàn bộ bảng
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (row.number >= 4) { // Bắt đầu từ dòng header
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          }
        });
      });
      
      // Tự động căn rộng cột
      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx === 0) { // STT
          column.width = 6;
        } else if (colIdx === 1) { // Hộ gia đình
          column.width = 25;
        } else if (colIdx === 2) { // Địa chỉ
          column.width = 30;
        } else { // Các cột tiền
          column.width = 16;
        }
      });
      
      // Ghi workbook ra file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filenameTdp = (localStorage.getItem('tdp_name') || 'nam_sam_son').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `thu_quy_ho_dan_${filenameTdp}_${fundYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Xuất báo cáo thu quỹ hộ dân thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất file Excel thu quỹ!', 'danger');
    }
  };

  const handlePrintFundsList = () => {
    if (filteredHouseholdsForFunds.length === 0) {
      showToast('Không có dữ liệu để in!', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Trình duyệt đang chặn popup. Vui lòng cho phép popup để in!', 'warning');
      return;
    }
    const tdpNameVal = isWardUser 
      ? (tdpFilter !== 'all' ? (tdpMap[tdpFilter] || 'Tổ dân phố') : 'Tất cả TDP')
      : (localStorage.getItem('tdp_name') || 'Tổ dân phố');
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const groupLabel = isWardUser
      ? (tdpFilter !== 'all' ? ` – ${tdpMap[tdpFilter] || 'TDP'}` : '')
      : (fundGroupFilter !== 'all' ? ` – ${fundGroupFilter}` : '');
    const today = new Date().toLocaleDateString('vi-VN');
    
    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const fundHeadersHtml = fundNames.map(name => `<th>${name}</th>`).join('');
    
    const rowsHtml = filteredHouseholdsForFunds.map((hh, idx) => {
      const headName = getHouseholdHeadName(hh);
      const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
      
      const fundCellsHtml = fundNames.map(fundName => {
        const paidFund = hhFunds.find(f => f.fund_name === fundName);
        const amountPaid = paidFund ? paidFund.amount : 0;
        return `<td style="text-align: right;">${amountPaid > 0 ? formatCurrency(amountPaid) : '—'}</td>`;
      }).join('');

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold;">${headName}</td>
          <td>${hh.address}</td>
          <td style="text-align: right; font-weight: bold;">${totalPaid > 0 ? formatCurrency(totalPaid) : '—'}</td>
          ${fundCellsHtml}
        </tr>
      `;
    }).join('');

    let grandTotal = 0;
    filteredHouseholdsForFunds.forEach(hh => {
      const hhFundsList = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
      grandTotal += hhFundsList.reduce((sum, f) => sum + f.amount, 0);
    });

    const fundTotalsCellsHtml = fundNames.map(fundName => {
      let colSum = 0;
      filteredHouseholdsForFunds.forEach(hh => {
        const paid = householdFunds.find(f => f.household_id === hh.id && f.fund_name === fundName && f.year === fundYear);
        if (paid) colSum += paid.amount;
      });
      return `<td style="text-align: right; font-weight: bold;">${colSum > 0 ? formatCurrency(colSum) : '—'}</td>`;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Báo cáo thu nộp quỹ ${fundYear} – ${tdpNameVal}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin-top: 15mm;
              margin-bottom: 15mm;
              margin-left: 20mm;
              margin-right: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13pt;
            line-height: 1.3;
            color: #000;
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
            font-size: 12pt;
            text-transform: uppercase;
          }
          .motto {
            text-align: center;
            font-size: 12pt;
          }
          .motto-main {
            font-weight: bold;
            text-transform: uppercase;
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
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .doc-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .doc-subtitle {
            font-style: italic;
            font-size: 12pt;
            margin: 0;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 25px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 11pt;
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
            font-size: 12pt;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
            margin-bottom: 70px;
          }
          .signature-name {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 45%;">
              <div class="org-title">
                UBND ${wardNameVal.toUpperCase()}<br/>
                TỔ DÂN PHỐ ${tdpNameVal.toUpperCase()}
                <div class="line-separator"></div>
              </div>
            </td>
            <td style="width: 10%;">&nbsp;</td>
            <td style="width: 45%;">
              <div class="motto">
                <div class="motto-main">CỘNG HÒA XÃ HỘI CHỦ NGIĨA VIỆT NAM</div>
                <div style="font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
                <div class="line-separator-long"></div>
              </div>
            </td>
          </tr>
        </table>

        <div class="doc-title-container">
          <h1 class="doc-title">BÁO CÁO THU NỘP CÁC LOẠI QUỸ NĂM ${fundYear}</h1>
          <p class="doc-subtitle">${tdpNameVal}${groupLabel} &nbsp;|&nbsp; Ngày in: ${today} &nbsp;|&nbsp; Tổng cộng đã thu: <strong>${formatCurrency(grandTotal)} đ</strong></p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">STT</th>
              <th style="width: 200px;">Hộ gia đình / Chủ hộ</th>
              <th>Địa chỉ</th>
              <th style="width: 110px;">Tổng đã nộp</th>
              ${fundHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f9fafb;">
              <td colspan="3" style="text-align: center;">TỔNG CỘNG</td>
              <td style="text-align: right;">${formatCurrency(grandTotal)}</td>
              ${fundTotalsCellsHtml}
            </tr>
          </tbody>
        </table>

        <table class="signature-section">
          <tr>
            <td>
              <div class="signature-title">NGƯỜI LẬP PHIẾU</div>
              <div style="font-style: italic; font-size: 11pt; color: #555; margin-top: -65px; margin-bottom: 50px;">(Ký, ghi rõ họ tên)</div>
              <div class="signature-name" style="margin-top: 80px;">Ban Quản lý Quỹ</div>
            </td>
            <td>
              <div class="signature-title">TỔ TRƯỞNG TỔ DÂN PHỐ</div>
              <div style="font-style: italic; font-size: 11pt; color: #555; margin-top: -65px; margin-bottom: 50px;">(Ký, đóng dấu, ghi rõ họ tên)</div>
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px auto;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 80px; max-height: 80px; max-width: 180px; object-fit: contain;" />` : ''}
              </div>
              <div class="signature-name">${leaderName}</div>
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

  const handlePrintHouseholdReceipt = (hh: Household) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép popup trình duyệt!', 'danger');
      return;
    }

    const headName = getHouseholdHeadName(hh);
    const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
    const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);

    const tdpNameVal = tdpMap[hh.user_id || ''] || localStorage.getItem('tdp_name') || 'Tổ dân phố';
    const wardNameVal = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const today = new Date();
    const dateText = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    let leaderName = localStorage.getItem('leader_name') || 'Kim Tuyến';
    let leaderSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const toTruong = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'to_truong');
      if (toTruong?.name?.trim()) leaderName = toTruong.name.trim();
      if (toTruong?.signatureUrl?.trim()) leaderSigUrl = toTruong.signatureUrl.trim();
    } catch { /* ignore */ }

    const paidFundsRowsHtml = hhFunds.map((f, idx) => {
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold;">Đóng góp ${f.fund_name} (${f.year})</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(f.amount)} đ</td>
          <td>${f.note || '—'}</td>
        </tr>
      `;
    }).join('');

    const docSoTien = (number: number): string => {
      if (number === 0) return 'Không đồng';
      const arrays = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
      
      const readTriple = (n: number, showZero: boolean): string => {
        let tram = Math.floor(n / 100);
        let chuc = Math.floor((n % 100) / 10);
        let donvi = n % 10;
        let res = "";
        
        if (tram > 0 || showZero) {
          res += arrays[tram] + " trăm ";
        }
        
        if (chuc === 0 && donvi > 0) {
          res += "lẻ ";
        } else if (chuc === 1) {
          res += "mười ";
        } else if (chuc > 1) {
          res += arrays[chuc] + " mươi ";
        }
        
        if (donvi === 1 && chuc > 1) {
          res += "mốt";
        } else if (donvi === 5 && chuc > 0) {
          res += "lăm";
        } else if (donvi > 0) {
          res += arrays[donvi];
        }
        return res.trim();
      };

      let str = "";
      let units = ["", " nghìn", " triệu", " tỷ"];
      let temp = number;
      let i = 0;
      
      while (temp > 0) {
        let triple = temp % 1000;
        if (triple > 0) {
          let s = readTriple(triple, i > 0);
          str = s + units[i] + " " + str;
        }
        temp = Math.floor(temp / 1000);
        i++;
      }
      const finalStr = str.trim();
      return finalStr.charAt(0).toUpperCase() + finalStr.slice(1) + " đồng chẵn";
    };

    const textAmountWords = docSoTien(totalPaid);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Biên lai thu tiền - ${headName}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page {
              size: A5 landscape;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .org-title {
            text-align: center;
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
          }
          .motto {
            text-align: center;
            font-size: 10pt;
          }
          .motto-main {
            font-weight: bold;
            text-transform: uppercase;
          }
          .line-separator {
            width: 60px;
            height: 1px;
            background-color: #000;
            margin: 2px auto 0 auto;
          }
          .line-separator-long {
            width: 120px;
            height: 1px;
            background-color: #000;
            margin: 2px auto 0 auto;
          }
          .title-container {
            text-align: center;
            margin-top: 10px;
            margin-bottom: 15px;
          }
          .title {
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 3px 0;
          }
          .subtitle {
            font-style: italic;
            font-size: 10pt;
            margin: 0;
          }
          .info-table {
            width: 100%;
            margin-bottom: 10px;
            border-collapse: collapse;
          }
          .info-table td {
            padding: 3px 0;
            font-size: 11pt;
          }
          .info-label {
            font-weight: bold;
            width: 140px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 5px 8px;
            font-size: 10pt;
            vertical-align: middle;
          }
          .data-table th {
            font-weight: bold;
            text-align: center;
            background-color: #f5f5f5;
          }
          .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            page-break-inside: avoid;
          }
          .signatures-table td {
            border: none;
            text-align: center;
            width: 33%;
            font-size: 10pt;
            vertical-align: top;
          }
          .sig-title {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 45%;">
              <div class="org-title">
                UBND ${wardNameVal.toUpperCase()}<br/>
                TỔ DÂN PHỐ ${tdpNameVal.toUpperCase()}
                <div class="line-separator"></div>
              </div>
            </td>
            <td style="width: 10%;">&nbsp;</td>
            <td style="width: 45%;">
              <div class="motto">
                <div class="motto-main">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style="font-weight: bold; font-size: 9pt;">Độc lập - Tự do - Hạnh phúc</div>
                <div class="line-separator-long"></div>
              </div>
            </td>
          </tr>
        </table>

        <div class="title-container">
          <h1 class="title">BIÊN LAI THU TIỀN ĐÓNG GÓP</h1>
          <p class="subtitle">(Dành cho Hộ gia đình năm ${fundYear})</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Số sổ hộ khẩu:</td>
            <td>${hh.household_number}</td>
            <td class="info-label" style="width: 110px; text-align: right; padding-right: 15px;">Địa chỉ:</td>
            <td>${hh.address}</td>
          </tr>
          <tr>
            <td class="info-label">Chủ hộ gia đình:</td>
            <td colspan="3"><strong>${headName}</strong></td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">STT</th>
              <th>Nội dung đóng góp</th>
              <th style="width: 150px;">Số tiền đã đóng</th>
              <th style="width: 180px;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${paidFundsRowsHtml.length > 0 ? paidFundsRowsHtml : '<tr><td colspan="4" style="text-align: center;">Chưa ghi nhận đóng góp khoản quỹ nào trong năm nay.</td></tr>'}
            <tr style="font-weight: bold; background-color: #fafafa;">
              <td colspan="2" style="text-align: center;">TỔNG CỘNG</td>
              <td style="text-align: right; font-weight: bold; font-size: 11pt; color: #15803d;">${formatCurrency(totalPaid)} đ</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 10.5pt; font-style: italic; margin-top: 5px;">
          Số tiền bằng chữ: <strong>${textAmountWords}</strong>
        </div>

        <table class="signatures-table">
          <tr>
            <td colspan="2"></td>
            <td style="font-style: italic; font-size: 9.5pt; text-align: center;">
              ${wardNameVal.replace(/Phường\s+/gi, '') || 'Quảng Giao'}, ${dateText}
            </td>
          </tr>
          <tr>
            <td>
              <div class="sig-title">NGƯỜI NỘP TIỀN</div>
              <div style="font-style: italic; font-size: 9pt; color: #555;">(Ký, ghi rõ họ tên)</div>
            </td>
            <td>
              <div class="sig-title">NGƯỜI THU TIỀN</div>
              <div style="font-style: italic; font-size: 9pt; color: #555;">(Ký, ghi rõ họ tên)</div>
              <div style="margin-top: 50px; font-weight: bold;">Ban Quản lý Quỹ</div>
            </td>
            <td>
              <div class="sig-title">TỔ TRƯỞNG DÂN PHỐ</div>
              <div style="font-style: italic; font-size: 9pt; color: #555;">(Ký, đóng dấu, ghi rõ họ tên)</div>
              <div style="height: 50px; display: flex; align-items: center; justify-content: center; margin: 2px auto;">
                ${leaderSigUrl ? `<img src="${leaderSigUrl}" alt="Chữ ký" style="height: 50px; max-height: 55px; max-width: 140px; object-fit: contain;" />` : ''}
              </div>
              <div style="font-weight: bold; margin-top: 2px;">${leaderName}</div>
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

  // Calculations
  const totalIncome = records
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const balance = totalIncome - totalExpense;

  const filteredRecords = useMemo(() => records.filter(r => {
    // Ẩn các bản ghi tự động đồng bộ từ việc đóng quỹ của các hộ dân
    if (r.description.includes('[QUY_') || r.recorded_by === 'Hệ thống tự động') {
      return false;
    }
    const matchesType = activeType === 'all' || r.type === activeType;
    const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.recorded_by.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  }), [records, activeType, searchTerm]);

  const formatCurrency = (amt: number) => {
    if (amt === undefined || amt === null || isNaN(amt)) return '0';
    return new Intl.NumberFormat('vi-VN').format(amt);
  };

  const cleanDescription = (desc: string) => {
    if (!desc) return '';
    return desc.replace(/\[QUY_[^\]]+\]/g, '').trim();
  };

  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(clean));
  };

  const filteredHouseholdsForFunds = useMemo(() => households.filter(hh => {
    const headName = getHouseholdHeadName(hh).toLowerCase();
    const address = (hh.address || '').toLowerCase();
    const householdNumber = (hh.household_number || '').toLowerCase();
    const search = fundSearchTerm.toLowerCase();
    const matchesSearch = headName.includes(search) || address.includes(search) || householdNumber.includes(search);
    
    if (!matchesSearch) return false;
    
    const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
    const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
    
    if (fundFilterStatus === 'paid') {
      if (totalPaid === 0) return false;
    } else if (fundFilterStatus === 'unpaid') {
      if (totalPaid > 0) return false;
    }

    // Lọc theo phân quyền Tổ (cấp TDP) hoặc TDP (cấp phường)
    const matchesTdp = !isWardUser || tdpFilter === 'all' || hh.user_id === tdpFilter;
    const matchesGroup = isWardUser || fundGroupFilter === 'all' || hh.self_management_group === fundGroupFilter;
    
    return matchesTdp && matchesGroup;
  }), [households, householdFunds, fundSearchTerm, fundYear, fundFilterStatus, fundGroupFilter, tdpFilter, isWardUser]);

  return (
    <div className="finance-container">
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Thu chi cộng đồng</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', flex: 1, minWidth: '280px' }}>
            Quản lý và công khai minh bạch tài chính của Tổ dân phố.
          </p>
          {subTab === 'ledger' && (
            <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {canPrintExport && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleExportExcel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    color: '#0f766e',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    height: 'auto',
                    minHeight: '36px',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#ccfbf1';
                    e.currentTarget.style.borderColor = '#99f6e4';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdfa';
                    e.currentTarget.style.borderColor = '#ccfbf1';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Download size={16} /> Sổ thu chi
                </button>
              )}
              {!isGuest && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleOpenAdd}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    height: 'auto',
                    minHeight: '36px',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(37, 99, 235, 0.35)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.25)';
                  }}
                >
                  <Plus size={16} /> Lập phiếu mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Điều hướng tab cấp 2 */}
      <div className="finance-tabs-nav" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border)', marginBottom: '24px' }}>
        <button 
          className={`finance-tab-btn ${subTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setSubTab('ledger')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: subTab === 'ledger' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: subTab === 'ledger' ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Sổ quỹ thu chi
        </button>
        <button 
          className={`finance-tab-btn ${subTab === 'funds' ? 'active' : ''}`}
          onClick={() => setSubTab('funds')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: subTab === 'funds' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: subTab === 'funds' ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          Quản lý thu Quỹ theo Hộ dân
        </button>
      </div>

      {subTab === 'ledger' ? (
        <>
          <div className="finance-stats">
            <div className="finance-stat-card total">
              <div className="stat-icon"><DollarSign size={24} /></div>
              <div className="stat-details">
                 <span className="label">Số dư quỹ hiện tại</span>
                 <h2 className="value">{formatCurrency(balance)}</h2>
              </div>
            </div>
            <div className="finance-stat-card income">
              <div className="stat-icon"><TrendingUp size={24} /></div>
              <div className="stat-details">
                 <span className="label">Tổng thu tích lũy</span>
                 <h2 className="value text-success">{formatCurrency(totalIncome)}</h2>
              </div>
            </div>
            <div className="finance-stat-card expense">
              <div className="stat-icon"><TrendingDown size={24} /></div>
              <div className="stat-details">
                 <span className="label">Tổng chi tích lũy</span>
                 <h2 className="value text-danger">{formatCurrency(totalExpense)}</h2>
              </div>
            </div>
          </div>

          <div className="content-filters">
            <div className="filter-tabs">
              <button className={`tab ${activeType === 'all' ? 'active' : ''}`} onClick={() => setActiveType('all')}>Tất cả</button>
              <button className={`tab ${activeType === 'income' ? 'active' : ''}`} onClick={() => setActiveType('income')}>Khoản thu</button>
              <button className={`tab ${activeType === 'expense' ? 'active' : ''}`} onClick={() => setActiveType('expense')}>Khoản chi</button>
            </div>
            <div className="search-and-date">
                <div className="search-mini">
                  <Search size={16} />
                  <input 
                    type="text" 
                    placeholder="Tìm nội dung, danh mục..." 
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <button className="date-filter"><Calendar size={16} /> Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</button>
            </div>
          </div>

          <div className="finance-table-wrapper">
             <table className="data-table">
                <thead>
                   <tr>
                      <th>Ngày lập</th>
                      <th>Nội dung</th>
                      <th>Danh mục</th>
                      <th>Người lập</th>
                      <th style={{textAlign: 'right'}}>Số tiền</th>
                      {!isGuest && <th style={{textAlign: 'right', paddingRight: '20px'}}>Hành động</th>}
                   </tr>
                </thead>
                <tbody>
                   {filteredRecords.map(t => (
                      <tr key={t.id}>
                         <td className="date-cell">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                         <td className="title-cell">
                            <div className={`type-indicator ${t.type}`}></div>
                            {cleanDescription(t.description)}
                         </td>
                         <td><span className="category-tag">{t.category}</span></td>
                         <td>{t.recorded_by}</td>
                         <td className={`amount-cell ${t.type === 'income' ? 'success' : 'danger'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                         </td>
                         {!isGuest && (
                           <td style={{textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '16px'}}>
                              <button 
                                className="icon-btn-action edit-btn" 
                                onClick={() => handleOpenEdit(t)}
                                title="Chỉnh sửa phiếu"
                                style={{marginRight: '6px'}}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                className="icon-btn-action delete-btn" 
                                onClick={() => handleDelete(t.id)}
                                title="Xóa phiếu"
                              >
                                <Trash2 size={13} />
                              </button>
                           </td>
                         )}
                      </tr>
                   ))}
                   {filteredRecords.length === 0 && (
                     <tr>
                       <td colSpan={6} style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)'}}>
                         Không tìm thấy giao dịch nào.
                       </td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>

          {/* New Voucher Modal */}
          {isFormOpen && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>{editingRecord ? 'Chỉnh sửa phiếu thu / chi' : 'Lập phiếu thu / chi mới'}</h2>
                  <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                  <div className="form-group">
                    <label>Loại phiếu *</label>
                    <select value={type} onChange={(e: any) => setType(e.target.value)}>
                      <option value="income">Phiếu Thu (Cộng tiền vào quỹ)</option>
                      <option value="expense">Phiếu Chi (Trừ tiền khỏi quỹ)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Số tiền (VND) *</label>
                    <input 
                      type="text" 
                      value={amount}
                      onChange={(e) => setAmount(formatInputNumber(e.target.value))}
                      placeholder="Ví dụ: 500.000"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Danh mục quỹ *</label>
                    <input 
                      type="text" 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Ví dụ: Phí vệ sinh, Quỹ vận động, Thiết bị"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nội dung chi tiết *</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ví dụ: Thu phí vệ sinh ngõ 45 quý 2"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Người lập phiếu</label>
                      <input 
                        type="text" 
                        value={recordedBy}
                        onChange={(e) => setRecordedBy(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Ngày ghi nhận</label>
                      <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>Hủy bỏ</button>
                    <button type="submit" className="btn btn-primary">Lưu phiếu</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="funds-matrix-view" style={{ animation: 'fadeIn 0.3s ease' }}>
          {/* Thống kê Quỹ nổi 3D */}
          {!isWardUser && (
            <div className="fund-stats-3d-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {fundNames.map((fundName, index) => {
                const totalCollectedForFund = filteredHouseholdsForFunds.reduce((sum, hh) => {
                  const paid = householdFunds.find(f => f.household_id === hh.id && f.fund_name === fundName && f.year === fundYear);
                  return sum + (paid ? paid.amount : 0);
                }, 0);

                const colors = [
                  { text: '#1e3a8a', border: '#dbeafe' }, // Blue
                  { text: '#166534', border: '#dcfce7' }, // Green
                  { text: '#78350f', border: '#fef3c7' }, // Yellow
                  { text: '#581c87', border: '#e9d5ff' }, // Purple
                  { text: '#831843', border: '#fbcfe8' }, // Pink
                  { text: '#742a2a', border: '#fed7d7' }  // Red
                ];
                const color = colors[index % colors.length];

                return (
                  <div 
                    key={fundName} 
                    className="fund-3d-card"
                    style={{
                      backgroundColor: 'white',
                      border: `1.5px solid ${color.border}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      boxShadow: `0 4px 0 ${color.border}, 0 8px 12px -4px rgba(0, 0, 0, 0.05)`,
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: '75px',
                      cursor: 'default',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(2px)';
                      e.currentTarget.style.boxShadow = `0 2px 0 ${color.border}, 0 4px 8px -3px rgba(0, 0, 0, 0.04)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 4px 0 ${color.border}, 0 8px 12px -4px rgba(0, 0, 0, 0.05)`;
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                      {fundName}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: color.text, lineHeight: '1.2' }}>
                      {formatCurrency(totalCollectedForFund)} <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#94a3b8' }}>đ</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {/* Hàng 1: Bộ lọc năm và trạng thái */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Năm đóng quỹ:</label>
                <select 
                  value={fundYear} 
                  onChange={(e) => setFundYear(parseInt(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none' }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Trạng thái:</label>
                <select 
                  value={fundFilterStatus} 
                  onChange={(e) => setFundFilterStatus(e.target.value as any)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none' }}
                >
                  <option value="all">Tất cả các hộ</option>
                  <option value="paid">Hộ đã nộp</option>
                  <option value="unpaid">Hộ chưa nộp</option>
                </select>
              </div>
              {/* Lọc Tổ / TDP tùy theo phân quyền */}
              {isWardUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Tổ dân phố:</label>
                  <select 
                    value={tdpFilter} 
                    onChange={(e) => setTdpFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none', minWidth: '150px' }}
                  >
                    <option value="all">Tất cả TDP</option>
                    {tdpList.map(t => (
                      <option key={t.id} value={t.id}>{t.tdp_name || t.full_name || 'Tổ dân phố'}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>Tổ tự quản:</label>
                  <select 
                    value={fundGroupFilter} 
                    onChange={(e) => setFundGroupFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontWeight: '600', outline: 'none', minWidth: '130px' }}
                  >
                    <option value="all">Tất cả Tổ</option>
                    {groups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Hàng 2: Tìm kiếm bên trái, Tổng thu & Xuất Excel bên phải */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ minWidth: '320px', flex: 1, position: 'relative' }}>
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo tên chủ hộ, địa chỉ..."
                  value={fundSearchInput}
                  onChange={(e) => setFundSearchInput(e.target.value)}
                  style={{ paddingRight: fundSearchInput ? '36px' : '12px' }}
                />
                {fundSearchInput && (
                  <button
                    type="button"
                    onClick={() => { setFundSearchInput(''); setFundSearchTerm(''); }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Tổng thu quỹ địa phương {fundYear}: <strong style={{ color: 'var(--success)' }}>
                    {formatCurrency(
                      householdFunds
                        .filter(f => f.year === fundYear)
                        .reduce((sum, f) => sum + f.amount, 0)
                    )}
                  </strong>
                </span>
                {canPrintExport && (
                  <button 
                    onClick={handlePrintFundsList}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Printer size={16} /> In danh sách A4
                  </button>
                )}
                {canPrintExport && (
                  <button 
                    onClick={handleExportFundsExcel}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#16a34a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 'auto',
                      minHeight: '36px',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.borderColor = '#86efac';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#bbf7d0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Download size={16} style={{ color: '#16a34a' }} /> Xuất Excel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Matrix table */}
          <div className="finance-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <table className="data-table" style={{ minWidth: '1300px', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f0fdf4', color: '#166534' }}>
                  <th style={{ width: '250px', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Hộ gia đình / Chủ hộ</th>
                  <th style={{ width: '130px', textAlign: 'right', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Tổng đã nộp</th>
                  {fundNames.map((name, i) => (
                    <th key={i} style={{ textAlign: 'center', fontSize: '0.8rem', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>{name}</th>
                  ))}
                  <th style={{ width: '110px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f0fdf4', color: '#166534', zIndex: 10, borderBottom: '2px solid #bbf7d0' }}>Biên lai</th>
                </tr>
              </thead>
              <tbody>
                {filteredHouseholdsForFunds.map((hh) => {
                  const headName = getHouseholdHeadName(hh);
                  const hhFunds = householdFunds.filter(f => f.household_id === hh.id && f.year === fundYear);
                  const totalPaid = hhFunds.reduce((sum, f) => sum + f.amount, 0);
                  
                  return (
                    <tr key={hh.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{headName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{hh.address}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: totalPaid > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatCurrency(totalPaid)}
                      </td>
                      {fundNames.map((fundName, idx) => {
                        const paidFund = hhFunds.find(f => f.household_id === hh.id && f.fund_name === fundName && f.year === fundYear);
                        const amountPaid = paidFund ? paidFund.amount : 0;
                        
                        return (
                          <td key={idx} style={{ textAlign: 'center' }}>
                            {amountPaid > 0 ? (
                              <button 
                                onClick={() => handleOpenFundPay(hh.id, fundName)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  border: 'none',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  color: 'var(--success)',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; }}
                                title="Bấm để sửa đổi hoặc xóa"
                              >
                                {formatCurrency(amountPaid)}
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleOpenFundPay(hh.id, fundName)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  border: '1px dashed var(--border)',
                                  backgroundColor: '#f8fafc',
                                  color: 'var(--text-muted)',
                                  fontWeight: '600',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                Chưa nộp
                              </button>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* Cột in biên lai */}
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handlePrintHouseholdReceipt(hh)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1.5px solid #cbd5e1',
                            backgroundColor: '#fff',
                            color: '#475569',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                          title="In biên lai thu quỹ hộ này"
                        >
                          <Printer size={13} />
                          <span>In biên lai</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredHouseholdsForFunds.length === 0 && (
                  <tr>
                    <td colSpan={3 + fundNames.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      {households.length === 0 ? 'Chưa có dữ liệu hộ gia đình nào để thu quỹ.' : 'Không tìm thấy hộ gia đình nào khớp với từ khóa tìm kiếm.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Matrix pay modal */}
          {editingFund && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '420px' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h2 style={{ fontSize: '1.15rem' }}>Ghi nhận thu Quỹ</h2>
                  <button className="close-btn" onClick={() => setEditingFund(null)}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveFund} className="modal-form" style={{ paddingTop: '12px' }}>
                  <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hộ gia đình:</div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', margin: '2px 0 6px' }}>
                      {households.find(h => h.id === editingFund.householdId) ? getHouseholdHeadName(households.find(h => h.id === editingFund.householdId)!) : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Khoản quỹ:</div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--primary)' }}>{editingFund.fundName} ({fundYear})</div>
                  </div>

                  <div className="form-group">
                    <label>Số tiền đóng (VND) *</label>
                    <input 
                      type="text" 
                      value={fundAmountInput}
                      onChange={(e) => setFundAmountInput(formatInputNumber(e.target.value))}
                      placeholder="Nhập số tiền đóng, ví dụ: 100.000"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Ngày nộp *</label>
                    <input 
                      type="date" 
                      value={fundDateInput}
                      onChange={(e) => setFundDateInput(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Ghi chú</label>
                    <input 
                      type="text" 
                      value={fundNoteInput}
                      onChange={(e) => setFundNoteInput(e.target.value)}
                      placeholder="Ví dụ: Ông A nộp trực tiếp..."
                    />
                  </div>

                  <div className="form-actions" style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingFund(null)} style={{ flex: 1 }}>Hủy</button>
                    {householdFunds.some(f => f.household_id === editingFund.householdId && f.fund_name === editingFund.fundName && f.year === fundYear) && (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={async () => {
                          if (window.confirm('Xóa ghi nhận đóng quỹ này? Số tiền sẽ được đưa về 0 và xóa khỏi sổ quỹ.')) {
                            setFundAmountInput('0');
                            setTimeout(() => {
                              const submitBtn = document.getElementById('save-fund-submit-btn');
                              if (submitBtn) submitBtn.click();
                            }, 100);
                          }
                        }} 
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'none' }}
                      >
                        Xóa
                      </button>
                    )}
                    <button type="submit" id="save-fund-submit-btn" className="btn btn-primary" style={{ flex: 1 }}>Lưu lại</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .finance-container { animation: fadeIn 0.4s ease-out; }
        .icon-btn-action {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          background-color: #f8fafc;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }
        .icon-btn-action:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .icon-btn-action.edit-btn:hover {
          background-color: rgba(37, 99, 235, 0.08);
          border-color: var(--primary);
          color: var(--primary);
        }
        .icon-btn-action.delete-btn:hover {
          background-color: rgba(239, 68, 68, 0.08);
          border-color: var(--danger);
          color: var(--danger);
        }
        
        .finance-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .finance-stat-card {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .finance-stat-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-4px);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          color: var(--secondary);
        }

        .income .stat-icon { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .expense .stat-icon { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .total .stat-icon { background: rgba(37, 99, 235, 0.1); color: var(--primary); }

        .stat-details .label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        .stat-details .value { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }
        .text-success { color: var(--success); }
        .text-danger { color: var(--danger); }

        .content-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .filter-tabs {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
        }

        .tab {
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .tab.active {
          background: white;
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .search-and-date { display: flex; gap: 12px; }
        .search-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid var(--border);
          padding: 0 12px;
          border-radius: 8px;
        }
        .search-mini input { border: none; outline: none; padding: 8px 0; font-size: 0.9rem; width: 180px; }
        .date-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .finance-table-wrapper {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th {
          background-color: #f0fdf4;
          padding: 16px;
          font-size: 0.85rem;
          font-weight: 700;
          color: #166534;
          border-bottom: 2px solid #bbf7d0;
        }

        .data-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          font-size: 0.95rem;
        }

        .date-cell { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .title-cell { display: flex; align-items: center; gap: 12px; font-weight: 600; }
        .type-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .type-indicator.income { background: var(--success); }
        .type-indicator.expense { background: var(--danger); }
        .category-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; color: #475569; }
        .amount-cell { font-weight: 700; text-align: right; }
        .amount-cell.success { color: var(--success); }
        .amount-cell.danger { color: var(--danger); }

        @media (max-width: 768px) {
          .content-filters { flex-direction: column; align-items: stretch; gap: 16px; }
          .search-mini input { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Finance;
