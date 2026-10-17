import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Send, 
  X, 
  Sparkles,
  Edit3,
  Check,
  ArrowRight
} from 'lucide-react';
import { db } from '../services/db';
import type { Resident } from '../types';

interface VirtualAssistantProps {
  isSidebarOpen: boolean;
  onNavigate: (tabId: string) => void;
  userRole?: string;
}

export const VirtualAssistant: React.FC<VirtualAssistantProps> = ({
  isSidebarOpen,
  onNavigate
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isBubbleOpen, setIsBubbleOpen] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('assistant_voice_enabled') !== 'false';
  });
  const [voiceType, setVoiceType] = useState<'google' | 'hoaimy'>('google');
  const [inputText, setInputText] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [editFormData, setEditFormData] = useState<{ full_name: string; dob: string; cccd: string; phone: string }>({
    full_name: '',
    dob: '',
    cccd: '',
    phone: ''
  });
  const [transparentImg, setTransparentImg] = useState<string>('/assistant-girl.jpg');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasGreetedRef = useRef(false);

  // 1. Tách nền trắng tự động của ảnh cô gái để cô gái đứng nổi bật không bị viền hộp
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/assistant-girl.jpg';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Xóa nền trắng (R, G, B > 242)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Transparent
          } else if (r > 220 && g > 220 && b > 220) {
            // Làm mờ viền cạnh nhẹ nhàng
            data[i + 3] = Math.max(0, 255 - (r - 220) * 12);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setTransparentImg(canvas.toDataURL('image/png'));
      } catch (err) {
        setTransparentImg('/assistant-girl.jpg');
      }
    };
  }, []);

  // 2. Chức năng phát âm giọng nói (Ưu tiên giọng Chị Google hoặc Microsoft Hoài My)
  const speakVoice = (text: string) => {
    if (!voiceEnabled) return;
    setIsSpeaking(true);

    // Thử giọng Microsoft Hoài My qua SpeechSynthesis trước nếu người dùng chọn Hoài My
    if (voiceType === 'hoaimy' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const hoaiMyVoice = voices.find(v => v.name.includes('HoaiMy') || v.name.includes('Hoài My'));
      const viVoice = hoaiMyVoice || voices.find(v => v.lang.includes('vi'));

      if (viVoice) {
        utterance.voice = viVoice;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        return;
      }
    }

    // Mặc định hoặc fallback: Giọng chuẩn Chị Google (Google Translate TTS tiếng Việt)
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Dùng URL chuẩn của Google TTS tiếng Việt (giọng chị Google quen thuộc)
      const cleanText = text.replace(/[\n\r]+/g, ' ').slice(0, 200);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=vi&client=tw-ob`;
      
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => {
        // Fallback sang SpeechSynthesis của trình duyệt nếu mạng chặn Google TTS
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'vi-VN';
          u.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(u);
        } else {
          setIsSpeaking(false);
        }
      };
      audio.play().catch(() => {
        setIsSpeaking(false);
      });
    } catch (e) {
      setIsSpeaking(false);
    }
  };

  // 3. Lời chào khi mở ứng dụng
  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Chào buổi sáng anh chị!';
    if (hour >= 11 && hour < 14) timeGreeting = 'Chào buổi trưa anh chị!';
    else if (hour >= 14 && hour < 18) timeGreeting = 'Chào buổi chiều anh chị!';
    else if (hour >= 18) timeGreeting = 'Chào buổi tối anh chị!';

    const greeting = `${timeGreeting} Em là trợ lý ảo của tổ dân phố Quảng Giao. Hôm nay anh chị muốn mở phần nào, hay cần em kiểm tra nhân khẩu, tìm tên, tuổi, số căn cước ạ?`;
    
    setAssistantText(greeting);

    // Chào ngay bằng giọng nói khi vừa mở ứng dụng
    const timer = setTimeout(() => {
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        speakVoice(greeting);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // 4. Xử lý câu hỏi hoặc yêu cầu điều hướng / sửa dữ liệu
  const handleUserQuery = async (queryStr: string) => {
    const query = queryStr.trim();
    if (!query) return;

    setInputText('');
    setSearchResults([]);

    const qLower = query.toLowerCase();

    // Điều hướng các trang
    if (qLower.includes('nhân khẩu') || qLower.includes('dân cư') || qLower.includes('danh sách người')) {
      const msg = 'Dạ, em mở danh sách Nhân khẩu cho anh chị ngay đây ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('residents');
      return;
    }

    if (qLower.includes('hộ gia đình') || qLower.includes('số hộ') || qLower.includes('chủ hộ')) {
      const msg = 'Dạ, em mở danh sách Hộ gia đình ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('households');
      return;
    }

    if (qLower.includes('thu chi') || qLower.includes('tiền quỹ') || qLower.includes('tài chính')) {
      const msg = 'Dạ, em mở trang Quản lý Thu chi của tổ dân phố ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('finance');
      return;
    }

    if (qLower.includes('quỹ phường') || qLower.includes('nộp phường')) {
      const msg = 'Dạ, em mở phần Quỹ nộp phường ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('ward-funds');
      return;
    }

    if (qLower.includes('mừng thọ') || qLower.includes('người cao tuổi')) {
      const msg = 'Dạ, em mở danh sách Hội Người cao tuổi và mừng thọ ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('elderly');
      return;
    }

    if (qLower.includes('bản đồ') || qLower.includes('map')) {
      const msg = 'Dạ, em mở Bản đồ số dân cư tổ dân phố ạ!';
      setAssistantText(msg);
      speakVoice(msg);
      onNavigate('map');
      return;
    }

    // Tra cứu nhân khẩu để xem hoặc sửa
    try {
      const allResidents = await db.getResidents();
      const currentYear = new Date().getFullYear();

      // Tìm theo tuổi (vd: "80 tuổi")
      const ageMatch = qLower.match(/(\d+)\s*tuổi/);
      // Tìm theo năm sinh (vd: "1984")
      const yearMatch = qLower.match(/(?:sinh\s*năm|năm\s*sinh|sn)?\s*(\d{4})/);

      let found: Resident[] = [];

      if (ageMatch) {
        const targetAge = parseInt(ageMatch[1], 10);
        found = allResidents.filter(r => {
          if (!r.dob) return false;
          const y = parseInt(r.dob.slice(0, 4), 10);
          return (currentYear - y) === targetAge;
        });
      } else if (yearMatch && yearMatch[1].startsWith('19') || (yearMatch && yearMatch[1].startsWith('20'))) {
        const yStr = yearMatch[1];
        found = allResidents.filter(r => r.dob && r.dob.startsWith(yStr));
      } else {
        const searchKey = qLower.replace(/^tìm\s*(?:kiếm)?\s*/, '').replace(/^sửa\s*(?:thông tin)?\s*/, '').trim();
        found = allResidents.filter(r => {
          const mName = r.full_name && r.full_name.toLowerCase().includes(searchKey);
          const mCccd = r.cccd && r.cccd.replace(/\s+/g, '').includes(searchKey);
          return mName || mCccd;
        });
      }

      if (found.length > 0) {
        const top5 = found.slice(0, 5);
        setSearchResults(top5);
        const reply = `Em đã tìm thấy ${found.length} nhân khẩu. Anh chị có thể xem hoặc bấm Sửa để chỉnh sửa thông tin trực tiếp nhé!`;
        setAssistantText(reply);
        speakVoice(`Em đã tìm thấy ${found.length} người. Anh chị có thể xem hoặc bấm nút Sửa để thay đổi thông tin nhé!`);
      } else {
        const reply = `Em chưa tìm thấy ai khớp với "${query}". Anh chị kiểm tra lại tên hoặc số căn cước giúp em nhé!`;
        setAssistantText(reply);
        speakVoice(reply);
      }
    } catch (e) {
      setAssistantText('Dạ có lỗi khi tra cứu dữ liệu, anh chị thử lại giúp em nhé!');
    }
  };

  // 5. Lưu thông tin nhân khẩu sau khi chỉnh sửa qua trợ lý
  const handleSaveEdit = async () => {
    if (!editingResident) return;
    try {
      const updated: Resident = {
        ...editingResident,
        full_name: editFormData.full_name.trim(),
        dob: editFormData.dob.trim(),
        cccd: editFormData.cccd.trim(),
        phone: editFormData.phone.trim()
      };

      await db.saveResident(updated);

      // Cập nhật lại danh sách kết quả hiển thị
      setSearchResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      setEditingResident(null);

      const msg = `Em đã cập nhật thông tin cho ${updated.full_name} thành công rồi ạ!`;
      setAssistantText(msg);
      speakVoice(msg);
    } catch (err: any) {
      const msg = 'Lỗi lưu thông tin: ' + (err.message || 'vui lòng thử lại');
      setAssistantText(msg);
      speakVoice('Lỗi lưu thông tin rồi ạ, anh chị kiểm tra lại nhé.');
    }
  };

  if (!isVisible) {
    // Khi ẩn, chỉ hiện một nút cô gái nhỏ xinh ở góc trái để gọi cô ấy ra
    return (
      <div 
        onClick={() => { setIsVisible(true); setIsBubbleOpen(true); }}
        style={{
          position: 'fixed',
          bottom: '15px',
          left: isSidebarOpen ? '280px' : '20px',
          zIndex: 9999,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '6px 14px 6px 6px',
          borderRadius: '999px',
          boxShadow: '0 8px 24px rgba(0, 102, 204, 0.25)',
          border: '2px solid #38bdf8'
        }}
        title="Bấm để gọi Trợ lý Ảo"
      >
        <img 
          src={transparentImg} 
          alt="Trợ lý Ảo" 
          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} 
        />
        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0284c7' }}>Gọi Trợ lý Ảo</span>
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '10px',
        left: isSidebarOpen ? '280px' : '15px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        pointerEvents: 'auto',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* 1. BONG BÓNG LỜI THOẠI CỦA CÔ GÁI (Speech Bubble) */}
      {isBubbleOpen && (
        <div 
          style={{
            maxWidth: '340px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(12px)',
            borderRadius: '20px',
            border: '2px solid #38bdf8',
            boxShadow: '0 16px 36px rgba(2, 132, 199, 0.25)',
            padding: '14px 16px',
            marginBottom: '10px',
            position: 'relative',
            animation: 'fadeInUp 0.3s ease-out',
            fontSize: '0.85rem',
            color: '#0f172a'
          }}
        >
          {/* Mũi nhọn tam giác chỉ xuống cô gái */}
          <div style={{
            position: 'absolute',
            bottom: '-10px',
            left: '45px',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '10px solid #38bdf8'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-7px',
            left: '46px',
            width: 0,
            height: 0,
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderTop: '9px solid #ffffff'
          }} />

          {/* Thanh tiêu đề nhỏ gọn của bóng thoại */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.88rem' }}>Trợ lý Ảo</span>
              <Sparkles size={13} style={{ color: '#eab308' }} />
              {isSpeaking && (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  borderRadius: '6px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  Đang nói...
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Chọn giọng: Chị Google hoặc Hoài My */}
              <select 
                value={voiceType} 
                onChange={(e) => {
                  const val = e.target.value as any;
                  setVoiceType(val);
                  speakVoice(val === 'google' ? 'Đã chuyển sang giọng chị Google.' : 'Đã chuyển sang giọng Hoài My.');
                }}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 4px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                title="Chọn giọng nói"
              >
                <option value="google">Giọng chị Google</option>
                <option value="hoaimy">Giọng Hoài My</option>
              </select>

              {/* Nút bật tắt loa */}
              <button 
                onClick={() => {
                  const n = !voiceEnabled;
                  setVoiceEnabled(n);
                  localStorage.setItem('assistant_voice_enabled', String(n));
                  if (!n && audioRef.current) audioRef.current.pause();
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: voiceEnabled ? '#0284c7' : '#94a3b8' }}
                title={voiceEnabled ? 'Tắt tiếng' : 'Bật tiếng'}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button 
                onClick={() => setIsBubbleOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                title="Đóng lời thoại"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Nội dung câu nói của cô gái */}
          <div style={{ lineHeight: '1.5', color: '#1e293b', marginBottom: '10px' }}>
            {assistantText}
          </div>

          {/* FORM SỬA NHÂN KHẨU TRỰC TIẾP QUA TRỢ LÝ (Khi người dùng bấm Sửa) */}
          {editingResident && (
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #38bdf8',
              borderRadius: '12px',
              padding: '10px',
              marginBottom: '10px'
            }}>
              <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Edit3 size={13} /> Sửa thông tin nhân khẩu:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input 
                  type="text" 
                  value={editFormData.full_name} 
                  onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  placeholder="Họ và tên"
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
                <input 
                  type="text" 
                  value={editFormData.dob} 
                  onChange={e => setEditFormData({ ...editFormData, dob: e.target.value })}
                  placeholder="Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY)"
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
                <input 
                  type="text" 
                  value={editFormData.cccd} 
                  onChange={e => setEditFormData({ ...editFormData, cccd: e.target.value })}
                  placeholder="Số CCCD (12 chữ số)"
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
                <input 
                  type="text" 
                  value={editFormData.phone} 
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="Số điện thoại"
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <button 
                    onClick={handleSaveEdit}
                    style={{
                      flex: 1,
                      background: '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Check size={14} /> Lưu lại
                  </button>
                  <button 
                    onClick={() => setEditingResident(null)}
                    style={{
                      background: '#e2e8f0',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DANH SÁCH KẾT QUẢ TÌM KIẾM (Kèm nút Sửa thông tin) */}
          {!editingResident && searchResults.length > 0 && (
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {searchResults.map((r) => (
                <div 
                  key={r.id} 
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.82rem', color: '#0f172a' }}>{r.full_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Sinh: {r.dob || '---'} • CCCD: <strong style={{ color: '#0284c7' }}>{r.cccd || '(Trống)'}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => {
                        setEditingResident(r);
                        setEditFormData({
                          full_name: r.full_name || '',
                          dob: r.dob || '',
                          cccd: r.cccd || '',
                          phone: r.phone || ''
                        });
                      }}
                      style={{
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0284c7',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      title="Sửa thông tin người này"
                    >
                      <Edit3 size={11} /> Sửa
                    </button>
                    <button 
                      onClick={() => {
                        onNavigate('residents');
                        setIsBubbleOpen(false);
                      }}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                      title="Mở trong hồ sơ"
                    >
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ô GÕ YÊU CẦU / TRÒ CHUYỆN VỚI CÔ GÁI */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUserQuery(inputText);
              }}
              placeholder="Nói với em: vd tìm tên, sửa tuổi, mở quỹ..."
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                outline: 'none',
                background: '#ffffff'
              }}
            />
            <button 
              onClick={() => handleUserQuery(inputText)}
              disabled={!inputText.trim()}
              style={{
                background: inputText.trim() ? '#0284c7' : '#e2e8f0',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                cursor: inputText.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              title="Gửi"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 2. HÌNH TƯỢNG CÔ GÁI ĐỨNG MỘT MÌNH NỔI BẬT Ở GÓC DƯỚI BÊN TRÁI (Không có hộp bao quanh!) */}
      <div 
        onClick={() => {
          setIsBubbleOpen(true);
          speakVoice('Em đang lắng nghe đây ạ. Anh chị cần em hỗ trợ gì ạ?');
        }}
        style={{
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
          animation: 'floatingGirl 3s ease-in-out infinite'
        }}
        title="Bấm để nói chuyện với em nhé!"
      >
        {/* Nút nhỏ đóng hẳn cô gái */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          style={{
            position: 'absolute',
            top: '0px',
            right: '-10px',
            background: 'rgba(15, 23, 42, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Tạm ẩn trợ lý"
        >
          ✕
        </button>

        {/* Ảnh nhân vật cô gái (đã tách nền trong suốt) */}
        <div style={{ position: 'relative', width: '130px', height: '175px' }}>
          <img 
            src={transparentImg} 
            alt="Cô gái Trợ lý Ảo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: isSpeaking ? 'drop-shadow(0 8px 16px rgba(2, 132, 199, 0.5))' : 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.18))',
              transition: 'filter 0.3s'
            }} 
          />
        </div>

        {/* Nhãn tên nhỏ xinh dưới chân cô gái */}
        <div style={{
          marginTop: '-6px',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: 'white',
          padding: '2px 10px',
          borderRadius: '999px',
          fontSize: '0.68rem',
          fontWeight: '700',
          boxShadow: '0 4px 10px rgba(2, 132, 199, 0.35)',
          border: '1.5px solid rgba(255, 255, 255, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Trợ lý Ảo</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
        </div>
      </div>

      <style>{`
        @keyframes floatingGirl {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
