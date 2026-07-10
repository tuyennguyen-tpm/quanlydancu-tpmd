import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Home, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight,
  UserPlus,
  HeartHandshake,
  TrendingUp,
  ShieldCheck,
  Calendar,
  FileText,
  Wallet,
  Star,
  UsersRound,
  Sparkles,
  Info
} from 'lucide-react';
import { db, partyDb } from '../services/db';

const Dashboard = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const currentYear = new Date().getFullYear();

  // Role switching state
  const [selectedRoleView, setSelectedRoleView] = useState<'to_truong' | 'bi_thu' | 'mat_tran'>('to_truong');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('current_role') || 'demo');

  const [stats, setStats] = useState({
    totalHouseholds: 0,
    totalResidents: 0,
    maleCount: 0,
    femaleCount: 0,
    policyHouseholds: 0,
    pendingComplaints: 0,
    militaryEligibleCount: 0,
    temporaryResidentCount: 0,
    temporaryAbsentCount: 0,
    
    // Chi bộ
    totalPartyMembers: 0,
    officialPartyMembers: 0,
    probationPartyMembers: 0,
    exemptPartyMembers: 0,
    femalePartyMembers: 0,
    seniorPartyMembers: 0,
    partyFeesCollected: 0,
    
    // Mặt trận & Chính sách
    poorHouseholds: 0,
    nearPoorHouseholds: 0,
    policyFamilyHouseholds: 0,
    campaignCount: 0,
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
        wish: 'Chúc bạn một ngày mới tốt lành, làm việc tràn đầy năng lượng!'
      };
    } else if (hours >= 12 && hours < 18) {
      return {
        greeting: 'Chào buổi chiều! ⛅',
        wish: 'Chúc bạn một buổi chiều làm việc thuận lợi và hiệu quả!'
      };
    } else {
      return {
        greeting: 'Chào buổi tối! 🌙',
        wish: 'Chúc bạn một buổi tối ấm áp và thư giãn bên gia đình!'
      };
    }
  };

  // Đọc tên Tổ dân phố từ localStorage
  const [tdpName, setTdpName] = useState(() => {
    return localStorage.getItem('tdp_name') || 'Quảng Giao';
  });
  const [wardName, setWardName] = useState(() => {
    return localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Quảng Giao');
      setWardName(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  // Sync selectedRoleView when role changes in App
  useEffect(() => {
    const current = localStorage.getItem('current_role') || 'demo';
    setUserRole(current);
    if (current === 'bi_thu') {
      setSelectedRoleView('bi_thu');
    } else if (current === 'mat_tran') {
      setSelectedRoleView('mat_tran');
    } else {
      setSelectedRoleView('to_truong');
    }
  }, []);

  useEffect(() => {
    const handleRoleChanged = (e: Event) => {
      const customEv = e as CustomEvent;
      const role = customEv.detail;
      setUserRole(role);
      if (role === 'bi_thu') {
        setSelectedRoleView('bi_thu');
      } else if (role === 'mat_tran') {
        setSelectedRoleView('mat_tran');
      } else {
        setSelectedRoleView('to_truong');
      }
    };
    window.addEventListener('role-changed', handleRoleChanged);
    return () => window.removeEventListener('role-changed', handleRoleChanged);
  }, []);

  const [funds, setFunds] = useState<Record<string, { collected: number, target: number }>>({});
  const [activeFunds, setActiveFunds] = useState<{ name: string; target: number }[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [recentPartyMeetings, setRecentPartyMeetings] = useState<any[]>([]);

  const loadDashboardData = async () => {
    try {
      const [
        households, 
        residents, 
        complaints, 
        financialRecords, 
        securityLogs, 
        hhFunds,
        partyMembers,
        partyMeetings,
        partyFeesList,
        meetings
      ] = await Promise.all([
        db.getHouseholds(),
        db.getResidents(),
        db.getComplaints(),
        db.getFinancialRecords(),
        db.getSecurityLogs(),
        db.getHouseholdFunds(),
        partyDb.getPartyMembers(),
        partyDb.getPartyMeetings(),
        partyDb.getPartyFees(currentYear),
        db.getMeetings()
      ]);

      const activeResidents = residents.filter(r => r.status !== 'deceased');
      const totalH = households.length;
      const totalR = activeResidents.length;
      const maleR = activeResidents.filter(r => r.gender === 'male').length;
      const femaleR = activeResidents.filter(r => r.gender === 'female').length;
      const tempResident = activeResidents.filter(r => r.status === 'temporary_resident').length;
      const tempAbsent = activeResidents.filter(r => r.status === 'temporary_absent').length;

      const poorH = households.filter(h => h.policy_type === 'poor').length;
      const nearPoorH = households.filter(h => h.policy_type === 'near_poor').length;
      const policyFamilyH = households.filter(h => h.policy_type === 'policy_family').length;
      const policyTotalH = poorH + nearPoorH + policyFamilyH;
      
      const pendingC = complaints.filter(c => c.status === 'pending').length;

      // NVQS
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

      // Chi bộ Đảng calculations
      const totalPM = partyMembers.length;
      const officialPM = partyMembers.filter(m => m.status === 'official').length;
      const probationPM = partyMembers.filter(m => m.status === 'probation').length;
      const exemptPM = partyMembers.filter(m => m.is_exempt_party_activities).length;
      const femalePM = partyMembers.filter(m => {
        const res = activeResidents.find(r => r.id === m.resident_id);
        return res?.gender === 'female' || m.full_name.toLowerCase().includes('thị') || m.full_name.toLowerCase().includes('thuy');
      }).length;
      
      let seniorPM = 0;
      partyMembers.forEach(m => {
        const res = activeResidents.find(r => r.id === m.resident_id);
        if (res && res.dob) {
          const birthYear = parseInt(res.dob.substring(0, 4));
          const age = currentYear - birthYear;
          if (age >= 60) seniorPM++;
        }
      });

      const totalFeesCollected = partyFeesList.reduce((acc, f) => acc + (f.amount || 0), 0);

      setStats({
        totalHouseholds: totalH,
        totalResidents: totalR,
        maleCount: maleR,
        femaleCount: femaleR,
        policyHouseholds: policyTotalH,
        pendingComplaints: pendingC,
        militaryEligibleCount: militaryEligible,
        temporaryResidentCount: tempResident,
        temporaryAbsentCount: tempAbsent,
        
        // Chi bộ
        totalPartyMembers: totalPM,
        officialPartyMembers: officialPM,
        probationPartyMembers: probationPM,
        exemptPartyMembers: exemptPM,
        femalePartyMembers: femalePM,
        seniorPartyMembers: seniorPM,
        partyFeesCollected: totalFeesCollected,

        // Mặt trận
        poorHouseholds: poorH,
        nearPoorHouseholds: nearPoorH,
        policyFamilyHouseholds: policyFamilyH,
        campaignCount: meetings.filter(m => m.type === 'front').length,
      });

      // Funds (Dynamic)
      const activeFundsList = db.getFundList();
      setActiveFunds(activeFundsList);

      const multiplier = Math.max(1, totalH);
      const resultsMap: Record<string, { collected: number, target: number }> = {};
      activeFundsList.forEach(f => {
        resultsMap[f.name] = { collected: 0, target: f.target * multiplier };
      });

      financialRecords.forEach(r => {
        if (r.type === 'income' && !r.description.includes('[QUY_')) {
          const desc = r.description.toLowerCase();
          const cat = r.category.toLowerCase();
          
          let matched = false;
          for (const f of activeFundsList) {
            const fNameLower = f.name.toLowerCase();
            if (desc.includes(fNameLower) || cat.includes(fNameLower)) {
              resultsMap[f.name].collected += r.amount;
              matched = true;
              break;
            }
          }
        }
      });

      if (hhFunds && Array.isArray(hhFunds)) {
        hhFunds.forEach(f => {
          if (f.year === currentYear && resultsMap[f.fund_name]) {
            resultsMap[f.fund_name].collected += f.amount;
          }
        });
      }
      setFunds(resultsMap);

      // Meetings lists
      setRecentMeetings(meetings.slice(0, 5));
      setRecentPartyMeetings(partyMeetings.slice(0, 5));

      // Notifications
      const notifs: any[] = [];
      if (militaryEligible > 0) {
        notifs.push({
          id: 'nvqs-alert',
          type: 'security',
          text: `Có ${militaryEligible} thanh niên trong độ tuổi NVQS cần theo dõi.`,
          time: 'Hôm nay',
          icon: AlertCircle,
          status: 'pending'
        });
      }
      complaints.slice(0, 3).forEach(c => {
        notifs.push({
          id: `c-${c.id}`,
          type: 'complaint',
          text: `Kiến nghị của ${c.resident_name}: "${c.content.slice(0, 45)}..."`,
          time: new Date(c.created_at || c.date).toLocaleDateString('vi-VN'),
          icon: AlertCircle,
          status: c.status
        });
      });
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
      setNotifications(notifs);

    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  };

  useEffect(() => {
    loadDashboardData();
    window.addEventListener('db-changed', loadDashboardData);
    window.addEventListener('fund-targets-changed', loadDashboardData);
    return () => {
      window.removeEventListener('db-changed', loadDashboardData);
      window.removeEventListener('fund-targets-changed', loadDashboardData);
    };
  }, []);

  const handleQuickAction = (tabId: string, customEvent?: string) => {
    window.dispatchEvent(new CustomEvent('change-tab', { detail: tabId }));
    if (customEvent) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(customEvent));
      }, 100);
    }
  };

  const formatVND = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + ' đ';
  };

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* 1. PREMIUM HEADER BANNER */}
      <div className="premium-welcome-banner">
        <div className="welcome-message">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#EAB308" fill="#EAB308" />
            <span>{isGuest ? 'Chào mừng bà con nhân dân! 👋' : getGreetingMessage().greeting}</span>
          </h1>
          <p>Hệ thống Quản lý Dân cư Số – TDP <strong style={{ color: 'var(--gov-blue)', fontWeight: 700 }}>{tdpName}</strong> ({wardName})</p>
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

      {/* 2. ROLE VIEW SWITCHER TABS */}
      <div className="role-switcher-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          className={`tab-btn-role ${selectedRoleView === 'to_truong' ? 'active' : ''}`}
          onClick={() => setSelectedRoleView('to_truong')}
        >
          <Home size={16} />
          <span>Tổ trưởng (Dân cư & Thu chi)</span>
        </button>
        <button 
          className={`tab-btn-role ${selectedRoleView === 'bi_thu' ? 'active' : ''}`}
          onClick={() => setSelectedRoleView('bi_thu')}
          disabled={isGuest}
          title={isGuest ? 'Tính năng bị ẩn ở chế độ xem công khai' : ''}
        >
          <Star size={16} />
          <span>Bí thư (Chi bộ Đảng)</span>
        </button>
        <button 
          className={`tab-btn-role ${selectedRoleView === 'mat_tran' ? 'active' : ''}`}
          onClick={() => setSelectedRoleView('mat_tran')}
          disabled={isGuest}
          title={isGuest ? 'Tính năng bị ẩn ở chế độ xem công khai' : ''}
        >
          <UsersRound size={16} />
          <span>Mặt trận & Đoàn thể</span>
        </button>
      </div>

      {/* 3. DYNAMIC STATS GRID BY ROLE VIEW */}
      {selectedRoleView === 'to_truong' && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--gov-blue)' }}></span>Tổng số hộ</span>
                <span className="value">{stats.totalHouseholds}</span>
              </div>
              <div className="icon-wrap" style={{ background: 'var(--gov-blue-lighter)' }}>
                <Home size={18} color="var(--gov-blue)" />
              </div>
            </div>
            <div className="change neutral">Cơ sở dữ liệu Hộ dân chính thức</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--gov-green)' }}></span>Nhân khẩu thực tế</span>
                <span className="value">{stats.totalResidents}</span>
              </div>
              <div className="icon-wrap" style={{ background: 'var(--gov-green-light)' }}>
                <Users size={18} color="var(--gov-green)" />
              </div>
            </div>
            <div className="change neutral">Nam: {stats.maleCount} | Nữ: {stats.femaleCount}</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-orange)' }}></span>Tạm trú / Tạm vắng</span>
                <span className="value">{stats.temporaryResidentCount} / {stats.temporaryAbsentCount}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#FFF3E0' }}>
                <Users size={18} color="var(--accent-orange)" />
              </div>
            </div>
            <div className="change neutral">Bà con ở ngoài hoặc nơi khác đến</div>
          </div>

          <div className="stat-card" style={{ borderLeft: `4px solid ${stats.pendingComplaints > 0 ? 'var(--accent-red)' : 'var(--gov-blue-light)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: stats.pendingComplaints > 0 ? 'var(--accent-red)' : 'var(--gov-blue-light)' }}></span>Kiến nghị cần giải quyết</span>
                <span className="value" style={{ color: stats.pendingComplaints > 0 ? 'var(--accent-red)' : 'inherit' }}>{stats.pendingComplaints}</span>
              </div>
              <div className="icon-wrap" style={{ background: stats.pendingComplaints > 0 ? '#FFEBEE' : 'var(--gov-blue-lighter)' }}>
                <AlertCircle size={18} color={stats.pendingComplaints > 0 ? 'var(--accent-red)' : 'var(--gov-blue-light)'} />
              </div>
            </div>
            <div className={`change ${stats.pendingComplaints > 0 ? 'down' : 'neutral'}`}>
              {stats.pendingComplaints > 0 ? '⚠️ Cần phản hồi sớm cho bà con' : 'Đã giải quyết toàn bộ kiến nghị'}
            </div>
          </div>
        </div>
      )}

      {selectedRoleView === 'bi_thu' && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-purple)' }}></span>Đảng viên Chi bộ</span>
                <span className="value">{stats.totalPartyMembers}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#F3E5F5' }}>
                <Star size={18} color="var(--accent-purple)" />
              </div>
            </div>
            <div className="change neutral">Chính thức: {stats.officialPartyMembers} | Dự bị: {stats.probationPartyMembers}</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--gov-blue)' }}></span>Đảng phí thu năm nay</span>
                <span className="value">{formatVND(stats.partyFeesCollected)}</span>
              </div>
              <div className="icon-wrap" style={{ background: 'var(--gov-blue-lighter)' }}>
                <Wallet size={18} color="var(--gov-blue)" />
              </div>
            </div>
            <div className="change neutral">Thu theo Quy định 01-QĐ/TW</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-orange)' }}></span>Miễn sinh hoạt Đảng</span>
                <span className="value">{stats.exemptPartyMembers}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#FFF3E0' }}>
                <CheckCircle2 size={18} color="var(--accent-orange)" />
              </div>
            </div>
            <div className="change neutral">Tỷ lệ: {stats.totalPartyMembers > 0 ? Math.round((stats.exemptPartyMembers / stats.totalPartyMembers) * 100) : 0}% tổng Đảng viên</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--gov-green)' }}></span>Lão thành / Đảng viên nữ</span>
                <span className="value">{stats.seniorPartyMembers} / {stats.femalePartyMembers}</span>
              </div>
              <div className="icon-wrap" style={{ background: 'var(--gov-green-light)' }}>
                <Users size={18} color="var(--gov-green)" />
              </div>
            </div>
            <div className="change neutral">Đảng viên cao tuổi (≥ 60 tuổi)</div>
          </div>
        </div>
      )}

      {selectedRoleView === 'mat_tran' && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-teal)' }}></span>Gia đình chính sách</span>
                <span className="value">{stats.poorHouseholds + stats.nearPoorHouseholds + stats.policyFamilyHouseholds}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#E0F2F1' }}>
                <HeartHandshake size={18} color="var(--accent-teal)" />
              </div>
            </div>
            <div className="change neutral">Người có công, thương binh, liệt sĩ...</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-red)' }}></span>Hộ nghèo / Hộ cận nghèo</span>
                <span className="value">{stats.poorHouseholds} / {stats.nearPoorHouseholds}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#FFEBEE' }}>
                <AlertCircle size={18} color="var(--accent-red)" />
              </div>
            </div>
            <div className="change neutral">Hộ có hoàn cảnh khó khăn cần hỗ trợ</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--gov-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--gov-blue)' }}></span>Các cuộc vận động / Hòa giải</span>
                <span className="value">{stats.campaignCount}</span>
              </div>
              <div className="icon-wrap" style={{ background: 'var(--gov-blue-lighter)' }}>
                <Calendar size={18} color="var(--gov-blue)" />
              </div>
            </div>
            <div className="change neutral">Hoạt động gắn kết, hòa giải bà con</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="label"><span className="dot" style={{ background: 'var(--accent-orange)' }}></span>Thanh niên độ tuổi NVQS</span>
                <span className="value">{stats.militaryEligibleCount}</span>
              </div>
              <div className="icon-wrap" style={{ background: '#FFF3E0' }}>
                <Users size={18} color="var(--accent-orange)" />
              </div>
            </div>
            <div className="change neutral">Độ tuổi 18-27 chưa nhập ngũ</div>
          </div>
        </div>
      )}

      {/* 4. MAIN BODY GRIDS BY ROLE VIEW */}
      {selectedRoleView === 'to_truong' && (
        <>
          <div className="dash-grid">
            
            {/* Chart biến động dân cư */}
            <div className="card-gov">
              <div className="card-gov-header">
                <div className="card-title"><span className="title-dot"></span>Biến động dân cư (Minh họa 6 tháng qua)</div>
                <button className="view-all" onClick={() => handleQuickAction('residents')}>Chi tiết nhân khẩu →</button>
              </div>
              <div className="card-gov-body">
                <div className="chart-area">
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '35%', background: 'var(--gov-blue)' }} title="Chuyển đến: 14"></div>
                    <div className="chart-bar" style={{ height: '20%', background: 'var(--gov-green)' }} title="Chuyển đi: 8"></div>
                    <div className="chart-bar" style={{ height: '10%', background: 'var(--accent-orange)' }} title="Sinh: 4"></div>
                    <div className="chart-bar" style={{ height: '5%', background: 'var(--accent-red)' }} title="Tử: 2"></div>
                  </div>
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '42%', background: 'var(--gov-blue)' }} title="Chuyển đến: 18"></div>
                    <div className="chart-bar" style={{ height: '25%', background: 'var(--gov-green)' }} title="Chuyển đi: 10"></div>
                    <div className="chart-bar" style={{ height: '15%', background: 'var(--accent-orange)' }} title="Sinh: 6"></div>
                    <div className="chart-bar" style={{ height: '8%', background: 'var(--accent-red)' }} title="Tử: 3"></div>
                  </div>
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '30%', background: 'var(--gov-blue)' }} title="Chuyển đến: 12"></div>
                    <div className="chart-bar" style={{ height: '28%', background: 'var(--gov-green)' }} title="Chuyển đi: 11"></div>
                    <div className="chart-bar" style={{ height: '12%', background: 'var(--accent-orange)' }} title="Sinh: 5"></div>
                    <div className="chart-bar" style={{ height: '4%', background: 'var(--accent-red)' }} title="Tử: 1"></div>
                  </div>
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '48%', background: 'var(--gov-blue)' }} title="Chuyển đến: 22"></div>
                    <div className="chart-bar" style={{ height: '35%', background: 'var(--gov-green)' }} title="Chuyển đi: 15"></div>
                    <div className="chart-bar" style={{ height: '20%', background: 'var(--accent-orange)' }} title="Sinh: 8"></div>
                    <div className="chart-bar" style={{ height: '10%', background: 'var(--accent-red)' }} title="Tử: 4"></div>
                  </div>
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '55%', background: 'var(--gov-blue)' }} title="Chuyển đến: 25"></div>
                    <div className="chart-bar" style={{ height: '30%', background: 'var(--gov-green)' }} title="Chuyển đi: 12"></div>
                    <div className="chart-bar" style={{ height: '18%', background: 'var(--accent-orange)' }} title="Sinh: 7"></div>
                    <div className="chart-bar" style={{ height: '12%', background: 'var(--accent-red)' }} title="Tử: 5"></div>
                  </div>
                  <div className="chart-bar-group">
                    <div className="chart-bar" style={{ height: '60%', background: 'var(--gov-blue)' }} title="Chuyển đến: 28"></div>
                    <div className="chart-bar" style={{ height: '22%', background: 'var(--gov-green)' }} title="Chuyển đi: 9"></div>
                    <div className="chart-bar" style={{ height: '25%', background: 'var(--accent-orange)' }} title="Sinh: 10"></div>
                    <div className="chart-bar" style={{ height: '8%', background: 'var(--accent-red)' }} title="Tử: 3"></div>
                  </div>
                </div>
                <div className="chart-labels">
                  <div className="chart-label">Tháng 2</div>
                  <div className="chart-label">Tháng 3</div>
                  <div className="chart-label">Tháng 4</div>
                  <div className="chart-label">Tháng 5</div>
                  <div className="chart-label">Tháng 6</div>
                  <div className="chart-label">Tháng 7</div>
                </div>
                <div className="chart-legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--gov-blue)' }}></div>Chuyển đến</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--gov-green)' }}></div>Chuyển đi</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent-orange)' }}></div>Trẻ mới sinh</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent-red)' }}></div>Người qua đời</div>
                </div>
              </div>
            </div>

            {/* Hộ nghèo Donut Chart */}
            <div className="card-gov">
              <div className="card-gov-header">
                <div className="card-title"><span className="title-dot" style={{ background: 'var(--accent-red)' }}></span>Cơ cấu hộ dân theo mức nghèo</div>
                <button className="view-all" onClick={() => handleQuickAction('policy')}>Chi tiết chính sách →</button>
              </div>
              <div className="card-gov-body">
                <div className="donut-area">
                  <svg className="donut-svg" width="110" height="110" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="40" fill="none" stroke="#F1F5F9" strokeWidth="18"/>
                    <circle cx="55" cy="55" r="40" fill="none" stroke="var(--accent-red)" strokeWidth="18" strokeDasharray="15 236" strokeDashoffset="0" transform="rotate(-90 55 55)"/>
                    <circle cx="55" cy="55" r="40" fill="none" stroke="var(--accent-orange)" strokeWidth="18" strokeDasharray="18 233" strokeDashoffset="-15" transform="rotate(-90 55 55)"/>
                    <circle cx="55" cy="55" r="40" fill="none" stroke="var(--accent-teal)" strokeWidth="18" strokeDasharray="30 221" strokeDashoffset="-33" transform="rotate(-90 55 55)"/>
                    <circle cx="55" cy="55" r="40" fill="none" stroke="var(--gov-green)" strokeWidth="18" strokeDasharray="188 63" strokeDashoffset="-63" transform="rotate(-90 55 55)"/>
                    <text x="55" y="50" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">{stats.totalHouseholds}</text>
                    <text x="55" y="64" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Tổng số Hộ</text>
                  </svg>
                  <div className="donut-legend">
                    <div className="donut-legend-item">
                      <div className="dli-left"><div className="dli-dot" style={{ background: 'var(--accent-red)' }}></div>Hộ nghèo</div>
                      <div className="dli-right">{stats.poorHouseholds} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.totalHouseholds > 0 ? Math.round((stats.poorHouseholds / stats.totalHouseholds) * 1000) / 10 : 0}%)</span></div>
                    </div>
                    <div className="donut-legend-item">
                      <div className="dli-left"><div className="dli-dot" style={{ background: 'var(--accent-orange)' }}></div>Cận nghèo</div>
                      <div className="dli-right">{stats.nearPoorHouseholds} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.totalHouseholds > 0 ? Math.round((stats.nearPoorHouseholds / stats.totalHouseholds) * 1000) / 10 : 0}%)</span></div>
                    </div>
                    <div className="donut-legend-item">
                      <div className="dli-left"><div className="dli-dot" style={{ background: 'var(--accent-teal)' }}></div>Hộ chính sách</div>
                      <div className="dli-right">{stats.policyFamilyHouseholds} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.totalHouseholds > 0 ? Math.round((stats.policyFamilyHouseholds / stats.totalHouseholds) * 1000) / 10 : 0}%)</span></div>
                    </div>
                    <div className="donut-legend-item">
                      <div className="dli-left"><div className="dli-dot" style={{ background: 'var(--gov-green)' }}></div>Hộ bình thường</div>
                      <div className="dli-right">{stats.totalHouseholds - stats.poorHouseholds - stats.nearPoorHouseholds - stats.policyFamilyHouseholds} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>({stats.totalHouseholds > 0 ? Math.round(((stats.totalHouseholds - stats.poorHouseholds - stats.nearPoorHouseholds - stats.policyFamilyHouseholds) / stats.totalHouseholds) * 1000) / 10 : 0}%)</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dash-grid">
            {/* Tình hình thu các quỹ phường */}
            <div className="card-gov">
              <div className="card-gov-header">
                <div className="card-title"><span className="title-dot"></span>Tiến độ thu nộp các loại quỹ TDP ({currentYear})</div>
                <button className="view-all" onClick={() => handleQuickAction('ward-funds')}>Đóng Quỹ Phường →</button>
              </div>
              <div className="card-gov-body">
                <div className="progress-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px 20px' }}>
                  {activeFunds.map((fund, i) => {
                    const mult = Math.max(1, stats.totalHouseholds);
                    const data = funds[fund.name] || { collected: 0, target: fund.target * mult };
                    const percent = data.target > 0 ? Math.round((data.collected / data.target) * 100) : 0;
                    const barColor = percent >= 75 ? 'var(--gov-green)' : percent >= 30 ? 'var(--accent-orange)' : 'var(--accent-red)';
                    return (
                      <div key={i} className="progress-item" style={{ marginBottom: 0 }}>
                        <div className="progress-info">
                          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{fund.name}</span>
                          <span style={{ fontSize: '0.82rem', color: barColor, fontWeight: 'bold' }}>{percent}% ({formatVND(data.collected)})</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: barColor }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Hoạt động & Nhật ký & Phản ánh */}
            <div className="card-gov">
              <div className="card-gov-header">
                <div className="card-title"><span className="title-dot" style={{ background: 'var(--gov-blue-light)' }}></span>Nhật ký hoạt động & Phản ánh của bà con</div>
                <button className="view-all" onClick={() => handleQuickAction('complaints')}>Xem tất cả →</button>
              </div>
              <div className="card-gov-body" style={{ padding: '8px 18px' }}>
                <div className="notif-list">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div key={n.id} className="notif-item">
                        <div className="notif-icon-wrap" style={{ background: n.status === 'pending' || n.status === 'alert' ? '#FFEBEE' : 'var(--gov-blue-lighter)' }}>
                          <n.icon size={14} color={n.status === 'pending' || n.status === 'alert' ? 'var(--accent-red)' : 'var(--gov-blue-light)'} />
                        </div>
                        <div className="notif-content">
                          <div className="notif-title">{n.text}</div>
                          <div className="notif-time">{n.time}</div>
                        </div>
                        {(n.status === 'pending' || n.status === 'alert') && <span className="notif-dot-unread"></span>}
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>Không có hoạt động mới nào</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedRoleView === 'bi_thu' && (
        <div className="dash-grid">
          
          {/* Sinh hoạt Chi bộ & Họp đảng viên */}
          <div className="card-gov">
            <div className="card-gov-header">
              <div className="card-title"><span className="title-dot" style={{ background: 'var(--accent-purple)' }}></span>Danh sách các buổi sinh hoạt Chi bộ Đảng gần đây</div>
              <button className="view-all" onClick={() => handleQuickAction('meetings-party')}>Lịch sinh hoạt →</button>
            </div>
            <div className="card-gov-body" style={{ padding: 0 }}>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Chủ đề cuộc họp</th>
                    <th>Thời gian</th>
                    <th>Địa điểm</th>
                    <th>Đảng viên tham gia</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPartyMeetings.length > 0 ? (
                    recentPartyMeetings.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.title}</td>
                        <td>{new Date(m.date).toLocaleDateString('vi-VN')}</td>
                        <td>{m.location || 'Nhà văn hóa TDP'}</td>
                        <td>
                          <span className="status-pill pill-blue">{m.attendance_count || 0} Đảng viên</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>Chưa ghi nhận cuộc họp chi bộ nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cơ cấu & Phân tổ Đảng */}
          <div className="card-gov">
            <div className="card-gov-header">
              <div className="card-title"><span className="title-dot" style={{ background: 'var(--accent-purple)' }}></span>Thông tin Tổ Đảng & Chi hội</div>
              <button className="view-all" onClick={() => handleQuickAction('party-cell')}>Quản lý Đảng viên →</button>
            </div>
            <div className="card-gov-body">
              <div className="progress-item">
                <div className="progress-info">
                  <span className="p-label">Đảng viên chính thức</span>
                  <span className="p-val">{stats.officialPartyMembers} / {stats.totalPartyMembers}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${stats.totalPartyMembers > 0 ? (stats.officialPartyMembers / stats.totalPartyMembers) * 100 : 0}%`, background: 'var(--accent-purple)' }}></div>
                </div>
              </div>

              <div className="progress-item" style={{ marginTop: '14px' }}>
                <div className="progress-info">
                  <span className="p-label">Đảng viên miễn sinh hoạt</span>
                  <span className="p-val">{stats.exemptPartyMembers} / {stats.totalPartyMembers}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${stats.totalPartyMembers > 0 ? (stats.exemptPartyMembers / stats.totalPartyMembers) * 100 : 0}%`, background: 'var(--accent-orange)' }}></div>
                </div>
              </div>

              <div className="progress-item" style={{ marginTop: '14px' }}>
                <div className="progress-info">
                  <span className="p-label">Đảng viên cao tuổi (≥60 tuổi)</span>
                  <span className="p-val">{stats.seniorPartyMembers} / {stats.totalPartyMembers}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${stats.totalPartyMembers > 0 ? (stats.seniorPartyMembers / stats.totalPartyMembers) * 100 : 0}%`, background: 'var(--gov-green)' }}></div>
                </div>
              </div>

              <div className="party-quick-tips" style={{ marginTop: '20px', padding: '12px 14px', background: '#F3E5F5', border: '1px solid rgba(106, 27, 154, 0.15)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Info size={16} color="var(--accent-purple)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '11px', color: '#4a148c', lineHeight: 1.4, textAlign: 'left' }}>
                  <strong>Quy định Đảng phí 2026:</strong> Thực hiện theo hướng dẫn thu Đảng phí mới nhất, tự động tính toán theo mức thu nhập và đối tượng đóng BHXH / Hưu trí.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRoleView === 'mat_tran' && (
        <div className="dash-grid">
          
          {/* Danh sách phong trào, ngày hội */}
          <div className="card-gov">
            <div className="card-gov-header">
              <div className="card-title"><span className="title-dot" style={{ background: 'var(--accent-teal)' }}></span>Cuộc vận động Mặt trận & Ngày hội Đại đoàn kết</div>
              <button className="view-all" onClick={() => handleQuickAction('meetings-front')}>Xem lịch họp →</button>
            </div>
            <div className="card-gov-body" style={{ padding: 0 }}>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Chủ đề hoạt động / Cuộc họp</th>
                    <th>Thời gian</th>
                    <th>Địa điểm</th>
                    <th>Số lượt người hưởng ứng</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMeetings.filter(m => m.type === 'front').length > 0 ? (
                    recentMeetings.filter(m => m.type === 'front').map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.title}</td>
                        <td>{new Date(m.date).toLocaleDateString('vi-VN')}</td>
                        <td>{m.location || 'Nhà văn hóa TDP'}</td>
                        <td>
                          <span className="status-pill pill-green">{m.attendance_count || 0} Bà con</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>Bí thư, Tổ trưởng phối hợp Ban Công tác Mặt trận chưa lưu cuộc họp Mặt trận nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Các chi hội hoạt động */}
          <div className="card-gov">
            <div className="card-gov-header">
              <div className="card-title"><span className="title-dot" style={{ background: 'var(--accent-teal)' }}></span>Thông tin Chi hội & Hoạt động</div>
              <button className="view-all" onClick={() => handleQuickAction('policy')}>DS Chính sách →</button>
            </div>
            <div className="card-gov-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '8px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quỹ Vì người nghèo</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Đóng góp an sinh</div>
                  </div>
                  <span className="status-pill pill-green" style={{ fontSize: '11px' }}>Hoạt động tốt</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '8px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chi hội Cựu chiến binh</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Phát huy truyền thống</div>
                  </div>
                  <span className="status-pill pill-blue" style={{ fontSize: '11px' }}>Tích cực</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '8px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chi hội Phụ nữ & Người cao tuổi</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Phong trào vệ sinh & sống khỏe</div>
                  </div>
                  <span className="status-pill pill-blue" style={{ fontSize: '11px' }}>Đâu đặn</span>
                </div>
              </div>

              <div style={{ marginTop: '18px', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4', textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                💡 <strong>Gợi ý hoạt động:</strong> Phối hợp với Đoàn Thanh niên tổ chức các buổi tình nguyện vệ sinh bãi biển, dọn rác khu dân cư định kỳ hàng tháng.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. QUICK ACTIONS FOR REGISTERED ROLES (EXCLUDING GUEST) */}
      {!isGuest && (
        <div className="card-gov" style={{ marginTop: '16px' }}>
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot" style={{ background: 'var(--gov-green)' }}></span>Thao tác nhanh trên hệ thống</div>
          </div>
          <div className="card-gov-body">
            <div className="quick-grid">
              <button className="quick-btn" onClick={() => handleQuickAction('households', 'open-add-household-modal')}>
                <div className="q-icon" style={{ background: 'var(--gov-blue-lighter)' }}><PlusIcon color="var(--gov-blue)" /></div>
                <span className="q-label">Thêm Hộ mới</span>
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('residents', 'open-add-resident-modal')}>
                <div className="q-icon" style={{ background: 'var(--gov-green-light)' }}><PlusIcon color="var(--gov-green)" /></div>
                <span className="q-label">Thêm Nhân khẩu</span>
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('meetings-minutes', 'open-add-minutes-modal')}>
                <div className="q-icon" style={{ background: '#FBE9E7' }}><FileText size={18} color="var(--accent-orange)" /></div>
                <span className="q-label">Lập Biên bản họp</span>
              </button>
              <button className="quick-btn" onClick={() => handleQuickAction('complaints')}>
                <div className="q-icon" style={{ background: '#E0F2F1' }}><MessageCircleIcon color="var(--accent-teal)" /></div>
                <span className="q-label">Xử lý Phản ánh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tab-btn-role {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: white;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn-role:hover:not(:disabled) {
          border-color: var(--gov-blue);
          color: var(--gov-blue);
          background: var(--gov-blue-lighter);
        }
        .tab-btn-role.active {
          border-color: var(--gov-blue);
          color: white;
          background: var(--gov-blue);
        }
        .tab-btn-role:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .premium-welcome-banner {
          background: linear-gradient(135deg, rgba(21, 101, 192, 0.06) 0%, rgba(25, 118, 210, 0.02) 100%);
          border: 1.5px solid rgba(21, 101, 192, 0.12);
          border-radius: var(--radius-lg);
          padding: 14px 24px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          box-shadow: 0 4px 15px rgba(21, 101, 192, 0.01);
          position: relative;
          overflow: hidden;
        }
        .premium-welcome-banner::before {
          content: '';
          position: absolute;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(21, 101, 192, 0.04) 0%, transparent 70%);
          right: -80px;
          top: -80px;
          pointer-events: none;
        }
        .welcome-message h1 {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 4px;
          text-align: left;
        }
        .welcome-message p {
          font-size: 0.88rem;
          color: var(--text-muted);
          margin-bottom: 2px;
          text-align: left;
        }
        .welcome-message .welcome-wish {
          font-size: 0.82rem;
          color: var(--gov-green);
          font-weight: 600;
          display: block;
          text-align: left;
        }
        .welcome-datetime {
          text-align: right;
          flex-shrink: 0;
        }
        .welcome-time {
          font-size: 1.55rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--gov-blue) 0%, var(--gov-green) 100%);
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
        .party-quick-tips {
          animation: pulse 4s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(106, 27, 154, 0.2); }
          70% { box-shadow: 0 0 0 6px rgba(106, 27, 154, 0); }
          100% { box-shadow: 0 0 0 0 rgba(106, 27, 154, 0); }
        }
      `}</style>
    </div>
  );
};

// Simple icons fallback
const PlusIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MessageCircleIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export default Dashboard;
