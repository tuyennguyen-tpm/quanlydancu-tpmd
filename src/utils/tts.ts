let cachedViVoice: SpeechSynthesisVoice | null = null;

// Khởi tạo và lưu giọng đọc Tiếng Việt từ Web Speech API
const initVoices = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const vi = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi') && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'))
    || voices.find(v => v.lang.toLowerCase().includes('vi'));
  if (vi) {
    cachedViVoice = vi;
  }
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = initVoices;
  }
}

export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  const cleanText = textToSpeak.slice(0, 250);

  // 1. Dừng mọi âm thanh/giọng nói đang phát trước đó
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
      (window as any)._currentAudioTts = null;
    }
  } catch {}

  const encodedText = encodeURIComponent(cleanText);

  // 2. Thử các nguồn âm thanh giọng chuẩn Tiếng Việt trực tuyến (Google Translate client=gtx, client=tw-ob,...)
  const tryAudioTts = (urlIndex: number = 0) => {
    const urls = [
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`,
      `https://dict.youdao.com/dictvoice?audio=${encodedText}&le=vi`
    ];

    if (urlIndex >= urls.length) {
      // Nếu tất cả nguồn âm thanh online bị chặn, dùng Web Speech Synthesis nội bộ với giọng vi-VN
      speakWebSpeech(cleanText);
      return;
    }

    const audio = new Audio(urls[urlIndex]);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[TTS Audio URL ${urlIndex} failed, try next]`, err);
        tryAudioTts(urlIndex + 1);
      });
    }
  };

  // 3. Fallback Web Speech API (Chỉ phát khi tìm thấy đúng giọng Tiếng Việt, không phát giọng Tiếng Anh)
  const speakWebSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    initVoices();
    const voices = window.speechSynthesis.getVoices();
    const viVoice = cachedViVoice 
      || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi') && v.name.toLowerCase().includes('google'))
      || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'))
      || voices.find(v => v.lang.toLowerCase().includes('vi'));

    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'vi-VN';

    if (viVoice) {
      msg.voice = viVoice;
      msg.rate = 0.95;
      msg.pitch = 1;
      window.speechSynthesis.speak(msg);
    } else {
      console.warn('[TTS] Không tìm thấy giọng Tiếng Việt trong hệ thống, bỏ qua phát giọng Tiếng Anh mặc định.');
    }
  };

  tryAudioTts(0);
};
