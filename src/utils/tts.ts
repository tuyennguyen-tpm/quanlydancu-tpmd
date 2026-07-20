export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  const cleanText = textToSpeak.slice(0, 250);

  // 1. Dùng âm thanh giọng chị Google Tiếng Việt chuẩn 100% (Google Translate TTS API)
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
    }

    const encodedText = encodeURIComponent(cleanText);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;
    const audio = new Audio(audioUrl);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[TTS Audio Autoplay Blocked, fallback to WebSpeech]', err);
        // Fallback nếu trình duyệt chặn autoplay Audio: dùng Web Speech Synthesis giọng Google
        if ('speechSynthesis' in window) {
          const voices = window.speechSynthesis.getVoices();
          const viVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi') && v.name.toLowerCase().includes('google'))
            || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
          
          const msg = new SpeechSynthesisUtterance(cleanText);
          msg.lang = 'vi-VN';
          if (viVoice) msg.voice = viVoice;
          msg.rate = 0.95;
          msg.pitch = 1;
          window.speechSynthesis.speak(msg);
        }
      });
    }
  } catch (err) {
    console.error('[TTS Error]', err);
  }
};
