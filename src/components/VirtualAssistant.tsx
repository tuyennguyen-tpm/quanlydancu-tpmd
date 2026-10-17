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
  RadioTower,
  Play
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
  const [assistantText, setAssistantText] = useState('');
  const [needsUserTapToPlay, setNeedsUserTapToPlay] = useState(false);
  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [editFormData, setEditFormData] = useState<{ full_name: string; dob: string; cccd: string; phone: string }>({
    full_name: '',
    dob: '',
    cccd: '',
    phone: ''
  });

  // 3 khung hình hoạt họa cử động như người thật:
  // - wave: Chào đón ban đầu, vẫy tay
  // - talk: Mở miệng nói chuyện, cử chỉ hai tay biểu cảm
  // - listen: Khép miệng mỉm cười lắng nghe, tay đặt lên ngực lịch sự
  const [frames, setFrames] = useState<{ wave: string; talk: string; listen: string }>({
    wave: '/assistant-girl-wave.jpg',
    talk: '/assistant-girl-talk.jpg',
    listen: '/assistant-girl-listen.jpg'
  });
  const [speakingTick, setSpeakingTick] = useState<number>(0);
  const [showCaption, setShowCaption] = useState<boolean>(true);
  const captionTimerRef = useRef<any>(null);

  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const isAutoHandsFreeRef = useRef<boolean>(isAutoHandsFree);

  isSpeakingRef.current = isSpeaking;
  isListeningRef.current = isListening;
  isAutoHandsFreeRef.current = isAutoHandsFree;

  // Chu kỳ nhấp nhô khẩu hình & cử chỉ tay khi nói chuyện (220ms mô phỏng nhịp phát âm tự nhiên)
  useEffect(() => {
    if (!isSpeaking) {
      setSpeakingTick(0);
      return;
    }
    const timer = setInterval(() => {
      setSpeakingTick(prev => (prev + 1) % 6);
    }, 220);
    return () => clearInterval(timer);
  }, [isSpeaking]);

  // Quản lý hiển thị phụ đề nổi nhỏ gọn, tự ẩn sau 4.5 giây khi trợ lý nói xong
  useEffect(() => {
    if (isSpeaking) {
      setShowCaption(true);
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    } else {
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
      captionTimerRef.current = setTimeout(() => {
        setShowCaption(false);
      }, 4500);
    }
    return () => {
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    };
  }, [isSpeaking, assistantText]);

  // 1. Tách nền ảnh tự động cho cả 3 khung hình bằng Canvas
  useEffect(() => {
    const processImage = (src: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(src);
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              if (r > 240 && g > 240 && b > 240) {
                data[i + 3] = 0;
              } else if (r > 215 && g > 215 && b > 215) {
                data[i + 3] = Math.max(0, 255 - (r - 215) * 10);
              }
            }
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            resolve(src);
          }
        };
        img.onerror = () => resolve(src);
      });
    };

    Promise.all([
      processImage('/assistant-girl-wave.jpg'),
      processImage('/assistant-girl-talk.jpg'),
      processImage('/assistant-girl-listen.jpg')
    ]).then(([w, t, l]) => {
      setFrames({ wave: w, talk: t, listen: l });
    });
  }, []);

  // 2. Tự động khởi động lại Micro khi rảnh tay
  const startListeningSafely = useCallback(() => {
    if (!isAutoHandsFreeRef.current || isSpeakingRef.current) return;
    try {
      if (recognitionRef.current && !isListeningRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {}
  }, []);

  const stopListeningSafely = useCallback(() => {
    try {
      if (recognitionRef.current && isListeningRef.current) {
        recognitionRef.current.abort();
      }
    } catch (e) {}
  }, []);

  // Quản lý danh sách giọng nói của trình duyệt (hỗ trợ Edge Natural Nam Minh & Hoài My)
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const vList = window.speechSynthesis.getVoices();
        if (vList && vList.length > 0) {
          setBrowserVoices(vList);
        }
      }
    };
    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Phát trực tiếp qua Google TTS bằng thẻ Audio HTML5 (không dùng fetch để tránh chặn CORS)
  const playViaGoogleAudio = useCallback((textToSpeak: string, currentVoice: VoiceOption, onFinish: () => void) => {
    const sentences = textToSpeak.match(/[^.,!?;:]+[.,!?;:]*/g) || [textToSpeak];
    const chunks: string[] = [];
    let currentChunk = '';
    for (const s of sentences) {
      if ((currentChunk + ' ' + s).length <= 130) {
        currentChunk += (currentChunk ? ' ' : '') + s.trim();
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = s.trim();
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    if (chunks.length === 0) chunks.push(textToSpeak.slice(0, 130));

    let chunkIdx = 0;
    const playNext = () => {
      if (chunkIdx >= chunks.length) {
        onFinish();
        return;
      }

      const text = chunks[chunkIdx++];
      if (!text || !text.trim()) {
        playNext();
        return;
      }

      const encoded = encodeURIComponent(text.trim());
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;
      const audio = new Audio();
      audio.src = ttsUrl;
      audioPlayerRef.current = audio;

      if (currentVoice === 'namminh') {
        audio.playbackRate = 0.92;
      } else if (currentVoice === 'hoaimy') {
        audio.playbackRate = 1.05;
      } else {
        audio.playbackRate = 1.0;
      }

      audio.onplay = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        setNeedsUserTapToPlay(false);
      };

      audio.onended = () => {
        playNext();
      };

      audio.onerror = () => {
        const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=gtx`;
        const fbAudio = new Audio(fallbackUrl);
        audioPlayerRef.current = fbAudio;
        fbAudio.onended = () => playNext();
        fbAudio.onerror = () => playNext();
        fbAudio.play().catch(() => playNext());
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[Trình duyệt chặn phát âm thanh tự động]', err);
          setNeedsUserTapToPlay(true);
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        });
      }
    };

    playNext();
  }, []);

  // 3. HÀM PHÁT ÂM TIẾNG VIỆT 100% CHUẨN XÁC
  const speakVietnameseAudio = useCallback(async (textToSpeak: string, chosenVoice?: VoiceOption) => {
    if (!voiceEnabled) {
      if (isAutoHandsFreeRef.current) {
        setTimeout(startListeningSafely, 300);
      }
      return;
    }

    const currentVoice = chosenVoice || voiceType;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setShowCaption(true);

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
      if (isAutoHandsFreeRef.current) {
        setTimeout(startListeningSafely, 500);
      }
    };

    // 1. Kiểm tra xem máy/trình duyệt có giọng tiếng Việt thực sự hay không (Microsoft Edge có sẵn Nam Minh và Hoài My cực chuẩn)
    let viVoiceObj: SpeechSynthesisVoice | undefined;
    if ('speechSynthesis' in window) {
      const allVoices = window.speechSynthesis.getVoices();
      if (currentVoice === 'namminh') {
        viVoiceObj = allVoices.find(v => (v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn')) && v.name.toLowerCase().includes('namminh'))
          || allVoices.find(v => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn'));
      } else if (currentVoice === 'hoaimy') {
        viVoiceObj = allVoices.find(v => (v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn')) && v.name.toLowerCase().includes('hoaimy'))
          || allVoices.find(v => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn'));
      } else {
        viVoiceObj = allVoices.find(v => v.lang.toLowerCase().includes('vi') || v.lang.toLowerCase().includes('vn'));
      }
    }

    if (viVoiceObj && currentVoice !== 'google') {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.voice = viVoiceObj;
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = currentVoice === 'namminh' ? 0.9 : 1.1;
      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        setNeedsUserTapToPlay(false);
      };
      utterance.onend = onFinish;
      utterance.onerror = () => {
        playViaGoogleAudio(textToSpeak, currentVoice, onFinish);
      };
      window.speechSynthesis.speak(utterance);
      return;
    }

    playViaGoogleAudio(textToSpeak, currentVoice, onFinish);
  }, [voiceEnabled, voiceType, startListeningSafely, stopListeningSafely, playViaGoogleAudio]);

  // Tự động mở khóa Autoplay ngay khi người dùng click/gõ phím bất kỳ chỗ nào trên ứng dụng
  useEffect(() => {
    const handleFirstGesture = () => {
      if (needsUserTapToPlay) {
        setNeedsUserTapToPlay(false);
        const greeting = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
        speakVietnameseAudio(greeting);
      }
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [needsUserTapToPlay, speakVietnameseAudio]);

  // 4. Lời chào ban đầu
  useEffect(() => {
    const greeting = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
    setAssistantText(greeting);

    const t = setTimeout(() => {
      speakVietnameseAudio(greeting);
    }, 700);

    return () => clearTimeout(t);
  }, [speakVietnameseAudio]);


  // 5. Khởi tạo SpeechRecognition tự động
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
        isListeningRef.current = true;
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(currentTranscript);

        if (event.results[0].isFinal) {
          const finalQuery = currentTranscript.trim();
          setLiveTranscript('');
          if (finalQuery.length > 1) {
            handleUserQuery(finalQuery);
          }
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        isListeningRef.current = false;
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[Micro Error]', event.error);
        }
        if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
          setTimeout(startListeningSafely, 1200);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
          setTimeout(startListeningSafely, 600);
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  // 6. Xử lý câu lệnh đàm thoại thông minh
  const handleUserQuery = async (query: string) => {
    if (!query.trim()) return;

    const qLower = query.toLowerCase().trim();
    setSearchResults([]);
    setEditingResident(null);

    // 1. LỆNH ĐIỀU HƯỚNG QUỸ PHƯỜNG
    if (
      qLower.includes('quỹ nộp phường') ||
      qLower.includes('quỹ phường') ||
      qLower.includes('nộp phường') ||
      (qLower.includes('chuyển') && (qLower.includes('phường') || qLower.includes('quỹ'))) ||
      (qLower.includes('mở') && qLower.includes('quỹ') && qLower.includes('phường'))
    ) {
      const resp = 'Dạ, em mở quỹ nộp phường ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('ward-funds');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
      return;
    }

    // 2. LỆNH ĐIỀU HƯỚNG QUỸ TỔ DÂN PHỐ / TÀI CHÍNH / THU CHI
    if (
      qLower.includes('quỹ tổ dân phố') ||
      qLower.includes('quỹ tdp') ||
      qLower.includes('quỹ thu') ||
      qLower.includes('tài chính') ||
      qLower.includes('thu chi') ||
      (qLower.includes('quỹ') && !qLower.includes('phường'))
    ) {
      const resp = 'Dạ, em mở quỹ tổ dân phố ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('finance');
      return;
    }

    // 3. LỆNH ĐIỀU HƯỚNG DÂN CƯ & HỘ KHẨU
    if (
      qLower.includes('dân cư') ||
      qLower.includes('hộ khẩu') ||
      qLower.includes('nhân khẩu') ||
      qLower.includes('sổ hộ khẩu') ||
      qLower.includes('danh sách nhân khẩu')
    ) {
      const resp = 'Dạ, em mở danh sách nhân khẩu ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('residents');
      return;
    }

    // 4. LỆNH ĐIỀU HƯỚNG CHI BỘ ĐẢNG
    if (
      qLower.includes('chi bộ') ||
      qLower.includes('đảng viên') ||
      qLower.includes('đảng')
    ) {
      const resp = 'Dạ, em mở mục chi bộ Đảng ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('party');
      return;
    }

    // 5. LỆNH ĐIỀU HƯỚNG HỌP TỔ DÂN PHỐ
    if (
      qLower.includes('họp tổ') ||
      qLower.includes('cuộc họp') ||
      qLower.includes('biên bản họp') ||
      qLower.includes('sổ họp')
    ) {
      const resp = 'Dạ, em mở sổ họp tổ dân phố ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('meetings');
      return;
    }

    // 6. LỆNH ĐIỀU HƯỚNG AN NINH TRẬT TỰ / TỔ LIÊN GIA
    if (
      qLower.includes('an ninh') ||
      qLower.includes('tổ liên gia') ||
      qLower.includes('trật tự')
    ) {
      const resp = 'Dạ, em mở mục an ninh trật tự ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('security');
      return;
    }

    // 7. LỆNH ĐIỀU HƯỚNG HỘI PHỤ NỮ
    if (qLower.includes('phụ nữ') || qLower.includes('hội phụ nữ')) {
      const resp = 'Dạ, em mở hội phụ nữ ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('women-association');
      return;
    }

    // 8. LỆNH ĐIỀU HƯỚNG ĐOÀN THANH NIÊN
    if (qLower.includes('thanh niên') || qLower.includes('đoàn thanh niên')) {
      const resp = 'Dạ, em mở đoàn thanh niên ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('youth-union');
      return;
    }

    // 9. LỆNH ĐIỀU HƯỚNG HỘI NÔNG DÂN
    if (qLower.includes('nông dân') || qLower.includes('hội nông dân')) {
      const resp = 'Dạ, em mở hội nông dân ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('farmers-association');
      return;
    }

    // 10. LỆNH ĐIỀU HƯỚNG CỰU CHIẾN BINH / NGƯỜI CAO TUỔI
    if (
      qLower.includes('người cao tuổi') ||
      qLower.includes('cựu chiến binh') ||
      qLower.includes('ccb')
    ) {
      const resp = 'Dạ, em mở hội cựu chiến binh và người cao tuổi ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('veterans-elderly');
      return;
    }

    // 11. LỆNH ĐIỀU HƯỚNG THEO DÕI SỨC KHỎE Y TẾ
    if (qLower.includes('sức khỏe') || qLower.includes('y tế')) {
      const resp = 'Dạ, em mở mục sức khỏe y tế ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('health');
      return;
    }

    // 12. LỆNH ĐIỀU HƯỚNG BẢN ĐỒ SỐ
    if (qLower.includes('bản đồ') || qLower.includes('bản đồ số') || qLower.includes('vị trí')) {
      const resp = 'Dạ, em mở bản đồ số dân cư ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('map');
      return;
    }

    // 13. LỆNH ĐIỀU HƯỚNG CHÍNH SÁCH XÃ HỘI / HỘ NGHÈO
    if (qLower.includes('chính sách') || qLower.includes('hộ nghèo') || qLower.includes('cận nghèo')) {
      const resp = 'Dạ, em mở chính sách xã hội ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('policies');
      return;
    }

    // 14. LỆNH ĐIỀU HƯỚNG TRANG CHỦ / TỔNG QUAN
    if (qLower.includes('trang chủ') || qLower.includes('tổng quan') || qLower.includes('bảng tin')) {
      const resp = 'Dạ, em về trang chủ ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('dashboard');
      return;
    }

    // 15. LỆNH ĐỔI GIỌNG NÓI TRỰC TIẾP QUA GIỌNG NÓI
    if (qLower.includes('giọng nam minh') || qLower.includes('đổi giọng nam')) {
      handleChangeVoice('namminh');
      return;
    }
    if (qLower.includes('giọng hoài my') || qLower.includes('đổi giọng nữ')) {
      handleChangeVoice('hoaimy');
      return;
    }
    if (qLower.includes('giọng google') || qLower.includes('chị google')) {
      handleChangeVoice('google');
      return;
    }

    // 16. LỆNH TÌM KIẾM & TRA CỨU NHÂN KHẨU / CCCD
    if (
      qLower.includes('tìm') || 
      qLower.includes('kiểm tra') || 
      qLower.includes('tra cứu') || 
      qLower.includes('ai tên') ||
      qLower.includes('cccd') ||
      qLower.includes('căn cước')
    ) {
      let searchTerm = qLower
        .replace(/tìm kiếm/g, '')
        .replace(/tìm hộ/g, '')
        .replace(/tìm/g, '')
        .replace(/kiểm tra nhân khẩu/g, '')
        .replace(/kiểm tra thông tin/g, '')
        .replace(/kiểm tra/g, '')
        .replace(/tra cứu/g, '')
        .replace(/ai tên là/g, '')
        .replace(/ai tên/g, '')
        .replace(/người tên/g, '')
        .replace(/cho tôi/g, '')
        .replace(/xem/g, '')
        .trim();

      if (searchTerm.length >= 2) {
        try {
          const residents = await db.getResidents();
          const matched = residents.filter((r: Resident) => {
            const nameMatch = r.full_name?.toLowerCase().includes(searchTerm);
            const cccdMatch = r.cccd?.includes(searchTerm);
            const dobMatch = r.dob?.includes(searchTerm);
            return nameMatch || cccdMatch || dobMatch;
          });

          if (matched.length > 0) {
            setSearchResults(matched.slice(0, 5));
            const first = matched[0];
            const resp = `Dạ, em tìm thấy ${first.full_name}, sinh ngày ${first.dob || 'chưa rõ'}, số CCCD là ${first.cccd || 'chưa có'}.`;
            setAssistantText(resp);
            speakVietnameseAudio(resp);
            return;
          } else {
            const resp = `Dạ, em chưa tìm thấy ai khớp với từ khóa "${searchTerm}" ạ!`;
            setAssistantText(resp);
            speakVietnameseAudio(resp);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    // LỜI THOẠI THÔNG THƯỜNG / CHÀO HỎI
    if (qLower.includes('chào') || qLower.includes('alo') || qLower.includes('ơi')) {
      const resp = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    // LỆNH MẶC ĐỊNH - NGẮN GỌN, KHÔNG NÓI DÀI DÒNG
    const defaultResp = 'Dạ, em đang lắng nghe đây ạ!';
    setAssistantText(defaultResp);
    speakVietnameseAudio(defaultResp);
  };


  // 7. Lưu chỉnh sửa nhân khẩu trực tiếp vào CSDL Supabase
  const handleSaveEdit = async () => {
    if (!editingResident) return;
    try {
      await db.saveResident({
        ...editingResident,
        full_name: editFormData.full_name.trim(),
        dob: editFormData.dob.trim(),
        cccd: editFormData.cccd.trim(),
        phone: editFormData.phone.trim()
      });

      const successMsg = `Đã cập nhật thành công thông tin cho nhân khẩu ${editFormData.full_name}. Số căn cước mới là ${editFormData.cccd || 'trống'}.`;
      setAssistantText(successMsg);
      speakVietnameseAudio(successMsg);

      setSearchResults(prev => prev.map(r => r.id === editingResident.id ? { ...r, ...editFormData } : r));
      setEditingResident(null);
    } catch (err) {
      console.error(err);
      const errMsg = 'Có lỗi xảy ra khi lưu vào cơ sở dữ liệu, anh chị vui lòng kiểm tra lại kết nối nhé!';
      setAssistantText(errMsg);
      speakVietnameseAudio(errMsg);
    }
  };

  const handleChangeVoice = (newV: VoiceOption) => {
    setVoiceType(newV);
    localStorage.setItem('assistant_voice_type', newV);
    const sample = newV === 'namminh' 
      ? 'Dạ, Nam Minh đã sẵn sàng phục vụ anh chị!' 
      : newV === 'hoaimy' 
        ? 'Dạ, Hoài My đã sẵn sàng phục vụ anh chị!' 
        : 'Dạ, em là giọng đọc Google tiếng Việt!';
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
          setShowCaption(true);
          const greetingText = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
          setAssistantText(greetingText);
          speakVietnameseAudio(greetingText);

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
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '6px 14px 6px 6px',
          borderRadius: '999px',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.3)',
          border: '2px solid #38bdf8'
        }}
        title="Bấm để gọi Trợ lý Ảo"
      >
        <img 
          src={frames.wave} 
          alt="Trợ lý Ảo" 
          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} 
        />
        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0284c7' }}>Gọi Trợ lý Ảo</span>
      </div>
    );
  }

  // 1. Khung hình cử động trực quan
  let activeFrame = frames.wave;
  if (isSpeaking) {
    // Luân chuyển giữa khung hình mở miệng nói chuyện và khép miệng để tạo cử động như người thật
    activeFrame = (speakingTick % 2 === 0) ? frames.talk : frames.listen;
  } else if (isListening) {
    activeFrame = frames.listen;
  } else {
    activeFrame = frames.wave;
  }

  // 2. Chuyển động cơ thể, gật đầu, nghiêng đầu theo nhịp ngữ điệu phát âm
  let bodyGestureTransform = 'translateY(0) rotate(0deg)';
  if (isSpeaking) {
    if (speakingTick % 4 === 0) bodyGestureTransform = 'translateY(-5px) rotate(1.2deg) scale(1.02)';
    else if (speakingTick % 4 === 1) bodyGestureTransform = 'translateY(-1px) rotate(-0.6deg) scale(1.01)';
    else if (speakingTick % 4 === 2) bodyGestureTransform = 'translateY(-4px) rotate(0.9deg) scale(1.02)';
    else bodyGestureTransform = 'translateY(1px) rotate(-1deg) scale(1.0)';
  } else if (isListening) {
    bodyGestureTransform = 'translateY(-2px) rotate(2deg) scale(1.025)';
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
      {/* 1. BẢNG PHỤ ĐỀ LỜI NÓI NỔI SIÊU GỌN - TỰ ĐỘNG BIẾN MẤT KHI NÓI XONG (KHÔNG CÒN HỘP THOẠI TO CHE MÀN HÌNH) */}
      {showCaption && assistantText && (
        <div 
          style={{
            maxWidth: '280px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            color: '#f8fafc',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            padding: '10px 14px',
            marginBottom: '10px',
            position: 'relative',
            animation: 'fadeInUp 0.25s ease-out',
            fontSize: '0.8rem',
            lineHeight: '1.45',
            zIndex: 1000
          }}
        >
          {/* Mũi tên chỉ xuống miệng cô gái */}
          <div style={{
            position: 'absolute',
            bottom: '-7px',
            left: '42px',
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: '7px solid rgba(15, 23, 42, 0.88)'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isSpeaking ? '#38bdf8' : '#22c55e',
                boxShadow: isSpeaking ? '0 0 8px #38bdf8' : 'none'
              }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8' }}>
                {voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'Trợ lý Ảo'}
              </span>
              {isSpeaking && (
                <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 600 }}>
                  🔊 Đang nói...
                </span>
              )}
            </div>

            <button
              onClick={() => setShowCaption(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Đóng phụ đề"
            >
              <X size={12} />
            </button>
          </div>

          <div style={{ color: '#ffffff', fontWeight: 500, fontSize: '0.82rem' }}>
            {assistantText}
          </div>
        </div>
      )}

      {/* 2. HUY HIỆU TRANSCRIPT NHẬN DIỆN KHI NGƯỜI DÙNG ĐANG NÓI VÀO MICRO */}
      {liveTranscript && (
        <div style={{
          marginBottom: '8px',
          background: 'rgba(239, 68, 68, 0.95)',
          backdropFilter: 'blur(8px)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '0.76rem',
          fontWeight: 600,
          boxShadow: '0 6px 18px rgba(239, 68, 68, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          animation: 'fadeInUp 0.2s ease-out'
        }}>
          <Mic size={13} className="pulse" />
          <span>"{liveTranscript}"</span>
        </div>
      )}

      {/* 3. THẺ KẾT QUẢ TÌM KIẾM NHÂN KHẨU (CHỈ XUẤT HIỆN KHI TÌM KIẾM, KHÔNG LÀM VƯỚNG MÀN HÌNH) */}
      {searchResults.length > 0 && !editingResident && (
        <div style={{
          width: '280px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25), 0 0 0 1px #e2e8f0',
          padding: '10px 12px',
          marginBottom: '10px',
          animation: 'fadeInUp 0.25s ease-out',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' }}>
              Tìm thấy {searchResults.length} nhân khẩu:
            </span>
            <button 
              onClick={() => setSearchResults([])}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
              title="Đóng"
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {searchResults.map((r) => (
              <div 
                key={r.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{r.full_name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    CCCD: <strong style={{ color: '#0284c7' }}>{r.cccd || '(Trống)'}</strong>
                  </div>
                </div>
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
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <Edit3 size={11} /> Sửa
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. FORM SỬA NHANH THÔNG TIN NHÂN KHẨU */}
      {editingResident && (
        <div style={{
          width: '280px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25), 0 0 0 1px #38bdf8',
          padding: '12px',
          marginBottom: '10px',
          animation: 'fadeInUp 0.25s ease-out',
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Edit3 size={13} /> Sửa thông tin:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input 
              type="text" 
              value={editFormData.full_name} 
              onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
              placeholder="Họ và tên"
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <input 
              type="text" 
              value={editFormData.dob} 
              onChange={e => setEditFormData({ ...editFormData, dob: e.target.value })}
              placeholder="Ngày sinh (YYYY-MM-DD)"
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <input 
              type="text" 
              value={editFormData.cccd} 
              onChange={e => setEditFormData({ ...editFormData, cccd: e.target.value })}
              placeholder="Số CCCD (12 chữ số)"
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <input 
              type="text" 
              value={editFormData.phone} 
              onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
              placeholder="Số điện thoại"
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
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
                  padding: '5px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Check size={13} /> Lưu CSDL
              </button>
              <button 
                onClick={() => setEditingResident(null)}
                style={{
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. HÌNH TƯỢNG CÔ GÁI ĐỨNG CỬ ĐỘNG NHƯ NGƯỜI THẬT */}
      <div 
        onClick={() => {
          setShowCaption(true);
          const greetingText = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
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
          animation: isSpeaking ? 'none' : 'floatingGirl 3.2s ease-in-out infinite'
        }}
        title="Bấm vào để nói chuyện với trợ lý!"
      >
        {/* Nút nhắc mở tiếng nếu trình duyệt chặn autoplay */}
        {needsUserTapToPlay && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setNeedsUserTapToPlay(false);
              const greetingText = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
              setAssistantText(greetingText);
              speakVietnameseAudio(greetingText);
            }}

            style={{
              position: 'absolute',
              top: '-38px',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: '700',
              boxShadow: '0 6px 18px rgba(234, 88, 12, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '2px solid rgba(255, 255, 255, 0.9)',
              animation: 'bounceTap 1.5s infinite',
              cursor: 'pointer',
              zIndex: 100
            }}
            title="Bấm vào để kích hoạt âm thanh trợ lý"
          >
            <Volume2 size={13} />
            <span>Bấm nghe tiếng trợ lý!</span>
          </div>
        )}

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

        {/* Vòng hào quang phát sáng khi nói hoặc nghe */}
        {(isSpeaking || isListening) && (
          <div style={{
            position: 'absolute',
            top: '20px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: isSpeaking 
              ? 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(56, 189, 248, 0) 70%)'
              : 'radial-gradient(circle, rgba(239, 68, 68, 0.35) 0%, rgba(239, 68, 68, 0) 70%)',
            animation: 'soundwavePulse 1.8s infinite ease-in-out',
            pointerEvents: 'none',
            zIndex: 1
          }} />
        )}

        {/* Ảnh nhân vật cô gái cử động nói chuyện & cử chỉ như người thật */}
        <div style={{
          position: 'relative',
          width: '140px',
          height: '185px',
          transform: bodyGestureTransform,
          transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <img 
            src={activeFrame} 
            alt="Cô gái Trợ lý Ảo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: isSpeaking 
                ? 'drop-shadow(0 8px 18px rgba(2, 132, 199, 0.65))' 
                : isListening 
                  ? 'drop-shadow(0 8px 18px rgba(239, 68, 68, 0.65))'
                  : 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.2))',
              transition: 'filter 0.3s'
            }} 
          />
        </div>

        {/* Thanh điều khiển mini trong suốt dưới chân cô gái */}
        <div style={{
          marginTop: '-4px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '999px',
          fontSize: '0.68rem',
          fontWeight: '700',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}>
          {/* Trạng thái mic */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoHandsFree();
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              cursor: 'pointer',
              color: isListening ? '#f87171' : '#38bdf8'
            }}
            title={isAutoHandsFree ? 'Đang bật đàm thoại tự động rảnh tay (Bấm để tắt)' : 'Đang tắt tự động (Bấm để bật)'}
          >
            {isListening ? (
              <>
                <Radio size={11} className="pulse" />
                <span>Đang nghe...</span>
              </>
            ) : (
              <>
                <Mic size={11} />
                <span>{isAutoHandsFree ? 'Tự động' : 'Tắt mic'}</span>
              </>
            )}
          </div>

          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nút đổi giọng nhanh */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next: VoiceOption = voiceType === 'namminh' ? 'hoaimy' : voiceType === 'hoaimy' ? 'google' : 'namminh';
              handleChangeVoice(next);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#facc15',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: 0
            }}
            title="Bấm để đổi giọng: Nam Minh / Hoài My / Chị Google"
          >
            {voiceType === 'namminh' ? '👨 Nam' : voiceType === 'hoaimy' ? '👩 My' : '🌐 GG'}
          </button>

          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nút bật tắt âm thanh */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const n = !voiceEnabled;
              setVoiceEnabled(n);
              if (!n) {
                if (audioPlayerRef.current) audioPlayerRef.current.pause();
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: voiceEnabled ? '#4ade80' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title={voiceEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatingGirl {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes bounceTap {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
        @keyframes soundwavePulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
