import { useState, useEffect } from 'react';
import { db, refreshSupabaseClient, supabase, getSqlPatchForMissingTables } from './services/db';
import { APP_VERSION } from './config/version';
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
import PartyCell from './pages/PartyCell';
import Regulations from './pages/Regulations';
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
  BrainCircuit,
  Star,
  BookOpen,
  Upload,
  MessageCircle,
  Send,
  Bot
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

  // Floating widgets state
  const [zaloOpen, setZaloOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [miniChatMessages, setMiniChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [miniChatInput, setMiniChatInput] = useState('');
  const [miniChatLoading, setMiniChatLoading] = useState(false);

  const handleMiniChatSend = () => {
    const text = miniChatInput.trim();
    if (!text || miniChatLoading) return;
    setMiniChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setMiniChatInput('');
    setMiniChatLoading(true);
    setTimeout(async () => {
      // Re-use same AI logic from AIAssistant
      const q = text.toLowerCase();
      const rawTdp = localStorage.getItem('tdp_name') || 'Kim Tuyến';
      const tdpName = rawTdp === 'Quảng Giao' || rawTdp === 'TDP Quảng Giao' || rawTdp === 'Tiến Quảng Giao' ? 'Kim Tuyến' : rawTdp;
      let reply = '';
      if (q.includes('xin chào') || q.includes('hello') || q.includes('chào')) {
        reply = `Xin chào! Tôi là Trợ lý AI của: ${tdpName}. 😊\n\nTôi có thể giúp bạn soạn thảo:\n• Biên bản họp tổ dân phố\n• Báo cáo tháng\n• Thông báo, kế hoạch vận động\n• Tờ trình, công văn hành chính\n\nBạn cần soạn văn bản gì?`;
      } else if (q.includes('biên bản') || q.includes('họp')) {
        reply = `Để soạn biên bản họp, vui lòng vào tab ➤ Trợ lý AI trên menu và nhập yêu cầu chi tiết.\n\nHoặc nhắn tôi nội dung cụ thể: "Soạn biên bản họp tổ dân phố tháng 7" để tôi tạo ngay!`;
      } else if (q.includes('báo cáo')) {
        reply = `Tôi có thể soạn báo cáo tháng cho Tổ dân phố.\n\nVui lòng vào ➤ Trợ lý AI để soạn đầy đủ với số liệu thực tế từ hệ thống, hoặc mô tả nội dung cần báo cáo.`;
      } else if (q.includes('số hộ') || q.includes('dân số') || q.includes('nhân khẩu')) {
        reply = `Thông tin dân số của Tổ dân phố được quản lý trong module Hộ gia đình & Nhân khẩu.\n\nVui lòng vào tab "Hộ gia đình" hoặc "Nhân khẩu" để xem số liệu chi tiết.`;
      } else if (q.includes('đảng phí') || q.includes('đảng viên')) {
        reply = `Thông tin đảng phí và đảng viên được quản lý trong tab Chi bộ Đảng.\n\nTheo Quy định 01-QĐ/TW 2026:\n• Có BHXH: đóng 1% lương\n• Lương hưu: 0,5%\n• Học sinh: 5.000đ/tháng`;
      } else {
        reply = `Cảm ơn bạn đã nhắn!\n\nTôi là Trợ lý AI chuyên hỗ trợ soạn thảo văn bản hành chính cho Tổ dân phố.\n\nBạn có thể yêu cầu tôi:\n• "Soạn biên bản họp tháng 7"\n• "Viết báo cáo tháng"\n• "Soạn thông báo vận động quỹ"\n\nHoặc vào tab Trợ lý AI để soạn đầy đủ hơn! 📝`;
      }
      setMiniChatMessages(prev => [...prev, { role: 'ai', content: reply }]);
      setMiniChatLoading(false);
      // Auto scroll
      setTimeout(() => {
        const el = document.getElementById('ai-chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }, 800);
  };


  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userRole, setUserRole] = useState<string>(localStorage.getItem('current_role') || 'mat_tran');

  useEffect(() => {
    // Check if the current role is verified on this device
    const initRole = localStorage.getItem('current_role') || 'mat_tran';
    const isVerified = localStorage.getItem(`role_verified_${initRole}`) === 'true';
    
    if (!isVerified && initRole !== 'mat_tran') {
      // If it is a privileged role but not verified, force it to 'mat_tran' (read-only, safe role)
      localStorage.setItem('current_role', 'mat_tran');
      setUserRole('mat_tran');
      // Sync child pages immediately after mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('role-changed', { detail: 'mat_tran' }));
      }, 0);
    }

    const syncRolePins = async () => {
      try {
        const pAdmin = await (db as any).getRolePin('admin');
        const pToTruong = await (db as any).getRolePin('to_truong');
        const pBiThu = await (db as any).getRolePin('bi_thu');
        const pMatTran = await (db as any).getRolePin('mat_tran');
        localStorage.setItem('role_pin_admin', pAdmin);
        localStorage.setItem('role_pin_to_truong', pToTruong);
        localStorage.setItem('role_pin_bi_thu', pBiThu);
        localStorage.setItem('role_pin_mat_tran', pMatTran);
      } catch (e) {
        console.error('Failed to sync role PINs on mount', e);
      }
    };
    syncRolePins();
  }, []);

  const [pinPrompt, setPinPrompt] = useState<{ role: string; label: string } | null>(null);

  const handleRoleChange = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Quản trị hệ thống',
      to_truong: 'Tổ trưởng dân phố',
      bi_thu: 'Bí thư Chi bộ',
      mat_tran: 'Trưởng ban Mặt trận'
    };

    // Check if device already verified this role
    const isVerified = localStorage.getItem(`role_verified_${role}`) === 'true';
    if (!isVerified) {
      setPinPrompt({ role, label: roleLabels[role] });
      return;
    }

    executeRoleChange(role);
  };

  const executeRoleChange = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Quản trị hệ thống',
      to_truong: 'Tổ trưởng dân phố',
      bi_thu: 'Bí thư Chi bộ',
      mat_tran: 'Trưởng ban Mặt trận'
    };
    
    localStorage.setItem('current_role', role);
    setUserRole(role);
    window.dispatchEvent(new CustomEvent('role-changed', { detail: role }));
    
    // Auto redirect if active tab is restricted in new role
    if (role === 'mat_tran' && ['party-cell', 'meetings-party'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
    
    const ev = new CustomEvent('show-toast', { 
      detail: { message: `Đã chuyển sang vai trò: ${roleLabels[role]}`, type: 'success' } 
    });
    window.dispatchEvent(ev);
  };

  const [toast, setToast] = useState<{message: string, type: 'success' | 'danger' | 'warning' | 'info'} | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Tên Tổ dân phố (có thể sửa)
  const [tdpName, setTdpName] = useState(() => {
    const stored = localStorage.getItem('tdp_name');
    if (stored === 'Quảng Giao' || stored === 'TDP Quảng Giao' || stored === 'Tiến Quảng Giao') {
      localStorage.setItem('tdp_name', 'Kim Tuyến');
      return 'Kim Tuyến';
    }
    return stored || 'Kim Tuyến';
  });
  const [wardName, setWardName] = useState(localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn');
  const [leaderName, setLeaderName] = useState(localStorage.getItem('leader_name') || 'Kim Tuyến');
  const [leaderPhone, setLeaderPhone] = useState(localStorage.getItem('leader_phone') || '0912 083 018 - 0899 661 982');
  const [groupId, setGroupId] = useState(localStorage.getItem('group_id') || 'NAM_SAM_SON_01');
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem('logo_url') || '');
  const [logoError, setLogoError] = useState(false);
  const [supportName, setSupportName] = useState(localStorage.getItem('support_name') || 'Kim Tuyến');
  const [supportPhone, setSupportPhone] = useState(localStorage.getItem('support_phone') || '0912 083 018 - 0899661982');

  // Settings modal states
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [rolePinAdminInput, setRolePinAdminInput] = useState('9999');
  const [rolePinToTruongInput, setRolePinToTruongInput] = useState('0000');
  const [rolePinBiThuInput, setRolePinBiThuInput] = useState('1111');
  const [rolePinMatTranInput, setRolePinMatTranInput] = useState('2222');
  const [sbKey, setSbKey] = useState(localStorage.getItem('supabase_anon_key') || '');
  const [tdpNameInput, setTdpNameInput] = useState(tdpName);
  const [wardNameInput, setWardNameInput] = useState(wardName);
  const [leaderNameInput, setLeaderNameInput] = useState(leaderName);
  const [leaderPhoneInput, setLeaderPhoneInput] = useState(leaderPhone);
  const [groupIdInput, setGroupIdInput] = useState(groupId);
  const [logoUrlInput, setLogoUrlInput] = useState(logoUrl);
  const [supportNameInput, setSupportNameInput] = useState(supportName);
  const [supportPhoneInput, setSupportPhoneInput] = useState(supportPhone);

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);


  // Targets states for TDP Funds
  const [targetNghieoInput, setTargetNghieoInput] = useState(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000');
  const [targetDapNghiaInput, setTargetDapNghiaInput] = useState(localStorage.getItem('target_den_on_dap_nghia') || '10000000');
  const [targetVeSinhInput, setTargetVeSinhInput] = useState(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000');
  const [guestPinInput, setGuestPinInput] = useState(localStorage.getItem('guest_access_pin') || '1234');
  const [latestAppVersionInput, setLatestAppVersionInput] = useState(localStorage.getItem('latest_app_version') || APP_VERSION);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [latestAppVersion, setLatestAppVersion] = useState(localStorage.getItem('latest_app_version') || APP_VERSION);

  const [missingTables, setMissingTables] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('detected_missing_tables') || '[]');
    } catch {
      return [];
    }
  });
  const [showSqlPatchModal, setShowSqlPatchModal] = useState(false);

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

  const loadSystemConfig = async () => {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUid = session?.user?.id;
      // Dùng tham số ?t= trên URL hoặc guest_tenant_id làm targetUid nếu là khách vãng lai
      const urlParams = new URLSearchParams(window.location.search);
      const urlTenant = urlParams.get('t');
      const guestUid = urlTenant || localStorage.getItem('guest_tenant_id');
      const targetUid = adminUid || guestUid;
      
      let query = supabase.from('app_config').select('key, value');
      if (targetUid) {
        query = query.eq('user_id', targetUid);
      }
      
      const { data, error } = await query;
        
      if (!error && data && data.length > 0) {
        data.forEach(item => {
          localStorage.setItem(item.key, item.value);
        });
        
        // Update states from synchronized local storage values
        const rawTdp = localStorage.getItem('tdp_name') || 'Kim Tuyến';
        const newTdp = rawTdp === 'Quảng Giao' || rawTdp === 'TDP Quảng Giao' || rawTdp === 'Tiến Quảng Giao' ? 'Kim Tuyến' : rawTdp;
        const newWard = localStorage.getItem('ward_name') || 'Phường Nam Sầm Sơn';
        const newLeader = localStorage.getItem('leader_name') || 'Kim Tuyến';
        const newPhone = localStorage.getItem('leader_phone') || '0912 083 018 - 0899 661 982';
        const newGroup = localStorage.getItem('group_id') || 'NAM_SAM_SON_01';
        const newLogoUrl = localStorage.getItem('logo_url') || '';
        const newSupportName = localStorage.getItem('support_name') || 'Kim Tuyến';
        const newSupportPhone = localStorage.getItem('support_phone') || '0912 083 018 - 0899661982';
        const newLatestVersion = localStorage.getItem('latest_app_version') || APP_VERSION;
        
        setTdpName(newTdp);
        setWardName(newWard);
        setLeaderName(newLeader);
        setLeaderPhone(newPhone);
        setGroupId(newGroup);
        setLogoUrl(newLogoUrl);
        setLogoError(false);
        setSupportName(newSupportName);
        setSupportPhone(newSupportPhone);
        setLatestAppVersion(newLatestVersion);
        
        // Check for updates
        if (newLatestVersion !== APP_VERSION && newLatestVersion > APP_VERSION) {
          setShowUpdateModal(true);
        }
        
        // Dispatch events for child tabs to pick up the updated names
        window.dispatchEvent(new CustomEvent('tdp-name-changed'));
        window.dispatchEvent(new CustomEvent('leader-name-changed'));
        window.dispatchEvent(new CustomEvent('leader-phone-changed'));
        window.dispatchEvent(new CustomEvent('group-id-changed'));
        window.dispatchEvent(new CustomEvent('fund-targets-changed'));
      }
    } catch (e) {
      console.error('Failed to load system config from Supabase:', e);
    }
  };

  // Cập nhật session và lắng nghe sự thay đổi Auth
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadSystemConfig();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        localStorage.removeItem('offline_mode');
        setOfflineMode(false);
        loadSystemConfig();
      }
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setSettingsOpen(true);
        const ev = new CustomEvent('show-toast', { 
          detail: { message: 'Vui lòng thiết lập mật khẩu mới trong phần cấu hình!', type: 'info' } 
        });
        window.dispatchEvent(ev);
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
    const handleDbChanged = () => {
      if (session || isOfflineMode || isGuestMode) {
        loadPendingCountAndAlerts();
      }
    };

    if (session || isOfflineMode || isGuestMode) {
      loadPendingCountAndAlerts();
    }

    window.addEventListener('db-changed', handleDbChanged);
    return () => window.removeEventListener('db-changed', handleDbChanged);
  }, [session, isOfflineMode, isGuestMode]);

  useEffect(() => {
    const handleMissingTables = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setMissingTables(customEvent.detail);
      } else {
        try {
          const list = JSON.parse(localStorage.getItem('detected_missing_tables') || '[]');
          setMissingTables(list);
        } catch {
          setMissingTables([]);
        }
      }
    };
    window.addEventListener('missing-tables-updated', handleMissingTables);
    return () => window.removeEventListener('missing-tables-updated', handleMissingTables);
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
            const hh = households.find(h => h.id === r.household_id);
            let hhInfo = '';
            if (hh) {
              const head = residents.find(res => res.id === hh.head_of_household_id);
              const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
              hhInfo = ` | Hộ: ${headName} (${hh.address})`;
            }
            results.push({
              id: r.id,
              type: 'resident',
              name: r.full_name,
              detail: `Nhân khẩu${hhInfo} - CCCD: ${r.cccd || 'Chưa cấp'} - SĐT: ${r.phone || 'Không có'}`
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

  const handleCloseSqlModal = () => {
    setShowSqlPatchModal(false);
    try {
      const list = JSON.parse(localStorage.getItem('detected_missing_tables') || '[]');
      setMissingTables(list);
    } catch {
      setMissingTables([]);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '❌ Kích thước ảnh quá lớn. Vui lòng chọn ảnh < 2MB', type: 'danger' }
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrlInput(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenSettings = () => {
    setTdpNameInput(tdpName);
    setWardNameInput(wardName);
    setLeaderNameInput(leaderName);
    setLeaderPhoneInput(leaderPhone);
    setGroupIdInput(groupId);
    setLogoUrlInput(logoUrl);
    setSupportNameInput(supportName);
    setSupportPhoneInput(supportPhone);
    setTargetNghieoInput(localStorage.getItem('target_vi_nguoi_ngheo') || '15000000');
    setTargetDapNghiaInput(localStorage.getItem('target_den_on_dap_nghia') || '10000000');
    setTargetVeSinhInput(localStorage.getItem('target_ve_sinh_moi_truong') || '30000000');
    setSbUrl(localStorage.getItem('supabase_url') || '');
    setSbKey(localStorage.getItem('supabase_anon_key') || '');
    setGuestPinInput(localStorage.getItem('guest_access_pin') || '1234');
    setRolePinAdminInput(localStorage.getItem('role_pin_admin') || '9999');
    setRolePinToTruongInput(localStorage.getItem('role_pin_to_truong') || '0000');
    setRolePinBiThuInput(localStorage.getItem('role_pin_bi_thu') || '1111');
    setRolePinMatTranInput(localStorage.getItem('role_pin_mat_tran') || '2222');
    setLatestAppVersionInput(localStorage.getItem('latest_app_version') || APP_VERSION);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lưu tên TDP
    const newName = tdpNameInput.trim() || 'Kim Tuyến';
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

    // Lưu người hỗ trợ (Sidebar)
    const newSupportName = supportNameInput.trim() || 'Kim Tuyến';
    const newSupportPhone = supportPhoneInput.trim() || '0912 083 018 - 0899661982';
    localStorage.setItem('support_name', newSupportName);
    localStorage.setItem('support_phone', newSupportPhone);
    setSupportName(newSupportName);
    setSupportPhone(newSupportPhone);

    // Lưu logo
    const newLogo = logoUrlInput.trim();
    localStorage.setItem('logo_url', newLogo);
    setLogoUrl(newLogo);
    setLogoError(false);

    // Lưu định mức các loại quỹ
    localStorage.setItem('target_vi_nguoi_ngheo', targetNghieoInput.trim() || '15000000');
    localStorage.setItem('target_den_on_dap_nghia', targetDapNghiaInput.trim() || '10000000');
    localStorage.setItem('target_ve_sinh_moi_truong', targetVeSinhInput.trim() || '30000000');
    window.dispatchEvent(new CustomEvent('fund-targets-changed'));
    
    // Lưu phiên bản mới nhất
    const newVersion = latestAppVersionInput.trim() || APP_VERSION;
    localStorage.setItem('latest_app_version', newVersion);
    setLatestAppVersion(newVersion);

    // Lưu mã PIN truy cập cho Bà con
    const pinToSave = guestPinInput.trim() || '1234';
    const pinAdminToSave = rolePinAdminInput.trim() || '9999';
    const pinToTruongToSave = rolePinToTruongInput.trim() || '0000';
    const pinBiThuToSave = rolePinBiThuInput.trim() || '1111';
    const pinMatTranToSave = rolePinMatTranInput.trim() || '2222';
    try {
      await db.saveGuestPin(pinToSave);
      await (db as any).saveRolePin('admin', pinAdminToSave);
      await (db as any).saveRolePin('to_truong', pinToTruongToSave);
      await (db as any).saveRolePin('bi_thu', pinBiThuToSave);
      await (db as any).saveRolePin('mat_tran', pinMatTranToSave);

      // Mark as verified on this device since we configured it
      localStorage.setItem('role_verified_admin', 'true');
      localStorage.setItem('role_verified_to_truong', 'true');
      localStorage.setItem('role_verified_bi_thu', 'true');
      localStorage.setItem('role_verified_mat_tran', 'true');

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `✅ Cấu hình và mã PIN phân quyền đã đồng bộ lên Database!`, type: 'success' }
      }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ Lỗi lưu PIN: ${(err as Error).message || err}`, type: 'danger' }
      }));
    }


    // Đồng bộ các cấu hình khác lên bảng app_config của Supabase
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uId = session?.user?.id;
        if (uId) {
          const configItems = [
            { user_id: uId, key: 'tdp_name', value: newName },
            { user_id: uId, key: 'ward_name', value: newWardName },
            { user_id: uId, key: 'leader_name', value: newLeaderName },
            { user_id: uId, key: 'leader_phone', value: newLeaderPhone },
            { user_id: uId, key: 'group_id', value: newGroupId },
            { user_id: uId, key: 'support_name', value: newSupportName },
            { user_id: uId, key: 'support_phone', value: newSupportPhone },
            { user_id: uId, key: 'logo_url', value: newLogo },
            { user_id: uId, key: 'target_vi_nguoi_ngheo', value: targetNghieoInput.trim() || '15000000' },
            { user_id: uId, key: 'target_den_on_dap_nghia', value: targetDapNghiaInput.trim() || '10000000' },
            { user_id: uId, key: 'target_ve_sinh_moi_truong', value: targetVeSinhInput.trim() || '30000000' },
            { user_id: uId, key: 'latest_app_version', value: newVersion }
          ];
          await supabase.from('app_config').upsert(configItems);
        }
      } catch (err) {
        console.error('Failed to sync config settings to Supabase:', err);
      }
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

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Vui lòng nhập mật khẩu mới!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }
    if (newPassword.length < 6) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Mật khẩu phải chứa ít nhất 6 ký tự!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Mật khẩu xác nhận không khớp!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }

    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error('Supabase client chưa được cấu hình.');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Đổi mật khẩu tài khoản thành công!', type: 'success' } 
      });
      window.dispatchEvent(ev);
      setNewPassword('');
      setConfirmNewPassword('');
      setIsRecoveryMode(false);
      
      // Clear hash recovery tokens if any
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (err: any) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `Lỗi đổi mật khẩu: ${err.message || err}`, type: 'danger' } 
      });
      window.dispatchEvent(ev);
    } finally {
      setPasswordLoading(false);
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
      case 'party-cell':
        return <PartyCell />;
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
      case 'regulations':
        return <Regulations />;
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
    { id: 'regulations', icon: BookOpen, label: 'Quy định & Nhiệm vụ' },
    { id: 'party-cell', icon: Star, label: 'Chi bộ Đảng' },
    { id: 'map', icon: MapIcon, label: 'Bản đồ số dân cư' },
    { id: 'ai-assistant', icon: BrainCircuit, label: 'Trợ lý AI' },
  ].filter(item => {
    if (isGuestMode) {
      // Ẩn các mục nhạy cảm với chế độ khách
      return !['households', 'residents', 'meetings-party', 'meetings-front', 'party-cell', 'ai-assistant'].includes(item.id);
    }
    if (userRole === 'mat_tran') {
      // Ẩn chi bộ đối với Mặt trận
      return !['party-cell', 'meetings-party'].includes(item.id);
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
              {logoUrl && !logoError ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  style={{ width: '40px', height: '40px', objectFit: 'contain', marginTop: '2px', flexShrink: 0, borderRadius: '4px' }} 
                  onError={() => setLogoError(true)}
                />
              ) : (
                <ShieldCheck size={36} color="rgba(251, 255, 0, 1)" fill="rgba(59, 130, 246, 0.15)" style={{ marginTop: '2px', flexShrink: 0 }} />
              )}
              <div className="logo-text" style={{ gap: '2px', display: 'flex', flexDirection: 'column' }}>
                <span className="logo-title" style={{ fontSize: '0.8rem', color: '#fbff03ee', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TỔ DÂN PHỐ</span>
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
          
          {/* Glassmorphic contact card for the software developer (Technical Support) */}
          <div className="sidebar-contact-card" style={{
            marginTop: '6px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: '8px',
            padding: '8px 10px',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#f8fafc', fontWeight: '700' }}>{supportName}:</span>
              <span style={{ color: '#60a5fa' }}>{supportPhone}</span>
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

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Role Switcher */}
          {!isGuestMode && (
            <div className="role-switcher-container" style={{
              padding: '0 0 10px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '4px',
              width: '100%'
            }}>
              <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>Vai trò thao tác:</label>
              <select 
                value={userRole} 
                onChange={(e) => handleRoleChange(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="admin">Quản trị hệ thống (Admin)</option>
                <option value="to_truong">Tổ trưởng dân phố</option>
                <option value="bi_thu">Bí thư Chi bộ</option>
                <option value="mat_tran">Trưởng ban Mặt trận</option>
              </select>
            </div>
          )}

          <div className="user-profile" style={{ width: '100%' }}>
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
                {isGuestMode ? 'Xem công khai' : userRole === 'admin' ? 'Quản trị hệ thống' : userRole === 'to_truong' ? 'Tổ trưởng TDP' : userRole === 'bi_thu' ? 'Bí thư Chi bộ' : 'Trưởng ban Mặt trận'}
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
        {/* Banner chạy chữ */}
        <div className="marquee-header">
          <div className="marquee-text">
            Ứng dụng được thiết kế và bảo trì bởi: Nguyễn Kim Tuyến (TDP Kim Tuyến) - SĐT: 0912083018 / 0899661982.
          </div>
        </div>
        
        <header className="main-header">
          <div className="header-left">
            {!isSidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="menu-toggle">
                <Menu size={24} />
              </button>
            )}
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>{menuItems.find(i => i.id === activeTab)?.label}</span>
              {leaderPhone && (
                <span 
                  className="header-phone-badge" 
                  onClick={handleOpenSettings}
                  title="Nhấp để thay đổi số điện thoại trong cấu hình"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    background: 'rgba(37, 99, 235, 0.08)',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  📞 SĐT: {leaderPhone}
                </span>
              )}
            </h2>
          </div>

          <div className="header-right">
            <div className="search-bar" style={{ position: 'relative' }}>
              <Search size={24} />
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

            {(userRole === 'to_truong' || userRole === 'admin') && !isGuestMode && (
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
                    maxLength={150}
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
                <div className="form-group">
                  <label>Tên người hỗ trợ (Sidebar)</label>
                  <input
                    type="text"
                    value={supportNameInput}
                    onChange={(e) => setSupportNameInput(e.target.value)}
                    placeholder="Ví dụ: Kim Tuyến"
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>SĐT người hỗ trợ (Sidebar)</label>
                  <input
                    type="text"
                    value={supportPhoneInput}
                    onChange={(e) => setSupportPhoneInput(e.target.value)}
                    placeholder="Ví dụ: 0912 083 018 - 0899661982"
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Logo (URL hình ảnh hoặc Tải lên)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={logoUrlInput.length > 200 ? "Ảnh đã được tải lên từ máy tính" : logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      placeholder="Nhập URL hoặc tải ảnh..."
                      style={{ flex: 1 }}
                      disabled={logoUrlInput.length > 200}
                    />
                    <label className="btn btn-primary" style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      <Upload size={16} /> Tải ảnh
                      <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                    {logoUrlInput && (
                       <button type="button" className="btn btn-danger" onClick={() => setLogoUrlInput('')} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Xóa</button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    * Tải ảnh lên (tối đa 2MB) hoặc để trống dùng biểu tượng mặc định.
                  </span>
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
              {userRole === 'admin' && (
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label>PIN Admin</label>
                    <input
                      type="text"
                      value={rolePinAdminInput}
                      onChange={(e) => setRolePinAdminInput(e.target.value)}
                      placeholder="Mặc định: 9999"
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label>PIN Tổ trưởng</label>
                    <input
                      type="text"
                      value={rolePinToTruongInput}
                      onChange={(e) => setRolePinToTruongInput(e.target.value)}
                      placeholder="Mặc định: 0000"
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label>PIN Bí thư</label>
                    <input
                      type="text"
                      value={rolePinBiThuInput}
                      onChange={(e) => setRolePinBiThuInput(e.target.value)}
                      placeholder="Mặc định: 1111"
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label>PIN Mặt trận</label>
                    <input
                      type="text"
                      value={rolePinMatTranInput}
                      onChange={(e) => setRolePinMatTranInput(e.target.value)}
                      placeholder="Mặc định: 2222"
                      maxLength={10}
                    />
                  </div>
                </div>
              )}
                <div className="form-group">
                  <label>Phiên bản phần mềm mới nhất (Admin)</label>
                  <input
                    type="text"
                    value={latestAppVersionInput}
                    onChange={(e) => setLatestAppVersionInput(e.target.value)}
                    placeholder="Ví dụ: 1.0.2"
                    maxLength={20}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    * Phiên bản hiện tại của file chạy này là: <strong>{APP_VERSION}</strong>. Đổi số này cao hơn để ép người khác cập nhật!
                  </span>
                </div>
                {session?.user?.id && (
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label>Đường dẫn chia sẻ cho Bà con</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?t=${session?.user?.id}`}
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

              {/* ─── Phần 1d: Đổi mật khẩu tài khoản (Chỉ hiển thị khi đã đăng nhập Supabase) ─── */}
              {session && !isOfflineMode && !isGuestMode && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))',
                  border: '1.5px solid rgba(99,102,241,0.18)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '12px'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                    🔒 Đổi mật khẩu tài khoản
                  </div>
                  
                  {isRecoveryMode && (
                    <div style={{
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '0.78rem',
                      color: '#d97706',
                      lineHeight: '1.4'
                    }}>
                      ⚠️ Bạn đang trong phiên khôi phục mật khẩu. Vui lòng cập nhật mật khẩu mới ngay dưới đây.
                    </div>
                  )}

                  <div className="form-group">
                    <label>Mật khẩu mới</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Xác nhận mật khẩu mới..."
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    style={{
                      marginTop: '4px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      borderColor: '#4f46e5',
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {passwordLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              )}

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

              {/* ─── Phần 2.5: Cảnh báo nâng cấp CSDL (Chỉ hiển thị khi phát hiện thiếu bảng) ─── */}
              {missingTables.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
                  border: '1.5px solid rgba(239,68,68,0.3)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ LỖI KẾT NỐI & ĐỒNG BỘ CƠ SỞ DỮ LIỆU SUPABASE
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5', lineHeight: '1.5', textAlign: 'left' }}>
                    <strong>Cảnh báo dữ liệu:</strong> Do CSDL của bạn thiếu các bảng (như: <strong>{missingTables.filter(t => t !== 'all').join(', ')}</strong>), ứng dụng phải chuyển sang chế độ lưu trữ cục bộ tạm thời (LocalStorage).
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5', lineHeight: '1.5', textAlign: 'left' }}>
                    ❌ <strong>Hệ quả:</strong> Dữ liệu bạn nhập trên thiết bị này sẽ <strong>không được đồng bộ</strong> sang các máy tính/điện thoại khác. Để dữ liệu đồng bộ đồng nhất, bạn phải khởi tạo đầy đủ bảng trong Supabase.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowSqlPatchModal(true)}
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: '#fca5a5',
                        borderColor: 'rgba(239,68,68,0.35)',
                        fontSize: '0.78rem',
                        padding: '6px 12px',
                        boxShadow: 'none'
                      }}
                    >
                      Xem SQL sửa lỗi bảng thiếu
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setMissingTables(['all']);
                        setShowSqlPatchModal(true);
                      }}
                      style={{
                        background: 'rgba(59,130,246,0.15)',
                        color: '#93c5fd',
                        borderColor: 'rgba(59,130,246,0.35)',
                        fontSize: '0.78rem',
                        padding: '6px 12px',
                        boxShadow: 'none'
                      }}
                    >
                      Lấy SQL khởi tạo toàn bộ CSDL (10 bảng)
                    </button>
                  </div>
                </div>
              )}

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

      {showSqlPatchModal && (
        <div className="modal-overlay" style={{ zIndex: 10001, background: 'rgba(15, 23, 42, 0.85)' }}>
          <div className="modal-content medium" style={{ background: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.3)', maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
                🛠️ {missingTables.includes('all') ? 'SQL Cấu trúc toàn bộ Cơ sở dữ liệu' : 'SQL Cập nhật Bảng bị thiếu'}
              </h2>
              <button className="close-btn" onClick={handleCloseSqlModal}><X size={24} /></button>
            </div>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                Vui lòng làm theo các bước dưới đây để bổ sung cấu trúc bảng vào cơ sở dữ liệu Supabase của bạn:
              </p>
              <ol style={{ fontSize: '0.85rem', color: '#cbd5e1', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Truy cập vào trang quản trị <strong><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Supabase Dashboard</a></strong>.</li>
                <li>Mở dự án của bạn, chọn mục <strong>SQL Editor</strong> ở thanh menu bên trái.</li>
                <li>Nhấn <strong>New Query</strong>, dán toàn bộ đoạn mã SQL dưới đây vào khung soạn thảo.</li>
                <li>Nhấn nút <strong>Run</strong> để chạy lệnh tạo bảng. Sau đó quay lại ứng dụng này và tải lại trang.</li>
              </ol>

              <div style={{ position: 'relative', marginTop: '12px' }}>
                <textarea
                  readOnly
                  value={getSqlPatchForMissingTables(missingTables)}
                  style={{
                    width: '100%',
                    height: '240px',
                    background: '#0f172a',
                    color: '#38bdf8',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.8rem',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxSizing: 'border-box',
                    resize: 'none',
                    outline: 'none'
                  }}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(getSqlPatchForMissingTables(missingTables));
                    const ev = new CustomEvent('show-toast', { 
                      detail: { message: 'Đã sao chép đoạn mã SQL cập nhật!', type: 'success' } 
                    });
                    window.dispatchEvent(ev);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '16px',
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    height: 'auto',
                    minHeight: '28px',
                    borderRadius: '6px'
                  }}
                >
                  Sao chép SQL
                </button>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseSqlModal}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thông báo cập nhật phiên bản */}
      {showUpdateModal && (
        <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(15, 23, 42, 0.95)' }}>
          <div className="modal-content" style={{ background: 'white', border: '2px solid #ef4444', maxWidth: '450px', textAlign: 'center', padding: '30px' }}>
            <div style={{ background: '#fef2f2', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ShieldCheck size={32} color="#ef4444" />
            </div>
            <h2 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '1.4rem' }}>Đã có phiên bản mới!</h2>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '1rem', lineHeight: '1.6' }}>
              Phiên bản hiện tại ({APP_VERSION}) đã cũ. Hệ thống đã nâng cấp lên phiên bản <strong>{latestAppVersion}</strong> với nhiều tính năng mới và sửa lỗi.
              <br /><br />
              Vui lòng liên hệ với Quản trị viên (Admin) hoặc kiểm tra nhóm Zalo để nhận file cài đặt <strong>.exe</strong> mới nhất nhé!
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', background: '#ef4444', borderColor: '#dc2626' }}
              onClick={() => {
                // Có thể cho phép họ tiếp tục bằng cách ẩn đi, nhưng để ép buộc thì chỉ ẩn nếu họ quyết định "Đã hiểu" (nếu không chặn cứng).
                // Ở đây mình cho phép đóng tạm để đề phòng lỗi, nhưng mỗi lần load lại đều báo.
                setShowUpdateModal(false);
              }}
            >
              Tôi đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Custom Role PIN Prompt Modal - 2D Light Blue */}
      {pinPrompt && (
        <RolePinModal
          roleLabel={pinPrompt.label}
          role={pinPrompt.role}
          onConfirm={(pin) => {
            const defaultPins: Record<string, string> = {
              admin: '9999',
              to_truong: '0000',
              bi_thu: '1111',
              mat_tran: '2222'
            };
            const correctPin = localStorage.getItem(`role_pin_${pinPrompt.role}`) || defaultPins[pinPrompt.role];
            
            if (pin !== correctPin) {
              // Reset dropdown selection visually
              const selectElement = document.querySelector('.role-switcher-container select') as HTMLSelectElement;
              if (selectElement) selectElement.value = userRole;
              
              const ev = new CustomEvent('show-toast', { 
                detail: { message: '❌ Mã PIN xác nhận vai trò không chính xác!', type: 'danger' } 
              });
              window.dispatchEvent(ev);
              setPinPrompt(null);
              return;
            }
            
            // Mark as verified on this device
            localStorage.setItem(`role_verified_${pinPrompt.role}`, 'true');
            executeRoleChange(pinPrompt.role);
            setPinPrompt(null);
          }}
          onCancel={() => {
            // Reset dropdown selection visually
            const selectElement = document.querySelector('.role-switcher-container select') as HTMLSelectElement;
            if (selectElement) selectElement.value = userRole;
            setPinPrompt(null);
          }}
        />
      )}

      {/* ═══ FLOATING BUTTONS: Zalo + AI Chat (always visible) ═══ */}
      <>
          {/* Floating Button Group — ngang hàng, Zalo trái / AI phải */}
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            flexDirection: 'row',
            gap: '10px',
            zIndex: 1200,
            alignItems: 'flex-end'
          }}>
            {/* Zalo Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => { setZaloOpen(v => !v); setAiChatOpen(false); }}
                title="Nhóm Zalo hỗ trợ"
                style={{
                  width: '52px', height: '52px', borderRadius: '16px',
                  background: zaloOpen ? '#0068ff' : '#fff',
                  border: `2px solid ${zaloOpen ? '#0068ff' : '#dbeafe'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: zaloOpen ? '0 6px 18px rgba(0,104,255,0.35)' : '0 4px 14px rgba(0,104,255,0.18)',
                  transition: 'all 0.2s ease', padding: 0, overflow: 'hidden'
                }}
              >
                <svg viewBox="0 0 48 48" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="48" rx="12" fill={zaloOpen ? '#0068ff' : '#fff'}/>
                  <text x="6" y="29" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16" fill={zaloOpen ? '#fff' : '#0068ff'} letterSpacing="-0.5">Zalo</text>
                  <path d="M8 36 Q14 44 22 40" stroke={zaloOpen ? '#fff' : '#0068ff'} strokeWidth="3" fill="none" strokeLinecap="round"/>
                </svg>
              </button>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', letterSpacing: '0.2px' }}>Zalo</span>
            </div>

            {/* AI Chat Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => { setAiChatOpen(v => !v); setZaloOpen(false); }}
                title="Chat với Trợ lý AI"
                style={{
                  width: '52px', height: '52px', borderRadius: '16px',
                  background: aiChatOpen ? '#2563eb' : '#fff',
                  border: `2px solid ${aiChatOpen ? '#2563eb' : '#bfdbfe'}`,
                  color: aiChatOpen ? '#fff' : '#2563eb',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: aiChatOpen ? '0 6px 18px rgba(37,99,235,0.35)' : '0 4px 14px rgba(37,99,235,0.18)',
                  transition: 'all 0.2s ease', flexShrink: 0
                }}
              >
                <Bot size={26} />
              </button>
              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', letterSpacing: '0.2px' }}>Trợ lý AI</span>
            </div>
          </div>


          {/* Zalo Popup — hiển thị phía trên nút Zalo */}
          {zaloOpen && (
            <div style={{
              position: 'fixed', bottom: '92px', right: '70px', zIndex: 1300,
              background: '#fff', border: '2px solid #dbeafe',
              borderRadius: '16px', padding: '20px',
              boxShadow: '0 8px 32px rgba(0,104,255,0.14)',
              width: '260px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e40af' }}>Nhóm Zalo Hỗ trợ</span>
                <button onClick={() => setZaloOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}><X size={18} /></button>
              </div>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>Trang Hỗ Trợ Ứng Dụng · Nhóm Zalo</div>
                {/* Zalo QR — dùng iframe Zalo */}
                <div style={{
                  width: '180px', height: '180px', margin: '0 auto', borderRadius: '10px',
                  overflow: 'hidden', border: '1.5px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f8fafc'
                }}>
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://zalo.me/g/llmncb888&color=000000&bgcolor=ffffff&margin=10"
                    alt="Zalo QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '8px' }}>Quét mã QR bằng Zalo để tham gia</div>
              </div>
              <a
                href="https://zalo.me/g/llmncb888"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: '#0068ff', color: '#fff', borderRadius: '10px',
                  padding: '9px 0', fontWeight: '700', fontSize: '0.88rem',
                  textDecoration: 'none', width: '100%', transition: 'opacity 0.15s'
                }}
              >
                Tham gia nhóm Zalo
              </a>
            </div>
          )}

          {/* AI Chat Widget — hiển thị phía trên nút Bot */}
          {aiChatOpen && (
            <div style={{
              position: 'fixed', bottom: '92px', right: '20px', zIndex: 1300,
              background: '#fff', border: '2px solid #bfdbfe',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(37,99,235,0.14)',
              width: '320px', height: '460px',
              display: 'flex', flexDirection: 'column',
              animation: 'fadeIn 0.2s ease-out',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                background: '#eff6ff', borderBottom: '1.5px solid #bfdbfe',
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <div style={{
                  width: '32px', height: '32px', background: '#2563eb', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={18} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e40af' }}>Trợ lý AI</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{tdpName || 'Kim Tuyến'}</div>
                </div>
                <button onClick={() => setAiChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}><X size={18} /></button>
              </div>

              {/* Messages */}
              <div id="ai-chat-messages" style={{
                flex: 1, overflowY: 'auto', padding: '14px 14px 8px 14px',
                display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                {miniChatMessages.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '24px 16px',
                    color: '#94a3b8', fontSize: '0.82rem', lineHeight: '1.5'
                  }}>
                    <Bot size={32} color="#bfdbfe" style={{ marginBottom: '8px' }} />
                    <div>Xin chào! Tôi là Trợ lý AI của: {tdpName}.</div>
                    <div>Hãy hỏi tôi về văn bản hành chính, báo cáo, biên bản...</div>
                  </div>
                )}
                {miniChatMessages.map((msg, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '85%',
                      background: msg.role === 'user' ? '#2563eb' : '#f1f5f9',
                      color: msg.role === 'user' ? '#fff' : '#1e293b',
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '8px 12px',
                      fontSize: '0.83rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {miniChatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      background: '#f1f5f9', borderRadius: '12px 12px 12px 2px',
                      padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center'
                    }}>
                      <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s infinite' }}></span>
                      <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s 0.2s infinite' }}></span>
                      <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s 0.4s infinite' }}></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{
                borderTop: '1.5px solid #e2e8f0', padding: '10px 12px',
                display: 'flex', gap: '8px', alignItems: 'flex-end', background: '#fff'
              }}>
                <textarea
                  value={miniChatInput}
                  onChange={(e) => setMiniChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMiniChatSend(); } }}
                  placeholder="Nhập yêu cầu... (Enter để gửi)"
                  rows={2}
                  style={{
                    flex: 1, border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    padding: '8px 10px', fontSize: '0.83rem', resize: 'none',
                    outline: 'none', fontFamily: 'inherit', lineHeight: '1.4'
                  }}
                />
                <button
                  onClick={handleMiniChatSend}
                  disabled={!miniChatInput.trim() || miniChatLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: miniChatInput.trim() && !miniChatLoading ? '#2563eb' : '#e2e8f0',
                    border: 'none', cursor: miniChatInput.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.2s'
                  }}
                >
                  <Send size={16} color={miniChatInput.trim() && !miniChatLoading ? '#fff' : '#94a3b8'} />
                </button>
              </div>
            </div>
          )}
          <style>{`
            @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
          `}</style>
        </>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HỢP THOẠI XÁC THỰC MÃ PIN VAI TRÒ (2D Light Blue Theme)
// ═══════════════════════════════════════════════════════════
const RolePinModal = ({ 
  roleLabel, 
  role,
  onConfirm, 
  onCancel 
}: { 
  roleLabel: string; 
  role: string;
  onConfirm: (pin: string) => void; 
  onCancel: () => void; 
}) => {
  const [pin, setPin] = useState('');
  const defaultPins: Record<string, string> = {
    admin: '9999',
    to_truong: '0000',
    bi_thu: '1111',
    mat_tran: '2222'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm(pin);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#f0f9ff', // Light blue background
        border: '1.5px solid #bae6fd',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(3, 105, 161, 0.12), 0 10px 10px -5px rgba(3, 105, 161, 0.06)',
        width: '100%',
        maxWidth: '400px',
        overflow: 'hidden',
        animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
          padding: '18px 20px',
          borderBottom: '1px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.4rem' }}>🔑</span>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0369a1', fontWeight: '800' }}>Xác thực vai trò</h3>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: '1.5' }}>
            Nhập mã PIN để chuyển sang vai trò <strong>{roleLabel}</strong>:
          </p>

          <input
            type="password"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập mã PIN..."
            maxLength={10}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid #bae6fd',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none',
              textAlign: 'center',
              letterSpacing: '4px',
              fontWeight: 'bold',
              color: '#0369a1',
              backgroundColor: 'white',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 18px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: 'white',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => onConfirm(pin)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0284c7',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0369a1'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
          >
            Xác nhận
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default App;
