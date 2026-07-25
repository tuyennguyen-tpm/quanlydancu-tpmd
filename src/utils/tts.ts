export const speakVietnamese = (textToSpeak: string) => {
  if (!textToSpeak) return;

  // Giới hạn độ dài câu đọc 200 ký tự để phát âm thanh nhanh nhất
  const cleanText = textToSpeak.slice(0, 200);
  const encodedText = encodeURIComponent(cleanText);

  // 1. Dừng mọi phát âm thanh cũ
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if ((window as any)._ttsAudio) {
      (window as any)._ttsAudio.pause();
      (window as any)._ttsAudio.currentTime = 0;
    } else {
      (window as any)._ttsAudio = new Audio();
    }
  } catch {}

  const player: HTMLAudioElement = (window as any)._ttsAudio || new Audio();
  (window as any)._ttsAudio = player;

  // Nguồn 1: Google Translate TTS MP3 (Giọng chị Google Tiếng Việt 100% chuẩn)
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=gtx`;
  // Nguồn 2: ResponsiveVoice Vietnamese (Free)
  const responsiveVoiceUrl = `https://api.responsivevoice.org/v1/text:speak?text=${encodedText}&lang=vi&key=free`;
  // Nguồn 3: Google TTS Backup (client=tw-ob)
  const googleBackupUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;

  player.src = googleTtsUrl;
  player.volume = 1.0;

  const playPromise = player.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn('[TTS Google GTX failed, trying ResponsiveVoice]', err);
      player.src = responsiveVoiceUrl;
      player.play().catch(() => {
        console.warn('[TTS ResponsiveVoice failed, trying Google tw-ob]', err);
        player.src = googleBackupUrl;
        player.play().catch(() => {
          // Fallback cuối cùng: Dùng WebSpeech nếu hệ điều hành có giọng Tiếng Việt
          if ('speechSynthesis' in window) {
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) ||
                            voices.find(v => v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt'));
            if (viVoice) {
              const msg = new SpeechSynthesisUtterance(cleanText);
              msg.voice = viVoice;
              msg.lang = 'vi-VN';
              msg.rate = 0.95;
              msg.pitch = 1.0;
              window.speechSynthesis.speak(msg);
            } else {
              console.warn('[TTS] Không có giọng Tiếng Việt trong hệ điều hành, bỏ qua phát giọng Tiếng Anh.');
            }
          }
        });
      });
    });
  }
};
