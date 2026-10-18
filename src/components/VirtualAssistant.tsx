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
  Play,
  Square,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Brain,
  Trash2,
  Plus
} from 'lucide-react';
import { db } from '../services/db';
import type { Resident } from '../types';
import { 
  askAssistantAI, 
  getGeminiApiKey, 
  setGeminiApiKey, 
  askGemini,
  getAssistantMemories,
  saveAssistantMemory,
  removeAssistantMemory,
  clearAssistantMemories,
  type AssistantMemory
} from '../services/ai';

interface VirtualAssistantProps {
  isSidebarOpen: boolean;
  currentTab?: string;
  onNavigate: (tabId: string) => void;
  userRole?: string;
  householdCount?: number;
  residentCount?: number;
  temporaryResidentCount?: number;
  partyMemberCount?: number;
}

export type VoiceOption = 'namminh' | 'hoaimy' | 'google';

export const VirtualAssistant: React.FC<VirtualAssistantProps> = ({
  isSidebarOpen,
  currentTab = 'Bảng điều khiển',
  onNavigate,
  householdCount,
  residentCount,
  temporaryResidentCount,
  partyMemberCount
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

  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [showKeyPassword, setShowKeyPassword] = useState<boolean>(false);
  const [apiKeySavedStatus, setApiKeySavedStatus] = useState<string>('');
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);

  // Bộ nhớ đàm thoại nhiều lượt & Dữ liệu thực tế dân số TDP Quảng Giao (khớp 100% hiển thị menu)
  const [totalHouseholdsCount, setTotalHouseholdsCount] = useState<number>(() => householdCount || 1252);
  const [totalResidentsCount, setTotalResidentsCount] = useState<number>(() => residentCount || 5622);
  const [totalTempCount, setTotalTempCount] = useState<number>(() => temporaryResidentCount || 3);
  const [totalPartyCount, setTotalPartyCount] = useState<number>(() => partyMemberCount || 0);

  // Đồng bộ tức thì khi App.tsx truyền số liệu từ menu vào
  useEffect(() => {
    if (householdCount && householdCount > 0) setTotalHouseholdsCount(householdCount);
  }, [householdCount]);

  useEffect(() => {
    if (residentCount && residentCount > 0) setTotalResidentsCount(residentCount);
  }, [residentCount]);

  useEffect(() => {
    if (temporaryResidentCount !== undefined) setTotalTempCount(temporaryResidentCount);
  }, [temporaryResidentCount]);

  useEffect(() => {
    if (partyMemberCount !== undefined) setTotalPartyCount(partyMemberCount);
  }, [partyMemberCount]);

  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>(() => {
    try {
      const saved = localStorage.getItem('assistant_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [memories, setMemories] = useState<AssistantMemory[]>(() => getAssistantMemories());
  const [showMemoriesModal, setShowMemoriesModal] = useState<boolean>(false);
  const [newMemoryInput, setNewMemoryInput] = useState<string>('');

  const appendToChatHistory = useCallback((role: 'user' | 'model', text: string) => {
    setChatHistory(prev => {
      const next = [...prev, { role, text }].slice(-30);
      try {
        localStorage.setItem('assistant_chat_history', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Tự động tải số liệu thực tế từ CSDL với bộ lọc chuẩn xác
  useEffect(() => {
    const fetchLatestCounts = async () => {
      try {
        const [resList, hhList] = await Promise.all([
          db.getResidents().catch(() => []),
          db.getHouseholds().catch(() => [])
        ]);
        if (hhList && hhList.length > 0) {
          const activeH = hhList.filter((h: any) => h.status !== 'moved_out').length;
          setTotalHouseholdsCount(activeH || hhList.length);
        }
        if (resList && resList.length > 0) {
          const activeR = resList.filter((r: any) => r.status !== 'deceased' && r.status !== 'moved_out' && (r.relationship_with_head || '').trim().toLowerCase() !== 'thành viên chuyển đi').length;
          setTotalResidentsCount(activeR || resList.length);
          const tempR = resList.filter((r: any) => r.status === 'temporary_resident' || r.status === 'temporary_absent').length;
          setTotalTempCount(tempR);
        }
      } catch (err) {}
    };

    fetchLatestCounts();
    window.addEventListener('db-changed', fetchLatestCounts);
    return () => window.removeEventListener('db-changed', fetchLatestCounts);
  }, []);

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
  const handleUserQueryRef = useRef<((query: string) => Promise<void>) | null>(null);
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

  const currentSpeakingTextRef = useRef<string>('');

  // 1. Tự động bật/tắt Micro an toàn (TUYỆT ĐỐI KHÔNG BẬT KHI TRỢ LÝ ĐANG NÓI ĐỂ CHỐNG HÚ VỌNG TỪ LOA)
  const startListeningSafely = useCallback(() => {
    if (!isAutoHandsFreeRef.current) return;
    if (isSpeakingRef.current) return; // Đang nói -> Tuyệt đối không bật mic
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

  // 🌟 HÀM CẮT LỜI / NGẮT TIẾNG TRỢ LÝ TỨC THÌ (0.01 giây) VÀ MỞ LẠI MIC ĐỂ NGƯỜI DÙNG NÓI
  const interruptSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    currentSpeakingTextRef.current = '';

    // Khi người dùng bấm cắt lời hoặc gõ phím Cách -> mở mic lại ngay sau 80ms để đón câu nói mới
    if (isAutoHandsFreeRef.current) {
      setTimeout(() => {
        try {
          if (recognitionRef.current && !isListeningRef.current) {
            recognitionRef.current.start();
          }
        } catch (e) {}
      }, 80);
    }
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
    // Tách câu theo dấu ngắt câu tự nhiên (. ! ? \n) để giữ câu nói trọn vẹn, không ngắt quãng ở từng dấu phẩy
    const rawSentences = textToSpeak.split(/(?<=[.!?\n])\s+/).filter(Boolean);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const s of rawSentences) {
      if ((currentChunk + ' ' + s).length <= 140) {
        currentChunk += (currentChunk ? ' ' : '') + s.trim();
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        // Nếu một câu đơn quá dài trên 140 ký tự, tách nhẹ theo dấu phẩy hoặc khoảng trắng
        if (s.length > 140) {
          const subParts = s.match(/[^,;]+[,;]?/g) || [s];
          let subChunk = '';
          for (const sp of subParts) {
            if ((subChunk + ' ' + sp).length <= 140) {
              subChunk += (subChunk ? ' ' : '') + sp.trim();
            } else {
              if (subChunk) chunks.push(subChunk.trim());
              subChunk = sp.trim();
            }
          }
          if (subChunk) chunks.push(subChunk.trim());
          currentChunk = '';
        } else {
          currentChunk = s.trim();
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    if (chunks.length === 0) chunks.push(textToSpeak.slice(0, 140));

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
        audio.playbackRate = 0.95;
      } else if (currentVoice === 'hoaimy') {
        audio.playbackRate = 1.02;
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
    currentSpeakingTextRef.current = textToSpeak.toLowerCase().trim();

    // 🌟 QUY TẮC VÀNG CHỐNG THU NGƯỢC GIỌNG TRỢ LÝ:
    // TẮT MICRO NGAY KHI TRỢ LÝ BẮT ĐẦU NÓI ĐỂ KHÔNG BỊ THU VỌNG TỪ LOA MÁY TÍNH VÀO MIC
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
      currentSpeakingTextRef.current = '';
      // Trợ lý nói xong -> tự động mở lại mic sau 350ms để phòng im ắng và người dùng nói tiếp tự nhiên
      if (isAutoHandsFreeRef.current) {
        setTimeout(startListeningSafely, 350);
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
      utterance.pitch = 1.0; // Giữ nguyên độ cao tự nhiên của giọng Neural AI cao cấp, không bị biến dạng
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
        // NẾU TRỢ LÝ ĐANG NÓI: HỦY BỎ NGAY, TUYỆT ĐỐI KHÔNG XỬ LÝ ĐỂ TRÁNH THU TIẾNG TỪ LOA VÀO MIC!
        if (isSpeakingRef.current) {
          return;
        }

        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(currentTranscript);

        if (event.results[0].isFinal) {
          const finalQuery = currentTranscript.trim();
          setLiveTranscript('');
          if (finalQuery.length > 1 && handleUserQueryRef.current) {
            handleUserQueryRef.current(finalQuery);
          }
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        isListeningRef.current = false;
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[Micro Error]', event.error);
        }
        // Chỉ tự bật lại micro khi trợ lý KHÔNG ĐANG NÓI
        if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
          setTimeout(startListeningSafely, 800);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        // CHỈ TỰ ĐỘNG BẬT LẠI MICRO KHI TRỢ LÝ KHÔNG ĐANG NÓI
        if (isAutoHandsFreeRef.current && !isSpeakingRef.current) {
          setTimeout(startListeningSafely, 300);
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
  }, [startListeningSafely]);

  // 🌟 PHÍM TẮT THÔNG MINH: Bấm phím CÁCH (Spacebar) hoặc Esc để ngắt lời trợ lý ngay lập tức và nói ngay
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      );
      
      // Bấm phím CÁCH khi không gõ chữ trong ô nhập liệu -> Ngắt lời trợ lý tức thì
      if (e.code === 'Space' && !isInput) {
        if (isSpeakingRef.current) {
          e.preventDefault();
          interruptSpeaking();
        }
      } else if (e.key === 'Escape') {
        if (isSpeakingRef.current) {
          interruptSpeaking();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [interruptSpeaking]);

  // Hàm điều hướng và kích hoạt tìm kiếm / cuộn sáng tức thì tới đối tượng ở bất kỳ tab nào
  const triggerSearchAndJump = (targetTab: string, term: string, targetId?: string) => {
    const trimmed = term.trim();
    try {
      localStorage.setItem('assistant_pending_search', JSON.stringify({
        tab: targetTab,
        query: trimmed,
        id: targetId,
        timestamp: Date.now()
      }));
    } catch {}

    onNavigate(targetTab);

    const fireEvents = () => {
      const payload = { id: targetId, query: trimmed, name: trimmed };
      if (targetTab === 'households') {
        window.dispatchEvent(new CustomEvent('highlight-household', { detail: payload }));
      } else if (targetTab === 'residents' || targetTab === 'residents-temp' || targetTab === 'residents-changes') {
        window.dispatchEvent(new CustomEvent('highlight-resident', { detail: payload }));
      } else if (targetTab === 'finance') {
        window.dispatchEvent(new CustomEvent('highlight-finance', { detail: payload }));
      } else if (targetTab === 'ward-funds') {
        window.dispatchEvent(new CustomEvent('highlight-ward-funds', { detail: payload }));
      } else if (targetTab === 'sponsors') {
        window.dispatchEvent(new CustomEvent('highlight-sponsors', { detail: payload }));
      } else if (targetTab === 'elderly') {
        window.dispatchEvent(new CustomEvent('highlight-elderly', { detail: payload }));
      } else if (targetTab === 'ccb') {
        window.dispatchEvent(new CustomEvent('highlight-ccb', { detail: payload }));
      } else if (targetTab === 'party-cell') {
        window.dispatchEvent(new CustomEvent('highlight-party', { detail: payload }));
      } else if (targetTab === 'policy') {
        window.dispatchEvent(new CustomEvent('highlight-policy', { detail: payload }));
      } else if (targetTab === 'security') {
        window.dispatchEvent(new CustomEvent('highlight-security', { detail: payload }));
      } else if (targetTab === 'healthcare') {
        window.dispatchEvent(new CustomEvent('highlight-healthcare', { detail: payload }));
      } else if (targetTab === 'documents') {
        window.dispatchEvent(new CustomEvent('highlight-documents', { detail: payload }));
      } else if (targetTab === 'ward-documents') {
        window.dispatchEvent(new CustomEvent('highlight-ward-documents', { detail: payload }));
      } else if (targetTab === 'complaints') {
        window.dispatchEvent(new CustomEvent('highlight-complaints', { detail: payload }));
      } else if (targetTab === 'map') {
        window.dispatchEvent(new CustomEvent('highlight-map', { detail: payload }));
      }
    };

    fireEvents();
    setTimeout(fireEvents, 150);
    setTimeout(fireEvents, 400);
    setTimeout(fireEvents, 800);
  };

  // Chuẩn hóa tên và bóc tách từ khóa tìm kiếm thông minh từ giọng nói
  const extractCleanSearchTerm = (text: string) => {
    let t = text.trim();
    t = t.replace(/^(hãy |xin hãy |làm ơn |nhờ em |em ơi |trợ lý ơi |ơi )/i, '');
    t = t.replace(/^(tìm kiếm|tìm|kiểm tra|tra cứu|cho tôi xem|cho xem|xem|mở|chuyển đến|chuyển sang|đi tới|hướng dẫn)\s+/i, '');
    t = t.replace(/^(hộ gia đình|hộ dân|hộ|nhân khẩu|công dân|người dân|dân cư|cư dân|đảng viên|đồng chí|bác|ông|bà|anh|chị|em|cụ|hội viên ccb|cựu chiến binh|mạnh thường quân|nhà|sổ hộ|số hộ)\s+/i, '');
    t = t.replace(/^(tên là|tên|có tên|số cccd|cccd|số căn cước|căn cước)\s+/i, '');
    return t.trim();
  };

  const formatDisplayName = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
  };

  // Kiểm tra xem câu nói có phải là lệnh tìm kiếm dữ liệu / chuyển tab rõ ràng hay không
  const isExplicitSearchOrNavigationCommand = (text: string) => {
    const q = text.toLowerCase().trim();

    // Nếu là câu hỏi, dặn dò, tâm sự, chào hỏi, chia sẻ cảm xúc, hỏi ký ức -> Chắc chắn là ĐÀM THOẠI TRÒ CHUYỆN!
    if (
      q.endsWith('?') ||
      q.includes('nhé') ||
      q.includes('nhỉ') ||
      q.includes('không em') ||
      q.includes('không bạn') ||
      q.includes('hôm nay') ||
      q.includes('ngày mai') ||
      q.includes('tối nay') ||
      q.includes('ghi nhớ') ||
      q.includes('nhớ giúp') ||
      q.includes('nhớ nhé') ||
      q.includes('còn nhớ') ||
      q.includes('vừa nói') ||
      q.includes('anh tên') ||
      q.includes('tâm sự') ||
      q.includes('kể chuyện') ||
      q.includes('nói chuyện') ||
      q.includes('người thật') ||
      q.includes('chào') ||
      q.includes('mệt') ||
      q.includes('khỏe') ||
      q.includes('cảm ơn') ||
      q.includes('làm sao') ||
      q.includes('tại sao') ||
      q.includes('thế nào') ||
      q.includes('cho hỏi') ||
      q.includes('ăn cơm') ||
      q.includes('thời tiết') ||
      q.includes('sổ tay')
    ) {
      return false;
    }

    // Các tiền tố tìm kiếm / điều hướng rõ ràng
    const explicitPrefixes = [
      'tìm kiếm hộ ', 'tìm hộ ', 'tra cứu hộ ', 'xem hộ ',
      'tìm kiếm nhân khẩu ', 'tìm nhân khẩu ', 'tra cứu nhân khẩu ', 'xem nhân khẩu ',
      'tìm cccd ', 'tra cứu cccd ', 'số cccd ', 'tìm kiếm cccd ',
      'chuyển sang ', 'chuyển đến ', 'mở tab ', 'mở màn hình ', 'mở trang ', 'đi tới '
    ];
    if (explicitPrefixes.some(p => q.startsWith(p))) return true;

    // Nếu đang ở tab households/residents mà câu bắt đầu bằng "tìm " hoặc "tra cứu "
    if ((currentTab === 'households' || currentTab === 'residents') && (q.startsWith('tìm ') || q.startsWith('tra cứu '))) {
      return true;
    }

    return false;
  };

  const handleSmartConversationResponse = (q: string, history: { role: 'user' | 'model'; text: string }[] = []): string => {
    const vName = voiceType === 'namminh' ? 'Nam Minh' : voiceType === 'hoaimy' ? 'Hoài My' : 'Trợ lý Ảo';

    // 0. Ghi nhớ trực tiếp khi người dùng dặn dò
    if (
      q.startsWith('em nhớ giúp') || 
      q.startsWith('nhớ giúp anh') || 
      q.startsWith('ghi nhớ giúp') || 
      q.startsWith('nhớ là') || 
      q.includes('nhớ nhé') ||
      q.includes('ghi nhớ nhé')
    ) {
      const cleanNote = q.replace(/^(em nhớ giúp anh|ghi nhớ giúp anh|nhớ giúp anh|em nhớ là|nhớ là|ghi nhớ là|em nhớ|nhớ)\s+/i, '').trim();
      if (cleanNote) {
        saveAssistantMemory({ category: 'task', content: cleanNote });
        setMemories(getAssistantMemories());
        return `Dạ vâng anh Tuyến ơi, em đã ghi nhớ kỹ vào sổ tay rồi nhé: "${cleanNote}". Anh Tuyến cứ yên tâm làm việc nha!`;
      }
    }

    // 0.1 Hỏi về trí nhớ, sổ tay ký ức, dặn dò
    if (
      q.includes('nhớ được gì') ||
      q.includes('nhớ gì về anh') ||
      q.includes('nhớ những gì') ||
      q.includes('dặn gì') ||
      q.includes('lịch gì') ||
      q.includes('ngày mai anh có') ||
      q.includes('sổ tay')
    ) {
      const mems = getAssistantMemories();
      if (mems.length > 0) {
        const topMems = mems.slice(0, 3).map(m => m.content).join('. ');
        return `Dạ, em nhớ hết mọi điều anh Tuyến dặn rồi ạ! Trong sổ tay em đang ghi nhớ: ${topMems}. Anh Tuyến cứ yên tâm nhé!`;
      }
      return 'Dạ, hiện tại trong sổ tay em chưa có ghi chú mới nào của anh Tuyến. Anh có việc gì cần dặn dò, lên lịch hay lưu ý cứ bảo em ghi nhớ giúp anh nhé!';
    }

    // 0.2 Hỏi câu vừa nói
    if (q.includes('vừa nói gì') || q.includes('anh nói gì') || q.includes('câu vừa rồi')) {
      const userMsgs = history.filter(h => h.role === 'user');
      if (userMsgs.length >= 2) {
        const prev = userMsgs[userMsgs.length - 2].text;
        return `Dạ, vừa nãy anh Tuyến vừa nói là: "${prev}" đấy ạ! Em luôn chú ý lắng nghe từng lời của anh nhé!`;
      }
      return 'Dạ, em đang lắng nghe anh rất rõ ràng đây ạ! Anh Tuyến cần em hỗ trợ việc gì cứ nói với em nhé!';
    }

    // 0.3 Hỏi về danh tính anh Tuyến
    if (q.includes('anh tên là gì') || q.includes('anh là ai') || q.includes('anh làm gì')) {
      return 'Dạ, anh là anh Nguyễn Kim Tuyến - Tổ trưởng tâm huyết, gương mẫu của Tổ dân phố Quảng Giao chúng ta đấy ạ!';
    }

    // 1. Phản hồi khi người dùng góp ý về độ thông minh, chưa hiểu, chê, khen
    if (
      q.includes('chưa thông minh') ||
      q.includes('không thông minh') ||
      q.includes('chưa được') ||
      q.includes('ngốc') ||
      q.includes('kém') ||
      q.includes('dở') ||
      q.includes('nâng cấp')
    ) {
      return `Dạ, em xin lắng nghe góp ý của anh Tuyến ạ! Em luôn học hỏi mỗi ngày để hiểu anh sâu sắc hơn. Để trợ lý đối đáp siêu thông minh và ghi nhớ vô tận, anh bấm vào biểu tượng ngôi sao ✨ dưới chân em để kiểm tra kết nối Gemini AI nhé!`;
    }

    if (
      q.includes('khen') ||
      q.includes('giỏi') ||
      q.includes('tuyệt vời') ||
      q.includes('thông minh đấy') ||
      q.includes('được đấy') ||
      q.includes('hay quá')
    ) {
      return `Dạ em cảm ơn anh Tuyến nhiều lắm ạ! Được anh khen là em vui cả ngày luôn, em sẽ luôn đồng hành hỗ trợ công việc của tổ dân phố mình thật tốt ạ!`;
    }

    // 2. Cảm xúc, mệt mỏi, áp lực công việc, hỏi thăm tâm trạng
    if (
      q.includes('mệt') ||
      q.includes('áp lực') ||
      q.includes('stress') ||
      q.includes('vất vả') ||
      q.includes('nhức đầu') ||
      q.includes('đuối')
    ) {
      return `Dạ, công việc tổ trưởng quản lý hàng nghìn nhân khẩu, trăm công nghìn việc nên vất vả lắm anh Tuyến ạ. Anh nhớ nghỉ ngơi một chút, uống ngụm nước ấm nhé. Mọi khó khăn giấy tờ sổ sách cứ để em san sẻ cùng anh!`;
    }

    if (q.includes('buồn') || q.includes('chán') || q.includes('tâm sự')) {
      return `Dạ, cuộc sống và công việc ai cũng có những lúc chùng lòng xuống anh ạ. Em luôn ở đây 24/7 để lắng nghe anh chia sẻ. Có chuyện gì trăn trở anh cứ tâm sự với em nhé!`;
    }

    if (q.includes('ăn cơm') || q.includes('ăn gì') || q.includes('đói')) {
      return `Dạ em chỉ 'ăn' bằng nguồn điện và dữ liệu thôi ạ! Còn anh Tuyến thì công việc bận rộn cũng nhớ phải ăn uống đúng bữa, giữ gìn sức khỏe thật tốt nhé anh!`;
    }

    // 3. Hỏi về số liệu thực tế TDP Quảng Giao
    if (q.includes('bao nhiêu hộ') || q.includes('mấy hộ') || q.includes('số hộ')) {
      const hhStr = new Intl.NumberFormat('vi-VN').format(totalHouseholdsCount);
      return `Dạ, hiện tại Tổ dân phố Quảng Giao chúng ta đang có đúng ${hhStr} hộ gia đình đã được cập nhật đầy đủ trong hệ thống anh nhé!`;
    }

    if (q.includes('dân số') || q.includes('bao nhiêu người') || q.includes('bao nhiêu nhân khẩu') || q.includes('mấy người')) {
      const resStr = new Intl.NumberFormat('vi-VN').format(totalResidentsCount);
      const hhStr = new Intl.NumberFormat('vi-VN').format(totalHouseholdsCount);
      return `Dạ, tổng số nhân khẩu hiện tại của Tổ dân phố Quảng Giao là đúng ${resStr} người, phân bổ trên ${hhStr} hộ gia đình anh Tuyến nhé!`;
    }

    if (q.includes('tạm trú') || q.includes('tạm vắng')) {
      return `Dạ, hiện tại tổ dân phố mình đang ghi nhận ${totalTempCount} trường hợp tạm trú, tạm vắng anh nhé!`;
    }

    if (q.includes('tổ trưởng là ai') || q.includes('ai là tổ trưởng')) {
      return `Dạ, Tổ trưởng Tổ dân phố Quảng Giao chính là anh Nguyễn Kim Tuyến - một cán bộ luôn gương mẫu, nhiệt tình và hết lòng vì bà con lối xóm đấy ạ!`;
    }

    // 4. Hỏi ngày giờ, thời gian
    if (q.includes('mấy giờ') || q.includes('ngày mấy') || q.includes('thứ mấy') || q.includes('hôm nay ngày')) {
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      return `Dạ, bây giờ là ${timeStr}, ${dateStr} anh nhé!`;
    }

    // 5. Khả năng nói chuyện tự nhiên
    if (
      q.includes('nói chuyện') ||
      q.includes('giao tiếp') ||
      q.includes('tự nhiên') ||
      q.includes('như người thật') ||
      q.includes('người thật')
    ) {
      return `Dạ vâng anh Tuyến ơi! Em luôn trò chuyện cùng anh tự nhiên, sống động như một người trợ lý kề cận ngoài đời thực. Em vừa có thể giúp anh điều hành ứng dụng, tra cứu dữ liệu, vừa ghi nhớ mọi việc anh dặn và cùng anh tâm sự. Anh cứ thoải mái trò chuyện với em nhé!`;
    }

    if (q.includes('hiểu không') || q.includes('hiểu ko') || q.includes('có hiểu')) {
      return 'Dạ em hiểu rất rõ từng câu nói và yêu cầu của anh Tuyến ạ! Em luôn chú ý lắng nghe để phục vụ anh tốt nhất.';
    }

    if (q.includes('nghe rõ') || q.includes('nghe được') || q.includes('có nghe')) {
      return 'Dạ em nghe anh rất rõ ràng và mạch lạc ạ! Giọng nói của anh rất ấm áp, em đang tiếp tục lắng nghe đây ạ.';
    }

    if (q.includes('em là ai') || q.includes('bạn là ai') || q.includes('tên gì') || q.includes('giới thiệu') || q.includes('mấy tuổi')) {
      return `Dạ, em là ${vName} - Trợ lý ảo thông minh của Tổ dân phố Quảng Giao. Em luôn đồng hành kề cận bên anh Nguyễn Kim Tuyến và bà con để phục vụ công tác quản lý dân cư và giải đáp mọi thông tin ạ!`;
    }

    if (q.includes('chào') || q.includes('alo') || q.includes('ơi') || q.includes('hello') || q.includes('hi ')) {
      return 'Dạ, em chào anh Tuyến ạ! Em đang lắng nghe đây, hôm nay anh cần em hỗ trợ công việc gì cứ bảo em nhé!';
    }

    if (q.includes('khỏe không') || q.includes('khỏe ko') || q.includes('hôm nay thế nào') || q.includes('vui không')) {
      return 'Dạ em rất khỏe và luôn tràn đầy năng lượng để phục vụ anh! Chúc anh Tuyến một ngày làm việc thật vui vẻ, thuận lợi và ngập tràn may mắn ạ!';
    }

    if (q.includes('cảm ơn') || q.includes('cám ơn') || q.includes('thank')) {
      return 'Dạ không có gì đâu anh Tuyến! Được hỗ trợ anh và bà con tổ dân phố là niềm vui lớn nhất của em ạ!';
    }

    if (q.includes('tạm biệt') || q.includes('đi ngủ') || q.includes('bye')) {
      return 'Dạ, em chào anh Tuyến ạ! Chúc anh có một buổi tối thật an lành và một giấc ngủ thật ngon nhé!';
    }

    if (q.includes('thời tiết') || q.includes('mưa không') || q.includes('nắng không') || q.includes('nhiệt độ')) {
      return 'Dạ, thời tiết hôm nay nhìn chung khá thuận lợi cho công việc, anh Tuyến ra ngoài nhớ chú ý giữ gìn sức khỏe nhé ạ!';
    }

    if (q.includes('đọc thơ') || q.includes('bài thơ') || q.includes('thơ') || q.includes('hát') || q.includes('kể chuyện')) {
      return 'Dạ, em xin đọc tặng anh câu thơ này nhé: "Quảng Giao đoàn kết nghĩa tình - Dân cư ấm no, xóm làng văn minh" ạ!';
    }

    if (q.includes('vneid') || q.includes('định danh') || q.includes('mức 2') || q.includes('mức 1')) {
      return 'Dạ, về định danh điện tử VNeID: mức 1 anh chị có thể tự đăng ký trên điện thoại, còn mức 2 anh chị mang thẻ CCCD gắn chip ra Công an phường để được chụp ảnh và lấy vân tay xác thực nhé ạ!';
    }

    if (q.includes('bảo hiểm y tế') || q.includes('bhyt')) {
      return 'Dạ, hiện nay thẻ BHYT đã được tích hợp trực tiếp vào thẻ CCCD gắn chip và ứng dụng VNeID. Khi đi khám chữa bệnh, bà con chỉ cần xuất trình thẻ CCCD là được hưởng quyền lợi ạ!';
    }

    if (q.includes('căn cước') || q.includes('cccd') || q.includes('làm thẻ')) {
      return 'Dạ, thủ tục cấp đổi hoặc làm thẻ Căn cước hiện nay được thực hiện tại Bộ phận một cửa hoặc Công an thành phố. Bà con có thể đặt lịch trước trên Cổng Dịch vụ công Quốc gia để không phải chờ đợi ạ!';
    }

    if (q.includes('tạm trú') || q.includes('tạm vắng')) {
      return 'Dạ, thủ tục đăng ký tạm trú anh chị có thể nộp trực tuyến qua Cổng Dịch vụ công hoặc mang hợp đồng thuê nhà/giấy tờ chỗ ở hợp pháp đến Công an phường làm thủ tục ạ!';
    }

    if (q.includes('người cao tuổi') || q.includes('mừng thọ') || q.includes('80 tuổi')) {
      return 'Dạ, theo quy định, các cụ cao tuổi từ đủ 80 tuổi trở lên không có lương hưu sẽ được hưởng trợ cấp xã hội hàng tháng và thẻ BHYT miễn phí của Nhà nước ạ!';
    }

    return 'Dạ vâng anh Tuyến ơi, em luôn ở đây đồng hành và lắng nghe anh. Anh cần tra cứu dữ liệu hay có việc gì cần dặn dò cứ bảo em nhé!';
  };

  // 6. Xử lý câu lệnh đàm thoại thông minh
  const handleUserQuery = async (query: string) => {
    if (!query.trim()) return;

    const qLower = query.toLowerCase().trim();
    setSearchResults([]);
    setEditingResident(null);

    const term = extractCleanSearchTerm(query);
    const hasSearchKeyword = qLower.includes('tìm') || qLower.includes('kiểm tra') || qLower.includes('tra cứu') || qLower.includes('chuyển đến') || qLower.includes('xem');
    const isExplicitSearch = isExplicitSearchOrNavigationCommand(query);

    // 0. ĐỔI GIỌNG NÓI TRỰC TIẾP QUA GIỌNG NÓI
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

    // 0.1 CÀI ĐẶT API KEY BẰNG GIỌNG NÓI HOẶC HỎI CẤU HÌNH
    if (qLower.includes('cài đặt api') || qLower.includes('cấu hình gemini') || qLower.includes('nhập api key') || qLower.includes('khóa api')) {
      setShowApiKeyModal(true);
      const resp = 'Dạ, em đã mở bảng cài đặt Google Gemini rồi ạ! Anh chị nhập khoá API miễn phí vào đây nhé!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    // 0.15 XEM SỔ TAY KÝ ỨC
    if (qLower.includes('mở sổ tay') || qLower.includes('xem ký ức') || qLower.includes('sổ tay ghi nhớ') || qLower.includes('mở trí nhớ')) {
      setMemories(getAssistantMemories());
      setShowMemoriesModal(true);
      const resp = `Dạ, em mở ngay sổ tay ghi nhớ đây ạ! Hiện em đang lưu ${memories.length} điều anh Tuyến dặn nhé!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    // 0.2 NẾU LÀ GIAO TIẾP / ĐÀM THOẠI / HỎI ĐÁP / DẶN DÒ / TÂM SỰ -> GỬI TỚI GEMINI AI CÙNG BỘ NHỚ KÝ ỨC
    if (!isExplicitSearch) {
      const updatedHistory = [...chatHistory, { role: 'user' as const, text: query }].slice(-30);
      setChatHistory(updatedHistory);
      try {
        localStorage.setItem('assistant_chat_history', JSON.stringify(updatedHistory));
      } catch {}

      const geminiKey = getGeminiApiKey();
      if (geminiKey) {
        try {
          const aiRes = await askAssistantAI(query, currentTab, updatedHistory, {
            totalHouseholds: totalHouseholdsCount,
            totalResidents: totalResidentsCount,
            temporaryResidents: totalTempCount,
            partyMembers: totalPartyCount
          });
          if (aiRes && aiRes.spokenReply) {
            setAssistantText(aiRes.spokenReply);
            speakVietnameseAudio(aiRes.spokenReply);
            const fullHistory = [...updatedHistory, { role: 'model' as const, text: aiRes.spokenReply }].slice(-30);
            setChatHistory(fullHistory);
            try {
              localStorage.setItem('assistant_chat_history', JSON.stringify(fullHistory));
            } catch {}

            // Cập nhật lại memories trong UI nếu có ký ức mới
            setMemories(getAssistantMemories());

            if (aiRes.action) {
              if (aiRes.action.type === 'navigate_and_search' && aiRes.action.tab) {
                triggerSearchAndJump(aiRes.action.tab, aiRes.action.query || term);
              } else if (aiRes.action.tab) {
                onNavigate(aiRes.action.tab);
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
              }
            }
            return;
          }
        } catch (err) {
          console.warn('[Gemini Assistant Error, fallback to smart local engine]:', err);
        }
      }

      // Xử lý đàm thoại tự nhiên nội bộ như người thật với bộ nhớ
      const resp = handleSmartConversationResponse(qLower, updatedHistory);
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      const fullHistory = [...updatedHistory, { role: 'model' as const, text: resp }].slice(-30);
      setChatHistory(fullHistory);
      try {
        localStorage.setItem('assistant_chat_history', JSON.stringify(fullHistory));
      } catch {}
      return;
    }

    // 1. TÌM KIẾM HOẶC CHUYỂN ĐẾN HỘ GIA ĐÌNH
    // Ví dụ: "tìm kiếm hộ nguyễn kim tuyến", "tìm hộ nguyễn kim tuyến", "hộ nguyễn kim tuyến", hoặc đang ở tab hộ gia đình mà nói "tìm nguyễn kim tuyến"
    if (
      !isQuestionOrChat &&
      (
        (qLower.includes('hộ') && (hasSearchKeyword || qLower.startsWith('hộ '))) || 
        (currentTab === 'households' && hasSearchKeyword)
      )
    ) {
      const isPureNav = ['gia đình', 'dân', 'khẩu', 'này', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở danh sách hộ gia đình ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('households');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }

      if (term.length >= 2) {
        try {
          const [households, residents] = await Promise.all([
            db.getHouseholds(),
            db.getResidents()
          ]);
          const qClean = term.toLowerCase().trim();

          // Tìm theo chủ hộ hoặc số hộ
          let matchedH = households.find(h => {
            const head = residents.find(r => r.id === h.head_of_household_id || (r.household_id === h.id && r.is_head));
            const headName = head?.full_name?.toLowerCase() || '';
            const hkNum = (h.household_number || '').toLowerCase();
            const addr = (h.address || '').toLowerCase();
            return headName.includes(qClean) || hkNum.includes(qClean) || addr.includes(qClean);
          });

          // Nếu không khớp chủ hộ, tìm trong thành viên trong hộ
          if (!matchedH) {
            const memberMatch = residents.find(r => r.full_name?.toLowerCase().includes(qClean));
            if (memberMatch) {
              matchedH = households.find(h => h.id === memberMatch.household_id);
            }
          }

          let headName = '';
          if (matchedH) {
            const head = residents.find(r => r.id === matchedH!.head_of_household_id || (r.household_id === matchedH!.id && r.is_head));
            headName = head?.full_name || matchedH.household_number;
          }

          const displayName = headName || formatDisplayName(term);
          const resp = matchedH
            ? `Dạ, em chuyển đến hộ ông bà ${displayName} ngay đây ạ!`
            : `Dạ, em đang tìm và chuyển đến hộ ${formatDisplayName(term)} ngay ạ!`;

          setAssistantText(resp);
          speakVietnameseAudio(resp);
          triggerSearchAndJump('households', term, matchedH?.id);
          return;
        } catch (e) {
          console.error(e);
        }
      }
    }

    // 2. TÌM KIẾM HOẶC CHUYỂN ĐẾN NHÂN KHẨU / DÂN CƯ / CCCD
    if (
      qLower.includes('nhân khẩu') || 
      qLower.includes('dân cư') || 
      qLower.includes('công dân') || 
      qLower.includes('căn cước') || 
      qLower.includes('cccd') ||
      (currentTab === 'residents' && hasSearchKeyword)
    ) {
      const isPureNav = ['nhân khẩu', 'dân cư', 'công dân', 'hộ khẩu', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở danh sách nhân khẩu ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('residents');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }

      if (term.length >= 2) {
        try {
          const residents = await db.getResidents();
          const qClean = term.toLowerCase().trim();
          const matchedR = residents.find(r => 
            r.full_name?.toLowerCase().includes(qClean) ||
            r.cccd?.includes(qClean) ||
            r.phone?.includes(qClean)
          );

          const displayName = matchedR?.full_name || formatDisplayName(term);
          const resp = matchedR 
            ? `Dạ, em chuyển đến thông tin nhân khẩu ${displayName} ngay đây ạ!`
            : `Dạ, em đang tìm nhân khẩu ${formatDisplayName(term)} ngay ạ!`;

          setAssistantText(resp);
          speakVietnameseAudio(resp);
          triggerSearchAndJump('residents', term, matchedR?.id);
          return;
        } catch (e) {
          console.error(e);
        }
      }
    }

    // 3. TẠM TRÚ – TẠM VẮNG
    if (
      qLower.includes('tạm trú') || 
      qLower.includes('tạm vắng') || 
      qLower.includes('lưu trú') ||
      (currentTab === 'residents-temp' && hasSearchKeyword)
    ) {
      const isPureNav = ['tạm trú', 'tạm vắng', 'lưu trú', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở mục tạm trú tạm vắng ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('residents-temp');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến danh sách tạm trú của ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('residents-temp', term);
      return;
    }

    // 4. BIẾN ĐỘNG DÂN CƯ
    if (
      qLower.includes('biến động') || 
      qLower.includes('thay đổi dân cư') || 
      qLower.includes('di biến động') ||
      (currentTab === 'residents-changes' && hasSearchKeyword)
    ) {
      const isPureNav = ['biến động', 'thay đổi', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở mục biến động dân cư ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('residents-changes');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em mở biến động dân cư của ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('residents-changes', term);
      return;
    }

    // 5. THU CHI TDP / TÀI CHÍNH TỔ DÂN PHỐ / ĐÓNG QUỸ
    if (
      qLower.includes('thu chi') ||
      qLower.includes('tài chính') ||
      qLower.includes('quỹ tổ dân phố') ||
      qLower.includes('quỹ tdp') ||
      qLower.includes('sổ thu chi') ||
      qLower.includes('tiền quỹ') ||
      qLower.includes('đóng quỹ') ||
      qLower.includes('nộp quỹ') ||
      (currentTab === 'finance' && hasSearchKeyword)
    ) {
      const isPureNav = ['thu chi', 'tài chính', 'quỹ', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở thu chi tổ dân phố ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('finance');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến mục thu chi của ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('finance', term);
      return;
    }

    // 6. QUỸ NỘP PHƯỜNG
    if (
      qLower.includes('nộp phường') ||
      qLower.includes('quỹ phường') ||
      (qLower.includes('quỹ') && qLower.includes('phường')) ||
      (currentTab === 'ward-funds' && hasSearchKeyword)
    ) {
      const isPureNav = ['quỹ', 'phường', 'nộp phường', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở quỹ nộp phường ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('ward-funds');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến quỹ nộp phường của ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('ward-funds', term);
      return;
    }

    // 7. THỦ QUỸ
    if (
      qLower.includes('thủ quỹ') || 
      qLower.includes('tiền mặt') || 
      qLower.includes('bàn giao quỹ') ||
      (currentTab === 'treasurer' && (hasSearchKeyword || term.length >= 2))
    ) {
      const resp = 'Dạ, em mở mục thủ quỹ ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('treasurer');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 8. MẠNH THƯỜNG QUÂN / TÀI TRỢ / ỦNG HỘ
    if (
      qLower.includes('mạnh thường quân') ||
      qLower.includes('tài trợ') ||
      qLower.includes('ủng hộ') ||
      qLower.includes('đóng góp') ||
      qLower.includes('xã hội hóa') ||
      (currentTab === 'sponsors' && hasSearchKeyword)
    ) {
      const isPureNav = ['mạnh thường quân', 'tài trợ', 'ủng hộ', 'đóng góp', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở danh sách mạnh thường quân ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('sponsors');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến danh sách ủng hộ của ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('sponsors', term);
      return;
    }

    // 9. HỘI NGƯỜI CAO TUỔI / MỪNG THỌ
    if (
      qLower.includes('người cao tuổi') ||
      qLower.includes('cao tuổi') ||
      qLower.includes('người già') ||
      qLower.includes('mừng thọ') ||
      (currentTab === 'elderly' && hasSearchKeyword)
    ) {
      const isPureNav = ['người cao tuổi', 'cao tuổi', 'mừng thọ', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở hội người cao tuổi ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('elderly');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến danh sách người cao tuổi ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('elderly', term);
      return;
    }

    // 10. HỘI CỰU CHIẾN BINH
    if (
      qLower.includes('cựu chiến binh') || 
      qLower.includes('ccb') ||
      (currentTab === 'ccb' && hasSearchKeyword)
    ) {
      const isPureNav = ['cựu chiến binh', 'ccb', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở hội cựu chiến binh ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('ccb');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến hội viên cựu chiến binh ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('ccb', term);
      return;
    }

    // 11. CHI BỘ ĐẢNG (ĐẢNG VIÊN)
    if (
      qLower.includes('chi bộ') ||
      qLower.includes('đảng viên') ||
      qLower.includes('đảng bộ') ||
      qLower.includes('hồ sơ đảng') ||
      (currentTab === 'party-cell' && hasSearchKeyword)
    ) {
      const isPureNav = ['chi bộ', 'đảng viên', 'đảng bộ', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở mục chi bộ Đảng ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('party-cell');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến thông tin đảng viên ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('party-cell', term);
      return;
    }

    // 12. GIA ĐÌNH CHÍNH SÁCH / HỘ NGHÈO
    if (
      qLower.includes('chính sách') ||
      qLower.includes('hộ nghèo') ||
      qLower.includes('cận nghèo') ||
      qLower.includes('người có công') ||
      qLower.includes('thương binh') ||
      (currentTab === 'policy' && hasSearchKeyword)
    ) {
      const isPureNav = ['chính sách', 'hộ nghèo', 'cận nghèo', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở mục gia đình chính sách ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('policy');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em chuyển đến gia đình chính sách ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('policy', term);
      return;
    }

    // 13. BẢN ĐỒ SỐ DÂN CƯ
    if (
      qLower.includes('bản đồ') || 
      qLower.includes('vị trí') ||
      (currentTab === 'map' && hasSearchKeyword)
    ) {
      const isPureNav = ['bản đồ', 'vị trí', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở bản đồ số dân cư ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('map');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em định vị ${formatDisplayName(term)} trên bản đồ ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('map', term);
      return;
    }

    // 14. AN NINH TRẬT TỰ / TỔ LIÊN GIA
    if (
      qLower.includes('an ninh') ||
      qLower.includes('trật tự') ||
      qLower.includes('tổ liên gia') ||
      qLower.includes('phòng cháy') ||
      qLower.includes('pccc') ||
      qLower.includes('camera') ||
      (currentTab === 'security' && (hasSearchKeyword || term.length >= 2))
    ) {
      const resp = 'Dạ, em mở mục an ninh trật tự ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('security');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 15. Y TẾ & SỨC KHỎE
    if (
      qLower.includes('y tế') ||
      qLower.includes('sức khỏe') ||
      qLower.includes('tiêm chủng') ||
      qLower.includes('bảo hiểm y tế') ||
      qLower.includes('khám bệnh') ||
      (currentTab === 'healthcare' && (hasSearchKeyword || term.length >= 2))
    ) {
      const resp = 'Dạ, em mở mục y tế và sức khỏe ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('healthcare');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 16. HỌP CHI BỘ ĐẢNG (BIÊN BẢN / LỊCH HỌP)
    if (
      qLower.includes('họp chi bộ') ||
      qLower.includes('lịch họp chi bộ') ||
      qLower.includes('biên bản họp chi bộ') ||
      qLower.includes('họp đảng') ||
      qLower.includes('sinh hoạt chi bộ')
    ) {
      const resp = 'Dạ, em mở lịch họp chi bộ Đảng ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('meetings-party');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 17. BAN CÔNG TÁC MẶT TRẬN (LỊCH HỌP / BIÊN BẢN)
    if (
      qLower.includes('mặt trận') ||
      qLower.includes('họp mặt trận') ||
      qLower.includes('ban công tác mặt trận')
    ) {
      const resp = 'Dạ, em mở ban công tác mặt trận ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('meetings-front');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 18. HỌP TỔ DÂN PHỐ / BIÊN BẢN HỌP
    if (
      qLower.includes('họp tổ') ||
      qLower.includes('cuộc họp') ||
      qLower.includes('biên bản họp') ||
      qLower.includes('sổ họp') ||
      qLower.includes('lịch họp')
    ) {
      const resp = 'Dạ, em mở sổ họp tổ dân phố ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('meetings');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 19. HỘI NÔNG DÂN
    if (qLower.includes('nông dân') || qLower.includes('hội nông dân')) {
      const resp = 'Dạ, em mở hội nông dân ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('farmers-association');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 20. HỘI PHỤ NỮ
    if (qLower.includes('phụ nữ') || qLower.includes('hội phụ nữ')) {
      const resp = 'Dạ, em mở hội phụ nữ ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('women-association');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 21. ĐOÀN THANH NIÊN
    if (qLower.includes('thanh niên') || qLower.includes('đoàn thanh niên') || qLower.includes('đoàn viên')) {
      const resp = 'Dạ, em mở đoàn thanh niên ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('youth-union');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 22. CÔNG VĂN CỦA PHƯỜNG
    if (
      qLower.includes('công văn phường') ||
      qLower.includes('công văn của phường') ||
      (qLower.includes('công văn') && qLower.includes('phường')) ||
      (currentTab === 'ward-documents' && hasSearchKeyword)
    ) {
      const isPureNav = ['công văn', 'phường', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở công văn của phường ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('ward-documents');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em tìm công văn phường về ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('ward-documents', term);
      return;
    }

    // 23. VĂN BẢN - NGHỊ QUYẾT
    if (
      qLower.includes('văn bản') ||
      qLower.includes('nghị quyết') ||
      qLower.includes('công văn') ||
      (currentTab === 'documents' && hasSearchKeyword)
    ) {
      const isPureNav = ['văn bản', 'nghị quyết', 'công văn', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở văn bản nghị quyết ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('documents');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em tìm văn bản ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('documents', term);
      return;
    }

    // 24. MẪU GIẤY MỜI
    if (
      qLower.includes('giấy mời') ||
      qLower.includes('mẫu giấy mời') ||
      qLower.includes('in giấy mời') ||
      qLower.includes('thư mời')
    ) {
      const resp = 'Dạ, em mở mẫu giấy mời ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('invitation-templates');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 25. QUY ĐỊNH & NHIỆM VỤ
    if (qLower.includes('quy định') || qLower.includes('nhiệm vụ') || qLower.includes('quy chế')) {
      const resp = 'Dạ, em mở mục quy định và nhiệm vụ ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('regulations');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 26. PHẢN ÁNH KIẾN NGHỊ
    if (
      qLower.includes('phản ánh') ||
      qLower.includes('kiến nghị') ||
      qLower.includes('khiếu nại') ||
      qLower.includes('tâm tư') ||
      (currentTab === 'complaints' && hasSearchKeyword)
    ) {
      const isPureNav = ['phản ánh', 'kiến nghị', 'khiếu nại', ''].includes(term.toLowerCase()) && !hasSearchKeyword;
      if (isPureNav) {
        const resp = 'Dạ, em mở mục phản ánh kiến nghị ngay ạ!';
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        onNavigate('complaints');
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
        return;
      }
      const resp = `Dạ, em tìm phản ánh kiến nghị về ${formatDisplayName(term)} ngay ạ!`;
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      triggerSearchAndJump('complaints', term);
      return;
    }

    // 27. TRỢ LÝ AI
    if (qLower.includes('trợ lý ai') || qLower.includes('ai trợ lý') || qLower.includes('hỏi đáp ai')) {
      const resp = 'Dạ, em mở trợ lý AI ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('ai-assistant');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 28. CÀI ĐẶT / CẤU HÌNH
    if (
      qLower.includes('cài đặt') ||
      qLower.includes('cấu hình') ||
      qLower.includes('thiết lập')
    ) {
      const resp = 'Dạ, em mở cài đặt hệ thống ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('settings');
      return;
    }

    // 29. BẢNG ĐIỀU KHIỂN / TRANG CHỦ / TỔNG QUAN
    if (
      qLower.includes('trang chủ') ||
      qLower.includes('bảng điều khiển') ||
      qLower.includes('tổng quan') ||
      qLower.includes('bảng tin') ||
      qLower.includes('màn hình chính')
    ) {
      const resp = 'Dạ, em về bảng điều khiển ngay ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      onNavigate('Bảng điều khiển');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200);
      return;
    }

    // 30. TÌM KIẾM TỔNG QUÁT (Khi người dùng nói "tìm [tên]" mà chưa rõ phân hệ)
    if (hasSearchKeyword && term.length >= 2) {
      try {
        const [households, residents] = await Promise.all([
          db.getHouseholds(),
          db.getResidents()
        ]);
        const qClean = term.toLowerCase().trim();

        // 1. Kiểm tra xem có khớp hộ gia đình nào không
        const matchedH = households.find(h => {
          const head = residents.find(r => r.id === h.head_of_household_id || (r.household_id === h.id && r.is_head));
          return head?.full_name?.toLowerCase().includes(qClean) || (h.household_number || '').toLowerCase().includes(qClean);
        });

        if (matchedH) {
          const head = residents.find(r => r.id === matchedH.head_of_household_id || (r.household_id === matchedH.id && r.is_head));
          const headName = head?.full_name || matchedH.household_number;
          const resp = `Dạ, em chuyển đến hộ ông bà ${headName} ngay đây ạ!`;
          setAssistantText(resp);
          speakVietnameseAudio(resp);
          triggerSearchAndJump('households', term, matchedH.id);
          return;
        }

        // 2. Kiểm tra xem có khớp nhân khẩu nào không
        const matchedR = residents.find(r => 
          r.full_name?.toLowerCase().includes(qClean) ||
          r.cccd?.includes(qClean)
        );

        if (matchedR) {
          const resp = `Dạ, em chuyển đến thông tin nhân khẩu ${matchedR.full_name} ngay đây ạ!`;
          setAssistantText(resp);
          speakVietnameseAudio(resp);
          triggerSearchAndJump('residents', term, matchedR.id);
          return;
        }

        // Mặc định chuyển sang danh sách nhân khẩu để tìm kiếm rộng
        const resp = `Dạ, em tìm kiếm thông tin của ${formatDisplayName(term)} ngay ạ!`;
        setAssistantText(resp);
        speakVietnameseAudio(resp);
        triggerSearchAndJump('residents', term);
        return;
      } catch (e) {
        console.error(e);
      }
    }

    // LỜI THOẠI THÔNG THƯỜNG / CHÀO HỎI
    if (qLower.includes('chào') || qLower.includes('alo') || qLower.includes('ơi')) {
      const resp = 'Dạ, em chào anh chị! Em là trợ lý của anh Nguyễn Kim Tuyến - Tổ dân phố Quảng Giao. Em đang lắng nghe đây ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    // TƯ VẤN THỦ TỤC HÀNH CHÍNH & KIẾN THỨC NỘI BỘ
    if (qLower.includes('vneid') || qLower.includes('định danh') || qLower.includes('mức 2')) {
      const resp = 'Dạ, để kích hoạt định danh điện tử VNeID mức 2, anh chị mang theo thẻ CCCD gắn chip đến Công an phường để được lăn tay và chụp ảnh xác thực nhé ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    if (qLower.includes('bảo hiểm y tế') || qLower.includes('bhyt')) {
      const resp = 'Dạ, thẻ bảo hiểm y tế hiện nay đã được tích hợp trực tiếp vào thẻ CCCD và ứng dụng VNeID, khi đi khám chữa bệnh bà con chỉ cần xuất trình CCCD là được ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    if (qLower.includes('tạm trú') || qLower.includes('đăng ký tạm trú')) {
      const resp = 'Dạ, thủ tục đăng ký tạm trú anh chị có thể thực hiện trực tuyến qua Cổng Dịch vụ công Quốc gia hoặc đến trực tiếp Công an phường ạ!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    if (qLower.includes('em là ai') || qLower.includes('bạn là ai') || qLower.includes('giới thiệu')) {
      const resp = 'Dạ, em là trợ lý ảo thông minh của Tổ dân phố Quảng Giao, được lập trình để đồng hành cùng anh Nguyễn Kim Tuyến và bà con trong mọi công tác quản lý và tra cứu thông tin dân cư!';
      setAssistantText(resp);
      speakVietnameseAudio(resp);
      return;
    }

    // LỆNH MẶC ĐỊNH
    const defaultResp = geminiKey 
      ? 'Dạ, em đang lắng nghe đây ạ, anh chị có thể nói lại rõ hơn giúp em được không ạ?' 
      : 'Dạ, em đang lắng nghe đây ạ! Để em có thể trò chuyện thông minh như người thật và trả lời mọi lĩnh vực trên thế giới, anh chị bấm vào biểu tượng ngôi sao ✨ dưới chân em để cài đặt khoá Gemini miễn phí nhé!';
    setAssistantText(defaultResp);
    speakVietnameseAudio(defaultResp);
  };

  handleUserQueryRef.current = handleUserQuery;


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
          if (isSpeaking) {
            // Đang nói -> Click vào để ngắt lời ngay lập tức
            interruptSpeaking();
            return;
          }
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
        title={isSpeaking ? "Bấm vào để ngắt lời trợ lý!" : "Bấm vào để nói chuyện với trợ lý!"}
      >
        {/* Nút ngắt lời nổi khi trợ lý đang phát âm thanh */}
        {isSpeaking && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              interruptSpeaking();
            }}
            style={{
              position: 'absolute',
              top: '-36px',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: '700',
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '2px solid rgba(255, 255, 255, 0.95)',
              cursor: 'pointer',
              zIndex: 100,
              animation: 'bounceTap 1.2s infinite'
            }}
            title="Bấm vào đây hoặc nhấn phím CÁCH (Space) để cắt lời và nói ngay"
          >
            <Square size={11} fill="white" />
            <span>🛑 Bấm / Phím Cách để ngắt lời</span>
          </div>
        )}
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

          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nút xem Sổ tay Ký ức / Trí nhớ */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMemories(getAssistantMemories());
              setShowMemoriesModal(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title={`Sổ tay ký ức (${memories.length} điều đã ghi nhớ)`}
          >
            <Brain size={12} />
          </button>

          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          {/* Nút cài đặt Google Gemini AI */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowApiKeyModal(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title="Cài đặt Google Gemini AI (Miễn phí 100%)"
          >
            <Sparkles size={12} />
          </button>
        </div>
      </div>

      {/* MODAL CÀI ĐẶT GOOGLE GEMINI API KEY MIỄN PHÍ 100% */}
      {showApiKeyModal && (
        <div 
          onClick={() => setShowApiKeyModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              animation: 'fadeInUp 0.25s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Cấu hình Trí tuệ Nhân tạo Gemini
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                    ✨ Hoàn toàn miễn phí 100% vĩnh viễn
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.82rem',
              color: '#166534',
              lineHeight: 1.5
            }}>
              <strong>Trợ lý siêu trí tuệ:</strong> Khi có khóa Gemini, trợ lý sẽ giao tiếp lưu loát như người thật, hiểu mọi câu nói tự do và giải đáp mọi lĩnh vực trên thế giới.
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Khoá Google Gemini API Key:
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showKeyPassword ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setApiKeySavedStatus('');
                  }}
                  placeholder="Dán mã API Key (ví dụ: AIzaSy...)"
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.86rem',
                    outline: 'none',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassword(!showKeyPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showKeyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {apiKeySavedStatus && (
                <div style={{ 
                  marginTop: '6px', 
                  fontSize: '0.78rem', 
                  color: apiKeySavedStatus.includes('thành công') ? '#16a34a' : '#ef4444',
                  fontWeight: 600
                }}>
                  {apiKeySavedStatus}
                </div>
              )}
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '0.78rem',
              color: '#475569',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Cách lấy Key miễn phí (mất 30 giây):</div>
              <div>1. Truy cập: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}>aistudio.google.com/app/apikey <ExternalLink size={11} style={{ display: 'inline' }} /></a></div>
              <div>2. Đăng nhập tài khoản Gmail bất kỳ.</div>
              <div>3. Bấm <strong>"Create API key"</strong> rồi copy mã dán vào ô trên.</div>
              <div style={{ color: '#059669', marginTop: '2px' }}>✓ Không cần thẻ ngân hàng, hoàn toàn miễn phí 100%.</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={isTestingKey}
                onClick={async () => {
                  const key = apiKeyInput.trim();
                  if (!key) {
                    setApiKeySavedStatus('Vui lòng nhập mã API Key trước khi thử!');
                    return;
                  }
                  setIsTestingKey(true);
                  setApiKeySavedStatus('Đang kiểm tra kết nối với Gemini...');
                  setGeminiApiKey(key);
                  try {
                    const testReply = await askGemini('Xin chào, bạn là trợ lý thông minh đúng không?');
                    if (testReply) {
                      setApiKeySavedStatus('✓ Kết nối thành công! Trợ lý đã sẵn sàng trò chuyện.');
                      const resp = 'Dạ, kết nối Google Gemini thành công rồi ạ! Em đã sẵn sàng phục vụ anh chị!';
                      setAssistantText(resp);
                      speakVietnameseAudio(resp);
                    } else {
                      setApiKeySavedStatus('⚠️ Không nhận được phản hồi, vui lòng kiểm tra lại mã Key.');
                    }
                  } catch (e: any) {
                    setApiKeySavedStatus(`⚠️ Lỗi: ${e?.message || 'Không thể kết nối'}`);
                  } finally {
                    setIsTestingKey(false);
                  }
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isTestingKey ? 'Đang thử...' : 'Kiểm tra Key'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const key = apiKeyInput.trim();
                  setGeminiApiKey(key);
                  setApiKeySavedStatus('✓ Đã lưu mã API Key thành công!');
                  const resp = 'Dạ, em đã lưu cài đặt thành công rồi ạ!';
                  setAssistantText(resp);
                  speakVietnameseAudio(resp);
                  setTimeout(() => setShowApiKeyModal(false), 900);
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
                }}
              >
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỔ TAY KÝ ỨC / TRÍ NHỚ CỦA TRỢ LÝ ẢO */}
      {showMemoriesModal && (
        <div 
          onClick={() => setShowMemoriesModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              animation: 'fadeInUp 0.25s ease-out'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Brain size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Sổ tay Ký ức Trợ lý Ảo
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Trợ lý tự động ghi nhớ và đối đáp theo thông tin của anh Tuyến
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMemoriesModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Input thêm nhanh ghi nhớ */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={newMemoryInput}
                onChange={(e) => setNewMemoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMemoryInput.trim()) {
                    const updated = saveAssistantMemory({ category: 'note', content: newMemoryInput.trim() });
                    setMemories(updated);
                    setNewMemoryInput('');
                  }
                }}
                placeholder="Dặn dò trợ lý ghi nhớ điều gì... (VD: Chiều mai 3h nộp báo cáo)"
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newMemoryInput.trim()) {
                    const updated = saveAssistantMemory({ category: 'note', content: newMemoryInput.trim() });
                    setMemories(updated);
                    setNewMemoryInput('');
                  }
                }}
                style={{
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0 14px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={16} />
                <span>Nhớ</span>
              </button>
            </div>

            {/* Danh sách ký ức cuộn */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '140px' }}>
              {memories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Chưa có ký ức nào được lưu. Bạn có thể nói với trợ lý: "Em nhớ giúp anh là..." hoặc gõ dặn dò ở ô trên nhé!
                </div>
              ) : (
                memories.map((m) => (
                  <div 
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: m.category === 'task' ? '#dbeafe' : m.category === 'profile' ? '#fef3c7' : '#ede9fe',
                          color: m.category === 'task' ? '#1e40af' : m.category === 'profile' ? '#92400e' : '#6b21a8'
                        }}>
                          {m.category === 'task' ? 'LỊCH HẸN / VIỆC CẦN LÀM' : m.category === 'profile' ? 'THÔNG TIN CÁ NHÂN' : 'GHI CHÚ'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.4 }}>
                        {m.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = removeAssistantMemory(m.id);
                        setMemories(updated);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7
                      }}
                      title="Xóa ký ức này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Anh có chắc muốn xóa toàn bộ sổ tay ký ức của trợ lý không?')) {
                    clearAssistantMemories();
                    setMemories([]);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Xóa toàn bộ ký ức
              </button>
              <button
                type="button"
                onClick={() => setShowMemoriesModal(false)}
                style={{
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '7px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
