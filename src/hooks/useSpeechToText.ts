import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const {
    lang = 'vi-VN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            currentInterim += result[0].transcript;
          }
        }

        if (finalText) {
          setTranscript((prev) => {
            const next = prev ? `${prev} ${finalText.trim()}` : finalText.trim();
            if (onResult) onResult(next, true);
            return next;
          });
          setInterimTranscript('');
        } else {
          setInterimTranscript(currentInterim);
          if (onResult && currentInterim) onResult(currentInterim, false);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('[SpeechRecognition Error]', event.error);
        let errMessage = 'Có lỗi xảy ra khi nhận diện giọng nói';
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errMessage = 'Quyền truy cập Micro bị từ chối. Vui lòng cấp quyền Micro trong cài đặt.';
        } else if (event.error === 'no-speech') {
          errMessage = 'Không phát hiện giọng nói. Vui lòng thử lại.';
        } else if (event.error === 'network') {
          errMessage = 'Lỗi kết nối mạng khi nhận diện giọng nói.';
        }
        setError(errMessage);
        if (onError) onError(errMessage);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[SpeechRecognition Init Error]', e);
      setIsSupported(false);
    }
  }, [lang, continuous, interimResults, onResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      recognitionRef.current.start();
    } catch (e) {
      console.warn('[SpeechRecognition Start Error]', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn('[SpeechRecognition Stop Error]', e);
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
