let cachedViVoice: SpeechSynthesisVoice | null = null;

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

  // 2. Kích hoạt Web Speech API giọng Tiếng Việt (Hoạt động 100% không lo bị trình duyệt chặn autoplay Audio)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      initVoices();
      const voices = window.speechSynthesis.getVoices();
      const viVoice = cachedViVoice 
        || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi') && v.name.toLowerCase().includes('google'))
        || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'))
        || voices.find(v => v.lang.toLowerCase().includes('vi'));

      const msg = new SpeechSynthesisUtterance(cleanText);
      msg.lang = 'vi-VN';
      msg.rate = 0.95;
      msg.pitch = 1.0;

      if (viVoice) {
        msg.voice = viVoice;
      }

      window.speechSynthesis.speak(msg);
    } catch (err) {
      console.warn('[TTS WebSpeech Error]', err);
    }
  }

  // 3. Đồng thời phát file âm thanh chị Google Tiếng Việt trực tuyến (chất lượng cao)
  try {
    const encodedText = encodeURIComponent(cleanText);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`;
    const audio = new Audio(audioUrl);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Nếu trình duyệt chặn phát Audio tự động, thử với client tw-ob
        const audio2 = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`);
        audio2.volume = 1.0;
        audio2.play().catch(() => {});
      });
    }
  } catch (err) {
    console.warn('[TTS Audio Error]', err);
  }
};
