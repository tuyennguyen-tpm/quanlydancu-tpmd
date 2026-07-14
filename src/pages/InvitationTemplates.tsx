import React, { useState } from 'react';

const InvitationTemplates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leader' | 'party' | 'front'>('leader');

  const handlePrint = () => {
    window.print();
  };

  const currentYear = new Date().getFullYear();

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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div style={{ textAlign: 'center', width: '40%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt' }}>UBND PHƯỜNG .....................</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt', borderBottom: '1px solid black', paddingBottom: '2px', display: 'inline-block' }}>TỔ DÂN PHỐ .....................</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '13pt' }}>Số: ....../GM-TDP</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt', borderBottom: '1px solid black', paddingBottom: '2px', display: 'inline-block' }}>Độc lập - Tự do - Hạnh phúc</p>
                <p style={{ margin: '5px 0 0 0', fontStyle: 'italic', fontSize: '13pt' }}>..........., ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', margin: '40px 0 20px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: '30px', fontSize: '14pt' }}>(V/v: ..........................................................................................)</p>

            <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Tổ trưởng Tổ dân phố .................................................. trân trọng kính mời:</p>
            <p style={{ margin: '0 0 15px 0' }}>Ông/Bà: .................................................................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>Đại diện cho hộ gia đình: .......................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Tới dự:</strong> Hội nghị .................................................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>................................................................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}</p>
            <p style={{ margin: '0 0 15px 0' }}><strong>Địa điểm:</strong> Nhà văn hóa Tổ dân phố .....................................................................................</p>
            <p style={{ margin: '0 0 30px 0' }}>................................................................................................................................................</p>
            
            <p style={{ margin: '0 0 40px 0' }}>Sự có mặt của Ông/Bà là yếu tố quan trọng góp phần vào thành công của Hội nghị. Rất mong Ông/Bà sắp xếp thời gian đến dự đúng giờ.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '40%' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Như trên;</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Lưu: TDP.</p>
              </div>
              <div style={{ width: '40%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>TỔ TRƯỞNG</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>(Ký, ghi rõ họ tên)</p>
                <div style={{ height: '80px' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* CHI BỘ ĐẢNG */}
        {activeTab === 'party' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div style={{ textAlign: 'center', width: '40%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt' }}>ĐẢNG BỘ PHƯỜNG .....................</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt', borderBottom: '1px solid black', paddingBottom: '2px', display: 'inline-block' }}>CHI BỘ .....................</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '14pt' }}>*</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '13pt' }}>Số: ......-GM/CB</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13pt' }}>ĐẢNG CỘNG SẢN VIỆT NAM</p>
                <p style={{ margin: '20px 0 0 0', fontStyle: 'italic', fontSize: '13pt' }}>..........., ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', margin: '40px 0 20px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: '30px', fontSize: '14pt' }}>Dự sinh hoạt Chi bộ định kỳ/chuyên đề ................................</p>

            <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Chi ủy Chi bộ .................................................. trân trọng kính mời:</p>
            <p style={{ margin: '0 0 15px 0' }}>Đồng chí: .............................................................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>Chức vụ (nếu có): .................................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Tới dự:</strong> Cuộc họp sinh hoạt Chi bộ ....................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>Nội dung: ...............................................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}</p>
            <p style={{ margin: '0 0 15px 0' }}><strong>Địa điểm:</strong> Nhà văn hóa Tổ dân phố .....................................................................................</p>
            
            <p style={{ margin: '0 0 40px 0' }}>Đề nghị Đồng chí sắp xếp công việc đến dự đúng thời gian quy định để cuộc họp đạt kết quả tốt.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '40%' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Như trên;</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Lưu: CB.</p>
              </div>
              <div style={{ width: '40%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>T/M CHI ỦY</p>
                <p style={{ fontWeight: 'bold', margin: 0 }}>BÍ THƯ</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>(Ký, ghi rõ họ tên)</p>
                <div style={{ height: '80px' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* MẶT TRẬN TỔ QUỐC */}
        {activeTab === 'front' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt' }}>UBMTTQ VN PHƯỜNG .....................</p>
                <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: '13pt', borderBottom: '1px solid black', paddingBottom: '2px', display: 'inline-block' }}>BAN CÔNG TÁC MẶT TRẬN .....................</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '13pt' }}>Số: ....../GM-MTTQ</p>
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt', borderBottom: '1px solid black', paddingBottom: '2px', display: 'inline-block' }}>Độc lập - Tự do - Hạnh phúc</p>
                <p style={{ margin: '5px 0 0 0', fontStyle: 'italic', fontSize: '13pt' }}>..........., ngày ...... tháng ...... năm {currentYear}</p>
              </div>
            </div>

            <h1 style={{ textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', margin: '40px 0 20px 0' }}>GIẤY MỜI</h1>
            <p style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: '30px', fontSize: '14pt' }}>(V/v: Dự Hội nghị Đại đoàn kết toàn dân tộc / họp dân .....................)</p>

            <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Ban công tác Mặt trận khu dân cư .................................................. trân trọng kính mời:</p>
            <p style={{ margin: '0 0 15px 0' }}>Ông/Bà: .................................................................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>Đại diện cho: .........................................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Tới dự:</strong> ................................................................................................................................</p>
            <p style={{ margin: '0 0 15px 0' }}>................................................................................................................................................</p>
            
            <p style={{ margin: '0 0 15px 0' }}><strong>Thời gian:</strong> ...... giờ ...... phút, ngày ...... tháng ...... năm {currentYear}</p>
            <p style={{ margin: '0 0 15px 0' }}><strong>Địa điểm:</strong> Nhà văn hóa Tổ dân phố .....................................................................................</p>
            
            <p style={{ margin: '0 0 40px 0' }}>Sự hiện diện của Ông/Bà là niềm vinh hạnh và góp phần vào thành công chung của Hội nghị. Trân trọng kính mời!</p>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '40%' }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>Nơi nhận:</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Như trên;</p>
                <p style={{ margin: 0, fontSize: '12pt' }}>- Lưu: Ban CTMT.</p>
              </div>
              <div style={{ width: '40%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>TM. BAN CÔNG TÁC MẶT TRẬN</p>
                <p style={{ fontWeight: 'bold', margin: 0 }}>TRƯỞNG BAN</p>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '12pt' }}>(Ký, ghi rõ họ tên)</p>
                <div style={{ height: '80px' }}></div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default InvitationTemplates;
