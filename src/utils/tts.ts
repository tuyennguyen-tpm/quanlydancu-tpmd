export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  const findViVoice = (): SpeechSynthesisVoice | null => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const vi = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
    return vi.find(v => v.name.toLowerCase().includes('google'))
      || vi.find(v => !v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('nam'))
      || vi[0] || null;
  };

  const doSpeak = (voice: SpeechSynthesisVoice | null) => {
    if (voice && 'speechSynthesis' in window) {
      // Có giọng tiếng Việt gốc từ HĐH/Trình duyệt
      const msg = new SpeechSynthesisUtterance(textToSpeak);
      msg.lang = 'vi-VN';
      msg.volume = 1;
      msg.rate = 0.95;
      msg.pitch = 1;
      msg.voice = voice;

      if (!(window as any)._globalUtterances) (window as any)._globalUtterances = [];
      (window as any)._globalUtterances.push(msg);
      msg.onend = () => { (window as any)._globalUtterances = (window as any)._globalUtterances.filter((u: any) => u !== msg); };
      msg.onerror = () => { (window as any)._globalUtterances = (window as any)._globalUtterances.filter((u: any) => u !== msg); };
      
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
      setTimeout(() => window.speechSynthesis.speak(msg), 150);
    } else {
      // HĐH (ví dụ Windows) chưa cài giọng tiếng Việt -> Dùng giọng đọc tiếng Việt online từ Google Audio API
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        if ((window as any)._currentAudioTts) {
          (window as any)._currentAudioTts.pause();
        }
        // Giới hạn 200 ký tự cho Google TTS API
        const cleanText = textToSpeak.slice(0, 200);
        const encodedText = encodeURIComponent(cleanText);
        const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;
        const audio = new Audio(audioUrl);
        (window as any)._currentAudioTts = audio;
        audio.play().catch(e => console.warn('[TTS Fallback Audio Error]', e));
      } catch (err) {
        console.error('[TTS Error]', err);
      }
    }
  };

  if ('speechSynthesis' in window) {
    const initialVoice = findViVoice();
    if (initialVoice) {
      doSpeak(initialVoice);
      return;
    }
    // Đợi 500ms để voices load nếu trình duyệt khởi động muộn
    let attempts = 0;
    const trySpeak = () => {
      const v = findViVoice();
      if (v || attempts >= 4) {
        doSpeak(v);
      } else {
        attempts++;
        setTimeout(trySpeak, 120);
      }
    };
    trySpeak();
  } else {
    doSpeak(null);
  }
};
