import { useState, useEffect } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeightRule,
  TableLayoutType,
  convertInchesToTwip,
} from 'docx';
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
  Users,
  Plus,
  Trash2,
  Edit,
  Settings,
  RotateCcw,
  X,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { db, partyDb } from '../services/db';
import { showToast } from '../utils/toast';

const getAge = (dobString: string): number => {
  if (!dobString) return 0;
  return new Date().getFullYear() - new Date(dobString).getFullYear();
};

export interface AITemplate {
  id: string;
  group: 'to_truong' | 'party' | 'front';
  title: string;
  icon: string;
  prompt: string;
  contentTemplate: string;
  docType: 'party' | 'front' | 'admin';
}

const DEFAULT_AI_TEMPLATES: AITemplate[] = [
  {
    id: 'to_truong_hop_dan',
    group: 'to_truong',
    title: 'Thông báo họp dân',
    icon: '📢',
    prompt: 'Viết thông báo họp dân về việc tổng vệ sinh môi trường ngõ xóm vào sáng Chủ Nhật tuần này.',
    docType: 'admin',
    contentTemplate: `Thực hiện kế hoạch hoạt động của UBND {tenPhuong} và Ban điều hành {tdpDisplay}, trân trọng kính mời đại diện các hộ gia đình đến tham dự cuộc họp dân.

1. Mục đích họp:
- Bàn bạc công tác dọn dẹp vệ sinh môi trường ngõ xóm và triển khai một số công việc chung của Tổ dân phố.
- Trao đổi, ghi nhận các phản ánh, đề xuất của bà con.

2. Thời gian: 19 giờ 30 phút, ngày 15 tháng 06 năm {namNay} (Thứ Hai) (hoặc ngày ..... tháng ..... năm {namNay}).
3. Địa điểm: Nhà văn hóa {tdpDisplay}.

Rất mong đại diện các hộ gia đình sắp xếp thời gian, tham gia đầy đủ và đúng giờ để cuộc họp đạt kết quả tốt nhất. Xin trân trọng cảm ơn!`
  },
  {
    id: 'to_truong_bien_ban',
    group: 'to_truong',
    title: 'Biên bản họp tổ',
    icon: '📋',
    prompt: 'Viết biên bản cuộc họp tổ dân phố thảo luận dự án bê tông hóa ngõ 47 tối thứ Hai vừa rồi.',
    docType: 'admin',
    contentTemplate: `BIÊN BẢN HỌP TỔ DÂN PHỐ
Về việc họp bàn thảo luận công tác nội bộ Tổ dân phố

Hôm nay, vào lúc 19 giờ 30 phút, ngày 15 tháng 06 năm {namNay}, tại Nhà văn hóa {tdpDisplay} đã diễn ra cuộc họp Tổ dân phố.

I. THÀNH PHẦN THAM DỰ:
1. Chủ trì cuộc họp: {tenToTruong} — Tổ trưởng dân phố.
2. Thư ký ghi biên bản: Bà Lê Thị Dung.
3. Số lượng đại biểu tham dự: Đại diện của {tongHoDan} hộ gia đình.

II. NỘI DUNG CUỘC HỌP:
1. {tenToTruong} trình bày lý do cuộc họp: Họp bàn thảo luận thống nhất đóng góp đổ bê tông đường ngõ, chăm sóc cảnh quan môi trường.
2. Bà con nhân dân thảo luận và đưa ra ý kiến đóng góp:
- Ý kiến 1: Nhất trí hoàn toàn với chủ trương của ban điều hành TDP.
- Ý kiến 2: Đề nghị công khai minh bạch tài chính sau khi thực hiện xong.
3. Biểu quyết thông qua:
- Số hộ đồng ý: 100%.
- Ý kiến khác: Không.

Cuộc họp kết thúc vào lúc 21 giờ 30 phút cùng ngày, biên bản đã được thông qua trước toàn thể cuộc họp.

     THƯ GHI BIÊN BẢN                      TỔ TRƯỞNG DÂN PHỐ
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_bao_cao',
    group: 'to_truong',
    title: 'Báo cáo tháng TDP',
    icon: '📊',
    prompt: 'Soạn báo cáo tình hình hoạt động tháng của Tổ dân phố để gửi lên UBND Phường.',
    docType: 'admin',
    contentTemplate: `BÁO CÁO TÌNH HÌNH HOẠT ĐỘNG THÁNG {thangNay}/{namNay}

Kính gửi: Ủy ban nhân dân {tenPhuong}.

Ban điều hành {tdpDisplay} xin báo cáo kết quả hoạt động tháng vừa qua như sau:

1. Công tác Dân số - Địa bàn:
- Tổng số hộ gia đình quản lý: {tongHoDan} hộ.
- Tổng số nhân khẩu thực tế: {tongNhanKhau} nhân khẩu.

2. Công tác Tài chính - Quỹ cộng đồng:
- Số dư hiện tại của quỹ TDP: {soDuTaiChinh}.
- Tổng thu trong tháng: {tongThuTaiChinh}.
- Tổng chi thiết yếu trong tháng: {tongChiTaiChinh}.

Ban điều hành TDP sẽ tiếp tục duy trì hoạt động tốt trong thời gian tới.

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_ke_hoach_quy',
    group: 'to_truong',
    title: 'Kế hoạch vận động quỹ',
    icon: '💰',
    prompt: 'Lập báo cáo kế hoạch vận động các khoản đóng góp tự nguyện gửi UBND phường.',
    docType: 'admin',
    contentTemplate: `BÁO CÁO KẾ HOẠCH VẬN ĐỘNG CÁC KHOẢN ĐÓNG GÓP TỰ NGUYỆN NĂM {namNay}
Về việc vận động các khoản đóng góp tự nguyện phục vụ hoạt động cộng đồng năm {namNay}.

Kính gửi: UBND phường {tenPhuong}

Căn cứ nhu cầu thực tế của cộng đồng dân cư {tdpDisplay}; nhằm đảm bảo nguồn kinh phí phục vụ các hoạt động xã hội, văn hóa, khuyến học, an sinh và các hoạt động cộng đồng khác trên địa bàn, {tdpDisplay} xây dựng kế hoạch vận động các khoản đóng góp tự nguyện năm {namNay} như sau:

I. MỤC ĐÍCH, YÊU CẦU:
1. Huy động nguồn lực xã hội hóa để phục vụ các hoạt động chung của cộng đồng dân cư.
2. Việc vận động được thực hiện trên tinh thần tự nguyện, công khai, minh bạch, dân chủ và đúng quy định của pháp luật.
3. Các khoản thu, chi được công khai trước Nhân dân và báo cáo theo quy định.

II. NỘI DUNG VẬN ĐỘNG:
1. Quỹ khuyến học: Khen thưởng học sinh đạt thành tích xuất sắc, hỗ trợ học sinh có hoàn cảnh khó khăn.
2. Quỹ an sinh xã hội: Thăm hỏi, hỗ trợ các hộ gia đình có hoàn cảnh khó khăn, ốm đau rủi ro đột xuất.
3. Quỹ văn hóa - thể thao: Tổ chức hoạt động hè, văn nghệ, thể dục thể thao hè năm {namNay}.
4. Kinh phí điện, nước, internet và bảo vệ Nhà văn hóa TDP.
5. Quỹ chăm sóc cảnh quan, môi trường: Trồng và chăm sóc cây xanh, hoa, dọn dẹp vệ sinh môi trường.
6. Quỹ sinh hoạt đám hiếu: Tương trợ, hỗ trợ hoạt động đám hiếu tại khu dân cư.

III. TỔ CHỨC THỰC HIỆN:
- TDP kính đề nghị UBND phường xem xét và thống nhất chủ trương để Tổ dân phố tổ chức họp Nhân dân triển khai thực hiện.

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_noi_dung_hop',
    group: 'to_truong',
    title: 'Nội dung họp vận động',
    icon: '🗣️',
    prompt: 'Soạn nội dung hội nghị nhân dân thảo luận mức đóng góp tự nguyện năm 2026.',
    docType: 'admin',
    contentTemplate: `NỘI DUNG HỘI NGHỊ NHÂN DÂN
Về việc vận động các khoản đóng góp tự nguyện phục vụ hoạt động cộng đồng năm {namNay}.

Kính thưa toàn thể Nhân dân {tdpDisplay}!

Nhằm tạo nguồn kinh phí phục vụ các hoạt động chung của cộng đồng dân cư, góp phần xây dựng {tdpDisplay} ngày càng văn minh, đoàn kết và phát triển, Tổ dân phố đề xuất hội nghị Nhân dân xem xét, thảo luận và thống nhất việc vận động các khoản đóng góp tự nguyện năm {namNay} như sau:

1. Quỹ khuyến học: Đề xuất mức thu tham khảo 50.000 đồng/hộ/năm.
2. Quỹ an sinh xã hội: Đề xuất mức thu tham khảo 20.000 đồng/hộ/năm.
3. Quỹ văn hóa - thể thao: Đề xuất mức thu tham khảo 30.000 đồng/hộ/năm.
4. Điện, nước, internet, bảo vệ NVH: Đề xuất mức thu tham khảo 50.000 đồng/hộ/năm.
5. Quỹ môi trường: Đề xuất mức thu tham khảo 20.000 đồng/hộ/năm.
6. Quỹ đám hiếu: Đề xuất mức thu tham khảo 30.000 đồng/hộ/năm.
=> TỔNG CỘNG ĐỀ XUẤT: 200.000 đồng/hộ/năm.

Với quy mô khoảng {tongHoDan} hộ dân, nếu toàn thể Nhân dân thống nhất mức trên thì tổng nguồn quỹ dự kiến thu nộp là khá lớn, đủ để duy trì các hoạt động cộng đồng thiết yếu. Kính đề nghị toàn thể Nhân dân tham gia thảo luận và biểu quyết thống nhất thực hiện.`
  },
  {
    id: 'to_truong_thu_ngo',
    group: 'to_truong',
    title: 'Thư ngỏ vận động quỹ',
    icon: '✉️',
    prompt: 'Viết thư ngỏ kêu gọi toàn thể nhân dân đóng góp ủng hộ quỹ Vì người nghèo năm 2026.',
    docType: 'admin',
    contentTemplate: `THƯ NGỎ KÊU GỌI ỦNG HỘ QUỸ VẬN ĐỘNG

Kính gửi: Toàn thể bà con nhân dân, các hộ gia đình và nhà hảo tâm đang sinh sống tại {tdpDisplay}.

Phát huy truyền thống tương thân tương ái, "lá lành đùm lá rách" của dân tộc Việt Nam và chăm lo tốt hơn cho các gia đình có hoàn cảnh khó khăn trên địa bàn.

Ban điều hành {tdpDisplay} tha thiết kêu gọi toàn thể bà con tích cực tham gia đóng góp ủng hộ Quỹ Đền ơn đáp nghĩa & Vì người nghèo năm {namNay}.

Mọi sự ủng hộ đóng góp tự nguyện xin gửi về:
- Ban thủ quỹ Tổ dân phố (Nhà văn hóa) hoặc đóng trực tiếp cho các cán bộ tổ dân phố đi vận động tận nhà.
- Thời gian vận động: Từ nay đến hết ngày 30/06/{namNay}.

Mỗi tấm lòng của quý vị sẽ góp phần xây dựng một cộng đồng {tenTDP} ngày càng ấm no, đoàn kết và phát triển. Xin chân thành cảm ơn sự đồng hành của quý bà con!

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_kiem_tra_ho_khau',
    group: 'to_truong',
    title: 'Biên bản kiểm tra hộ khẩu',
    icon: '🏠',
    prompt: 'Soạn biên bản kiểm tra hộ khẩu rà soát dân cư định kỳ năm 2026.',
    docType: 'admin',
    contentTemplate: `BIÊN BẢN
Rà soát, kiểm tra hộ khẩu và nhân khẩu thường trú năm {namNay}

Hôm nay, ngày ..... tháng ..... năm {namNay}, Tổ dân phố {tenTDP} tiến hành rà soát định kỳ hộ khẩu và nhân khẩu trên địa bàn quản lý.

Thành phần thực hiện:
- {leaderDisplay} — Tổ trưởng dân phố, chủ trì.
- Đại diện công an phường (nếu có): .....
- Đại diện Ban điều hành: .....

I. KẾT QUẢ RÀ SOÁT THỰC TẾ:
1. Tổng số hộ quản lý: {tongHoDan} hộ gia đình.
2. Tổng số nhân khẩu thường trú: {tongNhanKhau} người.

II. ĐỐI TƯỢNG ĐẶC BIỆT:
- Hộ nghèo: {hoNgheo} hộ.
- Hộ cận nghèo: {hoCanNgheo} hộ.
- Hộ gia đình chính sách: {hoChinhSach} hộ.

III. NHẬN XÉT:
Tình trạng quản lý hộ khẩu cơ bản ổn định. Biên bản đã được đọc lại cho toàn thể những người có mặt nghe và nhất trí ký.

     THƯ KÝ GHI BIÊN BẢN                    TỔ TRƯỞNG DÂN PHỐ
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_bao_cao_antt',
    group: 'to_truong',
    title: 'Báo cáo ANTT',
    icon: '🔐',
    prompt: 'Soạn báo cáo an ninh trật tự tháng gửi Công an phường.',
    docType: 'admin',
    contentTemplate: `BÁO CÁO
Tình hình an ninh trật tự tháng {thangNay}/{namNay}

Kính gửi: Ủy ban nhân dân {tenPhuong} và Công an phường.

Ban điều hành Tổ dân phố {tenTDP} xin báo cáo tình hình an ninh trật tự trên địa bàn tháng {thangNay} năm {namNay} như sau:

I. TÌNH HÌNH CHUNG:
- Tổng số hộ dân quản lý: {tongHoDan} hộ, {tongNhanKhau} nhân khẩu.
- Trong tháng, tình hình an ninh trật tự trên địa bàn về cơ bản ổn định. Không xảy ra tội phạm, tệ nạn xã hội, mâu thuẫn nghiêm trọng.

II. CÁC HOẠT ĐỘNG PHÒNG NGỪA:
1. Duy trì tổ tự quản an ninh trật tự, thực hiện tuần tra định kỳ ban đêm theo lịch.
2. Tuyên truyền bà con cảnh giác với tội phạm lừa đảo qua mạng, trộm cắp tài sản.
3. Vận động nhân dân cung cấp thông tin tội phạm theo kênh đường dây nóng công an phường.

III. KIẾN NGHỊ:
- Đề nghị Công an phường tăng cường tuần tra khu vực ngõ nhỏ về ban đêm.

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_to_trinh_kinh_phi',
    group: 'to_truong',
    title: 'Tờ trình xin hỗ trợ kinh phí',
    icon: '📝',
    prompt: 'Soạn tờ trình gửi UBND phường xin hỗ trợ kinh phí sửa chữa Nhà văn hóa Tổ dân phố.',
    docType: 'admin',
    contentTemplate: `TỜ TRÌNH
Về việc xin hỗ trợ kinh phí sửa chữa, nâng cấp cơ sở vật chất Tổ dân phố

Kính gửi: Ủy ban nhân dân {tenPhuong}.

Căn cứ tình hình thực tế và nhu cầu sinh hoạt của nhân dân trên địa bàn Tổ dân phố {tenTDP}, Ban điều hành Tổ dân phố kính trình UBND phường xem xét và hỗ trợ kinh phí như sau:

I. SỰ CẦN THIẾT THỰC HIỆN:
Hiện nay, Nhà văn hóa Tổ dân phố {tenTDP} (hoặc tuyến đường ngõ .....) đã xuống cấp nghiêm trọng, cụ thể:
- Phần mái bị dột nước khi trời mưa, tường bong tróc, trang thiết bị bàn ghế thiếu thốn.
- Ảnh hưởng trực tiếp đến chất lượng sinh hoạt cộng đồng của hơn {tongHoDan} hộ dân trên địa bàn.

II. NỘI DUNG VÀ DỰ TOÁN KINH PHÍ:
1. Nội dung sửa chữa dự kiến: Sửa mái tôn, sơn lại tường, mua thêm 50 bộ ghế ngồi.
2. Tổng kinh phí dự toán: ..... đồng.
3. Nguồn kinh phí:
- Nhân dân đóng góp tự nguyện: ..... đồng.
- Kính trình UBND phường hỗ trợ: ..... đồng.

Ban điều hành TDP {tenTDP} rất mong nhận được sự quan tâm, tạo điều kiện giúp đỡ của UBND phường để bà con sớm có nơi sinh hoạt ổn định.

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'to_truong_giay_moi_hop',
    group: 'to_truong',
    title: 'Giấy mời họp Ban điều hành',
    icon: '✉️',
    prompt: 'Viết giấy mời họp Ban điều hành Tổ dân phố mở rộng triển khai công tác tháng.',
    docType: 'admin',
    contentTemplate: `GIẤY MỜI
Tham dự cuộc họp Ban điều hành Tổ dân phố mở rộng

Ban điều hành Tổ dân phố {tenTDP} trân trọng kính mời:
- Các đồng chí trong Ban điều hành TDP (Tổ trưởng, Tổ phó).
- Các đồng chí Trưởng chi hội đoàn thể (Phụ nữ, Cựu chiến binh, Đoàn thanh niên, Người cao tuổi).
- Các đồng chí Tổ trưởng Tổ tự quản dân cư.

Đến tham dự cuộc họp định kỳ triển khai nhiệm vụ trọng tâm:

1. Nội dung cuộc họp:
- Đánh giá kết quả công tác quản lý dân cư, thu nộp các loại quỹ tháng vừa qua.
- Thống nhất kế hoạch triển khai phong trào thi đua mới và giải quyết một số kiến nghị của bà con nhân dân.

2. Thời gian: ..... giờ ..... phút, ngày ..... tháng ..... năm {namNay}.
3. Địa điểm: Nhà văn hóa Tổ dân phố {tenTDP}.

Kính mong các đồng chí sắp xếp thời gian tham dự đầy đủ, đúng giờ để cuộc họp đạt kết quả tốt.

                                           TỔ TRƯỞNG DÂN PHỐ
                                           (Ký, ghi rõ họ tên)


                                           {leaderName}`
  },
  {
    id: 'party_nghi_quyet',
    group: 'party',
    title: 'Nghị quyết Chi bộ',
    icon: '⚖️',
    prompt: 'Soạn Nghị quyết cuộc họp Chi bộ Tổ dân phố tháng này lãnh đạo công tác an ninh trật tự.',
    docType: 'party',
    contentTemplate: `NGHỊ QUYẾT
Họp Chi bộ Tổ dân phố {tenTDP} tháng {thangNay}/{namNay}

Vào lúc 19 giờ 30 phút, ngày 15 tháng {monthStr} năm {namNay}, tại Nhà văn hóa {tdpDisplay}, Chi bộ Tổ dân phố {tenTDP} đã tổ chức cuộc họp thường kỳ.
- Chủ trì cuộc họp: Đồng chí Bí thư Chi bộ.
- Thư ký họp: Đồng chí Chi ủy viên.
- Thành phần: Có mặt {tongDangVien}/{tongDangVien} đồng chí Đảng viên trong Chi bộ.

Sau khi nghe báo cáo kết quả và thảo luận, Chi bộ thống nhất ban hành Nghị quyết gồm các nội dung chính:

1. Đánh giá công tác tư tưởng Đảng viên:
- Tiếp tục thực hiện tốt công tác giáo dục chính trị tư tưởng, đảm bảo 100% Đảng viên gương mẫu đi đầu trong mọi phong trào tại địa phương.

2. Lãnh đạo thực hiện công tác chuyên đề:
- Thống nhất chủ trương: Lãnh đạo thực hiện nhiệm vụ phát triển kinh tế - xã hội, giữ vững an ninh trật tự địa bàn dân cư.
- Phân công nhiệm vụ cụ thể cho từng đồng chí Đảng viên phụ trách từng ngõ xóm để đôn đốc bà con nhân dân.

3. Công tác tổ chức và thu chi Đảng phí:
- Thực hiện thu nộp Đảng phí tháng theo đúng Quy định 01-QĐ/TW 2026.
- Tiếp tục bồi dưỡng quần chúng ưu tú để đề xuất kết nạp Đảng viên mới.

Nghị quyết này được 100% Đảng viên dự họp biểu quyết nhất trí thông qua.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_bao_cao_cong_tac',
    group: 'party',
    title: 'Báo cáo công tác Chi bộ',
    icon: '📝',
    prompt: 'Viết báo cáo đánh giá hoạt động định kỳ của Chi bộ gửi Đảng ủy phường.',
    docType: 'party',
    contentTemplate: `BÁO CÁO
Tình hình sinh hoạt và hoạt động Chi bộ tháng {thangNay}/{namNay}

Kính gửi: Đảng ủy {tenPhuong}.

Chi bộ Tổ dân phố {tenTDP} xin báo cáo kết quả công tác hoạt động trong tháng như sau:

1. Tình hình tổ chức Chi bộ:
- Tổng số Đảng viên: {tongDangVien} đồng chí.
- Trong đó: Đảng viên chính thức: {dangVienChinhThuc} đồng chí; Đảng viên dự bị: {dangVienDuBi} đồng chí.
- Đảng viên miễn sinh hoạt (ốm đau, già yếu): 0 đồng chí.

2. Công tác lãnh đạo thực hiện nhiệm vụ chính trị:
- Chỉ đạo Ban điều hành Tổ dân phố hoàn thành tốt việc quản lý dân cư, nhân khẩu với tổng số {tongHoDan} hộ gia đình và {tongNhanKhau} nhân khẩu.
- Lãnh đạo giải quyết kịp thời các phản ánh dân nguyện của bà con (Đã giải quyết thành công các mâu thuẫn tranh chấp nhỏ trên địa bàn).

3. Công tác xây dựng Đảng:
- Tổ chức học tập nghị quyết của Đảng ủy cấp trên đầy đủ.
- Thu nộp Đảng phí đầy đủ, nộp về Đảng ủy phường đúng thời hạn.
- Chi bộ sinh hoạt đúng định kỳ, duy trì nề nếp kỷ luật Đảng nghiêm minh.

Phương hướng tháng tới: Tiếp tục phát huy vai trò lãnh đạo toàn diện của Chi bộ trong các công tác an sinh xã hội địa phương.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_bien_ban_hop',
    group: 'party',
    title: 'Biên bản họp Chi bộ',
    icon: '📋',
    prompt: 'Soạn biên bản sinh hoạt họp Chi bộ Tổ dân phố tháng này.',
    docType: 'party',
    contentTemplate: `BIÊN BẢN SINH HOẠT CHI BỘ THƯỜNG KỲ
(Thực hiện theo Hướng dẫn số 12-HD/BTCTW của Ban Tổ chức Trung ương)

Hôm nay, vào hồi ..... giờ ..... ngày ..... tháng ..... năm {namNay}, tại .....
Chi bộ Tổ dân phố {tenTDP} đã tổ chức cuộc họp thường kỳ tháng {thangNay}/{namNay}

I. THÀNH PHẦN THAM DỰ:
1. Số đảng viên được triệu tập: {tongDangVien} đồng chí. Trong đó chính thức: {dangVienChinhThuc}; dự bị: {dangVienDuBi}.
2. Đảng viên có mặt dự họp: ..... đồng chí.
3. Đảng viên vắng mặt: ..... đồng chí (Có lý do: .....; Không lý do: .....) .
4. Đại biểu Đảng ủy cấp trên tham dự (nếu có): .....
- Chủ trì cuộc họp: Đồng chí {tenBiThu} - Bí thư Chi bộ.
- Thư ký cuộc họp: Đồng chí Chi ủy viên.

II. NỘI DUNG BUỔI HỌP:
1. Công tác chính trị, tư tưởng đảng viên:
- Đồng chí Bí thư phổ biến các tin tức thời sự nổi bật trong tháng và quán triệt các văn bản chỉ đạo mới nhất của Đảng ủy phường.
- Nhận xét tinh thần gương mẫu của đảng viên trong các hoạt động cộng đồng.

2. Báo cáo đánh giá hoạt động công tác tháng qua:
- Chi bộ lãnh đạo Ban điều hành tổ dân phố thực hiện tốt công tác quản lý cư trú: {tongHoDan} hộ, {tongNhanKhau} nhân khẩu.
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


                                           {partySecretaryName}`
  },
  {
    id: 'party_ke_hoach_hoc_tap',
    group: 'party',
    title: 'Kế hoạch học tập NQ',
    icon: '📚',
    prompt: 'Soạn kế hoạch học tập nghị quyết Chi bộ Tổ dân phố tháng này.',
    docType: 'party',
    contentTemplate: `KẾ HOẠCH
Học tập, quán triệt và triển khai thực hiện Nghị quyết
của Đảng ủy {tenPhuong} tháng {thangNay}/{namNay}

Thực hiện Kế hoạch của Đảng ủy {tenPhuong} về việc tổ chức học tập và quán triệt Nghị quyết, Chi bộ Tổ dân phố {tenTDP} xây dựng Kế hoạch học tập như sau:

I. MỤC ĐÍCH, YÊU CẦU:
1. Tất cả đảng viên trong Chi bộ phải nghiêm túc tham gia học tập, nắm vững nội dung cốt lõi của các Nghị quyết.
2. Trên cơ sở đó vận dụng sáng tạo vào thực tiễn, lãnh đạo tốt các nhiệm vụ chính trị của địa phương.

II. NỘI DUNG VÀ PHÂN CÔNG THỰC HIỆN:
1. Tổ chức học tập toàn bộ {tongDangVien} đảng viên trong Chi bộ.
2. Mời báo cáo viên (hoặc tự nghiên cứu tài liệu) theo tài liệu hướng dẫn của cấp trên.
3. Mỗi đảng viên viết bản thu hoạch cá nhân sau khi học tập xong.

III. THỜI GIAN VÀ ĐỊA ĐIỂM:
- Thời gian: ..... ngày ..... tháng {thangNay} năm {namNay}.
- Địa điểm: Nhà văn hóa Tổ dân phố {tenTDP}.

IV. TỔ CHỨC THỰC HIỆN:
- Đồng chí Bí thư chủ trì, điều hành buổi học tập.
- Thư ký Chi ủy tổng hợp bản thu hoạch cá nhân và báo cáo về Đảng ủy phường.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_tu_kiem',
    group: 'party',
    title: 'Danh sách đảng viên tự kiểm',
    icon: '✅',
    prompt: 'Soạn mẫu đảng viên tự kiểm điểm cuối năm của Chi bộ.',
    docType: 'party',
    contentTemplate: `MẪU ĐẢNG VIÊN TỰ KIỂM ĐIỂM CUỐI NĂM
Chi bộ Tổ dân phố {tenTDP} — Năm {namNay}

Họ và tên đảng viên: ..............................................................
Sinh ngày: ............................................................................
Chức vụ trong Đảng: .............................................................
Chức vụ chính quyền (nếu có): .............................................
Tổ đảng (hoặc tổ dân cư phụ trách): ...................................

I. ƯU ĐIỂM, KẾT QUẢ ĐẠT ĐƯỢC:
1. Về tư tưởng chính trị: Luôn trung thành với chủ nghĩa Mác-Lênin, tư tưởng Hồ Chí Minh và đường lối đổi mới của Đảng.
2. Về phẩm chất đạo đức, lối sống: Giữ gìn lối sống gương mẫu, lành mạnh, không có biểu hiện tự diễn biến, tự chuyển hóa.
3. Về thực hiện nhiệm vụ được giao: Hoàn thành đầy đủ nhiệm vụ Chi bộ và Tổ đảng phân công. Tích cực tham gia đóng góp xây dựng {tenTDP}.
4. Về tổ chức kỷ luật: Chấp hành nghiêm nguyên tắc tập trung dân chủ, đóng đảng phí đầy đủ và sinh hoạt đúng định kỳ.

II. HẠN CHẾ, KHUYẾT ĐIỂM VÀ NGUYÊN NHÂN:
...........................................................................................................

III. PHƯƠNG HƯỚNG VÀ BIỆN PHÁP KHẮC PHỤC HẠN CHẾ:
...........................................................................................................

                                           ĐẢNG VIÊN TỰ KIỂM ĐIỂM
                                           (Ký và ghi rõ họ tên)`
  },
  {
    id: 'party_thi_dua',
    group: 'party',
    title: 'Báo cáo thi đua khen thưởng',
    icon: '🏆',
    prompt: 'Viết báo cáo thi đua khen thưởng đề nghị công nhận danh hiệu đảng viên của Chi bộ.',
    docType: 'party',
    contentTemplate: `BÁO CÁO
Kết quả đánh giá, xếp loại và đề nghị khen thưởng đảng viên
năm {namNay}

Kính gửi: Đảng ủy {tenPhuong}.

Thực hiện Hướng dẫn đánh giá, xếp loại tổ chức đảng và đảng viên cuối năm, Chi bộ Tổ dân phố {tenTDP} báo cáo kết quả như sau:

I. KẾT QUẢ ĐÁNH GIÁ, XẾP LOẠI ĐẢNG VIÊN:
- Tổng số đảng viên chính thức: {dangVienChinhThuc} đồng chí.
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
Kính đề nghị Đảng ủy {tenPhuong} xem xét, phê duyệt kết quả đánh giá và công nhận các danh hiệu thi đua cho Chi bộ và đảng viên theo quy định.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_dang_phi',
    group: 'party',
    title: 'Báo cáo thu nộp Đảng phí',
    icon: '💵',
    prompt: 'Viết báo cáo tình hình thu và trích nộp Đảng phí của Chi bộ tháng này.',
    docType: 'party',
    contentTemplate: `BÁO CÁO
Tình hình thu và trích nộp Đảng phí của Chi bộ tháng {thangNay}/{namNay}

Kính gửi: Đảng ủy {tenPhuong}.

Ban Chi ủy Chi bộ Tổ dân phố {tenTDP} báo cáo tình hình thu nộp Đảng phí như sau:

I. SỐ LIỆU TỔNG HỢP ĐẢNG VIÊN:
- Tổng số đảng viên: {tongDangVien} đồng chí.
- Số đảng viên thuộc diện đóng đảng phí: ..... đồng chí.
- Số đảng viên miễn đóng đảng phí (miễn sinh hoạt do già yếu): ..... đồng chí.

II. KẾT QUẢ THU NỘP ĐẢNG PHÍ:
- Tổng số tiền thu đảng phí: ..... đồng.
- Tỷ lệ trích nộp về Đảng ủy cấp trên (.....%): ..... đồng.
- Tỷ lệ giữ lại chi hoạt động Chi bộ (.....%): ..... đồng.

III. ĐÁNH GIÁ CHUNG:
100% đảng viên trong Chi bộ nghiêm túc đóng đảng phí hàng tháng đầy đủ theo quy định của Trung ương, không có tình trạng chậm trễ.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_phan_cong_dang_vien',
    group: 'party',
    title: 'Quyết định phân công đảng viên',
    icon: '🤝',
    prompt: 'Soạn quyết định phân công đảng viên chính thức chịu trách nhiệm giúp đỡ đảng viên dự bị.',
    docType: 'party',
    contentTemplate: `QUYẾT ĐỊNH
Phân công đảng viên chính thức theo dõi, giúp đỡ đảng viên dự bị

- Căn cứ Điều lệ Đảng Cộng sản Việt Nam;
- Căn cứ Nghị quyết họp Chi bộ ngày ..... tháng ..... năm {namNay} về công tác đảng viên;
- Xét năng lực và quá trình công tác của đảng viên.

CHI ỦY CHI BỘ TỔ DÂN PHỐ {tenTDP.toUpperCase()} QUYẾT ĐỊNH:

Điều 1. Phân công đồng chí ..... (Đảng viên chính thức) chịu trách nhiệm theo dõi, giúp đỡ đồng chí ..... (Đảng viên dự bị) trong quá trình phấn đấu, rèn luyện.

Điều 2. Đồng chí đảng viên chính thức được phân công có trách nhiệm đôn đốc, hướng dẫn đồng chí dự bị hoàn thành tốt các nhiệm vụ được giao, giữ vững tư tưởng chính trị và lối sống gương mẫu.

Điều 3. Quyết định này có hiệu lực kể từ ngày ký. Chi ủy và các đồng chí có tên chịu trách nhiệm thi hành quyết định này.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'party_bao_cao_sinh_hoat_thang',
    group: 'party',
    title: 'BC sinh hoạt Chi bộ',
    icon: '📝',
    prompt: 'Soạn báo cáo kết quả thực hiện nhiệm vụ Chi bộ tháng này và triển khai công tác tháng tiếp theo.',
    docType: 'party',
    contentTemplate: `BÁO CÁO
Kết quả thực hiện nhiệm vụ tháng {thangNay} năm {namNay} và triển khai chương trình công tác tháng {thangToi} năm {namToi}

Kính thưa các đồng chí đảng viên trong Chi bộ!

Thực hiện chương trình công tác năm {namNay} của Chi bộ và sự chỉ đạo của Đảng ủy phường {tenPhuong.replace('Phường ', '')}, Chi bộ Tổ dân phố {tenTDP} tổ chức sinh hoạt thường kỳ nhằm đánh giá kết quả thực hiện nhiệm vụ tháng {thangNay} năm {namNay}, đồng thời triển khai phương hướng, nhiệm vụ công tác tháng {thangToi} năm {namToi} như sau:

I. ĐÁNH GIÁ KẾT QUẢ THỰC HIỆN NHIỆM VỤ THÁNG {thangNay} NĂM {namNay}

1. Công tác chính trị, tư tưởng
Chi bộ đã tổ chức tuyên truyền, quán triệt kịp thời các chủ trương của Đảng, chính sách, pháp luật của Nhà nước; các văn bản chỉ đạo của Trung ương, Tỉnh ủy, Thành ủy, Đảng ủy phường đến toàn thể cán bộ, đảng viên.
Đảng viên giữ vững lập trường tư tưởng, chấp hành nghiêm Điều lệ Đảng, Quy định về những điều đảng viên không được làm; tích cực học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh; nêu cao tinh thần trách nhiệm, gương mẫu trong thực hiện nhiệm vụ và vận động Nhân dân.

2. Kết quả thực hiện nhiệm vụ chính trị
- Phối hợp với Ban Công tác Mặt trận và các đoàn thể tuyên truyền Nhân dân thực hiện tốt các chủ trương, chính sách của Đảng và pháp luật của Nhà nước.
- Tiếp tục thực hiện tốt công tác quản lý dân cư, cập nhật biến động dân số, bảo đảm dữ liệu quản lý chính xác, kịp thời cho {tongHoDan} hộ gia đình và {tongNhanKhau} nhân khẩu.
- Phối hợp giữ vững an ninh chính trị, trật tự an toàn xã hội trên địa bàn; tăng cường tuyên truyền phòng, chống tội phạm, phòng cháy chữa cháy và phòng chống tai nạn thương tích.
- Duy trì công tác vệ sinh môi trường, xây dựng tuyến đường xanh - sạch - đẹp; vận động Nhân dân thực hiện nếp sống văn minh đô thị.
- Thực hiện tốt công tác tuyên truyền, vận động Nhân dân tham gia các phong trào thi đua yêu nước, xây dựng khu dân cư đoàn kết, văn minh.

3. Công tác xây dựng Đảng
Chi bộ duy trì nền nếp sinh hoạt định kỳ theo quy định; thực hiện nguyên tắc tập trung dân chủ, tự phê bình và phê bình.
Tổng số đảng viên hiện có của Chi bộ là {tongDangVien} đồng chí (Trong đó chính thức: {dangVienChinhThuc} đồng chí, dự bị: {dangVienDuBi} đồng chí). Đảng viên chấp hành nghiêm sự phân công của Chi bộ, thực hiện tốt nhiệm vụ được giao; giữ mối liên hệ chặt chẽ với Nhân dân nơi cư trú.

4. Công tác kiểm tra, giám sát
Chi bộ thường xuyên kiểm tra việc thực hiện nghị quyết, chương trình công tác và nhiệm vụ của từng đảng viên. Qua kiểm tra, các đảng viên đều chấp hành tốt quy định của Đảng, không có trường hợp vi phạm kỷ luật.

5. Đánh giá chung
* Ưu điểm:
- Chi bộ đoàn kết, thống nhất, phát huy tốt vai trò lãnh đạo.
- Đảng viên có tinh thần trách nhiệm, gương mẫu trong thực hiện nhiệm vụ.
- Tình hình an ninh chính trị, trật tự an toàn xã hội ổn định; Nhân dân đồng thuận với các chủ trương của địa phương.
* Hạn chế: Công tác tuyên truyền ở một số nội dung chưa thật sự sâu rộng. Một số nhiệm vụ cần tăng cường sự phối hợp giữa các tổ chức đoàn thể và đảng viên phụ trách địa bàn.

II. PHƯƠNG HƯỚNG, NHIỆM VỤ THÁNG {thangToi} NĂM {namToi}

1. Tiếp tục quán triệt và tổ chức thực hiện nghiêm các nghị quyết, chỉ thị của Đảng; các văn bản chỉ đạo của cấp trên.
2. Tăng cường công tác giáo dục chính trị tư tưởng; phát huy vai trò nêu gương của cán bộ, đảng viên; thực hiện tốt việc học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh.
3. Tiếp tục phối hợp với Ban Công tác Mặt trận và các đoàn thể tuyên truyền, vận động Nhân dân chấp hành tốt các quy định của pháp luật; xây dựng đời sống văn hóa, khu dân cư đoàn kết, văn minh.
4. Thực hiện tốt công tác quản lý dân cư; thường xuyên cập nhật biến động nhân khẩu; khai thác hiệu quả phần mềm quản lý dân cư phục vụ công tác quản lý tại địa phương.
5. Tăng cường công tác bảo đảm an ninh trật tự, phòng chống tội phạm, phòng cháy chữa cháy, an toàn giao thông; chủ động nắm chắc tình hình địa bàn.
6. Tiếp tục thực hiện tốt công tác vệ sinh môi trường; vận động Nhân dân giữ gìn cảnh quan đô thị, không lấn chiếm lòng đường, vỉa hè.
7. Chuẩn bị tốt các nội dung phục vụ hội nghị Nhân dân, các cuộc họp của tổ dân phố và các nhiệm vụ do Đảng ủy, UBND phường giao.
8. Tiếp tục làm tốt công tác tạo nguồn phát triển đảng viên; quan tâm bồi dưỡng quần chúng ưu tú.

III. TỔ CHỨC THỰC HIỆN
Chi bộ phân công từng đồng chí Chi ủy viên và đảng viên phụ trách từng lĩnh vực, từng tổ liên gia; thường xuyên kiểm tra, đôn đốc việc thực hiện các nhiệm vụ được giao.
Đề nghị toàn thể đảng viên phát huy tinh thần đoàn kết, trách nhiệm, gương mẫu đi đầu trong mọi phong trào, góp phần xây dựng Chi bộ trong sạch, vững mạnh; xây dựng Tổ dân phố {tenTDP} ngày càng văn minh, phát triển.

Nơi nhận:
- Đảng ủy phường {tenPhuong.replace('Phường ', '')};
- Các đồng chí đảng viên Chi bộ;
- Lưu Chi bộ.

                                           T/M CHI BỘ
                                           BÍ THƯ


                                           {partySecretaryName}`
  },
  {
    id: 'front_bao_cao_dai_doan_ket',
    group: 'front',
    title: 'Báo cáo Đại đoàn kết',
    icon: '🤝',
    prompt: 'Soạn báo cáo kết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc của Ban công tác Mặt trận.',
    docType: 'front',
    contentTemplate: `BÁO CÁO
Kết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm {namNay}

Kính gửi: Ủy ban Mặt trận Tổ quốc Việt Nam {tenPhuong}.

Thực hiện hướng dẫn của cấp trên, Ban công tác Mặt trận Tổ dân phố {tenTDP} báo cáo kết quả tổ chức Ngày hội Đại đoàn kết toàn dân tộc như sau:

1. Công tác tổ chức Ngày hội:
- Thời gian tổ chức: 8 giờ 00 ngày 18 tháng 11 năm {namNay}.
- Địa điểm tổ chức: Nhà văn hóa Tổ dân phố {tenTDP}.
- Thành phần tham gia: Đại diện lãnh đạo phường, Ban công tác Mặt trận, tổ trưởng dân phố và đại diện của {tongHoDan} hộ gia đình tham gia đông đủ.

2. Kết quả nội dung Ngày hội:
- Phần Lễ: Ôn lại lịch sử vẻ quang Ngày truyền thống MTTQ Việt Nam. Đánh giá kết quả Cuộc vận động "Toàn dân đoàn kết xây dựng nông thôn mới, đô thị văn minh".
- Biểu dương, khen thưởng các gia đình văn hóa tiêu biểu xuất sắc trong năm qua.
- Phần Hội: Tổ chức giao lưu văn nghệ quần chúng ấm cúng, vui tươi, thắt chặt tinh thần đoàn kết lối xóm.

3. Đánh giá chung:
Ngày hội đã tạo không khí phấn khởi, đoàn kết, nâng cao vai trò của Mặt trận trong việc khơi dậy sức mạnh của toàn dân tại Tổ dân phố {tenTDP}.

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_bao_cao_quy',
    group: 'front',
    title: 'Báo cáo quỹ Mặt trận',
    icon: '💵',
    prompt: 'Viết báo cáo tổng kết vận động ủng hộ Quỹ Vì người nghèo của Ban công tác Mặt trận.',
    docType: 'front',
    contentTemplate: `BÁO CÁO
Kết quả vận động ủng hộ Quỹ an sinh xã hội năm {namNay}

Kính gửi: Ban Thường trực Ủy ban MTTQ Việt Nam {tenPhuong}.

Ban công tác Mặt trận Tổ dân phố {tenTDP} xin báo cáo kết quả cuộc vận động đóng góp xây dựng quỹ xã hội như sau:

1. Công tác tuyên truyền, vận động:
- Ban công tác Mặt trận đã phối hợp cùng các tổ chức thành viên đến từng ngõ xóm, hộ gia đình để phổ biến ý nghĩa nhân văn của cuộc vận động đóng góp xây dựng Quỹ Vì người nghèo.

2. Kết quả thu nộp:
- Tổng số hộ dân tham gia đóng góp ủng hộ: {tongHoDan} hộ gia đình.
- Số tiền vận động thu nộp thực tế: {tongThuTaiChinh} (Đã nộp toàn bộ về tài khoản quỹ an sinh xã hội cấp trên quản lý).
- Ghi nhận một số cá nhân, gia đình tiêu biểu xuất sắc đi đầu trong đợt vận động ủng hộ.

3. Kế hoạch phân bổ:
Dành một phần kinh phí hỗ trợ các hộ gia đình có hoàn cảnh đặc biệt khó khăn, hộ cận nghèo trên địa bàn Tổ dân phố nhân dịp Lễ, Tết sắp tới.

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_thong_bao_dai_doan_ket',
    group: 'front',
    title: 'Thông báo Ngày hội ĐĐK',
    icon: '📢',
    prompt: 'Soạn thông báo ngày hội Đại đoàn kết 18/11 của Ban công tác Mặt trận.',
    docType: 'front',
    contentTemplate: `THÔNG BÁO
V/v Tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm {namNay}

Kính gửi: Toàn thể nhân dân, hộ gia đình và đại diện các tổ chức đoàn thể tại {tdpDisplay}.

Thực hiện kế hoạch của Ủy ban Mặt trận Tổ quốc Việt Nam {tenPhuong} về việc tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm {namNay}, nhân kỷ niệm Ngày Truyền thống MTTQ Việt Nam (18/11).

Ban công tác Mặt trận {tdpDisplay} trân trọng kính mời:

1. THÀNH PHẦN THAM DỰ:
- Toàn thể nhân dân, đại diện các hộ gia đình trong Tổ dân phố.
- Đại diện lãnh đạo UBND phường, Mặt trận phường và các đoàn thể.

2. THỜI GIAN VÀ ĐỊA ĐIỂM:
- Thời gian: 8 giờ 00 ngày 18 tháng 11 năm {namNay}.
- Địa điểm: Nhà văn hóa Tổ dân phố {tenTDP}.

3. NỘI DUNG CHƯƠNG TRÌNH:
- Khai mạc, ôn lại lịch sử truyền thống MTTQ Việt Nam.
- Biểu dương các hộ gia đình văn hóa, cá nhân tiêu biểu xuất sắc.
- Trao quà thăm hỏi các gia đình chính sách, hộ có hoàn cảnh khó khăn.
- Giao lưu văn nghệ quần chúng.

Kính mong toàn thể nhân dân sắp xếp thời gian, tham gia đầy đủ và đúng giờ!

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_bien_ban_hop',
    group: 'front',
    title: 'Biên bản họp Mặt trận',
    icon: '📋',
    prompt: 'Soạn biên bản họp Ban công tác Mặt trận Tổ dân phố tháng này.',
    docType: 'front',
    contentTemplate: `BIÊN BẢN HỌP BAN CÔNG TÁC MẶT TRẬN
Tổ dân phố {tenTDP} — Tháng {thangNay}/{namNay}

Hôm nay, vào lúc ..... giờ, ngày ..... tháng ..... năm {namNay}, tại Nhà văn hóa {tdpDisplay}.

I. THÀNH PHẦN THAM DỰ:
- Chủ trì: {leaderDisplay} — Trưởng Ban công tác Mặt trận.
- Thư ký: .....
- Thành viên Ban công tác Mặt trận có mặt: ..... / ..... thành viên.

II. NỘI DUNG CUỘC HỌP:
1. Đánh giá kết quả công tác Mặt trận tháng qua:
- Công tác tuyên truyền chính sách pháp luật đến {tongHoDan} hộ gia đình đã hoàn thành.
- Tình hình đoàn kết khu dân cư ổn định, không có mâu thuẫn phát sinh.
- Kết quả vận động các quỹ xã hội: Đạt .....% kế hoạch đề ra.

2. Bàn công tác Mặt trận tháng tới:
- Chuẩn bị tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm {namNay}.
- Tiếp tục vận động ủng hộ Quỹ Vì người nghèo và Quỹ An sinh xã hội.
- Phối hợp với Chi bộ và Ban điều hành TDP tổ chức tốt các hoạt động cộng đồng.

III. KẾT LUẬN:
Cuộc họp kết thúc vào lúc ..... giờ cùng ngày. Biên bản được thống nhất thông qua.

     THƯ KÝ GHI BIÊN BẢN               TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
   (Ký và ghi rõ họ tên)                  (Ký và ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_tham_hoi_ngheo',
    group: 'front',
    title: 'Báo cáo thăm hỏi hộ nghèo',
    icon: '🎁',
    prompt: 'Soạn báo cáo kết quả thăm hỏi trao quà hộ nghèo và hộ chính sách của Tổ dân phố.',
    docType: 'front',
    contentTemplate: `BÁO CÁO
Kết quả thăm hỏi, tặng quà các gia đình chính sách,
hộ nghèo và hộ khó khăn nhân dịp Lễ, Tết năm {namNay}

Kính gửi: Ban Thường trực UBMTTQ Việt Nam {tenPhuong}.

Thực hiện kế hoạch và hướng dẫn của cấp trên, Ban công tác Mặt trận Tổ dân phố {tenTDP} báo cáo kết quả thăm hỏi và tặng quà như sau:

I. ĐỐI TƯỢNG ĐƯỢC THĂM HỎI:
- Số hộ nghèo được thăm hỏi, tặng quà: {hoNgheo} hộ.
- Số hộ gia đình chính sách được thăm hỏi: {hoChinhSach} hộ.
- Số hộ khó khăn đột xuất được hỗ trợ: ..... hộ.
- Tổng số suất quà đã trao: ..... suất.

II. GIÁ TRỊ QUÀ TẶNG:
- Nguồn từ Quỹ Vì người nghèo MTTQ phường: ..... suất × 200.000 đồng/suất.
- Nguồn từ Ban điều hành TDP vận động: ..... suất × 200.000 đồng/suất.
- Nguồn do cá nhân, doanh nghiệp hảo tâm ủng hộ trực tiếp: ..... suất.

III. KẾT QUẢ VÀ Ý NGHĨA:
Cuộc thăm hỏi đã tạo ra không khí ấm áp, thể hiện tinh thần "tương thân tương ái" của truyền thống dân tộc. Các gia đình được thăm hỏi đều bày tỏ sự xúc động và lòng biết ơn sâu sắc.

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_ke_hoa_dai_doan_ket',
    group: 'front',
    title: 'Kế hoạch Ngày hội ĐĐK',
    icon: '📋',
    prompt: 'Soạn kế hoạch chi tiết tổ chức Ngày hội Đại đoàn kết toàn dân tộc ngày 18/11 của Tổ dân phố.',
    docType: 'front',
    contentTemplate: `KẾ HOẠCH
Tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm {namNay}

Nhân kỷ niệm truyền thống Mặt trận Dân tộc Thống nhất Việt Nam (18/11), Ban công tác Mặt trận Tổ dân phố {tenTDP} xây dựng kế hoạch như sau:

I. MỤC ĐÍCH, YÊU CẦU:
1. Tuyên truyền giáo dục lòng yêu nước, truyền thống đoàn kết toàn dân tộc.
2. Đánh giá kết quả thực hiện cuộc vận động "Toàn dân đoàn kết xây dựng đời sống văn hóa ở khu dân cư".
3. Tạo không khí vui tươi, phấn khởi, thắt chặt tình nghĩa xóm giềng.

II. NỘI DUNG VÀ THỜI GIAN:
1. Phần Lễ (Báo cáo tổng kết cuộc vận động, biểu dương hộ gia đình tiêu biểu).
2. Phần Hội (Giao lưu văn nghệ, thể dục thể thao, bữa cơm đoàn kết).
3. Thời gian thực hiện: Ngày 18 tháng 11 năm {namNay}.
4. Địa điểm: Nhà văn hóa Tổ dân phố {tenTDP}.

III. PHÂN CÔNG THỰC HIỆN:
- Tổ trưởng TDP phối hợp chuẩn bị khánh tiết, loa đài và cơ sở vật chất.
- Chi hội phụ nữ phụ trách công tác chuẩn bị văn nghệ và hậu cần.
- Chi hội cựu chiến binh và Đoàn thanh niên phụ trách bảo đảm trật tự an ninh.

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  },
  {
    id: 'front_to_trinh_gia_dinh_vh',
    group: 'front',
    title: 'Tờ trình đề nghị Gia đình VH',
    icon: '📝',
    prompt: 'Soạn tờ trình đề nghị công nhận danh hiệu Gia đình văn hóa tiêu biểu gửi Ủy ban MTTQ phường.',
    docType: 'front',
    contentTemplate: `TỜ TRÌNH
Về việc đề nghị công nhận và khen thưởng danh hiệu "Gia đình văn hóa tiêu biểu"

Kính gửi: UBND phường và Thường trực Ủy ban MTTQ Việt Nam {tenPhuong}.

Căn cứ kết quả bình xét Gia đình văn hóa cuối năm của Tổ dân phố {tenTDP}, Ban công tác Mặt trận kính trình cấp trên xem xét, công nhận các danh hiệu khen thưởng như sau:

I. KẾT QUẢ BÌNH XÉT GIA ĐÌNH VĂN HÓA:
- Tổng số hộ gia đình tham gia bình xét: {tongHoDan} hộ.
- Số hộ đạt danh hiệu "Gia đình văn hóa": ..... hộ (đạt tỷ lệ .....%).
- Số hộ đạt danh hiệu "Gia đình văn hóa tiêu biểu xuất sắc": ..... hộ.

II. ĐỀ NGHỊ KHEN THƯỞNG:
Đề nghị UBND phường khen thưởng cho các hộ gia đình tiêu biểu sau:
1. Hộ gia đình ông/bà: ..... (Địa chỉ: .....)
2. Hộ gia đình ông/bà: ..... (Địa chỉ: .....)
3. Hộ gia đình ông/bà: ..... (Địa chỉ: .....)

Kính trình UBND và UBMTTQ phường xem xét phê duyệt.

                                           TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                                           (Ký, ghi rõ họ tên)


                                           {matTranName}`
  }
];

const AIAssistant = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Phân quyền vai trò
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  // State quản lý templates
  const [templates, setTemplates] = useState<AITemplate[]>(() => {
    const saved = localStorage.getItem('ai_assistant_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_AI_TEMPLATES;
  });

  // State Modal quản lý templates
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AITemplate | null>(null);

  // Form states cho thêm/sửa template
  const [formTitle, setFormTitle] = useState('');
  const [formIcon, setFormIcon] = useState('📝');
  const [formGroup, setFormGroup] = useState<'to_truong' | 'party' | 'front'>('to_truong');
  const [formPrompt, setFormPrompt] = useState('');
  const [formContentTemplate, setFormContentTemplate] = useState('');
  const [formDocType, setFormDocType] = useState<'party' | 'front' | 'admin'>('admin');

  // Đồng bộ templates vào localStorage mỗi khi thay đổi
  useEffect(() => {
    localStorage.setItem('ai_assistant_templates', JSON.stringify(templates));
  }, [templates]);

  const generateDocument = async (userPrompt: string, templateId?: string) => {
    const query = userPrompt.toLowerCase();
    
    // Retrieve dynamic settings
    const tdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';
    const wardName = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
    const leaderName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';
    const partySecretaryName = localStorage.getItem('party_secretary_name') || '';

    // Đọc chữ ký cán bộ từ cài đặt hệ thống
    let officialSigs: { id: string; name: string }[] = [];
    try {
      const savedSigs = localStorage.getItem('official_signatures');
      if (savedSigs) officialSigs = JSON.parse(savedSigs);
    } catch { /* ignore */ }
    const getOfficialName = (id: string, fallback = '') => {
      const found = officialSigs.find(s => s.id === id);
      return found?.name?.trim() || fallback;
    };
    const toTruongName = getOfficialName('to_truong', leaderName);
    const biThuName = getOfficialName('bi_thu', partySecretaryName);
    const matTranName = getOfficialName('mat_tran', leaderName);
    const thuKyName = getOfficialName('thu_ky', '');

    // Fetch live stats
    const [households, residents, complaints, records, partyMembers] = await Promise.all([
      db.getHouseholds(),
      db.getResidents(),
      db.getComplaints(),
      db.getFinancialRecords(),
      partyDb.getPartyMembers()
    ]);

    const cMonth = new Date().getMonth() + 1;
    const nMonth = cMonth === 12 ? 1 : cMonth + 1;
    const cYear = new Date().getFullYear();
    const nYear = cMonth === 12 ? cYear + 1 : cYear;
    const dayStr = new Date().getDate().toString().padStart(2, '0');
    const monthStr = cMonth.toString().padStart(2, '0');
    const dateStr = `ngày ${dayStr} tháng ${monthStr} năm ${cYear}`;

    const tdpUpper = tdpName.toUpperCase();
    const tdpHeader = tdpUpper.startsWith('TỔ DÂN PHỐ') || tdpUpper.startsWith('TDP') ? tdpUpper : `TỔ DÂN PHỐ ${tdpUpper}`;
    const tdpDisplay = tdpName.toLowerCase().startsWith('tổ dân phố') || tdpName.toLowerCase().startsWith('tdp') ? tdpName : `Tổ dân phố ${tdpName}`;
    const wardDisplay = wardName.toLowerCase().startsWith('phường') || wardName.toLowerCase().startsWith('xã') || wardName.toLowerCase().startsWith('thị trấn') ? wardName : `Phường ${wardName}`;
    const leaderDisplay = leaderName.toLowerCase().startsWith('ông') || leaderName.toLowerCase().startsWith('bà') ? leaderName : `Ông ${matTranName}`;

    // Tìm template phù hợp
    let matchedTemplate: AITemplate | undefined;
    if (templateId) {
      matchedTemplate = templates.find(t => t.id === templateId);
    } else {
      // Tìm bằng từ khóa
      matchedTemplate = templates.find(t => {
        const titleMatch = query.includes(t.title.toLowerCase());
        const promptMatch = query.includes(t.prompt.toLowerCase());
        return titleMatch || promptMatch;
      });
    }

    let docText = '';
    let docType: 'party' | 'front' | 'admin' = 'admin';

    if (matchedTemplate) {
      docText = matchedTemplate.contentTemplate;
      docType = matchedTemplate.docType;
    } else {
      // Mẫu thông báo chung mặc định
      docText = `Kính gửi: Toàn thể nhân dân {tdpDisplay}.

Ban điều hành Tổ dân phố xin thông báo nội dung sau:

{noiDungTuDo}

Yêu cầu bà con nhân dân lưu ý và phối hợp thực hiện nghiêm túc nội dung trên.`;
      docType = query.includes('chi bộ') || query.includes('đảng') ? 'party' : (query.includes('mặt trận') || query.includes('đại đoàn kết') ? 'front' : 'admin');
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

    // Helper tạo danh sách động
    const getDanhSachNVQS = () => {
      const eligibleMen = residents.filter(r => {
        if (r.gender !== 'male' || !r.dob || r.status === 'deceased') return false;
        const birthYear = new Date(r.dob).getFullYear();
        const age = cYear - birthYear;
        return age >= 18 && age <= 27;
      });
      return eligibleMen.length > 0 ? eligibleMen.map((m, idx) => {
        const hh = households.find(h => h.id === m.household_id);
        const headRes = hh ? residents.find(r => r.household_id === hh.id && r.is_head) : null;
        return `  ${idx + 1}. Họ và tên: ${m.full_name} - Ngày sinh: ${fmtDate(m.dob)} - Chủ hộ: Hộ ông/bà ${headRes ? headRes.full_name : 'Không rõ'} - Địa chỉ: ${hh?.address || 'Tổ dân phố'}`;
      }).join('\n') : '  (Không ghi nhận nam thanh niên nào)';
    };

    const getDanhSachHoNgheo = () => {
      const poor = households.filter(h => h.policy_type === 'poor');
      return poor.length > 0 ? poor.map((h, i) => {
        const headRes = residents.find(r => r.household_id === h.id && r.is_head);
        return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
      }).join('\n') : '  * Không ghi nhận hộ nghèo nào.';
    };

    const getDanhSachHoCanNgheo = () => {
      const near = households.filter(h => h.policy_type === 'near_poor');
      return near.length > 0 ? near.map((h, i) => {
        const headRes = residents.find(r => r.household_id === h.id && r.is_head);
        return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
      }).join('\n') : '  * Không ghi nhận hộ cận nghèo nào.';
    };

    const getDanhSachHoChinhSach = () => {
      const policy = households.filter(h => h.policy_type === 'policy_family');
      return policy.length > 0 ? policy.map((h, i) => {
        const headRes = residents.find(r => r.household_id === h.id && r.is_head);
        return `  ${i + 1}. Chủ hộ: ${headRes ? headRes.full_name : 'Không rõ'} - Sổ hộ khẩu: ${h.household_number} - Địa chỉ: ${h.address}`;
      }).join('\n') : '  * Không ghi nhận hộ chính sách nào.';
    };

    // Tiến hành thay thế các placeholder
    docText = docText
      .replace(/{tenTDP}/g, tdpName)
      .replace(/{tenPhuong}/g, wardDisplay)
      .replace(/{tenToTruong}/g, toTruongName)
      .replace(/{tenBiThu}/g, biThuName || '(Ký, ghi rõ họ tên)')
      .replace(/{thangNay}/g, String(cMonth))
      .replace(/{thangToi}/g, String(nMonth))
      .replace(/{namNay}/g, String(cYear))
      .replace(/{namToi}/g, String(nYear))
      .replace(/{ngayThangNam}/g, dateStr)
      .replace(/{tongHoDan}/g, String(households.length))
      .replace(/{tongNhanKhau}/g, String(residents.length))
      .replace(/{tongDangVien}/g, String(partyMembers.length))
      .replace(/{dangVienChinhThuc}/g, String(partyMembers.filter(m => m.status === 'official').length))
      .replace(/{dangVienDuBi}/g, String(partyMembers.filter(m => m.status === 'probation').length))
      .replace(/{hoNgheo}/g, String(households.filter(h => h.policy_type === 'poor').length))
      .replace(/{hoCanNgheo}/g, String(households.filter(h => h.policy_type === 'near_poor').length))
      .replace(/{hoChinhSach}/g, String(households.filter(h => h.policy_type === 'policy_family').length))
      .replace(/{tongThuTaiChinh}/g, formatCurrency(totalIncome))
      .replace(/{tongChiTaiChinh}/g, formatCurrency(totalExpense))
      .replace(/{soDuTaiChinh}/g, formatCurrency(balance))
      .replace(/{danhSachNVQS}/g, getDanhSachNVQS())
      .replace(/{danhSachHoNgheo}/g, getDanhSachHoNgheo())
      .replace(/{danhSachHoCanNgheo}/g, getDanhSachHoCanNgheo())
      .replace(/{danhSachHoChinhSach}/g, getDanhSachHoChinhSach())
      .replace(/{tdpDisplay}/g, tdpDisplay)
      .replace(/{wardDisplay}/g, wardDisplay)
      .replace(/{tdpHeader}/g, tdpHeader)
      .replace(/{leaderDisplay}/g, leaderDisplay)
      .replace(/{leaderName}/g, toTruongName)
      .replace(/{partySecretaryName}/g, biThuName || '(Ký, ghi rõ họ tên)')
      .replace(/{matTranName}/g, matTranName || '(Ký, ghi rõ họ tên)')
      .replace(/{thuKyName}/g, thuKyName || '(Ký, ghi rõ họ tên)')
      .replace(/{noiDungTuDo}/g, userPrompt);

    // Trích xuất tiêu đề từ văn bản
    let title = 'THÔNG BÁO CHUNG';
    let content = docText;
    
    const docLines = docText.split('\n');
    const firstFewLines = docLines.slice(0, 10).map(l => l.trim().toUpperCase());
    const titleIdx = firstFewLines.findIndex(l => l.startsWith('BÁO CÁO') || l.startsWith('THÔNG BÁO') || l.startsWith('BIÊN BẢN') || l.startsWith('NGHỊ QUYẾT') || l.startsWith('TỜ TRÌNH') || l.startsWith('GIẤY MỜI') || l.startsWith('KẾ HOẠCH'));
    
    if (titleIdx !== -1) {
      title = docLines[titleIdx];
      if (docLines[titleIdx + 1] && docLines[titleIdx + 1].trim() && !docLines[titleIdx + 1].includes(':') && !docLines[titleIdx + 1].includes('Kính gửi')) {
        title += '\n' + docLines[titleIdx + 1];
        content = docLines.slice(titleIdx + 2).join('\n');
      } else {
        content = docLines.slice(titleIdx + 1).join('\n');
      }
    }

    const partySecretaryDisplay = biThuName.trim() || '(Ký, ghi rõ họ tên)';

    // Xoá chữ ký đã có sẵn trong content từ template (tránh trùng lặp)
    const stripContentSignature = (text: string): string => {
      const lines = text.split('\n');
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 25); i--) {
        const t = lines[i].trim().toUpperCase();
        if (
          t.includes('TỔ TRƯỞNG DÂN PHỐ') ||
          t.includes('T/M CHI BỘ') ||
          t.includes('BÍ THƯ CHI BỘ') ||
          t.includes('TRƯỞNG BAN CÔNG TÁC MẶT TRẬN') ||
          (t.includes('THƯ') && t.includes('KÝ') && (t.includes('TỔ TRƯỞNG') || t.includes('BÍ THƯ') || t.includes('TRƯỞNG BAN')))
        ) {
          return lines.slice(0, i).join('\n').trimEnd();
        }
      }
      return text.trimEnd();
    };
    const strippedContent = stripContentSignature(content);

    // Bọc trong khung in chuẩn
    let finalDocument = '';
    if (docType === 'party') {
      finalDocument = `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ ${wardDisplay.toUpperCase()}
CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}
*

${title}

${strippedContent}

                              ${tdpName}, ${dateStr}
                              T/M CHI BỘ
                              BÍ THƯ


                              ${partySecretaryDisplay}`;
    } else if (docType === 'front') {
      finalDocument = `ỦY BAN MTTQ VN ${wardDisplay.toUpperCase()}
BAN CÔNG TÁC MẶT TRẬN TDP ${tdpName.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

${title}

${strippedContent}

                              ${tdpName}, ${dateStr}
                              TRƯỞNG BAN CÔNG TÁC MẶT TRẬN
                              (Ký, ghi rõ họ tên)


                              ${matTranName || '(Ký, ghi rõ họ tên)'}`;
    } else {
      finalDocument = `${tdpHeader} - ${wardDisplay.toUpperCase()}

                              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                              Độc lập - Tự do - Hạnh phúc
                              ───────────────────────────

${title}

${strippedContent}

                              ${tdpName}, ${dateStr}
                              TỔ TRƯỞNG DÂN PHỐ
                              (Ký, ghi rõ họ tên)


                              ${toTruongName || '(Ký, ghi rõ họ tên)'}`;
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

  const handleGenerate = (customPrompt?: string, templateId?: string) => {
    const pText = typeof customPrompt === 'string' ? customPrompt : prompt;
    if (!pText) return;
    setIsGenerating(true);
    setIsCopied(false);
    setResult(null);
    setTimeout(async () => {
      const doc = await generateDocument(pText, templateId);
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

  const handleDownload = async () => {
    if (!result) return;

    showToast('Đang tạo file Word, vui lòng đợi...', 'success');

    const isPartyDoc = result.includes('ĐẢNG CỘNG SẢN VIỆT NAM') || result.startsWith('ĐẢNG');
    const isFrontDoc = result.includes('MTTQ') || result.includes('MẶT TRẬN');

    // ─── Cấu hình font và kích thước ───
    const FONT = 'Times New Roman';
    const SIZE_TITLE   = 28; // 14pt
    const SIZE_BODY    = 26; // 13pt
    const SIZE_HEADER  = 24; // 12pt
    const SIZE_SMALL   = 22; // 11pt

    const noBorder = {
      top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };

    // ─── Helper tạo đoạn văn thông thường ───
    const makeParagraph = (text: string, options: {
      bold?: boolean;
      center?: boolean;
      right?: boolean;
      size?: number;
      underline?: boolean;
      italic?: boolean;
      spaceAfter?: number;
      spaceBefore?: number;
    } = {}) => {
      return new Paragraph({
        alignment: options.center ? AlignmentType.CENTER
                 : options.right  ? AlignmentType.RIGHT
                 : AlignmentType.JUSTIFIED,
        spacing: {
          after: options.spaceAfter ?? 60,
          before: options.spaceBefore ?? 0,
          line: 360,
        },
        children: [new TextRun({
          text,
          font: FONT,
          size: options.size ?? SIZE_BODY,
          bold: options.bold ?? false,
          italics: options.italic ?? false,
          underline: options.underline ? {} : undefined,
        })],
      });
    };

    // ─── Helper tạo dòng trống ───
    const emptyLine = (size = SIZE_BODY) => new Paragraph({
      spacing: { after: 60, line: 360 },
      children: [new TextRun({ text: '', font: FONT, size })],
    });

    const children: (Paragraph | Table)[] = [];

    // ─── Phân tích nội dung văn bản ───
    const lines = result.split('\n');

    if (isPartyDoc) {
      // === Văn bản Đảng: tiêu đề bên trái đơn ===
      const starIdx = lines.findIndex(l => l.trim() === '*');
      const headerLines = starIdx > 0 ? lines.slice(0, starIdx) : lines.slice(0, 3);
      const bodyLines = starIdx > 0 ? lines.slice(starIdx + 1) : lines.slice(3);

      // Header Đảng
      headerLines.forEach((line, i) => {
        if (!line.trim()) return;
        children.push(makeParagraph(line.trim(), {
          bold: true,
          center: true,
          size: i === 0 ? SIZE_HEADER : SIZE_SMALL,
          underline: i === headerLines.length - 1,
          spaceAfter: 40,
        }));
      });
      children.push(makeParagraph('*', { center: true, bold: true, size: SIZE_TITLE, spaceAfter: 80 }));

      // Body
      buildBodyParagraphs(bodyLines, children, makeParagraph, emptyLine, FONT, SIZE_BODY, SIZE_TITLE, noBorder, 'party');

    } else {
      // === Văn bản Nhà nước / Mặt trận: 2 cột tiêu đề ===
      const sepIdx = lines.findIndex(l => l.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA'));
      const leftLines = sepIdx > 0 ? lines.slice(0, sepIdx).filter(l => l.trim()) : [];
      const rightLines = sepIdx >= 0 ? lines.slice(sepIdx, sepIdx + 3) : [];
      const bodyLines = lines.slice(Math.max(sepIdx + 3, 0));

      // Tạo bảng 2 cột tiêu đề
      const makeHeaderCell = (paragraphs: Paragraph[], widthPct: number) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          borders: noBorder,
          children: paragraphs,
        });

      const leftCellParas: Paragraph[] = leftLines.map((line, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, line: 360 },
          children: [new TextRun({
            text: line.trim(),
            font: FONT,
            size: i === 0 ? SIZE_HEADER : SIZE_SMALL,
            bold: true,
            underline: i === leftLines.length - 1 ? {} : undefined,
          })],
        })
      );

      const rightCellParas: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, line: 360 },
          children: [new TextRun({ text: (rightLines[0] || '').trim(), font: FONT, size: SIZE_HEADER, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, line: 360 },
          children: [new TextRun({ text: (rightLines[1] || '').trim(), font: FONT, size: SIZE_HEADER, italics: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80, line: 360 },
          children: [new TextRun({ text: '──────────────────────', font: FONT, size: SIZE_HEADER, bold: true })],
        }),
      ];

      children.push(
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder,
          rows: [new TableRow({
            children: [
              makeHeaderCell(leftCellParas, isFrontDoc ? 45 : 40),
              makeHeaderCell(rightCellParas, isFrontDoc ? 55 : 60),
            ],
          })],
        })
      );

      // Body
      buildBodyParagraphs(bodyLines, children, makeParagraph, emptyLine, FONT, SIZE_BODY, SIZE_TITLE, noBorder, isFrontDoc ? 'front' : 'admin');
    }

    // ─── Tạo Document Word ───
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: SIZE_BODY },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
            margin: {
              top:    convertInchesToTwip(0.98),  // 2.5cm
              bottom: convertInchesToTwip(0.79),  // 2cm
              left:   convertInchesToTwip(1.18),  // 3cm lề trái hành chính
              right:  convertInchesToTwip(0.79),  // 2cm
            },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBlob(doc);
    const url = URL.createObjectURL(buffer);
    const link = document.createElement('a');
    link.href = url;
    link.download = `van_ban_${Date.now()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast('Tải xuống file Word (.docx) thành công!', 'success');
  };

  // ─── Hàm phụ trợ xây dựng body văn bản thành các Paragraph Word ───
  function buildBodyParagraphs(
    bodyLines: string[],
    children: (Paragraph | Table)[],
    makeParagraph: (text: string, opts?: any) => Paragraph,
    emptyLine: (size?: number) => Paragraph,
    FONT: string,
    SIZE_BODY: number,
    SIZE_TITLE: number,
    noBorder: any,
    docType: 'party' | 'front' | 'admin'
  ) {
    // Phát hiện phần chữ ký (tìm ngược từ cuối)
    let sigStartIdx = -1;
    let isDoubleSignature = false;
    for (let i = bodyLines.length - 1; i >= Math.max(0, bodyLines.length - 18); i--) {
      const line = bodyLines[i].trim();
      if (!line) continue;
      if (line.includes('THƯ KÝ') && (line.includes('TỔ TRƯỞNG') || line.includes('BÍ THƯ') || line.includes('TRƯỞNG BAN'))) {
        sigStartIdx = i; isDoubleSignature = true; break;
      }
      if ((line.includes('ngày') && line.includes('tháng') && line.includes('năm') && line.includes(','))) {
        let hasTitle = false;
        for (let j = i + 1; j < bodyLines.length; j++) {
          const lb = bodyLines[j].toUpperCase();
          if (lb.includes('TỔ TRƯỞNG') || lb.includes('BÍ THƯ') || lb.includes('TRƯỞNG BAN') || lb.includes('T/M')) {
            hasTitle = true; break;
          }
        }
        if (hasTitle) { sigStartIdx = i; break; }
      }
    }

    const contentLines = sigStartIdx !== -1 ? bodyLines.slice(0, sigStartIdx) : bodyLines;
    const sigLines = sigStartIdx !== -1 ? bodyLines.slice(sigStartIdx) : [];

    // Xây dựng phần nội dung
    contentLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { children.push(emptyLine()); return; }

      // Tiêu đề văn bản (BÁO CÁO, THÔNG BÁO, BIÊN BẢN, v.v.)
      if (/^(BÁO CÁO|THÔNG BÁO|BIÊN BẢN|NGHỊ QUYẾT|TỜ TRÌNH|GIẤY MỜI|KẾ HOẠCH|MẪU|NỘI DUNG|QUYẾT ĐỊNH)/.test(trimmed.toUpperCase())) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80, before: 80, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_TITLE, bold: true })],
        }));
        return;
      }

      // Dòng mục lớn (I., II., III. ...)
      if (/^[IVX]+\./.test(trimmed)) {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60, before: 60, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_BODY, bold: true })],
        }));
        return;
      }

      // Dòng thứ tự 1. 2. 3.
      if (/^\d+\.\s/.test(trimmed)) {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 360 },
          spacing: { after: 60, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_BODY })],
        }));
        return;
      }

      // Dòng gạch đầu dòng -
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360 },
          spacing: { after: 60, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_BODY })],
        }));
        return;
      }

      // Dòng Kính gửi
      if (trimmed.startsWith('Kính gửi') || trimmed.startsWith('Kính thưa')) {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 80, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_BODY, italics: true })],
        }));
        return;
      }

      // Nơi nhận
      if (trimmed.startsWith('Nơi nhận:')) {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 60, before: 80, line: 360 },
          children: [new TextRun({ text: trimmed, font: FONT, size: 22, bold: true, italics: true })],
        }));
        return;
      }

      // Mặc định: đoạn văn thường
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: trimmed.startsWith('  ') || line.startsWith('  ') ? 0 : 360 },
        spacing: { after: 60, line: 360 },
        children: [new TextRun({ text: trimmed, font: FONT, size: SIZE_BODY })],
      }));
    });

    if (sigLines.length === 0) return;

    // Phần chữ ký
    children.push(emptyLine());
    children.push(emptyLine());

    if (isDoubleSignature) {
      // Biên bản: 2 cột chữ ký
      const sigClean = sigLines.filter(l => l.trim());
      const half = Math.ceil(sigClean.length / 2);
      const leftSigs = sigClean.slice(0, half);
      const rightSigs = sigClean.slice(half);

      const noBorderCell = (paras: Paragraph[]) => new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: noBorder,
        children: paras,
      });

      const makeSignaturePara = (text: string, isName = false) => new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: isName ? 60 : 40, before: isName ? 500 : 0, line: 360 },
        children: [new TextRun({
          text: text.trim(),
          font: FONT,
          size: isName ? SIZE_BODY : 22,
          bold: isName || /^[A-ZĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]+$/.test(text.trim()),
          italics: text.trim().startsWith('(') && text.trim().endsWith(')'),
        })],
      });

      const leftName = leftSigs.length > 0 ? leftSigs[leftSigs.length - 1].trim() : '';
      const rightName = rightSigs.length > 0 ? rightSigs[rightSigs.length - 1].trim() : '';

      const leftParas = leftSigs.map((l, i) => makeSignaturePara(l, i === leftSigs.length - 1 && leftName !== '' && !leftName.startsWith('(') && !leftName.toUpperCase().includes('TRƯ')));
      const rightParas = rightSigs.map((l, i) => makeSignaturePara(l, i === rightSigs.length - 1 && rightName !== '' && !rightName.startsWith('(')));

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [new TableRow({ children: [noBorderCell(leftParas), noBorderCell(rightParas)] })],
      }));
    } else {
      // 1 chữ ký bên phải
      const sigClean = sigLines.filter(l => l.trim());
      const rightSigParas = sigClean.map((l, i) => {
        const txt = l.trim();
        const isDate = txt.includes('ngày') && txt.includes('tháng');
        const isTitle = txt.toUpperCase().includes('TỔ TRƯỞNG') || txt.toUpperCase().includes('BÍ THƯ') || txt.toUpperCase().includes('TRƯỞNG BAN') || txt.includes('T/M');
        const isNote = txt.startsWith('(') && txt.endsWith(')');
        const isName = !isDate && !isTitle && !isNote && i === sigClean.length - 1;
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, before: isName ? 500 : 0, line: 360 },
          children: [new TextRun({
            text: txt,
            font: FONT,
            size: isName ? SIZE_BODY : 22,
            bold: isTitle || isName,
            italics: isDate || isNote,
          })],
        });
      });

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [new TableRow({
          children: [
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorder, children: [emptyLine()] }),
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorder, children: rightSigParas }),
          ],
        })],
      }));
    }
  }

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
        return `<div class="doc-body" style="white-space: pre-wrap; word-wrap: break-word; font-size: 13pt; line-height: 1.45; margin-top: 16px;">${bodyLines.join('\n')}</div>`;
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
        <div class="doc-body" style="white-space: pre-wrap; word-wrap: break-word; font-size: 13pt; line-height: 1.45; margin-top: 16px;">${contentLines.join('\n').replace(/\n{3,}/g, '\n\n')}</div>
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
      // Văn bản Nhà nước: 2 cột tiêu đề (cột trái 40%, cột phải 60% để tránh ngắt dòng)
      const sepIdx = lines.findIndex(l => l.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA'));
      const leftLines = sepIdx > 0 ? lines.slice(0, sepIdx).filter(l => l.trim()) : [];
      const rightStartIdx = sepIdx >= 0 ? sepIdx : 0;
      const rightLines = lines.slice(rightStartIdx, rightStartIdx + 3);
      const bodyLines = lines.slice(Math.max(sepIdx + 3, 0));
      headerHtml = `
        <table class="letterhead" cellpadding="0" cellspacing="0">
          <tr>
            <td class="left-col" style="width: 40%;">
              ${leftLines.map((l, i) => `<div class="${i === 0 ? 'org-top' : i === 1 ? 'org-mid' : 'org-bot'}">${l}</div>`).join('')}
            </td>
            <td class="right-col" style="width: 60%;">
              <div class="republic-title" style="white-space: nowrap;">${rightLines[0] || ''}</div>
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
  <title></title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.45;
      color: #000;
      margin: 20mm 20mm 20mm 30mm;
      padding: 0;
      background: #fff;
    }
    .letterhead {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .left-col {
      width: 40%;
      vertical-align: top;
      padding-right: 10px;
    }
    .right-col {
      width: 60%;
      vertical-align: top;
      text-align: center;
      padding-left: 10px;
    }
    .org-top {
      font-weight: bold;
      font-size: 12pt;
      text-transform: uppercase;
      text-align: center;
    }
    .org-mid {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
    }
    .org-bot {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      text-decoration: underline;
    }
    .republic-title {
      font-weight: bold;
      font-size: 12pt;
      text-align: center;
      white-space: nowrap;
    }
    .republic-sub {
      font-style: italic;
      font-size: 12pt;
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
      line-height: 1.45;
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

  const [activeGroup, setActiveGroup] = useState<'to_truong' | 'party' | 'front'>('to_truong');

  // Lọc danh sách mẫu theo ban đang active
  const activeTemplates = templates.filter(t => t.group === activeGroup);

  // Thêm biến vào textarea soạn thảo mẫu
  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('template-content-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newVal = before + placeholder + after;
    setFormContentTemplate(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Mở form thêm mới
  const handleOpenAddForm = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormIcon('📝');
    setFormGroup(activeGroup);
    setFormPrompt('');
    setFormContentTemplate('');
    setFormDocType(activeGroup === 'party' ? 'party' : (activeGroup === 'front' ? 'front' : 'admin'));
  };

  // Mở form chỉnh sửa mẫu
  const handleOpenEditForm = (t: AITemplate) => {
    setEditingTemplate(t);
    setFormTitle(t.title);
    setFormIcon(t.icon);
    setFormGroup(t.group);
    setFormPrompt(t.prompt);
    setFormContentTemplate(t.contentTemplate);
    setFormDocType(t.docType);
  };

  // Lưu mẫu (thêm hoặc sửa)
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrompt.trim() || !formContentTemplate.trim()) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc!', 'warning');
      return;
    }

    if (editingTemplate) {
      // Sửa mẫu
      const updated = templates.map(t => t.id === editingTemplate.id ? {
        ...t,
        title: formTitle,
        icon: formIcon,
        group: formGroup,
        prompt: formPrompt,
        contentTemplate: formContentTemplate,
        docType: formDocType
      } : t);
      setTemplates(updated);
      showToast('Đã cập nhật mẫu văn bản thành công!', 'success');
      setEditingTemplate(null);
    } else {
      // Thêm mẫu mới
      const newTpl: AITemplate = {
        id: `tpl_${Date.now()}`,
        title: formTitle,
        icon: formIcon,
        group: formGroup,
        prompt: formPrompt,
        contentTemplate: formContentTemplate,
        docType: formDocType
      };
      setTemplates([...templates, newTpl]);
      showToast('Đã thêm mẫu văn bản mới thành công!', 'success');
      handleOpenAddForm(); // Reset form về trống
    }
  };

  // Xóa mẫu văn bản
  const handleDeleteTemplate = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa mẫu văn bản "${name}" không?`)) {
      setTemplates(templates.filter(t => t.id !== id));
      showToast('Đã xóa mẫu văn bản thành công!', 'success');
      if (editingTemplate?.id === id) {
        setEditingTemplate(null);
      }
    }
  };

  // Khôi phục mẫu mặc định
  const handleResetTemplates = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả tùy chỉnh và khôi phục 26 mẫu mặc định của hệ thống không?')) {
      setTemplates(DEFAULT_AI_TEMPLATES);
      showToast('Đã khôi phục bộ mẫu văn bản mặc định thành công!', 'success');
      setEditingTemplate(null);
    }
  };

  return (
    <div className="ai-container">
      <div className="ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="ai-badge">
            <Sparkles size={16} />
            <span>Trợ lý AI Tổ dân phố</span>
          </div>
          <h1>Trợ lý Văn bản AI</h1>
          <p>Hỗ trợ soạn thảo thông báo họp dân, biên bản và báo cáo chuyên nghiệp cực nhanh bằng ngôn ngữ hành chính chuẩn.</p>
        </div>

        {/* Nút Cài đặt mẫu dành riêng cho Admin */}
        {currentRole === 'admin' && (
          <button 
            onClick={() => setIsManagerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'white',
              border: '1.5px solid var(--primary)',
              color: 'var(--primary)',
              borderRadius: '24px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
              marginTop: '12px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'var(--primary)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = 'var(--primary)';
            }}
          >
            <Settings size={16} />
            <span>Cài đặt mẫu văn bản</span>
          </button>
        )}
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
            {activeTemplates.map((t) => (
              <button key={t.id} className="template-card" onClick={() => handleGenerate(t.prompt, t.id)}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{t.icon}</span>
                <div style={{textAlign: 'left', width: 'calc(100% - 24px)'}}>
                  <div style={{fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.title}</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.prompt}</div>
                </div>
              </button>
            ))}
            {activeTemplates.length === 0 && (
              <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
                Chưa có mẫu nào trong nhóm này. Hãy bấm vào "Cài đặt mẫu văn bản" để thêm!
              </div>
            )}
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
                { label: 'Đội tuổi nghĩa vụ quân sự của tổ ta?', query: 'Đội tuổi nghĩa vụ quân sự của tổ ta?' },
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
                  <button className="icon-btn-sm" onClick={handleDownload} title="Tải xuống tệp Word (.docx)">
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

      {/* === MODAL QUẢN LÝ MẪU AI ĐỘNG === */}
      {isManagerOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '1200px',
            maxHeight: '95vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Header Modal */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'
            }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} style={{ color: 'var(--primary)' }} />
                  Cấu hình mẫu văn bản AI (Dành cho Admin)
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>Thêm, sửa, xóa hoặc khôi phục các mẫu văn bản hành chính dùng trong hệ thống.</p>
              </div>
              <button onClick={() => setIsManagerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            {/* Content Modal */}
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', flex: 1, overflow: 'hidden' }}>
              {/* Cột trái: Danh sách các mẫu */}
              <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
                {/* Thanh Action đầu danh sách */}
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                  <button onClick={handleOpenAddForm} className="btn btn-primary" style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', gap: '4px' }}>
                    <Plus size={14} /> Thêm mẫu mới
                  </button>
                  <button onClick={handleResetTemplates} className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }} title="Khôi phục mẫu mặc định">
                    <RotateCcw size={14} /> Khôi phục gốc
                  </button>
                </div>

                {/* List scroll */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {/* Nhóm Tổ Trưởng */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', padding: '8px 8px 4px', letterSpacing: '0.05em' }}>🏠 Tổ Trưởng</div>
                    {templates.filter(t => t.group === 'to_truong').map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: '8px', marginBottom: '4px',
                        background: editingTemplate?.id === t.id ? '#eff6ff' : 'transparent',
                        border: editingTemplate?.id === t.id ? '1px dashed #3b82f6' : '1px solid transparent',
                        transition: 'all 0.2s', cursor: 'pointer'
                      }} onClick={() => handleOpenEditForm(t)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleOpenEditForm(t)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Sửa">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteTemplate(t.id, t.title)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Xóa">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nhóm Chi bộ */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', padding: '8px 8px 4px', letterSpacing: '0.05em' }}>⭐ Chi bộ Đảng</div>
                    {templates.filter(t => t.group === 'party').map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: '8px', marginBottom: '4px',
                        background: editingTemplate?.id === t.id ? '#fef2f2' : 'transparent',
                        border: editingTemplate?.id === t.id ? '1px dashed #ef4444' : '1px solid transparent',
                        transition: 'all 0.2s', cursor: 'pointer'
                      }} onClick={() => handleOpenEditForm(t)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleOpenEditForm(t)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Sửa">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteTemplate(t.id, t.title)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Xóa">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nhóm Mặt Trận */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase', padding: '8px 8px 4px', letterSpacing: '0.05em' }}>🤝 Mặt Trận</div>
                    {templates.filter(t => t.group === 'front').map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: '8px', marginBottom: '4px',
                        background: editingTemplate?.id === t.id ? '#fffbeb' : 'transparent',
                        border: editingTemplate?.id === t.id ? '1px dashed #d97706' : '1px solid transparent',
                        transition: 'all 0.2s', cursor: 'pointer'
                      }} onClick={() => handleOpenEditForm(t)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleOpenEditForm(t)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Sửa">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteTemplate(t.id, t.title)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Xóa">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cột phải: Form biên tập */}
              <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px', background: 'white' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a', borderBottom: '2px solid #3b82f6', paddingBottom: '8px', display: 'inline-block', width: 'fit-content' }}>
                  {editingTemplate ? `✏️ Đang sửa: ${editingTemplate.title}` : '➕ Thêm mẫu văn bản AI mới'}
                </h3>

                <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '12px' }}>
                    {/* Tiêu đề */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Tên hiển thị trên nút *</label>
                      <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ví dụ: Thông báo họp dân" style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }} required />
                    </div>
                    {/* Icon */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Biểu tượng (Icon)</label>
                      <select value={formIcon} onChange={e => setFormIcon(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}>
                        {['📢','📋','📊','💰','🗣️','✉️','🏠','🔐','📝','⭐','🤝','⚖️','📚','✅','🏆','💵','🎁'].map(icon => (
                          <option key={icon} value={icon}>{icon} {icon}</option>
                        ))}
                      </select>
                    </div>
                    {/* Nhóm Ban */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Thuộc nhóm Ban *</label>
                      <select value={formGroup} onChange={e => setFormGroup(e.target.value as any)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <option value="to_truong">🏠 Tổ trưởng</option>
                        <option value="party">⭐ Bí thư Chi bộ</option>
                        <option value="front">🤝 Mặt trận</option>
                      </select>
                    </div>
                    {/* Định dạng trang in */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Định dạng in *</label>
                      <select value={formDocType} onChange={e => setFormDocType(e.target.value as any)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <option value="admin">🏢 UBND / TDP (Hành chính)</option>
                        <option value="party">☭ Chi bộ Đảng (Đảng cộng sản)</option>
                        <option value="front">🤝 Mặt trận Tổ quốc</option>
                      </select>
                    </div>
                  </div>

                  {/* Prompt hướng dẫn cho AI */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                      Prompt gợi ý lệnh cho AI *
                      <span style={{ fontStyle: 'italic', fontWeight: 'normal', color: '#64748b', marginLeft: '6px' }}>(Ví dụ để huấn luyện AI hoặc nhập lệnh tìm kiếm)</span>
                    </label>
                    <input type="text" value={formPrompt} onChange={e => setFormPrompt(e.target.value)} placeholder="Ví dụ: Viết thông báo họp dân về việc tổng vệ sinh môi trường ngõ xóm..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }} required />
                  </div>

                  {/* Khung nội dung mẫu */}
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                      <span>Khung nội dung văn bản mẫu (Chứa các placeholder) *</span>
                      <span style={{ fontStyle: 'italic', color: '#ef4444', fontWeight: 'normal' }}>* Chú ý: Phần tiêu đề đầu trang và ký tên ở chân trang sẽ tự động tạo theo "Định dạng in"</span>
                    </label>
                    <textarea 
                      id="template-content-textarea"
                      value={formContentTemplate} 
                      onChange={e => setFormContentTemplate(e.target.value)} 
                      placeholder="Nhập nội dung mẫu văn bản thô tại đây..." 
                      style={{ width: '100%', height: '240px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.92rem', fontFamily: 'Courier New, monospace', resize: 'vertical' }}
                      required 
                    />
                  </div>

                  {/* Bảng chèn biến động nhanh */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>💡 Click để chèn nhanh tham số động từ CSDL (Mail Merge):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { code: '{tenTDP}', desc: 'Tên TDP' },
                        { code: '{tenPhuong}', desc: 'Tên Phường' },
                        { code: '{tenToTruong}', desc: 'Tên Tổ trưởng' },
                        { code: '{tenBiThu}', desc: 'Tên Bí thư' },
                        { code: '{thangNay}', desc: 'Tháng này' },
                        { code: '{thangToi}', desc: 'Tháng tiếp' },
                        { code: '{namNay}', desc: 'Năm nay' },
                        { code: '{ngayThangNam}', desc: 'Định dạng ngày hiện tại' },
                        { code: '{tongHoDan}', desc: 'Tổng số hộ dân' },
                        { code: '{tongNhanKhau}', desc: 'Tổng số nhân khẩu' },
                        { code: '{tongDangVien}', desc: 'Tổng số đảng viên' },
                        { code: '{dangVienChinhThuc}', desc: 'Đảng viên chính thức' },
                        { code: '{dangVienDuBi}', desc: 'Đảng viên dự bị' },
                        { code: '{hoNgheo}', desc: 'Số hộ nghèo' },
                        { code: '{hoCanNgheo}', desc: 'Số hộ cận nghèo' },
                        { code: '{hoChinhSach}', desc: 'Số hộ chính sách' },
                        { code: '{tongThuTaiChinh}', desc: 'Tổng thu tiền' },
                        { code: '{tongChiTaiChinh}', desc: 'Tổng chi tiền' },
                        { code: '{soDuTaiChinh}', desc: 'Số dư quỹ' },
                        { code: '{danhSachNVQS}', desc: 'Danh sách thanh niên NVQS' },
                        { code: '{danhSachHoNgheo}', desc: 'Danh sách Hộ nghèo' },
                        { code: '{danhSachHoCanNgheo}', desc: 'Danh sách Cận nghèo' },
                        { code: '{danhSachHoChinhSach}', desc: 'Danh sách Hộ chính sách' }
                      ].map(v => (
                        <button
                          type="button"
                          key={v.code}
                          onClick={() => insertPlaceholder(v.code)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #3b82f6',
                            color: '#1d4ed8',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            transition: 'all 0.1s'
                          }}
                          onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                          onMouseOut={e => e.currentTarget.style.background = '#eff6ff'}
                        >
                          {v.desc}: {v.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions Form */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    {editingTemplate && (
                      <button type="button" onClick={handleOpenAddForm} className="btn btn-outline" style={{ padding: '10px 20px' }}>
                        Hủy chỉnh sửa / Thêm mới
                      </button>
                    )}
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 'bold' }}>
                      {editingTemplate ? '💾 Lưu thay đổi mẫu' : '➕ Tạo mẫu văn bản mới'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

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
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          gap: 24px;
          flex: 1;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          cursor: pointer;
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

        @media (max-width: 1200px) {
          .ai-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .template-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AIAssistant;
