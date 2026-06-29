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
  Printer
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
    const households = await db.getHouseholds();
    const residents = await db.getResidents();
    const complaints = await db.getComplaints();
    const records = await db.getFinancialRecords();
    const partyMembers = await partyDb.getPartyMembers();

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

    // Wrap in formal organizational header
    let finalDocument = '';
    if (docType === 'party') {
      finalDocument = `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardName.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
---

${title}

${content}

${tdpName}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
BÍ THƯ CHI BỘ
(Ký, ghi rõ họ tên)
      `;
    } else if (docType === 'front') {
      finalDocument = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
ỦY BAN MTTQ VN ${wardName.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

${title}

${content}

${tdpName}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
(Ký, ghi rõ họ tên)
      `;
    } else {
      finalDocument = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
${tdpHeader}

${title}

${content}

${tdpName}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
TỔ TRƯỞNG DÂN PHỐ
(Ký, ghi rõ họ tên)
      `;
    }

    return finalDocument;
  };

  const handleGenerate = () => {
    if (!prompt) return;
    setIsGenerating(true);
    setIsCopied(false);
    setTimeout(async () => {
      const doc = await generateDocument(prompt);
      setResult(doc);
      setIsGenerating(false);
    }, 1200);
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
    
    printWindow.document.write(`
      <html>
        <head>
          <title>In văn bản hành chính</title>
          <style>
            @page {
              size: A4;
              margin: 20mm 20mm 20mm 25mm; /* Trên, dưới, phải 20mm, trái 25mm */
            }
            body {
              font-family: "Times New Roman", Times, serif;
              font-size: 14pt;
              line-height: 1.6;
              color: #000;
              margin: 0;
              padding: 0;
              background-color: #fff;
            }
            .document-container {
              width: 100%;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <div class="document-container">${result}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
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

  const templates = [
    { title: 'Thông báo họp dân', prompt: 'Viết thông báo họp dân về việc tổng vệ sinh môi trường ngõ xóm vào sáng Chủ Nhật tuần này.' },
    { title: 'Biên bản họp tổ', prompt: 'Viết biên bản cuộc họp tổ dân phố thảo luận dự án bê tông hóa ngõ 47 tối thứ Hai vừa rồi.' },
    { title: 'Báo cáo tháng', prompt: `Soạn báo cáo tình hình hoạt động tháng của Tổ dân phố ${currentTdpName} để gửi lên UBND ${currentWardName.toLowerCase().startsWith('phường') || currentWardName.toLowerCase().startsWith('xã') || currentWardName.toLowerCase().startsWith('thị trấn') ? '' : 'phường '}${currentWardName}.` },
    { title: 'Thư ngỏ vận động quỹ', prompt: `Viết thư ngỏ kêu gọi toàn thể nhân dân đóng góp ủng hộ quỹ Vì người nghèo năm 2026. Tổ dân phố ${currentTdpName}, ${currentWardName.toLowerCase().startsWith('phường') || currentWardName.toLowerCase().startsWith('xã') || currentWardName.toLowerCase().startsWith('thị trấn') ? '' : 'phường '}${currentWardName.toLowerCase()}` },
  ];

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
          <div className="template-grid">
            {templates.map((t, i) => (
              <button key={i} className="template-card" onClick={() => setPrompt(t.prompt)}>
                <FileText size={18} style={{color: 'var(--primary)'}} />
                <div style={{textAlign: 'left'}}>
                  <div style={{fontWeight: '700', fontSize: '0.9rem'}}>{t.title}</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '160px'}}>{t.prompt}</div>
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
            <div className="chat-actions">
              <button 
                className="btn btn-primary" 
                onClick={handleGenerate}
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
