import React from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { supabase, db, seedTenantData, checkAndSeedUser, refreshSupabaseClient } from '../services/db';
import { showToast } from '../utils/toast';

interface LoginProps {
  onOfflineMode: () => void;
  onGuestMode: () => void;
}

const Login = ({ onOfflineMode, onGuestMode }: LoginProps) => {
  const [showPinInput, setShowPinInput] = React.useState(false);
  const [pinValue, setPinValue] = React.useState('');
  
  // Database config states
  const [showConfigModal, setShowConfigModal] = React.useState(false);
  const [sbUrl, setSbUrl] = React.useState(localStorage.getItem('supabase_url') || '');
  const [sbKey, setSbKey] = React.useState(localStorage.getItem('supabase_anon_key') || '');

  // Email/Password Auth states
  const [authMode, setAuthMode] = React.useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('supabase_url', sbUrl.trim());
    localStorage.setItem('supabase_anon_key', sbKey.trim());
    refreshSupabaseClient();
    showConfigModal && setShowConfigModal(false);
    showToast('Đã lưu cấu hình kết nối! Đang tải lại ứng dụng...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      showToast('Đăng nhập thành công!', 'success');
      
      if (data && data.user) {
        await checkAndSeedUser(data.user.id);
      }
    } catch (err: any) {
      const msg = err.message || '';
      let viMsg = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (msg.includes('Invalid login credentials')) viMsg = 'Email hoặc mật khẩu không đúng!';
      else if (msg.includes('Email not confirmed')) viMsg = 'Tài khoản chưa xác thực email! Vui lòng kiểm tra hộp thư và nhấn liên kết xác nhận.';
      else if (msg.includes('Too many requests')) viMsg = 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.';
      else if (msg.includes('User not found')) viMsg = 'Không tìm thấy tài khoản với email này!';
      else if (msg.includes('network') || msg.includes('fetch')) viMsg = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      showToast(viMsg, 'danger');
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
        if (!data.session) {
          // Email confirmation is enabled in Supabase
          showToast('Đăng ký thành công! Vui lòng mở Email để nhấn liên kết xác thực tài khoản trước khi đăng nhập.', 'warning');
        } else {
          // Email confirmation is disabled, user is immediately logged in/session is available
          showToast('Đăng ký tài khoản thành công! Đang khởi tạo dữ liệu mẫu...', 'success');
          await seedTenantData(data.user.id);
          showToast('Khởi tạo dữ liệu mẫu thành công! Vui lòng đăng nhập.', 'success');
        }
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        showToast('Đăng ký thành công! Vui lòng xác thực tài khoản qua email gửi đến.', 'info');
      }
    } catch (err: any) {
      const msg = err.message || '';
      let viMsg = 'Đăng ký thất bại. Vui lòng thử lại.';
      if (msg.includes('User already registered') || msg.includes('already registered')) viMsg = 'Email này đã được đăng ký! Vui lòng đăng nhập hoặc dùng email khác.';
      else if (msg.includes('Password should be')) viMsg = 'Mật khẩu phải có ít nhất 6 ký tự!';
      else if (msg.includes('Unable to validate email')) viMsg = 'Định dạng email không hợp lệ!';
      else if (msg.includes('Signup is disabled')) viMsg = 'Chức năng đăng ký hiện đang bị vô hiệu hóa trên hệ thống!';
      else if (msg.includes('Too many requests')) viMsg = 'Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.';
      else if (msg.includes('network') || msg.includes('fetch')) viMsg = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      showToast(viMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      showToast('Chưa cấu hình Supabase! Vui lòng cấu hình trong Cài đặt hệ thống.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      showToast('Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hòm thư của bạn.', 'success');
      setAuthMode('login');
    } catch (err: any) {
      const msg = err.message || '';
      let viMsg = 'Gửi email thất bại. Vui lòng thử lại.';
      if (msg.includes('User not found')) viMsg = 'Không tìm thấy tài khoản với email này!';
      else if (msg.includes('Too many requests')) viMsg = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ vài phút rồi thử lại.';
      else if (msg.includes('network') || msg.includes('fetch')) viMsg = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      showToast(viMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldCheck size={34} color="#3b82f6" fill="rgba(59, 130, 246, 0.15)" />
          </div>
          <h1>Quản lý Tổ dân phố</h1>
          <p>Hệ thống số hóa dân cư & tài chính</p>
        </div>

        <div className="login-body">
          {/* Tabs Đăng nhập / Đăng ký */}
          {authMode !== 'forgot_password' ? (
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
          ) : (
            <div style={{ textAlign: 'left', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff', fontWeight: '700' }}>Khôi phục mật khẩu</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Vui lòng nhập Email đã đăng ký. Hệ thống sẽ gửi liên kết khôi phục mật khẩu vào hòm thư của bạn.
              </p>
            </div>
          )}

          {/* Form Email / Mật khẩu / Khôi phục */}
          {authMode === 'forgot_password' ? (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Tài khoản Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="to_dan_pho@gmail.com"
                  required
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(15, 23, 42, 0.65)',
                    color: 'white',
                    fontSize: '0.88rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '6px',
                  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
                  opacity: loading ? 0.75 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
              </button>
              
              <button 
                type="button" 
                onClick={() => setAuthMode('login')} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '10px',
                  padding: '4px'
                }}
              >
                Quay lại đăng nhập
              </button>
            </form>
          ) : (
            <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Tài khoản Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="to_dan_pho@gmail.com"
                  required
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(15, 23, 42, 0.65)',
                    color: 'white',
                    fontSize: '0.88rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Mật khẩu</label>
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode('forgot_password'); setPassword(''); }} 
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(15, 23, 42, 0.65)',
                    color: 'white',
                    fontSize: '0.88rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {authMode === 'register' && (
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Xác nhận mật khẩu</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    required
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      fontSize: '0.88rem',
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
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
                  opacity: loading ? 0.75 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? 'Đang xử lý...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký tổ mới')}
              </button>
            </form>
          )}

          {/* Các nút phụ */}
          {authMode !== 'forgot_password' && (
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

                  <button className="google-login-btn" onClick={() => setShowConfigModal(true)} style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', marginTop: '4px' }}>
                    ⚙️ Cấu hình kết nối cơ sở dữ liệu (Supabase)
                  </button>
                </>
              )}


            </div>
          )}
        </div>

        <div className="login-footer" style={{ marginTop: '20px', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '500' }}>
          <span>Phát triển bởi <strong style={{ color: '#60a5fa', fontWeight: '700' }}>Tuyến Nguyễn</strong> - 6 / 2026</span>
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

      {showConfigModal && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.85)' }}>
          <div className="modal-content" style={{ maxWidth: '440px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '24px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                ⚙️ Cấu hình kết nối cơ sở dữ liệu
              </h3>
            </div>
            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: 0, lineHeight: '1.4', textAlign: 'left' }}>
                Nhập thông tin kết nối Supabase của Tổ dân phố để đồng bộ dữ liệu trực tuyến. Thông tin này bạn lấy từ trang quản trị Supabase.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Supabase URL</label>
                <input 
                  type="text" 
                  value={sbUrl} 
                  onChange={e => setSbUrl(e.target.value)} 
                  placeholder="https://xxx.supabase.co" 
                  required
                  style={{ padding: '9px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: 'white', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Supabase API Key (Anon Key)</label>
                <input 
                  type="password" 
                  value={sbKey} 
                  onChange={e => setSbKey(e.target.value)} 
                  placeholder="eyJhbGciOi..." 
                  required
                  style={{ padding: '9px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: 'white', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' }} 
                />
              </div>

              <div className="form-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowConfigModal(false)} 
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
                <button type="submit" className="btn btn-primary" style={{ flex: 1.2 }}>Lưu cấu hình</button>
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
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.15), transparent 45%),
                      radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.15), transparent 45%),
                      #0a0f1d;
          font-family: 'Inter', system-ui, sans-serif;
          color: #f8fafc;
          padding: 30px 20px;
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
          max-width: 400px;
          max-height: calc(100vh - 60px);
          overflow-y: auto;
          background: rgba(30, 41, 59, 0.88);
          border: 1px solid rgba(59, 130, 246, 0.35);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 20px;
          padding: 24px 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5),
                      0 0 30px rgba(59, 130, 246, 0.15),
                      inset 0 1px 1px rgba(255, 255, 255, 0.15);
          text-align: center;
          box-sizing: border-box;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          margin: auto;
        }

        .login-card::-webkit-scrollbar {
          width: 6px;
        }
        .login-card::-webkit-scrollbar-track {
          background: transparent;
        }
        .login-card::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.35);
          border-radius: 3px;
        }
        .login-card::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.65);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          display: inline-flex;
          padding: 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          margin-bottom: 10px;
        }

        .login-header h1 {
          font-size: 1.35rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 4px 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          font-size: 0.78rem;
          color: #94a3b8;
          line-height: 1.3;
          margin: 0 0 14px 0;
        }

        /* Override Chrome/Edge Auto-fill styles to prevent light background & black text */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px rgba(15, 23, 42, 0.8) inset !important;
          -webkit-text-fill-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .google-login-btn {
          height: 38px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #ffffff;
          color: #1e293b;
          font-size: 0.85rem;
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
          font-size: 0.72rem;
          margin: 2px 0;
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
          height: 38px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
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
          margin-top: 18px;
          font-size: 0.8rem;
          color: #cbd5e1;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default Login;
