// Tạo tệp âm thanh tiếng Chuông Ting-Ting (PCM WAV 44.1kHz 16-bit) nguyên bản bằng JavaScript
export const getTingChimeDataUrl = (): string => {
  const sampleRate = 44100;
  const duration = 0.5;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Uint8Array(44 + numSamples * 2);
  const view = new DataView(buffer.buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      buffer[offset + i] = string.charCodeAt(i);
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Nốt 1 (C6 - 1046.5Hz) & Nốt 2 (E6 - 1318.5Hz) ngân bổng to rõ
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    if (t < 0.4) {
      const envelope1 = Math.exp(-t * 7);
      sample += Math.sin(2 * Math.PI * 1046.5 * t) * envelope1 * 0.8;
    }
    if (t >= 0.08) {
      const t2 = t - 0.08;
      const envelope2 = Math.exp(-t2 * 7);
      sample += Math.sin(2 * Math.PI * 1318.5 * t) * envelope2 * 0.8;
    }

    const val = Math.max(-1, Math.min(1, sample));
    const intVal = val < 0 ? val * 0x8000 : val * 0x7FFF;
    view.setInt16(44 + i * 2, intVal, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
};

let cachedChimeUrl: string | null = null;

export const speakVietnamese = (_textToSpeak?: string) => {
  // 1. Tắt 100% các giọng đọc lời thoại
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}

  // 2. Phát tiếng chuông Ting-Ting bằng trình phát Audio dùng chung đã được ủy quyền
  try {
    if (!cachedChimeUrl) {
      cachedChimeUrl = getTingChimeDataUrl();
    }

    let player: HTMLAudioElement = (window as any)._globalChimeAudio;
    if (!player) {
      player = new Audio(cachedChimeUrl);
      (window as any)._globalChimeAudio = player;
    } else if (!player.src || player.src === '' || player.src.length < 50) {
      player.src = cachedChimeUrl;
    }

    player.currentTime = 0;
    player.volume = 1.0;

    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[HTML5 Audio Autoplay Notice]', err);
      });
    }
  } catch (e) {
    console.warn('[Notification Chime Error]', e);
  }
};
