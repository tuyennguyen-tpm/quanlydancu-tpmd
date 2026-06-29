import { useState } from 'react';
import { 
  BookOpen, 
  Scale, 
  Users, 
  ShieldAlert, 
  HeartHandshake, 
  UserCheck, 
  MessageSquareCode, 
  Search, 
  Printer, 
  ChevronDown, 
  Sparkles,
  Info
} from 'lucide-react';
import { showToast } from '../utils/toast';

interface Article {
  id: string;
  title: string;
  content: string;
  source: string;
}

const Regulations = () => {
  const [activeSubTab, setActiveSubTab] = useState<'duties' | 'circulars'>('duties');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>('art-1');

  const duties = [
    {
      id: 'duty-1',
      title: 'Tự quản cộng đồng dân cư',
      icon: Users,
      color: 'blue',
      summary: 'Tổ chức xây dựng quy ước ngõ xóm, bảo vệ môi trường, văn hóa truyền thống và hòa giải các tranh chấp nhỏ.',
      details: [
        'Xây dựng và thực hiện hương ước, quy ước của tổ dân phố phù hợp với luật pháp.',
        'Vận động nhân dân giữ gìn trật tự công cộng, trật tự an toàn giao thông và vệ sinh môi trường.',
        'Xây dựng đời sống văn hóa, gia đình văn hóa, tổ dân phố văn hóa.',
        'Hòa giải các tranh chấp, mâu thuẫn nhỏ tại cộng đồng thông qua Tổ hòa giải cơ sở.'
      ]
    },
    {
      id: 'duty-2',
      title: 'Tuyên truyền đường lối, chủ trương',
      icon: Scale,
      color: 'indigo',
      summary: 'Phổ biến và vận động nhân dân chấp hành các đường lối của Đảng, chính sách, pháp luật của Nhà nước.',
      details: [
        'Tuyên truyền, phổ biến đường lối, chủ trương của Đảng, chính sách và pháp luật của Nhà nước.',
        'Phổ biến các quyết định chỉ đạo của chính quyền địa phương (UBND Phường/Xã).',
        'Tuyên truyền các ngày lễ lớn, phong trào yêu nước, cổ động nhân dân giữ vững lý tưởng cách mạng.'
      ]
    },
    {
      id: 'duty-3',
      title: 'Vận động thi đua & An sinh xã hội',
      icon: HeartHandshake,
      color: 'red',
      summary: 'Phát động phong trào xóa đói giảm nghèo, tương thân tương ái và tổ chức cứu trợ, ủng hộ đồng bào khó khăn.',
      details: [
        'Triển khai cuộc vận động "Toàn dân đoàn kết xây dựng nông thôn mới, đô thị văn minh".',
        'Đoàn kết tương trợ giúp đỡ nhau trong sản xuất và đời sống, giảm nghèo bền vững.',
        'Tổ chức các hoạt động quyên góp xã hội: Quỹ Vì người nghèo, Quỹ Đền ơn đáp nghĩa, hỗ trợ thiên tai.'
      ]
    },
    {
      id: 'duty-4',
      title: 'Đôn đốc nghĩa vụ công dân',
      icon: UserCheck,
      color: 'orange',
      summary: 'Vận động nhân dân thực hiện các loại thuế, nghĩa vụ quân sự và các khoản đóng góp cộng đồng hợp pháp.',
      details: [
        'Vận động nhân dân thực hiện đầy đủ nghĩa vụ nộp thuế, phí đối với Nhà nước.',
        'Đôn đốc thanh niên trong độ tuổi thực hiện Luật Nghĩa vụ quân sự.',
        'Tổ chức thu nộp các loại phí tự quản xã hội được nhân dân bàn và thống nhất biểu quyết thông qua.'
      ]
    },
    {
      id: 'duty-5',
      title: 'Phản ánh kiến nghị & Bảo vệ quyền lợi',
      icon: MessageSquareCode,
      color: 'teal',
      summary: 'Tập hợp các ý kiến, phản ánh chính đáng của người dân lên chính quyền cấp phường để giải quyết kịp thời.',
      details: [
        'Phản ánh kịp thời tâm tư, nguyện vọng chính đáng của bà con lên Ủy ban nhân dân cấp phường.',
        'Bảo vệ quyền lợi và lợi ích hợp pháp của công dân cư trú trên địa bàn.',
        'Giám sát hoạt động của các cơ quan chính quyền ở cơ sở theo luật thực hiện dân chủ cơ sở.'
      ]
    }
  ];

  const articles: Article[] = [
    {
      id: 'art-1',
      title: 'Điều 1: Phạm vi điều chỉnh và đối tượng áp dụng',
      content: 'Thông tư này hướng dẫn về tổ chức và hoạt động của thôn, tổ dân phố. Áp dụng đối với Ủy ban nhân dân các cấp, tổ dân phố, các cơ quan, tổ chức, cá nhân có liên quan đến việc quản lý hành chính và tự quản ở cấp cơ sở.',
      source: 'Thông tư 04/2012/TT-BNV'
    },
    {
      id: 'art-2',
      title: 'Điều 2: Tính chất của Thôn, Tổ dân phố',
      content: 'Thôn, tổ dân phố không phải là một cấp hành chính mà là tổ chức tự quản của cộng đồng dân cư có chung địa bàn cư trú trong một xã, phường, thị trấn; là nơi thực hiện dân chủ trực tiếp và rộng rãi để phát huy các hình thức tự quản của nhân dân.',
      source: 'Thông tư 04/2012/TT-BNV'
    },
    {
      id: 'art-3',
      title: 'Điều 3: Nguyên tắc tổ chức và hoạt động',
      content: 'Tổ chức và hoạt động của thôn, tổ dân phố phải bảo đảm tính tự quản của cộng đồng dân cư, tuân thủ pháp luật, dân chủ, công khai, minh bạch. Bảo đảm sự lãnh đạo của Chi bộ Đảng tại thôn, tổ dân phố và sự quản lý nhà nước của Ủy ban nhân dân cấp xã.',
      source: 'Thông tư 14/2018/TT-BNV'
    },
    {
      id: 'art-4',
      title: 'Điều 4: Tiêu chuẩn thành lập Tổ dân phố mới',
      content: 'Quy định quy mô số hộ gia đình để thành lập tổ dân phố ở các tỉnh: Đối với khu vực phường, thị trấn ở các thành phố lớn hoặc khu đô thị đông dân cư là từ 300 hộ gia đình trở lên. Trường hợp đặc biệt ở khu vực biên giới hải đảo có thể thấp hơn nhưng phải được UBND cấp tỉnh quyết định phê duyệt.',
      source: 'Thông tư 14/2018/TT-BNV'
    },
    {
      id: 'art-5',
      title: 'Điều 5: Quy trình bầu Tổ trưởng dân phố',
      content: 'Tổ trưởng dân phố do nhân dân trong tổ bầu trực tiếp bằng hình thức bỏ phiếu kín hoặc biểu quyết tại hội nghị tổ dân phố. Nhiệm kỳ của Tổ trưởng dân phố là 2,5 năm hoặc 5 năm tùy thuộc vào quy định cụ thể của Ủy ban nhân dân tỉnh sở tại.',
      source: 'Thông tư 04/2012/TT-BNV'
    }
  ];

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Không thể mở cửa sổ in. Vui lòng cấp quyền mở cửa sổ con!', 'danger');
      return;
    }

    const contentHtml = duties.map(d => `
      <div style="margin-bottom: 20px;">
        <h3>${d.title}</h3>
        <p><strong>Khái quát:</strong> ${d.summary}</p>
        <ul>
          ${d.details.map(detail => `<li>${detail}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    const articlesHtml = articles.map(a => `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
        <h4>${a.title}</h4>
        <p>${a.content}</p>
        <small style="color: #666;">Nguồn: ${a.source}</small>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Quy định và Nhiệm vụ Tổ dân phố</title>
          <style>
            body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.6; color: #000; margin: 30px; }
            h1, h2 { text-align: center; text-transform: uppercase; }
            h3, h4 { color: #111; margin-bottom: 5px; }
            .header-info { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            ul { margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h2>Tài liệu ôn tập chính trị</h2>
            <h1>CHỨC NĂNG & NHIỆM VỤ TỔ DÂN PHỐ</h1>
            <p>Trích lục theo Thông tư 04/2012/TT-BNV & Thông tư 14/2018/TT-BNV của Bộ Nội vụ</p>
          </div>
          <h2>I. 5 NHIỆM VỤ TRỌNG TÂM CỦA TỔ DÂN PHỐ</h2>
          ${contentHtml}
          <br/>
          <h2>II. TRÍCH LỤC ĐIỀU KHOẢN THÔNG TƯ PHÁP LUẬT</h2>
          ${articlesHtml}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    showToast('Chuẩn bị bản in thành công!', 'success');
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="regulations-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'block', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="ai-badge" style={{ display: 'inline-flex', gap: '6px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)' }}>
              <Scale size={15} />
              <span>Cơ sở pháp lý & Tự quản dân cư</span>
            </div>
            <h1 style={{ margin: '8px 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
              Quy định & Nhiệm vụ tự quản
            </h1>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Tài liệu học tập về thẩm quyền, trách nhiệm tự quản cộng đồng theo thông tư hướng dẫn của Bộ Nội vụ.
            </p>
          </div>

          <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> In tài liệu (A4)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-control">
        <button 
          className={`tab-btn ${activeSubTab === 'duties' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('duties')}
        >
          <BookOpen size={18} />
          <span>5 Chức năng, Nhiệm vụ trọng tâm</span>
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'circulars' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('circulars')}
        >
          <Scale size={18} />
          <span>Trích lục Thông tư Bộ Nội vụ</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="tab-content" style={{ marginTop: '20px' }}>
        {activeSubTab === 'duties' ? (
          <div className="duties-grid">
            <div className="info-banner">
              <Info size={20} className="info-icon" />
              <div className="info-text">
                <strong>Bạn có biết?</strong> Tổ dân phố không phải là một cấp chính quyền hành chính độc lập (như cấp Phường, Huyện). Đây là tổ chức tự quản trực tiếp từ cộng đồng nhân dân, do dân tự bầu ra dưới sự lãnh đạo trực tiếp của Chi bộ và sự hướng dẫn hành chính của UBND Phường.
              </div>
            </div>

            <div className="duty-cards-container">
              {duties.map((d, index) => (
                <div key={d.id} className="duty-card">
                  <div className="duty-card-header">
                    <div className={`duty-icon-badge ${d.color}`}>
                      <d.icon size={22} />
                    </div>
                    <div className="duty-card-title">
                      <span className="duty-number">Nhiệm vụ {index + 1}</span>
                      <h3>{d.title}</h3>
                    </div>
                  </div>
                  <div className="duty-card-body">
                    <p className="duty-summary">{d.summary}</p>
                    <ul className="duty-list">
                      {d.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="circulars-section">
            <div className="circulars-search">
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm điều khoản thông tư..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="articles-accordion">
              {filteredArticles.map(a => {
                const isExpanded = expandedArticle === a.id;
                return (
                  <div key={a.id} className={`article-item ${isExpanded ? 'active' : ''}`}>
                    <button 
                      className="article-header"
                      onClick={() => setExpandedArticle(isExpanded ? null : a.id)}
                    >
                      <div className="header-left">
                        <Scale size={18} className="scale-icon" />
                        <span>{a.title}</span>
                      </div>
                      <ChevronDown size={18} className="chevron" />
                    </button>
                    {isExpanded && (
                      <div className="article-body">
                        <p>{a.content}</p>
                        <div className="article-footer">
                          <span className="source-tag">{a.source}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredArticles.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  Không tìm thấy điều khoản nào khớp với tìm kiếm.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .regulations-page {
          animation: fadeIn 0.4s ease-out;
        }
        
        .tab-control {
          display: flex;
          border-bottom: 2px solid var(--border);
          gap: 24px;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 12px 6px;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s ease;
        }

        .tab-btn:hover {
          color: var(--primary);
        }

        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }

        .info-banner {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
          border: 1px dashed rgba(59, 130, 246, 0.3);
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          align-items: flex-start;
        }

        .info-icon {
          color: var(--primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-text {
          font-size: 0.88rem;
          line-height: 1.5;
          color: #334155;
        }

        .duty-cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .duty-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.2s ease;
        }

        .duty-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
          border-color: var(--primary-light);
        }

        .duty-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .duty-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .duty-icon-badge.blue { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
        .duty-icon-badge.indigo { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
        .duty-icon-badge.red { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .duty-icon-badge.orange { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .duty-icon-badge.teal { background: rgba(20, 184, 166, 0.1); color: #0d9488; }

        .duty-card-title .duty-number {
          font-size: 0.72rem;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.5px;
        }

        .duty-card-title h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 2px 0 0 0;
          color: var(--text-main);
        }

        .duty-summary {
          font-size: 0.88rem;
          color: #475569;
          margin: 0 0 16px 0;
          line-height: 1.45;
          font-weight: 500;
        }

        .duty-list {
          padding-left: 18px;
          margin: 0;
          font-size: 0.85rem;
          color: #64748b;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .duty-list li {
          line-height: 1.45;
        }

        /* Circulars Tab */
        .circulars-search {
          background: white;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          max-width: 480px;
        }

        .circulars-search input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 0.9rem;
        }

        .articles-accordion {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 800px;
        }

        .article-item {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .article-item:hover {
          border-color: var(--primary);
        }

        .article-item.active {
          border-color: var(--primary);
          box-shadow: 0 2px 8px rgba(37,99,235,0.05);
        }

        .article-header {
          width: 100%;
          background: none;
          border: none;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-main);
          text-align: left;
        }

        .article-header .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .article-header .scale-icon {
          color: var(--text-muted);
        }

        .article-item.active .article-header .scale-icon {
          color: var(--primary);
        }

        .article-header .chevron {
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }

        .article-item.active .chevron {
          transform: rotate(180deg);
          color: var(--primary);
        }

        .article-body {
          padding: 0 20px 20px 50px;
          border-top: 1px dashed var(--border);
          font-size: 0.9rem;
          line-height: 1.6;
          color: #334155;
          animation: slideDown 0.2s ease-out;
        }

        .article-body p {
          margin: 12px 0;
        }

        .article-footer {
          margin-top: 12px;
        }

        .source-tag {
          font-size: 0.72rem;
          background: #f1f5f9;
          color: #475569;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Regulations;
