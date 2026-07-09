import { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  Info,
  Star,
  Briefcase,
  Flag,
  Shield
} from 'lucide-react';
import { showToast } from '../utils/toast';

interface Article {
  id: string;
  title: string;
  content: string;
  source: string;
}

interface OfficialRole {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  summary: string;
  duties: string[];
  legalBasis: string;
  officialLink: string;
  linkLabel: string;
}

const Regulations = () => {
  const [activeSubTab, setActiveSubTab] = useState<'duties' | 'circulars' | 'roles'>('duties');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>('art-1');
  const [expandedRole, setExpandedRole] = useState<string | null>('role-1');

  // Debounce searchInput -> searchQuery
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  const officialRoles: OfficialRole[] = [
    {
      id: 'role-1',
      title: 'Tổ trưởng Tổ dân phố',
      subtitle: 'Chức danh dân cử, do dân bầu trực tiếp',
      icon: Star,
      color: 'blue',
      summary: 'Người đứng đầu Tổ dân phố, thay mặt bà con tổ chức triển khai mọi hoạt động tự quản, hòa giải, vận động và đối ngoại với chính quyền phường.',
      duties: [
        'Triệu tập và chủ trì các cuộc họp Tổ dân phố; đại diện dân trình bày kiến nghị với UBND Phường.',
        'Tổ chức thực hiện các phong trào thi đua, cuộc vận động của Đảng và Nhà nước tại địa bàn.',
        'Thống kê, quản lý hộ khẩu, nhân khẩu; theo dõi biến động dân cư (chuyển đi, chuyển đến, sinh, tử).',
        'Thu nộp các loại quỹ: Quỹ vì người nghèo, Quỹ đền ơn đáp nghĩa, phí vệ sinh môi trường.',
        'Đôn đốc nghĩa vụ thuế, phí; vận động thực hiện Luật NVQS với thanh niên trong tổ.',
        'Hòa giải các tranh chấp, mâu thuẫn nhỏ trong cộng đồng; bảo vệ trật tự công cộng.',
        'Phối hợp với Chi bộ Đảng và Ban Mặt trận để lãnh đạo toàn diện đời sống tổ dân phố.',
        'Báo cáo định kỳ và đột xuất công tác tổ dân phố lên Phó Chủ tịch UBND Phường phụ trách.'
      ],
      legalBasis: 'Thông tư 04/2012/TT-BNV & Thông tư 14/2018/TT-BNV của Bộ Nội vụ',
      officialLink: 'https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=128014',
      linkLabel: 'Thông tư 14/2018/TT-BNV trên Cổng VBPL Quốc gia'
    },
    {
      id: 'role-2',
      title: 'Tổ phó Tổ dân phố',
      subtitle: 'Giúp việc Tổ trưởng; phụ trách mảng an ninh hoặc văn hóa xã hội',
      icon: Briefcase,
      color: 'indigo',
      summary: 'Là người hỗ trợ đắc lực cho Tổ trưởng, chịu trách nhiệm về mảng công việc được phân công; thay thế Tổ trưởng điều hành khi Tổ trưởng vắng mặt.',
      duties: [
        'Giúp Tổ trưởng điều hành công việc của tổ trong phạm vi nhiệm vụ được phân công.',
        'Thay thế Tổ trưởng thực hiện quyền hạn và trách nhiệm khi Tổ trưởng vắng mặt.',
        'Phụ trách theo dõi công tác dân số, gia đình và trẻ em của tổ dân phố.',
        'Theo dõi tình hình an ninh trật tự, tai nạn giao thông, tệ nạn xã hội; báo cáo kịp thời.',
        'Phối hợp tổ chức các hội nghị, cuộc họp dân và thu thập ý kiến phản ánh của nhân dân.',
        'Tổ chức thực hiện các chỉ tiêu văn hóa – xã hội được giao.'
      ],
      legalBasis: 'Thông tư 04/2012/TT-BNV của Bộ Nội vụ',
      officialLink: 'https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=29237',
      linkLabel: 'Thông tư 04/2012/TT-BNV trên Cổng VBPL Quốc gia'
    },
    {
      id: 'role-3',
      title: 'Bí thư Chi bộ',
      subtitle: 'Người lãnh đạo cao nhất của Chi bộ Đảng tại tổ dân phố',
      icon: Shield,
      color: 'red',
      summary: 'Đại diện pháp lý của Chi bộ Đảng tại cơ sở; đảm bảo sự lãnh đạo toàn diện của Đảng đối với mọi hoạt động chính trị, kinh tế, xã hội tại địa bàn tổ dân phố.',
      duties: [
        'Lãnh đạo, chỉ đạo Chi bộ thực hiện Nghị quyết, Chỉ thị của cấp trên và nhiệm vụ chính trị địa phương.',
        'Chủ trì các cuộc họp Chi bộ, sinh hoạt định kỳ hàng tháng; đảm bảo chất lượng sinh hoạt Đảng.',
        'Phân công nhiệm vụ cho các Chi ủy viên và đảng viên; kiểm tra, giám sát việc thực hiện.',
        'Lãnh đạo thực hiện công tác phát triển đảng viên mới, chuyển đảng chính thức.',
        'Quản lý thu nộp đảng phí hàng tháng; theo dõi sinh hoạt, phân loại đảng viên cuối năm.',
        'Phối hợp với Tổ trưởng dân phố và Ban Mặt trận trong công tác lãnh đạo toàn diện.',
        'Giải quyết kỷ luật Đảng, thi hành kỷ luật đảng viên vi phạm theo thẩm quyền.',
        'Báo cáo định kỳ tình hình Chi bộ lên Đảng ủy Phường.'
      ],
      legalBasis: 'Điều lệ Đảng CSVN 2011; Hướng dẫn 01-HD/TW ngày 28/9/2021',
      officialLink: 'https://tulieu.vov.vn/tin-tuc/dieu-le-dang-cong-san-viet-nam-2011-1.html',
      linkLabel: 'Điều lệ Đảng CSVN 2011 (Văn kiện chính thức)'
    },
    {
      id: 'role-4',
      title: 'Chi ủy viên',
      subtitle: 'Thành viên Ban Chấp hành Chi bộ; hỗ trợ Bí thư điều hành Chi bộ',
      icon: ShieldAlert,
      color: 'orange',
      summary: 'Là thành viên của Ban Chấp hành Chi bộ, được giao phụ trách một số mảng công tác cụ thể; chịu trách nhiệm trực tiếp trước Bí thư Chi bộ và trước toàn thể đảng viên.',
      duties: [
        'Thực hiện nhiệm vụ được phân công theo sự chỉ đạo của Bí thư Chi bộ.',
        'Phụ trách một mảng công tác chuyên biệt: kiểm tra, tuyên giáo, dân vận, tổ chức...',
        'Theo dõi, đôn đốc đảng viên trong nhóm phụ trách thực hiện nghị quyết, chỉ thị.',
        'Tham gia đầy đủ các cuộc họp Chi bộ, sinh hoạt Đảng; phát biểu ý kiến xây dựng Chi bộ.',
        'Gương mẫu trong lối sống, công tác; thực hiện đúng nghĩa vụ đảng viên theo Điều lệ Đảng.',
        'Tham gia kiểm tra, giám sát đảng viên theo sự phân công của Chi bộ.'
      ],
      legalBasis: 'Điều lệ Đảng CSVN 2011, Điều 9 — Nhiệm vụ đảng viên',
      officialLink: 'https://tulieu.vov.vn/tin-tuc/dieu-le-dang-cong-san-viet-nam-2011-1.html',
      linkLabel: 'Điều lệ Đảng CSVN 2011 (Điều 9 — Nhiệm vụ đảng viên)'
    },
    {
      id: 'role-5',
      title: 'Trưởng ban Công tác Mặt trận',
      subtitle: 'Đại diện Mặt trận Tổ quốc Việt Nam tại tổ dân phố',
      icon: Flag,
      color: 'teal',
      summary: 'Là cầu nối giữa Mặt trận Tổ quốc và nhân dân tại cơ sở; vận động nhân dân đoàn kết, giám sát cộng đồng và phản ánh ý kiến chính đáng của dân lên cấp trên.',
      duties: [
        'Vận động nhân dân tham gia cuộc vận động "Toàn dân đoàn kết xây dựng đời sống văn hóa".',
        'Giám sát việc thực hiện dân chủ ở cơ sở; phản ánh tâm tư, nguyện vọng của dân lên cấp trên.',
        'Tổ chức Ngày hội đại đoàn kết toàn dân tộc hàng năm (18/11) tại tổ dân phố.',
        'Vận động nhân dân tham gia các phong trào: xóa nghèo, khuyến học, bảo vệ môi trường...',
        'Phối hợp với Tổ trưởng và Chi bộ trong công tác hòa giải, giải quyết tranh chấp.',
        'Kiểm tra, giám sát cộng đồng về việc thực hiện chính sách, pháp luật của Nhà nước.',
        'Tổ chức lấy ý kiến nhân dân về các dự thảo luật, quy hoạch có ảnh hưởng đến địa bàn.',
        'Gặp gỡ, tiếp xúc, lắng nghe nhân dân định kỳ; tập hợp kiến nghị gửi UBND Phường và HĐND.'
      ],
      legalBasis: 'Luật Mặt trận Tổ quốc Việt Nam 2015; Điều lệ MTTQ Việt Nam (Đại hội IX/2019)',
      officialLink: 'https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Mat-tran-To-quoc-Viet-Nam-2015-281344.aspx',
      linkLabel: 'Luật MTTQ Việt Nam 2015 trên Thư viện Pháp luật'
    },
    {
      id: 'role-6',
      title: 'Trưởng ban Thanh tra nhân dân',
      subtitle: 'Giám sát dân chủ — đại diện quyền lợi và kiểm tra thực thi của cán bộ cơ sở',
      icon: UserCheck,
      color: 'purple',
      summary: 'Người đứng đầu Ban Thanh tra nhân dân tại tổ dân phố; thực hiện quyền giám sát của nhân dân đối với hoạt động của cán bộ và chính quyền cơ sở.',
      duties: [
        'Giám sát việc thực hiện các chính sách xã hội, chế độ đối với các đối tượng chính sách tại địa bàn.',
        'Kiểm tra việc quản lý, sử dụng các nguồn quỹ và tài sản công tại cộng đồng.',
        'Tiếp nhận và xử lý các ý kiến, khiếu nại của nhân dân; kiến nghị với UBND Phường giải quyết.',
        'Giám sát việc thực hiện pháp luật về dân chủ ở cơ sở (Luật Thực hiện dân chủ 2022).',
        'Phối hợp với Ban Mặt trận trong công tác giám sát và phản biện xã hội.',
        'Báo cáo kết quả giám sát tại các cuộc họp dân và gửi UBND Phường định kỳ.'
      ],
      legalBasis: 'Luật Thực hiện dân chủ ở cơ sở 2022; Nghị định 59/1998/NĐ-CP về Ban Thanh tra nhân dân',
      officialLink: 'https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Thuc-hien-dan-chu-o-co-so-2022-531932.aspx',
      linkLabel: 'Luật Thực hiện dân chủ cơ sở 2022 trên Thư viện Pháp luật'
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
            @media print { @page { margin: 0; } body { margin: 20mm !important; } }
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

  const filteredArticles = useMemo<Article[]>(() => articles.filter((a: Article) => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.content.toLowerCase().includes(searchQuery.toLowerCase())
  ), [articles, searchQuery]);

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue:   { bg: 'rgba(59,130,246,0.08)',  text: '#2563eb', border: 'rgba(59,130,246,0.25)' },
    indigo: { bg: 'rgba(99,102,241,0.08)',  text: '#4f46e5', border: 'rgba(99,102,241,0.25)' },
    red:    { bg: 'rgba(239,68,68,0.08)',   text: '#dc2626', border: 'rgba(239,68,68,0.25)' },
    orange: { bg: 'rgba(245,158,11,0.08)',  text: '#d97706', border: 'rgba(245,158,11,0.25)' },
    teal:   { bg: 'rgba(20,184,166,0.08)',  text: '#0d9488', border: 'rgba(20,184,166,0.25)' },
    purple: { bg: 'rgba(139,92,246,0.08)',  text: '#7c3aed', border: 'rgba(139,92,246,0.25)' },
  };

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
        <button className={`tab-btn ${activeSubTab === 'duties' ? 'active' : ''}`} onClick={() => setActiveSubTab('duties')}>
          <BookOpen size={18} /><span>5 Chức năng, Nhiệm vụ trọng tâm</span>
        </button>
        <button className={`tab-btn ${activeSubTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveSubTab('roles')}>
          <Users size={18} /><span>Chức trách Cán bộ</span>
        </button>
        <button className={`tab-btn ${activeSubTab === 'circulars' ? 'active' : ''}`} onClick={() => setActiveSubTab('circulars')}>
          <Scale size={18} /><span>Trích lục Thông tư Bộ Nội vụ</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="tab-content" style={{ marginTop: '20px' }}>

        {/* TAB 1: Duties */}
        {activeSubTab === 'duties' && (
          <div className="duties-grid">
            <div className="info-banner">
              <Info size={20} className="info-icon" />
              <div className="info-text">
                <strong>Bạn có biết?</strong> Tổ dân phố không phải là một cấp chính quyền hành chính độc lập. Đây là tổ chức tự quản trực tiếp từ cộng đồng nhân dân, do dân tự bầu ra dưới sự lãnh đạo trực tiếp của Chi bộ và sự hướng dẫn hành chính của UBND Phường.
              </div>
            </div>
            <div className="duty-cards-container">
              {duties.map((d, index) => (
                <div key={d.id} className="duty-card">
                  <div className="duty-card-header">
                    <div className={`duty-icon-badge ${d.color}`}><d.icon size={22} /></div>
                    <div className="duty-card-title">
                      <span className="duty-number">Nhiệm vụ {index + 1}</span>
                      <h3>{d.title}</h3>
                    </div>
                  </div>
                  <div className="duty-card-body">
                    <p className="duty-summary">{d.summary}</p>
                    <ul className="duty-list">
                      {d.details.map((detail, idx) => (<li key={idx}>{detail}</li>))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Roles */}
        {activeSubTab === 'roles' && (
          <div className="roles-section">
            <div className="info-banner">
              <Info size={20} className="info-icon" />
              <div className="info-text">
                <strong>Chức trách & Nhiệm vụ từng chức danh</strong> — Mỗi mục kèm theo <strong>liên kết văn bản pháp lý gốc</strong> từ cổng thông tin chính phủ. Nội dung đã được tóm tắt dễ đọc; bấm nút <em>"Xem văn bản gốc"</em> để đọc bản đầy đủ cập nhật của Nhà nước.
              </div>
            </div>
            <div className="roles-accordion">
              {officialRoles.map((role) => {
                const isOpen = expandedRole === role.id;
                const c = colorMap[role.color];
                return (
                  <div key={role.id} className={`role-item ${isOpen ? 'active' : ''}`} style={{ borderColor: isOpen ? c.text : undefined }}>
                    <button className="role-header" onClick={() => setExpandedRole(isOpen ? null : role.id)}>
                      <div className="role-header-left">
                        <div className="role-icon-badge" style={{ background: c.bg, color: c.text }}>
                          <role.icon size={20} />
                        </div>
                        <div className="role-title-block">
                          <span className="role-title">{role.title}</span>
                          <span className="role-subtitle">{role.subtitle}</span>
                        </div>
                      </div>
                      <ChevronDown size={18} className="role-chevron" style={{ color: isOpen ? c.text : undefined }} />
                    </button>
                    {isOpen && (
                      <div className="role-body">
                        <p className="role-summary">{role.summary}</p>
                        <div className="role-duties-title">Nhiệm vụ cụ thể:</div>
                        <ul className="role-duties-list">
                          {role.duties.map((d, idx) => (<li key={idx}>{d}</li>))}
                        </ul>
                        <div className="role-footer">
                          <div className="role-legal">
                            <Scale size={13} />
                            <span>{role.legalBasis}</span>
                          </div>
                          <a
                            href={role.officialLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="role-link-btn"
                            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                          >
                            <ExternalLink size={13} />
                            {role.linkLabel}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Circulars */}
        {activeSubTab === 'circulars' && (
          <div className="circulars-section">
            <div className="circulars-search">
              <Search size={18} />
              <input type="text" placeholder="Tìm kiếm điều khoản thông tư..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <div className="articles-accordion">
              {filteredArticles.map(a => {
                const isExpanded = expandedArticle === a.id;
                return (
                  <div key={a.id} className={`article-item ${isExpanded ? 'active' : ''}`}>
                    <button className="article-header" onClick={() => setExpandedArticle(isExpanded ? null : a.id)}>
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
        .regulations-page { animation: fadeIn 0.4s ease-out; }
        .tab-control { display: flex; border-bottom: 2px solid var(--border); gap: 24px; flex-wrap: wrap; }
        .tab-btn { background: none; border: none; padding: 12px 6px; font-weight: 600; font-size: 0.9rem; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s ease; }
        .tab-btn:hover { color: var(--primary); }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .info-banner { background: linear-gradient(135deg, rgba(59,130,246,0.05), rgba(59,130,246,0.02)); border: 1px dashed rgba(59,130,246,0.3); padding: 16px 20px; border-radius: var(--radius-lg); display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
        .info-icon { color: var(--primary); flex-shrink: 0; margin-top: 2px; }
        .info-text { font-size: 0.88rem; line-height: 1.5; color: #334155; }
        /* Duties */
        .duty-cards-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .duty-card { background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; transition: all 0.2s ease; }
        .duty-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.05); border-color: var(--primary-light); }
        .duty-card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .duty-icon-badge { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .duty-icon-badge.blue { background: rgba(59,130,246,0.1); color: var(--primary); }
        .duty-icon-badge.indigo { background: rgba(99,102,241,0.1); color: #6366f1; }
        .duty-icon-badge.red { background: rgba(239,68,68,0.1); color: var(--danger); }
        .duty-icon-badge.orange { background: rgba(245,158,11,0.1); color: var(--warning); }
        .duty-icon-badge.teal { background: rgba(20,184,166,0.1); color: #0d9488; }
        .duty-card-title .duty-number { font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; }
        .duty-card-title h3 { font-size: 1.05rem; font-weight: 700; margin: 2px 0 0 0; color: var(--text-main); }
        .duty-summary { font-size: 0.88rem; color: #475569; margin: 0 0 16px 0; line-height: 1.45; font-weight: 500; }
        .duty-list { padding-left: 18px; margin: 0; font-size: 0.85rem; color: #64748b; display: flex; flex-direction: column; gap: 8px; }
        .duty-list li { line-height: 1.45; }
        /* Roles */
        .roles-section { max-width: 860px; }
        .roles-accordion { display: flex; flex-direction: column; gap: 12px; }
        .role-item { background: white; border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
        .role-item.active { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .role-header { width: 100%; background: none; border: none; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; text-align: left; gap: 12px; }
        .role-header-left { display: flex; align-items: center; gap: 14px; flex: 1; }
        .role-icon-badge { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .role-title-block { display: flex; flex-direction: column; gap: 2px; }
        .role-title { font-size: 1rem; font-weight: 700; color: var(--text-main); }
        .role-subtitle { font-size: 0.76rem; color: var(--text-muted); font-weight: 500; }
        .role-chevron { flex-shrink: 0; transition: transform 0.2s; color: var(--text-muted); }
        .role-item.active .role-chevron { transform: rotate(180deg); }
        .role-body { padding: 4px 20px 20px 76px; border-top: 1px dashed var(--border); animation: slideDown 0.2s ease-out; }
        .role-summary { font-size: 0.88rem; color: #475569; font-weight: 500; line-height: 1.5; margin: 14px 0; padding: 10px 14px; background: #f8fafc; border-left: 3px solid var(--border); border-radius: 0 6px 6px 0; }
        .role-duties-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.6px; margin-bottom: 8px; }
        .role-duties-list { padding-left: 18px; margin: 0 0 18px 0; font-size: 0.86rem; color: #334155; display: flex; flex-direction: column; gap: 7px; }
        .role-duties-list li { line-height: 1.5; }
        .role-footer { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px dashed var(--border); }
        .role-legal { display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--text-muted); font-weight: 500; }
        .role-link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; text-decoration: none; transition: opacity 0.15s; width: fit-content; }
        .role-link-btn:hover { opacity: 0.75; }
        /* Circulars */
        .circulars-search { background: white; padding: 10px 16px; border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; align-items: center; gap: 12px; margin-bottom: 24px; max-width: 480px; }
        .circulars-search input { border: none; outline: none; width: 100%; font-size: 0.9rem; }
        .articles-accordion { display: flex; flex-direction: column; gap: 12px; max-width: 800px; }
        .article-item { background: white; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; transition: all 0.2s ease; }
        .article-item:hover, .article-item.active { border-color: var(--primary); }
        .article-item.active { box-shadow: 0 2px 8px rgba(37,99,235,0.05); }
        .article-header { width: 100%; background: none; border: none; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 600; font-size: 0.95rem; color: var(--text-main); text-align: left; }
        .article-header .header-left { display: flex; align-items: center; gap: 12px; }
        .article-header .scale-icon { color: var(--text-muted); }
        .article-item.active .article-header .scale-icon { color: var(--primary); }
        .article-header .chevron { color: var(--text-muted); transition: transform 0.2s; }
        .article-item.active .chevron { transform: rotate(180deg); color: var(--primary); }
        .article-body { padding: 0 20px 20px 50px; border-top: 1px dashed var(--border); font-size: 0.9rem; line-height: 1.6; color: #334155; animation: slideDown 0.2s ease-out; }
        .article-body p { margin: 12px 0; }
        .article-footer { margin-top: 12px; }
        .source-tag { font-size: 0.72rem; background: #f1f5f9; color: #475569; font-weight: 600; padding: 4px 8px; border-radius: 4px; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Regulations;
