import React from 'react';
import { ShieldCheck, Database, Users } from 'lucide-react';
import { supabase, db, seedTenantData } from '../services/db';
import { showToast } from '../utils/toast';

interface LoginProps {
  onOfflineMode: () => void;
  onGuestMode: () => void;
}

const Login = ({ onOfflineMode, onGuestMode }: LoginProps) => {
  const [showPinInput, setShowPinInput] = React.useState(false);
  const [pinValue, setPinValue] = React.useState('');
  
  // Email/Password Auth states
  const [authMode, setAuthMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleVerifyGuestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const correctPin = await db.getGuestPin();
      if (pinValue.trim() === correctPin.trim()) {
        onGuestMode();
      } else {
        showToast(`Mã PIN không chính xác! (PIN hiện tại: "${correctPin.trim()}")`, 'danger');
      }
    } catch (err: any) {
      const correctPin = localStorage.getItem('guest_access_pin') || '1234';
      if (pinValue.trim() === correctPin.trim()) {
        onGuestMode();
      } else {
        showToast(`Lỗi kết nối database: ${err.message || err}. (PIN hiện tại: "${correctPin}")`, 'danger');
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      showToast('Chưa cấu hình Supabase! Vui lòng sử dụng chế độ Offline hoặc cấu hình Supabase trong Cài đặt hệ thống.', 'warning');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (e: any) {
      showToast(`Lỗi đăng nhập: ${e.message || e}`, 'danger');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      showToast('Chưa cấu hình Supabase! Vui lòng sử dụng chế độ Offline hoặc cấu hình trong Cài đặt hệ thống.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      showToast('Đăng nhập thành công!', 'success');
    } catch (err: any) {
      showToast(`Lỗi đăng nhập: ${err.message || err}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      showToast('Chưa cấu hình Supabase! Vui lòng cấu hình trong Cài đặt hệ thống.', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp!', 'warning');
      return;
    }
    if (password.length < 6) {
      showToast('Mật khẩu phải chứa ít nhất 6 ký tự!', 'warning');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      if (data && data.user) {
        showToast('Đăng ký tài khoản thành công! Đang khởi tạo dữ liệu mẫu cho tổ...', 'success');
        // Seed database for this user
        await seedTenantData(data.user.id);
        showToast('Khởi tạo dữ liệu mẫu thành công! Vui lòng đăng nhập.', 'success');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        showToast('Đăng ký thành công! Vui lòng xác thực tài khoản qua email gửi đến.', 'info');
      }
    } catch (err: any) {
      showToast(`Lỗi đăng ký: ${err.message || err}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldCheck size={48} color="#3b82f6" fill="rgba(59, 130, 246, 0.15)" />
          </div>
          <h1>Quản lý Tổ dân phố</h1>
          <p>Hệ thống số hóa thông tin cư dân & thu chi cộng đồng</p>
        </div>

        <div className="login-body">
          {/* Tabs Đăng nhập / Đăng ký */}
          <div className="login-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button 
              type="button" 
              className={`login-tab-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthMode('login'); setPassword(''); setConfirmPassword(''); }}
              style={{
                flex: 1,
                padding: '10px',
                background: authMode === 'login' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: '1px solid',
                borderColor: authMode === 'login' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                color: authMode === 'login' ? '#60a5fa' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Đăng nhập
            </button>
            <button 
              type="button" 
              className={`login-tab-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setPassword(''); setConfirmPassword(''); }}
              style={{
                flex: 1,
                padding: '10px',
                background: authMode === 'register' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: '1px solid',
                borderColor: authMode === 'register' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                color: authMode === 'register' ? '#60a5fa' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Đăng ký tổ mới
            </button>
          </div>

          {/* Form Email / Mật khẩu */}
          <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '500' }}>Tài khoản Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="to_dan_pho@gmail.com"
                required
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  color: 'white',
                  fontSize: '0.92rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '500' }}>Mật khẩu</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  color: 'white',
                  fontSize: '0.92rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {authMode === 'register' && (
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '500' }}>Xác nhận mật khẩu</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  style={{
                    padding: '11px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: 'white',
                    fontSize: '0.92rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                fontSize: '0.92rem',
                fontWeight: '600',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '6px',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
                opacity: loading ? 0.75 : 1,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justify-content: 'center'
              }}
            >
              {loading ? 'Đang xử lý...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký tổ mới')}
            </button>
          </form>

          {/* Các nút phụ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', width: '100%' }}>
            
            {authMode === 'login' && (
              <>
                <button className="google-login-btn" onClick={handleGoogleLogin}>
                  <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '10px' }}>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Đăng nhập nhanh bằng Google
                </button>
                
                <button className="google-login-btn" onClick={() => setShowPinInput(true)} style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa' }}>
                  <Users size={18} style={{ marginRight: '8px' }} />
                  Xem thông tin công khai (Bà con)
                </button>
              </>
            )}

            <div className="login-divider">
              <span>Hoặc</span>
            </div>

            <button className="offline-mode-btn" onClick={onOfflineMode}>
              <Database size={16} />
              Dùng thử chế độ Offline (LocalStorage)
            </button>
          </div>
        </div>

        <div className="login-footer">
          <span>Phát triển bởi Tuyến Nguyễn - 6 / 2026</span>
        </div>
      </div>

      {showPinInput && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.85)' }}>
          <div className="modal-content" style={{ maxWidth: '340px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="modal-header" style={{ justifyContent: 'center' }}>
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔑 Nhập mã PIN truy cập
              </h3>
            </div>
            <form onSubmit={handleVerifyGuestPin} className="modal-form" style={{ marginTop: '16px' }}>
              <div className="form-group" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px' }}>
                  Vui lòng nhập mã PIN bảo mật của Tổ dân phố để xem thông tin công khai.
                </p>
                <input 
                  type="password" 
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  placeholder="Mã PIN..."
                  autoFocus
                  required
                  style={{
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    letterSpacing: '4px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'white',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div className="form-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowPinInput(false); setPinValue(''); }} 
                  style={{ 
                    flex: 1, 
                    backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                    color: '#f8fafc', 
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: 'none'
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.2 }}>Xác nhận</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .login-wrapper {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 40%),
                      radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.1), transparent 40%),
                      #0f172a;
          font-family: 'Inter', system-ui, sans-serif;
          color: #f8fafc;
          padding: 20px;
          margin: 0;
          box-sizing: border-box;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          overflow-y: auto;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 20px;
          padding: 32px 28px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3),
                      inset 0 1px 0 rgba(255, 255, 255, 0.05);
          text-align: center;
          box-sizing: border-box;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          display: inline-flex;
          padding: 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .login-header h1 {
          font-size: 1.6rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          font-size: 0.85rem;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0 0 24px 0;
        }

        .login-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .google-login-btn {
          height: 44px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #ffffff;
          color: #1e293b;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          width: 100%;
          box-sizing: border-box;
        }

        .google-login-btn:hover {
          background: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
        }

        .google-login-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .login-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: #64748b;
          font-size: 0.75rem;
          margin: 4px 0;
        }

        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .login-divider span {
          padding: 0 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .offline-mode-btn {
          height: 44px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .offline-mode-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .login-footer {
          margin-top: 28px;
          font-size: 0.72rem;
          color: #475569;
        }
      `}</style>
    </div>
  );
};

export default Login;
