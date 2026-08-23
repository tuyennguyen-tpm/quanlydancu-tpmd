import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { 
  HeartHandshake, 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Printer, 
  FileDown, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Calendar, 
  Phone, 
  MapPin, 
  Users, 
  Award,
  Filter,
  Calculator
} from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import { formatDateVN } from '../utils/dateUtils';
import { Calculator3DModal } from '../components/Calculator3DModal';
import type { SponsorRecord } from '../types';
import ExcelJS from 'exceljs';

const Sponsors = () => {
  const currentYear = new Date().getFullYear();
  const [records, setRecords] = useState<SponsorRecord[]>([]);
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDeferredValue(searchInput);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SponsorRecord | null>(null);
  const [printReceiptRecord, setPrintReceiptRecord] = useState<SponsorRecord | null>(null);
  const [show3DCalculator, setShow3DCalculator] = useState(false);

  // Form states
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [fullName, setFullName] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Mạnh thường quân ủng hộ');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [recordedBy, setRecordedBy] = useState('');

  const currentRole = localStorage.getItem('current_role') || '';
  const userRole = localStorage.getItem('user_role') || '';
  const isGuest = localStorage.getItem('guest_mode') === 'true';

  // Chỉ Thủ quỹ, Tổ trưởng dân phố, Admin mới có quyền thêm/sửa/xóa
  const ALLOWED_ROLES = ['thu_quy', 'to_truong', 'admin', 'super_admin', 'ward_admin'];
  const canEdit = !isGuest && (
    ALLOWED_ROLES.includes(currentRole) ||
    ALLOWED_ROLES.includes(userRole)
  );

  const officialsConfig = useMemo(() => {
    const tdpName = localStorage.getItem('tdp_name') || localStorage.getItem('unit_name') || 'TỔ DÂN PHỐ QUẢNG GIAO';
    const wardName = localStorage.getItem('ward_name') || 'Phường Quảng Giao';
    const leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';

    let sigs: any[] = [];
    try {
      sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
    } catch { sigs = []; }

    const getOfficial = (id: string, defaultName = '', defaultTitle = '') => {
      const found = sigs.find((s: any) => s.id === id);
      return {
        name: found?.name?.trim() || defaultName,
        title: found?.title?.trim() || defaultTitle,
        signatureUrl: found?.signatureUrl?.trim() || ''
      };
    };

    return {
      tdpName,
      wardName,
      toTruong: getOfficial('to_truong', leaderName, 'Tổ trưởng dân phố'),
      thuQuy: getOfficial('thu_quy', '', 'Thủ quỹ'),
      keToan: getOfficial('ke_toan', '', 'Kế toán trưởng')
    };
  }, []);

  const loadData = async () => {
    try {
      const list = await db.getSponsorRecords();
      // Nếu hoàn toàn chưa có bản ghi nào, có thể tự động tạo mẫu ban đầu 2.000.000đ ủng hộ
      if (list.length === 0) {
        const initialSample: SponsorRecord = {
          id: 's_init_001',
          type: 'income',
          full_name: 'Mạnh thường quân / Nhà hảo tâm',
          amount: 2000000,
          address: 'Tổ dân phố Quảng Giao',
          phone: '',
          category: 'Mạnh thường quân ủng hộ',
          date: new Date().toISOString().split('T')[0],
          note: 'Ủng hộ các hoạt động phong trào của tổ dân phố',
          recorded_by: officialsConfig.toTruong.name || 'Ban điều hành TDP',
          created_at: new Date().toISOString()
        };
        await db.saveSponsorRecord(initialSample);
        setRecords([initialSample]);
      } else {
        setRecords(list);
      }
    } catch (e) {
      console.error('Lỗi tải dữ liệu Quỹ Người dân & Mạnh thường quân:', e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-changed', loadData);
    return () => window.removeEventListener('db-changed', loadData);
  }, []);

  const formatCurrency = (amt: number) => {
    if (amt === undefined || amt === null || isNaN(amt)) return '0';
    return new Intl.NumberFormat('vi-VN').format(amt);
  };

  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(clean, 10));
  };

  // Calculations
  const totalIncome = useMemo(() => {
    return records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  }, [records]);

  const totalExpense = useMemo(() => {
    return records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  }, [records]);

  const balance = totalIncome - totalExpense;

  const totalDonorsCount = useMemo(() => {
    return records.filter(r => r.type === 'income').length;
  }, [records]);

  // Categories list
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.category && r.category.trim()) set.add(r.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchType = activeType === 'all' || r.type === activeType;
      const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        r.full_name.toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.note || '').toLowerCase().includes(q) ||
        (r.recorded_by || '').toLowerCase().includes(q);

      return matchType && matchCat && matchSearch;
    });
  }, [records, activeType, categoryFilter, searchTerm]);

  const handleOpenForm = (record?: SponsorRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormType(record.type);
      setFullName(record.full_name);
      setAmount(formatCurrency(record.amount));
      setAddress(record.address || '');
      setPhone(record.phone || '');
      setCategory(record.category);
      setDate(record.date || new Date().toISOString().split('T')[0]);
      setNote(record.note || '');
      setRecordedBy(record.recorded_by || '');
    } else {
      setEditingRecord(null);
      setFormType('income');
      setFullName('');
      setAmount('');
      setAddress('');
      setPhone('');
      setCategory('Mạnh thường quân ủng hộ');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setRecordedBy(officialsConfig.toTruong.name || '');
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('Bạn không có quyền thực hiện thao tác này! Chỉ Thủ quỹ, Tổ trưởng hoặc Admin mới được phép.', 'warning');
      return;
    }
    const cleanAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!fullName.trim()) {
      showToast('Vui lòng nhập họ tên người ủng hộ / đơn vị!', 'warning');
      return;
    }
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ lớn hơn 0!', 'warning');
      return;
    }

    try {
      const payload: Omit<SponsorRecord, 'id' | 'created_at'> & { id?: string } = {
        id: editingRecord ? editingRecord.id : undefined,
        type: formType,
        full_name: fullName.trim(),
        amount: cleanAmount,
        address: address.trim(),
        phone: phone.trim(),
        category: category.trim() || (formType === 'income' ? 'Ủng hộ / Tài trợ' : 'Chi hoạt động'),
        date,
        note: note.trim(),
        recorded_by: recordedBy.trim() || officialsConfig.toTruong.name || 'Người tiếp nhận'
      };

      await db.saveSponsorRecord(payload);
      showToast(editingRecord ? 'Cập nhật bản ghi thành công!' : 'Thêm mới khoản ủng hộ/chi thành công!', 'success');
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi khi lưu dữ liệu: ' + (err.message || err), 'danger');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canEdit) {
      showToast('Bạn không có quyền xóa! Chỉ Thủ quỹ, Tổ trưởng hoặc Admin mới được phép.', 'warning');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa bản ghi của "${name}" không?`)) {
      try {
        await db.deleteSponsorRecord(id);
        showToast('Đã xóa bản ghi thành công!', 'success');
        loadData();
      } catch (err: any) {
        showToast('Lỗi khi xóa: ' + err.message, 'danger');
      }
    }
  };

  // In Thư Cảm Ơn / Giấy Tri Ân / Phiếu Tiếp Nhận
  const handlePrintCertificate = (rec: SponsorRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Vui lòng cho phép popup để in thư cảm ơn!', 'danger');
      return;
    }

    const tdpName = officialsConfig.tdpName;
    const wardName = officialsConfig.wardName;
    const leaderName = officialsConfig.toTruong.name;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>THƯ CẢM ƠN & TRI ÂN - ${rec.full_name}</title>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { 
            font-family: "Times New Roman", Times, serif; 
            margin: 0; 
            padding: 20px; 
            color: #1e293b;
            background: #fff;
          }
          .border-box {
            border: 4px double #b45309;
            padding: 30px 25px;
            border-radius: 8px;
            position: relative;
            background: #fffdfa;
          }
          .header {
            display: flex;
            justify-content: space-between;
            text-align: center;
            margin-bottom: 25px;
          }
          .header-left {
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .header-right {
            font-size: 12.5pt;
            font-weight: bold;
          }
          .motto {
            font-style: italic;
            font-weight: normal;
            font-size: 12pt;
          }
          .main-title {
            text-align: center;
            color: #b45309;
            font-size: 24pt;
            font-weight: bold;
            margin: 20px 0 5px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .sub-title {
            text-align: center;
            font-size: 15pt;
            font-style: italic;
            color: #475569;
            margin-bottom: 25px;
          }
          .content {
            font-size: 14pt;
            line-height: 1.8;
            text-align: justify;
            margin-bottom: 30px;
          }
          .recipient-name {
            font-size: 18pt;
            font-weight: bold;
            color: #0f172a;
            text-align: center;
            margin: 15px 0;
            text-transform: uppercase;
          }
          .highlight-amount {
            font-size: 16pt;
            font-weight: bold;
            color: #15803d;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            text-align: center;
          }
          .sig-box {
            width: 45%;
          }
          .sig-title {
            font-weight: bold;
            font-size: 13pt;
            margin-bottom: 70px;
          }
          .sig-name {
            font-weight: bold;
            font-size: 14pt;
            text-transform: uppercase;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="border-box">
          <div class="header">
            <div class="header-left">
              <div>${wardName}</div>
              <div style="color: #b45309;">${tdpName}</div>
            </div>
            <div class="header-right">
              <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
              <div style="margin-top: 5px; font-weight: normal; font-size: 11pt;">-----------------</div>
            </div>
          </div>

          <div class="main-title">THƯ CẢM ƠN & TRI ÂN</div>
          <div class="sub-title">Ghi nhận tấm lòng vàng của Mạnh thường quân / Nhân dân</div>

          <div class="content">
            <p><strong>Kính gửi:</strong></p>
            <div class="recipient-name">💐 ${rec.full_name} 💐</div>
            ${rec.address ? `<p style="text-align: center; margin-top: -5px; color: #475569;"><em>Địa chỉ: ${rec.address}</em></p>` : ''}
            
            <p style="text-indent: 30px;">
              Ban Cán sự và toàn thể Nhân dân <strong>${tdpName}</strong> xin trân trọng gửi tới Ông/Bà (Đơn vị) lời chào trân trọng, lời kính chúc sức khỏe, hạnh phúc và thành đạt!
            </p>
            <p style="text-indent: 30px;">
              Chúng tôi vô cùng cảm kích và trân trọng ghi nhận sự đóng góp, ủng hộ quý báu của Ông/Bà (Đơn vị) cho <strong>"${rec.category}"</strong> với số tiền là:
            </p>
            <div style="text-align: center; margin: 15px 0; background: #f0fdf4; padding: 12px; border: 1px dashed #86efac; border-radius: 8px;">
              <span class="highlight-amount">${formatCurrency(rec.amount)} VNĐ</span>
            </div>
            ${rec.note ? `<p style="text-indent: 30px; font-style: italic;"><strong>Nội dung:</strong> ${rec.note}</p>` : ''}
            <p style="text-indent: 30px;">
              Nguồn kinh phí ủng hộ của Quý vị là nguồn động viên to lớn, góp phần cùng chính quyền địa phương xây dựng Tổ dân phố ngày càng đoàn kết, giàu đẹp, văn minh và ấm no.
            </p>
            <p style="text-indent: 30px;">
              Một lần nữa, xin chân thành cảm ơn và kính chúc Quý vị cùng gia đình luôn dồi dào sức khỏe, an khang và thịnh vượng!
            </p>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div style="font-style: italic; font-size: 12pt; margin-bottom: 5px;">${wardName}, ${formatDateVN(rec.date)}</div>
              <div class="sig-title">NGƯỜI TIẾP NHẬN</div>
              <div class="sig-name">${rec.recorded_by || 'Cán bộ TDP'}</div>
            </div>
            <div class="sig-box">
              <div style="font-style: italic; font-size: 12pt; margin-bottom: 5px;">${wardName}, ${formatDateVN(rec.date)}</div>
              <div class="sig-title">TM. BAN CÁN SỰ TỔ DÂN PHỐ<br/>TỔ TRƯỞNG</div>
              <div class="sig-name">${leaderName}</div>
            </div>
          </div>
        </div>

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

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // In Sổ Quỹ / Báo Cáo Thu Chi Mạnh Thường Quân
  const handlePrintSponsorReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Vui lòng cho phép popup để in báo cáo!', 'danger');
      return;
    }

    const tdpName = officialsConfig.tdpName;
    const wardName = officialsConfig.wardName;
    const leaderName = officialsConfig.toTruong.name;
    const keToanName = officialsConfig.keToan.name;
    const thuQuyName = officialsConfig.thuQuy.name;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SỔ THU CHI QUỸ NGƯỜI DÂN & MẠNH THƯỜNG QUÂN - ${tdpName}</title>
        <meta charset="utf-8">
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: "Times New Roman", Times, serif; padding: 15px; color: #000; font-size: 11pt; }
          .header { display: flex; justify-content: space-between; text-align: center; margin-bottom: 20px; }
          .title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; color: #b45309; }
          .subtitle { text-align: center; font-style: italic; margin-bottom: 20px; }
          .stats-grid { display: flex; justify-content: space-around; margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
          .stat-item { text-align: center; }
          .stat-value { font-weight: bold; font-size: 13pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; }
          th { background-color: #f8fafc; text-align: center; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; text-align: center; }
          .sig-box { width: 30%; }
          .sig-title { font-weight: bold; margin-bottom: 50px; }
          .sig-name { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div>${wardName.toUpperCase()}</div>
            <div style="font-weight: bold;">${tdpName.toUpperCase()}</div>
          </div>
          <div>
            <div style="font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style="font-style: italic;">Độc lập - Tự do - Hạnh phúc</div>
          </div>
        </div>

        <div class="title">BÁO CÁO THU CHI QUỸ NGƯỜI DÂN & MẠNH THƯỜNG QUÂN</div>
        <div class="subtitle">Tính đến ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>

        <div class="stats-grid">
          <div class="stat-item">
            <div>Tổng thu ủng hộ</div>
            <div class="stat-value" style="color: #16a34a;">${formatCurrency(totalIncome)} đ</div>
          </div>
          <div class="stat-item">
            <div>Tổng chi từ quỹ</div>
            <div class="stat-value" style="color: #dc2626;">${formatCurrency(totalExpense)} đ</div>
          </div>
          <div class="stat-item">
            <div>Số dư quỹ hiện tại</div>
            <div class="stat-value" style="color: #2563eb;">${formatCurrency(balance)} đ</div>
          </div>
          <div class="stat-item">
            <div>Tổng lượt ủng hộ</div>
            <div class="stat-value" style="color: #b45309;">${totalDonorsCount} lượt</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">STT</th>
              <th style="width: 10%;">Ngày</th>
              <th style="width: 8%;">Loại</th>
              <th style="width: 18%;">Họ và tên</th>
              <th style="width: 18%;">Địa chỉ / SĐT</th>
              <th style="width: 15%;">Danh mục</th>
              <th>Nội dung / Ghi chú</th>
              <th style="width: 12%;">Số tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.map((r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="text-center">${formatDateVN(r.date)}</td>
                <td class="text-center" style="font-weight: 600; color: ${r.type === 'income' ? '#16a34a' : '#dc2626'}">
                  ${r.type === 'income' ? 'Thu ủng hộ' : 'Chi từ quỹ'}
                </td>
                <td style="font-weight: 600;">${r.full_name}</td>
                <td>${[r.address, r.phone].filter(Boolean).join(' - ')}</td>
                <td>${r.category}</td>
                <td>${r.note || '-'}</td>
                <td class="text-right" style="font-weight: bold; color: ${r.type === 'income' ? '#16a34a' : '#dc2626'}">
                  ${formatCurrency(r.amount)} đ
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">NGƯỜI LẬP BIỂU</div>
            <div class="sig-name">${keToanName || 'Kế toán'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">THỦ QUỸ</div>
            <div class="sig-name">${thuQuyName || 'Thủ quỹ'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">TỔ TRƯỞNG DÂN PHỐ</div>
            <div class="sig-name">${leaderName}</div>
          </div>
        </div>

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

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Xuất Excel Bảng Vàng Danh Dự / Danh Sách Ủng Hộ Chuẩn Chuyên Nghiệp & Đẹp Mắt
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Hệ thống Quản lý Dân cư TDP';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Bang_Vang_Ung_Ho', {
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.5,
            right: 0.5,
            top: 0.6,
            bottom: 0.6,
            header: 0.3,
            footer: 0.3
          }
        },
        views: [{ showGridLines: true }]
      });

      const tdpName = officialsConfig.tdpName;
      const wardName = officialsConfig.wardName;
      const leaderName = officialsConfig.toTruong.name;
      const keToanName = officialsConfig.keToan.name;
      const thuQuyName = officialsConfig.thuQuy.name;

      // 1. Header (Cơ quan & Quốc hiệu)
      worksheet.mergeCells('A1:D1');
      worksheet.getCell('A1').value = wardName.toUpperCase();
      worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11, bold: false };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:D2');
      worksheet.getCell('A2').value = tdpName.toUpperCase();
      worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: '9A3412' } };
      worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('F1:J1');
      worksheet.getCell('F1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      worksheet.getCell('F1').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('F2:J2');
      worksheet.getCell('F2').value = 'Độc lập - Tự do - Hạnh phúc';
      worksheet.getCell('F2').font = { name: 'Times New Roman', size: 11, italic: true, bold: true };
      worksheet.getCell('F2').alignment = { horizontal: 'center', vertical: 'middle' };

      // 2. Main Title
      worksheet.mergeCells('A4:J4');
      worksheet.getCell('A4').value = 'BẢNG VÀNG TRI ÂN & DANH SÁCH ỦNG HỘ QUỸ MẠNH THƯỜNG QUÂN / NHÂN DÂN';
      worksheet.getCell('A4').font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: '9A3412' } };
      worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(4).height = 28;

      worksheet.mergeCells('A5:J5');
      worksheet.getCell('A5').value = `(Thời điểm lập biểu: Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()} - Đơn vị tính: Đồng Việt Nam)`;
      worksheet.getCell('A5').font = { name: 'Times New Roman', size: 10.5, italic: true, color: { argb: '475569' } };
      worksheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(5).height = 20;

      // 3. KPI Summary Box
      // Thu
      worksheet.mergeCells('B7:C7');
      worksheet.getCell('B7').value = 'TỔNG THU ỦNG HỘ';
      worksheet.getCell('B7').font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '166534' } };
      worksheet.getCell('B7').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('B7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };

      worksheet.mergeCells('B8:C8');
      worksheet.getCell('B8').value = totalIncome;
      worksheet.getCell('B8').numFmt = '#,##0 "đ"';
      worksheet.getCell('B8').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: '15803D' } };
      worksheet.getCell('B8').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };

      // Chi
      worksheet.mergeCells('E7:F7');
      worksheet.getCell('E7').value = 'TỔNG CHI TỪ QUỸ';
      worksheet.getCell('E7').font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '991B1B' } };
      worksheet.getCell('E7').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('E7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };

      worksheet.mergeCells('E8:F8');
      worksheet.getCell('E8').value = totalExpense;
      worksheet.getCell('E8').numFmt = '#,##0 "đ"';
      worksheet.getCell('E8').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'DC2626' } };
      worksheet.getCell('E8').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF2F2' } };

      // Tồn quỹ
      worksheet.mergeCells('H7:I7');
      worksheet.getCell('H7').value = 'TỒN QUỸ HIỆN TẠI';
      worksheet.getCell('H7').font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: '1E40AF' } };
      worksheet.getCell('H7').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('H7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

      worksheet.mergeCells('H8:I8');
      worksheet.getCell('H8').value = balance;
      worksheet.getCell('H8').numFmt = '#,##0 "đ"';
      worksheet.getCell('H8').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: '2563EB' } };
      worksheet.getCell('H8').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('H8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      ['B7', 'C7', 'B8', 'C8', 'E7', 'F7', 'E8', 'F8', 'H7', 'I7', 'H8', 'I8'].forEach(cellRef => {
        worksheet.getCell(cellRef).border = thinBorder;
      });

      // 4. Data Table Header (Row 10)
      const headerRowIndex = 10;
      const headers = [
        'STT',
        'Ngày',
        'Phân loại',
        'Họ và tên Nhà hảo tâm / Đơn vị',
        'Địa chỉ nơi cư trú',
        'Số điện thoại',
        'Danh mục / Mục đích',
        'Số tiền (VNĐ)',
        'Ghi chú / Nội dung chi tiết',
        'Người tiếp nhận'
      ];

      const headerRow = worksheet.getRow(headerRowIndex);
      headers.forEach((title, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = title;
        cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B45309' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: '78350F' } },
          left: { style: 'thin', color: { argb: 'D97706' } },
          bottom: { style: 'medium', color: { argb: '78350F' } },
          right: { style: 'thin', color: { argb: 'D97706' } }
        };
      });
      headerRow.height = 30;

      // 5. Data Rows
      let currentRowIndex = headerRowIndex + 1;
      filteredRecords.forEach((r, idx) => {
        const row = worksheet.getRow(currentRowIndex);
        const isIncome = r.type === 'income';
        const isZebra = idx % 2 === 1;
        const rowBgColor = isZebra ? 'FFFDF7' : 'FFFFFF';

        row.getCell(1).value = idx + 1;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(2).value = formatDateVN(r.date);
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(3).value = isIncome ? 'Thu ủng hộ' : 'Chi từ quỹ';
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: isIncome ? '166534' : '991B1B' } };

        row.getCell(4).value = r.full_name;
        row.getCell(4).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: '0F172A' } };
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

        row.getCell(5).value = r.address || '—';
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

        row.getCell(6).value = r.phone || '—';
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(7).value = r.category;
        row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };

        row.getCell(8).value = r.amount;
        row.getCell(8).numFmt = '#,##0 "đ"';
        row.getCell(8).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: isIncome ? '15803D' : 'DC2626' } };
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

        row.getCell(9).value = r.note || '—';
        row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        row.getCell(10).value = r.recorded_by || '—';
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };

        // Apply borders and zebra background
        for (let col = 1; col <= 10; col++) {
          const cell = row.getCell(col);
          cell.border = thinBorder;
          if (!cell.font) cell.font = { name: 'Times New Roman', size: 10.5 };
          if (col !== 3 && col !== 8) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          }
        }
        row.height = 24;
        currentRowIndex++;
      });

      // 6. Summary Row (Dòng Tổng Kết)
      const summaryRow = worksheet.getRow(currentRowIndex);
      worksheet.mergeCells(`A${currentRowIndex}:G${currentRowIndex}`);
      const sumLabelCell = summaryRow.getCell(1);
      sumLabelCell.value = `TỔNG CỘNG (${filteredRecords.length} BẢN GHI)`;
      sumLabelCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: '78350F' } };
      sumLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const sumAmountCell = summaryRow.getCell(8);
      const filteredSum = filteredRecords.reduce((s, r) => s + (r.type === 'income' ? r.amount : -r.amount), 0);
      sumAmountCell.value = filteredSum;
      sumAmountCell.numFmt = '#,##0 "đ"';
      sumAmountCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: filteredSum >= 0 ? '15803D' : 'DC2626' } };
      sumAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };

      worksheet.mergeCells(`I${currentRowIndex}:J${currentRowIndex}`);

      for (let col = 1; col <= 10; col++) {
        const cell = summaryRow.getCell(col);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'B45309' } },
          bottom: { style: 'double', color: { argb: 'B45309' } },
          left: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } }
        };
      }
      summaryRow.height = 28;
      currentRowIndex += 2;

      // 7. Signature Block
      const sigRow1 = worksheet.getRow(currentRowIndex);
      worksheet.mergeCells(`H${currentRowIndex}:J${currentRowIndex}`);
      worksheet.getCell(`H${currentRowIndex}`).value = `${wardName}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;
      worksheet.getCell(`H${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, italic: true };
      worksheet.getCell(`H${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };
      currentRowIndex++;

      const sigRow2 = worksheet.getRow(currentRowIndex);
      worksheet.mergeCells(`A${currentRowIndex}:C${currentRowIndex}`);
      worksheet.getCell(`A${currentRowIndex}`).value = 'NGƯỜI LẬP BIỂU';
      worksheet.getCell(`A${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`A${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`D${currentRowIndex}:F${currentRowIndex}`);
      worksheet.getCell(`D${currentRowIndex}`).value = 'THỦ QUỸ';
      worksheet.getCell(`D${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`D${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`H${currentRowIndex}:J${currentRowIndex}`);
      worksheet.getCell(`H${currentRowIndex}`).value = 'TM. BAN CÁN SỰ TỔ DÂN PHỐ\nTỔ TRƯỞNG';
      worksheet.getCell(`H${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`H${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      sigRow2.height = 28;

      currentRowIndex += 4; // Khoảng trống ký tên

      const sigRow3 = worksheet.getRow(currentRowIndex);
      worksheet.mergeCells(`A${currentRowIndex}:C${currentRowIndex}`);
      worksheet.getCell(`A${currentRowIndex}`).value = (keToanName || 'Kế toán').toUpperCase();
      worksheet.getCell(`A${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`A${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`D${currentRowIndex}:F${currentRowIndex}`);
      worksheet.getCell(`D${currentRowIndex}`).value = (thuQuyName || 'Thủ quỹ').toUpperCase();
      worksheet.getCell(`D${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`D${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`H${currentRowIndex}:J${currentRowIndex}`);
      worksheet.getCell(`H${currentRowIndex}`).value = (leaderName || 'Tổ trưởng').toUpperCase();
      worksheet.getCell(`H${currentRowIndex}`).font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell(`H${currentRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

      // Set Column Widths
      worksheet.getColumn(1).width = 7;   // STT
      worksheet.getColumn(2).width = 14;  // Ngày
      worksheet.getColumn(3).width = 15;  // Loại
      worksheet.getColumn(4).width = 28;  // Họ tên
      worksheet.getColumn(5).width = 30;  // Địa chỉ
      worksheet.getColumn(6).width = 16;  // SĐT
      worksheet.getColumn(7).width = 24;  // Danh mục
      worksheet.getColumn(8).width = 20;  // Số tiền
      worksheet.getColumn(9).width = 32;  // Ghi chú
      worksheet.getColumn(10).width = 20; // Người tiếp nhận

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bang_Vang_Ung_Ho_Manh_Thuong_Quan_${tdpName.replace(/\s+/g, '_')}_${currentYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Xuất Bảng Vàng Excel thành công!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi khi xuất Excel: ' + err.message, 'danger');
    }
  };

  return (
    <div className="page-container">
      {show3DCalculator && (
        <Calculator3DModal isOpen={show3DCalculator} onClose={() => setShow3DCalculator(false)} />
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b45309' }}>
            <HeartHandshake className="text-amber-600" size={32} />
            Người dân / Mạnh thường quân
            {!canEdit && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: '600',
                padding: '3px 10px',
                borderRadius: '20px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                letterSpacing: '0.5px'
              }}>
                🔒 Chỉ xem
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            Quản lý riêng biệt nguồn tài trợ, ủng hộ tự nguyện của nhân dân &amp; các nhà hảo tâm cùng các khoản chi từ quỹ
            {!canEdit && <span style={{ color: '#b45309', fontStyle: 'italic' }}> — Chỉ Thủ quỹ, Tổ trưởng, Admin mới có quyền thêm/sửa/xóa.</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => setShow3DCalculator(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', borderColor: '#cbd5e1' }}
          >
            <Calculator size={18} className="text-amber-600" />
            Máy tính 3D
          </button>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff' }}
          >
            <FileDown size={18} />
            Xuất Excel
          </button>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={handlePrintSponsorReport}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff' }}
          >
            <Printer size={18} />
            In sổ quỹ ủng hộ
          </button>
          {canEdit && (
            <>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => { setFormType('income'); handleOpenForm(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              >
                <Plus size={18} />
                💚 Thu Ủng hộ
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => { setFormType('expense'); handleOpenForm(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              >
                <Plus size={18} />
                ❤️ Chi từ Quỹ
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Tổng thu */}
        <div className="card" style={{ padding: '20px', borderLeft: '5px solid #16a34a', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#166534', textTransform: 'uppercase' }}>Tổng thu ủng hộ</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#15803d', margin: '8px 0 4px 0' }}>
                {formatCurrency(totalIncome)} đ
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>Đóng góp từ {totalDonorsCount} lượt ủng hộ</span>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
              <TrendingUp size={26} />
            </div>
          </div>
        </div>

        {/* Tổng chi */}
        <div className="card" style={{ padding: '20px', borderLeft: '5px solid #dc2626', background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#991b1b', textTransform: 'uppercase' }}>Tổng chi từ quỹ</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#dc2626', margin: '8px 0 4px 0' }}>
                {formatCurrency(totalExpense)} đ
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Các khoản chi vì cộng đồng</span>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <TrendingDown size={26} />
            </div>
          </div>
        </div>

        {/* Tồn quỹ */}
        <div className="card" style={{ padding: '20px', borderLeft: '5px solid #2563eb', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e40af', textTransform: 'uppercase' }}>Số dư quỹ ủng hộ</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: balance >= 0 ? '#2563eb' : '#dc2626', margin: '8px 0 4px 0' }}>
                {formatCurrency(balance)} đ
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#2563eb' }}>Kinh phí sẵn sàng sử dụng</span>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#2563eb' }}>
              <DollarSign size={26} />
            </div>
          </div>
        </div>

        {/* Nhà hảo tâm tiêu biểu */}
        <div className="card" style={{ padding: '20px', borderLeft: '5px solid #b45309', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#92400e', textTransform: 'uppercase' }}>Bảng vàng tri ân</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#b45309', margin: '8px 0 4px 0' }}>
                {totalDonorsCount} Nhà hảo tâm
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#b45309' }}>Chung tay vì Tổ dân phố</span>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#b45309' }}>
              <Award size={26} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="content-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <div className="filter-tabs" style={{ display: 'flex', gap: '6px' }}>
          <button 
            type="button" 
            className={`tab ${activeType === 'all' ? 'active' : ''}`} 
            onClick={() => setActiveType('all')}
          >
            Tất cả ({records.length})
          </button>
          <button 
            type="button" 
            className={`tab ${activeType === 'income' ? 'active' : ''}`} 
            onClick={() => setActiveType('income')}
            style={{ color: activeType === 'income' ? '#fff' : '#15803d', backgroundColor: activeType === 'income' ? '#16a34a' : undefined }}
          >
            💚 Thu ủng hộ ({records.filter(r => r.type === 'income').length})
          </button>
          <button 
            type="button" 
            className={`tab ${activeType === 'expense' ? 'active' : ''}`} 
            onClick={() => setActiveType('expense')}
            style={{ color: activeType === 'expense' ? '#fff' : '#dc2626', backgroundColor: activeType === 'expense' ? '#dc2626' : undefined }}
          >
            ❤️ Chi từ quỹ ({records.filter(r => r.type === 'expense').length})
          </button>
        </div>

        {/* Danh mục */}
        {categoryOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Danh mục:</span>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', fontWeight: '500' }}
            >
              <option value="all">Tất cả danh mục</option>
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo họ tên, địa chỉ, số điện thoại, ghi chú..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              outline: 'none',
              fontSize: '0.9rem'
            }}
          />
          {searchInput && (
            <button 
              type="button" 
              onClick={() => setSearchInput('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 14px', width: '50px', textAlign: 'center' }}>STT</th>
                <th style={{ padding: '12px 14px', width: '110px' }}>Ngày</th>
                <th style={{ padding: '12px 14px', width: '100px', textAlign: 'center' }}>Loại</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Họ và tên / Đơn vị</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Địa chỉ & SĐT</th>
                <th style={{ padding: '12px 14px', minWidth: '160px' }}>Danh mục</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '130px' }}>Số tiền (VNĐ)</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Ghi chú / Chi tiết</th>
                <th style={{ padding: '12px 14px', width: '140px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <HeartHandshake size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Chưa có bản ghi nào phù hợp với bộ lọc tìm kiếm.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.88rem' }}>{formatDateVN(r.date)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        backgroundColor: r.type === 'income' ? '#dcfce7' : '#fee2e2',
                        color: r.type === 'income' ? '#15803d' : '#dc2626'
                      }}>
                        {r.type === 'income' ? 'Thu ủng hộ' : 'Chi quỹ'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{r.full_name}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>
                      {r.address && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}><MapPin size={13} /> {r.address}</div>}
                      {r.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', marginTop: '2px' }}><Phone size={13} /> {r.phone}</div>}
                      {!r.address && !r.phone && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        fontWeight: '500'
                      }}>
                        {r.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', fontSize: '0.95rem', color: r.type === 'income' ? '#16a34a' : '#dc2626' }}>
                      {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)} đ
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#475569' }}>
                      {r.note || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {r.type === 'income' && (
                          <button 
                            type="button" 
                            className="btn btn-icon" 
                            title="In Thư cảm ơn & Tri ân"
                            onClick={() => handlePrintCertificate(r)}
                            style={{ color: '#b45309', padding: '6px' }}
                          >
                            <Award size={16} />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button 
                              type="button" 
                              className="btn btn-icon" 
                              title="Sửa bản ghi"
                              onClick={() => handleOpenForm(r)}
                              style={{ padding: '6px' }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-icon text-danger" 
                              title="Xóa bản ghi"
                              onClick={() => handleDelete(r.id, r.full_name)}
                              style={{ padding: '6px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Sửa Bản Ghi */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', margin: 0 }}>
                <HeartHandshake size={24} />
                {editingRecord ? 'Cập nhật bản ghi ủng hộ / chi' : 'Ghi nhận Ủng hộ / Chi từ Quỹ'}
              </h3>
              <button type="button" className="btn-close" onClick={() => setIsFormOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Loại giao dịch */}
                <div className="form-group">
                  <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Loại giao dịch *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: formType === 'income' ? '2px solid #16a34a' : '1px solid var(--border)',
                      backgroundColor: formType === 'income' ? '#f0fdf4' : '#fff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      color: formType === 'income' ? '#15803d' : 'var(--text-muted)'
                    }}>
                      <input 
                        type="radio" 
                        name="sponsor_type" 
                        checked={formType === 'income'} 
                        onChange={() => setFormType('income')} 
                        style={{ accentColor: '#16a34a' }}
                      />
                      💚 Thu Ủng hộ / Tài trợ
                    </label>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: formType === 'expense' ? '2px solid #dc2626' : '1px solid var(--border)',
                      backgroundColor: formType === 'expense' ? '#fef2f2' : '#fff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      color: formType === 'expense' ? '#dc2626' : 'var(--text-muted)'
                    }}>
                      <input 
                        type="radio" 
                        name="sponsor_type" 
                        checked={formType === 'expense'} 
                        onChange={() => setFormType('expense')} 
                        style={{ accentColor: '#dc2626' }}
                      />
                      ❤️ Chi từ nguồn quỹ
                    </label>
                  </div>
                </div>

                {/* Họ tên */}
                <div className="form-group">
                  <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                    {formType === 'income' ? 'Họ và tên Người ủng hộ / Nhà hảo tâm / Đơn vị *' : 'Người nhận / Đơn vị tiếp nhận chi *'}
                  </label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={formType === 'income' ? 'Ví dụ: Ông Nguyễn Văn A, Công ty TNHH Ánh Dương...' : 'Ví dụ: Hộ bà Trần Thị B (khó khăn), Đội sửa chữa...'}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Số tiền & Ngày */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Số tiền (VNĐ) *</label>
                    <input 
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(formatInputNumber(e.target.value))}
                      placeholder="Ví dụ: 2.000.000"
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 'bold', color: formType === 'income' ? '#15803d' : '#dc2626' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Ngày thực hiện *</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                {/* Địa chỉ & Số điện thoại */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Địa chỉ</label>
                    <input 
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ví dụ: Số 45, TDP Quảng Giao..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Số điện thoại</label>
                    <input 
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ví dụ: 0912345678"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                {/* Danh mục & Gợi ý nhanh — Combobox tự gõ */}
                <div className="form-group">
                  <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Danh mục / Mục đích *</label>
                  <input 
                    type="text"
                    list="category-suggestions"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={formType === 'income' ? 'Ví dụ: Ủng hộ hội trại, Hội làng, Mạnh thường quân ủng hộ...' : 'Ví dụ: Chi thăm hỏi khó khăn, Chi mua sắm...'}
                    required
                    autoComplete="off"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                  {/* datalist gợi ý — người dùng vẫn có thể gõ bất kỳ nội dung nào */}
                  <datalist id="category-suggestions">
                    {formType === 'income' ? (
                      <>
                        <option value="Mạnh thường quân ủng hộ" />
                        <option value="Ủng hộ hội trại" />
                        <option value="Ủng hộ hội làng" />
                        <option value="Ủng hộ Lễ hội / Văn hóa" />
                        <option value="Ủng hộ Quỹ Khuyến học" />
                        <option value="Ủng hộ Tết vì người nghèo" />
                        <option value="Đóng góp xây dựng TDP" />
                        <option value="Ủng hộ xây dựng nông thôn mới" />
                        <option value="Tài trợ hoạt động thể thao" />
                        <option value="Ủng hộ Quỹ Phòng chống thiên tai" />
                        {categoryOptions.map(c => <option key={c} value={c} />)}
                      </>
                    ) : (
                      <>
                        <option value="Chi quà tặng / Thăm hỏi khó khăn" />
                        <option value="Chi khen thưởng học sinh giỏi" />
                        <option value="Chi mua sắm / Tu sửa nhà văn hóa" />
                        <option value="Chi tổ chức hội trại" />
                        <option value="Chi tổ chức hội làng / Lễ hội" />
                        <option value="Chi thể thao / Văn nghệ" />
                        <option value="Chi hỗ trợ hộ nghèo / đặc biệt khó khăn" />
                        <option value="Chi mua phần quà Tết" />
                        <option value="Chi văn phòng phẩm TDP" />
                        {categoryOptions.map(c => <option key={c} value={c} />)}
                      </>
                    )}
                  </datalist>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>Gợi ý nhanh:</span>
                    {formType === 'income' ? (
                      <>
                        <button type="button" onClick={() => setCategory('Mạnh thường quân ủng hộ')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🎁 Mạnh thường quân</button>
                        <button type="button" onClick={() => setCategory('Ủng hộ hội trại')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>⛺ Hội trại</button>
                        <button type="button" onClick={() => setCategory('Ủng hộ hội làng')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#be123c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🏮 Hội làng</button>
                        <button type="button" onClick={() => setCategory('Ủng hộ Quỹ Khuyến học')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🎓 Khuyến học</button>
                        <button type="button" onClick={() => setCategory('Ủng hộ Tết vì người nghèo')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fef08a', background: '#fefce8', color: '#a16207', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🧧 Tết người nghèo</button>
                        <button type="button" onClick={() => setCategory('Đóng góp xây dựng TDP')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🏗️ Xây dựng TDP</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setCategory('Chi quà tặng / Thăm hỏi khó khăn')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>❤️ Thăm hỏi khó khăn</button>
                        <button type="button" onClick={() => setCategory('Chi tổ chức hội trại')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>⛺ Chi hội trại</button>
                        <button type="button" onClick={() => setCategory('Chi tổ chức hội làng / Lễ hội')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#be123c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🏮 Chi hội làng</button>
                        <button type="button" onClick={() => setCategory('Chi khen thưởng học sinh giỏi')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🎓 Khen thưởng học sinh</button>
                        <button type="button" onClick={() => setCategory('Chi mua sắm / Tu sửa nhà văn hóa')} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #e9d5ff', background: '#faf5ff', color: '#7e22ce', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>🛠️ Tu sửa nhà văn hóa</button>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '5px 0 0 0' }}>💡 Bạn có thể gõ tự do hoặc bấm vào gợi ý bên trên. Danh mục bạn đã dùng sẽ tự lưu vào gợi ý.</p>
                </div>

                {/* Ghi chú */}
                <div className="form-group">
                  <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Ghi chú chi tiết</label>
                  <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú thêm về nội dung đóng góp, lời chúc hoặc hình thức tiếp nhận..."
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', resize: 'vertical' }}
                  />
                </div>

                {/* Người tiếp nhận */}
                <div className="form-group">
                  <label style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Người tiếp nhận / Người lập phiếu</label>
                  <input 
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    placeholder="Tên cán bộ tiếp nhận..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsFormOpen(false)}>
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#b45309', borderColor: '#b45309' }}
                >
                  {editingRecord ? 'Lưu thay đổi' : 'Ghi nhận vào sổ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sponsors;
