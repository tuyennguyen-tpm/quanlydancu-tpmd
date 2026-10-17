import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Minus, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  Search, 
  Users, 
  Home, 
  Wallet, 
  Landmark, 
  Cake, 
  MapPin, 
  Send, 
  ArrowRight, 
  Sparkles,
  Bot
} from 'lucide-react';
import { db } from '../services/db';
import type { Resident } from '../types';

interface VirtualAssistantProps {
  isSidebarOpen: boolean;
  onNavigate: (tabId: string) => void;
  userRole?: string;
}

export const VirtualAssistant: React.FC<VirtualAssistantProps> = ({
  isSidebarOpen,
  onNavigate,
  userRole
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('assistant_voice_enabled') === 'true';
  });
  const [inputText, setInputText] = useState('');
  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [assistantMsg, setAssistantMsg] = useState('');
  const hasSpokenRef = useRef(false);

  // Lời chào theo thời gian
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Chào buổi sáng anh/chị!';
    if (hour >= 11 && hour < 14) return 'Chào buổi trưa anh/chị!';
    if (hour >= 14 && hour < 18) return 'Chào buổi chiều anh/chị!';
    return 'Chào buổi tối anh/chị!';
  };

  const initialMessage = `${getGreeting()} Em là Trợ lý Ảo TDP Quảng Giao. Hôm nay anh/chị cần mở phần nào hay muốn em kiểm tra nhân khẩu, tìm kiếm tên, tuổi, số CCCD... ạ?`;

  useEffect(() => {
    setAssistantMsg(initialMessage);

    // Chào bằng giọng nói tiếng Việt nếu bật âm thanh
    if (voiceEnabled && !hasSpokenRef.current) {
      speak(initialMessage);
      hasSpokenRef.current = true;
    }
  }, []);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      // Ưu tiên chọn voice tiếng Việt nữ nếu có
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
      if (viVoice) utterance.voice = viVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const toggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    localStorage.setItem('assistant_voice_enabled', String(nextVal));
    if (nextVal) {
      speak('Đã bật giọng nói trợ lý ảo tiếng Việt.');
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  };

  // Xử lý câu lệnh hoặc tìm kiếm thông minh
  const handleQuery = async (queryStr: string) => {
    const query = queryStr.trim().toLowerCase();
    if (!query) return;

    setInputText('');
    setIsSearching(true);
    setSearchResults([]);

    // 1. Nhận diện các lệnh điều hướng
    if (query.includes('thu chi') || query.includes('tiền quỹ') || query.includes('quỹ tdp') || query.includes('tài chính')) {
      const msg = 'Dạ, em đang mở trang Quản lý Thu chi TDP cho anh/chị nhé!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('finance');
      setIsSearching(false);
      return;
    }

    if (query.includes('quỹ phường') || query.includes('nộp phường') || query.includes('nghĩa vụ phường')) {
      const msg = 'Dạ, em chuyển ngay sang phần Quỹ nộp phường ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('ward-funds');
      setIsSearching(false);
      return;
    }

    if (query.includes('hộ gia đình') || query.includes('sổ hộ') || query.includes('danh sách hộ')) {
      const msg = 'Dạ, em mở danh sách Hộ gia đình cho anh/chị ngay đây ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('households');
      setIsSearching(false);
      return;
    }

    if (query.includes('bản đồ') || query.includes('map') || query.includes('địa lý')) {
      const msg = 'Dạ, em đang mở Bản đồ số dân cư TDP Quảng Giao ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('map');
      setIsSearching(false);
      return;
    }

    if (query.includes('mừng thọ') || query.includes('người cao tuổi') || query.includes('hội viên cao tuổi')) {
      const msg = 'Dạ, em chuyển sang mục Hội Người cao tuổi & Mừng thọ ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('elderly');
      setIsSearching(false);
      return;
    }

    if (query.includes('chính sách') || query.includes('thương binh') || query.includes('liệt sĩ')) {
      const msg = 'Dạ, em mở mục Gia đình chính sách & Người có công ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('policy');
      setIsSearching(false);
      return;
    }

    if (query.includes('đảng') || query.includes('chi bộ') || query.includes('đảng viên')) {
      const msg = 'Dạ, em mở mục Quản lý Chi bộ Đảng & Đảng viên ạ!';
      setAssistantMsg(msg);
      if (voiceEnabled) speak(msg);
      onNavigate('party-cell');
      setIsSearching(false);
      return;
    }

    // 2. Tra cứu nhân khẩu trong CSDL theo tên, tuổi, hoặc CCCD
    try {
      const allResidents = await db.getResidents();
      const currentYear = new Date().getFullYear();

      // Kiểm tra xem query có tìm theo tuổi (vd: "80 tuổi", "sinh năm 1984")
      const ageMatch = query.match(/(\d+)\s*tuổi/);
      const yearMatch = query.match(/(?:sinh\s*năm|năm\s*sinh|sn)\s*(\d{4})/);

      let filtered: Resident[] = [];

      if (ageMatch) {
        const targetAge = parseInt(ageMatch[1], 10);
        filtered = allResidents.filter(r => {
          if (!r.dob) return false;
          const y = parseInt(r.dob.slice(0, 4), 10);
          return (currentYear - y) === targetAge;
        });
      } else if (yearMatch) {
        const targetYear = yearMatch[1];
        filtered = allResidents.filter(r => r.dob && r.dob.startsWith(targetYear));
      } else {
        // Tìm theo họ tên hoặc số CCCD
        const cleanQuery = query.replace(/^tìm\s*(?:kiếm)?\s*/, '').trim();
        filtered = allResidents.filter(r => {
          const matchName = r.full_name && r.full_name.toLowerCase().includes(cleanQuery);
          const matchCccd = r.cccd && r.cccd.replace(/\s+/g, '').includes(cleanQuery);
          return matchName || matchCccd;
        });
      }

      const results = filtered.slice(0, 6); // Lấy tối đa 6 kết quả nổi bật
      setSearchResults(results);

      if (results.length > 0) {
        const reply = `Em đã tìm thấy ${filtered.length} nhân khẩu phù hợp. Dưới đây là thông tin chi tiết:`;
        setAssistantMsg(reply);
        if (voiceEnabled) speak(reply);
      } else {
        const reply = `Em chưa tìm thấy nhân khẩu nào khớp với "${queryStr}". Anh/chị có thể thử tìm theo tên đầy đủ, năm sinh hoặc số CCCD nhé!`;
        setAssistantMsg(reply);
        if (voiceEnabled) speak(reply);
      }
    } catch (e) {
      setAssistantMsg('Có lỗi xảy ra khi tra cứu dữ liệu. Anh/chị vui lòng thử lại nhé!');
    } finally {
      setIsSearching(false);
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return '';
    const y = parseInt(dob.slice(0, 4), 10);
    if (isNaN(y)) return '';
    return `${new Date().getFullYear() - y} tuổi`;
  };

  if (!isOpen) {
    // Nút mở lại trợ lý khi đã đóng
    return (
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: isSidebarOpen ? '280px' : '24px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: 'white',
          padding: '8px 16px 8px 8px',
          borderRadius: '999px',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
          border: '2px solid rgba(255, 255, 255, 0.4)'
        }}
        title="Bấm để mở Trợ lý Ảo"
      >
        <div style={{ position: 'relative', width: '36px', height: '36px' }}>
          <img 
            src="/assistant.jpg" 
            alt="Trợ lý Ảo" 
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} 
          />
          <span style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '10px',
            height: '10px',
            background: '#22c55e',
            border: '2px solid #fff',
            borderRadius: '50%'
          }} />
        </div>
        <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>Trợ lý Ảo</span>
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: isSidebarOpen ? '280px' : '24px',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}
    >
      {/* Khung chat / đối thoại của trợ lý */}
      {!isMinimized && (
        <div 
          style={{
            width: '380px',
            maxWidth: 'calc(100vw - 40px)',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            borderRadius: '20px',
            boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(2, 132, 199, 0.15)',
            border: '1.5px solid #e0f2fe',
            marginBottom: '14px',
            overflow: 'hidden',
            animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '38px', height: '38px' }}>
                <img 
                  src="/assistant.jpg" 
                  alt="Trợ lý Nữ" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff' }} 
                />
                <span style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '9px',
                  height: '9px',
                  background: '#22c55e',
                  borderRadius: '50%',
                  border: '1.5px solid #fff'
                }} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Trợ lý Ảo Quảng Giao
                  <Sparkles size={13} style={{ color: '#fef08a' }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: '#bae6fd', fontWeight: '500' }}>
                  Hỗ trợ trực tuyến TDP Quảng Giao
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button 
                onClick={toggleVoice}
                style={{
                  background: voiceEnabled ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                title={voiceEnabled ? 'Tắt giọng nói' : 'Bật giọng nói tiếng Việt'}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button 
                onClick={() => setIsMinimized(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '5px',
                  cursor: 'pointer'
                }}
                title="Thu nhỏ"
              >
                <Minus size={16} />
              </button>

              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '5px',
                  cursor: 'pointer'
                }}
                title="Đóng trợ lý"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lời thoại của trợ lý */}
          <div style={{ padding: '14px 16px', maxHeight: '340px', overflowY: 'auto' }}>
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '0.84rem',
              color: '#0369a1',
              lineHeight: '1.5',
              position: 'relative',
              marginBottom: '12px'
            }}>
              {assistantMsg}
            </div>

            {/* Danh sách kết quả tra cứu nhân khẩu */}
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Kết quả tra cứu ({searchResults.length}):
                </div>
                {searchResults.map((res) => (
                  <div 
                    key={res.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.86rem', color: '#0f172a' }}>
                        {res.full_name}
                        {res.relationship_with_head && (
                          <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '2px 6px', background: '#e0f2fe', color: '#0284c7', borderRadius: '4px', fontWeight: '600' }}>
                            {res.relationship_with_head}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        <span>Sinh: {res.dob || 'Chưa rõ'} ({calculateAge(res.dob)})</span>
                        {res.gender && <span> • {res.gender === 'male' ? 'Nam' : 'Nữ'}</span>}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: '600', marginTop: '2px' }}>
                        CCCD: {res.cccd || '(Chưa có số)'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onNavigate('residents');
                        setIsOpen(false);
                      }}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Mở trong Danh sách Nhân khẩu"
                    >
                      Hồ sơ <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Các nút mở nhanh (Quick Actions) */}
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Mở nhanh phân hệ:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '14px' }}>
              <button 
                onClick={() => { onNavigate('residents'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <Users size={15} style={{ color: '#0284c7' }} />
                <span>Nhân khẩu & CCCD</span>
              </button>

              <button 
                onClick={() => { onNavigate('households'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <Home size={15} style={{ color: '#16a34a' }} />
                <span>Hộ gia đình</span>
              </button>

              <button 
                onClick={() => { onNavigate('finance'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <Wallet size={15} style={{ color: '#d97706' }} />
                <span>Thu chi TDP</span>
              </button>

              <button 
                onClick={() => { onNavigate('ward-funds'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <Landmark size={15} style={{ color: '#7c3aed' }} />
                <span>Quỹ nộp phường</span>
              </button>

              <button 
                onClick={() => { onNavigate('elderly'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <Cake size={15} style={{ color: '#e11d48' }} />
                <span>Mừng thọ</span>
              </button>

              <button 
                onClick={() => { onNavigate('map'); setIsMinimized(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'left'
                }}
              >
                <MapPin size={15} style={{ color: '#2563eb' }} />
                <span>Bản đồ số</span>
              </button>
            </div>
          </div>

          {/* Ô nhập câu hỏi / tìm kiếm thông minh */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuery(inputText);
              }}
              placeholder="Nhập tên, số CCCD, hoặc yêu cầu..."
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                background: '#ffffff'
              }}
            />
            <button
              onClick={() => handleQuery(inputText)}
              disabled={!inputText.trim() || isSearching}
              style={{
                background: inputText.trim() ? '#0284c7' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                width: '36px',
                height: '36px',
                cursor: inputText.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              title="Gửi yêu cầu"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Nút Avatar hình tròn nổi bật ở góc dưới bên trái */}
      <div 
        onClick={() => setIsMinimized(!isMinimized)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '4px 14px 4px 4px',
          borderRadius: '999px',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.22), 0 0 0 1px rgba(2, 132, 199, 0.1)',
          backdropFilter: 'blur(8px)',
          border: '1.5px solid #bae6fd',
          transition: 'all 0.2s ease'
        }}
        title={isMinimized ? 'Mở trợ lý ảo' : 'Thu nhỏ'}
      >
        <div style={{ position: 'relative', width: '44px', height: '44px' }}>
          <img 
            src="/assistant.jpg" 
            alt="Trợ lý Ảo" 
            style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: '50%', 
              objectFit: 'cover',
              border: '2px solid #0284c7'
            }} 
          />
          <span style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '10px',
            height: '10px',
            background: '#22c55e',
            borderRadius: '50%',
            border: '2px solid #fff'
          }} />
        </div>
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Trợ lý Ảo
            <span style={{ fontSize: '0.7rem' }}>👋</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
            {isMinimized ? 'Bấm để tương tác' : 'Sẵn sàng hỗ trợ'}
          </div>
        </div>
      </div>
    </div>
  );
};
