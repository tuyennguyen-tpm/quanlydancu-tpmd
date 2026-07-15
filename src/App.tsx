import { useState, useEffect } from 'react';
import { db, refreshSupabaseClient, supabase, getSqlPatchForMissingTables, partyDb, checkAndSeedUser } from './services/db';
import { askGemini } from './services/ai';
import { APP_VERSION } from './config/version';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import AIAssistant from './pages/AIAssistant';
import CitizenMap from './pages/CitizenMap';
import Finance from './pages/Finance';
import WardFunds from './pages/WardFunds';
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
import WomenAssociation from './pages/WomenAssociation';
import CCBElderly from './pages/CCBElderly';
import FarmersAssociation from './pages/FarmersAssociation';
import YouthUnion from './pages/YouthUnion';
import WardDocuments from './pages/WardDocuments';
import InvitationTemplates from './pages/InvitationTemplates';
import { 
  Users, 
  Home, 
  UserCircle, 
  ShieldCheck, 
  Shield,
  UserPlus,
  MapPin,
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
  Bot,
  Plus,
  Trash2,
  ArrowRight,
  KeyRound,
  Check,
  Heart,
  TrendingUp,
  Award,
  UsersRound,
  FolderOpen,
  Sprout,
  Zap,
  Mail
} from 'lucide-react';
import './App.css';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
  badgeColor?: string;
}

const formatBadgeNum = (n: number) =>
  n >= 1000 ? new Intl.NumberFormat('vi-VN').format(n) : String(n);

const NavItem = ({ icon: Icon, label, active, onClick, badge, badgeColor }: NavItemProps) => (
  <button
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }} />
    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="badge" style={{
        background: badgeColor || '#22c55e',
        color: 'white',
        fontSize: '12px',
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: '20px',
        minWidth: '18px',
        textAlign: 'center',
        lineHeight: '16px',
        flexShrink: 0
      }}>{formatBadgeNum(badge)}</span>
    )}
  </button>
);

const formatInputNumber = (val: string) => {
  const clean = val.replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('vi-VN').format(parseInt(clean));
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOfflineMode, setOfflineMode] = useState<boolean>(localStorage.getItem('offline_mode') === 'true');
  const [isGuestMode, setGuestMode] = useState<boolean>(localStorage.getItem('guest_mode') === 'true');

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [docNotification, setDocNotification] = useState<{ title: string, message: string, id: string } | null>(null);

  // Global TTS Notification cho công văn phường (Chị Google)
  useEffect(() => {
    let lastSpokenId = localStorage.getItem('last_spoken_doc_id') || '';
    // Prevent GC of utterance for Chrome
    (window as any)._globalUtterances = (window as any)._globalUtterances || [];

    const checkGlobalUnreadAndSpeak = () => {
      // Chỉ đọc nếu không phải màn hình của phường
      if (localStorage.getItem('is_phuong_mode') === 'true') return;

      const stored = localStorage.getItem('ward_documents');
      if (!stored) return;
      const docs = JSON.parse(stored);
      
      const unread = docs.find((d: any) => !d.is_read);
      if (unread && unread.id !== lastSpokenId) {
        let prefix = '';
        if (unread.category === 'party') prefix = 'Bạn có công văn, nghị quyết mới từ Chi bộ Phường.';
        else if (unread.category === 'front') prefix = 'Bạn có công văn từ Ban công tác Mặt trận Phường.';
        else prefix = 'Bạn có công văn mới từ Ủy ban nhân dân Phường.';

        const textToSpeak = `${prefix} Nội dung là: ${unread.title}. Vui lòng mở phần mềm để xem chi tiết.`;
        
        // Hiện popup trực quan
        setDocNotification({
          title: 'Tin nhắn tự động',
          message: textToSpeak,
          id: unread.id
        });

        const msg = new SpeechSynthesisUtterance(textToSpeak);
        msg.lang = 'vi-VN';
        msg.volume = 1;
        msg.rate = 1;
        
        const voices = window.speechSynthesis.getVoices();
        const viVoices = voices.filter(v => v.lang.includes('vi'));
        const googleVoice = viVoices.find(v => v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('online'));
        if (googleVoice) {
          msg.voice = googleVoice;
        } else if (viVoices.length > 0) {
          msg.voice = viVoices[0];
        }

        // Fix GC bug
        (window as any)._globalUtterances.push(msg);

        msg.onend = () => {
          (window as any)._globalUtterances = (window as any)._globalUtterances.filter((u: any) => u !== msg);
        };
        msg.onerror = (e) => {
          console.warn('TTS Error or Blocked by Browser:', e);
          (window as any)._globalUtterances = (window as any)._globalUtterances.filter((u: any) => u !== msg);
        };

        window.speechSynthesis.speak(msg);
        
        lastSpokenId = unread.id;
        localStorage.setItem('last_spoken_doc_id', unread.id);
        
        // Tự động ẩn popup sau 15 giây
        setTimeout(() => setDocNotification(null), 15000);
      }
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = checkGlobalUnreadAndSpeak;
    }

    // Kiểm tra liên tục mỗi 8 giây
    const ttsInterval = setInterval(checkGlobalUnreadAndSpeak, 8000);
    return () => clearInterval(ttsInterval);
  }, []);

  const formatVietnameseDateTime = (date: Date) => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[date.getDay()];
    const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    return { dayName, dateStr, timeStr };
  };

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
      try {
        const reply = await askGemini(text);
        setMiniChatMessages(prev => [...prev, { role: 'ai', content: reply }]);
      } catch (err) {
        console.error('[Gemini Error]', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setMiniChatMessages(prev => [...prev, { role: 'ai', content: `⚠️ Lỗi: ${errMsg.slice(0, 200)}` }]);
      }
      setMiniChatLoading(false);
      setTimeout(() => {
        const el = document.getElementById('ai-chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }, 50);
  };


  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('Bảng điều khiển');
  const [userRole, setUserRole] = useState<string>(localStorage.getItem('current_role') || 'demo');
  const [tdpList, setTdpList] = useState<any[]>([]);
  const [selectedTdpUserId, setSelectedTdpUserId] = useState<string>(localStorage.getItem('selected_tdp_user_id') || 'all');

  useEffect(() => {
    const userRoleVal = localStorage.getItem('user_role');
    const wardId = localStorage.getItem('user_ward_id');
    if ((userRoleVal === 'ward_admin' || userRoleVal === 'super_admin' || (userRoleVal === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) && wardId) {
      db.getTDPList(wardId).then(list => {
        setTdpList(list);
      });
    }
  }, [session, userRole]);

  useEffect(() => {
    if (userRole === 'an_ninh') {
      setActiveTab('security');
    }
  }, [userRole]);

  const handleTdpSelect = (userId: string) => {
    setSelectedTdpUserId(userId);
    if (userId === 'all') {
      localStorage.removeItem('selected_tdp_user_id');
    } else {
      localStorage.setItem('selected_tdp_user_id', userId);
    }
    loadSystemConfig();
    window.dispatchEvent(new CustomEvent('db-changed'));
  };

  useEffect(() => {
    // Check if the current role is verified on this device
    const initRole = localStorage.getItem('current_role') || 'demo';
    const isVerified = localStorage.getItem(`role_verified_${initRole}`) === 'true';
    
    // demo and mat_tran don't need PIN verification
    if (!isVerified && initRole !== 'mat_tran' && initRole !== 'demo') {
      // If it is a privileged role but not verified, fall back to 'demo' (read-only, safe)
      localStorage.setItem('current_role', 'demo');
      setUserRole('demo');
      // Sync child pages immediately after mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('role-changed', { detail: 'demo' }));
      }, 0);
    }

    const syncRolePins = async () => {
      try {
        const pAdmin = await (db as any).getRolePin('admin');
        const pToTruong = await (db as any).getRolePin('to_truong');
        const pBiThu = await (db as any).getRolePin('bi_thu');
        const pMatTran = await (db as any).getRolePin('mat_tran');
        const pChung = await (db as any).getRolePin('chung');
        const pPhuNu = await (db as any).getRolePin('chi_hoi_phu_nu');
        const pKeToan = await (db as any).getRolePin('ke_toan');
        const pAnNinh = await (db as any).getRolePin('an_ninh');
        localStorage.setItem('role_pin_admin', pAdmin);
        localStorage.setItem('role_pin_to_truong', pToTruong);
        localStorage.setItem('role_pin_bi_thu', pBiThu);
        localStorage.setItem('role_pin_mat_tran', pMatTran);
        localStorage.setItem('role_pin_chung', pChung);
        localStorage.setItem('role_pin_chi_hoi_phu_nu', pPhuNu);
        localStorage.setItem('role_pin_ke_toan', pKeToan);
        localStorage.setItem('role_pin_an_ninh', pAnNinh);
      } catch (e) {
        console.error('Failed to sync role PINs on mount', e);
      }
    };
    syncRolePins();
  }, []);

  const [pinPrompt, setPinPrompt] = useState<{ role: string; label: string } | null>(null);

  const handleRoleChange = (role: string) => {
    const roleLabels: Record<string, string> = {
      demo: 'Trang chủ',
      admin: 'Quản trị hệ thống',
      to_truong: 'Tổ trưởng dân phố',
      bi_thu: 'Bí thư Chi bộ',
      mat_tran: 'Trưởng ban Mặt trận',
      chi_hoi_phu_nu: 'Chi hội Phụ nữ',
      ke_toan: 'Kế toán',
      chung: 'Cán bộ Chung',
      an_ninh: 'Dân quân / An ninh'
    };

    // Demo mode does not require PIN
    if (role === 'demo') {
      executeRoleChange(role);
      return;
    }

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
      demo: ' Trang chủ',
      admin: 'Quản trị hệ thống',
      to_truong: 'Tổ trưởng dân phố',
      bi_thu: 'Bí thư Chi bộ',
      mat_tran: 'Trưởng ban Mặt trận',
      chi_hoi_phu_nu: 'Chi hội Phụ nữ',
      ke_toan: 'Kế toán',
      chung: 'Cán bộ Chung',
      an_ninh: 'Dân quân / An ninh'
    };
    
    localStorage.setItem('current_role', role);
    setUserRole(role);
    
    if (role === 'demo') {
      localStorage.setItem('guest_mode', 'true');
      setGuestMode(true);
    } else {
      localStorage.removeItem('guest_mode');
      setGuestMode(false);
    }
    
    window.dispatchEvent(new CustomEvent('role-changed', { detail: role }));
    
    // Auto redirect if active tab is restricted in new role
    if (role === 'an_ninh') {
      setActiveTab('security');
    } else if ((role === 'mat_tran' || role === 'demo' || role === 'chung' || role === 'chi_hoi_phu_nu' || role === 'ke_toan') && ['party-cell', 'meetings-party'].includes(activeTab)) {
      setActiveTab('Bảng điều khiển');
    }
    
    const toastMsg = role === 'demo'
      ? `👁️ Trang chủ – chỉ đọc, không thể chỉnh sửa dữ liệu.`
      : `✅ Đã chuyển sang vai trò: ${roleLabels[role]}`;
    const ev = new CustomEvent('show-toast', { 
      detail: { message: toastMsg, type: role === 'demo' ? 'info' : 'success' } 
    });
    window.dispatchEvent(ev);
  };

  const [toast, setToast] = useState<{message: string, type: 'success' | 'danger' | 'warning' | 'info'} | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Tên  (có thể sửa)
  const [tdpName, setTdpName] = useState(() => {
    return localStorage.getItem('tdp_name') || 'Quảng Giao';
  });
  const [wardName, setWardName] = useState(localStorage.getItem('ward_name') || 'Phường Quảng Đại');
  const [leaderName, setLeaderName] = useState(localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến');
  const [leaderPhone, setLeaderPhone] = useState(localStorage.getItem('leader_phone') || '0912 083 018 - 0899 661 982');
  const [groupId, setGroupId] = useState(localStorage.getItem('group_id') || 'NAM_SAM_SON_01');
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem('logo_url') || '');
  const [logoError, setLogoError] = useState(false);
  const [supportName, setSupportName] = useState(localStorage.getItem('support_name') || 'Lê Thị Dung');
  const [supportPhone, setSupportPhone] = useState(localStorage.getItem('support_phone') || '0912 083 018 - 0899 661 982');

  // Settings modal states
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'keys'>('general');
  const [allTdpProfiles, setAllTdpProfiles] = useState<any[]>([]);
  const [transferTargetWards, setTransferTargetWards] = useState<Record<string, string>>({});
  const [transferLoading, setTransferLoading] = useState<string | null>(null);
  const [newKeyRole, setNewKeyRole] = useState<'tdp_leader' | 'ward_admin'>('tdp_leader');
  const [newKeyTdpName, setNewKeyTdpName] = useState('');
  const [generatedKeysList, setGeneratedKeysList] = useState<any[]>([]);
  const [generatedKeyResult, setGeneratedKeyResult] = useState('');
  const [wardsList, setWardsList] = useState<any[]>([]);
  const [selectedKeyWardId, setSelectedKeyWardId] = useState('');
  const [newWardNameInput, setNewWardNameInput] = useState('');
  const [showNewWardInput, setShowNewWardInput] = useState(false);

  const loadGeneratedKeys = async () => {
    if (!supabase) return;
    try {
      const role = localStorage.getItem('user_role');
      const wardId = localStorage.getItem('user_ward_id');
      let query = supabase.from('registration_keys').select('*, wards(name)');
      
      const isSuper = role === 'super_admin' || (role === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến');
      if (!isSuper && wardId) {
        query = query.eq('ward_id', wardId);
      }
      
      const { data } = await query.order('created_at', { ascending: false });
      if (data) {
        setGeneratedKeysList(data);
      }
    } catch (e) {
      console.error('Failed to load generated keys:', e);
    }
  };

  const loadWardsList = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('wards').select('*').order('name');
      if (data) {
        setWardsList(data);
        if (data.length > 0 && !selectedKeyWardId) {
          setSelectedKeyWardId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load wards list:', e);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (isSettingsOpen && (role === 'ward_admin' || role === 'super_admin')) {
      loadGeneratedKeys();
      loadWardsList();
      setGeneratedKeyResult('');
      setShowNewWardInput(false);
      setNewWardNameInput('');
    }
  }, [isSettingsOpen]);

  const handleGenerateKey = async () => {
    if (!supabase) return;
    let targetWardId = '';
    const role = localStorage.getItem('user_role');
    const isSuperAdmin = role === 'super_admin' || (role === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến');
    const finalRole = isSuperAdmin ? newKeyRole : 'tdp_leader';
    
    if (isSuperAdmin) {
      if (showNewWardInput && newWardNameInput.trim()) {
        try {
          const { data: newWard, error } = await supabase
            .from('wards')
            .insert({ name: newWardNameInput.trim() })
            .select()
            .single();
          if (error) throw error;
          if (newWard) {
            targetWardId = newWard.id;
            await loadWardsList();
            setSelectedKeyWardId(newWard.id);
            setShowNewWardInput(false);
            setNewWardNameInput('');
          }
        } catch (err: any) {
          const ev = new CustomEvent('show-toast', { 
            detail: { message: `Lỗi tạo Phường mới: ${err.message}`, type: 'danger' } 
          });
          window.dispatchEvent(ev);
          return;
        }
      } else {
        targetWardId = selectedKeyWardId;
      }
    } else {
      targetWardId = localStorage.getItem('user_ward_id') || '';
    }

    if (!targetWardId) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Vui lòng chọn hoặc nhập tên Phường!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }

    const key = await db.generateRegistrationKey(
      targetWardId, 
      finalRole, 
      finalRole === 'ward_admin' ? 'Ban quản trị Phường' : newKeyTdpName
    );
    if (key) {
      setGeneratedKeyResult(key);
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Đã sinh mã kích hoạt thành công!', type: 'success' } 
      });
      window.dispatchEvent(ev);
      loadGeneratedKeys();
      setNewKeyTdpName('');
    } else {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: 'Lỗi khi tạo mã kích hoạt.', type: 'danger' } 
      });
      window.dispatchEvent(ev);
    }
  };

  const handleTransferTDP = async (tdpUserId: string) => {
    const targetWardId = transferTargetWards[tdpUserId];
    if (!targetWardId) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vui lòng chọn Phường muốn chuyển tới!', type: 'warning' } }));
      return;
    }
    const tdp = allTdpProfiles.find(p => p.id === tdpUserId);
    if (!tdp) return;
    
    if (window.confirm(`Bạn có chắc chắn muốn chuyển Tổ dân phố "${tdp.tdp_name}" sang Phường mới? Toàn bộ dữ liệu hộ dân/nhân khẩu của tổ này sẽ được điều chuyển sang Phường mới.`)) {
      setTransferLoading(tdpUserId);
      const success = await db.transferTDP(tdpUserId, targetWardId);
      setTransferLoading(null);
      if (success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Đã điều chuyển Tổ dân phố "${tdp.tdp_name}" thành công!`, type: 'success' } }));
        // Reload list
        const profiles = await db.getAllTDPProfiles();
        setAllTdpProfiles(profiles);
        const initialTargets: Record<string, string> = {};
        profiles.forEach((p) => {
          initialTargets[p.id] = p.ward_id || '';
        });
        setTransferTargetWards(initialTargets);
        // Refresh local dashboard data
        window.dispatchEvent(new CustomEvent('db-changed'));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Gặp lỗi trong quá trình điều chuyển dữ liệu.', type: 'danger' } }));
      }
    }
  };

  const [sbUrl, setSbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [rolePinAdminInput, setRolePinAdminInput] = useState('9999');
  const [rolePinToTruongInput, setRolePinToTruongInput] = useState('0000');
  const [rolePinBiThuInput, setRolePinBiThuInput] = useState('1111');
  const [rolePinMatTranInput, setRolePinMatTranInput] = useState('2222');
  const [rolePinChungInput, setRolePinChungInput] = useState('3333');
  const [rolePinPhuNuInput, setRolePinPhuNuInput] = useState('4444');
  const [rolePinKeToanInput, setRolePinKeToanInput] = useState('5555');
  const [rolePinAnNinhInput, setRolePinAnNinhInput] = useState('6666');
  const [sbKey, setSbKey] = useState(localStorage.getItem('supabase_anon_key') || '');
  const [tdpNameInput, setTdpNameInput] = useState(tdpName);
  const [wardNameInput, setWardNameInput] = useState(wardName);
  const [leaderNameInput, setLeaderNameInput] = useState(leaderName);
  const [leaderPhoneInput, setLeaderPhoneInput] = useState(leaderPhone);
  const [groupIdInput, setGroupIdInput] = useState(groupId);
  const [logoUrlInput, setLogoUrlInput] = useState(logoUrl);
  const [supportNameInput, setSupportNameInput] = useState(supportName);
  const [supportPhoneInput, setSupportPhoneInput] = useState(supportPhone);
  const [groupsConfig, setGroupsConfig] = useState<string[]>(() => {
    const saved = localStorage.getItem('tdp_groups_config');
    return saved ? JSON.parse(saved) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9'];
  });

  // State cho chữ ký cán bộ
  const DEFAULT_OFFICIALS = [
    { id: 'bi_thu',   title: 'Bí thư Chi bộ',       name: '', signatureUrl: '' },
    { id: 'to_truong', title: 'Tổ trưởng dân phố', name: '', signatureUrl: '' },
    { id: 'to_pho',   title: 'Tổ phó dân phố',   name: '', signatureUrl: '' },
    { id: 'mat_tran', title: 'Trưởng ban Mặt trận', name: '', signatureUrl: '' },
    { id: 'ke_toan',  title: 'Kế toán trưởng',       name: '', signatureUrl: '' },
    { id: 'thu_quy',  title: 'Thủ quỹ',               name: '', signatureUrl: '' },
    { id: 'thu_ky',   title: 'Thư ký',               name: '', signatureUrl: '' },
    { id: 'women',    title: 'Chi hội trưởng Phụ nữ', name: '', signatureUrl: '' },
    { id: 'veterans', title: 'Chi hội trưởng Cựu chiến binh', name: '', signatureUrl: '' },
    { id: 'seniors',  title: 'Chi hội trưởng Người cao tuổi', name: '', signatureUrl: '' },
    { id: 'youth',    title: 'Bí thư Chi đoàn',       name: '', signatureUrl: '' },
  ];
  const [officialSignatures, setOfficialSignatures] = useState<{ id: string; title: string; name: string; signatureUrl: string }[]>(() => {
    const saved = localStorage.getItem('official_signatures');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all entries exist
        return DEFAULT_OFFICIALS.map(def => {
          const found = parsed.find((p: any) => p.id === def.id);
          return found ? { ...def, ...found } : def;
        });
      } catch { return DEFAULT_OFFICIALS; }
    }
    return DEFAULT_OFFICIALS;
  });

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // Activation Key States
  const [showKeyActivation, setShowKeyActivation] = useState(false);
  const [activationKey, setActivationKey] = useState('');
  const [activationName, setActivationName] = useState('');
  const [activationTdpName, setActivationTdpName] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);


  // Targets states for TDP Funds (Dynamic)
  const [fundsConfig, setFundsConfig] = useState<{ name: string; target: string }[]>([]);
  const [wardFundsConfig, setWardFundsConfig] = useState<{ name: string; target: string }[]>([]);
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
  const [householdCount, setHouseholdCount] = useState(0);
  const [residentCount, setResidentCount] = useState(0);
  const [temporaryResidentCount, setTemporaryResidentCount] = useState(0);
  const [partyMemberCount, setPartyMemberCount] = useState(0);

  // Search states
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setSearchFocused] = useState(false);

  // Cập nhật tiêu đề trình duyệt theo tên TDP
  useEffect(() => {
    document.title = `QL TDP – ${tdpName}`;
  }, [tdpName]);

  const resetToDefaultConfig = () => {
    const defaults: Record<string, string> = {
      tdp_name: 'Quảng Giao',
      ward_name: 'Phường Nam Sầm Sơn',
      leader_name: 'Nguyễn Kim Tuyến',
      leader_phone: '0912 083 018 - 0899 661 982',
      group_id: 'NAM_SAM_SON_01',
      logo_url: '',
      support_name: 'Lê Thị Dung',
      support_phone: '0912 083 018 - 0899 661 982',
      welcome_setup_completed: 'false'
    };
    
    Object.keys(defaults).forEach(key => {
      localStorage.setItem(key, defaults[key]);
    });
    
    // Clear role verification keys
    ['admin', 'to_truong', 'bi_thu', 'mat_tran', 'chung'].forEach(role => {
      localStorage.removeItem(`role_verified_${role}`);
      localStorage.removeItem(`role_pin_${role}`);
    });
    localStorage.setItem('current_role', 'demo');
    
    // Update states
    setTdpName(defaults.tdp_name);
    setWardName(defaults.ward_name);
    setLeaderName(defaults.leader_name);
    setLeaderPhone(defaults.leader_phone);
    setGroupId(defaults.group_id);
    setLogoUrl(defaults.logo_url);
    setSupportName(defaults.support_name);
    setSupportPhone(defaults.support_phone);
    setUserRole('demo');
    
    // Sync inputs in Settings modal
    setTdpNameInput(defaults.tdp_name);
    setWardNameInput(defaults.ward_name);
    setLeaderNameInput(defaults.leader_name);
    setLeaderPhoneInput(defaults.leader_phone);
    setGroupIdInput(defaults.group_id);
    setLogoUrlInput(defaults.logo_url);
    setSupportNameInput(defaults.support_name);
    setSupportPhoneInput(defaults.support_phone);
  };

  const loadSystemConfig = async () => {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUid = session?.user?.id;
      // Dùng tham số ?t= trên URL hoặc guest_tenant_id làm targetUid nếu là khách vãng lai
      const urlParams = new URLSearchParams(window.location.search);
      const urlTenant = urlParams.get('t');
      const guestUid = urlTenant || localStorage.getItem('guest_tenant_id');
      
      const selectedTdpId = localStorage.getItem('selected_tdp_user_id');
      const targetUid = (selectedTdpId && selectedTdpId !== 'all') 
        ? selectedTdpId 
        : (adminUid || guestUid);
      
      let query = supabase.from('app_config').select('key, value');
      if (targetUid) {
        query = query.eq('user_id', targetUid);
      }
      
      const { data, error } = await query;
        
      if (!error && data && data.length > 0) {
        data.forEach(item => {
          localStorage.setItem(item.key, item.value);
        });
        
        // Nếu đã có cấu hình trong CSDL, đánh dấu đã thiết lập
        localStorage.setItem('welcome_setup_completed', 'true');
        
        // Update states from synchronized local storage values
        const newTdp = localStorage.getItem('tdp_name') || 'Quảng Giao';
        const newWard = localStorage.getItem('ward_name') || 'Phường Quảng Đại';
        const newLeader = localStorage.getItem('leader_name') || 'Nguyễn Kim Tuyến';
        const newPhone = localStorage.getItem('leader_phone') || '0912 083 018 - 0899 661 982';
        const newGroup = localStorage.getItem('group_id') || 'NAM_SAM_SON_01';
        const newLogoUrl = localStorage.getItem('logo_url') || '';
        const newSupportName = localStorage.getItem('support_name') || 'Lê Thị Dung';
        const newSupportPhone = localStorage.getItem('support_phone') || '0912 083 018 - 0899 661 982';
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
      } else if (!error && (!data || data.length === 0)) {
        if (!adminUid) {
          resetToDefaultConfig();
        } else {
          // Keep welcome_setup_completed as 'true' so onboarding doesn't pop up
          localStorage.setItem('welcome_setup_completed', 'true');
          
          // Clear TDP configuration keys in localStorage
          localStorage.removeItem('tdp_name');
          localStorage.removeItem('leader_name');
          localStorage.removeItem('leader_phone');
          localStorage.removeItem('group_id');
          localStorage.removeItem('logo_url');
          localStorage.removeItem('support_name');
          localStorage.removeItem('support_phone');
          
          // Set UI states to blank/default
          setTdpName('Tổ dân phố mới');
          setLeaderName('Chưa thiết lập');
          setLeaderPhone('');
          setGroupId('');
          setLogoUrl('');
          setSupportName('');
          setSupportPhone('');
          
          // Sync settings form inputs
          setTdpNameInput('');
          setWardNameInput(localStorage.getItem('ward_name') || 'Phường');
          setLeaderNameInput('');
          setLeaderPhoneInput('');
          setGroupIdInput('');
          setLogoUrlInput('');
          setSupportNameInput('');
          setSupportPhoneInput('');
          
          window.dispatchEvent(new CustomEvent('tdp-name-changed'));
          window.dispatchEvent(new CustomEvent('leader-name-changed'));
          window.dispatchEvent(new CustomEvent('leader-phone-changed'));
          window.dispatchEvent(new CustomEvent('group-id-changed'));
          window.dispatchEvent(new CustomEvent('fund-targets-changed'));
        }
      }

      // Đồng bộ chỉ tiêu đóng quỹ từ cấp Phường (ward_admin) xuống các Tổ dân phố
      const myWardId = localStorage.getItem('user_ward_id');
      const currentUserRole = localStorage.getItem('user_role');
      if (myWardId && currentUserRole !== 'ward_admin') {
        try {
          const { data: wardAdmins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'ward_admin')
            .eq('ward_id', myWardId)
            .limit(1);
          if (wardAdmins && wardAdmins.length > 0) {
            const wardAdminUid = wardAdmins[0].id;
            const { data: wardConfig } = await supabase
              .from('app_config')
              .select('value')
              .eq('user_id', wardAdminUid)
              .eq('key', 'ward_fund_list')
              .maybeSingle();
            if (wardConfig && wardConfig.value) {
              localStorage.setItem('ward_fund_list', wardConfig.value);
              window.dispatchEvent(new CustomEvent('ward-fund-targets-changed'));
            }
          }
        } catch (err) {
          console.error('Lỗi tự động đồng bộ danh sách quỹ Phường:', err);
        }
      }
    } catch (e) {
      console.error('Failed to load system config from Supabase:', e);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await db.getUserProfile(userId);
      if (profile) {
        // Auto-demote Nguyễn Kim Tuyến to ward_admin to satisfy database RLS query policies, but front-end will treat as super_admin
        if (profile.full_name === 'Nguyễn Kim Tuyến' && profile.role !== 'ward_admin' && supabase) {
          try {
            const { data, error } = await supabase.from('profiles').update({ role: 'ward_admin' }).eq('id', userId).select();
            if (!error && data && data.length > 0) {
              profile.role = 'ward_admin';
              console.log('[Auth] Nguyễn Kim Tuyến database role reset to ward_admin for RLS compatibility');
            }
          } catch (e) {
            console.error('[Auth] Failed to update profile role:', e);
          }
        }

        localStorage.setItem('supabase_user_id', userId);
        localStorage.setItem('user_role', profile.role);
        localStorage.setItem('user_ward_id', profile.ward_id || '');
        localStorage.setItem('user_tdp_name', profile.tdp_name || '');
        localStorage.setItem('user_full_name', profile.full_name || '');
        
        // Reset selected TDP on user profile load/switch
        localStorage.removeItem('selected_tdp_user_id');
        setSelectedTdpUserId('all');
        
        // Auto check profile structure and clean up seed data from Supabase
        await checkAndSeedUser(userId);

        if (profile.role === 'ward_admin' || profile.role === 'super_admin') {
          localStorage.setItem('current_role', 'admin');
          setUserRole('admin');
        } else if (profile.role === 'tdp_leader') {
          localStorage.setItem('tdp_name', profile.tdp_name || 'Tổ dân phố');
        }
        setShowKeyActivation(false);
      } else {
        setShowKeyActivation(true);
      }
    } catch (e) {
      console.error('Failed to load user profile:', e);
    }
  };

  const handleVerifyActivationKey = async () => {
    if (!activationKey.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vui lòng nhập mã kích hoạt.', type: 'warning' } }));
      return;
    }
    if (!activationName.trim()) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vui lòng nhập họ và tên của bạn.', type: 'warning' } }));
      return;
    }
    setActivationLoading(true);
    if (!supabase) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Cơ sở dữ liệu chưa kết nối.', type: 'danger' } }));
      setActivationLoading(false);
      return;
    }
    try {
      const res = await db.validateRegistrationKey(activationKey.trim());
      if (!res.valid) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: res.message, type: 'danger' } }));
        setActivationLoading(false);
        return;
      }
      
      if (res.role === 'tdp_leader' && !activationTdpName.trim()) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vui lòng nhập tên Tổ dân phố của bạn.', type: 'warning' } }));
        setActivationLoading(false);
        return;
      }
      
      const userId = session?.user?.id;
      if (!userId) throw new Error('Không tìm thấy ID người dùng.');
      
      // Check if profile exists already
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .update({
            ward_id: res.ward_id,
            role: res.role,
            tdp_name: res.role === 'tdp_leader' ? activationTdpName.trim() : 'Quản trị Phường',
            full_name: activationName.trim()
          })
          .eq('id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            ward_id: res.ward_id,
            role: res.role,
            tdp_name: res.role === 'tdp_leader' ? activationTdpName.trim() : 'Quản trị Phường',
            full_name: activationName.trim()
          });
        if (error) throw error;
      }
      
      const { error: keyError } = await supabase
        .from('registration_keys')
        .update({ is_used: true, used_by: userId })
        .eq('key', activationKey.trim());
      if (keyError) throw keyError;
        
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Kích hoạt tài khoản thành công!', type: 'success' } }));
      setShowKeyActivation(false);
      await loadUserProfile(userId);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Lỗi kích hoạt: ${err.message || err}`, type: 'danger' } }));
    } finally {
      setActivationLoading(false);
    }
  };

  const handleActivationCancel = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setShowKeyActivation(false);
    setSession(null);
    localStorage.clear();
    resetToDefaultConfig();
  };

  // Cập nhật session và lắng nghe sự thay đổi Auth
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadSystemConfig();
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        localStorage.removeItem('offline_mode');
        setOfflineMode(false);
        loadSystemConfig();
        loadUserProfile(session.user.id);
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

  // Lắng nghe trạng thái đăng nhập để tự động kích hoạt bộ thiết lập Onboarding
  useEffect(() => {
    if (session && localStorage.getItem('welcome_setup_completed') !== 'true') {
      const timer = setTimeout(() => {
        // Kiểm tra lại localStorage khi hết thời gian chờ để tránh xung đột với tiến trình loadSystemConfig bất đồng bộ
        if (localStorage.getItem('welcome_setup_completed') !== 'true') {
          setShowOnboarding(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowOnboarding(false);
    }
  }, [session]);

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
      
      const [resList, hhList, pmList] = await Promise.all([
        db.getResidents(),
        db.getHouseholds(),
        partyDb.getPartyMembers()
      ]);
      setResidentCount(resList.filter((r: any) => r.status !== 'deceased').length);
      setHouseholdCount(hhList.length);
      setTemporaryResidentCount(resList.filter((r: any) => r.status === 'temporary_resident' || r.status === 'temporary_absent').length);
      setPartyMemberCount(pmList.length);
      
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
    const handleDbChanged = () => {
      loadSystemConfig();
    };
    window.dispatchEvent(new CustomEvent('storage')); // trigger update
    window.addEventListener('db-changed', handleDbChanged);
    return () => window.removeEventListener('db-changed', handleDbChanged);
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
        const [residents, households] = await Promise.all([
          db.getResidents(),
          db.getHouseholds()
        ]);

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

  const handleAddFundConfig = () => {
    setFundsConfig([...fundsConfig, { name: '', target: '0' }]);
  };

  const handleRemoveFundConfig = (index: number) => {
    setFundsConfig(fundsConfig.filter((_, i) => i !== index));
  };

  const handleFundConfigChange = (index: number, field: 'name' | 'target', value: string) => {
    const updated = [...fundsConfig];
    if (field === 'target') {
      updated[index][field] = formatInputNumber(value);
    } else {
      updated[index][field] = value;
    }
    setFundsConfig(updated);
  };

  const handleAddWardFundConfig = () => {
    setWardFundsConfig([...wardFundsConfig, { name: '', target: '0' }]);
  };

  const handleRemoveWardFundConfig = (index: number) => {
    setWardFundsConfig(wardFundsConfig.filter((_, i) => i !== index));
  };

  const handleWardFundConfigChange = (index: number, field: 'name' | 'target', value: string) => {
    const updated = [...wardFundsConfig];
    if (field === 'target') {
      updated[index][field] = formatInputNumber(value);
    } else {
      updated[index][field] = value;
    }
    setWardFundsConfig(updated);
  };

  const handleAddGroupConfig = () => {
    setGroupsConfig([...groupsConfig, '']);
  };

  const handleRemoveGroupConfig = (index: number) => {
    setGroupsConfig(groupsConfig.filter((_, i) => i !== index));
  };

  const handleGroupConfigChange = (index: number, value: string) => {
    const updated = [...groupsConfig];
    updated[index] = value;
    setGroupsConfig(updated);
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
    const currentFunds = db.getFundList();
    setFundsConfig(currentFunds.map(f => ({
      name: f.name,
      target: formatInputNumber(f.target.toString())
    })));
    const currentWardFunds = (db as any).getWardFundList();
    setWardFundsConfig(currentWardFunds.map((f: any) => ({
      name: f.name,
      target: formatInputNumber(f.target.toString())
    })));
    setSbUrl(localStorage.getItem('supabase_url') || '');
    setSbKey(localStorage.getItem('supabase_anon_key') || '');
    setGuestPinInput(localStorage.getItem('guest_access_pin') || '1234');
    setRolePinAdminInput(localStorage.getItem('role_pin_admin') || '9999');
    setRolePinToTruongInput(localStorage.getItem('role_pin_to_truong') || '0000');
    setRolePinBiThuInput(localStorage.getItem('role_pin_bi_thu') || '1111');
    setRolePinMatTranInput(localStorage.getItem('role_pin_mat_tran') || '2222');
    setRolePinChungInput(localStorage.getItem('role_pin_chung') || '3333');
    setRolePinPhuNuInput(localStorage.getItem('role_pin_chi_hoi_phu_nu') || '4444');
    setRolePinKeToanInput(localStorage.getItem('role_pin_ke_toan') || '5555');
    setRolePinAnNinhInput(localStorage.getItem('role_pin_an_ninh') || '6666');
    setLatestAppVersionInput(localStorage.getItem('latest_app_version') || APP_VERSION);
    
    // Load groups configuration
    const savedGroups = localStorage.getItem('tdp_groups_config');
    setGroupsConfig(savedGroups ? JSON.parse(savedGroups) : ['Tổ Việt Trung', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8', 'Tổ 9']);

    // Load official signatures
    const savedSigs = localStorage.getItem('official_signatures');
    if (savedSigs) {
      try {
        const parsed = JSON.parse(savedSigs);
        setOfficialSignatures(prev => prev.map(def => {
          const found = parsed.find((p: any) => p.id === def.id);
          return found ? { ...def, ...found } : def;
        }));
      } catch {}
    }

    const isSuper = localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến');
    if (isSuper) {
      db.getAllTDPProfiles().then((profiles) => {
        setAllTdpProfiles(profiles);
        const initialTargets: Record<string, string> = {};
        profiles.forEach((p) => {
          initialTargets[p.id] = p.ward_id || '';
        });
        setTransferTargetWards(initialTargets);
      });
      loadWardsList();
    }

    setSettingsOpen(true);
  };

  // Handler upload chữ ký cho từng chức danh
  const handleSignatureUpload = (id: string, file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Chữ ký tối đa 2MB!', type: 'warning' } }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setOfficialSignatures(prev => prev.map(o => o.id === id ? { ...o, signatureUrl: url } : o));
    };
    reader.readAsDataURL(file);
  };

  // Handler cập nhật tên cán bộ
  const handleOfficialNameChange = (id: string, name: string) => {
    setOfficialSignatures(prev => prev.map(o => o.id === id ? { ...o, name } : o));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lưu tên TDP
    const newName = tdpNameInput.trim() || 'Tiến Quảng Giao';
    localStorage.setItem('tdp_name', newName);
    setTdpName(newName);
    // Thông báo cho các trang khác (Bảng điều khiển...) cập nhật tên ngay lập tức
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

    // Kiểm tra tính hợp lệ của các loại quỹ
    const hasEmptyName = fundsConfig.some(f => !f.name.trim());
    if (hasEmptyName) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: `Tên các loại quỹ không được bỏ trống!`, type: 'warning' } 
      }));
      return;
    }
    const mappedFunds = fundsConfig.map(f => ({
      name: f.name.trim(),
      target: parseInt(f.target.replace(/\./g, '')) || 0
    }));
    await db.saveFundList(mappedFunds);
    window.dispatchEvent(new CustomEvent('fund-targets-changed'));

    // Kiểm tra tính hợp lệ của các loại quỹ nộp Phường (Chỉ Phường mới được thay đổi)
    const isWardOrSuperAdmin = localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin';
    let mappedWardFunds: { name: string; target: number }[] = [];
    if (isWardOrSuperAdmin) {
      const hasEmptyWardFundName = wardFundsConfig.some(f => !f.name.trim());
      if (hasEmptyWardFundName) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `Tên các loại quỹ nộp Phường không được bỏ trống!`, type: 'warning' } 
        }));
        return;
      }
      mappedWardFunds = wardFundsConfig.map(f => ({
        name: f.name.trim(),
        target: parseInt(f.target.replace(/\./g, '')) || 0
      }));
      await (db as any).saveWardFundList(mappedWardFunds);
      window.dispatchEvent(new CustomEvent('ward-fund-targets-changed'));
    }

    // Save groups configuration
    const cleanedGroups = groupsConfig.map(g => g.trim()).filter(Boolean);
    if (cleanedGroups.length === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: `Danh sách Cụm/Tổ không được bỏ trống!`, type: 'warning' } 
      }));
      return;
    }
    localStorage.setItem('tdp_groups_config', JSON.stringify(cleanedGroups));
    window.dispatchEvent(new CustomEvent('tdp-groups-changed'));

    // Lưu chữ ký & tên cán bộ
    localStorage.setItem('official_signatures', JSON.stringify(officialSignatures));
    window.dispatchEvent(new CustomEvent('official-signatures-changed'));
    
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
    const pinChungToSave = rolePinChungInput.trim() || '3333';
    const pinPhuNuToSave = rolePinPhuNuInput.trim() || '4444';
    const pinKeToanToSave = rolePinKeToanInput.trim() || '5555';
    const pinAnNinhToSave = rolePinAnNinhInput.trim() || '6666';
    try {
      await db.saveGuestPin(pinToSave);
      await (db as any).saveRolePin('admin', pinAdminToSave);
      await (db as any).saveRolePin('to_truong', pinToTruongToSave);
      await (db as any).saveRolePin('bi_thu', pinBiThuToSave);
      await (db as any).saveRolePin('mat_tran', pinMatTranToSave);
      await (db as any).saveRolePin('chung', pinChungToSave);
      await (db as any).saveRolePin('chi_hoi_phu_nu', pinPhuNuToSave);
      await (db as any).saveRolePin('ke_toan', pinKeToanToSave);
      await (db as any).saveRolePin('an_ninh', pinAnNinhToSave);

      // Mark as verified on this device since we configured it
      localStorage.setItem('role_verified_admin', 'true');
      localStorage.setItem('role_verified_to_truong', 'true');
      localStorage.setItem('role_verified_bi_thu', 'true');
      localStorage.setItem('role_verified_mat_tran', 'true');
      localStorage.setItem('role_verified_chung', 'true');
      localStorage.setItem('role_verified_chi_hoi_phu_nu', 'true');
      localStorage.setItem('role_verified_ke_toan', 'true');
      localStorage.setItem('role_verified_an_ninh', 'true');

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
          const configItems: { user_id: string; key: string; value: string }[] = [
            { user_id: uId, key: 'tdp_name', value: newName },
            { user_id: uId, key: 'ward_name', value: newWardName },
            { user_id: uId, key: 'leader_name', value: newLeaderName },
            { user_id: uId, key: 'leader_phone', value: newLeaderPhone },
            { user_id: uId, key: 'group_id', value: newGroupId },
            { user_id: uId, key: 'support_name', value: newSupportName },
            { user_id: uId, key: 'support_phone', value: newSupportPhone },
            { user_id: uId, key: 'logo_url', value: newLogo },
            { user_id: uId, key: 'fund_list', value: JSON.stringify(mappedFunds) },
            { user_id: uId, key: 'latest_app_version', value: newVersion }
          ];
          if (isWardOrSuperAdmin) {
            configItems.push({ user_id: uId, key: 'ward_fund_list', value: JSON.stringify(mappedWardFunds) });
          }
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

  const handleOnboardingComplete = async (tdpNameVal: string, adminPinVal: string) => {
    try {
      // 1. Lưu tên TDP
      localStorage.setItem('tdp_name', tdpNameVal);
      setTdpName(tdpNameVal);
      setTdpNameInput(tdpNameVal);
      
      if (supabase && session) {
        const uId = session.user.id;
        const configItems = [
          { user_id: uId, key: 'tdp_name', value: tdpNameVal },
          { user_id: uId, key: 'welcome_setup_completed', value: 'true' }
        ];
        await supabase.from('app_config').upsert(configItems);
      }
      
      // 2. Lưu mã PIN Quản trị mới
      localStorage.setItem('role_pin_admin', adminPinVal);
      setRolePinAdminInput(adminPinVal);
      if (supabase && session) {
        await (db as any).saveRolePin('admin', adminPinVal);
      }

      // 3. Tự động chuyển vai trò sang admin (được xác thực trực tiếp trên thiết bị này)
      localStorage.setItem('current_role', 'admin');
      localStorage.setItem('role_verified_admin', 'true');
      setUserRole('admin');
      
      // Phát tín hiệu sự kiện cập nhật trên toàn hệ thống
      window.dispatchEvent(new CustomEvent('tdp-name-changed'));
      window.dispatchEvent(new CustomEvent('role-changed', { detail: 'admin' }));

      // 4. Đánh dấu đã hoàn thành onboarding
      localStorage.setItem('welcome_setup_completed', 'true');
      setShowOnboarding(false);
      
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `🎉 Chào mừng! Thiết lập  ${tdpNameVal} và mật khẩu Quản trị thành công!`, type: 'success' } 
      });
      window.dispatchEvent(ev);
    } catch (e: any) {
      console.error(e);
      const ev = new CustomEvent('show-toast', { 
        detail: { message: `❌ Lỗi thiết lập: ${e.message || e}`, type: 'danger' } 
      });
      window.dispatchEvent(ev);
    }
  };

  const handleOnboardingSkip = async () => {
    localStorage.setItem('welcome_setup_completed', 'true');
    setShowOnboarding(false);
    if (supabase && session) {
      try {
        const uId = session.user.id;
        await supabase.from('app_config').upsert([
          { user_id: uId, key: 'welcome_setup_completed', value: 'true' }
        ]);
      } catch (err) {
        console.error('Failed to save onboarding skip to Supabase:', err);
      }
    }
    const ev = new CustomEvent('show-toast', { 
      detail: { message: `ℹ️ Bỏ qua thiết lập. Bạn có thể thay đổi các mục này trong phần Cài đặt sau.`, type: 'info' } 
    });
    window.dispatchEvent(ev);
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
      
      resetToDefaultConfig();
      
      localStorage.removeItem('offline_mode');
      localStorage.removeItem('guest_mode');
      localStorage.removeItem('guest_tenant_id');
      localStorage.removeItem('is_public_guest');
      localStorage.removeItem('selected_tdp_user_id');
      localStorage.removeItem('supabase_user_id');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_ward_id');
      localStorage.removeItem('user_tdp_name');
      localStorage.removeItem('user_full_name');
      setOfflineMode(false);
      setGuestMode(false);
      setSelectedTdpUserId('all');
      
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
      case 'Bảng điều khiển':
        return <Dashboard />;
      case 'households':
        return <Households />;
      case 'residents':
        return <Residents viewMode="all" />;
      case 'residents-temp':
        return <Residents viewMode="temp" />;
      case 'residents-changes':
        return <Residents viewMode="changes" />;
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
      case 'ward-funds':
        return <WardFunds />;
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
      case 'ward-documents':
        return <WardDocuments />;
      case 'invitation-templates':
        return <InvitationTemplates />;
      case 'map':
        return <CitizenMap />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'regulations':
        return <Regulations />;
      case 'women-association':
        return <WomenAssociation />;
      case 'ccb-elderly':
        return <CCBElderly />;
      case 'farmers-association':
        return <FarmersAssociation />;
      case 'youth-union':
        return <YouthUnion />;
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
    { id: 'Bảng điều khiển', icon: PieChart, label: 'Bảng điều khiển', group: 'Tổng quan' },
    { id: 'households', icon: Home, label: 'Hộ gia đình', group: 'Quản lý dân cư', badge: householdCount, badgeColor: '#22c55e' },
    { id: 'residents', icon: Users, label: 'Nhân khẩu', group: 'Quản lý dân cư', badge: residentCount, badgeColor: '#22c55e' },
    { id: 'residents-temp', icon: MapPin, label: 'Tạm trú – Tạm vắng', group: 'Quản lý dân cư', badge: temporaryResidentCount, badgeColor: '#f97316' },
    { id: 'residents-changes', icon: TrendingUp, label: 'Biến động dân cư', group: 'Quản lý dân cư' },
    { id: 'policy', icon: Shield, label: 'Gia đình chính sách', group: 'Quản lý dân cư' },
    { id: 'security', icon: ShieldCheck, label: 'An ninh trật tự', group: 'Quản lý dân cư' },
    { id: 'party-cell', icon: Star, label: 'Chi bộ Đảng', group: 'Tổ chức - Đoàn thể', badge: partyMemberCount, badgeColor: '#ef4444' },
    { id: 'meetings-party', icon: Calendar, label: 'Lịch họp Chi bộ', group: 'Tổ chức - Đoàn thể' },
    { id: 'meetings-front', icon: UserPlus, label: 'Ban CT Mặt trận', group: 'Tổ chức - Đoàn thể' },
    { id: 'women-association', icon: Heart, label: 'Hội Phụ nữ', group: 'Tổ chức - Đoàn thể' },
    { id: 'ccb-elderly', icon: UserCircle, label: 'CCB – Người cao tuổi', group: 'Tổ chức - Đoàn thể' },
    { id: 'farmers-association', icon: Sprout, label: 'Hội Nông dân', group: 'Tổ chức - Đoàn thể' },
    { id: 'youth-union', icon: Zap, label: 'Đoàn Thanh niên', group: 'Tổ chức - Đoàn thể' },
    { id: 'documents', icon: FileText, label: 'Văn bản - Nghị quyết', group: 'Điều hành' },
    { id: 'ward-documents', icon: FileText, label: 'Công văn của Phường', group: 'Điều hành' },
    { id: 'invitation-templates', icon: Mail, label: 'Mẫu giấy mời', group: 'Điều hành' },
    { id: 'meetings-minutes', icon: Calendar, label: 'Họp – Biên bản', group: 'Điều hành' },
    { id: 'meetings', icon: Calendar, label: 'Lịch họp Tổ dân phố', group: 'Điều hành' },
    { id: 'regulations', icon: Check, label: 'Quy định & Nhiệm vụ', group: 'Điều hành' },
    { id: 'finance', icon: Wallet, label: 'Thu chi TDP', group: 'Tài chính' },
    { id: 'ward-funds', icon: Wallet, label: 'Quỹ nộp phường', group: 'Tài chính' },
    { id: 'complaints', icon: MessageSquare, label: 'Phản ánh kiến nghị', group: 'Tiện ích', badge: pendingCount, badgeColor: '#ef4444' },
    { id: 'ai-assistant', icon: BrainCircuit, label: 'Trợ lý AI', group: 'Tiện ích' },
    { id: 'settings', icon: Settings, label: 'Cài đặt', group: 'Tiện ích' },
  ].filter(item => {
    if (userRole === 'an_ninh') {
      return item.id === 'security';
    }
    if (isGuestMode) {
      return !['households', 'residents', 'residents-temp', 'residents-changes', 'meetings-party', 'meetings-front', 'party-cell', 'ai-assistant', 'ward-funds', 'settings'].includes(item.id);
    }
    if (item.id === 'settings') {
      return userRole === 'to_truong' || userRole === 'admin';
    }
    if (item.id === 'invitation-templates') {
      const isWardMode = (userRole === 'ward_admin' || userRole === 'super_admin') && selectedTdpUserId === 'all';
      return !isWardMode;
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
            localStorage.setItem('is_public_guest', 'true');
            setGuestMode(true);
            const ev = new CustomEvent('show-toast', { detail: { message: 'Đang đăng nhập chế độ Đọc công khai...', type: 'info' } });
            window.dispatchEvent(ev);
          }}
        />
      </>
    );
  }

  if (showKeyActivation) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {toast && (
          <div className={`toast-notification ${toast.type}`}>
            {toast.message}
          </div>
        )}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          padding: '40px',
          width: '100%',
          maxWidth: '460px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '16px', 
              backgroundColor: '#4f46e5', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)'
            }}>
              <KeyRound size={28} color="white" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', margin: '0 0 8px 0' }}>Kích hoạt Bản quyền</h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Chào mừng! Bạn đã đăng nhập lần đầu qua Google/OAuth. Vui lòng nhập mã kích hoạt được cấp từ Quản trị viên tối cao để kích hoạt tài khoản.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mã kích hoạt */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Mã kích hoạt bản quyền
              </label>
              <input
                type="text"
                placeholder="Ví dụ: REG-XXXX-XXXX-XXXX"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              />
            </div>

            {/* Họ và tên */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Họ và tên người đăng ký
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={activationName}
                onChange={(e) => setActivationName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              />
            </div>

            {/* Tên Tổ dân phố */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Tên Tổ dân phố quản lý (nếu có)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Tổ dân phố 1 (Bỏ trống nếu là Phường Admin)"
                value={activationTdpName}
                onChange={(e) => setActivationTdpName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              />
            </div>

            {/* Nút hành động */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleVerifyActivationKey}
                disabled={activationLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                {activationLoading ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản'}
              </button>

              <button
                type="button"
                onClick={handleActivationCancel}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const isWardSettings = (localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && selectedTdpUserId === 'all';

  return (
    <div className="layout-container">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
      {docNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: 'white',
          borderLeft: '5px solid #3b82f6',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '20px',
          borderRadius: '8px',
          width: '350px',
          animation: 'slideInRight 0.5s ease'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🔔</span> {docNotification.title}
          </h3>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {docNotification.message}
          </p>
          <button 
            onClick={() => {
              setDocNotification(null);
              window.speechSynthesis.cancel();
            }}
            style={{ marginTop: '15px', background: '#f1f5f9', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
          >
            Đóng & Tắt âm
          </button>
        </div>
      )}
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="logo-icon" style={{ width: '44px', height: '44px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            {logoUrl && !logoError ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
                onError={() => setLogoError(true)}
              />
            ) : (
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <rect width="30" height="30" rx="6" fill="#E3F2FD"/>
                <path d="M15 4L4 10v10l11 6 11-6V10L15 4z" fill="#1565C0" opacity="0.15"/>
                <path d="M15 4L4 10v10l11 6 11-6V10L15 4z" fill="none" stroke="#1565C0" stroke-width="1.5"/>
                <circle cx="15" cy="15" r="4" fill="#1565C0"/>
                <path d="M15 4v11M4 10l11 5M26 10l-11 5" stroke="#1565C0" stroke-width="1" opacity="0.5"/>
              </svg>
            )}
          </div>
          <div className="logo-text" style={{ color: 'white', display: 'flex', flexDirection: 'column' }}>
            <span className="app-name" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', lineHeight: 1.2 }}>QL Thôn/Tổ dân phố</span>
            <span className="app-sub" style={{ fontSize: '10.5px', opacity: 0.75, marginTop: '2px' }}>{tdpName} – {wardName}</span>
          </div>
          {window.innerWidth <= 768 && (
            <button onClick={() => setSidebarOpen(false)} className="close-sidebar" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', marginLeft: 'auto' }}>
              <X size={24} />
            </button>
          )}
        </div>
        
        {/* Glassmorphic contact card for the software developer (Technical Support) */}
        <div className="sidebar-footer" style={{ padding: '8px 8px 0px 8px', borderTop: 'none' }}>
          <div className="support-box" style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <div className="s-icon" style={{ width: '30px', height: '30px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke-width="2"/></svg>
            </div>
            <div className="s-text" style={{ color: 'white', textAlign: 'left' }}>
              <div className="s-label" style={{ fontSize: '9px', opacity: 0.7 }}>{supportName}</div>
              <div className="s-value" style={{ fontSize: '11px', fontWeight: 600, marginTop: '1px' }}>{supportPhone}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {['Tổng quan', 'Quản lý dân cư', 'Tổ chức - Đoàn thể', 'Điều hành', 'Tài chính', 'Tiện ích'].map(grpName => {
            const grpItems = menuItems.filter(item => item.group === grpName);
            if (grpItems.length === 0) return null;
            return (
              <div key={grpName} className="nav-group">
                <div className="nav-group-title">{grpName}</div>
                {grpItems.map(item => (
                  <NavItem 
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={activeTab === item.id}
                    onClick={() => {
                      if (item.id === 'settings') {
                        handleOpenSettings();
                      } else {
                        setActiveTab(item.id);
                        if (window.innerWidth <= 768) setSidebarOpen(false);
                      }
                    }}
                    badge={item.badge}
                    badgeColor={item.badgeColor}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Role Switcher */}
          {!localStorage.getItem('is_public_guest') && (
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
                <option value="demo">👁️ Trang chủ</option>
                <option value="admin">Quản trị hệ thống (Admin)</option>
                <option value="to_truong">Tổ trưởng dân phố</option>
                <option value="bi_thu">Bí thư Chi bộ</option>
                <option value="mat_tran">Trưởng ban Mặt trận</option>
                <option value="chi_hoi_phu_nu">Chi hội Phụ nữ</option>
                <option value="ke_toan">Kế toán</option>
                <option value="chung">Cán bộ Chung</option>
                <option value="an_ninh">Dân quân / An ninh</option>
              </select>
            </div>
          )}

          <div className="user-profile" style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
            {session?.user?.user_metadata?.avatar_url ? (
              <img 
                src={session.user.user_metadata.avatar_url} 
                alt="Avatar" 
                className="avatar-img" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(59, 130, 246, 0.5)', flexShrink: 0 }} 
              />
            ) : (
              <div className="avatar" style={{ flexShrink: 0 }}>
                {session?.user?.user_metadata?.full_name 
                  ? session.user.user_metadata.full_name.split(' ').pop()?.slice(0, 2).toUpperCase() 
                  : (session?.user?.email ? session.user.email.slice(0, 2).toUpperCase() : 'AD')}
              </div>
            )}
            <div className="user-info" style={{ overflow: 'hidden', flex: 1, marginLeft: '12px' }}>
              <span className="user-name" title={session?.user?.user_metadata?.full_name || session?.user?.email || 'Tổ trưởng'} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                {session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Tổ trưởng'}
              </span>
              <span className="user-role" title={session?.user?.email || 'Ngoại tuyến'} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                {isGuestMode ? 'Xem công khai' : userRole === 'demo' ? '👁️ Trang Chủ' : userRole === 'admin' ? 'Quản trị hệ thống' : userRole === 'to_truong' ? 'Tổ trưởng TDP' : userRole === 'bi_thu' ? 'Bí thư Chi bộ' : userRole === 'mat_tran' ? 'Trưởng ban Mặt trận' : userRole === 'chi_hoi_phu_nu' ? 'Chi hội Phụ nữ' : userRole === 'ke_toan' ? 'Kế toán' : userRole === 'an_ninh' ? 'Dân quân / An ninh' : 'Cán bộ Chung'}
              </span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Đăng xuất" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Banner chạy chữ */}
        <div className="marquee-header">
          <div className="marquee-text">
            Ứng dụng được thiết kế và bảo trì bởi: Nguyễn Kim Tuyến TDP Quảng Giao - SĐT: 0912083018 / 0899661982.
          </div>
        </div>
        
        <header className="main-header">
          <div className="header-left">
            {!isSidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="menu-toggle" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', marginRight: '8px' }}>
                <Menu size={24} />
              </button>
            )}
            {activeTab === 'Bảng điều khiển' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>Bảng điều khiển</h1>
                {(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && (
                  <select
                    value={selectedTdpUserId}
                    onChange={(e) => handleTdpSelect(e.target.value)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1.5px solid #bfdbfe',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      color: '#1e40af',
                      fontWeight: '600',
                      fontSize: '11.5px',
                      outline: 'none',
                      cursor: 'pointer',
                      marginLeft: '6px'
                    }}
                  >
                    <option value="all">🌐 Tất cả các Tổ (Tổng hợp Phường)</option>
                    {tdpList.map(t => (
                      <option key={t.id} value={t.id}>🏢 {t.tdp_name} ({t.full_name})</option>
                    ))}
                  </select>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#1e40af',
                  whiteSpace: 'nowrap'
                }}>
                  📞 SĐT: Bí thư: Ông Tuấn: 0944597577 - TB CTMT: Ông Quyết: 1234567890
                </div>
              </div>
            ) : (
              <div className="breadcrumb-gov" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Tổ dân phố</span>
                {(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') ? (
                  <select
                    value={selectedTdpUserId}
                    onChange={(e) => handleTdpSelect(e.target.value)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1.5px solid #bfdbfe',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      color: '#1e40af',
                      fontWeight: '600',
                      fontSize: '11.5px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">🌐 Tất cả các Tổ (Tổng hợp Phường)</option>
                    {tdpList.map(t => (
                      <option key={t.id} value={t.id}>🏢 {t.tdp_name} ({t.full_name})</option>
                    ))}
                  </select>
                ) : (
                  <span className="current" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tdpName}</span>
                )}
                <span className="sep">›</span>
                <span className="current" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{menuItems.find(i => i.id === activeTab)?.label}</span>
              </div>
            )}
          </div>

          <div className="header-right">
            {activeTab !== 'Bảng điều khiển' && (
              <>
                <div className="header-weather">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" stroke-width="2"/><line x1="12" y1="1" x2="12" y2="3" stroke-width="2"/><line x1="12" y1="21" x2="12" y2="23" stroke-width="2"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke-width="2"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke-width="2"/><line x1="1" y1="12" x2="3" y2="12" stroke-width="2"/><line x1="21" y1="12" x2="23" y2="12" stroke-width="2"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke-width="2"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke-width="2"/></svg>
                  <span>32°C – Nắng</span>
                </div>
                
                {(() => {
                  const { dayName, dateStr, timeStr } = formatVietnameseDateTime(currentDateTime);
                  return (
                    <div className="header-datetime">
                      <div className="date">{dayName}, {dateStr}</div>
                      <div className="time">{timeStr} ICT</div>
                    </div>
                  );
                })()}
              </>
            )}



            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setNotifOpen(!isNotifOpen)} title="Cảnh báo">
                <Bell size={18} />
                {notifList.length > 0 && <span className="notif-dot"></span>}
              </button>
              {isNotifOpen && (
                <div className="notif-dropdown" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: '320px',
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 1000,
                  padding: '12px'
                }}>
                  <div className="notif-dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <h4 style={{ fontSize: '12px', margin: 0 }}>Cảnh báo & Kiến nghị ({notifList.length})</h4>
                    <button onClick={() => setNotifOpen(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                  <div className="notif-dropdown-body" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {notifList.map(n => (
                      <div 
                        key={n.id} 
                        className="notif-dropdown-item" 
                        onClick={() => {
                          setActiveTab(n.type);
                          setNotifOpen(false);
                        }}
                        style={{
                          padding: '8px 0',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div className="notif-text" style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{n.text}</div>
                        <div className="notif-time" style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{n.time}</div>
                      </div>
                    ))}
                    {notifList.length === 0 && (
                      <div className="notif-empty" style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>Không có cảnh báo mới</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(userRole === 'to_truong' || userRole === 'admin') && !isGuestMode && (
              <button className="icon-btn" onClick={handleOpenSettings} title="Cấu hình hệ thống">
                <Settings size={18} />
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

              {/* Navigation Tab Bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSettingsTab('general')}
                  style={{
                    padding: '8px 16px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    border: 'none',
                    borderBottom: settingsTab === 'general' ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'none',
                    color: settingsTab === 'general' ? 'var(--primary)' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  ⚙️ Cấu hình chung
                </button>
                {(localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab('keys')}
                    style={{
                      padding: '8px 16px',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      border: 'none',
                      borderBottom: settingsTab === 'keys' ? '3px solid #db2777' : '3px solid transparent',
                      background: 'none',
                      color: settingsTab === 'keys' ? '#db2777' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    🔑 Khóa & Điều chuyển Phường
                  </button>
                )}
              </div>

              {settingsTab === 'general' && (
                <>
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
                  <label>{isWardSettings ? 'Tên Xã / Phường' : 'Tên Thôn / Tổ dân phố / Khu dân cư'}</label>
                  <input
                    type="text"
                    value={tdpNameInput}
                    onChange={(e) => setTdpNameInput(e.target.value)}
                    placeholder={isWardSettings ? 'Ví dụ: Phường Nam Sầm Sơn, Xã Quảng Giao...' : 'Ví dụ: Nam Sầm Sơn, Thôn 7...'}
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>{isWardSettings ? 'Tên Quận / Huyện / Thị xã' : 'Tên Phường / Xã'}</label>
                  <input
                    type="text"
                    value={wardNameInput}
                    onChange={(e) => setWardNameInput(e.target.value)}
                    placeholder={isWardSettings ? 'Ví dụ: Thành phố Sầm Sơn, Huyện Quảng Xương...' : 'Ví dụ: Phường Nam Sầm Sơn...'}
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>{isWardSettings ? 'Họ và tên Lãnh đạo / Cán bộ phụ trách' : 'Họ và tên Tổ trưởng'}</label>
                  <input
                    type="text"
                    value={leaderNameInput}
                    onChange={(e) => setLeaderNameInput(e.target.value)}
                    placeholder={isWardSettings ? 'Ví dụ: Nguyễn Văn A...' : 'Ví dụ: Nguyễn Kim Tuyến...'}
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>{isWardSettings ? 'Số điện thoại liên hệ' : 'Số điện thoại Tổ trưởng'}</label>
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

              {/* ─── Phần 1b: Chỉ tiêu thu nộp các loại quỹ (Động) ─── */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    🎯 Danh mục Quỹ & Chỉ tiêu thu nộp (VNĐ/Hộ)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFundConfig}
                    className="btn btn-success"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', height: 'fit-content' }}
                  >
                    <Plus size={14} /> Thêm Quỹ
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {fundsConfig.map((fund, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Tên quỹ (Ví dụ: Quỹ Khuyến học)"
                        value={fund.name}
                        onChange={(e) => handleFundConfigChange(idx, 'name', e.target.value)}
                        style={{ flex: 3, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Chỉ tiêu (VND/Hộ)"
                        value={fund.target}
                        onChange={(e) => handleFundConfigChange(idx, 'target', e.target.value)}
                        style={{ flex: 1.5, minWidth: '110px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'right', fontSize: '0.9rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFundConfig(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Xóa loại quỹ này"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {fundsConfig.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      Chưa cấu hình loại quỹ nào. Hãy bấm "Thêm Quỹ" để tạo mới.
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Phần 1ba: Chỉ tiêu thu nộp các loại quỹ Ủy thác từ Phường (Động) ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02))',
                border: '1.5px solid rgba(59,130,246,0.18)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    🎯 Danh mục Quỹ nộp Phường giao & Chỉ tiêu (VNĐ/Người)
                  </div>
                  {(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && (
                    <button
                      type="button"
                      onClick={handleAddWardFundConfig}
                      className="btn btn-primary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', height: 'fit-content', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                    >
                      <Plus size={14} /> Thêm Quỹ nộp Phường
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {wardFundsConfig.map((fund, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Tên quỹ nộp Phường (Ví dụ: Quỹ phòng chống thiên tai)"
                        value={fund.name}
                        disabled={!(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin')}
                        onChange={(e) => handleWardFundConfigChange(idx, 'name', e.target.value)}
                        style={{ flex: 3, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', backgroundColor: !(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') ? '#f1f5f9' : undefined }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Chỉ tiêu (VND/Người)"
                        value={fund.target}
                        disabled={!(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin')}
                        onChange={(e) => handleWardFundConfigChange(idx, 'target', e.target.value)}
                        style={{ flex: 1.5, minWidth: '110px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'right', fontSize: '0.9rem', backgroundColor: !(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') ? '#f1f5f9' : undefined }}
                        required
                      />
                      {(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWardFundConfig(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          title="Xóa loại quỹ này"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {wardFundsConfig.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      Chưa cấu hình loại quỹ nộp Phường nào.
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Phần 1bb: Danh sách Cụm/Tổ tự quản (Động) ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02))',
                border: '1.5px solid rgba(59,130,246,0.18)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    🏬 Danh sách Cụm / Tổ tự quản
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGroupConfig}
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', height: 'fit-content' }}
                  >
                    <Plus size={14} /> Thêm Cụm/Tổ
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {groupsConfig.map((group, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Tên Cụm/Tổ (Ví dụ: Tổ 4, Tổ Việt Trung)"
                        value={group}
                        onChange={(e) => handleGroupConfigChange(idx, e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveGroupConfig(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Xóa Tổ này"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {groupsConfig.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      Chưa cấu hình Cụm/Tổ nào. Hãy bấm "Thêm Cụm/Tổ" để tạo mới.
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Phần 1bc: Chữ ký & Thông tin cán bộ ký văn bản ─── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))',
                border: '1.5px solid rgba(139,92,246,0.22)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>
                  ✍️ Chữ ký & Họ tên cán bộ ký văn bản
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', lineHeight: '1.5' }}>
                  Nhập họ tên và tải chữ ký của từng chức danh. Khi in văn bản, hệ thống sẽ tự động điền tên và chữ ký tương ứng.
                </div>

                {/* Bảng chữ ký */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {officialSignatures.map((official) => (
                    <div key={official.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 1fr auto',
                      gap: '10px',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      border: '1px solid rgba(139,92,246,0.12)'
                    }}>
                      {/* Chức danh */}
                      <div style={{
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        color: '#4c1d95',
                        lineHeight: '1.3'
                      }}>
                        {official.title}
                      </div>

                      {/* Họ tên */}
                      <input
                        type="text"
                        placeholder={`Họ và tên ${official.title}...`}
                        value={official.name}
                        onChange={(e) => handleOfficialNameChange(official.id, e.target.value)}
                        maxLength={60}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '7px',
                          border: '1px solid rgba(139,92,246,0.25)',
                          fontSize: '0.88rem',
                          background: 'white',
                          outline: 'none',
                          width: '100%'
                        }}
                      />

                      {/* Chữ ký upload & preview */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {official.signatureUrl ? (
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <img
                              src={official.signatureUrl}
                              alt={`Chữ ký ${official.title}`}
                              style={{
                                height: '44px',
                                maxWidth: '100px',
                                objectFit: 'contain',
                                border: '1px solid rgba(139,92,246,0.2)',
                                borderRadius: '6px',
                                background: 'white',
                                padding: '2px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setOfficialSignatures(prev => prev.map(o => o.id === official.id ? { ...o, signatureUrl: '' } : o))}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#ef4444',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                lineHeight: 1
                              }}
                              title="Xóa chữ ký"
                            >✕</button>
                          </div>
                        ) : (
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: 'rgba(139,92,246,0.08)',
                            border: '1.5px dashed rgba(139,92,246,0.35)',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            color: '#7c3aed',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                          }}>
                            <Upload size={13} />
                            Tải chữ ký
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSignatureUpload(official.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  * Tải ảnh chữ ký nền trong suốt (PNG) để hiển thị đẹp hơn. Tối đa 2MB mỗi ảnh.
                </div>
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

                  {/* ─── Phần 1c: Bảo mật truy cập công cộng ─── */}
                  {userRole === 'admin' && !(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && (
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
                        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '4px' }}>
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
                          <div className="form-group">
                            <label>PIN Chung</label>
                            <input
                              type="text"
                              value={rolePinChungInput}
                              onChange={(e) => setRolePinChungInput(e.target.value)}
                              placeholder="Mặc định: 3333"
                              maxLength={10}
                            />
                          </div>
                          <div className="form-group">
                            <label>PIN Phụ nữ</label>
                            <input
                              type="text"
                              value={rolePinPhuNuInput}
                              onChange={(e) => setRolePinPhuNuInput(e.target.value)}
                              placeholder="Mặc định: 4444"
                              maxLength={10}
                            />
                          </div>
                          <div className="form-group">
                            <label>PIN Kế toán</label>
                            <input
                              type="text"
                              value={rolePinKeToanInput}
                              onChange={(e) => setRolePinKeToanInput(e.target.value)}
                              placeholder="Mặc định: 5555"
                              maxLength={10}
                            />
                          </div>
                          <div className="form-group">
                            <label>PIN An ninh</label>
                            <input
                              type="text"
                              value={rolePinAnNinhInput}
                              onChange={(e) => setRolePinAnNinhInput(e.target.value)}
                              placeholder="Mặc định: 6666"
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
                  )}
                </>
              )}

              {settingsTab === 'keys' && (
                <>
                  {/* ─── Phần 1d: Quản lý Mã kích hoạt bản quyền (Hiển thị cho Ward Admin và Super Admin) ─── */}
              {(localStorage.getItem('user_role') === 'ward_admin' || localStorage.getItem('user_role') === 'super_admin') && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(236,72,153,0.02))',
                  border: '1.5px solid rgba(236,72,153,0.18)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '12px'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#db2777', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                    🔑 Sinh Mã kích hoạt (License Key) Hệ thống
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', borderLeft: '3px solid #db2777', paddingLeft: '8px', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
                    📌 <strong>Hướng dẫn nhanh:</strong><br />
                    • <strong>Tạo Phường mới hoàn toàn:</strong> Chọn "Chọn Phường" ở dưới → chọn <strong>"➕ Tạo Phường mới..."</strong>, gõ tên Phường mới (ví dụ: Quảng Đại), chọn chức vụ <strong>"Quản trị viên Phường"</strong> và sinh mã.<br />
                    • <strong>Thêm Tổ trưởng mới vào Phường:</strong> Chọn đúng Phường trực thuộc, chọn chức vụ <strong>"Tổ trưởng (TDP)"</strong>, gõ tên Tổ dân phố (ví dụ: Tổ 5) và sinh mã.
                  </div>

                  {(localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      flexDirection: 'column', 
                      background: 'rgba(255,255,255,0.7)', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(236,72,153,0.15)',
                      marginBottom: '4px'
                    }}>
                      <div style={{ fontWeight: '700', fontSize: '0.78rem', color: '#db2777', letterSpacing: '0.5px' }}>🏛️ CẤU HÌNH PHƯỜNG & KHÓA BẢN QUYỀN:</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.78rem', color: '#475569', minWidth: '90px', fontWeight: '600' }}>Chọn Phường:</label>
                        {!showNewWardInput ? (
                          <select
                            value={selectedKeyWardId}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setShowNewWardInput(true);
                              } else {
                                setSelectedKeyWardId(e.target.value);
                              }
                            }}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', flex: 1, background: 'white', outline: 'none' }}
                          >
                            {wardsList.map(w => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                            <option value="new">➕ Tạo Phường mới...</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                            <input
                              type="text"
                              placeholder="Nhập tên Phường mới (ví dụ: Quảng Hải)..."
                              value={newWardNameInput}
                              onChange={(e) => setNewWardNameInput(e.target.value)}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', flex: 1 }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setShowNewWardInput(false)}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', minHeight: '30px' }}
                            >
                              Hủy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {(localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) ? (
                      <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                        <label>Chức vụ cấp phép</label>
                        <select
                          value={newKeyRole}
                          onChange={(e) => setNewKeyRole(e.target.value as any)}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', width: '100%', background: 'white' }}
                        >
                          <option value="tdp_leader">🏢 Tổ trưởng (TDP)</option>
                          <option value="ward_admin">🏛️ Quản trị viên Phường (Ward Admin)</option>
                        </select>
                      </div>
                    ) : null}

                    {((localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) ? newKeyRole === 'tdp_leader' : true) ? (
                      <div className="form-group" style={{ flex: 1.5, minWidth: '200px' }}>
                        <label>Tên Tổ dân phố (Nếu cấp cho Tổ trưởng)</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Tổ dân phố Quảng Giao..."
                          value={newKeyTdpName}
                          onChange={(e) => setNewKeyTdpName(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        />
                      </div>
                    ) : (
                      <div className="form-group" style={{ flex: 1.5, minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', margin: 0, lineHeight: '1.4' }}>
                          💡 Quản trị viên Phường quản lý tất cả các Tổ dân phố thuộc Phường được chọn.
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateKey}
                      style={{
                        background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                        borderColor: '#be185d',
                        padding: '10px 16px',
                        height: '38px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Sinh mã Key
                    </button>
                  </div>

                  {generatedKeyResult && (
                    <div style={{
                      background: 'rgba(236,72,153,0.1)',
                      border: '1px dashed #ec4899',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center',
                      marginTop: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#db2777', fontWeight: 'bold' }}>MÃ KHÓA VỪA TẠO (HÃY SAO CHÉP GỬI ĐI):</div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginTop: '6px' }}>
                        <code style={{ fontSize: '1.05rem', color: '#db2777', fontFamily: 'monospace', fontWeight: 'bold' }}>{generatedKeyResult}</code>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKeyResult);
                            const ev = new CustomEvent('show-toast', { 
                              detail: { message: 'Đã sao chép mã khóa kích hoạt!', type: 'success' } 
                            });
                            window.dispatchEvent(ev);
                          }}
                          style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', minHeight: '26px' }}
                        >
                          Sao chép
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.78rem', color: '#475569', marginBottom: '6px' }}>Danh sách mã đã tạo:</div>
                    <div style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '6px 10px', color: '#475569' }}>Mã kích hoạt</th>
                            <th style={{ padding: '6px 10px', color: '#475569' }}>Phường</th>
                            <th style={{ padding: '6px 10px', color: '#475569' }}>Đối tượng</th>
                            <th style={{ padding: '6px 10px', color: '#475569' }}>Tên địa bàn</th>
                            <th style={{ padding: '6px 10px', color: '#475569' }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedKeysList.map((k) => (
                            <tr key={k.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{k.key}</td>
                              <td style={{ padding: '6px 10px' }}>{k.wards?.name || '—'}</td>
                              <td style={{ padding: '6px 10px' }}>{k.role === 'ward_admin' ? '🏛️ Phường Admin' : '🏢 Tổ trưởng'}</td>
                              <td style={{ padding: '6px 10px' }}>{k.tdp_name || '—'}</td>
                              <td style={{ padding: '6px 10px' }}>
                                {k.is_used ? (
                                  <span style={{ color: '#ef4444', fontWeight: '600' }}>🔴 Đã dùng</span>
                                ) : (
                                  <span style={{ color: '#22c55e', fontWeight: '600' }}>🟢 Chưa dùng</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {generatedKeysList.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Chưa sinh mã kích hoạt nào.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Phần 1e: Điều chuyển Tổ dân phố (Chuyển Phường) - Chỉ dành cho Super Admin ─── */}
              {(localStorage.getItem('user_role') === 'super_admin' || (localStorage.getItem('user_role') === 'ward_admin' && localStorage.getItem('user_full_name') === 'Nguyễn Kim Tuyến')) && (
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
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                    🔄 Điều chuyển Tổ dân phố (Chuyển Phường)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', borderLeft: '3px solid #10b981', paddingLeft: '8px', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
                    💡 <strong>Mô tả tính năng:</strong> Tại đây hiển thị tất cả các Tổ trưởng đã đăng ký. Bạn có thể thay đổi Phường trực thuộc cho một Tổ dân phố bất kỳ. Hệ thống sẽ tự động cập nhật toàn bộ nhân khẩu và hộ tịch của tổ đó sang Phường mới mà không mất mát hay chồng chéo dữ liệu.
                  </div>

                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 'bold' }}>Tên Tổ dân phố</th>
                          <th style={{ padding: '8px 10px', fontWeight: 'bold' }}>Tổ trưởng</th>
                          <th style={{ padding: '8px 10px', fontWeight: 'bold' }}>Phường hiện tại</th>
                          <th style={{ padding: '8px 10px', fontWeight: 'bold' }}>Chuyển sang Phường</th>
                          <th style={{ padding: '8px 10px', fontWeight: 'bold', textAlign: 'center' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTdpProfiles.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: '600' }}>{p.tdp_name}</td>
                            <td style={{ padding: '8px 10px' }}>{p.full_name}</td>
                            <td style={{ padding: '8px 10px', color: '#4f46e5', fontWeight: '600' }}>{p.wards?.name || 'Chưa rõ'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <select
                                value={transferTargetWards[p.id] || ''}
                                onChange={(e) => setTransferTargetWards(prev => ({ ...prev, [p.id]: e.target.value }))}
                                style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.75rem', background: 'white' }}
                              >
                                <option value="">-- Chọn Phường --</option>
                                {wardsList.map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleTransferTDP(p.id)}
                                disabled={transferLoading === p.id || transferTargetWards[p.id] === p.ward_id}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  height: 'auto',
                                  minHeight: '26px',
                                  background: transferTargetWards[p.id] === p.ward_id ? '#f1f5f9' : '#10b981',
                                  color: transferTargetWards[p.id] === p.ward_id ? '#94a3b8' : 'white',
                                  border: 'none',
                                  cursor: transferTargetWards[p.id] === p.ward_id ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {transferLoading === p.id ? 'Đang chuyển...' : 'Xác nhận'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {allTdpProfiles.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Chưa có Tổ dân phố nào đăng ký trên hệ thống.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
                </>
              )}

              {settingsTab === 'general' && (
                <>
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
                  <span><strong>Lưu ý Google Auth:</strong> Vui lòng cấu hình URL Redirect trong Supabase Bảng điều khiển là <code>{window.location.origin}</code> để đăng nhập Google OAuth hoạt động chính xác.</span>
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
                </>
              )}

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
                <li>Truy cập vào trang quản trị <strong><a href="https://supabase.com/Bảng điều khiển" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Supabase Bảng điều khiển</a></strong>.</li>
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
              mat_tran: '2222',
              chung: '3333',
              chi_hoi_phu_nu: '4444',
              ke_toan: '5555',
              an_ninh: '6666'
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
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* ═══ FLOATING BUTTONS: Zalo + AI Chat (always visible) ═══ */}
      <>
          {/* Floating Button Group — Zalo trên / AI dưới */}
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 1200,
            alignItems: 'center'
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


          {/* Zalo Popup — hiển thị bên trái nút Zalo */}
          {zaloOpen && (
            <div style={{
              position: 'fixed', bottom: '100px', right: '90px', zIndex: 1300,
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

          {/* AI Chat Widget — hiển thị bên trái nút Bot */}
          {aiChatOpen && (
            <div style={{
              position: 'fixed', bottom: '20px', right: '90px', zIndex: 1300,
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
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Kim Tuyến</div>
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
                    <div>Xin chào! Tôi là Trợ lý AI của: Kim Tuyến.</div>
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
    mat_tran: '2222',
    chung: '3333',
    chi_hoi_phu_nu: '4444',
    ke_toan: '5555',
    an_ninh: '6666'
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

// ═══════════════════════════════════════════════════════════
// HỢP THOẠI HƯỚNG DẪN THIẾT LẬP NHANH (Onboarding Wizard)
// ═══════════════════════════════════════════════════════════
const OnboardingModal = ({
  onComplete,
  onSkip
}: {
  onComplete: (tdpName: string, adminPin: string) => Promise<void>;
  onSkip: () => void;
}) => {
  const [step, setStep] = useState(1);
  const [tdpInput, setTdpInput] = useState('');
  const [pinInput, setPinInput] = useState('9999');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1 && !tdpInput.trim()) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: '⚠️ Vui lòng nhập tên  của bạn!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }
    if (step === 2 && (!pinInput.trim() || pinInput.length < 4)) {
      const ev = new CustomEvent('show-toast', { 
        detail: { message: '⚠️ Mã PIN quản trị phải có ít nhất 4 chữ số!', type: 'warning' } 
      });
      window.dispatchEvent(ev);
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await onComplete(tdpInput.trim(), pinInput.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '500px',
        overflow: 'hidden',
        animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Progress Bar */}
        <div style={{ display: 'flex', height: '6px', width: '100%', backgroundColor: '#f1f5f9' }}>
          <div style={{ width: `${(step / 3) * 100}%`, backgroundColor: '#10b981', transition: 'width 0.3s ease' }}></div>
        </div>

        {/* Modal content */}
        <div style={{ padding: '30px', flex: 1 }}>
          {step === 1 && (
            <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '3rem', textAlign: 'center' }}>👋</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', color: '#0f172a', margin: 0 }}>Chào mừng bạn!</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Hệ thống Quản lý Dân cư TDP đã khởi tạo không gian làm việc riêng cho bạn. Hãy đặt tên  của bạn để bắt đầu.
              </p>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                  Tên  của bạn <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Home size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Ví dụ:  7 Phường Sầm Sơn"
                    value={tdpInput}
                    onChange={(e) => setTdpInput(e.target.value)}
                    style={{ padding: '12px 12px 12px 38px', width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '3rem', textAlign: 'center' }}>🔑</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', color: '#0f172a', margin: 0 }}>Mã PIN Quản trị</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Quyền chỉnh sửa dữ liệu, quản lý tài chính và cài đặt hệ thống được bảo vệ bởi mã PIN Quản trị. Hãy đổi mã PIN này theo ý bạn.
              </p>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                  Mã PIN Quản trị mới của bạn (Số) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Nhập 4-10 chữ số (Ví dụ: 9999)"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    style={{ padding: '12px 12px 12px 38px', width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                    maxLength={10}
                    autoFocus
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  * Nhớ kỹ mã này để truy cập các tính năng quản lý. Mã mặc định là 9999.
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.8rem' }}>
                <Check size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', color: '#0f172a', margin: 0 }}>Đã sẵn sàng!</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Thông tin thiết lập ban đầu của bạn:
              </p>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748b' }}>Tên địa bàn:</span>
                  <strong style={{ color: '#0f172a' }}>{tdpInput}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748b' }}>Mã PIN Quản trị:</span>
                  <strong style={{ color: '#0f172a', letterSpacing: '2px' }}>{pinInput}</strong>
                </div>
              </div>
              
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: '10px 0 0 0' }}>
                Hệ thống sẽ tự động đăng nhập quyền Quản trị ngay sau khi bạn bấm Bắt đầu.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 30px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', background: '#f8fafc', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <div>
            {step === 1 && (
              <button 
                type="button" 
                onClick={onSkip}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}
              >
                Bỏ qua
              </button>
            )}
            {step > 1 && (
              <button 
                type="button" 
                onClick={handleBack}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}
              >
                Quay lại
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}
              >
                Tiếp tục <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {loading ? 'Đang thiết lập...' : 'Bắt đầu sử dụng'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
