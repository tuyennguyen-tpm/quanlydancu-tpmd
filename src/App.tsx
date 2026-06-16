import { useState, useEffect } from 'react';
import { db, refreshSupabaseClient, supabase } from './services/db';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import AIAssistant from './pages/AIAssistant';
import CitizenMap from './pages/CitizenMap';
import Finance from './pages/Finance';
import Households from './pages/Households';
import Residents from './pages/Residents';
import Policies from './pages/Policies';
import Security from './pages/Security';
import Environment from './pages/Environment';
import Meetings from './pages/Meetings';
import MeetingMinutes from './pages/MeetingMinutes';
import Documents from './pages/Documents';
import Complaints from './pages/Complaints';
import Login from './pages/Login';
import { 
  Users, 
  Home, 
  UserCircle, 
  ShieldCheck, 
  MessageSquare, 
  Leaf, 
  Wallet, 
  Calendar, 
  FileText, 
  PieChart, 
  Map as MapIcon, 
  Menu, 
  X, 
  LogOut,
  Bell,
  Search,
  Settings,
  BrainCircuit
} from 'lucide-react';
import './App.css';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem = ({ icon: Icon, label, active, onClick, badge }: NavItemProps) => (
  <button 
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <Icon size={20} />
    <span>{label}</span>
    {badge !== undefined && badge > 0 && <span className="badge">{badge}</span>}
  </button>
);



const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isOfflineMode, setOfflineMode] = useState<boolean>(localStorage.getItem('offline_mode') === 'true');
  const [isGuestMode, setGuestMode] = useState<boolean>(localStorage.getItem('guest_mode') === 'true');

  
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'danger' | 'warning' | 'info'} | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Tên Tổ dân phố (có thể sửa)
  const [tdpName, setTdpName] = useState(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
  const [wardName, setWardName] = useState(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
  const [leaderName, setLeaderName] = useState(localStorage.getItem('leader_name') || 'Kim Tuyến');
  const [leaderPhone, setLeaderPhone] = useState(localStorage.getItem('leader_phone') || '0912 083 018 - 0899 661 982');
  const [groupId, setGroupId] = useState(localStorage.getItem('group_id') || 'NAM_SAM_SON_01');

  // Settings modal states
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('supabase_anon_key') || '');
  const [tdpNameInput, setTdpNameInput] = useState(tdpName);
  const [wardNameInput, setWardNameInput] = useState(wardName);
  const [leaderNameInput, setLeaderNameInput] = useState(leaderName);
  const [leaderPhoneInput, setLeaderPhoneInput] = useState(leaderPhone);
  const [groupIdInput, setGroupIdInput] = useState(groupId);

  // Targets states for TDP Funds
  const [targetNghieoInput, setTargetNghieoInput] = useState(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000');
  const [targetDapNghiaInput, setTargetDapNghiaInput] = useState(localStorage.getItem('target_den_on_dap_nghia') || '10000000');
  const [targetVeSinhInput, setTargetVeSinhInput] = useState(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000');
  const [guestPinInput, setGuestPinInput] = useState(localStorage.getItem('guest_access_pin') || '1234');

  // Notifications states
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<any[]>([]);

  // Search states
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setSearchFocused] = useState(false);

  // Cập nhật tiêu đề trình duyệt theo tên TDP
  useEffect(() => {
    document.title = `QL TDP – ${tdpName}`;
  }, [tdpName]);

  // Cập nhật session và lắng nghe sự thay đổi Auth
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        localStorage.removeItem('offline_mode');
        setOfflineMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Lắng nghe tham số URL để chuyển sang chế độ Bà con (Guest Mode) của tổ cụ thể
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenant = params.get('t');
    if (tenant) {
      localStorage.setItem('guest_tenant_id', tenant);
      localStorage.setItem('guest_mode', 'true');
      localStorage.removeItem('offline_mode');
      setGuestMode(true);
      setOfflineMode(false);
    }
  }, []);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      setToast({
        message: customEvent.detail.message,
        type: customEvent.detail.type || 'info'
      });
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadNotifications = async () => {
    try {
      const complaints = await db.getComplaints();
      const security = await db.getSecurityLogs();
      const env = await db.getEnvironmentLogs();

      const list: any[] = [];
      complaints.filter(c => c.status === 'pending').forEach(c => {
        list.push({
          id: `c-${c.id}`,
          type: 'complaints',
          text: `Kiến nghị chưa xử lý: "${c.content.slice(0, 30)}..." từ ${c.resident_name}`,
          time: new Date(c.created_at || c.date).toLocaleDateString('vi-VN')
        });
      });

      security.filter(s => s.type === 'alert').forEach(s => {
        list.push({
          id: `s-${s.id}`,
          type: 'security',
          text: `An ninh: ${s.title}`,
          time: new Date(s.date).toLocaleDateString('vi-VN')
        });
      });

      env.filter(e => e.status !== 'ok').forEach(e => {
        list.push({
          id: `e-${e.id}`,
          type: 'environment',
          text: `Môi trường: ${e.area} cần dọn dẹp vệ sinh`,
          time: new Date(e.last_cleaned).toLocaleDateString('vi-VN')
        });
      });

      setNotifList(list);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPendingCountAndAlerts = async () => {
    try {
      const list = await db.getComplaints();
      setPendingCount(list.filter(c => c.status === 'pending').length);
      await loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPendingCountAndAlerts();
    window.addEventListener('db-changed', loadPendingCountAndAlerts);
    return () => window.removeEventListener('db-changed', loadPendingCountAndAlerts);
  }, []);

  useEffect(() => {
    const handleChangeTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('change-tab', handleChangeTab);
    return () => window.removeEventListener('change-tab', handleChangeTab);
  }, []);

  // Lắng nghe thay đổi kích thước cửa sổ để tự động đóng/mở sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Search effect
  useEffect(() => {
    const performSearch = async () => {
      if (!globalQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const query = globalQuery.toLowerCase();
        const residents = await db.getResidents();
        const households = await db.getHouseholds();

        const results: any[] = [];

        residents.forEach(r => {
          if (
            r.full_name.toLowerCase().includes(query) ||
            (r.cccd && r.cccd.includes(query)) ||
            (r.phone && r.phone.includes(query))
          ) {
            results.push({
              id: r.id,
              type: 'resident',
              name: r.full_name,
              detail: `Nhân khẩu - CCCD: ${r.cccd || 'Chưa cấp'} - SĐT: ${r.phone || 'Không có'}`
            });
          }
        });

        households.forEach(h => {
          const head = residents.find(r => r.id === h.head_of_household_id);
          const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
          if (
            h.address.toLowerCase().includes(query) ||
            h.household_number.toLowerCase().includes(query) ||
            headName.toLowerCase().includes(query)
          ) {
            results.push({
              id: h.id,
              type: 'household',
              name: `Hộ ông/bà ${headName}`,
              detail: `Hộ khẩu: ${h.household_number} - Đ/C: ${h.address}`
            });
          }
        });

        setSearchResults(results.slice(0, 8));
      } catch (e) {
        console.error('Search error:', e);
      }
    };

    const timer = setTimeout(performSearch, 200);
    return () => clearTimeout(timer);
  }, [globalQuery]);

  const handleSearchResultClick = (result: any) => {
    setGlobalQuery('');
    setSearchResults([]);
    setSearchFocused(false);
    if (result.type === 'resident') {
      setActiveTab('residents');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-resident', { detail: result.id }));
      }, 100);
    } else if (result.type === 'household') {
      setActiveTab('households');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-household', { detail: result.id }));
      }, 100);
    }
  };

  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/?t=${session?.user?.id || ''}`;
    navigator.clipboard.writeText(link);
    const ev = new CustomEvent('show-toast', { 
      detail: { message: 'Đã sao chép đường dẫn chia sẻ cho Bà con!', type: 'success' } 
    });
    window.dispatchEvent(ev);
  };

  const handleOpenSettings = () => {
    setTdpNameInput(tdpName);
    setWardNameInput(wardName);
    setLeaderNameInput(leaderName);
    setLeaderPhoneInput(leaderPhone);
    setGroupIdInput(groupId);
    setTargetNghieoInput(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000');
    setTargetDapNghiaInput(localStorage.getItem('target_den_on_dap_nghia') || '10000000');
    setTargetVeSinhInput(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000');
    setSbUrl(localStorage.getItem('supabase_url') || '');
    setSbKey(localStorage.getItem('supabase_anon_key') || '');
    setGuestPinInput(localStorage.getItem('guest_access_pin') || '1234');
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lưu tên TDP
    const newName = tdpNameInput.trim() || 'Nam Sầm Sơn';
    localStorage.setItem('tdp_name', newName);
    setTdpName(newName);
    // Thông báo cho các trang khác (Dashboard...) cập nhật tên ngay lập tức
    window.dispatchEvent(new CustomEvent('tdp-name-changed'));
    
    // Lưu tên Phường
    const newWardName = wardNameInput.trim() || 'Phường Nam Sầm Sơn';
    localStorage.setItem('ward_name', newWardName);
    setWardName(newWardName);

    // Lưu tên Tổ trưởng
    const newLeaderName = leaderNameInput.trim() || 'Kim Tuyến';
    localStorage.setItem('leader_name', newLeaderName);
    setLeaderName(newLeaderName);
    window.dispatchEvent(new CustomEvent('leader-name-changed'));

    // Lưu số điện thoại Tổ trưởng
    const newLeaderPhone = leaderPhoneInput.trim() || '0912 083 018 - 0899 661 982';
    localStorage.setItem('leader_phone', newLeaderPhone);
    setLeaderPhone(newLeaderPhone);
    window.dispatchEvent(new CustomEvent('leader-phone-changed'));

    // Lưu group_id
    const newGroupId = groupIdInput.trim() || 'NAM_SAM_SON_01';
    localStorage.setItem('group_id', newGroupId);
    setGroupId(newGroupId);
    window.dispatchEvent(new CustomEvent('group-id-changed'));

    // Lưu định mức các loại quỹ
    localStorage.setItem('target_vi_nguoi_ngheo', targetNghieoInput.trim() || '15000000');
    localStorage.setItem('target_den_on_dap_nghia', targetDapNghiaInput.trim() || '10000000');
    localStorage.setItem('target_ve_sinh_moi_truong', targetVeSinhInput.trim() || '30000000');
    window.dispatchEvent(new CustomEvent('fund-targets-changed'));

    // Lưu mã PIN truy cập cho Bà con
    const pinToSave = guestPinInput.trim() || '1234';
    try {
      await db.saveGuestPin(pinToSave);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `✅ Mã PIN "${pinToSave}" đã đồng bộ lên Database!`, type: 'success' }
      }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ Lỗi lưu PIN: ${(err as Error).message || err}`, type: 'danger' }
      }));
    }


    // Lưu Supabase config
    localStorage.setItem('supabase_url', sbUrl.trim());
    localStorage.setItem('supabase_anon_key', sbKey.trim());
    refreshSupabaseClient();
    setSettingsOpen(false);
    
    const ev = new CustomEvent('show-toast', { 
      detail: { message: `Đã lưu cấu hình địa bàn!`, type: 'success' } 
    });
    window.dispatchEvent(ev);
    // Chỉ reload nếu có thay đổi Supabase
    if (sbUrl.trim() || sbKey.trim()) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu trong LocalStorage và đặt lại dữ liệu mẫu ban đầu?')) {
      localStorage.clear();
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Đã khôi phục dữ liệu mẫu! Đang tải lại...', type: 'info' } 
      });
      window.dispatchEvent(ev);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Bạn muốn đăng xuất và đặt lại phiên làm việc? Cấu hình Supabase sẽ được giữ nguyên.')) {
      const ev = new CustomEvent('show-toast', { detail: { message: 'Đang đăng xuất...', type: 'info' } });
      window.dispatchEvent(ev);
      
      localStorage.removeItem('offline_mode');
      localStorage.removeItem('guest_mode');
      localStorage.removeItem('guest_tenant_id');
      setOfflineMode(false);
      setGuestMode(false);
      
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error('Lỗi khi đăng xuất Supabase:', err);
        }
      }
      setSession(null);
      
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 1000);
    }
  };

  const renderContent = () => {

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'households':
        return <Households />;
      case 'residents':
        return <Residents />;
      case 'policy':
        return <Policies />;
      case 'security':
        return <Security />;
      case 'complaints':
        return <Complaints />;
      case 'environment':
        return <Environment />;
      case 'finance':
        return <Finance />;
      case 'meetings':
        return <Meetings type="general" />;
      case 'meetings-party':
        return <Meetings type="party" />;
      case 'meetings-front':
        return <Meetings type="front" />;
      case 'meetings-minutes':
        return <MeetingMinutes />;
      case 'documents':
        return <Documents />;
      case 'map':
        return <CitizenMap />;
      case 'ai-assistant':
        return <AIAssistant />;
      default:
        return (
          <div className="content-card">
            <div className="placeholder">
               <BrainCircuit size={48} className="pulse" />
               <h3>Tính năng đang phát triển</h3>
               <p>Chức năng {menuItems.find((i: any) => i.id === activeTab)?.label} sẽ sớm được hoàn thiện.</p>
            </div>
          </div>
        );
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: PieChart, label: 'Bảng điều khiển' },
    { id: 'households', icon: Home, label: 'Quản lý Hộ dân' },
    { id: 'residents', icon: Users, label: 'Quản lý Nhân khẩu' },
    { id: 'policy', icon: UserCircle, label: 'Chế độ & Chính sách' },
    { id: 'security', icon: ShieldCheck, label: 'An ninh trật tự' },
    { id: 'complaints', icon: MessageSquare, label: 'Phản ánh kiến nghị', badge: pendingCount },
    { id: 'environment', icon: Leaf, label: 'Vệ sinh môi trường' },
    { id: 'finance', icon: Wallet, label: 'Thu chi cộng đồng' },
    { id: 'meetings', icon: Calendar, label: 'Họp dân' },
    { id: 'meetings-party', icon: Calendar, label: 'Họp chi bộ' },
    { id: 'meetings-front', icon: Calendar, label: 'Họp mặt trận' },
    { id: 'meetings-minutes', icon: FileText, label: 'Biên bản cuộc họp' },
    { id: 'documents', icon: FileText, label: 'Văn bản - Nghị quyết' },
    { id: 'map', icon: MapIcon, label: 'Bản đồ số dân cư' },
    { id: 'ai-assistant', icon: BrainCircuit, label: 'Trợ lý AI' },
  ].filter(item => {
    if (isGuestMode) {
      // Ẩn Quản lý Hộ dân, Quản lý Nhân khẩu, Họp chi bộ, Họp mặt trận, Trợ lý AI
      return !['households', 'residents', 'meetings-party', 'meetings-front', 'ai-assistant'].includes(item.id);
    }
    return true;
  });

  if (!session && !isOfflineMode && !isGuestMode) {
    return (
      <>
        {toast && (
          <div className={`toast-notification ${toast.type}`}>
            {toast.message}
          </div>
        )}
        <Login 
          onOfflineMode={() => {
            localStorage.setItem('offline_mode', 'true');
            setOfflineMode(true);
            const ev = new CustomEvent('show-toast', { detail: { message: 'Đang chuyển sang chế độ ngoại tuyến...', type: 'info' } });
            window.dispatchEvent(ev);
          }} 
          onGuestMode={() => {
            localStorage.setItem('guest_mode', 'true');
            setGuestMode(true);
            const ev = new CustomEvent('show-toast', { detail: { message: 'Đang đăng nhập chế độ Đọc công khai...', type: 'info' } });
            window.dispatchEvent(ev);
          }}
        />
      </>
    );
  }

  return (
    <div className="layout-container">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px 20px 16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div className="logo-container" style={{ alignItems: 'flex-start', gap: '10px' }}>
              <ShieldCheck size={36} color="#3b82f6" fill="rgba(59, 130, 246, 0.15)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div className="logo-text" style={{ gap: '2px', display: 'flex', flexDirection: 'column' }}>
                <span className="logo-title" style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>QL TDP</span>
                <span className="logo-subtitle" style={{ fontSize: '1.25rem', color: '#ffffff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 1, lineHeight: '1.2' }}>{tdpName}</span>
                <span className="logo-ward" style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{wardName}</span>
              </div>
            </div>
            {window.innerWidth <= 768 && (
              <button onClick={() => setSidebarOpen(false)} className="close-sidebar" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X size={24} />
              </button>
            )}
          </div>
          
          {/* Glassmorphic contact card for the leader */}
          <div className="sidebar-contact-card" style={{
            marginTop: '6px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: '8px',
            padding: '8px 10px',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#f8fafc', fontWeight: '700' }}>{leaderName}:</span>
              <span style={{ color: '#60a5fa' }}>{leaderPhone}</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavItem 
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
              badge={item.badge}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            {session?.user?.user_metadata?.avatar_url ? (
              <img 
                src={session.user.user_metadata.avatar_url} 
                alt="Avatar" 
                className="avatar-img" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(59, 130, 246, 0.5)' }} 
              />
            ) : (
              <div className="avatar">
                {session?.user?.user_metadata?.full_name 
                  ? session.user.user_metadata.full_name.split(' ').pop()?.slice(0, 2).toUpperCase() 
                  : (session?.user?.email ? session.user.email.slice(0, 2).toUpperCase() : 'AD')}
              </div>
            )}
            <div className="user-info" style={{ overflow: 'hidden' }}>
              <span className="user-name" title={session?.user?.user_metadata?.full_name || session?.user?.email || 'Tổ trưởng'} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                {session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Tổ trưởng'}
              </span>
              <span className="user-role" title={session?.user?.email || 'Ngoại tuyến'} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                {isOfflineMode ? 'Chế độ Ngoại tuyến' : 'Tài khoản Google'}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            {!isSidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="menu-toggle">
                <Menu size={24} />
              </button>
            )}
            <h2 className="page-title">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="header-right">
            <div className="search-bar" style={{ position: 'relative' }}>
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm hộ dân, nhân khẩu..." 
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              />
              {isSearchFocused && searchResults.length > 0 && (
                <div className="search-results-dropdown">
                  {searchResults.map(res => (
                    <div 
                      key={res.id} 
                      className="search-result-item" 
                      onMouseDown={() => handleSearchResultClick(res)}
                    >
                      <div className="res-name">{res.name}</div>
                      <div className="res-detail">{res.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setNotifOpen(!isNotifOpen)} title="Cảnh báo">
                <Bell size={20} />
                {notifList.length > 0 && <span className="dot"></span>}
              </button>
              {isNotifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <h4>Cảnh báo & Kiến nghị ({notifList.length})</h4>
                    <button onClick={() => setNotifOpen(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                  </div>
                  <div className="notif-dropdown-body">
                    {notifList.map(n => (
                      <div 
                        key={n.id} 
                        className="notif-dropdown-item" 
                        onClick={() => {
                          setActiveTab(n.type);
                          setNotifOpen(false);
                        }}
                      >
                        <div className="notif-text">{n.text}</div>
                        <div className="notif-time">{n.time}</div>
                      </div>
                    ))}
                    {notifList.length === 0 && (
                      <div className="notif-empty">Không có cảnh báo mới</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!isGuestMode && (
              <button className="icon-btn" onClick={handleOpenSettings} title="Cấu hình hệ thống">
                <Settings size={20} />
              </button>
            )}
          </div>
        </header>

        <section className="content-area">
          {renderContent()}
        </section>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content medium">
            <div className="modal-header">
              <h2>⚙️ Cấu hình hệ thống</h2>
              <button className="close-btn" onClick={() => setSettingsOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveSettings} className="modal-form">

              {/* ─── Phần 1: Thông tin Tổ dân phố ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))',
                border: '1.5px solid rgba(37,99,235,0.18)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  🏘️ Thông tin địa bàn
                </div>
                <div className="form-group">
                  <label>Tên Tổ dân phố / Khu dân cư</label>
                  <input
                    type="text"
                    value={tdpNameInput}
                    onChange={(e) => setTdpNameInput(e.target.value)}
                    placeholder="Ví dụ: Nam Sầm Sơn, Thôn 5..."
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Tên Phường / Xã</label>
                  <input
                    type="text"
                    value={wardNameInput}
                    onChange={(e) => setWardNameInput(e.target.value)}
                    placeholder="Ví dụ: Phường Nam Sầm Sơn..."
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Họ và tên Tổ trưởng Tổ dân phố</label>
                  <input
                    type="text"
                    value={leaderNameInput}
                    onChange={(e) => setLeaderNameInput(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Kim Tuyến..."
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại Tổ trưởng</label>
                  <input
                    type="text"
                    value={leaderPhoneInput}
                    onChange={(e) => setLeaderPhoneInput(e.target.value)}
                    placeholder="Ví dụ: 0912 083 018..."
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Mã định danh địa bàn (Group ID) *</label>
                  <input
                    type="text"
                    value={groupIdInput}
                    onChange={(e) => setGroupIdInput(e.target.value)}
                    placeholder="Ví dụ: NAM_SAM_SON_01..."
                    required
                    maxLength={30}
                  />
                </div>
              </div>

              {/* ─── Phần 1b: Chỉ tiêu thu nộp các loại quỹ ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                border: '1.5px solid rgba(16,185,129,0.18)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  🎯 Chỉ tiêu thu nộp quỹ Tổ dân phố (VNĐ)
                </div>
                <div className="form-group">
                  <label>Chỉ tiêu Quỹ Vì người nghèo</label>
                  <input
                    type="number"
                    value={targetNghieoInput}
                    onChange={(e) => setTargetNghieoInput(e.target.value)}
                    placeholder="Ví dụ: 15000000"
                  />
                </div>
                <div className="form-group">
                  <label>Chỉ tiêu Quỹ Đền ơn đáp nghĩa</label>
                  <input
                    type="number"
                    value={targetDapNghiaInput}
                    onChange={(e) => setTargetDapNghiaInput(e.target.value)}
                    placeholder="Ví dụ: 10000000"
                  />
                </div>
                <div className="form-group">
                  <label>Chỉ tiêu Phí vệ sinh môi trường</label>
                  <input
                    type="number"
                    value={targetVeSinhInput}
                    onChange={(e) => setTargetVeSinhInput(e.target.value)}
                    placeholder="Ví dụ: 30000000"
                  />
                </div>
              </div>

              {/* ─── Phần 1c: Bảo mật truy cập công cộng ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
                border: '1.5px solid rgba(245,158,11,0.18)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  🔒 Bảo mật truy cập công cộng
                </div>
                <div className="form-group">
                  <label>Mã PIN truy cập cho Bà con</label>
                  <input
                    type="text"
                    value={guestPinInput}
                    onChange={(e) => setGuestPinInput(e.target.value)}
                    placeholder="Mặc định: 1234"
                    maxLength={10}
                  />
                </div>
                {session?.user?.id && (
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label>Đường dẫn chia sẻ cho Bà con</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?t=${session.user.id}`}
                        style={{ background: 'rgba(0,0,0,0.05)', color: '#64748b', fontSize: '0.82rem', flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCopyShareLink}
                        style={{ fontSize: '0.8rem', padding: '0 12px', height: 'auto', minHeight: '34px', borderRadius: '6px', flexShrink: 0 }}
                      >
                        Sao chép
                      </button>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4', marginTop: '2px', display: 'block' }}>
                      * Gửi link này cho Bà con để họ truy cập và xem công khai bằng mã PIN của tổ.
                    </span>
                  </div>
                )}
              </div>

              {/* ─── Phần 2: Kết nối Supabase ─── */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '16px 18px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                  🗄️ Kết nối cơ sở dữ liệu (Supabase)
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Supabase Project URL</label>
                  <input
                    type="text"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    placeholder="Ví dụ: https://xxxx.supabase.co"
                  />
                </div>
                <div className="form-group">
                  <label>Supabase Anon Key</label>
                  <input
                    type="password"
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    placeholder="Nhập mã Anon Key của bạn..."
                  />
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#64748b', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span><strong>Lưu ý CSDL:</strong> Nếu để trống, hệ thống dùng bộ nhớ cục bộ (LocalStorage).</span>
                  <span><strong>Lưu ý Google Auth:</strong> Vui lòng cấu hình URL Redirect trong Supabase Dashboard là <code>{window.location.origin}</code> để đăng nhập Google OAuth hoạt động chính xác.</span>
                </div>
              </div>

              {/* ─── Phần 3: Nguy hiểm ─── */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={handleClearDatabase}
                >
                  🔄 Khôi phục dữ liệu mẫu
                </button>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSettingsOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">💾 Lưu cấu hình</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
