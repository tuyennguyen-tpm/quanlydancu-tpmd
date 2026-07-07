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

  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');
  
  // State
  const [funds, setFunds] = useState<WardFund[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid_all' | 'unpaid_any'>('all');
  
  // Modal State
  const [editingRecord, setEditingRecord] = useState<WardFund | null>(null);
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [dobInput, setDobInput] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [pcttExpected, setPcttExpected] = useState<string>('');
  const [pcttActual, setPcttActual] = useState<string>('');
  const [pcttDate, setPcttDate] = useState<string>('');
  const [dodnExpected, setDodnExpected] = useState<string>('');
  const [dodnActual, setDodnActual] = useState<string>('');
  const [dodnDate, setDodnDate] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    loadData();
    // Lắng nghe sự thay đổi CSDL
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
      return f.pctt_actual >= f.pctt_expected && f.dodn_actual >= f.dodn_expected;
    } else if (filterStatus === 'unpaid_any') {
      return f.pctt_actual < f.pctt_expected || f.dodn_actual < f.dodn_expected;
    }
    return true;
  });

  // Calculate Statistics
  const totalPCTTExpected = funds.reduce((sum, f) => sum + f.pctt_expected, 0);
  const totalPCTTActual = funds.reduce((sum, f) => sum + f.pctt_actual, 0);
  const pcttPercent = totalPCTTExpected > 0 ? Math.round((totalPCTTActual / totalPCTTExpected) * 100) : 0;

  const totalDODNExpected = funds.reduce((sum, f) => sum + f.dodn_expected, 0);
  const totalDODNActual = funds.reduce((sum, f) => sum + f.dodn_actual, 0);
  const dodnPercent = totalDODNExpected > 0 ? Math.round((totalDODNActual / totalDODNExpected) * 100) : 0;

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
    setPcttExpected(record.pctt_expected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setPcttActual(record.pctt_actual.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setPcttDate(record.pctt_date || new Date().toISOString().slice(0, 10));
    setDodnExpected(record.dodn_expected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setDodnActual(record.dodn_actual.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setDodnDate(record.dodn_date || new Date().toISOString().slice(0, 10));
    setNote(record.note || '');
  };

  // Quick Pay (Mark fully paid)
  const handleQuickPay = async (record: WardFund) => {
    if (isGuest) {
      showToast('Khách không có quyền sửa đổi dữ liệu đóng quỹ!', 'warning');
      return;
    }
    try {
      const payload: WardFund = {
        ...record,
        pctt_actual: record.pctt_expected,
        pctt_date: record.pctt_date || new Date().toISOString().slice(0, 10),
        dodn_actual: record.dodn_expected,
        dodn_date: record.dodn_date || new Date().toISOString().slice(0, 10),
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

    const expPCTT = parseInt(pcttExpected.replace(/\./g, '')) || 0;
    const valPCTT = parseInt(pcttActual.replace(/\./g, '')) || 0;
    const expDODN = parseInt(dodnExpected.replace(/\./g, '')) || 0;
    const valDODN = parseInt(dodnActual.replace(/\./g, '')) || 0;

    if (expPCTT < 0 || valPCTT < 0 || expDODN < 0 || valDODN < 0) {
      showToast('Số tiền không hợp lệ!', 'warning');
      return;
    }

    try {
      const payload: WardFund = {
        ...editingRecord,
        full_name: fullNameInput.trim(),
        dob: dobInput.trim() || undefined,
        address: addressInput.trim() || undefined,
        pctt_expected: expPCTT,
        pctt_actual: valPCTT,
        pctt_date: valPCTT > 0 ? pcttDate : undefined,
        dodn_expected: expDODN,
        dodn_actual: valDODN,
        dodn_date: valDODN > 0 ? dodnDate : undefined,
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

  // Excel Sample Template Download
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

      // Headers row
      const headers = [
        'STT',
        'Họ và tên',
        'Năm sinh / Ngày sinh',
        'Địa chỉ (Số nhà / Ngõ)',
        'Mức đóng Quỹ Phòng chống thiên tai (Đồng)',
        'Mức đóng Quỹ Đền ơn đáp nghĩa (Đồng)'
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

      // Sample Data
      const sampleData = [
        [1, 'Nguyễn Văn A', '1985', 'Số nhà 12 - Tổ 4', 15000, 70000],
        [2, 'Trần Thị B', '1992', 'Ngõ 2A - Hộ số 5', 15000, 70000],
        [3, 'Lê Văn C', '05/10/1990', 'Đường Quảng Giao', 0, 70000]
      ];

      sampleData.forEach(row => {
        const dataRow = worksheet.addRow(row);
        dataRow.height = 22;
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
        dataRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        dataRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

        dataRow.getCell(5).numFmt = '#,##0';
        dataRow.getCell(6).numFmt = '#,##0';
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
        else if (idx === 4) col.width = 35;
        else if (idx === 5) col.width = 35;
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

  // Excel Bulk Import Logic
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

        const batchFunds: WardFund[] = [];
        let successCount = 0;

        worksheet.eachRow((row, rowNum) => {
          // Bỏ qua tiêu đề (dòng 1, 2) và header (dòng 3)
          if (rowNum < 4) return;

          const stt = row.getCell(1).value?.toString() || '';
          const name = row.getCell(2).value?.toString() || '';
          const dobVal = row.getCell(3).value?.toString() || '';
          const addr = row.getCell(4).value?.toString() || '';
          const pcttValRaw = row.getCell(5).value;
          const dodnValRaw = row.getCell(6).value;

          // Bỏ qua dòng trống không có tên
          if (!name.trim()) return;

          // Parse số tiền
          let pctt_expected = 0;
          if (pcttValRaw !== null && pcttValRaw !== undefined) {
            pctt_expected = parseInt(pcttValRaw.toString().replace(/\D/g, '')) || 0;
          }
          
          let dodn_expected = 0;
          if (dodnValRaw !== null && dodnValRaw !== undefined) {
            dodn_expected = parseInt(dodnValRaw.toString().replace(/\D/g, '')) || 0;
          }

          const record: WardFund = {
            id: generateUUID(),
            year: selectedYear,
            full_name: name.trim(),
            dob: dobVal ? dobVal.trim() : undefined,
            address: addr ? addr.trim() : undefined,
            pctt_expected,
            pctt_actual: 0, // Nhập ban đầu thực đóng bằng 0
            dodn_expected,
            dodn_actual: 0  // Nhập ban đầu thực đóng bằng 0
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

  // Excel Report Export Logic
  const handleExportReport = async () => {
    if (filteredFunds.length === 0) {
      showToast('Danh sách trống, không thể xuất báo cáo!', 'warning');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Bao_Cao_Thu_Quy_${selectedYear}`);

      // Title block
      worksheet.getCell('A1').value = `BÁO CÁO THU QUỸ ỦY THÁC TỪ PHƯỜNG NĂM ${selectedYear}`;
      worksheet.getCell('A1').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF15803D' } };
      worksheet.mergeCells('A1:K1');
      worksheet.getRow(1).height = 30;

      worksheet.getCell('A2').value = `Tổ dân phố: ${localStorage.getItem('tdp_name') || 'Quảng Giao'} - Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
      worksheet.getCell('A2').font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF475569' } };
      worksheet.mergeCells('A2:K2');
      worksheet.getRow(2).height = 20;

      // Group Headers
      worksheet.getCell('A3').value = 'Thông tin cá nhân';
      worksheet.mergeCells('A3:D3');
      worksheet.getCell('E3').value = 'Quỹ phòng chống thiên tai';
      worksheet.mergeCells('E3:G3');
      worksheet.getCell('H3').value = 'Quỹ đền ơn đáp nghĩa';
      worksheet.mergeCells('H3:J3');
      worksheet.getCell('K3').value = 'Ghi chú';

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
      const subHeaders = [
        'STT', 'Họ và tên', 'Năm sinh', 'Địa chỉ',
        'Phải nộp (đ)', 'Thực nộp (đ)', 'Ngày nộp',
        'Phải nộp (đ)', 'Thực nộp (đ)', 'Ngày nộp',
        'Chú thích'
      ];
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
        const rowData = [
          idx + 1,
          f.full_name,
          f.dob || '',
          f.address || '',
          f.pctt_expected,
          f.pctt_actual,
          f.pctt_date ? new Date(f.pctt_date).toLocaleDateString('vi-VN') : '',
          f.dodn_expected,
          f.dodn_actual,
          f.dodn_date ? new Date(f.dodn_date).toLocaleDateString('vi-VN') : '',
          f.note || ''
        ];
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;

        // Alignments
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // STT
        dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; // Họ tên
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }; // Năm sinh
        dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }; // Địa chỉ
        dataRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }; // PCTT dự kiến
        dataRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }; // PCTT thực đóng
        dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }; // PCTT ngày đóng
        dataRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }; // ĐOĐN dự kiến
        dataRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' }; // ĐOĐN thực đóng
        dataRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }; // ĐOĐN ngày đóng
        dataRow.getCell(11).alignment = { horizontal: 'left', vertical: 'middle' }; // Ghi chú

        // Number format
        dataRow.getCell(5).numFmt = '#,##0';
        dataRow.getCell(6).numFmt = '#,##0';
        dataRow.getCell(8).numFmt = '#,##0';
        dataRow.getCell(9).numFmt = '#,##0';

        // Highlighting paid vs unpaid status colors
        if (f.pctt_actual >= f.pctt_expected && f.pctt_expected > 0) {
          dataRow.getCell(6).font = { color: { argb: 'FF16A34A' }, bold: true };
        } else if (f.pctt_actual > 0) {
          dataRow.getCell(6).font = { color: { argb: 'FFD97706' }, bold: true };
        } else if (f.pctt_expected > 0) {
          dataRow.getCell(6).font = { color: { argb: 'FFDC2626' } };
        }

        if (f.dodn_actual >= f.dodn_expected && f.dodn_expected > 0) {
          dataRow.getCell(9).font = { color: { argb: 'FF16A34A' }, bold: true };
        } else if (f.dodn_actual > 0) {
          dataRow.getCell(9).font = { color: { argb: 'FFD97706' }, bold: true };
        } else if (f.dodn_expected > 0) {
          dataRow.getCell(9).font = { color: { argb: 'FFDC2626' } };
        }
      });

      // Total Row
      const totalRowIndex = worksheet.rowCount + 1;
      const totalPCTTExp = filteredFunds.reduce((sum, f) => sum + f.pctt_expected, 0);
      const totalPCTTAcu = filteredFunds.reduce((sum, f) => sum + f.pctt_actual, 0);
      const totalDODNExp = filteredFunds.reduce((sum, f) => sum + f.dodn_expected, 0);
      const totalDODNAcu = filteredFunds.reduce((sum, f) => sum + f.dodn_actual, 0);

      const totalRow = worksheet.addRow([
        'Tổng cộng', '', '', '',
        totalPCTTExp, totalPCTTAcu, '',
        totalDODNExp, totalDODNAcu, '', ''
      ]);
      totalRow.height = 24;
      worksheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
      
      totalRow.getCell(1).font = { bold: true, name: 'Segoe UI' };
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      [5, 6, 8, 9].forEach(colIndex => {
        const cell = totalRow.getCell(colIndex);
        cell.font = { bold: true, name: 'Segoe UI', color: { argb: 'FF15803D' } };
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
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
        if (idx === 0) col.width = 6;     // STT
        else if (idx === 1) col.width = 25; // Họ tên
        else if (idx === 2) col.width = 12; // Năm sinh
        else if (idx === 3) col.width = 25; // Địa chỉ
        else if (idx === 4) col.width = 15; // PCTT expected
        else if (idx === 5) col.width = 15; // PCTT actual
        else if (idx === 6) col.width = 14; // PCTT date
        else if (idx === 7) col.width = 15; // ĐOĐN expected
        else if (idx === 8) col.width = 15; // ĐOĐN actual
        else if (idx === 9) col.width = 14; // ĐOĐN date
        else if (idx === 10) col.width = 20; // Ghi chú
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
        marginBottom: '20px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              padding: '10px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-muted)' }}>
            Năm quản lý:
          </span>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: 'var(--bg-main)',
              fontWeight: '700',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            className="icon-btn" 
            onClick={loadData} 
            title="Tải lại dữ liệu"
            style={{ borderRadius: '8px', padding: '7px' }}
          >
            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px', 
        marginBottom: '24px' 
      }}>
        {/* Card 1: PCTT */}
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          border: '1px solid #a7f3d0',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.04)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.1, color: '#047857' }}>
            <Coins size={120} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quỹ Phòng chống thiên tai (PCTT)
              </span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#065f46' }}>
                {formatCurrency(totalPCTTActual)}
              </h3>
            </div>
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: '700', 
              color: '#065f46', 
              backgroundColor: '#a7f3d0',
              padding: '3px 8px',
              borderRadius: '20px'
            }}>
              Tiến độ {pcttPercent}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(4, 120, 87, 0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${Math.min(pcttPercent, 100)}%`, height: '100%', background: '#059669', borderRadius: '10px', transition: 'width 0.5s ease-in-out' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#047857', fontWeight: '500' }}>
            <span>Phải thu: {formatCurrency(totalPCTTExpected)}</span>
            <span>Còn thiếu: {formatCurrency(Math.max(0, totalPCTTExpected - totalPCTTActual))}</span>
          </div>
        </div>

        {/* Card 2: ĐOĐN */}
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '1px solid #fde047',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: '0 4px 15px rgba(217, 119, 6, 0.04)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.1, color: '#b45309' }}>
            <TrendingUp size={120} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quỹ Đền ơn đáp nghĩa (ĐOĐN)
              </span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#78350f' }}>
                {formatCurrency(totalDODNActual)}
              </h3>
            </div>
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: '700', 
              color: '#78350f', 
              backgroundColor: '#fef08a',
              padding: '3px 8px',
              borderRadius: '20px'
            }}>
              Tiến độ {dodnPercent}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(180, 83, 9, 0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ width: `${Math.min(dodnPercent, 100)}%`, height: '100%', background: '#d97706', borderRadius: '10px', transition: 'width 0.5s ease-in-out' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#b45309', fontWeight: '500' }}>
            <span>Vận động: {formatCurrency(totalDODNExpected)}</span>
            <span>Còn thiếu: {formatCurrency(Math.max(0, totalDODNExpected - totalDODNActual))}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Search & Filter status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '280px' }}>
          <div className="search-bar" style={{ position: 'relative', flex: 1, margin: 0, maxWidth: '350px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.88rem'
              }}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid_all">Đã nộp đủ cả 2 quỹ</option>
            <option value="unpaid_any">Chưa nộp đủ (còn thiếu)</option>
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
          />
          
          {/* Tải file mẫu */}
          <button
            onClick={handleExportTemplate}
            title="Tải tệp Excel mẫu để điền danh sách Phường"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-main)',
              border: '1.5px solid var(--border)',
              color: 'var(--text-main)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            <FileSpreadsheet size={16} /> Tải file mẫu
          </button>

          {/* Nhập Excel */}
          {!isGuest && (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Tải danh sách từ Phường bằng tệp Excel lên phần mềm"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#2563eb',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <Upload size={16} /> Nhập Excel Phường
            </button>
          )}

          {/* Xuất báo cáo */}
          <button
            onClick={handleExportReport}
            title="Xuất danh sách tình hình nộp quỹ hiện tại ra Excel"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#16a34a',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            <Download size={16} /> Xuất báo cáo
          </button>

          {/* Xóa sạch năm */}
          {!isGuest && funds.length > 0 && (
            <button
              onClick={handleClearYearData}
              title={`Xóa sạch toàn bộ danh sách nộp quỹ năm ${selectedYear}`}
              style={{
                padding: '8px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Area */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <RefreshCw size={36} className="spin" style={{ color: '#10b981', marginBottom: '12px' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>Đang tải danh sách quỹ Phường...</span>
        </div>
      ) : filteredFunds.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-muted)'
        }}>
          <AlertTriangle size={48} style={{ color: 'var(--text-muted)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700' }}>Danh sách trống!</h4>
          <p style={{ margin: '6px 0 16px 0', fontSize: '0.82rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            Năm {selectedYear} chưa có dữ liệu quỹ Phường. Vui lòng tải xuống file Excel mẫu, điền danh sách rồi nhập vào hệ thống để bắt đầu theo dõi.
          </p>
          {!isGuest && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#fff',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              📥 Nhập danh sách của Phường ngay
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

          {/* Table container */}
          <div style={{ 
            overflowX: 'auto', 
            border: '1.5px solid var(--border)', 
            borderRadius: '12px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <table className="data-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ width: '50px', textAlign: 'center' }}>STT</th>
                  <th style={{ width: '220px', textAlign: 'left' }}>Người phải nộp</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Năm sinh</th>
                  <th style={{ width: '200px', textAlign: 'left' }}>Địa chỉ</th>
                  <th style={{ width: '180px', textAlign: 'center', backgroundColor: '#ecfdf5', color: '#065f46' }}>Quỹ Thiên Tai (PCTT)</th>
                  <th style={{ width: '180px', textAlign: 'center', backgroundColor: '#fef3c7', color: '#78350f' }}>Quỹ Đền Ơn Đáp Nghĩa</th>
                  <th style={{ width: '140px', textAlign: 'left' }}>Ghi chú</th>
                  {!isGuest && <th style={{ width: '90px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filteredFunds.map((item, idx) => {
                  const pcttPaid = item.pctt_actual >= item.pctt_expected && item.pctt_expected > 0;
                  const dodnPaid = item.dodn_actual >= item.dodn_expected && item.dodn_expected > 0;
                  
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'center', fontWeight: '500', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.full_name}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{item.dob || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{item.address || '—'}</td>
                      
                      {/* Cột PCTT */}
                      <td style={{ backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Phải đóng: <strong>{formatCurrency(item.pctt_expected)}</strong>
                          </span>
                          
                          {item.pctt_expected === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Miễn đóng</span>
                          ) : (
                            <button
                              onClick={() => handleOpenPay(item)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: 'none',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: pcttPaid ? '#d1fae5' : item.pctt_actual > 0 ? '#fef3c7' : '#fee2e2',
                                color: pcttPaid ? '#065f46' : item.pctt_actual > 0 ? '#d97706' : '#dc2626'
                              }}
                            >
                              {pcttPaid ? (
                                <><Check size={12} /> Đủ: {formatCurrency(item.pctt_actual)}</>
                              ) : item.pctt_actual > 0 ? (
                                <>Nộp: {formatCurrency(item.pctt_actual)}</>
                              ) : (
                                <>Chưa nộp</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Cột ĐOĐN */}
                      <td style={{ backgroundColor: '#fcfcf9' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Yêu cầu: <strong>{formatCurrency(item.dodn_expected)}</strong>
                          </span>
                          
                          {item.dodn_expected === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Không thu</span>
                          ) : (
                            <button
                              onClick={() => handleOpenPay(item)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: 'none',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: dodnPaid ? '#d1fae5' : item.dodn_actual > 0 ? '#fef3c7' : '#fee2e2',
                                color: dodnPaid ? '#065f46' : item.dodn_actual > 0 ? '#d97706' : '#dc2626'
                              }}
                            >
                              {dodnPaid ? (
                                <><Check size={12} /> Đủ: {formatCurrency(item.dodn_actual)}</>
                              ) : item.dodn_actual > 0 ? (
                                <>Nộp: {formatCurrency(item.dodn_actual)}</>
                              ) : (
                                <>Chưa nộp</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <div style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.note}>
                          {item.note || '—'}
                        </div>
                      </td>

                      {/* Thao tác */}
                      {!isGuest && (
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleQuickPay(item)}
                              title="Ghi nhận nộp đủ nhanh cả hai quỹ"
                              disabled={pcttPaid && dodnPaid}
                              style={{
                                padding: '5px',
                                borderRadius: '6px',
                                backgroundColor: pcttPaid && dodnPaid ? '#f1f5f9' : '#d1fae5',
                                color: pcttPaid && dodnPaid ? '#94a3b8' : '#10b981',
                                border: 'none',
                                cursor: pcttPaid && dodnPaid ? 'default' : 'pointer'
                              }}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => handleOpenPay(item)}
                              title="Sửa chi tiết thông tin đóng"
                              style={{
                                padding: '5px',
                                borderRadius: '6px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(item.id, item.full_name)}
                              title="Xóa cá nhân khỏi danh sách thu"
                              style={{
                                padding: '5px',
                                borderRadius: '6px',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={15} />
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

            {/* Modal Body / Form */}
            <form onSubmit={handleSavePayment} style={{ padding: '20px' }}>
              
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

              {/* Quỹ Thiên tai */}
              <div style={{ 
                border: '1.5px solid #d1fae5', 
                backgroundColor: '#f0fdf4',
                borderRadius: '12px', 
                padding: '12px 14px', 
                marginBottom: '16px' 
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  1. Quỹ phòng chống thiên tai (PCTT)
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Mức phải đóng (đ)
                    </label>
                    <input 
                      type="text"
                      value={pcttExpected}
                      onChange={(e) => setPcttExpected(formatInputNumber(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #a7f3d0',
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
                      value={pcttActual}
                      onChange={(e) => setPcttActual(formatInputNumber(e.target.value))}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #a7f3d0',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        color: '#065f46'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Ngày nộp
                    </label>
                    <input 
                      type="date"
                      value={pcttDate}
                      onChange={(e) => setPcttDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1.5px solid #a7f3d0',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quỹ Đền ơn đáp nghĩa */}
              <div style={{ 
                border: '1.5px solid #fef3c7', 
                backgroundColor: '#fffdf5',
                borderRadius: '12px', 
                padding: '12px 14px', 
                marginBottom: '16px' 
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#78350f', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  2. Quỹ đền ơn đáp nghĩa (ĐOĐN)
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Mức phải đóng (đ)
                    </label>
                    <input 
                      type="text"
                      value={dodnExpected}
                      onChange={(e) => setDodnExpected(formatInputNumber(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #fde047',
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
                      value={dodnActual}
                      onChange={(e) => setDodnActual(formatInputNumber(e.target.value))}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #fde047',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        color: '#78350f'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Ngày nộp
                    </label>
                    <input 
                      type="date"
                      value={dodnDate}
                      onChange={(e) => setDodnDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1.5px solid #fde047',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Note / Chú thích */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Ghi chú đóng góp
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú (Ví dụ: Miễn nộp do gia đình chính sách, hoặc người lao động đi làm xa...)"
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
