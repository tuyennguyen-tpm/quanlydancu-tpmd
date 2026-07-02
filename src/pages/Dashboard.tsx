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

  // Đọc tên Tổ dân phố từ localStorage (có thể được sửa từ phần Cấu hình)
  const [tdpName, setTdpName] = useState(() => {
    const stored = localStorage.getItem('tdp_name');
    if (stored === 'Quảng Giao' || stored === 'TDP Quảng Giao' || stored === 'Tiến Quảng Giao') return 'Kim Tuyến';
    return stored || 'Kim Tuyến';
  });

  // Lắng nghe khi người dùng lưu tên mới từ Settings (không cần reload trang)
  useEffect(() => {
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    // Lắng nghe cả custom event khi lưu cấu hình trong cùng tab
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  const [funds, setFunds] = useState({
    viNguoiNgheo: { collected: 0, target: parseInt(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000') },
    denOnDapNghia: { collected: 9200000, target: parseInt(localStorage.getItem('target_den_on_dap_nghia') || '10000000') },
    veSinhMoiTruong: { collected: 0, target: parseInt(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000') },
  });

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      // 1. Load basic entities
      const households = await db.getHouseholds();
      const residents = await db.getResidents();
      const complaints = await db.getComplaints();
      const financialRecords = await db.getFinancialRecords();
      const securityLogs = await db.getSecurityLogs();

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

      // 3. Calculate Funds
      let ngheoCollected = 0;
      let veSinhCollected = 0;
      financialRecords.forEach(r => {
        if (r.type === 'income') {
          if (r.description.toLowerCase().includes('nghèo')) {
            ngheoCollected += r.amount;
          } else if (r.description.toLowerCase().includes('vệ sinh') || r.category.toLowerCase().includes('vệ sinh')) {
            veSinhCollected += r.amount;
          }
        }
      });

      const targetNghieo = parseInt(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000');
      const targetDapNghia = parseInt(localStorage.getItem('target_den_on_dap_nghia') || '10000000');
      const targetVeSinh = parseInt(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000');

      setFunds({
        viNguoiNgheo: { collected: ngheoCollected || 12500000, target: targetNghieo },
        denOnDapNghia: { collected: 9200000, target: targetDapNghia },
        veSinhMoiTruong: { collected: veSinhCollected || 21000000, target: targetVeSinh },
      });

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
      <div className="welcome-section">
        <div>
          <h1>{isGuest ? 'Chào mừng bà con nhân dân! 👋' : 'Xin chào, Tổ trưởng! 👋'}</h1>
          <p>Hệ thống quản lý thông tin dân cư Tổ dân phố <strong style={{color: 'var(--primary)'}}>{tdpName}</strong></p>
        </div>
        <div className="action-btns">
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
      </div>

      <div className="stats-grid">
        <StatCard 
          title="Tổng số hộ dân" 
          value={stats.totalHouseholds.toString()} 
          subtext="Danh sách hộ đăng ký cư trú" 
          icon={Home} 
          color="blue"
        />
        <StatCard 
          title="Tổng nhân khẩu" 
          value={stats.totalResidents.toString()} 
          subtext="Nhân khẩu thực tế trong tổ" 
          icon={Users} 
          color="indigo"
        />
        <StatCard 
          title="Hộ chính sách & nghèo" 
          value={stats.policyHouseholds.toString()} 
          subtext="Hộ cận nghèo, nghèo & chính sách" 
          icon={HeartHandshake} 
          color="orange"
        />
        <StatCard 
          title="Phản ánh chưa xử lý" 
          value={stats.pendingComplaints.toString().padStart(2, '0')} 
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
             <div className="progress-list">
                <div className="progress-item">
                  <div className="progress-info">
                    <span>Quỹ Vì người nghèo</span>
                    <span>{Math.round((funds.viNguoiNgheo.collected / funds.viNguoiNgheo.target) * 100)}% ({formatVND(funds.viNguoiNgheo.collected)} / {formatVND(funds.viNguoiNgheo.target)})</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{width: `${Math.min(100, (funds.viNguoiNgheo.collected / funds.viNguoiNgheo.target) * 100)}%`}}></div>
                  </div>
                </div>
                
                <div className="progress-item">
                  <div className="progress-info">
                    <span>Quỹ Đền ơn đáp nghĩa</span>
                    <span>{Math.round((funds.denOnDapNghia.collected / funds.denOnDapNghia.target) * 100)}% ({formatVND(funds.denOnDapNghia.collected)} / {formatVND(funds.denOnDapNghia.target)})</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{width: `${Math.min(100, (funds.denOnDapNghia.collected / funds.denOnDapNghia.target) * 100)}%`}}></div>
                  </div>
                </div>

                <div className="progress-item">
                  <div className="progress-info">
                    <span>Phí vệ sinh môi trường</span>
                    <span>{Math.round((funds.veSinhMoiTruong.collected / funds.veSinhMoiTruong.target) * 100)}% ({formatVND(funds.veSinhMoiTruong.collected)} / {formatVND(funds.veSinhMoiTruong.target)})</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{width: `${Math.min(100, (funds.veSinhMoiTruong.collected / funds.veSinhMoiTruong.target) * 100)}%`, backgroundColor: 'var(--warning)'}}></div>
                  </div>
                </div>
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

        .welcome-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .welcome-section h1 {
          font-size: 1.8rem;
          color: var(--text-main);
          margin-bottom: 4px;
        }

        .welcome-section p {
          color: var(--text-muted);
          font-size: 0.95rem;
        }

        .action-btns {
          display: flex;
          gap: 12px;
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
      `}</style>
    </div>
  );
};

export default Dashboard;
