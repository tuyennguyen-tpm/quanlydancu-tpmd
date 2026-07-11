import { useState, useEffect } from 'react';
import { FileText, Printer, RotateCcw, Calendar, User, Clock, MapPin, Trash2, Plus, Maximize2 } from 'lucide-react';
import { db, generateUUID } from '../services/db';
import { showToast } from '../utils/toast';
import type { Meeting, MeetingMinutesData } from '../types';

const MeetingMinutes = () => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [savedMinutes, setSavedMinutes] = useState<MeetingMinutesData[]>([]);
  const [currentMinutesId, setCurrentMinutesId] = useState<string | null>(null);
  
  // Form/Document fields
  const [tdpName, setTdpName] = useState(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
  const [wardName, setWardName] = useState(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('19:30');
  const [location, setLocation] = useState('Nhà văn hóa Tổ dân phố');
  // Helper to extract official name from config
  const getOfficialNameFromConfig = (id: string, fallbackName: string): string => {
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const found = sigs.find((s: any) => s.id === id);
      if (found?.name?.trim()) return found.name.trim();
    } catch { /* ignore */ }
    
    if (id === 'bi_thu') {
      return localStorage.getItem('party_secretary_name') || fallbackName;
    }
    if (id === 'to_truong' || id === 'mat_tran') {
      return localStorage.getItem('leader_name') || fallbackName;
    }
    return fallbackName;
  };

  const getDefaultChairmanAndSecretary = (type: string) => {
    const toTruongName = getOfficialNameFromConfig('to_truong', 'Nguyễn Kim Tuyến');
    const biThuName = getOfficialNameFromConfig('bi_thu', 'Nguyễn Kim Tuyến');
    const matTranName = getOfficialNameFromConfig('mat_tran', 'Nguyễn Kim Tuyến');
    const thuKyName = getOfficialNameFromConfig('thu_ky', 'Lê Thị Dung');

    if (type === 'party') {
      return {
        chairman: `${biThuName} - Bí thư Chi bộ`,
        secretary: `${thuKyName} - Chi ủy viên`
      };
    } else if (type === 'front') {
      return {
        chairman: `${matTranName} - Trưởng ban CTMT`,
        secretary: `${thuKyName} - Ủy viên Mặt trận`
      };
    } else {
      return {
        chairman: `${toTruongName} - Tổ trưởng`,
        secretary: `${thuKyName} - Thư ký`
      };
    }
  };

  const getSigUrlForNameOrRole = (nameStr: string, roleIdFallback: string): string => {
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      
      const nameWithoutTitle = nameStr.split('-')[0].trim();
      const cleanInputName = nameWithoutTitle.replace(/^(Ông|Bà|Đồng chí|Đ\/c|Đc)\.?\s+/i, '').trim().toLowerCase();
      
      if (cleanInputName) {
        const foundByName = sigs.find((s: any) => {
          const cleanSigName = s.name.trim().toLowerCase();
          return cleanSigName && (cleanSigName.includes(cleanInputName) || cleanInputName.includes(cleanSigName));
        });
        if (foundByName?.signatureUrl?.trim()) {
          return foundByName.signatureUrl.trim();
        }
      }
      
      const foundByRole = sigs.find((s: any) => s.id === roleIdFallback);
      return foundByRole?.signatureUrl?.trim() || '';
    } catch {
      return '';
    }
  };

  const [chairman, setChairman] = useState(() => getDefaultChairmanAndSecretary('general').chairman);
  const [secretary, setSecretary] = useState(() => getDefaultChairmanAndSecretary('general').secretary);
  const [attendance, setAttendance] = useState('85');
  const [meetingType, setMeetingType] = useState<string>('general');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || 
                  currentRole === 'demo' || 
                  (meetingType === 'party' && currentRole !== 'admin' && currentRole !== 'bi_thu') ||
                  (meetingType === 'front' && currentRole !== 'admin' && currentRole !== 'mat_tran') ||
                  (meetingType === 'general' && currentRole !== 'admin' && currentRole !== 'to_truong');
  const [content, setContent] = useState('');
  const [isFullscreenEdit, setIsFullscreenEdit] = useState(false);

  const [orgLevel1, setOrgLevel1] = useState(`ỦY BAN NHÂN DÂN ${(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn').toUpperCase()}`);
  const [orgLevel2, setOrgLevel2] = useState(`TỔ DÂN PHỐ ${(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn').toUpperCase()}`);
  const [nationLevel1, setNationLevel1] = useState('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  const [nationLevel2, setNationLevel2] = useState('Độc lập - Tự do - Hạnh phúc');
  const [docTitle, setDocTitle] = useState('BIÊN BẢN CUỘC HỌP');
  const [secretaryTitle, setSecretaryTitle] = useState('THƯ KÝ CUỘC HỌP');
  const [chairmanTitle, setChairmanTitle] = useState('CHỦ TRÌ CUỘC HỌP');
  const [docNumber, setDocNumber] = useState('.....');
  const [endTime, setEndTime] = useState('...... giờ');

  const serializeMetadata = (rawContent: string) => {
    const metadata = {
      orgLevel1,
      orgLevel2,
      nationLevel1,
      nationLevel2,
      docTitle,
      secretaryTitle,
      chairmanTitle,
      docNumber,
      endTime
    };
    return `${rawContent}\n\n<!--METADATA:${JSON.stringify(metadata)}-->`;
  };

  const deserializeContentAndMetadata = (fullContent: string) => {
    const regex = /\n\n<!--METADATA:({.*?})-->$/s;
    const match = fullContent.match(regex);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        setOrgLevel1(meta.orgLevel1 || `ỦY BAN NHÂN DÂN ${(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn').toUpperCase()}`);
        setOrgLevel2(meta.orgLevel2 || `TỔ DÂN PHỐ ${(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn').toUpperCase()}`);
        setNationLevel1(meta.nationLevel1 || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
        setNationLevel2(meta.nationLevel2 || 'Độc lập - Tự do - Hạnh phúc');
        setDocTitle(meta.docTitle || 'BIÊN BẢN CUỘC HỌP');
        setSecretaryTitle(meta.secretaryTitle || 'THƯ KÝ CUỘC HỌP');
        setChairmanTitle(meta.chairmanTitle || 'CHỦ TRÌ CUỘC HỌP');
        setDocNumber(meta.docNumber || '.....');
        setEndTime(meta.endTime || '...... giờ');
        return fullContent.replace(regex, '');
      } catch (e) {
        console.error('Lỗi parse metadata:', e);
      }
    }
    return fullContent;
  };

  const getDocNumberSuffix = (type: string) => {
    if (type === 'party') return '/BB-CB';
    if (type === 'front') return '/BB-MT';
    return '/BB-TDP';
  };

  const loadSavedMinutes = async () => {
    try {
      const list = await db.getMeetingMinutes();
      setSavedMinutes(list);
    } catch (e) {
      console.error('Lỗi tải danh sách biên bản:', e);
    }
  };

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
      return `I. THÀNH PHẦN THAM DỰ
1. Tổng số Đảng viên của Chi bộ: ...... đồng chí, trong đó:
- Đảng viên chính thức: ...... đồng chí.
- Đảng viên dự bị: ...... đồng chí.
- Đảng viên miễn sinh hoạt: ...... đồng chí.
2. Số Đảng viên có mặt: ...... đồng chí (Vắng mặt: ...... đồng chí, có lý do: ......, không lý do: ......).
3. Chủ trì hội nghị: Đồng chí ${activeChairman.split('-')[0].trim()} - Bí thư Chi bộ.
4. Thư ký hội nghị: Đồng chí ${activeSecretary.split('-')[0].trim()} - Chi ủy viên.
5. Đại biểu cấp trên tham dự (nếu có): ........................................................................

II. NỘI DUNG VÀ DIỄN BIẾN SINH HOẠT
1. Đồng chí Chủ trì quán triệt mục đích, yêu cầu và thông qua chương trình sinh hoạt Chi bộ thường kỳ tháng. Chi bộ biểu quyết thống nhất 100% nội dung chương trình.
2. Công tác giáo dục chính trị tư tưởng:
- Chi bộ tiến hành sinh hoạt chính trị, học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh về chủ đề chuyên đề năm.
- Đánh giá tình hình tư tưởng của Đảng viên và quần chúng nhân dân trên địa bàn.
3. Đánh giá kết quả thực hiện nhiệm vụ chính trị tháng qua:
- Đánh giá kết quả công tác lãnh đạo thực hiện nhiệm vụ phát triển kinh tế - xã hội, an ninh trật tự và công tác xây dựng Đảng.
- Chỉ rõ những ưu điểm đạt được, hạn chế tồn tại và nguyên nhân.
4. Triển khai phương hướng công tác tháng tới:
- Trọng tâm công tác lãnh đạo của Chi bộ: ${rawContent || 'Tăng cường vai trò gương mẫu của đảng viên trong các hoạt động địa phương.'}
- Phân công nhiệm vụ cụ thể cho từng Chi ủy viên và Đảng viên phụ trách các tổ liên gia, đoàn thể.
5. Chi bộ thảo luận:
- Ý kiến 1: Đồng chí ................................. nhất trí với báo cáo đánh giá và đề xuất giải pháp đẩy mạnh công tác tuyên truyền vận động nhân dân dọn dẹp vệ sinh môi trường.
- Ý kiến 2: Đồng chí ................................. đề xuất tăng cường sinh hoạt chuyên đề và quan tâm bồi dưỡng quần chúng ưu tú tạo nguồn kết nạp Đảng.
- Đồng chí Chủ trì tiếp thu các ý kiến đóng góp và giải trình làm rõ các nội dung liên quan.

III. QUYẾT NGHỊ VÀ BIỂU QUYẾT
Chi bộ thống nhất quyết nghị các nội dung sau:
- Thông qua Báo cáo đánh giá công tác tháng trước và Phương hướng nhiệm vụ tháng tới.
- Thống nhất các chỉ tiêu biện pháp lãnh đạo trọng tâm đã đề ra.
- Kết quả biểu quyết thông qua Nghị quyết:
+ Số Đảng viên đồng ý: ....../...... đồng chí (đạt ......%).
+ Số Đảng viên không đồng ý: Không.
+ Ý kiến khác: Không.`;
    }

    if (mType === 'front') {
      return `I. THÀNH PHẦN THAM DỰ
1. Thành viên Ban Công tác Mặt trận Tổ dân phố: Có mặt ....../...... thành viên.
2. Đại diện Ban Thường trực Ủy ban MTTQ Việt Nam phường: ...................................................
3. Khách mời tham dự (Bí thư Chi bộ, Tổ trưởng Tổ dân phố, đại diện các chi hội đoàn thể):
- Đồng chí Bí thư Chi bộ: ...................................................
- Ông/Bà Tổ trưởng Tổ dân phố: ...................................................
4. Chủ trì hội nghị: Ông/Bà ${activeChairman.split('-')[0].trim()} - Trưởng ban Công tác Mặt trận.
5. Thư ký hội nghị: Ông/Bà ${activeSecretary.split('-')[0].trim()} - Thành viên Ban Công tác Mặt trận.

II. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP
1. Ông/Bà Chủ trì tuyên bố lý do, giới thiệu đại biểu và thông qua nội dung cuộc họp: ${meetingTitle || 'Họp thống nhất kế hoạch công tác Mặt trận'}.
2. Đánh giá kết quả công tác Mặt trận tháng qua:
- Báo cáo kết quả thực hiện cuộc vận động "Toàn dân đoàn kết xây dựng nông thôn mới, đô thị văn minh".
- Kết quả hoạt động giám sát, hòa giải cơ sở và xây dựng khối đại đoàn kết toàn dân tộc.
3. Triển khai công tác Mặt trận tháng tới:
- Trọng tâm công tác: ${rawContent || 'Tổ chức Ngày hội Đại đoàn kết toàn dân tộc và thực hiện các hoạt động an sinh xã hội chăm lo gia đình chính sách.'}
- Phối hợp với các tổ chức thành viên (Hội Phụ nữ, Hội Cựu chiến binh, Đoàn Thanh niên, Hội Nông dân) thực hiện các phong trào thi đua.
4. Thảo luận, đóng góp ý kiến:
- Ý kiến 1: Ông/Bà ................................. đại diện Chi hội Cựu chiến binh nhất trí với kế hoạch và cam kết đảm nhận tuyên truyền vận động nhân dân giữ gìn an ninh trật tự đường ngõ.
- Ý kiến 2: Ông/Bà ................................. đại diện Chi hội Phụ nữ đề xuất rà soát kỹ danh sách các hộ nghèo, hộ khó khăn để hỗ trợ tặng quà nhân dịp Ngày hội Đại đoàn kết.
- Ông/Bà Chủ trì tổng hợp, giải trình và tiếp thu các ý kiến đóng góp của hội nghị.

III. QUYẾT NGHỊ VÀ BIỂU QUYẾT
Hội nghị thống nhất quyết nghị:
- Nhất trí thông qua báo cáo kết quả công tác và kế hoạch hành động phối hợp thống nhất tháng tới.
- Phân công nhiệm vụ cụ thể cho các thành viên và tổ chức đoàn thể.
- Kết quả biểu quyết thống nhất:
+ Tỷ lệ đồng ý: 100% thành viên tham dự nhất trí biểu quyết thông qua.
+ Ý kiến không đồng ý: Không.
+ Ý kiến khác: Không.`;
    }

    // Default general
    return `I. THÀNH PHẦN THAM DỰ
1. Ban cán sự Tổ dân phố gồm: Tổ trưởng, Tổ phó, đại diện các tổ liên gia.
2. Đại diện cấp ủy Chi bộ, Ban công tác Mặt trận tham dự và chỉ đạo.
3. Đại diện các hộ gia đình trong Tổ dân phố: Có mặt đại diện của ....../...... hộ gia đình (đạt tỷ lệ ......%).
4. Chủ trì hội nghị: Ông/Bà ${activeChairman.split('-')[0].trim()} - Tổ trưởng Tổ dân phố.
5. Thư ký hội nghị: Ông/Bà ${activeSecretary.split('-')[0].trim()} - Thư ký Tổ dân phố.

II. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP
1. Ông/Bà Chủ trì khai mạc hội nghị, tuyên bố lý do và báo cáo tóm tắt kết quả công tác tự quản của Tổ dân phố thời gian qua.
2. Phổ biến các chủ trương, chính sách mới của Nhà nước và nghị quyết, chỉ đạo của Ủy ban nhân dân phường đến bà con nhân dân.
3. Triển khai kế hoạch công tác tự quản thời gian tới:
- Trọng tâm công tác: ${rawContent || 'Đánh giá công tác tự quản và bàn bạc triển khai thực hiện các phong trào thi đua tại địa phương.'}
- Triển khai thu nộp các loại quỹ công ích, phí dịch vụ vệ sinh môi trường, an ninh trật tự đường phố.
4. Ý kiến thảo luận đóng góp của bà con Nhân dân:
- Ý kiến 1 (Ông/Bà đại diện hộ dân): Nhất trí cao với báo cáo công tác và kế hoạch đề ra. Đề nghị Ban tự quản Tổ dân phố đôn đốc và công khai tiến độ thực hiện các công trình ngõ phố.
- Ý kiến 2 (Ông/Bà đại diện hộ dân): Kiến nghị tăng cường kiểm tra công tác phòng cháy chữa cháy tại các hộ gia đình và nhắc nhở việc đổ rác đúng giờ, đúng nơi quy định.
- Ban cán sự Tổ dân phố đã tiếp thu ý kiến, giải trình thỏa đáng và thống nhất phương án xử lý cụ thể.

III. QUYẾT NGHỊ VÀ BIỂU QUYẾT
Toàn thể đại biểu tham dự hội nghị biểu quyết thông qua các nội dung:
- Nhất trí Báo cáo công tác tự quản của Tổ dân phố và Kế hoạch thực hiện nhiệm vụ mới.
- Thống nhất mức đóng góp tự nguyện và các biện pháp giữ gìn an ninh, vệ sinh môi trường.
- Kết quả biểu quyết thống nhất:
+ Tỷ lệ biểu quyết đồng ý: 100% đại diện hộ dân dự họp biểu quyết thông qua.
+ Ý kiến không đồng ý: Không.
+ Ý kiến khác: Không.`;
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
      const defaults = getDefaultChairmanAndSecretary('general');
      setChairman(defaults.chairman);
      setSecretary(defaults.secretary);
      setAttendance('85');
      setMeetingType('general');
      setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', defaults.chairman, defaults.secretary));
      
      setOrgLevel1(`ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}`);
      setOrgLevel2(`TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
      setNationLevel1('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
      setNationLevel2('Độc lập - Tự do - Hạnh phúc');
      setDocTitle('BIÊN BẢN CUỘC HỌP');
      setSecretaryTitle('THƯ KÝ CUỘC HỌP');
      setChairmanTitle('CHỦ TRÌ CUỘC HỌP');
      setDocNumber('.....');
      setEndTime('...... giờ');
      return;
    }

    const m = meetingList.find(item => item.id === id);
    if (m) {
      const formattedTitle = m.title;
      const meetingDate = new Date(m.date);
      const mType = m.type || 'general';
      setMeetingType(mType);
      
      const defaults = getDefaultChairmanAndSecretary(mType);
      let initialChairman = defaults.chairman;
      let initialSecretary = defaults.secretary;
      if (mType === 'party') {
        setOrgLevel1('ĐẢNG CỘNG SẢN VIỆT NAM');
        setOrgLevel2(`CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN SINH HOẠT CHI BỘ');
        setSecretaryTitle('THƯ KÝ HỘI NGHỊ');
        setChairmanTitle('BÍ THƯ CHI BỘ');
      } else if (mType === 'front') {
        const cleanWard = wardName.replace(/Phường/gi, '').trim().toUpperCase();
        setOrgLevel1(`ỦY BAN MTTQ VN PHƯỜNG ${cleanWard}`);
        setOrgLevel2(`BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN CUỘC HỌP');
        setSecretaryTitle('THƯ KÝ CUỘC HỌP');
        setChairmanTitle('TRƯỞNG BAN');
      } else {
        setOrgLevel1(`ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}`);
        setOrgLevel2(`TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN CUỘC HỌP');
        setSecretaryTitle('THƯ KÝ CUỘC HỌP');
        setChairmanTitle('CHỦ TRÌ CUỘC HỌP');
      }
      setNationLevel1('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
      setNationLevel2('Độc lập - Tự do - Hạnh phúc');
      setDocNumber('.....');
      setEndTime('...... giờ');
      
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
          const defaults = getDefaultChairmanAndSecretary(preSelectedType || 'general');
          let initialChairman = defaults.chairman;
          let initialSecretary = defaults.secretary;
          let defaultAttendance = '85';
          
          if (preSelectedType === 'party') {
            defaultTitle = 'Họp Chi bộ Tổ dân phố thường kỳ';
            defaultAttendance = '15';
          } else if (preSelectedType === 'front') {
            defaultTitle = 'Họp Ban công tác Mặt trận thường kỳ';
            defaultAttendance = '12';
          }
          
          setTitle(defaultTitle);
          setChairman(initialChairman);
          setSecretary(initialSecretary);
          setAttendance(defaultAttendance);
          setMeetingType(preSelectedType);
          setContent(applyDefaultContentCustom(defaultTitle, '', preSelectedType, initialChairman, initialSecretary));
        } else {
          // Default general
          const defaults = getDefaultChairmanAndSecretary('general');
          setTitle('Họp Tổ dân phố thường kỳ');
          setChairman(defaults.chairman);
          setSecretary(defaults.secretary);
          setAttendance('85');
          setMeetingType('general');
          setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', defaults.chairman, defaults.secretary));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadMeetings();
    loadSavedMinutes();
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

  const handleSaveMinutes = async () => {
    if (isGuest) {
      showToast('Khách không có quyền lưu biên bản!', 'warning');
      return;
    }
    if (!title.trim() || !content.trim()) {
      showToast('Vui lòng điền tiêu đề và nội dung diễn biến biên bản!', 'warning');
      return;
    }

    const payload: MeetingMinutesData = {
      id: currentMinutesId || generateUUID(),
      meeting_id: selectedMeetingId || null,
      title,
      date,
      time,
      location,
      chairman,
      secretary,
      attendance: parseInt(attendance) || 0,
      content: serializeMetadata(content),
      created_at: new Date().toISOString()
    };

    try {
      await db.saveMeetingMinutes(payload);
      showToast(currentMinutesId ? 'Cập nhật biên bản thành công!' : 'Lưu biên bản mới thành công!', 'success');
      setCurrentMinutesId(payload.id);
      loadSavedMinutes();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e: any) {
      showToast(`Lỗi lưu biên bản: ${e.message || e}`, 'danger');
    }
  };

  const handleDeleteMinutes = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      showToast('Khách không có quyền xóa biên bản!', 'warning');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa biên bản này khỏi hệ thống?')) {
      return;
    }

    try {
      await db.deleteMeetingMinutes(id);
      showToast('Đã xóa biên bản thành công!', 'success');
      if (currentMinutesId === id) {
        handleCreateNewMinutes();
      }
      loadSavedMinutes();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (err: any) {
      showToast(`Lỗi xóa biên bản: ${err.message || err}`, 'danger');
    }
  };

  const handleSelectSavedMinutes = (minutes: MeetingMinutesData) => {
    setCurrentMinutesId(minutes.id);
    setSelectedMeetingId(minutes.meeting_id || '');
    setTitle(minutes.title);
    setDate(minutes.date);
    setTime(minutes.time);
    setLocation(minutes.location);
    setChairman(minutes.chairman);
    setSecretary(minutes.secretary);
    setAttendance(minutes.attendance.toString());
    
    // Guess meeting type
    let mType = 'general';
    if (minutes.meeting_id && meetings.length > 0) {
      const match = meetings.find(m => m.id === minutes.meeting_id);
      if (match) mType = match.type || 'general';
    } else {
      if (minutes.title.includes('Chi bộ') || minutes.content.includes('Chi bộ') || minutes.chairman.includes('Bí thư')) {
        mType = 'party';
      } else if (minutes.title.includes('Mặt trận') || minutes.content.includes('Mặt trận') || minutes.chairman.includes('Trưởng ban CTMT') || minutes.chairman.includes('Mặt trận')) {
        mType = 'front';
      }
    }
    setMeetingType(mType);

    const regex = /\n\n<!--METADATA:({.*?})-->$/s;
    const hasMetadata = minutes.content.match(regex);
    
    const cleanContent = deserializeContentAndMetadata(minutes.content);
    setContent(cleanContent);
    
    if (!hasMetadata) {
      if (mType === 'party') {
        setOrgLevel1('ĐẢNG CỘNG SẢN VIỆT NAM');
        setOrgLevel2(`CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN SINH HOẠT CHI BỘ');
        setSecretaryTitle('THƯ KÝ HỘI NGHỊ');
        setChairmanTitle('BÍ THƯ CHI BỘ');
      } else if (mType === 'front') {
        const cleanWard = wardName.replace(/Phường/gi, '').trim().toUpperCase();
        setOrgLevel1(`ỦY BAN MTTQ VN PHƯỜNG ${cleanWard}`);
        setOrgLevel2(`BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN CUỘC HỌP');
        setSecretaryTitle('THƯ KÝ CUỘC HỌP');
        setChairmanTitle('TRƯỞNG BAN');
      } else {
        setOrgLevel1(`ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}`);
        setOrgLevel2(`TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
        setDocTitle('BIÊN BẢN CUỘC HỌP');
        setSecretaryTitle('THƯ KÝ CUỘC HỌP');
        setChairmanTitle('CHỦ TRÌ CUỘC HỌP');
      }
      setNationLevel1('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
      setNationLevel2('Độc lập - Tự do - Hạnh phúc');
      setDocNumber('.....');
      setEndTime('...... giờ');
    }
    
    showToast('Đã mở biên bản đã lưu!', 'success');
  };

  const handleCreateNewMinutes = () => {
    setCurrentMinutesId(null);
    setSelectedMeetingId('');
    setTitle('Họp Tổ dân phố thường kỳ');
    setDate(new Date().toISOString().slice(0, 10));
    setTime('19:30');
    setLocation('Nhà văn hóa Tổ dân phố');
    setChairman('Nguyễn Kim Tuyến - Tổ trưởng');
    setSecretary('Lê Thị Dung - Thư ký');
    setAttendance('85');
    setMeetingType('general');
    setContent(applyDefaultContentCustom('Họp Tổ dân phố thường kỳ', '', 'general', 'Nguyễn Kim Tuyến - Tổ trưởng', 'Lê Thị Dung - Thư ký'));
    setOrgLevel1(`ỦY BAN NHÂN DÂN ${wardName.toUpperCase()}`);
    setOrgLevel2(`TỔ DÂN PHỐ ${tdpName.toUpperCase()}`);
    setNationLevel1('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
    setNationLevel2('Độc lập - Tự do - Hạnh phúc');
    setDocTitle('BIÊN BẢN CUỘC HỌP');
    setSecretaryTitle('THƯ KÝ CUỘC HỌP');
    setChairmanTitle('CHỦ TRÌ CUỘC HỌP');
    setDocNumber('.....');
    setEndTime('...... giờ');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng kiểm tra chặn pop-up!', 'danger');
      return;
    }

    const chairmanSigUrl = getSigUrlForNameOrRole(chairman, meetingType === 'party' ? 'bi_thu' : (meetingType === 'front' ? 'mat_tran' : 'to_truong'));
    const secretarySigUrl = getSigUrlForNameOrRole(secretary, 'thu_ky');

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
              @page {
                size: A4 portrait;
                margin-top: 20mm;
                margin-bottom: 20mm;
                margin-left: 30mm;
                margin-right: 15mm;
              }
              body {
                font-family: "Times New Roman", Times, serif;
                font-size: 14pt;
                line-height: 1.6;
                color: #000;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print { display: none; }
            }
            body {
              font-family: "Times New Roman", Times, serif;
              font-size: 14pt;
              line-height: 1.6;
              padding: 0;
              margin: 0;
              color: #000;
            }
            .print-content {
              width: 100%;
              box-sizing: border-box;
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
              font-size: 13pt;
            }
            .org-sub {
              font-size: 12pt;
            }
            .nation-title {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 13pt;
            }
            .nation-sub {
              font-weight: bold;
              font-size: 14pt;
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
              font-size: 14pt;
              margin-top: 5px;
            }
            .section-title {
              font-weight: bold;
              font-size: 14pt;
              margin-top: 15px;
            }
            .content-p {
              margin: 8px 0;
              text-align: justify;
              font-size: 14pt;
            }
            .bullet-content {
              white-space: pre-wrap;
              text-align: justify;
              margin-top: 10px;
              font-family: "Times New Roman", Times, serif;
              font-size: 14pt;
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
              font-size: 14pt;
            }
            .signature-space {
               height: 80px;
               display: flex;
               align-items: center;
               justify-content: center;
               margin: 5px auto;
             }
            .signature-name {
              font-weight: bold;
              font-size: 14pt;
            }
          </style>
        </head>
        <body>
          <div class="print-content">
            <table class="header-table">
              <tr>
                <td>
                  <div class="org-title" style="font-weight: normal;">${orgLevel1}</div>
                  <div class="org-title" style="font-size: 12pt; font-weight: bold;">${orgLevel2}</div>
                  <div style="margin-top: 3px; border-bottom: 1px solid #000; width: 60px; margin-left: auto; margin-right: auto; height: 1px;"></div>
                  <div class="org-sub" style="margin-top: 4px;">Số: ${docNumber}${getDocNumberSuffix(meetingType)}</div>
                </td>
                <td>
                  <div class="nation-title">${nationLevel1}</div>
                  <div class="nation-sub">${nationLevel2}</div>
                  <div style="margin-top: 4px; border-bottom: 1px solid #000; width: 140px; margin-left: auto; margin-right: auto; height: 1px;"></div>
                </td>
              </tr>
            </table>

            <div class="title-section">
              <div class="main-title">${docTitle}</div>
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
              Cuộc họp đã diễn ra dân chủ, công khai và kết thúc vào hồi <strong>${endTime}</strong> cùng ngày. Biên bản này đã được đọc lại cho toàn thể cuộc họp cùng nghe, thống nhất biểu quyết thông qua và ký xác nhận dưới đây.
            </div>

            <div style="text-align: right; font-style: italic; font-size: 13pt; margin-top: 35px; margin-right: 40px;">
              ${wardName}, ngày ${day} tháng ${month} năm ${year}
            </div>

            <table class="footer-table" style="margin-top: 10px;">
              <tr>
                 <td>
                   <div style="font-weight: bold; text-transform: uppercase;">${secretaryTitle}</div>
                   <div style="font-style: italic; font-size: 13pt;">(Ký, ghi rõ họ tên)</div>
                   <div class="signature-space">
                     ${secretarySigUrl ? `<img src="${secretarySigUrl}" alt="Chữ ký" style="height: 70px; max-height: 80px; object-fit: contain;" />` : ''}
                   </div>
                   <div class="signature-name">${secretary.split('-')[0].trim()}</div>
                 </td>
                 <td>
                   <div style="font-weight: bold; text-transform: uppercase;">${chairmanTitle}</div>
                   <div style="font-style: italic; font-size: 13pt;">(Ký, ghi rõ họ tên)</div>
                   <div class="signature-space">
                     ${chairmanSigUrl ? `<img src="${chairmanSigUrl}" alt="Chữ ký" style="height: 70px; max-height: 80px; object-fit: contain;" />` : ''}
                   </div>
                   <div class="signature-name">${chairman.split('-')[0].trim()}</div>
                 </td>
               </tr>
            </table>
          </div>

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

  const handleExportWord = () => {
    const dateObj = new Date(date);
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const chairmanSigUrl = getSigUrlForNameOrRole(chairman, meetingType === 'party' ? 'bi_thu' : (meetingType === 'front' ? 'mat_tran' : 'to_truong'));
    const secretarySigUrl = getSigUrlForNameOrRole(secretary, 'thu_ky');

    const suffix = getDocNumberSuffix(meetingType);
    const docNumDisplay = docNumber ? `Số: ${docNumber}${suffix}` : `Số: .....${suffix}`;

    const formattedContent = content
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          return '<p style="margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;">&nbsp;</p>';
        }
        const isHeaderOrList = /^[I|V|X|\d+\-|*•\+]+[.\s]/.test(trimmed) || trimmed.length < 60;
        if (isHeaderOrList) {
          return `<p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;">${trimmed}</p>`;
        }
        return `<p style="text-align: justify; text-indent: 36pt; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;">${trimmed}</p>`;
      })
      .join('');

    const contentHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Biên bản cuộc họp - ${title}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 595.3pt 841.9pt;
            margin: 72.0pt 54.0pt 72.0pt 86.4pt;
            mso-header-margin: 36.0pt;
            mso-footer-margin: 36.0pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.6; color: #000; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .header-table td { vertical-align: top; text-align: center; width: 50%; }
          .org-title { font-weight: bold; text-transform: uppercase; font-size: 12pt; }
          .org-sub { font-size: 11pt; font-weight: bold; }
          .nation-title { font-weight: bold; font-size: 11.5pt; }
          .nation-sub { font-weight: bold; font-size: 12pt; }
          .doc-num { font-size: 11pt; margin-top: 5px; }
          .doc-title-main { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; margin-top: 15px; margin-bottom: 5px; }
          .doc-title-sub { text-align: center; font-style: italic; font-size: 12pt; margin-bottom: 25px; }
          .doc-body { font-size: 13pt; }
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 6px; text-transform: uppercase; }
          .sign-table { width: 100%; border-collapse: collapse; margin-top: 40px; page-break-inside: avoid; }
          .sign-table td { width: 50%; text-align: center; vertical-align: top; }
          .sign-title { font-weight: bold; text-transform: uppercase; font-size: 12pt; }
          .sign-name { font-weight: bold; margin-top: 70px; font-size: 13pt; }
        </style>
      </head>
      <body>
        <div class="Section1">
          <table class="header-table">
            <tr>
              <td>
                <div class="org-title">${orgLevel1 || 'ỦY BAN NHÂN DÂN'}</div>
                <div class="org-sub">${orgLevel2 || `TỔ DÂN PHỐ ${tdpName.toUpperCase()}`}</div>
                <div style="border-bottom: 1.5px solid #000; width: 80px; margin: 4px auto 8px auto;"></div>
                <div class="doc-num">${docNumDisplay}</div>
              </td>
              <td>
                <div class="nation-title">${nationLevel1 || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}</div>
                <div class="nation-sub">${nationLevel2 || 'Độc lập - Tự do - Hạnh phúc'}</div>
                <div style="border-bottom: 1.5px solid #000; width: 140px; margin: 4px auto 8px auto;"></div>
                <div style="font-size: 11pt; font-style: italic; margin-top: 5px;">
                  ${wardName}, ngày ${day} tháng ${month} năm ${year}
                </div>
              </td>
            </tr>
          </table>

          <div class="doc-title-main">${docTitle || 'BIÊN BẢN CUỘC HỌP'}</div>
          <div class="doc-title-sub">Về việc: ${title}</div>

          <div class="doc-body">
            <div class="section-title">I. PHẦN THỦ TỤC</div>
            <p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;"><strong>1. Thời gian bắt đầu:</strong> Vào hồi ${time} ngày ${day} tháng ${month} năm ${year}</p>
            <p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;"><strong>2. Địa điểm:</strong> Tại ${location}</p>
            <p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;"><strong>3. Chủ trì:</strong> ${chairman}</p>
            <p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;"><strong>4. Thư ký:</strong> ${secretary}</p>
            <p style="text-align: left; margin: 0 0 6pt 0; line-height: 1.5; font-size: 13pt;"><strong>5. Thành phần tham dự:</strong> Đại diện của ${attendance} hộ gia đình trên địa bàn Tổ dân phố tham gia đầy đủ.</p>
            
            <div class="section-title" style="margin-top: 18pt;">II. NỘI DUNG DIỄN BIẾN CUỘC HỌP</div>
            ${formattedContent}
            
            <p style="text-align: justify; text-indent: 36pt; margin: 12pt 0 6pt 0; line-height: 1.5; font-size: 13pt;">Cuộc họp đã diễn ra dân chủ, công khai và kết thúc vào hồi ${endTime} cùng ngày. Biên bản này đã được đọc lại cho toàn thể cuộc họp cùng nghe, thống nhất biểu quyết thông qua và ký xác nhận dưới đây.</p>
          </div>

          <table class="sign-table">
            <tr>
              <td>
                <div class="sign-title">${secretaryTitle || 'THƯ KÝ CUỘC HỌP'}</div>
                <div style="font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ tên)</div>
                ${secretarySigUrl 
                  ? `<div style="margin-top: 10px; margin-bottom: 5px; height: 60px; text-align: center;"><img src="${secretarySigUrl}" style="height: 55px; max-height: 60px; width: auto;" /></div>` 
                  : `<div style="height: 70px;"></div>`
                }
                <div class="sign-name" style="font-weight: bold; font-size: 13pt; margin-top: ${secretarySigUrl ? '5px' : '70px'};">${secretary.split('-')[0].trim()}</div>
              </td>
              <td>
                <div class="sign-title">${chairmanTitle || 'CHỦ TRÌ CUỘC HỌP'}</div>
                <div style="font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ tên)</div>
                ${chairmanSigUrl 
                  ? `<div style="margin-top: 10px; margin-bottom: 5px; height: 60px; text-align: center;"><img src="${chairmanSigUrl}" style="height: 55px; max-height: 60px; width: auto;" /></div>` 
                  : `<div style="height: 70px;"></div>`
                }
                <div class="sign-name" style="font-weight: bold; font-size: 13pt; margin-top: ${chairmanSigUrl ? '5px' : '70px'};">${chairman.split('-')[0].trim()}</div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + contentHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bien_ban_cuoc_hop_${title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tải tệp Word (.doc) thành công!', 'success');
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
        gridTemplateColumns: '280px 1.1fr 1.3fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Saved Minutes List */}
        <div className="saved-list-card" style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
              📁 Biên bản đã lưu
            </h3>
            {!isGuest && (
              <button 
                onClick={handleCreateNewMinutes}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: 'none',
                  color: 'var(--primary)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem',
                  fontWeight: '600'
                }}
              >
                <Plus size={12} /> Thêm mới
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedMinutes.map(m => (
              <div 
                key={m.id}
                onClick={() => handleSelectSavedMinutes(m)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: currentMinutesId === m.id ? 'rgba(59, 130, 246, 0.08)' : 'rgba(248, 250, 252, 0.6)',
                  border: '1px solid',
                  borderColor: currentMinutesId === m.id ? 'var(--primary)' : 'var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
                className="saved-item"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <Calendar size={10} /> {new Date(m.date).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                {!isGuest && (
                  <button 
                    onClick={(e) => handleDeleteMinutes(m.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.65,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.65'}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {savedMinutes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                Chưa có biên bản nào được lưu trữ.
              </div>
            )}
          </div>
        </div>

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
            <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>
              {meetingType === 'party' 
                ? 'Số lượng Đảng viên tham gia' 
                : meetingType === 'front' 
                  ? 'Số lượng thành viên tham gia' 
                  : 'Số lượng hộ gia đình tham gia'}
            </label>
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            {!isGuest && (
              <button
                onClick={handleReset}
                className="btn btn-secondary"
                style={{ flex: '1 1 120px', padding: '9px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <RotateCcw size={14} /> Reset form
              </button>
            )}
            {!isGuest && (
              <button
                onClick={() => setIsFullscreenEdit(true)}
                className="btn btn-secondary"
                style={{
                  flex: '1.2 1 140px',
                  padding: '9px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <Maximize2 size={14} /> Soạn thảo Word A4
              </button>
            )}
            {!isGuest && (
              <button
                onClick={handleSaveMinutes}
                className="btn btn-primary"
                style={{
                  flex: '1.2 1 140px',
                  padding: '9px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <FileText size={14} /> {currentMinutesId ? 'Cập nhật biên bản' : 'Lưu biên bản'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                flex: '1 1 120px',
                padding: '9px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                color: 'white',
                border: 'none'
              }}
            >
              <Printer size={14} /> In biên bản (A4)
            </button>
            <button
              onClick={handleExportWord}
              className="btn btn-secondary"
              style={{
                flex: '1 1 120px',
                padding: '9px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
                color: 'white',
                border: 'none'
              }}
            >
              <FileText size={14} /> Tải file Word
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={18} color="var(--primary)" /> Xem trước văn bản in ấn
            </h3>
            {!isGuest && (
              <button
                onClick={() => setIsFullscreenEdit(true)}
                style={{
                  background: 'rgba(79, 70, 229, 0.1)',
                  border: 'none',
                  color: '#4f46e5',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)'}
              >
                <Maximize2 size={13} /> Phóng to soạn thảo (Word)
              </button>
            )}
          </div>
          
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
                <div style={{ fontSize: '8.5pt', textTransform: 'uppercase' }}>{orgLevel1}</div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>{orgLevel2}</div>
                <div style={{ borderBottom: '1px solid #000', width: '45px', margin: '3px auto 4px auto', height: '1px' }}></div>
                <div style={{ fontSize: '8.5pt' }}>Số: {docNumber}{getDocNumberSuffix(meetingType)}</div>
              </div>
              <div style={{ textAlign: 'center', width: '55%' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>{nationLevel1}</div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{nationLevel2}</div>
                <div style={{ borderBottom: '1px solid #000', width: '90px', margin: '4px auto 0 auto', height: '1px' }}></div>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '15px 0' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13pt', textTransform: 'uppercase' }}>{docTitle}</div>
              <div style={{ fontStyle: 'italic', fontSize: '10.5pt' }}>Về việc: {title || '...'}</div>
            </div>

            {/* Introductory text */}
            <div style={{ fontSize: '10.5pt', marginBottom: '12px', textAlign: 'justify' }}>
              Hôm nay, vào hồi <strong>{time}</strong> ngày <strong>{new Date(date).getDate()}</strong> tháng <strong>{new Date(date).getMonth() + 1}</strong> năm <strong>{new Date(date).getFullYear()}</strong>, tại <strong>{location}</strong>, Tổ dân phố {tdpName} đã tiến hành tổ chức cuộc họp với nội dung chính như sau:
            </div>

            {/* Part I */}
            <div style={{ fontWeight: 'bold', fontSize: '11pt', margin: '10px 0 4px 0' }}>I. THÀNH PHẦN THAM DỰ</div>
            <div style={{ fontSize: '10.5pt', paddingLeft: '8px', marginBottom: '12px', textAlign: 'justify' }}>
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
              lineHeight: '1.5',
              textAlign: 'justify'
            }}>
              {content}
            </div>

            <div style={{ fontSize: '10.5pt', marginTop: '16px', textAlign: 'justify' }}>
              Cuộc họp kết thúc vào hồi <strong>{endTime}</strong> cùng ngày. Biên bản đã được biểu quyết thông qua.
            </div>

            {/* Date line above signatures */}
            <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '9.5pt', marginTop: '24px', paddingRight: '8%' }}>
              {wardName}, ngày {new Date(date).getDate()} tháng {new Date(date).getMonth() + 1} năm {new Date(date).getFullYear()}
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10.5pt' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{secretaryTitle}</div>
                <div style={{ height: '55px' }}></div>
                <div style={{ fontWeight: 'bold' }}>{secretary.split('-')[0].trim()}</div>
              </div>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{chairmanTitle}</div>
                <div style={{ height: '55px' }}></div>
                <div style={{ fontWeight: 'bold' }}>{chairman.split('-')[0].trim()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Word-Like A4 Editor */}
      {isFullscreenEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#e2e8f0',
          zIndex: 2000,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Segoe UI", Roboto, sans-serif'
        }}>
          {/* Top Toolbar */}
          <div style={{
            position: 'sticky',
            top: 0,
            background: '#1e293b',
            color: 'white',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={20} color="#60a5fa" />
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>Soạn thảo Biên bản cuộc họp (Word)</span>
                <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Khổ giấy A4 - Căn lề chuẩn
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleReset}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <RotateCcw size={14} /> Khôi phục mặc định
              </button>
              
              <button
                onClick={handleSaveMinutes}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                }}
              >
                <FileText size={14} /> {currentMinutesId ? 'Cập nhật (Lưu)' : 'Lưu biên bản'}
              </button>
              
              <button
                onClick={handlePrint}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                <Printer size={14} /> In biên bản (A4)
              </button>

              <button
                onClick={handleExportWord}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                }}
              >
                <FileText size={14} /> Tải file Word
              </button>
              
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }}></div>
              
              <button
                onClick={() => setIsFullscreenEdit(false)}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)'
                }}
              >
                Thoát (Đóng)
              </button>
            </div>
          </div>
          
          {/* Workspace Area */}
          <div style={{
            flex: 1,
            padding: '40px 20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflowY: 'auto'
          }}>
            {/* Word A4 Page Sheet */}
            <div style={{
              width: '210mm',
              minHeight: '297mm',
              background: 'white',
              padding: '20mm 15mm 20mm 30mm',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              fontFamily: '"Times New Roman", Times, serif',
              color: '#000',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxSizing: 'border-box',
              position: 'relative',
              borderRadius: '2px'
            }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={orgLevel1}
                    onChange={(e) => setOrgLevel1(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '11pt',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <input
                    type="text"
                    value={orgLevel2}
                    onChange={(e) => setOrgLevel2(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 'bold',
                      fontSize: '11pt',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <div style={{ borderBottom: '1px solid #000', width: '60px', margin: '3px auto 4px auto', height: '1px' }}></div>
                  <div style={{ fontSize: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                    <span>Số: </span>
                    <input 
                      type="text" 
                      placeholder="....."
                      value={docNumber} 
                      onChange={(e) => setDocNumber(e.target.value)}
                      disabled={isGuest}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        borderBottom: '1px dashed #cbd5e1',
                        width: '70px',
                        textAlign: 'center',
                        fontSize: '10pt',
                        fontFamily: 'inherit',
                        outline: 'none',
                        color: '#000'
                      }}
                      className="word-input"
                    />
                    <span>{getDocNumberSuffix(meetingType)}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', width: '55%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={nationLevel1}
                    onChange={(e) => setNationLevel1(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 'bold',
                      fontSize: '11pt',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <input
                    type="text"
                    value={nationLevel2}
                    onChange={(e) => setNationLevel2(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 'bold',
                      fontSize: '11pt',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <div style={{ borderBottom: '1px solid #000', width: '130px', margin: '4px auto 0 auto', height: '1px' }}></div>
                </div>
              </div>

              {/* Title Section */}
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  disabled={isGuest}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #cbd5e1',
                    fontWeight: 'bold',
                    fontSize: '15pt',
                    width: '320px',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    outline: 'none',
                    textTransform: 'uppercase',
                    color: '#000'
                  }}
                  className="word-input"
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
                  <span style={{ fontStyle: 'italic', fontSize: '12pt' }}>Về việc:</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Họp bàn phương án bê tông hóa ngõ 47"
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      width: '400px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      padding: '2px 4px',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                </div>
              </div>

              {/* Introductory details inline */}
              <div style={{ fontSize: '12pt', lineHeight: '1.6', textAlign: 'justify' }}>
                Hôm nay, vào hồi{' '}
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isGuest}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #cbd5e1',
                    width: '60px',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    fontSize: '12pt',
                    outline: 'none',
                    color: '#000'
                  }}
                  className="word-input"
                />{' '}
                ngày{' '}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isGuest}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #cbd5e1',
                    width: '130px',
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    fontSize: '12pt',
                    outline: 'none',
                    color: '#000',
                    textAlign: 'center'
                  }}
                  className="word-input"
                />
                , tại{' '}
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isGuest}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #cbd5e1',
                    width: '260px',
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    fontSize: '12pt',
                    outline: 'none',
                    color: '#000',
                    padding: '2px 4px'
                  }}
                  className="word-input"
                />
                , Tổ dân phố {tdpName} đã tiến hành tổ chức cuộc họp với nội dung chính như sau:
              </div>

              {/* Part I */}
              <div style={{ fontWeight: 'bold', fontSize: '13pt', marginTop: '12px' }}>I. THÀNH PHẦN THAM DỰ</div>
              <div style={{ fontSize: '12pt', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>1. Chủ trì cuộc họp: Ông/Bà</span>
                  <input
                    type="text"
                    value={chairman}
                    onChange={(e) => setChairman(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      width: '320px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      outline: 'none',
                      color: '#000',
                      padding: '2px 4px'
                    }}
                    className="word-input"
                  />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>2. Thư ký ghi biên bản: Ông/Bà</span>
                  <input
                    type="text"
                    value={secretary}
                    onChange={(e) => setSecretary(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      width: '320px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      outline: 'none',
                      color: '#000',
                      padding: '2px 4px'
                    }}
                    className="word-input"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>3. Đại diện tham dự: Đại diện của</span>
                  <input
                    type="number"
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      width: '60px',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      outline: 'none',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <span>hộ gia đình.</span>
                </div>
              </div>

              {/* Part II */}
              <div style={{ fontWeight: 'bold', fontSize: '13pt', marginTop: '16px' }}>II. NỘI DUNG DIỄN BIẾN CUỘC HỌP</div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung diễn biến chi tiết cuộc họp ở đây..."
                  disabled={isGuest}
                  style={{
                    width: '100%',
                    flexGrow: 1,
                    minHeight: '260px',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: '12pt',
                    lineHeight: '1.6',
                    textAlign: 'justify',
                    background: 'transparent',
                    color: '#000',
                    borderLeft: '2px solid transparent',
                    paddingLeft: '6px',
                    transition: 'border-color 0.2s'
                  }}
                  className="word-textarea"
                />
              </div>

              <div style={{ fontSize: '12pt', marginTop: '16px', textAlign: 'justify', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Cuộc họp kết thúc vào hồi</span>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="...... giờ"
                  disabled={isGuest}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #cbd5e1',
                    width: '80px',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    fontSize: '12pt',
                    outline: 'none',
                    color: '#000'
                  }}
                  className="word-input"
                />
                <span>cùng ngày. Biên bản đã được biểu quyết thông qua.</span>
              </div>

              {/* Date line above signatures */}
              <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '11pt', marginTop: '30px', paddingRight: '8%' }}>
                {wardName}, ngày {new Date(date).getDate()} tháng {new Date(date).getMonth() + 1} năm {new Date(date).getFullYear()}
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12pt', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={secretaryTitle}
                    onChange={(e) => setSecretaryTitle(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      width: '180px',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <div style={{ fontStyle: 'italic', fontSize: '10.5pt', color: '#475569' }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: '65px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{secretary.split('-')[0].trim()}</div>
                </div>
                <div style={{ textAlign: 'center', width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={chairmanTitle}
                    onChange={(e) => setChairmanTitle(e.target.value)}
                    disabled={isGuest}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      borderBottom: '1px dashed #cbd5e1',
                      fontWeight: 'bold',
                      fontSize: '12pt',
                      width: '220px',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      outline: 'none',
                      textTransform: 'uppercase',
                      color: '#000'
                    }}
                    className="word-input"
                  />
                  <div style={{ fontStyle: 'italic', fontSize: '10.5pt', color: '#475569' }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: '65px' }}></div>
                  <div style={{ fontWeight: 'bold' }}>{chairman.split('-')[0].trim()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .minutes-page {
          animation: fadeIn 0.4s ease-out;
        }
        .saved-item:hover {
          background: rgba(59, 130, 246, 0.04) !important;
          border-color: rgba(59, 130, 246, 0.4) !important;
        }
        .word-input {
          transition: all 0.2s;
        }
        .word-input:hover {
          border-bottom-color: #cbd5e1 !important;
          background-color: #f8fafc;
        }
        .word-input:focus {
          border-bottom-color: #3b82f6 !important;
          background-color: #eff6ff;
        }
        .word-textarea {
          transition: all 0.2s;
        }
        .word-textarea:hover {
          border-left: 2px solid #cbd5e1 !important;
          background-color: rgba(248, 250, 252, 0.4);
        }
        .word-textarea:focus {
          border-left: 2px solid #3b82f6 !important;
          background-color: rgba(239, 246, 255, 0.3);
        }
        @media (max-width: 1200px) {
          .minutes-container {
            grid-template-columns: 280px 1fr !important;
          }
          .preview-card {
            display: none !important; /* Hide preview on medium screens */
          }
        }
        @media (max-width: 768px) {
          .minutes-container {
            grid-template-columns: 1fr !important;
          }
          .saved-list-card {
            max-height: 250px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MeetingMinutes;
