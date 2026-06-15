import { useState, useEffect } from 'react';
import { FileText, Printer, RotateCcw, Calendar, User, Clock, MapPin } from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { Meeting } from '../types';

const MeetingMinutes = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  
  // Form/Document fields
  const [tdpName, setTdpName] = useState(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
  const [wardName, setWardName] = useState(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('19:30');
  const [location, setLocation] = useState('Nhà văn hóa Tổ dân phố');
  const [chairman, setChairman] = useState('Nguyễn Kim Tuyến - Tổ trưởng');
  const [secretary, setSecretary] = useState('Lê Thị Dung - Thư ký');
  const [attendance, setAttendance] = useState('85');
  const [content, setContent] = useState('');

  // Helper to get custom default template contents based on meeting type
  const applyDefaultContentCustom = (
    meetingTitle: string,
    rawContent: string,
    mType: string = 'general',
    customChairman?: string,
    customSecretary?: string
  ) => {
    const activeChairman = customChairman || chairman;
    const activeSecretary = customSecretary || secretary;
    
    if (mType === 'party') {
      return `1. Khai mạc sinh hoạt Chi bộ:
- Đồng chí: ${activeChairman} tuyên bố lý do, giới thiệu thành phần sinh hoạt Chi bộ thường kỳ.
- Thông qua nội dung sinh hoạt và biểu quyết nhất trí chương trình làm việc.

2. Nội dung sinh hoạt Chi bộ:
- Đánh giá tình hình tư tưởng đảng viên và quần chúng nhân dân trong tháng qua.
- Triển khai nghị quyết cấp trên và nội dung công tác trọng tâm: ${rawContent || 'Tăng cường vai trò gương mẫu của đảng viên trong các phong trào địa phương.'}
- Phân công nhiệm vụ cụ thể cho từng đảng viên phụ trách các tổ liên gia.

3. Chi bộ tiến hành thảo luận đóng góp ý kiến:
- Ý kiến 1: Đảng viên nhất trí cao với báo cáo công tác của Chi ủy.
- Ý kiến 2: Đề xuất tổ chức sinh hoạt chuyên đề về học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh.
- Ý kiến 3: Cần đẩy mạnh công tác phát triển đảng viên mới tại chi bộ.

4. Biểu quyết và thông qua nghị quyết Chi bộ:
- 100% đảng viên dự họp nhất trí biểu quyết thông qua Nghị quyết tháng mới của Chi bộ.
- Giao Ban Chi ủy đôn đốc triển khai thực hiện.`;
    }

    if (mType === 'front') {
      return `1. Khai mạc cuộc họp Ban công tác Mặt trận:
- Ông/Bà: ${activeChairman} tuyên bố lý do cuộc họp: ${meetingTitle || 'Họp thống nhất kế hoạch công tác Mặt trận'}.
- Giới thiệu đại biểu tham dự cuộc họp.

2. Nội dung báo cáo và triển khai nhiệm vụ:
- Đánh giá kết quả thực hiện các cuộc vận động toàn dân đoàn kết xây dựng đời sống văn hóa.
- Phổ biến kế hoạch triển khai: ${rawContent || 'Tổ chức ngày hội Đại đoàn kết toàn dân tộc và các hoạt động an sinh xã hội.'}

3. Các ý kiến thảo luận và đề xuất:
- Ý kiến 1: Nhất trí với kế hoạch và cam kết vận động 100% hộ dân tham gia.
- Ý kiến 2: Cần rà soát kỹ các đối tượng khó khăn để hỗ trợ quà Tết/ngày hội công bằng.
- Ý kiến 3: Tăng cường tuyên truyền phòng chống rác thải nhựa tại cộng đồng.

4. Thống nhất nội dung hành động:
- 100% thành viên Mặt trận nhất trí thông qua chương trình phối hợp thống nhất hành động.
- Trưởng ban Công tác Mặt trận kết luận và bế mạc cuộc họp.`;
    }

    // Default general
    return `1. Khai mạc cuộc họp:
- Ông/Bà: ${activeChairman} tuyên bố lý do cuộc họp: ${meetingTitle || 'Họp định kỳ triển khai công tác TDP'}.
- Giới thiệu thành phần tham dự và thông qua chương trình làm việc.

2. Nội dung các báo cáo:
- Triển khai nội dung trọng tâm: ${rawContent || 'Đánh giá công tác tháng qua và bàn thảo kế hoạch thực hiện nhiệm vụ mới.'}
- Phổ biến các văn bản chỉ đạo cấp trên đến toàn thể bà con nhân dân.

3. Phần thảo luận đóng góp ý kiến:
- Ý kiến 1: Nhất trí với báo cáo và đề nghị tăng cường tuần tra an ninh trật tự.
- Ý kiến 2: Cần dọn dẹp vệ sinh môi trường ngõ xóm thường xuyên hơn.
- Ý kiến 3: Đề xuất đóng góp tự nguyện tu sửa nhà văn hóa TDP.

4. Biểu quyết và thông qua quyết nghị:
- 100% đại biểu tham dự nhất trí biểu quyết thông qua các nội dung đã thảo luận.
- Giao Ban tự quản Tổ dân phố đôn đốc và giám sát thực hiện.`;
  };

  // Pre-fill fields when selecting a meeting
  const handleSelectMeeting = (id: string, meetingList: Meeting[] = meetings) => {
    setSelectedMeetingId(id);
    if (!id) {
      // Reset to default blank template
      setTitle('Họp Tổ dân phố thường kỳ');
      setDate(new Date().toISOString().slice(0, 10));
      setTime('19:30');
      setLocation('Nhà văn hóa Tổ dân phố');
      setChairman('Nguyễn Kim Tuyến - Tổ trưởng');
      setSecretary('Lê Thị Dung - Thư ký');
      setAttendance('85');
      setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', 'Nguyễn Kim Tuyến - Tổ trưởng', 'Lê Thị Dung - Thư ký'));
      return;
    }

    const m = meetingList.find(item => item.id === id);
    if (m) {
      const formattedTitle = m.title;
      const meetingDate = new Date(m.date);
      const mType = m.type || 'general';
      
      let initialChairman = 'Nguyễn Kim Tuyến - Tổ trưởng';
      let initialSecretary = 'Lê Thị Dung - Thư ký';
      if (mType === 'party') {
        initialChairman = 'Nguyễn Kim Tuyến - Bí thư Chi bộ';
        initialSecretary = 'Lê Thị Dung - Chi ủy viên';
      } else if (mType === 'front') {
        initialChairman = 'Nguyễn Kim Tuyến - Trưởng ban CTMT';
        initialSecretary = 'Lê Thị Dung - Ủy viên Mặt trận';
      }
      
      setTitle(formattedTitle);
      setDate(meetingDate.toISOString().slice(0, 10));
      setTime(meetingDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      setLocation(m.location);
      setAttendance(m.attendance_count.toString());
      setChairman(initialChairman);
      setSecretary(initialSecretary);
      setContent(applyDefaultContentCustom(formattedTitle, m.content, mType, initialChairman, initialSecretary));
      
      showToast('Đã tự động điền thông tin cuộc họp!', 'success');
    }
  };

  // Load meetings for the selector and check pre-filled data
  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const list = await db.getMeetings();
        const sortedList = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMeetings(sortedList);

        // Check if there is a preselected meeting or type passed via localStorage
        const preSelectedId = localStorage.getItem('selected_meeting_minutes_id');
        const preSelectedType = localStorage.getItem('selected_meeting_minutes_type');

        if (preSelectedId) {
          localStorage.removeItem('selected_meeting_minutes_id');
          localStorage.removeItem('selected_meeting_minutes_type');
          handleSelectMeeting(preSelectedId, sortedList);
        } else if (preSelectedType) {
          localStorage.removeItem('selected_meeting_minutes_type');
          
          let defaultTitle = 'Họp Tổ dân phố thường kỳ';
          let initialChairman = 'Nguyễn Kim Tuyến - Tổ trưởng';
          let initialSecretary = 'Lê Thị Dung - Thư ký';
          let defaultAttendance = '85';
          
          if (preSelectedType === 'party') {
            defaultTitle = 'Họp Chi bộ Tổ dân phố thường kỳ';
            initialChairman = 'Nguyễn Kim Tuyến - Bí thư Chi bộ';
            initialSecretary = 'Lê Thị Dung - Chi ủy viên';
            defaultAttendance = '15';
          } else if (preSelectedType === 'front') {
            defaultTitle = 'Họp Ban công tác Mặt trận thường kỳ';
            initialChairman = 'Nguyễn Kim Tuyến - Trưởng ban CTMT';
            initialSecretary = 'Lê Thị Dung - Ủy viên Mặt trận';
            defaultAttendance = '12';
          }
          
          setTitle(defaultTitle);
          setChairman(initialChairman);
          setSecretary(initialSecretary);
          setAttendance(defaultAttendance);
          setContent(applyDefaultContentCustom(defaultTitle, '', preSelectedType, initialChairman, initialSecretary));
        } else {
          // Default general
          setTitle('Họp Tổ dân phố thường kỳ');
          setChairman('Nguyễn Kim Tuyến - Tổ trưởng');
          setSecretary('Lê Thị Dung - Thư ký');
          setAttendance('85');
          setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', 'Nguyễn Kim Tuyến - Tổ trưởng', 'Lê Thị Dung - Thư ký'));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadMeetings();
  }, []);

  const handleReset = () => {
    if (isGuest) {
      showToast('Khách không có quyền đặt lại nội dung biên bản!', 'warning');
      return;
    }
    if (window.confirm('Bạn có muốn khôi phục nội dung biên bản về mặc định?')) {
      setSelectedMeetingId('');
      setTitle('Họp Tổ dân phố thường kỳ');
      setDate(new Date().toISOString().slice(0, 10));
      setTime('19:30');
      setLocation('Nhà văn hóa Tổ dân phố');
      setChairman('Nguyễn Kim Tuyến - Tổ trưởng');
      setSecretary('Lê Thị Dung - Thư ký');
      setAttendance('85');
      setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', 'Nguyễn Kim Tuyến - Tổ trưởng', 'Lê Thị Dung - Thư ký'));
      showToast('Đã khôi phục mặc định!', 'info');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng kiểm tra chặn pop-up!', 'danger');
      return;
    }

    const dateObj = new Date(date);
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    printWindow.document.write(`
      <html>
        <head>
          <title>Biên bản cuộc họp - ${title}</title>
          <style>
            @media print {
              @page { size: A4 portrait; margin: 20mm 15mm 20mm 20mm; }
              body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.5; color: #000; }
              .no-print { display: none; }
            }
            body {
              font-family: "Times New Roman", Times, serif;
              font-size: 13pt;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #000;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .header-table td {
              vertical-align: top;
              text-align: center;
              width: 50%;
            }
            .org-title {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 12pt;
            }
            .org-sub {
              font-size: 11pt;
              text-decoration: underline;
            }
            .nation-title {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 12pt;
            }
            .nation-sub {
              font-weight: bold;
              font-size: 13pt;
            }
            .title-section {
              text-align: center;
              margin: 30px 0 20px 0;
            }
            .main-title {
              font-weight: bold;
              font-size: 16pt;
              text-transform: uppercase;
            }
            .sub-title {
              font-style: italic;
              font-size: 13pt;
              margin-top: 5px;
            }
            .section-title {
              font-weight: bold;
              margin-top: 15px;
            }
            .content-p {
              margin: 8px 0;
              text-align: justify;
            }
            .meta-list {
              margin: 10px 0;
              padding-left: 20px;
            }
            .meta-item {
              margin-bottom: 5px;
            }
            .bullet-content {
              white-space: pre-wrap;
              text-align: justify;
              margin-top: 10px;
              font-family: "Times New Roman", Times, serif;
              font-size: 13pt;
              line-height: 1.6;
            }
            .footer-table {
              width: 100%;
              margin-top: 50px;
              border-collapse: collapse;
            }
            .footer-table td {
              text-align: center;
              width: 50%;
              vertical-align: top;
            }
            .signature-space {
              margin-top: 80px;
            }
            .signature-name {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="org-title">ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}</div>
                <div class="org-title" style="font-size: 11pt; font-weight: bold;">TỔ DÂN PHỐ ${tdpName.toUpperCase()}</div>
                <div class="org-sub">Số: ..... /BB-TDP</div>
              </td>
              <td>
                <div class="nation-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div class="nation-sub">Độc lập - Tự do - Hạnh phúc</div>
                <div style="margin-top: 5px; border-bottom: 1px solid #000; width: 150px; margin-left: auto; margin-right: auto; height: 1px;"></div>
              </td>
            </tr>
          </table>

          <div class="title-section">
            <div class="main-title">BIÊN BẢN CUỘC HỌP</div>
            <div class="sub-title">Về việc: ${title}</div>
          </div>

          <div class="content-p">
            Hôm nay, vào hồi <strong>${time}</strong> ngày <strong>${day}</strong> tháng <strong>${month}</strong> năm <strong>${year}</strong>, tại <strong>${location}</strong>, Tổ dân phố ${tdpName} đã tiến hành tổ chức cuộc họp với nội dung chính như sau:
          </div>

          <div class="section-title">I. THÀNH PHẦN THAM DỰ</div>
          <div class="content-p">
            1. <strong>Chủ trì cuộc họp:</strong> Ông/Bà ${chairman}<br/>
            2. <strong>Thư ký ghi biên bản:</strong> Ông/Bà ${secretary}<br/>
            3. <strong>Đại diện tham dự:</strong> Đại diện của <strong>${attendance}</strong> hộ gia đình trên địa bàn Tổ dân phố tham gia đầy đủ.
          </div>

          <div class="section-title">II. NỘI DUNG DIỄN BIẾN CUỘC HỌP</div>
          <div class="bullet-content">${content.replace(/\n/g, '<br/>')}</div>

          <div class="content-p" style="margin-top: 20px;">
            Cuộc họp đã diễn ra dân chủ, công khai và kết thúc vào hồi ...... giờ cùng ngày. Biên bản này đã được đọc lại cho toàn thể cuộc họp cùng nghe, thống nhất biểu quyết thông qua và ký xác nhận dưới đây.
          </div>

          <table class="footer-table">
            <tr>
              <td>
                <div style="font-weight: bold; text-transform: uppercase;">THƯ KÝ CUỘC HỌP</div>
                <div style="font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ tên)</div>
                <div class="signature-space"></div>
                <div class="signature-name">${secretary.split('-')[0].trim()}</div>
              </td>
              <td>
                <div style="font-style: italic; font-size: 11pt; margin-bottom: 3px;">${wardName}, ngày ${day} tháng ${month} năm ${year}</div>
                <div style="font-weight: bold; text-transform: uppercase;">CHỦ TRÌ CUỘC HỌP</div>
                <div style="font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ tên)</div>
                <div class="signature-space"></div>
                <div class="signature-name">${chairman.split('-')[0].trim()}</div>
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="minutes-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ display: 'block', marginBottom: '8px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
          📄 Lập Biên bản cuộc họp
        </h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
          Hệ thống hỗ trợ tự động soạn thảo biên bản họp dân, họp chi bộ, họp mặt trận. Chỉ cần chỉnh sửa một vài thông tin cơ bản và in ấn trực tiếp.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="minutes-container" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* Left Side: Form Controls */}
        <div className="form-card" style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            🛠️ Thông tin cơ bản
          </h3>

          {/* Quick Select Meeting */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Chọn từ cuộc họp đã lên lịch (Tự điền nhanh)</label>
            <select
              value={selectedMeetingId}
              onChange={(e) => handleSelectMeeting(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                outline: 'none',
                width: '100%'
              }}
            >
              <option value="">-- Tạo biên bản mới / Không liên kết --</option>
              {meetings.map(m => (
                <option key={m.id} value={m.id}>
                  [{m.type === 'party' ? 'Chi bộ' : m.type === 'front' ? 'Mặt trận' : 'Dân cư'}] {m.title} ({new Date(m.date).toLocaleDateString('vi-VN')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Vấn đề / Tiêu đề biên bản cuộc họp</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Họp bàn phương án bê tông hóa ngõ 47"
              disabled={isGuest}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Ngày họp</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isGuest}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Giờ bắt đầu họp</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="19:30"
                disabled={isGuest}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Địa điểm họp</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Nhà văn hóa Tổ dân phố"
              disabled={isGuest}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Chủ trì cuộc họp</label>
              <input
                type="text"
                value={chairman}
                onChange={(e) => setChairman(e.target.value)}
                disabled={isGuest}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Thư ký ghi chép</label>
              <input
                type="text"
                value={secretary}
                onChange={(e) => setSecretary(e.target.value)}
                disabled={isGuest}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Số lượng hộ gia đình tham gia</label>
            <input
              type="number"
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              disabled={isGuest}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Nội dung diễn biến chi tiết</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập diễn biến chính của cuộc họp..."
              disabled={isGuest}
              style={{
                height: '180px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            {!isGuest && (
              <button
                onClick={handleReset}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <RotateCcw size={16} /> Đặt lại mặc định
              </button>
            )}
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                flex: 1.2,
                padding: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                color: 'white',
                border: 'none'
              }}
            >
              <Printer size={16} /> In biên bản (A4)
            </button>
          </div>
        </div>

        {/* Right Side: Live Document Preview */}
        <div className="preview-card" style={{
          background: '#f8fafc',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
          position: 'sticky',
          top: '84px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={18} color="var(--primary)" /> Xem trước văn bản in ấn
          </h3>
          
          {/* Mock A4 Page Sheet */}
          <div className="a4-sheet" style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            padding: '24px 28px',
            minHeight: '620px',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '11pt',
            lineHeight: '1.5',
            color: '#1e293b',
            textAlign: 'left'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>UBND {wardName}</div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>TỔ DÂN PHỐ {tdpName}</div>
                <div style={{ fontSize: '9pt', textDecoration: 'underline' }}>Số: ..... /BB-TDP</div>
              </div>
              <div style={{ textAlign: 'center', width: '55%' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                <div style={{ borderBottom: '1px solid #475569', width: '80px', margin: '4px auto 0 auto', height: '1px' }}></div>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '15px 0' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13pt' }}>BIÊN BẢN CUỘC HỌP</div>
              <div style={{ fontStyle: 'italic', fontSize: '10.5pt' }}>Về việc: {title || '...'}</div>
            </div>

            {/* Introductory text */}
            <div style={{ fontSize: '10.5pt', marginBottom: '12px' }}>
              Hôm nay, vào hồi <strong>{time}</strong> ngày <strong>{new Date(date).getDate()}</strong> tháng <strong>{new Date(date).getMonth() + 1}</strong> năm <strong>{new Date(date).getFullYear()}</strong>, tại <strong>{location}</strong>, Tổ dân phố {tdpName} đã tiến hành tổ chức cuộc họp với nội dung chính như sau:
            </div>

            {/* Part I */}
            <div style={{ fontWeight: 'bold', fontSize: '11pt', margin: '10px 0 4px 0' }}>I. THÀNH PHẦN THAM DỰ</div>
            <div style={{ fontSize: '10.5pt', paddingLeft: '8px', marginBottom: '12px' }}>
              1. Chủ trì cuộc họp: Ông/Bà {chairman}<br/>
              2. Thư ký ghi biên bản: Ông/Bà {secretary}<br/>
              3. Đại diện tham dự: Đại diện của <strong>{attendance}</strong> hộ gia đình.
            </div>

            {/* Part II */}
            <div style={{ fontWeight: 'bold', fontSize: '11pt', margin: '10px 0 4px 0' }}>II. NỘI DUNG DIỄN BIẾN CUỘC HỌP</div>
            <div style={{
              fontSize: '10.5pt',
              whiteSpace: 'pre-wrap',
              paddingLeft: '8px',
              fontFamily: '"Times New Roman", Times, serif',
              lineHeight: '1.5'
            }}>
              {content}
            </div>

            <div style={{ fontSize: '10.5pt', marginTop: '16px' }}>
              Cuộc họp kết thúc vào hồi ...... giờ cùng ngày. Biên bản đã được biểu quyết thông qua.
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '10.5pt' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ fontWeight: 'bold' }}>THƯ KÝ CUỘC HỌP</div>
                <div style={{ height: '40px' }}></div>
                <div style={{ fontWeight: 'bold' }}>{secretary.split('-')[0].trim()}</div>
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ fontStyle: 'italic', fontSize: '9.5pt' }}>..., ngày {new Date(date).getDate()} tháng {new Date(date).getMonth() + 1} năm {new Date(date).getFullYear()}</div>
                <div style={{ fontWeight: 'bold' }}>CHỦ TRÌ CUỘC HỌP</div>
                <div style={{ height: '40px' }}></div>
                <div style={{ fontWeight: 'bold' }}>{chairman.split('-')[0].trim()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .minutes-page {
          animation: fadeIn 0.4s ease-out;
        }
        @media (max-width: 1024px) {
          .minutes-container {
            grid-template-columns: 1fr !important;
          }
          .preview-card {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MeetingMinutes;
