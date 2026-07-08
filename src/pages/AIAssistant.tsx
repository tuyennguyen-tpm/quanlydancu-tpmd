import { useState } from 'react';
import { 
  Send, 
  Bot, 
  FileText,
  Copy,
  Download,
  Sparkles,
  RefreshCw,
  ClipboardCheck,
  Printer,
  Home,
  Star,
  Users
} from 'lucide-react';
import { db, partyDb } from '../services/db';
import { showToast } from '../utils/toast';

const getAge = (dobString: string): number => {
  if (!dobString) return 0;
  return new Date().getFullYear() - new Date(dobString).getFullYear();
};

const AIAssistant = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const generateDocument = async (userPrompt: string) => {
    const query = userPrompt.toLowerCase();
    
    // Retrieve dynamic settings set by the administrator
    const tdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';

    const tdpUpper = tdpName.toUpperCase();
    const tdpHeader = tdpUpper.startsWith('TỔ DÂN PHỐ') || tdpUpper.startsWith('TDP')
      ? tdpUpper
      : `TỔ DÂN PHỐ ${tdpUpper}`;
      
    const tdpDisplay = tdpName.toLowerCase().startsWith('tổ dân phố') || tdpName.toLowerCase().startsWith('tdp')
      ? tdpName
      : `Tổ dân phố ${tdpName}`;

    const wardDisplay = wardName.toLowerCase().startsWith('phường') || wardName.toLowerCase().startsWith('xã') || wardName.toLowerCase().startsWith('thị trấn')
      ? wardName
      : `Phường ${wardName}`;

    const leaderDisplay = leaderName.toLowerCase().startsWith('ông') || leaderName.toLowerCase().startsWith('bà')
      ? leaderName
      : `Ông ${leaderName}`;
    
    // Fetch live statistics to inject into documents (making it super professional!)
    const [households, residents, complaints, records, partyMembers] = await Promise.all([
      db.getHouseholds(),
      db.getResidents(),
      db.getComplaints(),
      db.getFinancialRecords(),
      partyDb.getPartyMembers()
    ]);

    let docType: 'general' | 'party' | 'front' = 'general';
    if (query.includes('chi bộ') || query.includes('sinh hoạt chi bộ') || query.includes('đảng viên') || query.includes('nghị quyết')) {
      docType = 'party';
    } else if (query.includes('mặt trận') || query.includes('đại đoàn kết') || query.includes('mttq')) {
      docType = 'front';
    }

    const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const balance = totalIncome - totalExpense;

    const formatCurrency = (amt: number) => {
      return new Intl.NumberFormat('vi-VN').format(amt) + ' đồng';
    };

    const fmtDate = (dStr: string) => {
      if (!dStr) return '—';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    // 1. Rà soát nghĩa vụ quân sự
    if (query.includes('nghĩa vụ quân sự') || query.includes('nghia vu quan su') || query.includes('nghĩa vụ') || query.includes('nhập ngũ')) {
      const currentYear = new Date().getFullYear();
      const eligibleMen = residents.filter(r => {
        if (r.gender !== 'male' || !r.dob || r.status === 'deceased') return false;
        const birthYear = new Date(r.dob).getFullYear();
        const age = currentYear - birthYear;
        return age >= 18 && age <= 27;
      });

      return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
TỔ DÂN PHỐ ${tdpName.toUpperCase()} - ${wardDisplay.toUpperCase()}

BÁO CÁO RÀ SOÁT NGHĨA VỤ QUÂN SỰ NĂM ${currentYear}
Về việc rà soát nam thanh niên trong độ tuổi sẵn sàng nhập ngũ (18-27 tuổi).

Kính gửi: Hội đồng Nghĩa vụ quân sự ${wardDisplay}

Thực hiện công tác rà soát thực tế đối chiếu với Cơ sở dữ liệu dân cư năm ${currentYear}, Tổ dân phố ${tdpName} xin báo cáo danh sách công dân nam trong độ tuổi gọi nhập ngũ như sau:

I. SỐ LIỆU TỔNG HỢP:
- Tổng số nam thanh niên tuổi từ 18 đến 27: ${eligibleMen.length} công dân.
- Đủ điều kiện gọi khám tuyển đợt tới: ${eligibleMen.length} công dân.

II. DANH SÁCH CHI TIẾT THANH NIÊN TRONG DIỆN NGHĨA VỤ QUÂN SỰ:
${eligibleMen.length > 0 ? eligibleMen.map((m, idx) => {
  const hh = households.find(h => h.id === m.household_id);
  let parentName = 'Không rõ';
  if (hh) {
    const headRes = residents.find(r => r.household_id === hh.id && r.is_head);
    if (headRes) parentName = headRes.full_name;
  }
  return `  ${idx + 1}. Họ và tên: ${m.full_name} - Ngày sinh: ${fmtDate(m.dob)} - Chủ hộ: Hộ ông/bà ${parentName} - Địa chỉ: ${hh?.address || 'Tổ dân phố'}`;
}).join('\n') : '  (Hiện tại không có nam thanh niên nào trong độ tuổi 18-27 trên cơ sở dữ liệu)'}

III. KIẾN NGHỊ:
Kính trình Hội đồng Nghĩa vụ quân sự Phường xem xét phê duyệt danh sách phát lệnh gọi khám tuyển.

                                                            ${tdpName}, ngày ${new Date().getDate().toString().padStart(2, '0')} tháng ${(new Date().getMonth() + 1).toString().padStart(2, '0')} năm ${currentYear}
                                                            TRƯỞNG TỔ DÂN PHỐ
                                                            
                                                            ${leaderDisplay.replace('Ông ', '').replace('Bà ', '')}`;
    }

    // 2. Hộ nghèo query handler
    if (query.includes('hộ nghèo') || query.includes('ho ngheo') || query.includes('chính sách hỗ hỗ trợ') || query.includes('chính sách hộ nghèo')) {
      const poorHouseholds = households.filter(h => h.policy_type === 'poor');
      const nearPoorHouseholds = households.filter(h => h.policy_type === 'near_poor');
      const policyHouseholds = households.filter(h => h.policy_type === 'policy_family');

      return `TỔ DÂN PHỐ ${tdpName.toUpperCase()} - ${wardDisplay.toUpperCase()}
---
BÁO CÁO TỔNG HỢP HỘ NGHÈO, HỘ CẬN NGHÈO VÀ DIỆN CHÍNH XÃ HỘI NĂM ${new Date().getFullYear()}

I. CHÍNH SÁCH HỖ TRỢ HIỆN HÀNH:
1. Hộ nghèo: Trợ cấp tiền điện (55.000đ/hộ/tháng), hỗ trợ 100% thẻ BHYT, miễn học phí cho con em đi học, được tiếp cận nguồn vốn vay ưu đãi của Ngân hàng CSXH.
2. Hộ cận nghèo: Hỗ trợ 70% mức đóng BHYT, con em được giảm 50% học phí tại các cơ sở giáo dục quốc lập.
3. Hộ chính sách (Thương binh/Bệnh binh/Chất độc hóa học): Nhận trợ cấp ưu đãi hàng tháng theo quy định chung, hỗ trợ cải thiện nhà ở nếu gặp khó khăn.

II. THỐNG KÊ THỰC TẾ TRÊN ĐỊA BÀN TỔ DÂN PHỐ ${tdpName.toUpperCase()}:
- Số hộ nghèo: ${poorHouseholds.length} hộ.
- Số hộ cận nghèo: ${nearPoorHouseholds.length} hộ.
- Số hộ chính sách có công: ${policyHouseholds.length} hộ.

I. DANH SÁCH CHI TIẾT CÁC HỘ THUỘC DIỆN QUẢN LÝ CHÍNH SÁCH:
${poorHouseholds.length > 0 ? '\n* Danh sách Hộ nghèo:\n' + poorHouseholds.map((h, i) => {
  const headRes = residents.find(r => r.household_id === h.id && r.is_head);
  return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
}).join('\n') : '* Không ghi nhận hộ nghèo nào.'}
${nearPoorHouseholds.length > 0 ? '\n* Danh sách Hộ cận nghèo:\n' + nearPoorHouseholds.map((h, i) => {
  const headRes = residents.find(r => r.household_id === h.id && r.is_head);
  return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
}).join('\n') : '* Không ghi nhận hộ cận nghèo nào.'}
${policyHouseholds.length > 0 ? '\n* Danh sách Hộ thương binh/chính sách:\n' + policyHouseholds.map((h, i) => {
  const headRes = residents.find(r => r.household_id === h.id && r.is_head);
  return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
}).join('\n') : '* Không ghi nhận hộ chính sách nào.'}

Tổ dân phố cam kết triển khai đúng, đủ các gói hỗ trợ và quà thăm hỏi từ chính quyền các cấp nhân các dịp ngày lễ tết.`;
    }

    // 3. Biên bản họp chi bộ
    if (query.includes('biên bản họp chi bộ') || query.includes('bien ban hop chi bo') || query.includes('biên bản chi bộ') || (query.includes('viết biên bản') && query.includes('chi bộ'))) {
      const secName = localStorage.getItem('party_secretary_name') || '...............';
      return `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardDisplay.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
*
BIÊN BẢN SINH HOẠT CHI BỘ THƯỜNG KỲ
(Thực hiện theo Hướng dẫn số 12-HD/BTCTW của Ban Tổ chức Trung ương)

Hôm nay, vào hồi ..... giờ ..... ngày ..... tháng ..... năm ....., tại .....
Chi bộ Tổ dân phố ${tdpName} đã tổ chức cuộc họp thường kỳ tháng ...../${new Date().getFullYear()}

I. THÀNH PHẦN THAM DỰ:
1. Số đảng viên được triệu tập: ..... đồng chí. Trong đó chính thức: ${partyMembers.filter(m => m.status === 'official').length}; dự bị: ${partyMembers.filter(m => m.status === 'probation').length}.
2. Đảng viên có mặt dự họp: ..... đồng chí.
3. Đảng viên vắng mặt: ..... đồng chí (Có lý do: .....; Không lý do: .....) .
4. Đại biểu Đảng ủy cấp trên tham dự (nếu có): .....
- Chủ trì cuộc họp: Đồng chí ${secName} - Bí thư Chi bộ.
- Thư ký cuộc họp: Đồng chí Chi ủy viên.

II. NỘI DUNG BUỔI HỌP:
1. Công tác chính trị, tư tưởng đảng viên:
- Đồng chí Bí thư phổ biến các tin tức thời sự nổi bật trong tháng và quán triệt các văn bản chỉ đạo mới nhất của Đảng ủy phường.
- Nhận xét tinh thần gương mẫu của đảng viên trong các hoạt động cộng đồng.

2. Báo cáo đánh giá hoạt động công tác tháng qua:
- Chi bộ lãnh đạo Ban điều hành tổ dân phố thực hiện tốt công tác quản lý cư trú: ${households.length} hộ, ${residents.length} nhân khẩu.
- Nhận xét ưu khuyết điểm cụ thể trong tháng.

3. Phương hướng công tác lãnh đạo tháng tới:
- Tập trung tuyên truyền an toàn giao thông, tổng vệ sinh môi trường.
- Triển khai thu các khoản đảng phí theo Quy định 01-QĐ/TW.
- Bồi dưỡng quần chúng ưu tú để giới thiệu kết nạp Đảng.

4. Ý kiến thảo luận của Đảng viên:
- Đồng chí ..... phát biểu ý kiến thảo luận về giải pháp .....
- Đồng chí ..... phát biểu ý kiến thảo luận về giải pháp .....

III. KẾT LUẬN & BIỂU QUYẾT:
Chi bộ thống nhất ban hành Nghị quyết họp với các nội dung trên. Tỷ lệ biểu quyết thông qua đạt 100% nhất trí.
Biên bản kết thúc vào lúc ..... giờ ..... cùng ngày.

     THƯ KÝ GHI BIÊN BẢN                    BÍ THƯ CHI BỘ
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           ${secName}`;
    }

    // 4. Kế hoạch học tập Nghị quyết Chi bộ
    if (query.includes('kế hoạch học tập nghị quyết') || query.includes('học tập nghị quyết') || (query.includes('kế hoạch') && query.includes('nghị quyết') && query.includes('chi bộ'))) {
      const secName = localStorage.getItem('party_secretary_name') || '...............';
      return `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardDisplay.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
*

KẾ HOẠCH
Học tập, quán triệt và triển khai thực hiện Nghị quyết
của Đảng ủy ${wardDisplay} tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}

Thực hiện Kế hoạch của Đảng ủy ${wardDisplay} về việc tổ chức học tập và quán triệt Nghị quyết, Chi bộ Tổ dân phố ${tdpName} xây dựng Kế hoạch học tập như sau:

I. MỤC ĐÍCH, YÊU CẦU:
1. Tất cả đảng viên trong Chi bộ phải nghiêm túc tham gia học tập, nắm vững nội dung cốt lõi của các Nghị quyết.
2. Trên cơ sở đó vận dụng sáng tạo vào thực tiễn, lãnh đạo tốt các nhiệm vụ chính trị của địa phương.

II. NỘI DUNG VÀ PHÂN CÔNG THỰC HIỆN:
1. Tổ chức học tập toàn bộ ${partyMembers.length} đảng viên trong Chi bộ.
2. Mời báo cáo viên (hoặc tự nghiên cứu tài liệu) theo tài liệu hướng dẫn của cấp trên.
3. Mỗi đảng viên viết bản thu hoạch cá nhân sau khi học tập xong.

III. THỜI GIAN VÀ ĐỊA ĐIỂM:
- Thời gian: ..... ngày ..... tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}.
- Địa điểm: Nhà văn hóa Tổ dân phố ${tdpName}.

IV. TỔ CHỨC THỰC HIỆN:
- Đồng chí Bí thư chủ trì, điều hành buổi học tập.
- Thư ký Chi ủy tổng hợp bản thu hoạch cá nhân và báo cáo về Đảng ủy phường.

                              ${tdpName}, ngày ${new Date().getDate().toString().padStart(2,'0')} tháng ${(new Date().getMonth()+1).toString().padStart(2,'0')} năm ${new Date().getFullYear()}
                              T/M CHI BỘ
                              BÍ THƯ


                              ${secName}`;
    }

    // 5. Báo cáo thi đua khen thưởng Chi bộ
    if (query.includes('thi đua khen thưởng') || query.includes('khen thưởng đảng viên') || (query.includes('đề nghị khen') && query.includes('chi bộ'))) {
      const secName = localStorage.getItem('party_secretary_name') || '...............';
      const officialCount = partyMembers.filter(m => m.status === 'official').length;
      return `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardDisplay.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
*

BÁO CÁO
Kết quả đánh giá, xếp loại và đề nghị khen thưởng đảng viên
năm ${new Date().getFullYear()}

Kính gửi: Đảng ủy ${wardDisplay}.

Thực hiện Hướng dẫn đánh giá, xếp loại tổ chức đảng và đảng viên cuối năm, Chi bộ Tổ dân phố ${tdpName} báo cáo kết quả như sau:

I. KẾT QUẢ ĐÁNH GIÁ, XẾP LOẠI ĐẢNG VIÊN:
- Tổng số đảng viên chính thức: ${officialCount} đồng chí.
- Đảng viên hoàn thành xuất sắc nhiệm vụ: ..... đồng chí.
- Đảng viên hoàn thành tốt nhiệm vụ: ..... đồng chí.
- Đảng viên hoàn thành nhiệm vụ: ..... đồng chí.
- Đảng viên không hoàn thành nhiệm vụ: 0 đồng chí.

II. ĐỀ NGHỊ KHEN THƯỞNG:
1. Danh hiệu "Đảng viên hoàn thành xuất sắc nhiệm vụ":
- Đồng chí ..... (Chức vụ: .....)
- Đồng chí ..... (Chức vụ: .....)

2. Đề nghị cấp trên công nhận Chi bộ đạt danh hiệu: "Tổ chức đảng hoàn thành xuất sắc nhiệm vụ".

III. KIẾN NGHỊ:
Kính đề nghị Đảng ủy ${wardDisplay} xem xét, phê duyệt kết quả đánh giá và công nhận các danh hiệu thi đua cho Chi bộ và đảng viên theo quy định.

                              ${tdpName}, ngày ${new Date().getDate().toString().padStart(2,'0')} tháng ${(new Date().getMonth()+1).toString().padStart(2,'0')} năm ${new Date().getFullYear()}
                              T/M CHI BỘ
                              BÍ THƯ


                              ${secName}`;
    }

    // 6. Biên bản kiểm tra hộ khẩu/rà soát dân cư (Tổ trưởng)
    if (query.includes('biên bản kiểm tra hộ khẩu') || query.includes('rà soát dân cư') || query.includes('kiểm tra hộ khẩu')) {
      const poorCount = households.filter(h => h.policy_type === 'poor').length;
      const nearPoorCount = households.filter(h => h.policy_type === 'near_poor').length;
      const policyCount = households.filter(h => h.policy_type === 'policy_family').length;
      return `TỔ DÂN PHỐ ${tdpName.toUpperCase()} - ${wardDisplay.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

BIÊN BẢN
Rà soát, kiểm tra hộ khẩu và nhân khẩu thường trú năm ${new Date().getFullYear()}

Hôm nay, ngày ..... tháng ..... năm ${new Date().getFullYear()}, Tổ dân phố ${tdpName} tiến hành rà soát định kỳ hộ khẩu và nhân khẩu trên địa bàn quản lý.

Thành phần thực hiện:
- ${leaderDisplay} — Tổ trưởng dân phố, chủ trì.
- Đại diện công an phường (nếu có): .....
- Đại diện Ban điều hành: .....

I. KẾT QUẢ RÀ SOÁT THỰC TẾ:
1. Tổng số hộ quản lý: ${households.length} hộ gia đình.
2. Tổng số nhân khẩu thường trú: ${residents.filter(r => r.status === 'resident').length} người.
3. Nhân khẩu tạm vắng: ${residents.filter(r => r.status === 'temporary_absent').length} người.
4. Nhân khẩu tạm trú: ${residents.filter(r => r.status === 'temporary_resident').length} người.

II. ĐỐI TƯỢNG ĐẶC BIỆT:
- Hộ nghèo: ${poorCount} hộ.
- Hộ cận nghèo: ${nearPoorCount} hộ.
- Hộ gia đình chính sách: ${policyCount} hộ.
- Người cao tuổi (từ 60 tuổi trở lên): ${residents.filter(r => r.is_senior).length} người.

III. NHẬN XÉT:
Tình trạng quản lý hộ khẩu cơ bản ổn định. Biên bản đã được đọc lại cho toàn thể những người có mặt nghe và nhất trí ký.

     THƯ KÝ GHI BIÊN BẢN                    TỔ TRƯỞNG DÂN PHỐ
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           ${leaderName}`;
    }

    // 7. Báo cáo an ninh trật tự (Tổ trưởng)
    if (query.includes('an ninh trật tự') || query.includes('báo cáo antt') || query.includes('an ninh tổ dân phố')) {
      return `TỔ DÂN PHỐ ${tdpName.toUpperCase()} - ${wardDisplay.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

BÁO CÁO
Tình hình an ninh trật tự tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}

Kính gửi: Ủy ban nhân dân ${wardDisplay} và Công an phường.

Ban điều hành Tổ dân phố ${tdpName} xin báo cáo tình hình an ninh trật tự trên địa bàn tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()} như sau:

I. TÌNH HÌNH CHUNG:
- Tổng số hộ dân quản lý: ${households.length} hộ, ${residents.length} nhân khẩu.
- Trong tháng, tình hình an ninh trật tự trên địa bàn về cơ bản ổn định. Không xảy ra tội phạm, tệ nạn xã hội, mâu thuẫn nghiêm trọng.

II. CÁC HOẠT ĐỘNG PHÒNG NGỪA:
1. Duy trì tổ tự quản an ninh trật tự, thực hiện tuần tra định kỳ ban đêm theo lịch.
2. Tuyên truyền bà con cảnh giác với tội phạm lừa đảo qua mạng, trộm cắp tài sản.
3. Vận động nhân dân cung cấp thông tin tội phạm theo kênh đường dây nóng công an phường.
4. Phối hợp với Công an khu vực nắm địa bàn, giải quyết kịp thời các phát sinh nhỏ.

III. KIẾN NGHỊ:
- Đề nghị Công an phường tăng cường tuần tra khu vực ngõ nhỏ, khu vực ít người qua lại về ban đêm.
- Tiếp tục hỗ trợ lắp đặt camera an ninh tại các điểm xung yếu trên địa bàn.

                              ${tdpName}, ngày ${new Date().getDate().toString().padStart(2,'0')} tháng ${(new Date().getMonth()+1).toString().padStart(2,'0')} năm ${new Date().getFullYear()}
                              TỔ TRƯỞNG DÂN PHỐ
                              (Ký, ghi rõ họ tên)


                              ${leaderName}`;
    }

    // 8. Thông báo Ngày hội Đại đoàn kết (Mặt trận)
    if (query.includes('thông báo ngày hội') || query.includes('thông báo đại đoàn kết') || (query.includes('thông báo') && query.includes('18/11'))) {
      return `ỦY BAN MTTQ VN ${wardDisplay.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

THÔNG BÁO
V/v Tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm ${new Date().getFullYear()}

Kính gửi: Toàn thể nhân dân, hộ gia đình và đại diện các tổ chức đoàn thể tại ${tdpDisplay}.

Thực hiện kế hoạch của Ủy ban Mặt trận Tổ quốc Việt Nam ${wardDisplay} về việc tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm ${new Date().getFullYear()}, nhân kỷ niệm Ngày Truyền thống MTTQ Việt Nam (18/11).

Ban công tác Mặt trận ${tdpDisplay} trân trọng kính mời:

1. THÀNH PHẦN THAM DỰ:
- Toàn thể nhân dân, đại diện các hộ gia đình trong Tổ dân phố.
- Đại diện lãnh đạo UBND phường, Mặt trận phường và các đoàn thể.

2. THỜI GIAN VÀ ĐỊA ĐIỂM:
- Thời gian: 8 giờ 00 ngày 18 tháng 11 năm ${new Date().getFullYear()}.
- Địa điểm: Nhà văn hóa Tổ dân phố ${tdpName}.

3. NỘI DUNG CHƯƠNG TRÌNH:
- Khai mạc, ôn lại lịch sử truyền thống MTTQ Việt Nam.
- Biểu dương các hộ gia đình văn hóa, cá nhân tiêu biểu xuất sắc.
- Trao quà thăm hỏi các gia đình chính sách, hộ có hoàn cảnh khó khăn.
- Giao lưu văn nghệ quần chúng.

Kính mong toàn thể nhân dân sắp xếp thời gian, tham gia đầy đủ và đúng giờ!

                              ${tdpName}, ngày ${new Date().getDate().toString().padStart(2,'0')} tháng ${(new Date().getMonth()+1).toString().padStart(2,'0')} năm ${new Date().getFullYear()}
                              TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                              (Ký, ghi rõ họ tên)


                              ${leaderName}`;
    }

    // 9. Biên bản họp Ban công tác Mặt trận
    if ((query.includes('biên bản') && query.includes('mặt trận')) || query.includes('biên bản họp mặt trận')) {
      return `ỦY BAN MTTQ VN ${wardDisplay.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

BIÊN BẢN HỌP BAN CÔNG TÁC MẶT TRẬN
Tổ dân phố ${tdpName} — Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}

Hôm nay, vào lúc ..... giờ, ngày ..... tháng ..... năm ${new Date().getFullYear()}, tại Nhà văn hóa ${tdpDisplay}.

I. THÀNH PHẦN THAM DỰ:
- Chủ trì: ${leaderDisplay} — Trưởng Ban công tác Mặt trận.
- Thư ký: .....
- Thành viên Ban công tác Mặt trận có mặt: ..... / ..... thành viên.

II. NỘI DUNG CUỘC HỌP:
1. Đánh giá kết quả công tác Mặt trận tháng qua:
- Công tác tuyên truyền chính sách pháp luật đến ${households.length} hộ gia đình đã hoàn thành.
- Tình hình đoàn kết khu dân cư ổn định, không có mâu thuẫn phát sinh.
- Kết quả vận động các quỹ xã hội: Đạt .....% kế hoạch đề ra.

2. Bàn công tác Mặt trận tháng tới:
- Chuẩn bị tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm ${new Date().getFullYear()}.
- Tiếp tục vận động ủng hộ Quỹ Vì người nghèo và Quỹ An sinh xã hội.
- Phối hợp với Chi bộ và Ban điều hành TDP tổ chức tốt các hoạt động cộng đồng.

III. KẾT LUẬN:
Cuộc họp kết thúc vào lúc ..... giờ cùng ngày. Biên bản được thống nhất thông qua.

     THƯ KÝ GHI BIÊN BẢN               TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           ${leaderName}`;
    }

    // 10. Báo cáo thăm hỏi hộ nghèo / trao quà (Mặt trận)
    if (query.includes('thăm hỏi hộ nghèo') || query.includes('trao quà') || (query.includes('báo cáo') && query.includes('thăm hỏi'))) {
      const poorHH = households.filter(h => h.policy_type === 'poor');
      const policyHH = households.filter(h => h.policy_type === 'policy_family');
      return `ỦY BAN MTTQ VN ${wardDisplay.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

BÁO CÁO
Kết quả thăm hỏi, tặng quà các gia đình chính sách,
hộ nghèo và hộ khó khăn nhân dịp Lễ, Tết năm ${new Date().getFullYear()}

Kính gửi: Ban Thường trực UBMTTQ Việt Nam ${wardDisplay}.

Thực hiện kế hoạch và hướng dẫn của cấp trên, Ban công tác Mặt trận Tổ dân phố ${tdpName} báo cáo kết quả thăm hỏi và tặng quà như sau:

I. ĐỐI TƯỢNG ĐƯỢC THĂM HỎI:
- Số hộ nghèo được thăm hỏi, tặng quà: ${poorHH.length} hộ.
- Số hộ gia đình chính sách được thăm hỏi: ${policyHH.length} hộ.
- Số hộ khó khăn đột xuất được hỗ trợ: ..... hộ.
- Tổng số suất quà đã trao: ..... suất.

II. GIÁ TRỊ QUÀ TẶNG:
- Nguồn từ Quỹ Vì người nghèo MTTQ phường: ..... suất × 200.000 đồng/suất.
- Nguồn từ Ban điều hành TDP vận động: ..... suất × 200.000 đồng/suất.
- Nguồn do cá nhân, doanh nghiệp hảo tâm ủng hộ trực tiếp: ..... suất.

III. KẾT QUẢ VÀ Ý NGHĨA:
Cuộc thăm hỏi đã tạo ra không khí ấm áp, thể hiện tinh thần "tương thân tương ái" của truyền thống dân tộc. Các gia đình được thăm hỏi đều bày tỏ sự xúc động và lòng biết ơn sâu sắc.

                              ${tdpName}, ngày ${new Date().getDate().toString().padStart(2,'0')} tháng ${(new Date().getMonth()+1).toString().padStart(2,'0')} năm ${new Date().getFullYear()}
                              TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                              (Ký, ghi rõ họ tên)


                              ${leaderName}`;
    }


    const isPlanVoluntary = query.includes('kế hoạch vận động') || (query.includes('kế hoạch') && (query.includes('vận động') || query.includes('đóng góp') || query.includes('tự nguyện')));
    const isMeetingVoluntary = (query.includes('hội nghị nhân dân') || query.includes('nội dung họp')) && (query.includes('đóng góp') || query.includes('vận động') || query.includes('tự nguyện'));

    if (isPlanVoluntary) {
      const numHouseholds = households.length > 0 ? households.length : 1500;
      const totalAmountEstimate = numHouseholds * 200000;
      const totalAmountText = new Intl.NumberFormat('vi-VN').format(totalAmountEstimate) + ' đồng';
      const day = new Date().getDate().toString().padStart(2, '0');
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const year = new Date().getFullYear();
      const leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';

      return `UBND PHƯỜNG ${wardName.toUpperCase().replace('PHƯỜNG ', '')}         CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
TỔ DÂN PHỐ ${tdpName.toUpperCase()}                           Độc lập – Tự do – Hạnh phúc
Số: 01 /KH-TDPKT                           ---------------------------

BÁO CÁO KẾ HOẠCH VẬN ĐỘNG CÁC KHOẢN ĐÓNG GÓP TỰ
NGUYỆN NĂM 2026
Về việc vận động các khoản đóng góp tự nguyện phục vụ hoạt động cộng đồng năm 2026.

Kính gửi: UBND phường ${wardName.replace('Phường ', '')}

Căn cứ nhu cầu thực tế của cộng đồng dân cư ${tdpDisplay}; nhằm đảm bảo nguồn kinh phí phục vụ các hoạt động xã hội, văn hóa, khuyến học, an sinh và các hoạt động cộng đồng khác trên địa bàn, ${tdpDisplay} xây dựng kế hoạch vận động các khoản đóng góp tự nguyện năm 2026 như sau:

I. MỤC ĐÍCH, YÊU CẦU
1. Huy động nguồn lực xã hội hóa để phục vụ các hoạt động chung của cộng đồng dân cư.
2. Việc vận động được thực hiện trên tinh thần tự nguyện, công khai, minh bạch, dân chủ và đúng quy định của pháp luật.
3. Các khoản thu, chi được công khai trước Nhân dân và báo cáo theo quy định.

II. NỘI DUNG VẬN ĐỘNG
1. Quỹ khuyến học
• Khen thưởng học sinh đạt thành tích xuất sắc trong học tập.
• Hỗ trợ học sinh có hoàn cảnh khó khăn vươn lên trong học tập.
• Tổ chức các hoạt động khuyến học, khuyến tài tại khu dân cư.
2. Quỹ an sinh xã hội
• Thăm hỏi, hỗ trợ các hộ gia đình có hoàn cảnh khó khăn.
• Hỗ trợ các trường hợp ốm đau, bệnh tật, thiên tai, rủi ro đột xuất.
• Thực hiện các hoạt động nhân đạo, từ thiện trên địa bàn.
3. Quỹ văn hóa - thể thao
• Tổ chức các hoạt động văn hóa, văn nghệ, thể dục thể thao hè năm 2026.
• Tổ chức các chương trình giao lưu, sinh hoạt cộng đồng.
• Hỗ trợ các hoạt động nhân dịp lễ, tết và các ngày kỷ niệm.
4. Kinh phí xã hội hóa điện, nước, internet và bảo vệ Nhà văn hóa TDP
• Thanh toán chi phí điện, nước sinh hoạt tại Nhà văn hóa.
• Duy trì đường truyền internet phục vụ hội họp, tuyên truyền và chuyển đổi số.
• Hỗ trợ công tác quản lý, bảo vệ, giữ gìn cơ sở vật chất Nhà văn hóa.
5. Quỹ chăm sóc cảnh quan, môi trường
• Trồng và chăm sóc cây xanh, hoa trên các tuyến đường.
• Tổ chức các hoạt động vệ sinh môi trường.
• Chỉnh trang cảnh quan, xây dựng khu dân cư sáng - xanh - sạch - đẹp.
6. Quỹ sinh hoạt đám hiếu
• Hỗ trợ các hoạt động chung của cộng đồng trong việc tổ chức tang lễ theo quy ước, hương ước của khu dân cư.
• Góp phần phát huy tinh thần đoàn kết, tương trợ lẫn nhau trong Nhân dân.

III. HÌNH THỨC VẬN ĐỘNG
• Tổ chức họp Nhân dân để lấy ý kiến thống nhất.
• Mức đóng góp cụ thể sẽ được Nhân dân thảo luận, biểu quyết và thống nhất tại hội nghị.
• Khuyến khích các tổ chức, doanh nghiệp, cá nhân trên địa bàn tham gia ủng hộ trên tinh thần tự nguyện.

IV. TỔ CHỨC THỰC HIỆN
1. Sau khi được UBND phường thống nhất chủ trương, Tổ dân phố tổ chức hội nghị Nhân dân để triển khai thực hiện.
2. Thành lập bộ phận quản lý quỹ, theo dõi thu - chi theo đúng quy định.
3. Định kỳ công khai kết quả thu - chi trước Nhân dân.
4. Thực hiện chế độ báo cáo với UBND phường theo quy định.

${tdpDisplay} kính đề nghị UBND phường ${wardName.replace('Phường ', '')} xem xét, cho ý kiến và thống nhất chủ trương để Tổ dân phố tổ chức họp Nhân dân triển khai thực hiện.
Xin trân trọng cảm ơn!

                                                           ${tdpName}, ngày ${day} tháng ${month} năm ${year}
                                                          TRƯỞNG TỔ DÂN PHỐ ${tdpName.toUpperCase()}
                                                          
                                                          
                                                          
                                                          ${leaderName}`;
    }

    if (isMeetingVoluntary) {
      const numHouseholds = households.length > 0 ? households.length : 1500;
      const totalAmountEstimate = numHouseholds * 200000;
      const totalAmountText = new Intl.NumberFormat('vi-VN').format(totalAmountEstimate) + ' đồng';

      return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
TỔ DÂN PHỐ ${tdpName.toUpperCase()}

NỘI DUNG HỘI NGHỊ NHÂN DÂN
Về việc vận động các khoản đóng góp tự nguyện phục vụ hoạt động cộng đồng năm 2026.

Kính thưa toàn thể Nhân dân ${tdpDisplay}!

Nhằm tạo nguồn kinh phí phục vụ các hoạt động chung của cộng đồng dân cư, góp phần xây dựng ${tdpDisplay} ngày càng văn minh, đoàn kết và phát triển, Tổ dân phố đề xuất hội nghị Nhân dân xem xét, thảo luận và thống nhất việc vận động các khoản đóng góp tự nguyện năm 2026 như sau:

1. Quỹ khuyến học
Mục đích:
• Khen thưởng học sinh đạt thành tích xuất sắc trong học tập.
• Động viên các em học sinh chăm ngoan, học giỏi.
• Hỗ trợ học sinh có hoàn cảnh khó khăn vươn lên trong học tập.

2. Quỹ an sinh xã hội
Mục đích:
• Thăm hỏi các hộ gia đình có hoàn cảnh khó khăn.
• Hỗ trợ các trường hợp ốm đau, bệnh tật, rủi ro đột xuất.
• Thực hiện các hoạt động nhân đạo, tương thân tương ái trong cộng đồng.

3. Quỹ văn hóa - thể thao
Mục đích:
• Tổ chức các hoạt động văn hóa, văn nghệ, thể dục thể thao hè năm 2026.
• Tổ chức các hoạt động giao lưu, sinh hoạt cộng đồng.
• Nâng cao đời sống tinh thần cho Nhân dân.

4. Kinh phí xã hội hóa điện, nước, internet và bảo vệ Nhà văn hóa TDP
Mục đích:
• Chi trả tiền điện, nước phục vụ các hoạt động tại Nhà văn hóa.
• Duy trì đường truyền internet phục vụ công tác chuyển đổi số và hội họp.
• Hỗ trợ công tác quản lý, bảo vệ và giữ gìn cơ sở vật chất Nhà văn hóa.

5. Quỹ chăm sóc cảnh quan, môi trường
Mục đích:
• Trồng và chăm sóc cây xanh, hoa trên các tuyến đường.
• Tổ chức các đợt vệ sinh môi trường.
• Chỉnh trang cảnh quan khu dân cư sáng - xanh - sạch - đẹp.

6. Quỹ sinh hoạt đám hiếu
Mục đích:
• Hỗ trợ các hoạt động chung khi gia đình trong tổ dân phố có việc hiếu.
• Thể hiện tinh thần đoàn kết, tương trợ giữa các hộ dân.
• Duy trì và phát huy các giá trị văn hóa, tình làng nghĩa xóm.

* Đề xuất mức đóng góp:
Hội nghị thảo luận và thống nhất mức đóng góp phù hợp đối với từng quỹ trên cơ sở tự nguyện, công khai, dân chủ và đúng quy định hiện hành.

Gợi ý mức thu tham khảo để Hội nghị thảo luận:
- Quỹ khuyến học: 50.000 đồng/hộ/năm
- Quỹ an sinh xã hội: 20.000 đồng/hộ/năm
- Quỹ văn hóa - thể thao: 30.000 đồng/hộ/năm
- Điện, nước, internet, bảo vệ NVH: 50.000 đồng/hộ/năm
- Quỹ môi trường: 20.000 đồng/hộ/năm
- Quỹ đám hiếu: 30.000 đồng/hộ/năm
=> TỔNG CỘNG: 200.000 đồng/hộ/năm.

Với quy mô khoảng ${numHouseholds} hộ dân, nếu toàn thể Nhân dân thống nhất mức 200.000 đồng/hộ/năm thì tổng nguồn quỹ dự kiến là khoảng ${totalAmountText} (dự kiến ${new Intl.NumberFormat('vi-VN').format(totalAmountEstimate)} đồng/năm), đủ để duy trì nhiều hoạt động cộng đồng của ${tdpDisplay}.

Công khai, minh bạch:
• Mọi khoản thu, chi đều được ghi chép, quản lý đầy đủ.
• Định kỳ công khai trước Nhân dân.
• Sử dụng đúng mục đích, đúng nội dung đã được Nhân dân thống nhất.

Kính đề nghị toàn thể Nhân dân tham gia thảo luận, đóng góp ý kiến và biểu quyết để thống nhất thực hiện.
Xin trân trọng cảm ơn!`;
    }

    let title = 'THÔNG BÁO';
    let content = '';

    // Date extractors (rough regex heuristics)
    let time = '19 giờ 30 phút';
    if (query.includes('19h') || query.includes('19 giờ')) time = '19 giờ 30 phút';
    else if (query.includes('20h') || query.includes('20 giờ')) time = '20 giờ 00 phút';
    else if (query.includes('8h') || query.includes('8 giờ sáng')) time = '08 giờ 00 phút';

    let date = 'ngày 15 tháng 06 năm 2026';
    if (query.includes('thứ hai') || query.includes('thứ 2')) date = 'ngày 15 tháng 06 năm 2026 (Thứ Hai)';
    else if (query.includes('chủ nhật') || query.includes('cn')) date = 'ngày 21 tháng 06 năm 2026 (Chủ Nhật)';
    else if (query.includes('thứ bảy') || query.includes('thứ 7')) date = 'ngày 20 tháng 06 năm 2026 (Thứ Bảy)';

    let location = `Nhà văn hóa ${tdpDisplay}`;
    if (query.includes('ngõ 45')) location = `Khu vực Ngõ 45, ${tdpName}`;
    else if (query.includes('ngõ 47')) location = `Khu vực Ngõ 47, ${tdpName}`;

    if (docType === 'party') {
      if (query.includes('nghị quyết')) {
        title = `NGHỊ QUYẾT\nHọp Chi bộ Tổ dân phố ${tdpName.toUpperCase()} tháng ${(new Date().getMonth() + 1)}/${new Date().getFullYear()}`;
        
        let targetTopic = 'Lãnh đạo thực hiện nhiệm vụ phát triển kinh tế - xã hội, giữ vững an ninh trật tự địa bàn dân cư';
        if (query.includes('an ninh') || query.includes('trật tự')) targetTopic = 'Lãnh đạo tăng cường công tác tuần tra đêm phòng chống tội phạm và bảo đảm an ninh trật tự';
        else if (query.includes('vệ sinh') || query.includes('môi trường')) targetTopic = 'Lãnh đạo phát động phong trào bảo vệ môi trường, dọn sạch ngõ xóm';

        content = `
Vào lúc ${time}, ${date}, tại ${location}, Chi bộ Tổ dân phố ${tdpName} đã tổ chức cuộc họp thường kỳ.
- Chủ trì cuộc họp: Đồng chí Bí thư Chi bộ.
- Thư ký họp: Đồng chí Chi ủy viên.
- Thành phần: Có mặt ${partyMembers.length}/${partyMembers.length} đồng chí Đảng viên trong Chi bộ.

Sau khi nghe báo cáo kết quả và thảo luận, Chi bộ thống nhất ban hành Nghị quyết gồm các nội dung chính:

1. Đánh giá công tác tư tưởng Đảng viên:
- Tiếp tục thực hiện tốt công tác giáo dục chính trị tư tưởng, đảm bảo 100% Đảng viên gương mẫu đi đầu trong mọi phong trào tại địa phương.

2. Lãnh đạo thực hiện công tác chuyên đề:
- Thống nhất chủ trương: ${targetTopic}.
- Phân công nhiệm vụ cụ thể cho từng đồng chí Đảng viên phụ trách từng ngõ xóm để đôn đốc bà con nhân dân.

3. Công tác tổ chức và thu chi Đảng phí:
- Thực hiện thu nộp Đảng phí tháng theo đúng Quy định 01-QĐ/TW 2026.
- Tiếp tục bồi dưỡng quần chúng ưu tú để đề xuất kết nạp Đảng viên mới.

Nghị quyết này được 100% Đảng viên dự họp biểu quyết nhất trí thông qua.
        `;
      } else {
        title = `BÁO CÁO\nTình hình sinh hoạt và hoạt động Chi bộ tháng ${(new Date().getMonth() + 1)}/${new Date().getFullYear()}`;
        const officialCount = partyMembers.filter(m => m.status === 'official').length;
        const probationCount = partyMembers.filter(m => m.status === 'probation').length;
        
        content = `
Kính gửi: Đảng ủy ${wardDisplay}.

Chi bộ Tổ dân phố ${tdpName} xin báo cáo kết quả công tác hoạt động trong tháng như sau:

1. Tình hình tổ chức Chi bộ:
- Tổng số Đảng viên: ${partyMembers.length} đồng chí.
- Trong đó: Đảng viên chính thức: ${officialCount} đồng chí; Đảng viên dự bị: ${probationCount} đồng chí.
- Đảng viên miễn sinh hoạt (ốm đau, già yếu): 0 đồng chí.

2. Công tác lãnh đạo thực hiện nhiệm vụ chính trị:
- Chỉ đạo Ban điều hành Tổ dân phố hoàn thành tốt việc quản lý dân cư, nhân khẩu với tổng số ${households.length} hộ gia đình và ${residents.length} nhân khẩu.
- Lãnh đạo giải quyết kịp thời các phản ánh dân nguyện của bà con (Đã giải quyết thành công các mâu thuẫn tranh chấp nhỏ trên địa bàn).

3. Công tác xây dựng Đảng:
- Tổ chức học tập nghị quyết của Đảng ủy cấp trên đầy đủ.
- Thu nộp Đảng phí đầy đủ, nộp về Đảng ủy phường đúng thời hạn.
- Chi bộ sinh hoạt đúng định kỳ, duy trì nề nếp kỷ luật Đảng nghiêm minh.

Phương hướng tháng tới: Tiếp tục phát huy vai trò lãnh đạo toàn diện của Chi bộ trong các công tác an sinh xã hội địa phương.
        `;
      }
    } else if (docType === 'front') {
      if (query.includes('đại đoàn kết') || query.includes('ngày hội')) {
        title = `BÁO CÁO\nKết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm ${new Date().getFullYear()}`;
        
        content = `
Kính gửi: Ủy ban Mặt trận Tổ quốc Việt Nam ${wardDisplay}.

Thực hiện hướng dẫn của cấp trên, Ban công tác Mặt trận Tổ dân phố ${tdpName} báo cáo kết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc như sau:

1. Công tác tổ chức Ngày hội:
- Thời gian tổ chức: ${time}, ${date}.
- Địa điểm tổ chức: ${location}.
- Thành phần tham gia: Đại diện lãnh đạo phường, Ban công tác Mặt trận, tổ trưởng dân phố và đại diện của ${households.length} hộ gia đình tham gia đông đủ.

2. Kết quả nội dung Ngày hội:
- Phần Lễ: Ôn lại lịch sử vẻ quang Ngày truyền thống MTTQ Việt Nam. Đánh giá kết quả Cuộc vận động "Toàn dân đoàn kết xây dựng nông thôn mới, đô thị văn minh".
- Biểu dương, khen thưởng các gia đình văn hóa tiêu biểu xuất sắc trong năm qua.
- Phần Hội: Tổ chức giao lưu văn nghệ quần chúng ấm cúng, vui tươi, thắt chặt tinh thần đoàn kết lối xóm.

3. Đánh giá chung:
Ngày hội đã tạo không khí phấn khởi, đoàn kết, nâng cao vai trò của Mặt trận trong việc khơi dậy sức mạnh của toàn dân tại Tổ dân phố ${tdpName}.
        `;
      } else {
        title = `BÁO CÁO\nKết quả vận động ủng hộ Quỹ an sinh xã hội năm ${new Date().getFullYear()}`;
        const fundName = query.includes('khuyến học') ? 'Quỹ Khuyến học địa phương' : 'Quỹ Vì người nghèo';
        
        content = `
Kính gửi: Ban Thường trực Ủy ban MTTQ Việt Nam ${wardDisplay}.

Ban công tác Mặt trận Tổ dân phố ${tdpName} xin báo cáo kết quả cuộc vận động đóng góp xây dựng quỹ xã hội như sau:

1. Công tác tuyên truyền, vận động:
- Ban công tác Mặt trận đã phối hợp cùng các tổ chức thành viên đến từng ngõ xóm, hộ gia đình để phổ biến ý nghĩa nhân văn của cuộc vận động đóng góp xây dựng ${fundName}.

2. Kết quả thu nộp:
- Tổng số hộ dân tham gia đóng góp ủng hộ: ${households.length} hộ gia đình.
- Số tiền vận động thu nộp thực tế: ${formatCurrency(totalIncome * 0.4 || 5000000)} (Đã nộp toàn bộ về tài khoản quỹ an sinh xã hội cấp trên quản lý).
- Ghi nhận một số cá nhân, gia đình tiêu biểu xuất sắc đi đầu trong đợt vận động ủng hộ.

3. Kế hoạch phân bổ:
Dành một phần kinh ý hỗ trợ các hộ gia đình có hoàn cảnh đặc biệt khó khăn, hộ cận nghèo trên địa bàn Tổ dân phố nhân dịp Lễ, Tết sắp tới.
        `;
      }
    } else {
      if (query.includes('họp dân') || query.includes('họp tổ') || query.includes('mời họp')) {
        title = 'THÔNG BÁO V/v Tổ chức cuộc họp Tổ dân phố';
        
        let reason = 'Bàn bạc một số công việc chung của Tổ dân phố';
        if (query.includes('vệ sinh') || query.includes('rác')) reason = 'Triển khai công tác dọn dẹp vệ sinh môi trường ngõ xóm';
        else if (query.includes('đóng quỹ') || query.includes('thu tiền')) reason = 'Phổ biến và thu nộp các loại quỹ cộng đồng năm 2026';
        else if (query.includes('bê tông') || query.includes('làm đường')) reason = 'Bàn thảo phương án đóng góp kinh phí bê tông hóa đường ngõ';

        content = `
Thực hiện kế hoạch hoạt động của UBND ${wardDisplay} và Ban điều hành ${tdpDisplay}, trân trọng kính mời đại diện các hộ gia đình đến tham dự cuộc họp dân.

1. Mục đích họp:
- ${reason}.
- Trao đổi, ghi nhận các phản ánh, đề xuất của bà con.

2. Thời gian: ${time}, ${date}.
3. Địa điểm: ${location}.

Rất mong đại diện các hộ gia đình sắp xếp thời gian, tham gia đầy đủ và đúng giờ để cuộc họp đạt kết quả tốt nhất. Xin trân trọng cảm ơn!
        `;
      } 
      else if (query.includes('biên bản')) {
        title = `BIÊN BẢN HỌP ${tdpUpper}`;
        
        let reason = 'Bàn bạc công tác nội bộ Tổ dân phố';
        if (query.includes('bê tông')) reason = 'Họp bàn thống nhất đóng góp đổ bê tông đường ngõ';
        else if (query.includes('vệ sinh')) reason = 'Họp triển khai phong trào Ngày chủ nhật xanh';

        content = `
Hôm nay, vào lúc ${time}, ${date}, tại ${location} đã diễn ra cuộc họp ${tdpDisplay}.

I. THÀNH PHẦN THAM DỰ:
1. Chủ trì cuộc họp: ${leaderDisplay} - Tổ trưởng dân phố.
2. Thư ký ghi biên bản: Bà Lê Thị Dung.
3. Số lượng đại biểu tham dự: Đại diện của ${households.length} hộ gia đình.

II. NỘI DUNG CUỘC HỌP:
1. ${leaderDisplay} trình bày lý do cuộc họp: ${reason}.
2. Bà con nhân dân thảo luận và đưa ra ý kiến đóng góp:
- Ý kiến 1: Nhất trí hoàn toàn với chủ trương của ban điều hành TDP.
- Ý kiến 2: Đề nghị công khai minh bạch tài chính sau khi thực hiện xong.
3. Biểu quyết thông qua:
- Số hộ đồng ý: 100%.
- Ý kiến khác: Không.

Cuộc họp kết thúc vào lúc 21 giờ 30 phút cùng ngày, biên bản đã được thông qua trước toàn thể cuộc họp.
        `;
      } 
      else if (query.includes('quỹ') || query.includes('vận động') || query.includes('thư ngỏ')) {
        title = 'THƯ NGỎ KÊU GỌI ỦNG HỘ QUỸ VẬN ĐỘNG';
        let fundName = 'Quỹ Đền ơn đáp nghĩa & Vì người nghèo năm 2026';
        if (query.includes('khuyến học')) fundName = 'Quỹ Khuyến học phát triển tài năng trẻ';

        content = `
Kính gửi: Toàn thể bà con nhân dân, các hộ gia đình và nhà hảo tâm đang sinh sống tại ${tdpDisplay}.

Phát huy truyền thống tương thân tương ái, "lá lành đùm lá rách" của dân tộc Việt Nam và chăm lo tốt hơn cho các gia đình có hoàn cảnh khó khăn trên địa bàn.

Ban điều hành ${tdpDisplay} tha thiết kêu gọi toàn thể bà con tích cực tham gia đóng góp ủng hộ ${fundName}.

Mọi sự ủng hộ đóng góp tự nguyện xin gửi về:
- Ban thủ quỹ Tổ dân phố (Nhà văn hóa) hoặc đóng trực tiếp cho các cán bộ tổ dân phố đi vận động tận nhà.
- Thời gian vận động: Từ nay đến hết ngày 30/06/2026.

Mỗi tấm lòng của quý vị sẽ góp phần xây dựng một cộng đồng ${tdpName} ngày càng ấm no, đoàn kết và phát triển. Xin chân thành cảm ơn sự đồng hành của quý bà con!
        `;
      } 
      else if (query.includes('báo cáo')) {
        title = `BÁO CÁO TÌNH HÌNH HOẠT ĐỘNG THÁNG 06/2026`;
        const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
        content = `
Kính gửi: Ủy ban nhân dân ${wardDisplay}.

Ban điều hành ${tdpDisplay} xin báo cáo kết quả hoạt động tháng vừa qua như sau:

1. Công tác Dân số - Địa bàn:
- Tổng số hộ gia đình quản lý: ${households.length} hộ.
- Tổng số nhân khẩu thực tế: ${residents.length} nhân khẩu (trong đó có ${residents.filter(r => r.is_senior).length} người cao tuổi và ${residents.filter(r => getAge(r.dob) < 16).length} trẻ em).

2. Công tác Phản ánh - Dân nguyện:
- Tiếp nhận tổng cộng: ${complaints.length} ý kiến phản ánh.
- Đã giải quyết triệt để: ${resolvedComplaints} vụ việc. Còn ${complaints.filter(c => c.status === 'pending').length} vụ việc đang tiếp tục giải quyết.

3. Công tác Tài chính - Quỹ cộng đồng:
- Số dư hiện tại của quỹ TDP: ${formatCurrency(balance)}.
- Tổng thu trong tháng: ${formatCurrency(totalIncome)}.
- Tổng chi thiết yếu trong tháng: ${formatCurrency(totalExpense)}.

Ban điều hành TDP sẽ tiếp tục duy trì hoạt động tốt trong thời gian tới.
        `;
      } 
      else {
        // General custom notice format
        title = 'THÔNG BÁO CHUNG';
        content = `
Kính gửi: Toàn thể nhân dân ${tdpDisplay}.

Ban điều hành Tổ dân phố xin thông báo nội dung sau:

${userPrompt}

Yêu cầu bà con nhân dân lưu ý và phối hợp thực hiện nghiêm túc nội dung trên.

TỔ TRƯỞNG DÂN PHỐ
(Đã ký)
        `;
      }
    }

    // Lấy tên Bí thư Chi bộ từ cấu hình Chi bộ Đảng
    const partySecretaryName = localStorage.getItem('party_secretary_name') || '';
    const partySecretaryDisplay = partySecretaryName.trim() || '(Ký, ghi rõ họ tên)';

    // Định dạng ngày tháng năm đúng chuẩn
    const d = new Date();
    const dayStr = d.getDate().toString().padStart(2, '0');
    const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = d.getFullYear();
    const dateStr = `ngày ${dayStr} tháng ${monthStr} năm ${yearStr}`;

    // ─── Tạo văn bản cuối cùng theo từng loại ───
    let finalDocument = '';

    if (docType === 'party') {
      // Văn bản Đảng: tiêu đề bên trái "ĐẢNG CỘNG SẢN VIỆT NAM"
      finalDocument = `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardDisplay.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
*

${title}

${content}

                              ${tdpName}, ${dateStr}
                              T/M CHI BỘ
                              BÍ THƯ


                              ${partySecretaryDisplay}`;

    } else if (docType === 'front') {
      // Văn bản Mặt trận: tiêu đề bên phải "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
      finalDocument = `ỦY BAN MTTQ VN ${wardDisplay.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

${title}

${content}

                              ${tdpName}, ${dateStr}
                              TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                              (Ký, ghi rõ họ tên)


                              ${leaderDisplay.replace(/^(Ông|Bà)\s+/i, '')}`;

    } else {
      // Văn bản hành chính chung: theo mẫu UBND/TDP
      finalDocument = `${tdpHeader} - ${wardDisplay.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

${title}

${content}

                              ${tdpName}, ${dateStr}
                              TỔ TRƯỞNG DÂN PHỐ
                              (Ký, ghi rõ họ tên)


                              ${leaderDisplay.replace(/^(Ông|Bà)\s+/i, '')}`;
    }

    return finalDocument;
  };

  const typeText = (text: string) => {
    let currentIdx = 0;
    setResult('');
    const step = 8;
    const interval = setInterval(() => {
      currentIdx += step;
      if (currentIdx >= text.length) {
        setResult(text);
        clearInterval(interval);
      } else {
        setResult(text.substring(0, currentIdx));
      }
    }, 15);
  };

  const handleGenerate = (customPrompt?: string) => {
    const pText = typeof customPrompt === 'string' ? customPrompt : prompt;
    if (!pText) return;
    setIsGenerating(true);
    setIsCopied(false);
    setResult(null);
    setTimeout(async () => {
      const doc = await generateDocument(pText);
      setIsGenerating(false);
      typeText(doc);
    }, 1200);
  };

  const triggerQuickPrompt = (q: string) => {
    setPrompt(q);
    handleGenerate(q);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setIsCopied(true);
    showToast('Đã sao chép văn bản vào khay nhớ tạm!', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `van_ban_soan_thao_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tải văn bản (.txt) thành công!', 'success');
  };

  const handlePrint = () => {
    if (!result) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cho phép mở popup trên trình duyệt!', 'danger');
      return;
    }

    // Hàm phụ trợ xử lý chữ ký thông minh dạng bảng
    const renderBodyWithTableSignature = (bodyLines: string[]) => {
      let sigStartIndex = -1;
      let isDoubleSignature = false;

      // Duyệt ngược từ cuối lên tối đa 15 dòng để tìm dòng bắt đầu phần chữ ký
      for (let i = bodyLines.length - 1; i >= Math.max(0, bodyLines.length - 15); i--) {
        const line = bodyLines[i].trim();
        if (!line) continue;
        
        // Nếu dòng chứa cả Thư ký và chức danh khác -> đây là biên bản có 2 chữ ký
        if (line.includes('THƯ KÝ') && (line.includes('TỔ TRƯỞNG') || line.includes('BÍ THƯ') || line.includes('TRƯỞNG BAN') || line.includes('CHI BỘ') || line.includes('TM') || line.includes('T/M'))) {
          sigStartIndex = i;
          isDoubleSignature = true;
          break;
        }
        
        // Hoặc nếu dòng chứa ngày tháng năm của văn bản 1 chữ ký
        if (line.match(/ngày\s+\d+\s+tháng\s+\d+\s+năm\s+\d+/) || (line.includes('ngày') && line.includes('tháng') && line.includes('năm') && line.includes(','))) {
          let hasLeaderTitleBelow = false;
          for (let j = i + 1; j < bodyLines.length; j++) {
            const lBelow = bodyLines[j].toUpperCase();
            if (lBelow.includes('TỔ TRƯỞNG') || lBelow.includes('BÍ THƯ') || lBelow.includes('TRƯỞNG BAN') || lBelow.includes('CHI BỘ') || lBelow.includes('TM') || lBelow.includes('T/M')) {
              hasLeaderTitleBelow = true;
              break;
            }
          }
          if (hasLeaderTitleBelow) {
            sigStartIndex = i;
            isDoubleSignature = false;
            break;
          }
        }
      }

      if (sigStartIndex === -1) {
        // Không phát hiện chữ ký dạng chuẩn, in thô toàn bộ
        return `<div class="doc-body" style="white-space: pre-wrap; word-wrap: break-word; font-size: 13pt; line-height: 1.7; margin-top: 16px;">${bodyLines.join('\n')}</div>`;
      }

      const contentLines = bodyLines.slice(0, sigStartIndex);
      const sigLines = bodyLines.slice(sigStartIndex);

      let signatureHtml = '';

      if (isDoubleSignature) {
        // Biên bản: 2 cột (Thư ký bên trái, Lãnh đạo bên phải)
        const leftColParts: string[] = [];
        const rightColParts: string[] = [];

        sigLines.forEach(line => {
          if (!line.trim()) return;
          // Tìm điểm chia đôi hợp lý dựa trên khoảng trắng rộng ở giữa
          const mid = Math.floor(line.length / 2);
          let cutPoint = mid;
          
          const spacePattern = /\s{3,}/g;
          let match;
          let bestSpaceIdx = -1;
          let minDiff = Infinity;
          
          while ((match = spacePattern.exec(line)) !== null) {
            const idx = match.index;
            const diff = Math.abs(idx - mid);
            if (diff < minDiff) {
              minDiff = diff;
              bestSpaceIdx = idx;
            }
          }
          
          if (bestSpaceIdx !== -1) {
            cutPoint = bestSpaceIdx;
          } else if (line.includes('  ')) {
            const spacesIdx = line.indexOf('  ', Math.floor(line.length / 4));
            if (spacesIdx !== -1) {
              cutPoint = spacesIdx;
            }
          }

          const leftPart = line.substring(0, cutPoint).trim();
          const rightPart = line.substring(cutPoint).trim();

          leftColParts.push(leftPart);
          rightColParts.push(rightPart);
        });

        signatureHtml = `
          <table class="signature-table" style="width: 100%; border-collapse: collapse; margin-top: 40px; page-break-inside: avoid;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt;">
                ${leftColParts.map((text, idx) => {
                  if (!text) return '<div style="height: 1.2em;"></div>';
                  const isTitle = idx === 0 || text.includes('THƯ KÝ');
                  const isInstruction = text.startsWith('(') && text.endsWith(')');
                  const isName = idx === leftColParts.length - 1 && !isInstruction && !isTitle;
                  if (isTitle) return `<div class="sig-title" style="font-weight: bold; text-transform: uppercase;">${text}</div>`;
                  if (isInstruction) return `<div class="sig-instruction" style="font-style: italic; font-size: 12pt; margin-top: 2px;">${text}</div>`;
                  return `<div class="sig-name" style="${isName ? 'font-weight: bold; margin-top: 65px; font-size: 13pt;' : ''}">${text}</div>`;
                }).join('')}
              </td>
              <td style="width: 50%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt;">
                ${rightColParts.map((text, idx) => {
                  if (!text) return '<div style="height: 1.2em;"></div>';
                  const isTitle = idx === 0 || text.includes('TỔ TRƯỞNG') || text.includes('BÍ THƯ') || text.includes('TRƯỞNG BAN');
                  const isInstruction = text.startsWith('(') && text.endsWith(')');
                  const isName = idx === rightColParts.length - 1 && !isInstruction && !isTitle;
                  if (isTitle) return `<div class="sig-title" style="font-weight: bold; text-transform: uppercase;">${text}</div>`;
                  if (isInstruction) return `<div class="sig-instruction" style="font-style: italic; font-size: 12pt; margin-top: 2px;">${text}</div>`;
                  return `<div class="sig-name" style="${isName ? 'font-weight: bold; margin-top: 65px; font-size: 13pt;' : ''}">${text}</div>`;
                }).join('')}
              </td>
            </tr>
          </table>
        `;
      } else {
        // 1 cột bên phải (các báo cáo, thông báo, thư ngỏ)
        const cleanedSigLines = sigLines.map(line => line.trim()).filter(Boolean);
        
        signatureHtml = `
          <table class="signature-table" style="width: 100%; border-collapse: collapse; margin-top: 40px; page-break-inside: avoid;">
            <tr>
              <td style="width: 50%; border: none;"></td>
              <td style="width: 50%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt;">
                ${cleanedSigLines.map((text, idx) => {
                  const isDate = text.includes('ngày') && text.includes('tháng') && text.includes('năm');
                  const isTitle = text.includes('TỔ TRƯỞNG') || text.includes('BÍ THƯ') || text.includes('TRƯỞNG BAN') || text.includes('T/M') || text.includes('TM');
                  const isInstruction = text.startsWith('(') && text.endsWith(')');
                  const isName = idx === cleanedSigLines.length - 1 && !isInstruction && !isTitle && !isDate;

                  if (isDate) return `<div class="sig-date" style="font-style: italic; margin-bottom: 5px;">${text}</div>`;
                  if (isTitle) return `<div class="sig-title" style="font-weight: bold; text-transform: uppercase;">${text}</div>`;
                  if (isInstruction) return `<div class="sig-instruction" style="font-style: italic; font-size: 12pt; margin-top: 2px;">${text}</div>`;
                  return `<div class="sig-name" style="${isName ? 'font-weight: bold; margin-top: 65px; font-size: 13pt;' : ''}">${text}</div>`;
                }).join('')}
              </td>
            </tr>
          </table>
        `;
      }

      return `
        <div class="doc-body" style="white-space: pre-wrap; word-wrap: break-word; font-size: 13pt; line-height: 1.7; margin-top: 16px;">${contentLines.join('\n')}</div>
        ${signatureHtml}
      `;
    };

    // Phân tích loại văn bản để render đúng
    const isPartyDoc = result.includes('ĐẢNG CỘNG SẢN VIỆT NAM') || result.includes('CHI BỘ');
    const isFrontDoc = result.includes('MTTQ') || result.includes('MẶT TRẬN');

    // Tách phần tiêu đề (trước nội dung) và phần thân
    const lines = result.split('\n');

    // Xây dựng HTML chuẩn văn bản hành chính Việt Nam
    let headerHtml = '';
    if (isPartyDoc) {
      // Lấy các dòng tiêu đề Đảng (trước dấu *)
      const starIdx = lines.findIndex(l => l.trim() === '*');
      const headerLines = starIdx > 0 ? lines.slice(0, starIdx) : lines.slice(0, 3);
      const bodyLines = starIdx > 0 ? lines.slice(starIdx + 1) : lines.slice(3);
      headerHtml = `
        <table class="letterhead" cellpadding="0" cellspacing="0">
          <tr>
            <td class="left-col">
              ${headerLines.map((l, i) => `<div class="${i === 0 ? 'org-top' : i === 1 ? 'org-mid' : 'org-bot'}">${l}</div>`).join('')}
              <div class="dash-line">*</div>
            </td>
          </tr>
        </table>
        ${renderBodyWithTableSignature(bodyLines)}`;
    } else {
      // Văn bản Nhà nước: 2 cột tiêu đề
      const sepIdx = lines.findIndex(l => l.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA'));
      const leftLines = sepIdx > 0 ? lines.slice(0, sepIdx).filter(l => l.trim()) : [];
      const rightStartIdx = sepIdx >= 0 ? sepIdx : 0;
      const rightLines = lines.slice(rightStartIdx, rightStartIdx + 3);
      const bodyLines = lines.slice(Math.max(sepIdx + 3, 0));
      headerHtml = `
        <table class="letterhead" cellpadding="0" cellspacing="0">
          <tr>
            <td class="left-col">
              ${leftLines.map((l, i) => `<div class="${i === 0 ? 'org-top' : i === 1 ? 'org-mid' : 'org-bot'}">${l}</div>`).join('')}
            </td>
            <td class="right-col">
              <div class="republic-title">${rightLines[0] || ''}</div>
              <div class="republic-sub">${rightLines[1] || ''}</div>
              <div class="dash-line">───────────────────────</div>
            </td>
          </tr>
        </table>
        ${renderBodyWithTableSignature(bodyLines)}`;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Văn bản hành chính</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 20mm 20mm 30mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.7;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .letterhead {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .left-col {
      width: 50%;
      vertical-align: top;
      padding-right: 10px;
    }
    .right-col {
      width: 50%;
      vertical-align: top;
      text-align: center;
      padding-left: 10px;
    }
    .org-top {
      font-weight: bold;
      font-size: 13pt;
      text-transform: uppercase;
      text-align: center;
    }
    .org-mid {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
    }
    .org-bot {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      text-decoration: underline;
    }
    .republic-title {
      font-weight: bold;
      font-size: 13pt;
      text-align: center;
    }
    .republic-sub {
      font-style: italic;
      font-size: 13pt;
      text-align: center;
    }
    .dash-line {
      text-align: center;
      font-weight: bold;
      font-size: 15pt;
      margin-top: 2px;
    }
    .doc-body {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 13pt;
      line-height: 1.7;
      margin-top: 16px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${isPartyDoc ? headerHtml : (isFrontDoc ? headerHtml : headerHtml)}
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  const getPrintButtonText = () => {
    if (!result) return 'In văn bản (A4)';
    if (result.includes('BIÊN BẢN')) return 'In biên bản (A4)';
    if (result.includes('BÁO CÁO')) return 'In báo cáo (A4)';
    if (result.includes('THÔNG BÁO')) return 'In thông báo (A4)';
    if (result.includes('THƯ NGỎ')) return 'In thư ngỏ (A4)';
    return 'In văn bản (A4)';
  };

  const currentTdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';
  const currentWardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';

  const [activeGroup, setActiveGroup] = useState<'to_truong' | 'party' | 'front'>('to_truong');

  const templateGroups = {
    to_truong: [
      { title: 'Thông báo họp dân', icon: '📢', prompt: 'Viết thông báo họp dân về việc tổng vệ sinh môi trường ngõ xóm vào sáng Chủ Nhật tuần này.' },
      { title: 'Biên bản họp tổ', icon: '📋', prompt: 'Viết biên bản cuộc họp tổ dân phố thảo luận dự án bê tông hóa ngõ 47 tối thứ Hai vừa rồi.' },
      { title: 'Báo cáo tháng TDP', icon: '📊', prompt: `Soạn báo cáo tình hình hoạt động tháng của Tổ dân phố ${currentTdpName} để gửi lên UBND Phường.` },
      { title: 'Kế hoạch vận động quỹ', icon: '💰', prompt: 'Lập báo cáo kế hoạch vận động các khoản đóng góp tự nguyện năm 2026 gửi UBND phường.' },
      { title: 'Nội dung họp vận động', icon: '🗣️', prompt: 'Soạn nội dung hội nghị nhân dân thảo luận mức đóng góp tự nguyện năm 2026.' },
      { title: 'Thư ngỏ vận động quỹ', icon: '✉️', prompt: 'Viết thư ngỏ kêu gọi toàn thể nhân dân đóng góp ủng hộ quỹ Vì người nghèo năm 2026.' },
      { title: 'Biên bản kiểm tra hộ khẩu', icon: '🏠', prompt: 'Soạn biên bản kiểm tra hộ khẩu rà soát dân cư định kỳ năm 2026.' },
      { title: 'Báo cáo ANTT', icon: '🔐', prompt: `Soạn báo cáo an ninh trật tự tháng ${new Date().getMonth() + 1} của Tổ dân phố ${currentTdpName} gửi Công an phường.` },
    ],
    party: [
      { title: 'Nghị quyết Chi bộ', icon: '⚖️', prompt: `Soạn Nghị quyết cuộc họp Chi bộ Tổ dân phố ${currentTdpName} tháng này lãnh đạo công tác an ninh trật tự.` },
      { title: 'Báo cáo công tác Chi bộ', icon: '📝', prompt: `Viết báo cáo đánh giá hoạt động định kỳ của Chi bộ Tổ dân phố ${currentTdpName} gửi Đảng ủy phường.` },
      { title: 'Biên bản họp Chi bộ', icon: '📋', prompt: `Soạn biên bản sinh hoạt họp Chi bộ Tổ dân phố ${currentTdpName} tháng ${new Date().getMonth() + 1}.` },
      { title: 'Kế hoạch học tập NQ', icon: '📚', prompt: `Soạn kế hoạch học tập nghị quyết Chi bộ Tổ dân phố ${currentTdpName} tháng ${new Date().getMonth() + 1}.` },
      { title: 'Danh sách đảng viên tự kiểm', icon: '✅', prompt: `Soạn mẫu đảng viên tự kiểm điểm cuối năm của Chi bộ Tổ dân phố ${currentTdpName}.` },
      { title: 'Báo cáo thi đua khen thưởng', icon: '🏆', prompt: `Viết báo cáo thi đua khen thưởng đề nghị công nhận danh hiệu đảng viên của Chi bộ Tổ dân phố ${currentTdpName}.` },
    ],
    front: [
      { title: 'Báo cáo Đại đoàn kết', icon: '🤝', prompt: 'Soạn báo cáo kết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc của Ban công tác Mặt trận.' },
      { title: 'Báo cáo quỹ Mặt trận', icon: '💵', prompt: 'Viết báo cáo tổng kết vận động ủng hộ Quỹ Vì người nghèo của Ban công tác Mặt trận.' },
      { title: 'Thông báo Ngày hội ĐĐK', icon: '📢', prompt: `Soạn thông báo ngày hội Đại đoàn kết 18/11 của Ban công tác Mặt trận Tổ dân phố ${currentTdpName}.` },
      { title: 'Biên bản họp Mặt trận', icon: '📋', prompt: `Soạn biên bản họp Ban công tác Mặt trận Tổ dân phố ${currentTdpName} tháng ${new Date().getMonth() + 1}.` },
      { title: 'Báo cáo thăm hỏi hộ nghèo', icon: '🎁', prompt: `Soạn báo cáo kết quả thăm hỏi trao quà hộ nghèo và hộ chính sách của Tổ dân phố ${currentTdpName}.` },
    ]
  };

  return (
    <div className="ai-container">
      <div className="ai-header">
        <div className="ai-badge">
          <Sparkles size={16} />
          <span>Trợ lý AI Tổ dân phố</span>
        </div>
        <h1>Trợ lý Văn bản AI</h1>
        <p>Hỗ trợ soạn thảo thông báo họp dân, biên bản và báo cáo chuyên nghiệp cực nhanh bằng ngôn ngữ hành chính chuẩn.</p>
      </div>

      <div className="ai-grid">
        <div className="ai-input-section">
          {/* === 3 TAB CHỌN BAN === */}
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '14px',
            background: '#f8fafc', borderRadius: '12px', padding: '6px'
          }}>
            {([
              { key: 'to_truong', label: '🏠 Tổ trưởng', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
              { key: 'party',     label: '⭐ Bí thư Chi bộ', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
              { key: 'front',     label: '🤝 Mặt trận',    color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveGroup(tab.key)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: '8px',
                  border: activeGroup === tab.key ? `1.5px solid ${tab.border}` : '1.5px solid transparent',
                  background: activeGroup === tab.key ? tab.bg : 'transparent',
                  color: activeGroup === tab.key ? tab.color : '#64748b',
                  fontWeight: activeGroup === tab.key ? '700' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* Label mô tả nhóm */}
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px', fontStyle: 'italic' }}>
            {activeGroup === 'to_truong' && '📌 Các mẫu văn bản dành cho Tổ trưởng dân phố'}
            {activeGroup === 'party'     && '📌 Các mẫu văn bản dành cho Bí thư và Chi ủy Chi bộ'}
            {activeGroup === 'front'     && '📌 Các mẫu văn bản dành cho Ban công tác Mặt trận'}
          </div>

          <div className="template-grid">
            {templateGroups[activeGroup].map((t, i) => (
              <button key={i} className="template-card" onClick={() => setPrompt(t.prompt)}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{t.icon}</span>
                <div style={{textAlign: 'left'}}>
                  <div style={{fontWeight: '700', fontSize: '0.9rem'}}>{t.title}</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '150px'}}>{t.prompt}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="chat-box">
            <textarea 
              placeholder="Nhập yêu cầu của bạn bằng tiếng Việt... (Ví dụ: Hãy soạn một thông báo kêu gọi bà con ngõ 45 dọn vệ sinh chung vào sáng thứ 7)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 0 4px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                💡 Hỏi nhanh trợ lý:
              </span>
              {[
                { label: 'Độ tuổi nghĩa vụ quân sự của tổ ta?', query: 'Độ tuổi nghĩa vụ quân sự của tổ ta?' },
                { label: 'Tóm tắt chính sách hỗ trợ hộ nghèo', query: 'Tóm tắt chính sách hỗ trợ hộ nghèo năm nay' },
                { label: 'Hướng dẫn viết biên bản họp chi bộ', query: 'Hướng dẫn viết biên bản họp chi bộ chuẩn' }
              ].map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerQuickPrompt(qp.query)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="quick-prompt-btn"
                >
                  {qp.label}
                </button>
              ))}
            </div>
            <div className="chat-actions">
              <button 
                className="btn btn-primary" 
                onClick={() => handleGenerate()}
                disabled={isGenerating || !prompt.trim()}
                style={{width: '100%', justifyContent: 'center'}}
              >
                {isGenerating ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
                {isGenerating ? 'Trợ lý AI đang soạn thảo...' : 'Soạn thảo văn bản ngay'}
              </button>
            </div>
          </div>
        </div>

        <div className="ai-result-section">
          {isGenerating ? (
            <div className="loading-state">
              <div className="ai-avatar pulse">
                <Bot size={40} />
              </div>
              <p style={{fontWeight: '600', color: 'var(--primary)'}}>AI đang truy vấn CSDL và soạn thảo văn bản...</p>
            </div>
          ) : result ? (
            <div className="result-card">
              <div className="result-header">
                <h3>Văn bản hành chính đề xuất</h3>
                <div className="result-btns">
                  <button className="icon-btn-sm" onClick={handleCopy} title="Sao chép">
                    {isCopied ? <ClipboardCheck size={18} style={{color: 'var(--success)'}} /> : <Copy size={18} />}
                  </button>
                  <button className="icon-btn-sm" onClick={handlePrint} title="In văn bản (A4)">
                    <Printer size={18} />
                  </button>
                  <button className="icon-btn-sm" onClick={handleDownload} title="Tải xuống tệp .txt">
                    <Download size={18} />
                  </button>
                </div>
              </div>
              <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                <Sparkles size={12} style={{color: 'var(--primary)'}} />
                <span>Bạn có thể chỉnh sửa trực tiếp nội dung văn bản dưới đây:</span>
              </div>
              <textarea 
                className="result-content" 
                value={result} 
                onChange={(e) => setResult(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handlePrint}
                  style={{
                    borderRadius: '24px',
                    padding: '10px 24px',
                    fontSize: '0.95rem',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Printer size={18} /> {getPrintButtonText()}
                </button>
              </div>
            </div>
          ) : (
             <div className="empty-state">
                <Bot size={48} color="var(--border)" />
                <p>Nội dung văn bản soạn thảo sẽ hiển thị tại đây.</p>
             </div>
          )}
        </div>
      </div>

      <style>{`
        .ai-container {
          animation: fadeIn 0.4s ease-out;
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - var(--header-height) - 48px);
        }

        .ai-header {
          margin-bottom: 24px;
        }

        .ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .ai-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 24px;
          flex: 1;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .template-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-weight: 600;
          color: var(--text-main);
          transition: all 0.2s;
        }

        .template-card:hover {
          border-color: var(--primary);
          background-color: rgba(37, 99, 235, 0.02);
          transform: translateY(-2px);
        }

        .chat-box {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .chat-box textarea {
          width: 100%;
          height: 180px;
          border: none;
          resize: none;
          outline: none;
          font-size: 1rem;
          font-family: inherit;
          line-height: 1.5;
        }

        .quick-prompt-btn:hover {
          background-color: var(--primary) !important;
          color: white !important;
          transform: translateY(-1px);
        }

        .ai-result-section {
          background: #f8fafc;
          border-radius: var(--radius-lg);
          border: 2px dashed var(--border);
          padding: 20px;
          display: flex;
          flex-direction: column;
          min-height: 380px;
        }

        .result-card {
          background: white;
          border-radius: var(--radius-md);
          padding: 24px;
          box-shadow: var(--shadow-md);
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }

        .result-btns {
          display: flex;
          gap: 8px;
        }

        .icon-btn-sm {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: white;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-btn-sm:hover {
          background: #f1f5f9;
          color: var(--primary);
          border-color: var(--primary);
        }

        .result-content {
          white-space: pre-wrap;
          font-family: 'Times New Roman', serif;
          font-size: 1.05rem;
          line-height: 1.6;
          color: #1e293b;
          flex: 1;
          overflow-y: auto;
          min-height: 380px;
          max-height: 500px;
          padding: 16px;
          background: #fdfdfd;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }

        .result-content:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.05);
        }

        .loading-state, .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          color: var(--text-muted);
        }

        .ai-avatar {
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          box-shadow: var(--shadow-lg);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1024px) {
          .ai-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AIAssistant;
