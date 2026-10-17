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
  Radio,
  RadioTower
} from 'lucide-react';
import { db } from '../services/db';
import type { Resident } from '../types';

interface VirtualAssistantProps {
  isSidebarOpen: boolean;
  onNavigate: (tabId: string) => void;
  userRole?: string;
}

export type VoiceOption = 'namminh' | 'hoaimy' | 'google';

export const VirtualAssistant: React.FC<VirtualAssistantProps> = ({
  isSidebarOpen,
  onNavigate
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isBubbleOpen, setIsBubbleOpen] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAutoHandsFree, setIsAutoHandsFree] = useState<boolean>(() => {
    return localStorage.getItem('assistant_autohandsfree') !== 'false';
  });
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
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
  const isSpeakingRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const isAutoHandsFreeRef = useRef<boolean>(isAutoHandsFree);

  isSpeakingRef.current = isSpeaking;
  isListeningRef.current = isListening;
  isAutoHandsFreeRef.current = isAutoHandsFree;

  // 1. Tách nền ảnh tự động
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

  // 2. Tự động khởi động lại Micro khi rảnh tay
  const startListeningSafely = useCallback(() => {
    if (!isAutoHandsFreeRef.current || isSpeakingRef.current) return;
    try {
      if (recognitionRef.current && !isListeningRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      // Đã start hoặc đang chờ
    }
  }, []);

  const stopListeningSafely = useCallback(() => {
    try {
      if (recognitionRef.current && isListeningRef.current) {
        recognitionRef.current.abort();
      }
    } catch (e) {}
  }, []);

  // 3. HÀM PHÁT ÂM TIẾNG VIỆT 100% CHUẨN (KHÔNG BAO GIỜ BỊ RƠI VÀO TIẾNG ANH!)
  const speakVietnameseAudio = useCallback((textToSpeak: string, chosenVoice?: VoiceOption) => {
    if (!voiceEnabled) {
      if (isAutoHandsFreeRef.current) {
        setTimeout(startListeningSafely, 300);
      }
      return;
    }

    const currentVoice = chosenVoice || voiceType;
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // Ngắt micro khi bắt đầu nói để tránh micro thu lại tiếng của trợ lý
    stopListeningSafely();

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const onFinish = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      // Trợ lý nói xong -> tự động bật lại micro để lắng nghe người dùng
      if (isAutoHandsFreeRef.current) {
        setTimeout(startListeningSafely, 500);
      }
    };

    // Kiểm tra xem trình duyệt có giọng tiếng Việt thực sự hay không (vi-VN)
    let hasViSpeechVoice = false;
    let viVoiceObj: SpeechSynthesisVoice | undefined;
    if ('speechSynthesis' in window) {
      const allVoices = window.speechSynthesis.getVoices();
      viVoiceObj = allVoices.find(v => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn'));
      if (viVoiceObj) {
        hasViSpeechVoice = true;
      }
    }

    // NẾU CÓ GIỌNG TIẾNG VIỆT THỰC SỰ TRONG WINDOWS (vd: Hoài My, Nam Minh đã cài):
    if (hasViSpeechVoice && viVoiceObj && currentVoice !== 'google') {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.voice = viVoiceObj;
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = currentVoice === 'namminh' ? 0.9 : 1.1;
      utterance.onend = onFinish;
      utterance.onerror = onFinish;
      window.speechSynthesis.speak(utterance);
      return;
    }

    // NẾU MÁY CHƯA CÀI GÓI TIẾNG VIỆT (Chỉ có Microsoft David tiếng Anh):
    // => DÙNG 100% GOOGLE VIETNAMESE TTS AUDIO! ĐẢM BẢO 100% TIẾNG VIỆT CHUẨN, TUYỆT ĐỐI KHÔNG BỊ TIẾNG ANH!
    try {
      const cleanText = textToSpeak.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=vi&client=tw-ob`;

      const audio = new Audio(ttsUrl);
      audioPlayerRef.current = audio;

      // Giả lập giọng Nam Minh (trầm ấm hơn) hoặc Hoài My (trong trẻo hơn) bằng tốc độ phát
      if (currentVoice === 'namminh') {
        audio.playbackRate = 0.92; // Trầm và điềm đạm hơn
      } else if (currentVoice === 'hoaimy') {
        audio.playbackRate = 1.05; // Nhanh và trong trẻo
      } else {
        audio.playbackRate = 1.0;
      }

      audio.onplay = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      };
      audio.onended = onFinish;
      audio.onerror = () => {
        onFinish();
      };

      audio.play().catch(() => {
        onFinish();
      });
    } catch (e) {
      onFinish();
    }
  }, [voiceEnabled, voiceType, startListeningSafely, stopListeningSafely]);

  // 4. Lời chào ban đầu
  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreet = 'Chào buổi sáng anh chị!';
    if (hour >= 11 && hour < 14) timeGreet = 'Chào buổi trưa anh chị!';
    else if (hour >= 14 && hour < 18) timeGreet = 'Chào buổi chiều anh chị!';
    else if (hour >= 18) timeGreet = 'Chào buổi tối anh chị!';

    const greeting = `${timeGreet} Em là trợ lý ảo tổ dân phố Quảng Giao. Chế độ đàm thoại tự động đang bật, anh chị cứ nói tự nhiên không cần bấm nút: mở phần nào, tìm kiểm tra nhân khẩu, tên, tuổi, số căn cước để em phục vụ ngay nhé!`;
    setAssistantText(greeting);
  }, []);

  // 5. Khởi tạo SpeechRecognition liên tục tự động
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
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
          isListeningRef.current = false;
          // Xử lý câu nói ngay
          handleUserQuery(spoken);
        } else {
          setLiveTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        // Tự động lắng nghe lại nếu rảnh tay
        if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
              startListeningSafely();
            }
          }, 350);
        }
      };

      recognitionRef.current = recognition;

      // Bắt đầu lắng nghe sau khi giao diện sẵn sàng
      if (isAutoHandsFreeRef.current) {
        setTimeout(() => {
          startListeningSafely();
        }, 1000);
      }
    } catch (e) {
      console.warn('SpeechRecognition error:', e);
    }

    return () => {
      try {
        if (recognitionRef.current) recognitionRef.current.abort();
      } catch {}
    };
  }, [startListeningSafely]);

  // 6. XỬ LÝ LỜI NÓI & RA LỆNH THÔNG MINH
  const handleUserQuery = async (queryStr: string) => {
    const query = queryStr.trim();
    if (!query) return;

    setInputText('');
    setLiveTranscript('');
    setSearchResults([]);

    const qLower = query.toLowerCase();

    // A. Xử lý mở QUỸ NỘP PHƯỜNG (Bắt trọn mọi cách nói: "quỹ nộp phường", "quỹ phường", "chuyển xuống phần quỹ", "nộp phường"...)
    if (
      qLower.includes('quỹ nộp phường') ||
      qLower.includes('nộp phường') ||
      qLower.includes('quỹ phường') ||
      (qLower.includes('chuyển xuống') && (qLower.includes('quỹ') || qLower.includes('phường'))) ||
      (qLower.includes('mở') && (qLower.includes('quỹ') || qLower.includes('phường'))) ||
      qLower.includes('phần quỹ nộp phường') ||
      qLower.includes('tiền nộp phường') ||
      qLower.includes('nghĩa vụ phường')
    ) {
      const reply = 'Dạ vâng! Em chuyển ngay xuống phần Quỹ nộp phường cho anh chị đây ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);

      // Chuyển trang và cuộn mượt lên trên
      onNavigate('ward-funds');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Nếu đang trong trang Thu chi mà có section quỹ phường, cuộn tới đó
      setTimeout(() => {
        const el = document.getElementById('ward-funds-section') || document.querySelector('.ward-funds-container');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      return;
    }

    // B. Xử lý mở THU CHI TDP
    if (
      (qLower.includes('thu chi') || qLower.includes('tiền quỹ tdp') || qLower.includes('tài chính') || qLower.includes('sổ quỹ')) &&
      !qLower.includes('phường')
    ) {
      const reply = 'Dạ, em mở trang Quản lý Thu chi của tổ dân phố ngay đây ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('finance');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // C. Xử lý mở NHÂN KHẨU
    if (qLower.includes('nhân khẩu') || qLower.includes('dân cư') || qLower.includes('danh sách người') || qLower.includes('cư dân')) {
      const reply = 'Dạ, em mở danh sách Nhân khẩu cho anh chị kiểm tra ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('residents');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // D. Xử lý mở HỘ GIA ĐÌNH
    if (qLower.includes('hộ gia đình') || qLower.includes('danh sách hộ') || qLower.includes('sổ hộ')) {
      const reply = 'Dạ, em mở danh sách Hộ gia đình cho anh chị ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('households');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // E. Xử lý mở BẢN ĐỒ SỐ
    if (qLower.includes('bản đồ') || qLower.includes('map') || qLower.includes('vị trí')) {
      const reply = 'Dạ, em mở Bản đồ số dân cư tổ dân phố Quảng Giao ngay đây ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('map');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // F. Xử lý mở MỪNG THỌ / NGƯỜI CAO TUỔI
    if (qLower.includes('mừng thọ') || qLower.includes('người cao tuổi') || qLower.includes('hội viên cao tuổi')) {
      const reply = 'Dạ, em chuyển sang phần Hội Người cao tuổi và mừng thọ ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('elderly');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // G. Xử lý mở CHI BỘ ĐẢNG
    if (qLower.includes('chi bộ') || qLower.includes('đảng viên') || qLower.includes('đảng')) {
      const reply = 'Dạ, em mở mục Chi bộ Đảng và danh sách Đảng viên ạ!';
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      onNavigate('party-cell');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // H. Lời chào hỏi & xã giao
    if (
      qLower === 'chào' || 
      qLower.includes('xin chào') || 
      qLower.includes('chào em') || 
      qLower.includes('chào bạn') || 
      qLower === 'alo' || 
      qLower.includes('em ơi')
    ) {
      const voiceName = voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'chị Google';
      const reply = `Dạ, em chào anh chị! Em là trợ lý giọng ${voiceName}. Em đang lắng nghe đây, anh chị cần em mở phần nào hay tra cứu nhân khẩu ai ạ?`;
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      return;
    }

    if (qLower.includes('tên gì') || qLower.includes('là ai')) {
      const voiceName = voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'chị Google';
      const reply = `Dạ em là trợ lý giọng ${voiceName} của tổ dân phố Quảng Giao. Em có thể giúp anh chị mở trang, kiểm tra và sửa thông tin nhân khẩu ạ!`;
      setAssistantText(reply);
      speakVietnameseAudio(reply);
      return;
    }

    // I. Thống kê số lượng
    if (qLower.includes('bao nhiêu người') || qLower.includes('bao nhiêu nhân khẩu')) {
      try {
        const residents = await db.getResidents();
        const reply = `Dạ báo cáo anh chị, hiện tại tổ dân phố Quảng Giao đang quản lý ${residents.length} nhân khẩu ạ!`;
        setAssistantText(reply);
        speakVietnameseAudio(reply);
        return;
      } catch (e) {}
    }

    if (qLower.includes('bao nhiêu hộ')) {
      try {
        const households = await db.getHouseholds();
        const reply = `Dạ hiện tại trên địa bàn tổ dân phố có tổng cộng ${households.length} hộ gia đình ạ!`;
        setAssistantText(reply);
        speakVietnameseAudio(reply);
        return;
      } catch (e) {}
    }

    // J. Tra cứu nhân khẩu theo tên, tuổi, CCCD
    try {
      const allResidents = await db.getResidents();
      const currentYear = new Date().getFullYear();

      const ageMatch = qLower.match(/(\d+)\s*tuổi/);
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
        const reply = `Em đã tìm thấy ${found.length} nhân khẩu. Anh chị có thể xem chi tiết hoặc bấm nút Sửa để chỉnh sửa thông tin nhé!`;
        setAssistantText(reply);
        speakVietnameseAudio(`Em đã tìm thấy ${found.length} người. Anh chị có thể bấm nút Sửa để thay đổi thông tin nhé!`);
      } else {
        const reply = `Em đã nghe rõ "${query}". Anh chị muốn em mở phần nào hay tìm kiếm theo tên, năm sinh ai ạ?`;
        setAssistantText(reply);
        speakVietnameseAudio(reply);
      }
    } catch (e) {
      const err = 'Dạ em chưa nghe rõ lắm, anh chị nói lại giúp em nhé!';
      setAssistantText(err);
      speakVietnameseAudio(err);
    }
  };

  // 7. Lưu sửa thông tin nhân khẩu
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

      const msg = `Em đã cập nhật thông tin cho ${updated.full_name} thành công rồi ạ!`;
      setAssistantText(msg);
      speakVietnameseAudio(msg);
    } catch (err: any) {
      const msg = 'Lỗi lưu dữ liệu: ' + (err.message || 'vui lòng thử lại');
      setAssistantText(msg);
      speakVietnameseAudio('Lỗi lưu thông tin rồi ạ, anh chị kiểm tra lại nhé.');
    }
  };

  // 8. Đổi giọng nói
  const handleChangeVoice = (newV: VoiceOption) => {
    setVoiceType(newV);
    localStorage.setItem('assistant_voice_type', newV);

    let sample = '';
    if (newV === 'namminh') sample = 'Chào anh chị, Nam Minh đã sẵn sàng đồng hành cùng anh chị!';
    else if (newV === 'hoaimy') sample = 'Dạ em là Hoài My, em đã sẵn sàng phục vụ anh chị!';
    else sample = 'Xin chào bạn, tôi là trợ lý ảo giọng chị Google của tổ dân phố Quảng Giao.';

    setAssistantText(sample);
    speakVietnameseAudio(sample, newV);
  };

  const toggleAutoHandsFree = () => {
    const nextVal = !isAutoHandsFree;
    setIsAutoHandsFree(nextVal);
    isAutoHandsFreeRef.current = nextVal;
    localStorage.setItem('assistant_autohandsfree', String(nextVal));

    if (nextVal) {
      const msg = 'Đã bật đàm thoại tự động rảnh tay. Anh chị cứ nói tự nhiên không cần bấm nút nữa nhé!';
      setAssistantText(msg);
      speakVietnameseAudio(msg);
      setTimeout(startListeningSafely, 1000);
    } else {
      const msg = 'Đã tắt đàm thoại tự động rảnh tay.';
      setAssistantText(msg);
      speakVietnameseAudio(msg);
      stopListeningSafely();
    }
  };

  if (!isVisible) {
    return (
      <div 
        onClick={() => { 
          setIsVisible(true); 
          setIsBubbleOpen(true); 
          speakVietnameseAudio('Em đang lắng nghe đây ạ. Anh chị cứ nói tự nhiên nhé!');
        }}
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
      {/* 1. BONG BÓNG LỜI THOẠI TRÒ CHUYỆN */}
      {isBubbleOpen && (
        <div 
          style={{
            maxWidth: '360px',
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

          {/* Header chọn giọng nói và đàm thoại tự động */}
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
                  Đang trả lời...
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {/* CHỌN GIỌNG NÓI */}
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
                <option value="namminh">👨 Nam Minh</option>
                <option value="hoaimy">👩 Hoài My</option>
                <option value="google">🌐 Chị Google</option>
              </select>

              {/* Bật/tắt Đàm thoại tự động */}
              <button 
                onClick={toggleAutoHandsFree}
                style={{
                  background: isAutoHandsFree ? '#dbeafe' : '#f1f5f9',
                  border: isAutoHandsFree ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  color: isAutoHandsFree ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={isAutoHandsFree ? 'Đang bật đàm thoại tự động (nói tự do không cần bấm nút)' : 'Bấm để bật đàm thoại rảnh tay'}
              >
                <RadioTower size={12} />
                <span>{isAutoHandsFree ? 'Tự động' : 'Thủ công'}</span>
              </button>

              {/* Bật/tắt âm thanh */}
              <button 
                onClick={() => {
                  const n = !voiceEnabled;
                  setVoiceEnabled(n);
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

          {/* LỜI THOẠI CỦA TRỢ LÝ */}
          <div style={{ lineHeight: '1.5', color: '#1e293b', marginBottom: '10px' }}>
            {assistantText}
          </div>

          {/* TRẠNG THÁI ĐANG LẮNG NGHE TỰ ĐỘNG QUA MICRO */}
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
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: '600', flex: 1 }}>
                {liveTranscript || '🎙️ Đang lắng nghe anh chị nói... (Hãy nói yêu cầu)'}
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

          {/* KẾT QUẢ TÌM KIẾM CÓ SẴN NÚT SỬA */}
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

          {/* Ô NÓI CHUYỆN & GÕ PHÍM */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{
              background: isListening ? '#fef2f2' : '#f0f9ff',
              border: isListening ? '1.5px solid #ef4444' : '1.5px solid #38bdf8',
              borderRadius: '10px',
              padding: '0 8px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: 1
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isListening ? '#ef4444' : '#0284c7',
                display: 'inline-block'
              }} />
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUserQuery(inputText);
                }}
                placeholder={isListening ? 'Đang tự động nghe... Bạn cứ nói' : 'Nói hoặc gõ yêu cầu...'}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.78rem',
                  flex: 1,
                  color: '#1e293b'
                }}
              />
            </div>

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
            ? 'Chào anh chị, Nam Minh đang lắng nghe đây ạ. Anh chị cứ nói tự nhiên em phục vụ ngay!'
            : 'Dạ em đang lắng nghe đây ạ. Anh chị cứ nói tự nhiên em phục vụ ngay nhé!';
          setAssistantText(greetingText);
          speakVietnameseAudio(greetingText);
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
        {/* Nút tạm ẩn */}
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

        {/* Nhãn nhỏ dưới chân cô gái */}
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
              <span>Đang nghe tự động...</span>
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
