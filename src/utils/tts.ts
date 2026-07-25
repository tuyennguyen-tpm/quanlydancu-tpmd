export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  const cleanText = textToSpeak.slice(0, 250);

  try {
    // 1. Dừng âm thanh/giọng nói đang phát cũ
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
      (window as any)._currentAudioTts = null;
    }

    const encodedText = encodeURIComponent(cleanText);

    // 2. Kích hoạt giọng nói Tiếng Việt bằng SpeechSynthesis nội bộ
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(cleanText);
      msg.lang = 'vi-VN';
      msg.rate = 0.95;
      msg.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) ||
                      voices.find(v => v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt'));
      if (viVoice) {
        msg.voice = viVoice;
      }
      window.speechSynthesis.speak(msg);
    }

    // 3. Đồng thời phát file âm thanh giọng chị Google Tiếng Việt trực tuyến
    const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;
    audio.play().catch(() => {
      // Trình duyệt tự động chặn nếu chưa có tương tác
    });
  } catch (err) {
    console.error('[TTS Error]', err);
  }
};
