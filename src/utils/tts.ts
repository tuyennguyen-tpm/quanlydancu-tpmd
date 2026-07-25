export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  // 1. Chuẩn hóa từ ngữ viết tắt và loại bỏ emoji để giọng đọc Chị Google Nữ phát âm mượt mà nhất
  let cleanText = textToSpeak
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/TDP/gi, 'Tổ dân phố')
    .replace(/UBND/gi, 'Ủy ban nhân dân')
    .replace(/vnid/gi, 'V N I D')
    .replace(/HDND/gi, 'Hội đồng nhân dân')
    .replace(/UBMT/gi, 'Ủy ban Mặt trận')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length > 180) {
    cleanText = cleanText.slice(0, 180) + '...';
  }

  const encodedText = encodeURIComponent(cleanText);

  // 2. Dừng phát âm thanh cũ
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
      (window as any)._currentAudioTts = null;
    }
  } catch {}

  // 3. Ưu tiên 100% Giọng đọc Chị Google Nữ chuẩn Tiếng Việt (Google Translate Female Voice MP3)
  const googleVoiceUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;
  const googleGtxUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`;

  const playGoogleVoice = (url: string, fallbackUrl?: string) => {
    const audio = new Audio(url);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        console.warn('[TTS Google Voice Autoplay Playback Error]', err);
        if (fallbackUrl) {
          playGoogleVoice(fallbackUrl);
        } else {
          // Fallback nếu trình duyệt chặn hoàn toàn luồng MP3
          if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(cleanText);
            msg.lang = 'vi-VN';
            msg.rate = 0.95;
            msg.pitch = 1.0;
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) ||
                            voices.find(v => v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt'));
            if (viVoice) msg.voice = viVoice;
            window.speechSynthesis.speak(msg);
          }
        }
      });
    }
  };

  playGoogleVoice(googleVoiceUrl, googleGtxUrl);
};
