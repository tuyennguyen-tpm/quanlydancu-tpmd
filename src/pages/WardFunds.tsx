import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Download, 
  Upload, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  TrendingUp, 
  Wallet,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Coins
} from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { WardFund } from '../types';
import ExcelJS from 'exceljs';

const WardFunds = () => {
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

  // Cấp quyền sửa cho to_truong, admin, chung
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
    (currentRole !== 'to_truong' && currentRole !== 'admin' && currentRole !== 'chung');
  
  // State
  const [funds, setFunds] = useState<WardFund[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid_all' | 'unpaid_any'>('all');
  
  // Cấu hình quỹ của Phường động
  const [activeFunds, setActiveFunds] = useState<{ name: string; target: number }[]>([]);
  
  // Modal State
  const [editingRecord, setEditingRecord] = useState<WardFund | null>(null);
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [dobInput, setDobInput] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [contribInputs, setContribInputs] = useState<Record<string, { expected: string; actual: string; date: string }>>({});
  const [note, setNote] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load danh sách cấu hình quỹ Phường
  const loadActiveFunds = () => {
    const list = (db as any).getWardFundList();
    setActiveFunds(list);
  };

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await db.getWardFunds(selectedYear);
      setFunds(data);
    } catch (e) {
      showToast('Lỗi tải dữ liệu quỹ phường!', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveFunds();
    window.addEventListener('ward-fund-targets-changed', loadActiveFunds);
    return () => window.removeEventListener('ward-fund-targets-changed', loadActiveFunds);
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, [selectedYear]);

  // Format number to currency string
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Helper formats input string to dots grouped format (e.g. 100.000)
  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return parseInt(clean).toLocaleString('vi-VN');
  };

  // Filtered List
  const filteredFunds = funds.filter(f => {
    const matchesSearch = 
      f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (f.address && f.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (filterStatus === 'paid_all') {
      return activeFunds.every(fund => {
        const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
        return contrib.actual >= contrib.expected;
      });
    } else if (filterStatus === 'unpaid_any') {
      return activeFunds.some(fund => {
        const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
        return contrib.actual < contrib.expected;
      });
    }
    return true;
  });

  // Calculate Statistics dynamically
  const fundStats = activeFunds.map(fund => {
    const expected = funds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.expected || 0), 0);
    const actual = funds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
    const percent = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    const remaining = expected - actual;
    return {
      name: fund.name,
      expected,
      actual,
      percent,
      remaining
    };
  });

  // Open Edit Modal
  const handleOpenPay = (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    setEditingRecord(record);
    setFullNameInput(record.full_name);
    setDobInput(record.dob || '');
    setAddressInput(record.address || '');
    setNote(record.note || '');

    // Khởi tạo các ô nhập tiền động cho các quỹ
    const inputs: Record<string, { expected: string; actual: string; date: string }> = {};
    activeFunds.forEach(fund => {
      const contrib = record.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
      inputs[fund.name] = {
        expected: contrib.expected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        actual: contrib.actual.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        date: contrib.date || new Date().toISOString().slice(0, 10)
      };
    });
    setContribInputs(inputs);
  };

  // Quick Pay (Mark fully paid for all funds)
  const handleQuickPay = async (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    try {
      const newContributions: Record<string, any> = { ...record.contributions };
      activeFunds.forEach(fund => {
        const existing = record.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
        newContributions[fund.name] = {
          expected: existing.expected,
          actual: existing.expected,
          date: existing.date || new Date().toISOString().slice(0, 10)
        };
      });

      const payload: WardFund = {
        ...record,
        contributions: newContributions,
        note: record.note || 'Đã nộp đủ đợt tập trung'
      };
      await db.saveWardFund(payload);
      showToast(`Đã ghi nhận đóng đủ các quỹ cho ${record.full_name}`, 'success');
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Thao tác thất bại!', 'danger');
    }
  };

  // Save Edit Modal
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!fullNameInput.trim()) {
      showToast('Vui lòng nhập họ và tên!', 'warning');
      return;
    }

    // Parse các chỉ tiêu đóng quỹ
    const newContributions: Record<string, any> = {};
    for (const fundName of Object.keys(contribInputs)) {
      const input = contribInputs[fundName];
      const exp = parseInt(input.expected.replace(/\./g, '')) || 0;
      const act = parseInt(input.actual.replace(/\./g, '')) || 0;
      if (exp < 0 || act < 0) {
        showToast(`Số tiền của quỹ "${fundName}" không hợp lệ!`, 'warning');
        return;
      }
      newContributions[fundName] = {
        expected: exp,
        actual: act,
        date: act > 0 ? input.date : undefined
      };
    }

    try {
      const payload: WardFund = {
        ...editingRecord,
        full_name: fullNameInput.trim(),
        dob: dobInput.trim() || undefined,
        address: addressInput.trim() || undefined,
        contributions: newContributions,
        note: note.trim()
      };
      await db.saveWardFund(payload);
      showToast('Cập nhật thông tin thành công!', 'success');
      setEditingRecord(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi cập nhật dữ liệu đóng quỹ!', 'danger');
    }
  };

  // Delete Individual Record
  const handleDeleteRecord = async (id: string, name: string) => {
    if (isGuest) {
      showToast('Khách không có quyền xóa dữ liệu đóng quỹ!', 'warning');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa dòng thông tin đóng quỹ của cá nhân "${name}" khỏi danh sách năm ${selectedYear}?`)) {
      try {
        await db.deleteWardFund(id);
        showToast('Đã xóa bản ghi thành công!', 'success');
        loadData();
        window.dispatchEvent(new CustomEvent('db-changed'));
      } catch (e) {
        showToast('Lỗi khi xóa bản ghi!', 'danger');
      }
    }
  };

  // Clear All Year Data
  const handleClearYearData = async () => {
    if (isGuest) {
      showToast('Khách không có quyền xóa dữ liệu đóng quỹ!', 'warning');
      return;
    }
    if (window.confirm(`CẢNH BÁO CỰC KỲ QUAN TRỌNG: Bạn có chắc chắn muốn xóa toàn bộ danh sách quỹ Phường của năm ${selectedYear}? Hành động này sẽ xóa vĩnh viễn dữ liệu đã lưu và không thể hoàn tác.`)) {
      const secondConfirm = window.confirm(`Vui lòng xác nhận một lần nữa để xóa hết dữ liệu quỹ năm ${selectedYear}.`);
      if (secondConfirm) {
        try {
          setIsLoading(true);
          await db.clearWardFunds(selectedYear);
          showToast(`Đã dọn dẹp sạch dữ liệu đóng quỹ năm ${selectedYear}!`, 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        } catch (e) {
          showToast('Lỗi khi dọn dẹp dữ liệu!', 'danger');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  // Excel Sample Template Download (Dynamic column setup)
  const handleExportTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mẫu Danh Sách Quỹ Phường');

      // Title rows
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MẪU NHẬP LIỆU THU QUỸ PHƯỜNG NĂM ${selectedYear}`;
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
      worksheet.mergeCells('A1:F1');
      worksheet.getRow(1).height = 30;

      const subCell = worksheet.getCell('A2');
      subCell.value = 'Lưu ý: Không chỉnh sửa các cột tiêu đề. Nhập số nguyên không có chấm hay phẩy cho các mức quỹ phải đóng.';
      subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
      worksheet.mergeCells('A2:F2');
      worksheet.getRow(2).height = 20;

      // Headers row dynamically built
      const headers = [
        'STT',
        'Họ và tên',
        'Năm sinh / Ngày sinh',
        'Địa chỉ (Số nhà / Ngõ)',
        ...activeFunds.map(f => `${f.name} (Đồng)`)
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;
      
      // Styling header row
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      // Dynamic Sample Data
      const sampleData = [
        [1, 'Nguyễn Văn A', '1985', 'Số nhà 12 - Tổ 4', ...activeFunds.map(f => f.target)],
        [2, 'Trần Thị B', '1992', 'Ngõ 2A - Hộ số 5', ...activeFunds.map(f => f.target)],
        [3, 'Lê Văn C', '05/10/1990', 'Đường Quảng Giao', ...activeFunds.map(f => f.name.includes('thiên tai') ? 0 : f.target)]
      ];

      sampleData.forEach(row => {
        const dataRow = worksheet.addRow(row);
        dataRow.height = 22;
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

        for (let i = 0; i < activeFunds.length; i++) {
          const colIdx = 5 + i;
          dataRow.getCell(colIdx).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(colIdx).numFmt = '#,##0';
        }
      });

      // Border and gridlines
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          });
        }
      });

      // Auto width
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 6;
        else if (idx === 1) col.width = 25;
        else if (idx === 2) col.width = 18;
        else if (idx === 3) col.width = 30;
        else col.width = 35;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Mau_Nhap_Lieu_Quy_Phuong_${selectedYear}.xlsx`;
      link.click();
      showToast('Đã tải xuống file Excel mẫu thành công!', 'success');
    } catch (e) {
      showToast('Không thể tạo file mẫu!', 'danger');
    }
  };

  // Excel Bulk Import Logic (Dynamic columns matching)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        
        if (!worksheet) {
          showToast('File Excel trống hoặc không đúng định dạng!', 'danger');
          setIsLoading(false);
          return;
        }

        // Đọc dòng tiêu đề (dòng 3) để khớp cột quỹ
        const headerRow = worksheet.getRow(3);
        const fundColIndices: Record<string, number> = {};

        headerRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().trim().toLowerCase() || '';
          activeFunds.forEach(fund => {
            const nameLower = fund.name.toLowerCase();
            if (val === nameLower || val.includes(nameLower)) {
              fundColIndices[fund.name] = colNum;
            }
          });
        });

        // Nếu không khớp được cột nào, tự quy định theo thứ tự mặc định từ cột 5 trở đi
        if (Object.keys(fundColIndices).length === 0) {
          activeFunds.forEach((fund, index) => {
            fundColIndices[fund.name] = 5 + index;
          });
        }

        const batchFunds: WardFund[] = [];
        let successCount = 0;

        worksheet.eachRow((row, rowNum) => {
          // Bỏ qua dòng tiêu đề và header
          if (rowNum < 4) return;

          const name = row.getCell(2).value?.toString() || '';
          const dobVal = row.getCell(3).value?.toString() || '';
          const addr = row.getCell(4).value?.toString() || '';

          // Bỏ qua dòng trống không có tên
          if (!name.trim()) return;

          // Parse quỹ động
          const contributions: Record<string, any> = {};
          activeFunds.forEach(fund => {
            const colIndex = fundColIndices[fund.name];
            let expected = fund.target;
            if (colIndex) {
              const rawVal = row.getCell(colIndex).value;
              if (rawVal !== null && rawVal !== undefined) {
                expected = parseInt(rawVal.toString().replace(/\D/g, '')) || 0;
              }
            }
            contributions[fund.name] = {
              expected,
              actual: 0
            };
          });

          const record: WardFund = {
            id: generateUUID(),
            year: selectedYear,
            full_name: name.trim(),
            dob: dobVal ? dobVal.trim() : undefined,
            address: addr ? addr.trim() : undefined,
            contributions
          };
          batchFunds.push(record);
          successCount++;
        });

        if (batchFunds.length === 0) {
          showToast('Không đọc được dòng dữ liệu hợp lệ nào từ file Excel!', 'warning');
        } else {
          await db.saveWardFundsBatch(batchFunds);
          showToast(`Nhập dữ liệu thành công! Đã thêm ${successCount} nhân khẩu phải đóng quỹ Phường.`, 'success');
          loadData();
          window.dispatchEvent(new CustomEvent('db-changed'));
        }
      } catch (err) {
        showToast('Lỗi cấu trúc hoặc định dạng file Excel!', 'danger');
        console.error(err);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
  };

  // Excel Report Export Logic (Dynamic columns alignment)
  const handleExportReport = async () => {
    if (filteredFunds.length === 0) {
      showToast('Danh sách trống, không thể xuất báo cáo!', 'warning');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Bao_Cao_Thu_Quy_${selectedYear}`);

      const totalCols = 4 + activeFunds.length * 3 + 1; // 4 cột cá nhân + 3 cột/quỹ + 1 ghi chú

      // Title block
      worksheet.getCell('A1').value = `BÁO CÁO THU QUỸ ỦY THÁC TỪ PHƯỜNG NĂM ${selectedYear}`;
      worksheet.getCell('A1').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF15803D' } };
      
      const lastColLetter = worksheet.getColumn(totalCols).letter;
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getRow(1).height = 30;

      worksheet.getCell('A2').value = `Tổ dân phố: ${localStorage.getItem('tdp_name') || 'Quảng Giao'} - Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
      worksheet.getCell('A2').font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF475569' } };
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getRow(2).height = 20;

      // Group Headers
      worksheet.getCell('A3').value = 'Thông tin cá nhân';
      worksheet.mergeCells('A3:D3');
      
      let currentColNum = 5;
      activeFunds.forEach(fund => {
        const startCellStr = worksheet.getColumn(currentColNum).letter + '3';
        const endCellStr = worksheet.getColumn(currentColNum + 2).letter + '3';
        worksheet.getCell(startCellStr).value = fund.name;
        worksheet.mergeCells(`${startCellStr}:${endCellStr}`);
        currentColNum += 3;
      });
      
      const noteCellStr = worksheet.getColumn(currentColNum).letter + '3';
      worksheet.getCell(noteCellStr).value = 'Ghi chú';

      const groupRow = worksheet.getRow(3);
      groupRow.height = 25;
      groupRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E40AF' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Sub Headers
      const subHeaders = ['STT', 'Họ và tên', 'Năm sinh', 'Địa chỉ'];
      activeFunds.forEach(() => {
        subHeaders.push('Phải nộp (đ)', 'Thực nộp (đ)', 'Ngày nộp');
      });
      subHeaders.push('Chú thích');
      
      const subHeaderRow = worksheet.addRow(subHeaders);
      subHeaderRow.height = 24;
      subHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF3B82F6' } }
        };
      });

      // Data Rows
      filteredFunds.forEach((f, idx) => {
        const rowData: any[] = [
          idx + 1,
          f.full_name,
          f.dob || '',
          f.address || ''
        ];
        
        activeFunds.forEach(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
          rowData.push(
            contrib.expected,
            contrib.actual,
            contrib.date ? new Date(contrib.date).toLocaleDateString('vi-VN') : ''
          );
        });
        rowData.push(f.note || '');
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;

        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // STT
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; // Họ tên
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }; // Năm sinh
        dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }; // Địa chỉ

        let cNum = 5;
        activeFunds.forEach(fund => {
          const contrib = f.contributions?.[fund.name] || { expected: 0, actual: 0 };
          
          dataRow.getCell(cNum).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(cNum).numFmt = '#,##0';
          
          dataRow.getCell(cNum + 1).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(cNum + 1).numFmt = '#,##0';
          
          dataRow.getCell(cNum + 2).alignment = { horizontal: 'center', vertical: 'middle' };

          if (contrib.actual >= contrib.expected && contrib.expected > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FF16A34A' }, bold: true };
          } else if (contrib.actual > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FFD97706' }, bold: true };
          } else if (contrib.expected > 0) {
            dataRow.getCell(cNum + 1).font = { color: { argb: 'FFDC2626' } };
          }
          
          cNum += 3;
        });

        dataRow.getCell(cNum).alignment = { horizontal: 'left', vertical: 'middle' }; // Ghi chú
      });

      // Total Row
      const totalRowIndex = worksheet.rowCount + 1;
      const totalRowCells: any[] = ['Tổng cộng', '', '', ''];
      
      activeFunds.forEach(fund => {
        const totalExp = filteredFunds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.expected || 0), 0);
        const totalAcu = filteredFunds.reduce((sum, f) => sum + (f.contributions?.[fund.name]?.actual || 0), 0);
        totalRowCells.push(totalExp, totalAcu, '');
      });
      totalRowCells.push('');
      
      const totalRow = worksheet.addRow(totalRowCells);
      totalRow.height = 24;
      worksheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
      
      totalRow.getCell(1).font = { bold: true, name: 'Segoe UI' };
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      let curCellIndex = 5;
      activeFunds.forEach(() => {
        [curCellIndex, curCellIndex + 1].forEach(colIdx => {
          const cell = totalRow.getCell(colIdx);
          cell.font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
        curCellIndex += 3;
      });

      // Borders and gridlines
      worksheet.eachRow((row, rowNum) => {
        if (rowNum >= 3) {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          });
        }
      });

      // Column widths
      worksheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 6;      // STT
        else if (idx === 1) col.width = 25;  // Họ tên
        else if (idx === 2) col.width = 12;  // Năm sinh
        else if (idx === 3) col.width = 25;  // Địa chỉ
        else if (idx < currentColNum - 1) {
          const mod = (idx - 4) % 3;
          if (mod === 2) col.width = 14;     // Ngày nộp
          else col.width = 15;               // Expected / Actual
        } else col.width = 20;               // Ghi chú
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Bao_Cao_Thu_Quy_Phuong_${selectedYear}.xlsx`;
      link.click();
      showToast('Đã xuất báo cáo Excel thành công!', 'success');
    } catch (e) {
      showToast('Lỗi khi xuất file Excel báo cáo!', 'danger');
      console.error(e);
    }
  };

  return (
    <div style={{ 
      animation: 'fadeIn 0.25s ease-out',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)',
      minHeight: 'calc(100vh - var(--header-height) - 48px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      
      {/* Top Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        marginBottom: '10px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              backgroundColor: '#eff6ff', 
              color: '#3b82f6', 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Quản lý Quỹ Ủy thác từ Phường
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Theo dõi các khoản thu bắt buộc và tự nguyện dựa trên danh sách Phường giao
              </p>
            </div>
          </div>
        </div>

        {/* Year Select & Reload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: '#fff',
              fontSize: '0.9rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(yr => (
              <option key={yr} value={yr}>Năm {yr}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Dashboard (Dynamic summary cards) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px', 
        marginBottom: '10px' 
      }}>
        {fundStats.map((stat, index) => {
          const isPCTT = stat.name.includes('thiên tai');
          const bgColor = isPCTT ? '#f0fdf4' : '#fffdf5';
          const borderColor = isPCTT ? '#fef3c7' : '#fef3c7'; // clean border
          const textColor = isPCTT ? '#065f46' : '#78350f';
          const barColor = isPCTT ? '#10b981' : '#f59e0b';
          const trackColor = isPCTT ? '#e8f5e9' : '#fff8e1';
          
          return (
            <div 
              key={stat.name}
              style={{
                backgroundColor: bgColor,
                border: `1.5px solid ${isPCTT ? '#d1fae5' : '#fef3c7'}`,
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.006)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: textColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stat.name}
                  </span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '2rem', fontWeight: '850', color: '#1e293b' }}>
                    {formatCurrency(stat.actual)}
                  </h3>
                </div>
                <div style={{
                  backgroundColor: isPCTT ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: barColor,
                  borderRadius: '12px',
                  padding: '8px 12px',
                  fontSize: '0.88rem',
                  fontWeight: '800'
                }}>
                  Tiến độ {stat.percent}%
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', backgroundColor: trackColor, borderRadius: '4px', marginTop: '16px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(stat.percent, 100)}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.4s ease-out' }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>
                <span>Phải thu: {formatCurrency(stat.expected)}</span>
                <span style={{ color: stat.remaining > 0 ? '#ef4444' : '#10b981' }}>
                  Còn thiếu: {formatCurrency(stat.remaining)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '12px',
        marginBottom: '4px'
      }}>
        {/* Left Search and Filter */}
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: '220px'
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm theo tên người dân, địa chỉ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1.5px solid var(--border)',
                fontSize: '0.88rem',
                outline: 'none',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)'
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: '#fff',
              fontSize: '0.88rem',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid_all">Đã nộp đủ các quỹ</option>
            <option value="unpaid_any">Chưa nộp đủ ít nhất 1 quỹ</option>
          </select>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportTemplate}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fff',
              border: '1.5px solid var(--border)',
              color: 'var(--text-main)',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}
          >
            <Download size={16} /> Tải file mẫu
          </button>

          {/* Nhập Excel */}
          {!isGuest && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                color: '#2563eb',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}
            >
              <Upload size={16} /> Nhập Excel Phường
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
          />

          <button
            onClick={handleExportReport}
            className="btn btn-success"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              color: '#16a34a',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}
          >
            <FileSpreadsheet size={16} /> Xuất báo cáo
          </button>

          {/* Xóa sạch năm */}
          {!isGuest && funds.length > 0 && (
            <button
              onClick={handleClearYearData}
              title="Xóa hết danh sách năm nay"
              style={{
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1.5px solid #fecaca',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Grid Area */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '8px' }} />
          <div>Đang xử lý dữ liệu...</div>
        </div>
      ) : filteredFunds.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <AlertTriangle size={36} style={{ color: '#f59e0b', marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: '750', color: 'var(--text-main)' }}>
            Không tìm thấy dữ liệu quỹ Phường
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Năm {selectedYear} chưa có dữ liệu. Vui lòng tải file mẫu, điền danh sách rồi nhập vào hệ thống để bắt đầu theo dõi.
          </p>
          {!isGuest && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
              style={{
                marginTop: '16px',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}
            >
              Nhập Excel danh sách Phường giao ngay
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Statistics bar */}
          <div style={{ marginBottom: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', fontWeight: '500' }}>
            <span>Đang hiển thị {filteredFunds.length} / {funds.length} cá nhân phải nộp</span>
            <span>Đơn vị tính: Đồng (đ)</span>
          </div>

          {/* Table container with horizontal & vertical scroll scrollbar support */}
          <div style={{ 
            overflow: 'auto', 
            maxHeight: 'calc(100vh - 330px)',
            border: '1.5px solid var(--border)', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <table className="data-table" style={{ width: '100%', minWidth: `${600 + activeFunds.length * 200}px`, borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ width: '50px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>STT</th>
                  <th style={{ width: '220px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Người phải nộp</th>
                  <th style={{ width: '90px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Năm sinh</th>
                  <th style={{ width: '200px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Địa chỉ</th>
                  
                  {activeFunds.map(fund => {
                    const isPCTT = fund.name.includes('thiên tai');
                    return (
                      <th key={fund.name} style={{ 
                        width: '200px', 
                        textAlign: 'center', 
                        position: 'sticky', 
                        top: 0, 
                        zIndex: 10,
                        backgroundColor: isPCTT ? '#ecfdf5' : '#fef3c7', 
                        color: isPCTT ? '#065f46' : '#78350f' 
                      }}>
                        {fund.name}
                      </th>
                    );
                  })}
                  
                  <th style={{ width: '180px', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Ghi chú</th>
                  {!isGuest && <th style={{ width: '90px', textAlign: 'center', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filteredFunds.map((item, idx) => {
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'center', fontWeight: '500', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.full_name}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.dob || '—'}</td>
                      <td>{item.address || '—'}</td>
                      
                      {activeFunds.map(fund => {
                        const contrib = item.contributions?.[fund.name] || { expected: fund.target, actual: 0 };
                        const paid = contrib.actual >= contrib.expected && contrib.expected > 0;
                        const hasPartial = contrib.actual > 0 && contrib.actual < contrib.expected;
                        
                        return (
                          <td key={fund.name} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ 
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              width: '90%',
                              backgroundColor: paid ? '#ecfdf5' : hasPartial ? '#fffbeb' : '#fff1f2',
                              border: `1px solid ${paid ? '#10b981' : hasPartial ? '#f59e0b' : '#f87171'}`,
                            }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: paid ? '#047857' : hasPartial ? '#b45309' : '#be123c' }}>
                                {formatCurrency(contrib.actual)} / {formatCurrency(contrib.expected)}
                              </div>
                              {contrib.date && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  📅 {new Date(contrib.date).toLocaleDateString('vi-VN')}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      
                      <td>{item.note || '—'}</td>
                      {!isGuest && (
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleQuickPay(item)}
                              title="Ghi nhận nộp đủ nhanh"
                              style={{
                                background: '#10b981',
                                border: 'none',
                                color: '#fff',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenPay(item)}
                              title="Cập nhật chi tiết"
                              style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: '#fff',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(item.id, item.full_name)}
                              title="Xóa cá nhân này"
                              style={{
                                background: '#ef4444',
                                border: 'none',
                                color: '#fff',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Ghi nhận đóng tiền chi tiết */}
      {editingRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200,
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            width: '90%',
            maxWidth: '520px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Cập nhật đóng quỹ Phường</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Hộ/Cá nhân: {editingRecord.full_name} {editingRecord.dob ? `(${editingRecord.dob})` : ''}
                </p>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form scrollable */}
            <form onSubmit={handleSavePayment} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              
              {/* Thông tin cá nhân */}
              <div style={{ 
                border: '1.5px solid var(--border)', 
                borderRadius: '12px', 
                padding: '12px 14px', 
                marginBottom: '16px',
                backgroundColor: 'var(--bg-main)'
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Thông tin cá nhân
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Họ và tên
                    </label>
                    <input 
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--border)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Năm/Ngày sinh
                    </label>
                    <input 
                      type="text"
                      value={dobInput}
                      onChange={(e) => setDobInput(e.target.value)}
                      placeholder="VD: 1990"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--border)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Địa chỉ (Số nhà / Ngõ / Tổ)
                  </label>
                  <input 
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid var(--border)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Funds Fields */}
              {activeFunds.map(fund => {
                const input = contribInputs[fund.name] || { expected: '0', actual: '0', date: '' };
                const isPCTT = fund.name.includes('thiên tai');
                const fundColor = isPCTT ? '#065f46' : '#78350f';
                const borderColor = isPCTT ? '#a7f3d0' : '#fde047';
                const bgColor = isPCTT ? '#f0fdf4' : '#fffdf5';
                
                return (
                  <div key={fund.name} style={{ 
                    border: `1.5px solid ${borderColor}`, 
                    backgroundColor: bgColor,
                    borderRadius: '12px', 
                    padding: '12px 14px', 
                    marginBottom: '16px' 
                  }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: fundColor, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      {fund.name}
                    </span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Mức phải đóng (đ)
                        </label>
                        <input 
                          type="text"
                          value={input.expected}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                expected: formatInputNumber(e.target.value)
                              }
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.88rem',
                            fontWeight: '700'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Thực nộp (đ)
                        </label>
                        <input 
                          type="text"
                          value={input.actual}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                actual: formatInputNumber(e.target.value)
                              }
                            });
                          }}
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.88rem',
                            fontWeight: '700',
                            color: fundColor
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                          Ngày nộp
                        </label>
                        <input 
                          type="date"
                          value={input.date}
                          onChange={(e) => {
                            setContribInputs({
                              ...contribInputs,
                              [fund.name]: {
                                ...input,
                                date: e.target.value
                              }
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            fontSize: '0.82rem'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Note / Chú thích */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Ghi chú đóng góp
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú (Ví dụ: Miễn nộp do gia đình chính sách...)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.88rem',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-main)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Xác nhận lưu
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default WardFunds;
