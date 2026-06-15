import { useState } from 'react';
import { 
  Send, 
  Bot, 
  FileText,
  Copy,
  Download,
  Sparkles,
  RefreshCw,
  ClipboardCheck
} from 'lucide-react';
import { db } from '../services/db';
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
    
    // Fetch live statistics to inject into documents (making it super professional!)
    const households = await db.getHouseholds();
    const residents = await db.getResidents();
    const complaints = await db.getComplaints();
    const records = await db.getFinancialRecords();

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

    let location = 'Nhà văn hóa Tổ dân phố Nam Sầm Sơn';
    if (query.includes('ngõ 45')) location = 'Khu vực Ngõ 45, Nam Sầm Sơn';
    else if (query.includes('ngõ 47')) location = 'Khu vực Ngõ 47, Nam Sầm Sơn';

    if (query.includes('họp dân') || query.includes('họp tổ') || query.includes('mời họp')) {
      title = 'THÔNG BÁO V/v Tổ chức cuộc họp Tổ dân phố';
      
      let reason = 'Bàn bạc một số công việc chung của Tổ dân phố';
      if (query.includes('vệ sinh') || query.includes('rác')) reason = 'Triển khai công tác dọn dẹp vệ sinh môi trường ngõ xóm';
      else if (query.includes('đóng quỹ') || query.includes('thu tiền')) reason = 'Phổ biến và thu nộp các loại quỹ cộng đồng năm 2026';
      else if (query.includes('bê tông') || query.includes('làm đường')) reason = 'Bàn thảo phương án đóng góp kinh phí bê tông hóa đường ngõ';

      content = `
Thực hiện kế hoạch hoạt động của UBND phường và Ban điều hành TDP Nam Sầm Sơn, trân trọng kính mời đại diện các hộ gia đình đến tham dự cuộc họp dân.

1. Mục đích họp:
- ${reason}.
- Trao đổi, ghi nhận các phản ánh, đề xuất của bà con.

2. Thời gian: ${time}, ${date}.
3. Địa điểm: ${location}.

Rất mong đại diện các hộ gia đình sắp xếp thời gian, tham gia đầy đủ và đúng giờ để cuộc họp đạt kết quả tốt nhất. Xin trân trọng cảm ơn!
      `;
    } 
    else if (query.includes('biên bản')) {
      title = 'BIÊN BẢN HỌP TỔ DÂN PHỐ';
      
      let reason = 'Bàn bạc công tác nội bộ Tổ dân phố';
      if (query.includes('bê tông')) reason = 'Họp bàn thống nhất đóng góp đổ bê tông đường ngõ';
      else if (query.includes('vệ sinh')) reason = 'Họp triển khai phong trào Ngày chủ nhật xanh';

      content = `
Hôm nay, vào lúc ${time}, ${date}, tại ${location} đã diễn ra cuộc họp Tổ dân phố Nam Sầm Sơn.

I. THÀNH PHẦN THAM DỰ:
1. Chủ trì cuộc họp: Ông Nguyễn Kim Tuyến - Tổ trưởng dân phố.
2. Thư ký ghi biên bản: Bà Lê Thị Dung.
3. Số lượng đại biểu tham dự: Đại diện của ${households.length} hộ gia đình.

II. NỘI DUNG CUỘC HỌP:
1. Ông Nguyễn Kim Tuyến trình bày lý do cuộc họp: ${reason}.
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
Kính gửi: Toàn thể bà con nhân dân, các hộ gia đình và nhà hảo tâm đang sinh sống tại Tổ dân phố Nam Sầm Sơn.

Phát huy truyền thống tương thân tương ái, "lá lành đùm lá rách" của dân tộc Việt Nam và chăm lo tốt hơn cho các gia đình có hoàn cảnh khó khăn trên địa bàn.

Ban điều hành Tổ dân phố Nam Sầm Sơn tha thiết kêu gọi toàn thể bà con tích cực tham gia đóng góp ủng hộ ${fundName}.

Mọi sự ủng hộ đóng góp tự nguyện xin gửi về:
- Ban thủ quỹ Tổ dân phố (Nhà văn hóa) hoặc đóng trực tiếp cho các cán bộ tổ dân phố đi vận động tận nhà.
- Thời gian vận động: Từ nay đến hết ngày 30/06/2026.

Mỗi tấm lòng của quý vị sẽ góp phần xây dựng một cộng đồng Nam Sầm Sơn ngày càng ấm no, đoàn kết và phát triển. Xin chân thành cảm ơn sự đồng hành của quý bà con!
      `;
    } 
    else if (query.includes('báo cáo')) {
      title = 'BÁO CÁO TÌNH HÌNH TỔ DÂN PHỐ THÁNG 06/2026';
      const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
      content = `
Kính gửi: Ủy ban nhân dân phường Nam Sầm Sơn.

Ban điều hành Tổ dân phố Nam Sầm Sơn xin báo cáo kết quả hoạt động tháng vừa qua như sau:

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
Kính gửi: Toàn thể nhân dân Tổ dân phố Nam Sầm Sơn.

Ban điều hành Tổ dân phố xin thông báo nội dung sau:

${userPrompt}

Yêu cầu bà con nhân dân lưu ý và phối hợp thực hiện nghiêm túc nội dung trên.

TỔ TRƯỞNG DÂN PHỐ
(Đã ký)
      `;
    }

    // Wrap in formal national header
    const finalDocument = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
TỔ DÂN PHỐ NAM SẦM SƠN

${title}

${content}

Nam Sầm Sơn, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
TỔ TRƯỞNG DÂN PHỐ
    `;

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

  const templates = [
    { title: 'Thông báo họp dân', prompt: 'Viết thông báo họp dân về việc tổng vệ sinh môi trường ngõ xóm vào sáng Chủ Nhật tuần này.' },
    { title: 'Biên bản họp tổ', prompt: 'Viết biên bản cuộc họp tổ dân phố thảo luận dự án bê tông hóa ngõ 47 tối thứ Hai vừa rồi.' },
    { title: 'Báo cáo tháng', prompt: 'Soạn báo cáo tình hình hoạt động tháng của Tổ dân phố Nam Sầm Sơn để gửi lên UBND phường.' },
    { title: 'Thư ngỏ vận động quỹ', prompt: 'Viết thư ngỏ kêu gọi toàn thể nhân dân đóng góp ủng hộ quỹ Vì người nghèo năm 2026.' },
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
                  <button className="icon-btn-sm" onClick={handleDownload} title="Tải xuống tệp .txt">
                    <Download size={18} />
                  </button>
                </div>
              </div>
              <pre className="result-content">{result}</pre>
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

        .result-content {
          white-space: pre-wrap;
          font-family: 'Times New Roman', serif;
          font-size: 1.05rem;
          line-height: 1.6;
          color: #1e293b;
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
          padding: 10px;
          background: #fdfdfd;
          border: 1px solid #f1f5f9;
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
