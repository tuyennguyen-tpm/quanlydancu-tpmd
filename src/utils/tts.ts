export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  // 1. Chuẩn hóa từ ngữ viết tắt và loại bỏ emoji để giọng đọc Chị Google Nữ phát âm mượt nhất
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
    cleanText = cleanText.slice(0, 180);
  }

  const encodedText = encodeURIComponent(cleanText);

  // 2. Dừng phát âm thanh/giọng nói cũ
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._currentAudioTts) {
      (window as any)._currentAudioTts.pause();
      (window as any)._currentAudioTts = null;
    }
  } catch {}

  // 3. Phát âm thanh tiếng Chuông Ting-Ting ngân bổng (Web Audio Oscillator C6 note)
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = (window as any)._globalAudioCtx || new AudioContext();
      (window as any)._globalAudioCtx = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Nốt 1: Ting (C6 - 1046.5Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.50, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Nốt 2: Ting ngân bổng nhẹ (E6 - 1318.5Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.65);
    }
  } catch (e) {
    console.warn('[TTS] Lỗi phát tiếng ting:', e);
  }

  // 4. Phát giọng đọc Chị Google Nữ chuẩn Tiếng Việt sau 400ms khi tiếng Ting ngân xong
  setTimeout(() => {
    const googleGtxUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`;
    const googleTwUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;

    const audio = new Audio(googleGtxUrl);
    audio.volume = 1.0;
    (window as any)._currentAudioTts = audio;

    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        const audio2 = new Audio(googleTwUrl);
        audio2.volume = 1.0;
        (window as any)._currentAudioTts = audio2;
        audio2.play().catch(() => {
          // Fallback giọng Việt trong trình duyệt nếu MP3 bị chặn
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
        });
      });
    }
  }, 400);
};
