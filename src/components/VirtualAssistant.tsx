import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Send, 
  X, 
  Sparkles,
  Edit3,
  Check,
  ArrowRight,
  Mic,
  MicOff,
  User,
  Radio
} from 'lucide-react';
import { db } from '../services/db';
import type { Resident } from '../types';

interface VirtualAssistantProps {
  isSidebarOpen: boolean;
  onNavigate: (tabId: string) => void;
  userRole?: string;
}

export type VoiceOption = 'hoaimy' | 'namminh' | 'google';

export const VirtualAssistant: React.FC<VirtualAssistantProps> = ({
  isSidebarOpen,
  onNavigate
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isBubbleOpen, setIsBubbleOpen] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('assistant_voice_enabled') !== 'false';
  });
  const [voiceType, setVoiceType] = useState<VoiceOption>(() => {
    return (localStorage.getItem('assistant_voice_type') as VoiceOption) || 'namminh';
  });
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

  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // 1. Tách nền trắng tự động cho ảnh nhân vật
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

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
          } else if (r > 220 && g > 220 && b > 220) {
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

  // 2. Tải danh sách giọng nói tiếng Việt từ hệ thống (Hoài My, Nam Minh, Google)
  const refreshVoices = useCallback(() => {
    if ('speechSynthesis' in window) {
      const list = window.speechSynthesis.getVoices();
      availableVoicesRef.current = list;
    }
  }, []);

  useEffect(() => {
    refreshVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }, [refreshVoices]);

  // 3. Hàm phát âm giọng nói chuẩn (Hoài My, Nam Minh, hoặc Google)
  const speak = useCallback((textToSpeak: string, customVoice?: VoiceOption) => {
    if (!voiceEnabled) return;

    const chosenVoice = customVoice || voiceType;
    setIsSpeaking(true);

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // A. Nếu chọn Google TTS hoặc fallback
    if (chosenVoice === 'google') {
      try {
        const clean = textToSpeak.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=vi&client=tw-ob`;
        const audio = new Audio(url);
        audioPlayerRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          // Fallback sang SpeechSynthesis
          speakWithWebSpeech(textToSpeak, chosenVoice);
        };
        audio.play().catch(() => {
          speakWithWebSpeech(textToSpeak, chosenVoice);
        });
        return;
      } catch {
        speakWithWebSpeech(textToSpeak, chosenVoice);
        return;
      }
    }

    // B. Nếu chọn Hoài My hoặc Nam Minh qua Web Speech API
    speakWithWebSpeech(textToSpeak, chosenVoice);
  }, [voiceEnabled, voiceType]);

  const speakWithWebSpeech = (textToSpeak: string, chosenVoice: VoiceOption) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = chosenVoice === 'namminh' ? 0.95 : 1.1;

    const voices = availableVoicesRef.current.length > 0 
      ? availableVoicesRef.current 
      : window.speechSynthesis.getVoices();

    let matchedVoice: SpeechSynthesisVoice | undefined;

    if (chosenVoice === 'namminh') {
      // Tìm giọng Nam Minh (Microsoft NamMinh Online) hoặc bất kỳ giọng nam tiếng Việt
      matchedVoice = voices.find(v => 
        (v.name.toLowerCase().includes('namminh') || v.name.toLowerCase().includes('nam minh')) && 
        (v.lang.includes('vi') || v.lang.includes('VI'))
      );
      if (!matchedVoice) {
        matchedVoice = voices.find(v => 
          (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('nam')) && 
          (v.lang.includes('vi') || v.lang.includes('VI'))
        );
      }
    } else if (chosenVoice === 'hoaimy') {
      // Tìm giọng Hoài My (Microsoft HoaiMy Online) hoặc giọng nữ tiếng Việt
      matchedVoice = voices.find(v => 
        (v.name.toLowerCase().includes('hoaimy') || v.name.toLowerCase().includes('hoài my')) && 
        (v.lang.includes('vi') || v.lang.includes('VI'))
      );
    }

    // Fallback nếu không có tên chính xác: lấy bất kỳ giọng vi-VN nào
    if (!matchedVoice) {
      matchedVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // 4. Lời chào khởi đầu
  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Chào buổi sáng anh chị!';
    if (hour >= 11 && hour < 14) timeGreeting = 'Chào buổi trưa anh chị!';
    else if (hour >= 14 && hour < 18) timeGreeting = 'Chào buổi chiều anh chị!';
    else if (hour >= 18) timeGreeting = 'Chào buổi tối anh chị!';

    const greeting = `${timeGreeting} Em là trợ lý ảo TDP Quảng Giao. Anh chị có thể bấm micro hoặc gõ yêu cầu: mở phần nào, tìm kiểm tra nhân khẩu, tên, tuổi, số căn cước để em phục vụ nhé!`;
    setAssistantText(greeting);
  }, []);

  // 5. Khởi tạo chức năng Nhận diện giọng nói qua Micro (SpeechRecognition)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final.trim()) {
          const spoken = final.trim();
          setLiveTranscript(spoken);
          setInputText(spoken);
          setIsListening(false);
          // Tự động xử lý ngay khi người dùng nói xong!
          handleUserQuery(spoken);
        } else {
          setLiveTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Microphone Recognition Error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          const err = 'Trình duyệt chưa cho phép dùng Micro. Anh chị bấm Cho phép (Allow) Micro giúp em nhé!';
          setAssistantText(err);
          speak(err);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition init error:', e);
    }
  }, [speak]);

  // Bật/tắt Micro thu âm
  const toggleListening = () => {
    if (!recognitionRef.current) {
      const msg = 'Trình duyệt hiện tại chưa hỗ trợ nhận diện Micro Web Speech API.';
      setAssistantText(msg);
      speak(msg);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        recognitionRef.current.start();
        setIsListening(true);
        setLiveTranscript('Đang lắng nghe anh chị nói...');
      } catch (err) {
        console.warn('Cannot start recognition:', err);
      }
    }
  };

  // 6. Xử lý câu lệnh & phản hồi tự nhiên (qua Micro hoặc qua ô nhập)
  const handleUserQuery = async (queryStr: string) => {
    const query = queryStr.trim();
    if (!query) return;

    setInputText('');
    setLiveTranscript('');
    setSearchResults([]);

    const qLower = query.toLowerCase();

    // A. Lời chào xã giao tự nhiên
    if (qLower === 'chào' || qLower.startsWith('chào em') || qLower.startsWith('xin chào') || qLower === 'alo' || qLower.includes('bạn tên gì')) {
      const nameVoice = voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'chị Google';
      const msg = `Dạ, em chào anh chị! Em là trợ lý ảo giọng ${nameVoice} của tổ dân phố Quảng Giao. Anh chị cần em mở trang nào hay kiểm tra, sửa đổi nhân khẩu ai ạ?`;
      setAssistantText(msg);
      speak(msg);
      return;
    }

    // B. Điều hướng phân hệ
    if (qLower.includes('nhân khẩu') || qLower.includes('dân cư') || qLower.includes('cư dân') || qLower.includes('danh sách người')) {
      const msg = 'Dạ được rồi, em mở danh sách Nhân khẩu cho anh chị ngay đây ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('residents');
      return;
    }

    if (qLower.includes('hộ gia đình') || qLower.includes('danh sách hộ') || qLower.includes('sổ hộ')) {
      const msg = 'Dạ vâng, em chuyển ngay sang danh sách Hộ gia đình ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('households');
      return;
    }

    if (qLower.includes('thu chi') || qLower.includes('tiền quỹ') || qLower.includes('tài chính') || qLower.includes('ngân sách')) {
      const msg = 'Dạ, em mở trang Quản lý Thu chi của tổ dân phố cho anh chị kiểm tra ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('finance');
      return;
    }

    if (qLower.includes('quỹ phường') || qLower.includes('nộp phường') || qLower.includes('nghĩa vụ phường')) {
      const msg = 'Dạ vâng, em mở trang Quỹ nộp về phường ngay đây ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('ward-funds');
      return;
    }

    if (qLower.includes('mừng thọ') || qLower.includes('người cao tuổi') || qLower.includes('hội người cao tuổi')) {
      const msg = 'Dạ, em chuyển sang phần Hội Người cao tuổi và mừng thọ ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('elderly');
      return;
    }

    if (qLower.includes('bản đồ') || qLower.includes('map') || qLower.includes('địa lý')) {
      const msg = 'Dạ, em mở Bản đồ số dân cư tổ dân phố Quảng Giao ngay đây ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('map');
      return;
    }

    if (qLower.includes('đảng') || qLower.includes('chi bộ') || qLower.includes('đảng viên')) {
      const msg = 'Dạ vâng, em mở mục Chi bộ Đảng và danh sách Đảng viên ạ!';
      setAssistantText(msg);
      speak(msg);
      onNavigate('party-cell');
      return;
    }

    // C. Tra cứu nhân khẩu để xem hoặc sửa đổi thông tin
    try {
      const allResidents = await db.getResidents();
      const currentYear = new Date().getFullYear();

      // Nhận diện tìm theo tuổi (vd: "80 tuổi", "75 tuổi")
      const ageMatch = qLower.match(/(\d+)\s*tuổi/);
      // Nhận diện tìm theo năm sinh (vd: "năm sinh 1984", "1993")
      const yearMatch = qLower.match(/(?:sinh\s*năm|năm\s*sinh|sn)?\s*(\d{4})/);

      let found: Resident[] = [];

      if (ageMatch) {
        const targetAge = parseInt(ageMatch[1], 10);
        found = allResidents.filter(r => {
          if (!r.dob) return false;
          const y = parseInt(r.dob.slice(0, 4), 10);
          return (currentYear - y) === targetAge;
        });
      } else if (yearMatch && (yearMatch[1].startsWith('19') || yearMatch[1].startsWith('20'))) {
        const yStr = yearMatch[1];
        found = allResidents.filter(r => r.dob && r.dob.startsWith(yStr));
      } else {
        const cleanSearch = qLower
          .replace(/^tìm\s*(?:kiếm)?\s*/, '')
          .replace(/^kiểm\s*tra\s*/, '')
          .replace(/^sửa\s*(?:thông tin|tên|tuổi|cccd)?\s*/, '')
          .trim();

        found = allResidents.filter(r => {
          const mName = r.full_name && r.full_name.toLowerCase().includes(cleanSearch);
          const mCccd = r.cccd && r.cccd.replace(/\s+/g, '').includes(cleanSearch);
          return mName || mCccd;
        });
      }

      if (found.length > 0) {
        const top = found.slice(0, 5);
        setSearchResults(top);
        const reply = `Em đã tìm thấy ${found.length} nhân khẩu. Anh chị có thể xem chi tiết hoặc bấm nút Sửa để chỉnh sửa tên, tuổi, căn cước nhé!`;
        setAssistantText(reply);
        speak(`Em đã tìm thấy ${found.length} người. Anh chị có thể bấm nút Sửa để thay đổi thông tin nhé!`);
      } else {
        const reply = `Em chưa tìm thấy thông tin nào khớp với "${query}". Anh chị đọc lại tên hoặc số căn cước giúp em nhé!`;
        setAssistantText(reply);
        speak(reply);
      }
    } catch (e) {
      const err = 'Dạ có lỗi khi tra cứu dữ liệu, anh chị nói lại giúp em nhé!';
      setAssistantText(err);
      speak(err);
    }
  };

  // 7. Lưu thông tin nhân khẩu sau khi sửa
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

      setSearchResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      setEditingResident(null);

      const msg = `Em đã cập nhật thông tin cho ${updated.full_name} thành công vào hệ thống rồi ạ!`;
      setAssistantText(msg);
      speak(msg);
    } catch (err: any) {
      const msg = 'Lỗi lưu dữ liệu: ' + (err.message || 'vui lòng thử lại');
      setAssistantText(msg);
      speak('Lỗi lưu thông tin rồi ạ, anh chị kiểm tra lại nhé.');
    }
  };

  // 8. Đổi giọng nói và phát âm thử nghiệm
  const handleChangeVoice = (newV: VoiceOption) => {
    setVoiceType(newV);
    localStorage.setItem('assistant_voice_type', newV);

    let sample = '';
    if (newV === 'namminh') sample = 'Chào anh chị, tôi là trợ lý Nam Minh. Rất hân hạnh được hỗ trợ anh chị!';
    else if (newV === 'hoaimy') sample = 'Dạ em chào anh chị, em là Hoài My. Em sẵn sàng lắng nghe anh chị!';
    else sample = 'Xin chào bạn, tôi là trợ lý ảo giọng chị Google của tổ dân phố Quảng Giao.';

    setAssistantText(sample);
    speak(sample, newV);
  };

  if (!isVisible) {
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
          background: 'rgba(255, 255, 255, 0.96)',
          padding: '6px 14px 6px 6px',
          borderRadius: '999px',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.3)',
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
      {/* 1. BONG BÓNG LỜI THOẠI TRÒ CHUYỆN VỚI CÔ GÁI */}
      {isBubbleOpen && (
        <div 
          style={{
            maxWidth: '350px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(14px)',
            borderRadius: '22px',
            border: '2px solid #38bdf8',
            boxShadow: '0 18px 40px rgba(2, 132, 199, 0.28)',
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
            left: '50px',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '10px solid #38bdf8'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-7px',
            left: '51px',
            width: 0,
            height: 0,
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderTop: '9px solid #ffffff'
          }} />

          {/* Header chọn giọng nói và bật tắt micro */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.88rem' }}>Trợ lý Ảo</span>
              <Sparkles size={13} style={{ color: '#eab308' }} />
              {isSpeaking && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  borderRadius: '6px',
                  fontWeight: '700'
                }}>
                  Đang nói...
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {/* CHỌN GIỌNG NÓI: NAM MINH / HOÀI MY / CHỊ GOOGLE */}
              <select 
                value={voiceType} 
                onChange={(e) => handleChangeVoice(e.target.value as VoiceOption)}
                style={{
                  fontSize: '0.7rem',
                  padding: '3px 6px',
                  borderRadius: '8px',
                  border: '1.5px solid #38bdf8',
                  background: '#f0f9ff',
                  color: '#0369a1',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                title="Chọn giọng nói: Nam Minh, Hoài My, Chị Google"
              >
                <option value="namminh">👨 Giọng Nam Minh</option>
                <option value="hoaimy">👩 Giọng Hoài My</option>
                <option value="google">🌐 Giọng chị Google</option>
              </select>

              {/* Bật tắt âm thanh */}
              <button 
                onClick={() => {
                  const n = !voiceEnabled;
                  setVoiceEnabled(n);
                  localStorage.setItem('assistant_voice_enabled', String(n));
                  if (!n) {
                    if (audioPlayerRef.current) audioPlayerRef.current.pause();
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: voiceEnabled ? '#0284c7' : '#94a3b8', padding: '2px' }}
                title={voiceEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
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

          {/* NỘI DUNG LỜI THOẠI CỦA TRỢ LÝ */}
          <div style={{ lineHeight: '1.5', color: '#1e293b', marginBottom: '10px' }}>
            {assistantText}
          </div>

          {/* ĐANG NGHE QUA MICRO THỰC TẾ (Live Voice Feedback) */}
          {isListening && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px dashed #ef4444',
              borderRadius: '10px',
              padding: '8px 10px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'pulse 1.5s infinite'
            }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: '600' }}>
                {liveTranscript || '🎙️ Đang nghe anh chị nói... Hãy nói yêu cầu của bạn'}
              </div>
            </div>
          )}

          {/* BẢNG CHỈNH SỬA THÔNG TIN NHÂN KHẨU */}
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
                  placeholder="Ngày sinh (YYYY-MM-DD)"
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
                    <Check size={14} /> Lưu vào CSDL
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

          {/* DANH SÁCH KẾT QUẢ TÌM KIẾM CÓ SẴN NÚT SỬA */}
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

          {/* Ô NÓI CHUYỆN: TÍCH HỢP NÚT MICRO VÀ Ô GÕ PHÍM */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Nút Micro để nói chuyện trực tiếp */}
            <button
              onClick={toggleListening}
              style={{
                background: isListening ? '#ef4444' : '#f0f9ff',
                color: isListening ? '#ffffff' : '#0284c7',
                border: isListening ? '2px solid #dc2626' : '1.5px solid #38bdf8',
                borderRadius: '10px',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}
              title={isListening ? 'Bấm để dừng nghe' : 'Bấm micro để nói chuyện'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUserQuery(inputText);
              }}
              placeholder={isListening ? 'Đang lắng nghe bạn nói...' : 'Nói hoặc gõ yêu cầu...'}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
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
                borderRadius: '10px',
                width: '36px',
                height: '36px',
                cursor: inputText.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s'
              }}
              title="Gửi"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2. HÌNH TƯỢNG CÔ GÁI ĐỨNG MỘT MÌNH NỔI BẬT Ở GÓC DƯỚI BÊN TRÁI */}
      <div 
        onClick={() => {
          setIsBubbleOpen(true);
          const greetingText = voiceType === 'namminh' 
            ? 'Chào anh chị, Nam Minh đang lắng nghe đây ạ. Anh chị cần kiểm tra hay mở phân hệ nào?'
            : 'Dạ, em đang lắng nghe đây ạ. Anh chị cần kiểm tra hay sửa thông tin ai ạ?';
          setAssistantText(greetingText);
          speak(greetingText);
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
        title="Bấm vào để nói chuyện với trợ lý!"
      >
        {/* Nút nhỏ đóng hẳn */}
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

        {/* Ảnh nhân vật cô gái đã tách nền trong suốt */}
        <div style={{ position: 'relative', width: '130px', height: '175px' }}>
          <img 
            src={transparentImg} 
            alt="Cô gái Trợ lý Ảo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: isSpeaking 
                ? 'drop-shadow(0 8px 16px rgba(2, 132, 199, 0.6))' 
                : isListening 
                  ? 'drop-shadow(0 8px 16px rgba(239, 68, 68, 0.6))'
                  : 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.18))',
              transition: 'filter 0.3s'
            }} 
          />
        </div>

        {/* Nhãn nhỏ dưới chân */}
        <div style={{
          marginTop: '-6px',
          background: isListening 
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
            : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: 'white',
          padding: '2px 10px',
          borderRadius: '999px',
          fontSize: '0.68rem',
          fontWeight: '700',
          boxShadow: '0 4px 10px rgba(2, 132, 199, 0.35)',
          border: '1.5px solid rgba(255, 255, 255, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          {isListening ? (
            <>
              <Radio size={10} className="pulse" />
              <span>Đang nghe...</span>
            </>
          ) : (
            <>
              <span>{voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'Trợ lý Ảo'}</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
            </>
          )}
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
