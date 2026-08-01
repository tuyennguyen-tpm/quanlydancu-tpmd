import React, { useState } from 'react';
import { Mic, MicOff, Sparkles, Loader2 } from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { refineSpokenText } from '../services/ai';
import { showToast } from '../utils/toast';

interface VoiceInputButtonProps {
  /** Callback nhận văn bản nhận diện được */
  onTranscript: (text: string, mode: 'append' | 'replace') => void;
  /** Chuỗi văn bản hiện tại (dùng để nối tiếp khi thu âm hoặc để AI chuẩn hóa) */
  currentValue?: string;
  /** Chế độ mặc định khi thu âm: append (nối tiếp) hay replace (thay thế) */
  defaultMode?: 'append' | 'replace';
  /** Nhãn tooltip cho nút */
  title?: string;
  /** Kích thước icon: sm, md, lg */
  size?: 'sm' | 'md' | 'lg';
  /** Có hiển thị nút AI chuẩn hóa văn phong hay không */
  showAiRefine?: boolean;
  /** Ngữ cảnh dùng cho AI chuẩn hóa (ví dụ: biên bản cuộc họp, giấy mời, tìm kiếm) */
  aiContext?: string;
  /** Class CSS tùy chỉnh thêm */
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  currentValue = '',
  defaultMode = 'append',
  title = 'Nhập bằng giọng nói (Tiếng Việt)',
  size = 'md',
  showAiRefine = true,
  aiContext = 'biên bản cuộc họp',
  className = '',
}) => {
  const [isRefining, setIsRefining] = useState(false);

  const {
    isListening,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
  } = useSpeechToText({
    lang: 'vi-VN',
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && text.trim()) {
        onTranscript(text.trim(), defaultMode);
      }
    },
    onError: (errStr) => {
      showToast(errStr, 'danger');
    },
  });

  const handleToggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      showToast('Trình duyệt hoặc môi trường hiện tại chưa hỗ trợ nhận diện giọng nói Web Speech API.', 'danger');
      return;
    }

    if (isListening) {
      stopListening();
      showToast('Đã dừng nhận diện giọng nói', 'info');
    } else {
      startListening();
      showToast('🎙️ Đang nghe giọng nói... Bạn hãy đọc nội dung cần nhập', 'success');
    }
  };

  const handleAiRefine = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentValue.trim()) {
      showToast('Chưa có nội dung văn bản để AI chuẩn hóa.', 'info');
      return;
    }

    setIsRefining(true);
    showToast('✨ Gemini AI đang chuẩn hóa văn phong hành chính...', 'info');
    try {
      const refined = await refineSpokenText(currentValue, aiContext);
      if (refined && refined !== currentValue) {
        onTranscript(refined, 'replace');
        showToast('Đã chuẩn hóa văn phong thành công!', 'success');
      } else {
        showToast('Văn bản đã chuẩn mực, không cần điều chỉnh.', 'info');
      }
    } catch {
      showToast('Không thể chuẩn hóa văn bản lúc me.', 'danger');
    } finally {
      setIsRefining(false);
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs gap-1',
    md: 'p-2 text-sm gap-1.5',
    lg: 'p-2.5 text-base gap-2',
  }[size];

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  }[size];

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Nút Thu âm giọng nói */}
      <button
        type="button"
        onClick={handleToggleListening}
        title={isListening ? 'Dừng thu âm' : title}
        className={`relative flex items-center justify-center rounded-lg font-medium transition-all duration-200 shadow-sm border ${sizeClasses} ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse ring-2 ring-red-300'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-600'
        }`}
      >
        {isListening ? (
          <>
            <MicOff size={iconSizes} className="animate-bounce" />
            <span className="text-xs font-semibold">Đang nghe...</span>
            {/* Sóng âm nhấp nháy */}
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </>
        ) : (
          <>
            <Mic size={iconSizes} className="text-blue-600" />
            <span className="text-xs">Giọng nói</span>
          </>
        )}
      </button>

      {/* Hiển thị văn bản đang đọc trực tiếp (Interim transcript tag) */}
      {isListening && interimTranscript && (
        <span className="text-xs px-2 shadow-sm py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md animate-fade-in italic max-w-[200px] truncate">
          "{interimTranscript}..."
        </span>
      )}

      {/* Nút AI chuẩn hóa (tùy chọn) */}
      {showAiRefine && currentValue.trim().length > 5 && !isListening && (
        <button
          type="button"
          onClick={handleAiRefine}
          disabled={isRefining}
          title="Dùng Gemini AI chuẩn hóa văn bản này thành văn phong hành chính chuẩn"
          className={`flex items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm ${sizeClasses} bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border-indigo-200 hover:border-indigo-300`}
        >
          {isRefining ? (
            <Loader2 size={iconSizes} className="animate-spin text-indigo-600" />
          ) : (
            <Sparkles size={iconSizes} className="text-purple-600" />
          )}
          <span className="text-xs font-medium">AI Chuẩn hóa</span>
        </button>
      )}
    </div>
  );
};
