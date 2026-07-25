export const speakVietnamese = (_textToSpeak?: string) => {
  // 1. Tắt hoàn toàn tất cả giọng đọc cũ
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}

  // 2. Phát âm thanh tiếng Chuông Ting-Ting bổng rõ ràng 100%
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    let ctx: AudioContext = (window as any)._globalAudioCtx;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
      (window as any)._globalAudioCtx = ctx;
    }

    const runTone = () => {
      try {
        const now = ctx.currentTime;

        // Nốt 1: Ting bổng (C6 - 1046.5Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1046.50, now);
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        // Nốt 2: Ting ngân (E6 - 1318.5Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now + 0.15);
        gain2.gain.setValueAtTime(0.5, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.75);
      } catch (err) {
        console.warn('[Tone Run Error]', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        runTone();
      }).catch(() => {
        runTone();
      });
    } else {
      runTone();
    }
  } catch (e) {
    console.warn('[Notification Chime Error]', e);
  }
};
