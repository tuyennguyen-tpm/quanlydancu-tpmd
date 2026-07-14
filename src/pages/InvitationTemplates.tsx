import React, { useState } from 'react';

const InvitationTemplates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leader' | 'party' | 'front'>('leader');

  const handlePrint = () => {
    window.print();
  };

  const currentYear = new Date().getFullYear();

  // Load config from localStorage
  const rawWardName = localStorage.getItem('ward_name') || 'Quảng Đại';
  const rawTdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
  
  const formatTdpName = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.startsWith('TỔ DÂN PHỐ') || upper.startsWith('THÔN') || upper.startsWith('KHU DÂN CƯ') || upper.startsWith('TỔ')) {
      return upper;
    }
    return `TỔ DÂN PHỐ ${upper}`;
  };

  const formatWardName = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.startsWith('PHƯỜNG') || upper.startsWith('XÃ') || upper.startsWith('THỊ TRẤN')) {
      return upper;
    }
    return `PHƯỜNG ${upper}`;
  };

  const formatPartyTdp = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.startsWith('CHI BỘ')) {
      return upper;
    }
    return `CHI BỘ ${upper}`;
  };

  const formattedTdpName = formatTdpName(rawTdpName);
  const formattedWardName = formatWardName(rawWardName);
  const formattedPartyTdpName = formatPartyTdp(rawTdpName);

  // Load official signatures
  let biThuName = '';
  let toTruongName = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';
  let matTranName = '';

  const savedSigs = localStorage.getItem('official_signatures');
  if (savedSigs) {
    try {
      const sigs = JSON.parse(savedSigs);
      const biThuObj = sigs.find((s: any) => s.id === 'bi_thu');
      if (biThuObj && biThuObj.name) biThuName = biThuObj.name;

      const toTruongObj = sigs.find((s: any) => s.id === 'to_truong');
      if (toTruongObj && toTruongObj.name) toTruongName = toTruongObj.name;

      const matTranObj = sigs.find((s: any) => s.id === 'mat_tran');
      if (matTranObj && matTranObj.name) matTranName = matTranObj.name;
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="content" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0 !important;
              box-shadow: none !important;
            }
          }
        `}
      </style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Mẫu Giấy Mời</h2>
        <button onClick={handlePrint} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          🖨️ In giấy mời
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className={activeTab === 'leader' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => setActiveTab('leader')}
        >
          Tổ dân phố
        </button>
        <button 
          className={activeTab === 'party' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => setActiveTab('party')}
        >
          Chi bộ Đảng
        </button>
        <button 
          className={activeTab === 'front' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => setActiveTab('front')}
        >
          Mặt trận Tổ quốc
        </button>
      </div>

      <div className="print-area" style={{ 
        background: 'white', 
        padding: '60px', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        minHeight: '842px', // A4 min height
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        lineHeight: '1.5',
        fontSize: '14pt'
      }}>
        {/* TỔ DÂN PHỐ */}
        {activeTab === 'leader' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '11pt' }}>UBND {formattedWardName}</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>{formattedTdpName}</p>
                <div style={{ width: '60px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontSize: '11pt' }}>Số: ....../GM-TDP</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', display: 'inline-block' }}>Độc lập - Tự do - Hạnh phúc</p>
                <div style={{ width: '160px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12pt' }}>{rawWardName}, ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', margin: '30px 0 10px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '0 0 25px 0' }}>V/v: ..........................................................................................</p>

            <div style={{ marginBottom: '25px', paddingLeft: '40px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14pt' }}>
                <strong style={{ display: 'inline-block', width: '100px' }}>Kính gửi:</strong> Ông/Bà: ....................................................................................................
              </p>
              <p style={{ margin: 0, fontSize: '14pt', paddingLeft: '100px' }}>
                Đại diện hộ gia đình: ...........................................................................................
              </p>
            </div>

            <p style={{ textIndent: '30px', margin: '0 0 15px 0', textAlign: 'justify' }}>
              Tổ trưởng {formattedTdpName.toLowerCase()} trân trọng kính mời Ông/Bà (Đồng chí) tới tham dự Hội nghị/cuộc họp với nội dung chi tiết như sau:
            </p>
            
            <div style={{ paddingLeft: '30px', marginBottom: '25px' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>1. Nội dung cuộc họp:</strong> ..........................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                ..................................................................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>2. Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>3. Địa điểm:</strong> Nhà văn hóa {formattedTdpName.toLowerCase()} .............................................................................................
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Tài liệu/Yêu cầu khác:</strong> ...................................................................................................................
              </p>
            </div>
            
            <p style={{ textIndent: '30px', margin: '0 0 40px 0', textAlign: 'justify' }}>
              Sự có mặt của Ông/Bà là yếu tố quan trọng góp phần vào thành công của Hội nghị. Rất mong Ông/Bà sắp xếp thời gian đến dự đúng giờ./.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <div style={{ width: '45%', paddingLeft: '10px' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 5px 0', fontSize: '11pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Như kính gửi;</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- UBND {formattedWardName.toLowerCase()} (để báo cáo);</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Lưu: TDP.</p>
              </div>
              <div style={{ width: '45%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>TỔ TRƯỞNG</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11pt' }}>(Chữ ký, họ và tên)</p>
                <div style={{ height: '90px' }}></div>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{toTruongName}</p>
              </div>
            </div>
          </div>
        )}

        {/* CHI BỘ ĐẢNG */}
        {activeTab === 'party' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '11pt' }}>ĐẢNG BỘ {formattedWardName}</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>{formattedPartyTdpName}</p>
                <div style={{ width: '60px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontSize: '11pt' }}>Số: ......-GM/CB</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', textTransform: 'uppercase' }}>ĐẢNG CỘNG SẢN VIỆT NAM</p>
                <div style={{ width: '130px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12pt' }}>{rawWardName}, ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', margin: '30px 0 10px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '0 0 25px 0' }}>Dự sinh hoạt Chi bộ định kỳ/chuyên đề</p>

            <div style={{ marginBottom: '25px', paddingLeft: '40px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14pt' }}>
                <strong style={{ display: 'inline-block', width: '100px' }}>Kính gửi:</strong> Đồng chí: .............................................................................................
              </p>
              <p style={{ margin: 0, fontSize: '14pt', paddingLeft: '100px' }}>
                Đảng viên {formattedPartyTdpName.toLowerCase()}: .............................................................................
              </p>
            </div>

            <p style={{ textIndent: '30px', margin: '0 0 15px 0', textAlign: 'justify' }}>
              Chi ủy {formattedPartyTdpName.toLowerCase()} trân trọng kính mời Đồng chí tới tham dự kỳ họp sinh hoạt Chi bộ định kỳ/chuyên đề với thông tin cụ thể như sau:
            </p>
            
            <div style={{ paddingLeft: '30px', marginBottom: '25px' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>1. Nội dung sinh hoạt:</strong> ........................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                ..................................................................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>2. Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>3. Địa điểm:</strong> Nhà văn hóa {formattedTdpName.toLowerCase()} .............................................................................................
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Yêu cầu đối với Đảng viên:</strong> Mang theo sổ tay Đảng viên, trang phục chỉnh tề và chuẩn bị ý kiến phát biểu.
              </p>
            </div>
            
            <p style={{ textIndent: '30px', margin: '0 0 40px 0', textAlign: 'justify' }}>
              Đề nghị Đồng chí sắp xếp công việc tham dự đầy đủ và đúng giờ để buổi sinh hoạt đạt chất lượng tốt./.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <div style={{ width: '45%', paddingLeft: '10px' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 5px 0', fontSize: '11pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Như kính gửi;</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Đảng ủy {formattedWardName.toLowerCase()} (để báo cáo);</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Lưu: Chi bộ.</p>
              </div>
              <div style={{ width: '45%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>T/M CHI ỦY (CHI BỘ)</p>
                <p style={{ fontWeight: 'bold', margin: 0 }}>BÍ THƯ</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11pt' }}>(Chữ ký, họ và tên)</p>
                <div style={{ height: '90px' }}></div>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{biThuName || '.....................................'}</p>
              </div>
            </div>
          </div>
        )}

        {/* MẶT TRẬN TỔ QUỐC */}
        {activeTab === 'front' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '11pt' }}>UBMTTQ VN {formattedWardName}</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>BAN CÔNG TÁC MẶT TRẬN</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '11pt' }}>{formattedTdpName}</p>
                <div style={{ width: '60px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontSize: '11pt' }}>Số: ....../GM-MTTQ</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12pt', display: 'inline-block' }}>Độc lập - Tự do - Hạnh phúc</p>
                <div style={{ width: '160px', borderBottom: '1px solid black', margin: '3px auto 5px' }}></div>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12pt' }}>{rawWardName}, ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', margin: '30px 0 10px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '0 0 25px 0' }}>V/v: Dự hội nghị họp dân / Đại đoàn kết toàn dân tộc</p>

            <div style={{ marginBottom: '25px', paddingLeft: '40px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14pt' }}>
                <strong style={{ display: 'inline-block', width: '100px' }}>Kính gửi:</strong> Ông/Bà: ....................................................................................................
              </p>
              <p style={{ margin: 0, fontSize: '14pt', paddingLeft: '100px' }}>
                Đại diện tổ chức/hộ gia đình: ...............................................................................
              </p>
            </div>

            <p style={{ textIndent: '30px', margin: '0 0 15px 0', textAlign: 'justify' }}>
              Ban công tác Mặt trận {formattedTdpName.toLowerCase()} trân trọng kính mời Ông/Bà tới tham dự hội nghị họp dân bàn công tác mặt trận với nội dung chi tiết như sau:
            </p>
            
            <div style={{ paddingLeft: '30px', marginBottom: '25px' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>1. Nội dung hội nghị:</strong> ........................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                ..................................................................................................................................................................
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>2. Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>3. Địa điểm:</strong> Nhà văn hóa {formattedTdpName.toLowerCase()} .............................................................................................
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Phối hợp chuẩn bị (nếu có):</strong> ..............................................................................................................
              </p>
            </div>
            
            <p style={{ textIndent: '30px', margin: '0 0 40px 0', textAlign: 'justify' }}>
              Sự hiện diện của Ông/Bà đóng vai trò quan trọng trong việc thắt chặt khối đại đoàn kết toàn dân. Rất mong Ông/Bà thu xếp thời gian tham dự đầy đủ./.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <div style={{ width: '45%', paddingLeft: '10px' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 5px 0', fontSize: '11pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Như kính gửi;</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- UBMTTQVN {formattedWardName.toLowerCase()} (để báo cáo);</p>
                <p style={{ margin: 0, fontSize: '11pt' }}>- Lưu: Ban CTMT.</p>
              </div>
              <div style={{ width: '45%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>TM. BAN CÔNG TÁC MẶT TRẬN</p>
                <p style={{ fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>TRƯỞNG BAN</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11pt' }}>(Chữ ký, họ và tên)</p>
                <div style={{ height: '90px' }}></div>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{matTranName || '.....................................'}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default InvitationTemplates;
