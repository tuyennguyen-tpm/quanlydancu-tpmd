import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Calculator, Delete, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { docSoTien } from '../utils/financialEngine';
import { showToast } from '../utils/toast';

interface Calculator3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAmount?: (amount: number) => void;
  initialMode?: 'floating' | 'modal';
}

export const Calculator3DModal: React.FC<Calculator3DModalProps> = ({
  isOpen,
  onClose,
  onSelectAmount,
  initialMode = 'floating'
}) => {
  const [display, setDisplay] = useState<string>('0');
  const [equation, setEquation] = useState<string>('');
  const [isNewNumber, setIsNewNumber] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [mode, setMode] = useState<'floating' | 'modal'>(initialMode);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = React.useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0, startY: 0, initialX: 0, initialY: 0
  });

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) return;

    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = position ? position.x : rect.left;
    const currentY = position ? position.y : rect.top;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 250, dragRef.current.initialX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 250, dragRef.current.initialY + deltaY));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Formatting helpers
  const cleanNumberStr = (str: string): number => {
    const raw = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(raw);
    return isNaN(num) ? 0 : num;
  };

  const formatDisplay = (valStr: string): string => {
    if (!valStr || valStr === 'Error' || valStr === 'NaN') return valStr;
    const parts = valStr.split('.');
    const intPart = cleanNumberStr(parts[0]);
    const formattedInt = Math.abs(intPart).toLocaleString('vi-VN');
    const sign = intPart < 0 || valStr.startsWith('-') ? '-' : '';
    if (parts.length > 1) {
      return `${sign}${formattedInt},${parts[1]}`;
    }
    return `${sign}${formattedInt}`;
  };

  const handleDigit = (digit: string) => {
    if (display === 'Error') {
      setDisplay(digit);
      setIsNewNumber(false);
      return;
    }

    if (isNewNumber) {
      setDisplay(digit === '000' ? '0' : digit);
      setIsNewNumber(false);
    } else {
      if (digit === '000') {
        if (display !== '0') setDisplay(display + '000');
      } else {
        setDisplay(display === '0' ? digit : display + digit);
      }
    }
  };

  const handleDecimal = () => {
    if (display.includes('.')) return;
    if (isNewNumber) {
      setDisplay('0.');
      setIsNewNumber(false);
    } else {
      setDisplay(display + '.');
    }
  };

  const calculateResult = (expr: string): number => {
    try {
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.')
        .replace(/[^\d.+\-*/()]/g, '');
      
      if (!sanitized) return 0;
      const func = new Function(`return ${sanitized}`);
      const res = func();
      if (!isFinite(res) || isNaN(res)) throw new Error('Invalid calculation');
      return res;
    } catch {
      return NaN;
    }
  };

  const handleOperator = (op: string) => {
    const currentNum = cleanNumberStr(display);
    if (isNaN(currentNum)) return;

    if (equation && !isNewNumber) {
      const fullExpr = `${equation} ${display}`;
      const intermediate = calculateResult(fullExpr);
      if (!isNaN(intermediate)) {
        setDisplay(String(intermediate));
        setEquation(`${intermediate} ${op}`);
      } else {
        setDisplay('Error');
        setEquation('');
      }
    } else {
      setEquation(`${currentNum} ${op}`);
    }
    setIsNewNumber(true);
  };

  const handleEqual = () => {
    if (!equation) return;
    const fullExpr = `${equation} ${display}`;
    const result = calculateResult(fullExpr);

    if (isNaN(result)) {
      setDisplay('Error');
      setEquation('');
    } else {
      setDisplay(String(result));
      setEquation('');
    }
    setIsNewNumber(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsNewNumber(true);
  };

  const handleBackspace = () => {
    if (isNewNumber || display === 'Error') return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
      setIsNewNumber(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handlePercent = () => {
    const val = cleanNumberStr(display);
    const res = val / 100;
    setDisplay(String(res));
    setIsNewNumber(true);
  };

  const handleQuickAddVnd = (amount: number) => {
    const current = cleanNumberStr(display);
    const nextVal = isNewNumber ? amount : current + amount;
    setDisplay(String(nextVal));
    setIsNewNumber(false);
  };

  const currentNumValue = cleanNumberStr(display);
  const wordsRepresentation = !isNaN(currentNumValue) && currentNumValue > 0 ? docSoTien(currentNumValue) : '';

  const handleCopyResult = () => {
    if (isNaN(currentNumValue)) return;
    navigator.clipboard.writeText(String(currentNumValue));
    setCopied(true);
    showToast(`Đã sao chép ${formatDisplay(display)} đ vào bộ nhớ tạm!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseResult = () => {
    if (isNaN(currentNumValue)) return;
    if (onSelectAmount) {
      onSelectAmount(currentNumValue);
      showToast(`Đã áp dụng số tiền ${formatDisplay(display)} đ!`, 'success');
    }
    onClose();
  };

  // Keyboard shortcut listener
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || isMinimized) return;
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return; // Do not intercept typing in active inputs
    }

    const key = e.key;

    if (key >= '0' && key <= '9') {
      handleDigit(key);
    } else if (key === '.' || key === ',') {
      handleDecimal();
    } else if (key === '+') {
      handleOperator('+');
    } else if (key === '-') {
      handleOperator('-');
    } else if (key === '*') {
      handleOperator('×');
    } else if (key === '/') {
      e.preventDefault();
      handleOperator('÷');
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleEqual();
    } else if (key === 'Backspace') {
      handleBackspace();
    } else if (key === 'Escape') {
      onClose();
    } else if (key.toLowerCase() === 'c') {
      handleClear();
    }
  }, [isOpen, isMinimized, display, equation, isNewNumber]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Minimized Floating Quick Pill Widget on screen
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          left: position ? `${position.x}px` : undefined,
          top: position ? `${position.y}px` : undefined,
          bottom: position ? undefined : '20px',
          right: position ? undefined : '20px',
          zIndex: 999999,
          padding: '6px 14px',
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #0284c7, #0369a1)',
          color: 'white',
          fontWeight: '800',
          fontSize: '0.78rem',
          boxShadow: '0 6px 18px -2px rgba(2, 132, 199, 0.6), 0 0 0 1.5px rgba(255,255,255,0.25)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        title="Bấm để mở bung máy tính 3D mini"
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Calculator size={12} color="white" />
        </div>
        <span>🧮 {formatDisplay(display)} đ</span>
        <Maximize2 size={12} style={{ opacity: 0.85 }} />
      </div>
    );
  }

  // Floating Mini Panel vs Backdrop Modal
  const isFloating = mode === 'floating';

  const containerStyle: React.CSSProperties = isFloating
    ? {
        position: 'fixed',
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : undefined,
        bottom: position ? undefined : '16px',
        right: position ? undefined : '16px',
        zIndex: 999999,
        width: '280px',
        touchAction: 'none'
      }
    : {
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)'
      };

  const innerStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: isFloating ? '280px' : '370px',
    borderRadius: '18px',
    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 0 0 2px rgba(51, 65, 85, 0.8)',
    padding: isFloating ? '11px 13px' : '15px 18px',
    color: '#f8fafc',
    boxSizing: 'border-box',
    userSelect: 'none'
  };

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        {/* Header Bar (Draggable) */}
        <div
          onMouseDown={handleDragStart}
          title="Bấm giữ chuột tại đây để di chuyển máy tính tự do"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            paddingBottom: '6px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(37, 99, 235, 0.4)'
            }}>
              <Calculator size={15} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '0.88rem', letterSpacing: '0.5px', color: '#f8fafc' }}>
                MÁY TÍNH MINI 3D
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Nguyễn Kim Tuyến
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Toggle Floating vs Modal */}
            <button
              type="button"
              onClick={() => setMode(m => m === 'floating' ? 'modal' : 'floating')}
              title={isFloating ? 'Phóng to thành Hộp thoại ở giữa màn hình' : 'Thu nhỏ thành Máy tính mini góc màn hình'}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isFloating ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>

            {/* Minimize to Pill */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              title="Thu gọn thành nút bấm tròn ở góc màn hình"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Minus size={14} />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="Tắt máy tính"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 3D LED LCD Screen */}
        <div style={{
          borderRadius: '12px',
          background: 'linear-gradient(180deg, #022c22 0%, #064e3b 100%)',
          boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.6), inset 0 -2px 4px rgba(255, 255, 255, 0.05), 0 0 0 1px #047857',
          padding: '8px 10px',
          marginBottom: '8px',
          textAlign: 'right',
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '0.72rem',
            color: '#6ee7b7',
            height: '14px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {equation || '\u00A0'}
          </div>
          <div style={{
            fontSize: display.length > 10 ? '1.25rem' : '1.55rem',
            fontWeight: '900',
            color: '#34d399',
            fontFamily: '"Courier New", Courier, monospace',
            letterSpacing: '1px',
            lineHeight: '1.2',
            textShadow: '0 0 10px rgba(52, 211, 153, 0.4)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {formatDisplay(display)} <span style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>đ</span>
          </div>

          {wordsRepresentation && (
            <div style={{
              fontSize: '0.66rem',
              color: '#d1fae5',
              fontStyle: 'italic',
              marginTop: '2px',
              textAlign: 'left',
              borderTop: '1px dashed rgba(52, 211, 153, 0.3)',
              paddingTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              = {wordsRepresentation}
            </div>
          )}
        </div>

        {/* Quick monetary add VND buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '4px',
          marginBottom: '8px'
        }}>
          {[
            { label: '+10k', val: 10000 },
            { label: '+20k', val: 20000 },
            { label: '+50k', val: 50000 },
            { label: '+100k', val: 100000 },
            { label: '+200k', val: 200000 },
            { label: '+500k', val: 500000 }
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => handleQuickAddVnd(btn.val)}
              style={{
                padding: '5px 1px',
                borderRadius: '6px',
                border: 'none',
                background: 'linear-gradient(145deg, #1e3a8a, #1d4ed8)',
                boxShadow: '0 2px 0 #0f172a, 0 2px 4px rgba(0, 0, 0, 0.3)',
                color: '#eff6ff',
                fontWeight: '800',
                fontSize: '0.68rem',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(1px)';
                e.currentTarget.style.boxShadow = '0 1px 0 #0f172a';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 0 #0f172a, 0 2px 4px rgba(0, 0, 0, 0.3)';
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* 3D Physical Keypad Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          marginBottom: '8px'
        }}>
          {/* Row 1 */}
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 0 #991b1b, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #991b1b'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #991b1b, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            AC
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #f59e0b, #d97706)',
              boxShadow: '0 4px 0 #b45309, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #b45309'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #b45309, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            <Delete size={16} />
          </button>
          <button
            type="button"
            onClick={handlePercent}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #334155, #1e293b)',
              boxShadow: '0 4px 0 #0f172a, 0 4px 8px rgba(0,0,0,0.4)',
              color: '#94a3b8',
              fontWeight: '900',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #0f172a'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #0f172a, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
              boxShadow: '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #5b21b6'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            ÷
          </button>

          {/* Row 2 */}
          {['7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              style={{
                padding: '7px 0',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(145deg, #475569, #334155)',
                boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
                color: 'white',
                fontWeight: '800',
                fontSize: '1.1rem',
                cursor: 'pointer'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('×')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
              boxShadow: '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #5b21b6'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            ×
          </button>

          {/* Row 3 */}
          {['4', '5', '6'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              style={{
                padding: '7px 0',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(145deg, #475569, #334155)',
                boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
                color: 'white',
                fontWeight: '800',
                fontSize: '1.1rem',
                cursor: 'pointer'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('-')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
              boxShadow: '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #5b21b6'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            -
          </button>

          {/* Row 4 */}
          {['1', '2', '3'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              style={{
                padding: '7px 0',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(145deg, #475569, #334155)',
                boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
                color: 'white',
                fontWeight: '800',
                fontSize: '1.1rem',
                cursor: 'pointer'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
              boxShadow: '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #5b21b6'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #475569, #334155)',
              boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '800',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit('000')}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #475569, #334155)',
              boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '800',
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            000
          </button>
          <button
            type="button"
            onClick={handleDecimal}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #475569, #334155)',
              boxShadow: '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #1e293b'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #1e293b, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            ,
          </button>
          <button
            type="button"
            onClick={handleEqual}
            style={{
              padding: '7px 0',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #10b981, #059669)',
              boxShadow: '0 4px 0 #047857, 0 4px 8px rgba(0,0,0,0.4)',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #047857'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 0 #047857, 0 4px 8px rgba(0,0,0,0.4)'; }}
          >
            =
          </button>
        </div>

        {/* Footer Action buttons: Copy / Close */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleCopyResult}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(145deg, #334155, #1e293b)',
              color: '#f8fafc',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
            {copied ? 'Đã sao chép!' : 'Sao chép kết quả'}
          </button>

          {onSelectAmount && (
            <button
              type="button"
              onClick={handleUseResult}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(145deg, #2563eb, #1d4ed8)',
                color: 'white',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.4)'
              }}
            >
              <Check size={14} /> Sử dụng số này
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
