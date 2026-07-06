import { useState, useEffect } from 'react';
import { 
  Users, 
  Home, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight,
  UserPlus,
  HeartHandshake,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { db } from '../services/db';



const StatCard = ({ title, value, subtext, icon: Icon, color, trend }: any) => (
  <div className="stat-card">
    <div className="stat-card-left">
      <span className="stat-card-title">{title}</span>
      <h2 className="stat-card-value">{value}</h2>
      <div className="stat-card-trend">
        {trend && <span className="trend-badge"><ArrowUpRight size={14} /> {trend}</span>}
        <span className="stat-card-subtext">{subtext}</span>
      </div>
    </div>
    <div className={`stat-card-icon ${color}`}>
      <Icon size={24} />
    </div>
  </div>
);

const Dashboard = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [stats, setStats] = useState({
    totalHouseholds: 0,
    totalResidents: 0,
    policyHouseholds: 0,
    pendingComplaints: 0,
    militaryEligibleCount: 0,
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreetingMessage = () => {
    const hours = currentTime.getHours();
    if (hours >= 5 && hours < 12) {
      return {
        greeting: 'Chào buổi sáng! ☀️',
        wish: 'Chúc bạn một ngày mới tốt lành, tràn đầy năng lượng và làm việc hiệu quả!'
      };
    } else if (hours >= 12 && hours < 18) {
      return {
        greeting: 'Chào buổi chiều! ⛅',
        wish: 'Chúc bạn một buổi chiều làm việc thuận lợi và gặt hái nhiều niềm vui!'
      };
    } else {
      return {
        greeting: 'Chào buổi tối! 🌙',
        wish: 'Chúc bạn một buổi tối thư giãn thoải mái và ấm áp bên gia đình!'
      };
    }
  };

  // Đọc tên Tổ dân phố từ localStorage (có thể được sửa từ phần Cấu hình)
  const [tdpName, setTdpName] = useState(() => {
    return localStorage.getItem('tdp_name') || 'Tiến Quảng Giao';
  });

  // Lắng nghe khi người dùng lưu tên mới từ Settings (không cần reload trang)
  useEffect(() => {
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Tiến Quảng Giao');
    };
    window.addEventListener('storage', handleStorageChange);
    // Lắng nghe cả custom event khi lưu cấu hình trong cùng tab
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  const [funds, setFunds] = useState<Record<string, { collected: number, target: number }>>({});
  const [activeFunds, setActiveFunds] = useState<{ name: string; target: number }[]>([]);

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      // 1. Load basic entities
      const [households, residents, complaints, financialRecords, securityLogs, hhFunds] = await Promise.all([
        db.getHouseholds(),
        db.getResidents(),
        db.getComplaints(),
        db.getFinancialRecords(),
        db.getSecurityLogs(),
        db.getHouseholdFunds()
      ]);

      // 2. Calculate Stats (Loại trừ người đã mất khỏi số liệu dân số thực tế)
      const activeResidents = residents.filter(r => r.status !== 'deceased');
      const totalH = households.length;
      const totalR = activeResidents.length;
      const policyH = households.filter(h => h.policy_type && h.policy_type !== 'none').length;
      const pendingC = complaints.filter(c => c.status === 'pending').length;

      // Tính số thanh niên nam 18-27 tuổi chưa nhập ngũ
      const currentYear = new Date().getFullYear();
      let militaryEligible = 0;
      activeResidents.forEach(r => {
        if (r.gender === 'male' && r.dob) {
          const birthYear = parseInt(r.dob.substring(0, 4));
          const age = currentYear - birthYear;
          if (age >= 18 && age <= 27) {
            if (!r.military_service || r.military_service === 'none' || r.military_service === 'in_age') {
              militaryEligible++;
            }
          }
        }
      });

      setStats({
        totalHouseholds: totalH,
        totalResidents: totalR,
        policyHouseholds: policyH,
        pendingComplaints: pendingC,
        militaryEligibleCount: militaryEligible,
      });

      // 3. Calculate Funds (Dynamic)
      const activeFundsList = db.getFundList();
      setActiveFunds(activeFundsList);

      const multiplier = Math.max(1, totalH);
      const resultsMap: Record<string, { collected: number, target: number }> = {};
      
      activeFundsList.forEach(f => {
        resultsMap[f.name] = {
          collected: 0,
          target: f.target * multiplier
        };
      });

      // Sum from general ledger
      financialRecords.forEach(r => {
        if (r.type === 'income' && !r.description.includes('[QUY_')) {
          const desc = r.description.toLowerCase();
          const cat = r.category.toLowerCase();
          
          let matched = false;
          // Shorthand checks for default funds to ensure backward compatibility
          if (resultsMap['Quỹ Vì người nghèo'] && (desc.includes('nghèo') || cat.includes('nghèo'))) {
            resultsMap['Quỹ Vì người nghèo'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Phí vệ sinh môi trường'] && (desc.includes('vệ sinh') || cat.includes('vệ sinh'))) {
            resultsMap['Phí vệ sinh môi trường'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ Đền ơn đáp nghĩa'] && (desc.includes('nghĩa') || desc.includes('đền ơn') || cat.includes('nghĩa') || cat.includes('đền ơn'))) {
            resultsMap['Quỹ Đền ơn đáp nghĩa'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ Khuyến học'] && (desc.includes('khuyến học') || cat.includes('khuyến học'))) {
            resultsMap['Quỹ Khuyến học'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ an sinh xã hội'] && (desc.includes('an sinh') || cat.includes('an sinh'))) {
            resultsMap['Quỹ an sinh xã hội'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ văn hóa - thể thao'] && (desc.includes('văn hóa') || cat.includes('văn hóa') || desc.includes('thể thao') || cat.includes('thể thao'))) {
            resultsMap['Quỹ văn hóa - thể thao'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Điện, nước, internet, bảo vệ Nhà văn hóa'] && (desc.includes('điện') || desc.includes('nước') || desc.includes('nhà văn hóa'))) {
            resultsMap['Điện, nước, internet, bảo vệ Nhà văn hóa'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ sinh hoạt đám hiếu'] && (desc.includes('hiếu') || desc.includes('hỷ'))) {
            resultsMap['Quỹ sinh hoạt đám hiếu'].collected += r.amount;
            matched = true;
          } else if (resultsMap['Quỹ Chăm sóc người cao tuổi'] && (desc.includes('cao tuổi') || cat.includes('cao tuổi'))) {
            resultsMap['Quỹ Chăm sóc người cao tuổi'].collected += r.amount;
            matched = true;
          }
          
          if (!matched) {
            // General substring match for any other custom funds
            for (const f of activeFundsList) {
              const fNameLower = f.name.toLowerCase();
              if (desc.includes(fNameLower) || cat.includes(fNameLower)) {
                resultsMap[f.name].collected += r.amount;
                break;
              }
            }
          }
        }
      });

      // Cộng thêm số liệu thực tế thu được từ bảng đóng quỹ của các hộ dân trong năm hiện tại
      if (hhFunds && Array.isArray(hhFunds)) {
        hhFunds.forEach(f => {
          if (f.year === currentYear && resultsMap[f.fund_name]) {
            resultsMap[f.fund_name].collected += f.amount;
          }
        });
      }

      setFunds(resultsMap);

      // 4. Aggregate Notifications
      const notifs: any[] = [];

      // Thông báo NVQS
      if (militaryEligible > 0) {
        notifs.push({
          id: `nvqs-alert`,
          type: 'security',
          text: `Có ${militaryEligible} nam thanh niên trong độ tuổi NVQS (18-27) chưa nhập ngũ.`,
          time: new Date().toLocaleDateString('vi-VN'),
          icon: AlertCircle,
          status: 'pending'
        });
      }

      // Add recent complaints
      complaints.slice(0, 3).forEach(c => {
        notifs.push({
          id: `c-${c.id}`,
          type: 'complaint',
          text: `Hộ bà/ông ${c.resident_name} phản ánh: "${c.content.length > 50 ? c.content.slice(0, 50) + '...' : c.content}"`,
          time: new Date(c.created_at || c.date).toLocaleDateString('vi-VN') + ' - ' + (c.status === 'pending' ? 'Chưa xử lý' : 'Đang xử lý'),
          icon: AlertCircle,
          status: c.status
        });
      });

      // Add recent security alerts
      securityLogs.slice(0, 2).forEach(s => {
        notifs.push({
          id: `s-${s.id}`,
          type: 'security',
          text: `An ninh: ${s.title}`,
          time: new Date(s.date).toLocaleDateString('vi-VN'),
          icon: s.type === 'alert' ? AlertCircle : CheckCircle2,
          status: s.type
        });
      });

      // Sort notifications (simulated order, complaints first, then security)
      setNotifications(notifs);
    };

    loadDashboardData();
    window.addEventListener('db-changed', loadDashboardData);
    window.addEventListener('fund-targets-changed', loadDashboardData);
    return () => {
      window.removeEventListener('db-changed', loadDashboardData);
      window.removeEventListener('fund-targets-changed', loadDashboardData);
    };
  }, []);

  const handleAddResidentClick = () => {
    window.dispatchEvent(new CustomEvent('change-tab', { detail: 'residents' }));
    // Wait brief moment and open modal
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-add-resident-modal'));
    }, 100);
  };

  const handleViewFinanceClick = () => {
    window.dispatchEvent(new CustomEvent('change-tab', { detail: 'finance' }));
  };

  const formatVND = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
  };

  return (
    <div className="dashboard-container">
      <div className="premium-welcome-banner">
        <div className="welcome-message">
          <h1>{isGuest ? 'Chào mừng bà con nhân dân! 👋' : getGreetingMessage().greeting}</h1>
          <p>Hệ thống quản lý thông tin dân cư Tổ dân phố <strong style={{color: 'var(--primary)'}}>{tdpName}</strong></p>
          <span className="welcome-wish">{getGreetingMessage().wish}</span>
        </div>
        <div className="welcome-datetime">
          <div className="welcome-time">
            {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="welcome-date">
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={handleViewFinanceClick}>
          {isGuest ? 'Xem chi tiết thu chi' : 'Quản lý thu chi'}
        </button>
        {!isGuest && (
          <button className="btn btn-primary" onClick={handleAddResidentClick}>
            <UserPlus size={18} />
            Thêm nhân khẩu mới
          </button>
        )}
      </div>

      <div className="stats-grid">
        <StatCard 
          title="Tổng số hộ dân" 
          value={new Intl.NumberFormat('vi-VN').format(stats.totalHouseholds)} 
          subtext="Danh sách hộ đăng ký cư trú" 
          icon={Home} 
          color="blue"
        />
        <StatCard 
          title="Tổng nhân khẩu" 
          value={new Intl.NumberFormat('vi-VN').format(stats.totalResidents)} 
          subtext="Nhân khẩu thực tế trong tổ" 
          icon={Users} 
          color="indigo"
        />
        <StatCard 
          title="Hộ chính sách & nghèo" 
          value={new Intl.NumberFormat('vi-VN').format(stats.policyHouseholds)} 
          subtext="Hộ cận nghèo, nghèo & chính sách" 
          icon={HeartHandshake} 
          color="orange"
        />
        <StatCard 
          title="Phản ánh chưa xử lý" 
          value={new Intl.NumberFormat('vi-VN').format(stats.pendingComplaints)} 
          subtext="Yêu cầu cần phản hồi sớm" 
          icon={AlertCircle} 
          color={stats.pendingComplaints > 0 ? "red" : "blue"}
        />
      </div>

      <div className="dashboard-charts">
        <div className="chart-item main-chart">
          <div className="chart-header">
            <h3>Tình hình thu nộp các loại quỹ TDP</h3>
            <span className="view-all" onClick={handleViewFinanceClick}>Xem chi tiết</span>
          </div>
          <div className="chart-placeholder">
             <div className="progress-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px 24px' }}>
                {activeFunds.map((fund, i) => {
                  const multiplier = Math.max(1, stats.totalHouseholds);
                  const data = funds[fund.name] || { collected: 0, target: fund.target * multiplier };
                  const percent = data.target > 0 ? Math.round((data.collected / data.target) * 100) : 0;
                  const barColor = percent >= 75 ? '#10b981' : percent >= 30 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={i} className="progress-item" style={{ marginBottom: 0 }}>
                      <div className="progress-info">
                        <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{fund.name}</span>
                        <span style={{ fontSize: '0.85rem', color: barColor, fontWeight: 'bold' }}>{percent}% ({formatVND(data.collected)} / {formatVND(data.target)})</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: barColor }}></div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>

        <div className="chart-item side-list">
          <div className="chart-header">
            <h3>Nhật ký hoạt động & Phản ánh</h3>
          </div>
          <div className="notification-list">
             {notifications.length > 0 ? (
               notifications.map((n) => (
                 <div key={n.id} className="notif-item">
                    <div className={`notif-icon ${n.status === 'pending' || n.status === 'alert' ? 'red' : ''}`}><n.icon size={16} /></div>
                    <div className="notif-content">
                      <p>{n.text}</p>
                      <span>{n.time}</span>
                    </div>
                 </div>
               ))
             ) : (
               <div style={{textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)'}}>Không có hoạt động mới nào</div>
             )}
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-container {
          width: 100%;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .premium-welcome-banner {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.06) 0%, rgba(59, 130, 246, 0.02) 100%);
          border: 1.5px solid rgba(37, 99, 235, 0.12);
          border-radius: var(--radius-lg);
          padding: 14px 24px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          box-shadow: 0 4px 15px rgba(37, 99, 235, 0.01);
          position: relative;
          overflow: hidden;
        }
        .premium-welcome-banner::before {
          content: '';
          position: absolute;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.04) 0%, transparent 70%);
          right: -80px;
          top: -80px;
          pointer-events: none;
        }
        .welcome-message h1 {
          font-size: 1.4rem;
          font-weight: 850;
          background: linear-gradient(135deg, #1d4ed8 0%, #10b981 50%, #84cc16 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 4px;
        }
        .welcome-message p {
          font-size: 0.88rem;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .welcome-message .welcome-wish {
          font-size: 0.82rem;
          color: #059669;
          font-weight: 600;
        }
        .welcome-datetime {
          text-align: right;
          flex-shrink: 0;
        }
        .welcome-time {
          font-size: 1.55rem;
          font-weight: 800;
          background: linear-gradient(135deg, #1d4ed8 0%, #10b981 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.1;
          font-family: monospace;
        }
        .welcome-date {
          font-size: 0.82rem;
          color: var(--text-muted);
          font-weight: 550;
          margin-top: 2px;
          text-transform: capitalize;
        }

        .btn {
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
        }

        .btn-primary {
          background-color: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .btn-primary:hover {
          background-color: var(--primary-hover);
          transform: translateY(-2px);
        }

        .btn-secondary {
          background-color: white;
          color: var(--text-main);
          border: 1px solid var(--border);
        }
        
        .btn-secondary:hover {
          background-color: #f8fafc;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          justify-content: space-between;
          border: 1px solid var(--border);
          transition: all 0.3s;
        }

        .stat-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-4px);
        }

        .stat-card-title {
          font-size: 0.9rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .stat-card-value {
          font-size: 2rem;
          margin: 8px 0;
          letter-spacing: -1px;
          font-weight: 700;
        }

        .stat-card-trend {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .trend-badge {
          font-size: 0.75rem;
          color: var(--success);
          background-color: rgba(16, 185, 129, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
        }

        .stat-card-subtext {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .stat-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-card-icon.blue { background-color: rgba(37, 99, 235, 0.1); color: var(--primary); }
        .stat-card-icon.indigo { background-color: rgba(129, 140, 248, 0.1); color: #6366f1; }
        .stat-card-icon.orange { background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-card-icon.red { background-color: rgba(239, 68, 68, 0.1); color: var(--danger); }

        .dashboard-charts {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .chart-item {
          background: white;
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .view-all {
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }

        .progress-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.95rem;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .progress-bar-bg {
          height: 10px;
          background-color: #f1f5f9;
          border-radius: 5px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background-color: var(--primary);
          border-radius: 5px;
          transition: width 1s ease-out;
        }

        .notification-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .notif-item {
          display: flex;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .notif-item:last-child { border-bottom: none; }

        .notif-icon {
          color: var(--success);
          padding-top: 2px;
        }

        .notif-icon.red {
          color: var(--danger);
        }

        .notif-content p {
          font-size: 0.9rem;
          font-weight: 500;
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .notif-content span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        @media (max-width: 1024px) {
          .dashboard-charts {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .premium-welcome-banner {
            flex-direction: column;
            align-items: flex-start;
            padding: 12px 18px;
          }
          .welcome-datetime {
            text-align: left;
            margin-top: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
