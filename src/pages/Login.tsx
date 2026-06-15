import React from 'react';
import { ShieldCheck, Database } from 'lucide-react';
import { supabase } from '../services/db';
import { showToast } from '../utils/toast';

interface LoginProps {
  onOfflineMode: () => void;
}

const Login = ({ onOfflineMode }: LoginProps) => {
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
          <button className="google-login-btn" onClick={handleGoogleLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: '10px' }}>
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
            Đăng nhập bằng Google
          </button>

          <div className="login-divider">
            <span>Hoặc</span>
          </div>

          <button className="offline-mode-btn" onClick={onOfflineMode}>
            <Database size={18} />
            Dùng thử chế độ Offline (LocalStorage)
          </button>
        </div>

        <div className="login-footer">
          <span>Phát triển bởi Tuyến Nguyễn - 6 / 2026</span>
        </div>
      </div>

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
          padding: 40px 32px;
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
          margin-bottom: 24px;
        }

        .login-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 10px 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0 0 32px 0;
        }

        .login-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .google-login-btn {
          height: 48px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #ffffff;
          color: #1e293b;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
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
          font-size: 0.8rem;
          margin: 8px 0;
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
          height: 48px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .offline-mode-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .login-footer {
          margin-top: 36px;
          font-size: 0.75rem;
          color: #475569;
        }
      `}</style>
    </div>
  );
};

export default Login;
