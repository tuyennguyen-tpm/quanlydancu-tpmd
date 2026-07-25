let cachedViVoice: SpeechSynthesisVoice | null = null;

const findViVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi') && v.name.toLowerCase().includes('google')) ||
    voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) ||
    voices.find(v => v.lang.toLowerCase().includes('vi')) ||
    voices.find(v => v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt') || v.name.toLowerCase().includes('hoaimy')) ||
    null
  );
};

const initVoices = () => {
  const vi = findViVoice();
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

  // 1. Dừng mọi âm thanh / giọng nói cũ đang phát
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
      (window as any)._currentAudioTts = null;
    }
  } catch {}

  let hasSpokenWeb = false;

  // 2. Thử phát giọng Tiếng Việt qua Web Speech API nếu tìm thấy đúng giọng Tiếng Việt
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      initVoices();
      const viVoice = cachedViVoice || findViVoice();

      if (viVoice) {
        const msg = new SpeechSynthesisUtterance(cleanText);
        msg.voice = viVoice;
        msg.lang = 'vi-VN';
        msg.rate = 0.95;
        msg.pitch = 1.0;
        window.speechSynthesis.speak(msg);
        hasSpokenWeb = true;
      }
    } catch (err) {
      console.warn('[TTS WebSpeech Error]', err);
    }
  }

  // 3. Phát luồng Audio giọng Tiếng Việt trực tuyến (chất lượng cao)
  const encodedText = encodeURIComponent(cleanText);
  const audioUrls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`,
    `https://api.responsivevoice.org/v1/text:speak?text=${encodedText}&lang=vi&key=free`,
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`
  ];

  let urlIndex = 0;
  const playAudioStream = () => {
    if (urlIndex >= audioUrls.length) return;

    const audio = new Audio(audioUrls[urlIndex]);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        console.warn(`[TTS Audio URL ${urlIndex} autoplay error, try next]`, err);
        urlIndex++;
        playAudioStream();
      });
    }
  };

  playAudioStream();
};
