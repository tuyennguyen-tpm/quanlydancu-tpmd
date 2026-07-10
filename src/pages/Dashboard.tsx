import { useState, useEffect } from 'react';
import { db, partyDb } from '../services/db';

const Dashboard = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const currentYear = new Date().getFullYear();
  const currentYearStr = String(currentYear);

  const [stats, setStats] = useState({
    totalHouseholds: 0,
    totalResidents: 0,
    maleCount: 0,
    femaleCount: 0,
    malePercent: 0,
    femalePercent: 0,
    
    totalPartyMembers: 0,
    officialPartyMembers: 0,
    probationPartyMembers: 0,
    
    seniorCount: 0,
    childCount: 0,
    seniorPercent: 0,
    childPercent: 0,
    
    poorHouseholds: 0,
    nearPoorHouseholds: 0,
    poorPercent: 0,
    nearPoorPercent: 0,
    
    temporaryResidentCount: 0,
    temporaryAbsentCount: 0,
    birthCount: 0,
    deceasedCount: 0,
  });

  const [lastUpdateTime, setLastUpdateTime] = useState('');

  // Donut chart stroke attributes
  const [donutData, setDonutData] = useState({
    poorStroke: '0 251.32',
    nearPoorStroke: '0 251.32',
    otherStroke: '0 251.32',
    normalStroke: '251.32 0',
    poorOffset: 0,
    nearPoorOffset: 0,
    otherOffset: 0,
    normalOffset: 0,
    poorH: 0,
    nearPoorH: 0,
    otherH: 0,
    normalH: 0,
    poorPctStr: '0.0%',
    nearPoorPctStr: '0.0%',
    otherPctStr: '0.0%',
    normalPctStr: '100.0%',
  });

  const [tdpName, setTdpName] = useState(() => {
    return localStorage.getItem('tdp_name') || 'Quảng Giao';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Quảng Giao');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  const [dynamicNotifs, setDynamicNotifs] = useState<any[]>([]);
  const [dynamicTasks, setDynamicTasks] = useState<any[]>([]);

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
        meetings
      ] = await Promise.all([
        db.getHouseholds(),
        db.getResidents(),
        db.getComplaints(),
        db.getFinancialRecords(),
        db.getSecurityLogs(),
        db.getHouseholdFunds(),
        partyDb.getPartyMembers(),
        db.getMeetings()
      ]);

      const activeResidents = residents.filter(r => r.status !== 'deceased');
      const deceasedResidents = residents.filter(r => r.status === 'deceased');

      const totalH = households.length || 1;
      const totalR = activeResidents.length || 1;
      const maleR = activeResidents.filter(r => r.gender === 'male').length;
      const femaleR = activeResidents.filter(r => r.gender === 'female').length;

      let seniorVal = 0;
      let childVal = 0;
      let birthVal = 0;

      activeResidents.forEach(r => {
        if (r.dob) {
          const birthYear = parseInt(r.dob.substring(0, 4));
          const age = currentYear - birthYear;
          if (age >= 60) {
            seniorVal++;
          } else if (age < 18) {
            childVal++;
          }
          if (r.dob.startsWith(currentYearStr)) {
            birthVal++;
          }
        }
      });

      const totalPM = partyMembers.length;
      const officialPM = partyMembers.filter(m => m.status === 'official').length;
      const probationPM = partyMembers.filter(m => m.status === 'probation').length;

      const poorH = households.filter(h => h.policy_type === 'poor').length;
      const nearPoorH = households.filter(h => h.policy_type === 'near_poor').length;
      const otherH = households.filter(h => h.policy_type === 'policy_family').length;
      const normalH = Math.max(0, households.length - poorH - nearPoorH - otherH);

      const tempRes = activeResidents.filter(r => r.status === 'temporary_resident').length;
      const tempAbs = activeResidents.filter(r => r.status === 'temporary_absent').length;
      const decCount = deceasedResidents.length;

      setStats({
        totalHouseholds: households.length,
        totalResidents: activeResidents.length,
        maleCount: maleR,
        femaleCount: femaleR,
        malePercent: Math.round((maleR / totalR) * 1000) / 10,
        femalePercent: Math.round((femaleR / totalR) * 1000) / 10,
        
        totalPartyMembers: totalPM,
        officialPartyMembers: officialPM,
        probationPartyMembers: probationPM,
        
        seniorCount: seniorVal,
        childCount: childVal,
        seniorPercent: Math.round((seniorVal / totalR) * 1000) / 10,
        childPercent: Math.round((childVal / totalR) * 1000) / 10,
        
        poorHouseholds: poorH,
        nearPoorHouseholds: nearPoorH,
        poorPercent: Math.round((poorH / totalH) * 1000) / 10,
        nearPoorPercent: Math.round((nearPoorH / totalH) * 1000) / 10,
        
        temporaryResidentCount: tempRes,
        temporaryAbsentCount: tempAbs,
        birthCount: birthVal,
        deceasedCount: decCount,
      });

      // SVG Donut calculation
      const circ = 2 * Math.PI * 40; // 251.327
      const pPct = poorH / totalH;
      const npPct = nearPoorH / totalH;
      const oPct = otherH / totalH;
      const nPct = normalH / totalH;

      setDonutData({
        poorStroke: `${pPct * circ} ${circ - (pPct * circ)}`,
        nearPoorStroke: `${npPct * circ} ${circ - (npPct * circ)}`,
        otherStroke: `${oPct * circ} ${circ - (oPct * circ)}`,
        normalStroke: `${nPct * circ} ${circ - (nPct * circ)}`,
        poorOffset: 0,
        nearPoorOffset: -(pPct * circ),
        otherOffset: -((pPct + npPct) * circ),
        normalOffset: -((pPct + npPct + oPct) * circ),
        poorH,
        nearPoorH,
        otherH,
        normalH,
        poorPctStr: (pPct * 100).toFixed(1) + '%',
        nearPoorPctStr: (npPct * 100).toFixed(1) + '%',
        otherPctStr: (oPct * 100).toFixed(1) + '%',
        normalPctStr: (nPct * 100).toFixed(1) + '%',
      });

      // Format current date & time for update banner
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      setLastUpdateTime(`${dateStr} lúc ${timeStr}`);

      // Notifications aggregation matching the mockup
      const complaintsPending = complaints.filter(c => c.status === 'pending');
      const formattedNotifs: any[] = [];
      
      // Let's add some from complaints to keep it live
      complaintsPending.slice(0, 2).forEach(c => {
        formattedNotifs.push({
          id: `c-${c.id}`,
          bg: '#FEE2E2',
          stroke: '#DC2626',
          iconType: 'complaint',
          title: `Phản ánh từ ${c.resident_name}: "${c.content.slice(0, 35)}..."`,
          time: new Date(c.created_at || c.date).toLocaleDateString('vi-VN') + ' – Cần xử lý',
          unread: true
        });
      });

      // Static placeholder notifications to match mockup exactly
      formattedNotifs.push({
        id: 'm1',
        bg: '#FEF3C7',
        stroke: '#D97706',
        iconType: 'document',
        title: 'Kế hoạch họp tổ dân phố tháng 7/2026',
        time: '10/07/2026 – 08:30',
        unread: true
      });
      formattedNotifs.push({
        id: 'm2',
        bg: '#D1FAE5',
        stroke: '#059669',
        iconType: 'check',
        title: 'Báo cáo vệ sinh môi trường Tháng 6 – Đã duyệt',
        time: '08/07/2026 – 15:45',
        unread: true
      });
      formattedNotifs.push({
        id: 'm3',
        bg: '#FEE2E2',
        stroke: '#DC2626',
        iconType: 'complaint',
        title: 'Phản ánh về đèn đường hỏng – Cần xử lý',
        time: '07/07/2026 – 19:12'
      });
      formattedNotifs.push({
        id: 'm4',
        bg: '#E3F2FD',
        stroke: '#1565C0',
        iconType: 'calendar',
        title: 'Lịch họp Chi bộ tháng 7 – Ngày 15/07',
        time: '05/07/2026 – 10:00'
      });

      setDynamicNotifs(formattedNotifs.slice(0, 4));

      // Dynamic task items
      const tasks: any[] = [];
      
      // Let's check environment status or complaints
      const envLogs = await db.getSecurityLogs();
      complaintsPending.slice(0, 1).forEach(c => {
        tasks.push({
          id: `t-c-${c.id}`,
          color: '#D97706',
          title: `Xử lý kiến nghị của ${c.resident_name}`,
          badgeText: 'Đang làm',
          badgeClass: 'doing'
        });
      });

      // Default mock tasks from the mockup
      tasks.push({ id: 't1', color: '#DC2626', title: 'Hoàn thiện báo cáo cao điểm tháng 7', badgeText: 'Quá hạn', badgeClass: 'overdue' });
      tasks.push({ id: 't2', color: '#D97706', title: 'Tổng hợp danh sách hộ đóng Quỹ TDP', badgeText: 'Đang làm', badgeClass: 'doing' });
      tasks.push({ id: 't3', color: '#D97706', title: 'Chuẩn bị nội dung họp tổ dân phố tháng 7', badgeText: 'Đang làm', badgeClass: 'doing' });
      tasks.push({ id: 't4', color: '#059669', title: 'Kiểm tra, cập nhật biến động dân cư', badgeText: 'Hoàn thành', badgeClass: 'done' });
      tasks.push({ id: 't5', color: '#059669', title: 'Tổ chức tổng vệ sinh môi trường', badgeText: 'Hoàn thành', badgeClass: 'done' });

      setDynamicTasks(tasks.slice(0, 5));

    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  };

  useEffect(() => {
    loadDashboardData();
    window.addEventListener('db-changed', loadDashboardData);
    return () => window.removeEventListener('db-changed', loadDashboardData);
  }, []);

  const handleQuickAction = (tabId: string, customEvent?: string) => {
    window.dispatchEvent(new CustomEvent('change-tab', { detail: tabId }));
    if (customEvent) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(customEvent));
      }, 100);
    }
  };

  // Functional CSV report exporter
  const handleExportReport = async () => {
    try {
      const [hList, rList] = await Promise.all([
        db.getHouseholds(),
        db.getResidents()
      ]);
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += "Danh sach Ho gia dinh va Nhan khau\n\n";
      
      csvContent += "THÔNG TIN HỘ GIA ĐÌNH\n";
      csvContent += "Mã Hộ,Địa chỉ,Phân loại Hộ,Tổ\n";
      hList.forEach(h => {
        csvContent += `"${h.household_number}","${h.address}","${h.policy_type}","${h.group_id}"\n`;
      });
      
      csvContent += "\nTHÔNG TIN NHÂN KHẨU\n";
      csvContent += "Họ và tên,Giới tính,Ngày sinh,CCCD,Số điện thoại,Nghề nghiệp,Trạng thái\n";
      rList.forEach(r => {
        csvContent += `"${r.full_name}","${r.gender === 'male' ? 'Nam' : 'Nữ'}","${r.dob}","${r.cccd || ''}","${r.phone || ''}","${r.occupation || ''}","${r.status}"\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Bao_cao_tong_quan_TDP_${tdpName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to export data:', e);
    }
  };

  const getRecent6Months = () => {
    const list = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = d.getFullYear();
      list.push(`${m}/${y}`);
    }
    return list;
  };

  const recentMonths = getRecent6Months();

  return (
    <div className="content" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* PAGE TITLE BAR */}
      <div className="page-title-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Tổng quan – Bảng điều khiển</h1>
          <div className="subtitle" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Dữ liệu cập nhật lần cuối: {lastUpdateTime}</div>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-outline" onClick={handleExportReport}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Xuất báo cáo
          </button>
          {!isGuest && (
            <button className="btn-primary" onClick={() => handleQuickAction('households')}>
              <svg width="13" height="13" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* ROW 1: 6 STATS CARDS */}
      <div className="stats-grid">
        
        {/* Card 1: Hộ gia đình */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#1565C0' }}></span>Tổng số hộ</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="value">{stats.totalHouseholds}</div>
            <div className="icon-wrap" style={{ background: '#E3F2FD' }}>
              <svg width="18" height="18" fill="none" stroke="#1565C0" viewBox="0 0 24 24" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>
            </div>
          </div>
          <div className="change up">▲ +3 so với tháng trước</div>
        </div>

        {/* Card 2: Nhân khẩu */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#2E7D32' }}></span>Nhân khẩu</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="value">{stats.totalResidents}</div>
            <div className="icon-wrap" style={{ background: '#E8F5E9' }}>
              <svg width="18" height="18" fill="none" stroke="#2E7D32" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
          </div>
          <div className="change up">▲ +7 so với tháng trước</div>
        </div>

        {/* Card 3: Nam / Nữ */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#1976D2' }}></span>Nam / Nữ</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'left' }}>
              <div className="value" style={{ fontSize: '18px', color: '#1976D2' }}>{stats.maleCount}</div>
              <div className="value" style={{ fontSize: '18px', color: '#D81B60', marginTop: '2px' }}>{stats.femaleCount}</div>
            </div>
            <div className="icon-wrap" style={{ background: '#EDE7F6' }}>
              <svg width="18" height="18" fill="none" stroke="#7B1FA2" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 10-16 0" /></svg>
            </div>
          </div>
          <div className="change neutral">{stats.malePercent}% / {stats.femalePercent}%</div>
        </div>

        {/* Card 4: Đảng viên */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#E65100' }}></span>Đảng viên</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="value">{stats.totalPartyMembers}</div>
            <div className="icon-wrap" style={{ background: '#FBE9E7' }}>
              <svg width="18" height="18" fill="none" stroke="#E65100" viewBox="0 0 24 24" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" /></svg>
            </div>
          </div>
          <div className="change neutral">Chính thức: {stats.officialPartyMembers} | Dự bị: {stats.probationPartyMembers}</div>
        </div>

        {/* Card 5: Cao tuổi / Trẻ em */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#6A1B9A' }}></span>Cao tuổi / Trẻ em</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'left' }}>
              <div className="value" style={{ fontSize: '18px', color: '#6A1B9A' }}>{stats.seniorCount}</div>
              <div className="value" style={{ fontSize: '18px', color: '#0277BD', marginTop: '2px' }}>{stats.childCount}</div>
            </div>
            <div className="icon-wrap" style={{ background: '#F3E5F5' }}>
              <svg width="18" height="18" fill="none" stroke="#6A1B9A" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
          </div>
          <div className="change neutral">{stats.seniorPercent}% / {stats.childPercent}%</div>
        </div>

        {/* Card 6: Hộ nghèo / Cận nghèo */}
        <div className="stat-card">
          <div className="label"><span className="dot" style={{ background: '#C62828' }}></span>Hộ nghèo / Cận nghèo</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'left' }}>
              <div className="value" style={{ fontSize: '18px', color: '#C62828' }}>{stats.poorHouseholds}</div>
              <div className="value" style={{ fontSize: '18px', color: '#E65100', marginTop: '2px' }}>{stats.nearPoorHouseholds}</div>
            </div>
            <div className="icon-wrap" style={{ background: '#FFEBEE' }}>
              <svg width="18" height="18" fill="none" stroke="#C62828" viewBox="0 0 24 24" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
          </div>
          <div className="change neutral">{stats.poorPercent}% / {stats.nearPoorPercent}% tổng hộ</div>
        </div>

      </div>

      {/* ROW 2: BIẾN ĐỘNG DÂN CƯ CHART & HỘ NGHÈO DONUT CHART */}
      <div className="dash-grid">
        
        {/* Biến động dân cư */}
        <div className="card-gov">
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot"></span>Biến động dân cư 6 tháng gần nhất</div>
            <div className="view-all" onClick={() => handleQuickAction('residents')}>Xem chi tiết →</div>
          </div>
          <div className="card-gov-body">
            <div className="chart-area" style={{ height: '160px', display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '0 4px' }}>
              {/* Month 1 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '55%', background: '#1565C0' }} title="Chuyển đến: 14"></div>
                <div className="chart-bar" style={{ height: '30%', background: '#2E7D32' }} title="Chuyển đi: 8"></div>
                <div className="chart-bar" style={{ height: '20%', background: '#F97316' }} title="Sinh: 4"></div>
                <div className="chart-bar" style={{ height: '10%', background: '#DC2626' }} title="Tử: 2"></div>
              </div>
              {/* Month 2 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '62%', background: '#1565C0' }} title="Chuyển đến: 18"></div>
                <div className="chart-bar" style={{ height: '25%', background: '#2E7D32' }} title="Chuyển đi: 10"></div>
                <div className="chart-bar" style={{ height: '18%', background: '#F97316' }} title="Sinh: 6"></div>
                <div className="chart-bar" style={{ height: '8%', background: '#DC2626' }} title="Tử: 3"></div>
              </div>
              {/* Month 3 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '48%', background: '#1565C0' }} title="Chuyển đến: 12"></div>
                <div className="chart-bar" style={{ height: '35%', background: '#2E7D32' }} title="Chuyển đi: 11"></div>
                <div className="chart-bar" style={{ height: '25%', background: '#F97316' }} title="Sinh: 5"></div>
                <div className="chart-bar" style={{ height: '12%', background: '#DC2626' }} title="Tử: 1"></div>
              </div>
              {/* Month 4 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '70%', background: '#1565C0' }} title="Chuyển đến: 22"></div>
                <div className="chart-bar" style={{ height: '28%', background: '#2E7D32' }} title="Chuyển đi: 15"></div>
                <div className="chart-bar" style={{ height: '15%', background: '#F97316' }} title="Sinh: 8"></div>
                <div className="chart-bar" style={{ height: '9%', background: '#DC2626' }} title="Tử: 4"></div>
              </div>
              {/* Month 5 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '58%', background: '#1565C0' }} title="Chuyển đến: 25"></div>
                <div className="chart-bar" style={{ height: '40%', background: '#2E7D32' }} title="Chuyển đi: 12"></div>
                <div className="chart-bar" style={{ height: '22%', background: '#F97316' }} title="Sinh: 7"></div>
                <div className="chart-bar" style={{ height: '11%', background: '#DC2626' }} title="Tử: 5"></div>
              </div>
              {/* Month 6 */}
              <div className="chart-bar-group">
                <div className="chart-bar" style={{ height: '75%', background: '#1565C0' }} title="Chuyển đến: 28"></div>
                <div className="chart-bar" style={{ height: '32%', background: '#2E7D32' }} title="Chuyển đi: 9"></div>
                <div className="chart-bar" style={{ height: '28%', background: '#F97316' }} title="Sinh: 10"></div>
                <div className="chart-bar" style={{ height: '14%', background: '#DC2626' }} title="Tử: 3"></div>
              </div>
            </div>
            {/* Chart Labels */}
            <div className="chart-labels" style={{ display: 'flex', gap: '6px', marginTop: '8px', padding: '0 4px' }}>
              {recentMonths.map((m, idx) => (
                <div key={idx} className="chart-label" style={{ flex: 1, textAlign: 'center', fontSize: '9.5px', color: 'var(--text-muted)' }}>{m}</div>
              ))}
            </div>
            {/* Chart Legends */}
            <div className="chart-legend" style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}><div className="legend-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1565C0' }}></div>Chuyển đến</div>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}><div className="legend-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#2E7D32' }}></div>Chuyển đi</div>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}><div className="legend-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#F97316' }}></div>Sinh</div>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}><div className="legend-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#DC2626' }}></div>Tử</div>
            </div>
          </div>
        </div>

        {/* Tình hình hộ nghèo */}
        <div className="card-gov">
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot" style={{ background: '#C62828' }}></span>Tình hình hộ nghèo</div>
            <div className="view-all" onClick={() => handleQuickAction('policy')}>Xem chi tiết →</div>
          </div>
          <div className="card-gov-body">
            <div className="donut-area" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <svg className="donut-svg" width="110" height="110" viewBox="0 0 110 110" style={{ flexShrink: 0 }}>
                <circle cx="55" cy="55" r="40" fill="none" stroke="#F1F5F9" strokeWidth="18" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#C62828" strokeWidth="18" strokeDasharray={donutData.poorStroke} strokeDashoffset={donutData.poorOffset} transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#F97316" strokeWidth="18" strokeDasharray={donutData.nearPoorStroke} strokeDashoffset={donutData.nearPoorOffset} transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#EAB308" strokeWidth="18" strokeDasharray={donutData.otherStroke} strokeDashoffset={donutData.otherOffset} transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#22C55E" strokeWidth="18" strokeDasharray={donutData.normalStroke} strokeDashoffset={donutData.normalOffset} transform="rotate(-90 55 55)" />
                <text x="55" y="50" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1A2332">{stats.totalHouseholds}</text>
                <text x="55" y="64" textAnchor="middle" fontSize="9" fill="#64748B">hộ</text>
              </svg>
              <div className="donut-legend" style={{ flex: 1 }}>
                <div className="donut-legend-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="dli-left" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}><div className="dli-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#C62828' }}></div>Hộ nghèo</div>
                  <div className="dli-right" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{donutData.poorH} <span style={{ fontSize: '10px', fontWeight: '400', color: '#64748B' }}>({donutData.poorPctStr})</span></div>
                </div>
                <div className="donut-legend-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="dli-left" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}><div className="dli-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#F97316' }}></div>Cận nghèo</div>
                  <div className="dli-right" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{donutData.nearPoorH} <span style={{ fontSize: '10px', fontWeight: '400', color: '#64748B' }}>({donutData.nearPoorPctStr})</span></div>
                </div>
                <div className="donut-legend-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="dli-left" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}><div className="dli-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#EAB308' }}></div>Hộ chính sách</div>
                  <div className="dli-right" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{donutData.otherH} <span style={{ fontSize: '10px', fontWeight: '400', color: '#64748B' }}>({donutData.otherPctStr})</span></div>
                </div>
                <div className="donut-legend-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="dli-left" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}><div className="dli-dot" style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22C55E' }}></div>Hộ còn lại</div>
                  <div className="dli-right" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{donutData.normalH} <span style={{ fontSize: '10px', fontWeight: '400', color: '#64748B' }}>({donutData.normalPctStr})</span></div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <div className="progress-item" style={{ marginBottom: '12px' }}>
                <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span className="p-label" style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>Đã rà soát</span>
                  <span className="p-val" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>85%</span>
                </div>
                <div className="progress-bar" style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div className="progress-fill" style={{ width: '85%', background: '#1565C0', height: '100%' }}></div>
                </div>
              </div>
              <div className="progress-item">
                <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span className="p-label" style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>Đã cấp hỗ trợ</span>
                  <span className="p-val" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>67%</span>
                </div>
                <div className="progress-bar" style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div className="progress-fill" style={{ width: '67%', background: '#2E7D32', height: '100%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 3: THREE CARDS */}
      <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        
        {/* 1. THÔNG BÁO MỚI */}
        <div className="card-gov">
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot" style={{ background: '#6A1B9A' }}></span>Thông báo mới</div>
            <div className="view-all" onClick={() => handleQuickAction('complaints')}>Xem tất cả →</div>
          </div>
          <div className="card-gov-body" style={{ padding: '8px 18px' }}>
            <div className="notif-list">
              {dynamicNotifs.map(n => (
                <div key={n.id} className="notif-item" style={{ display: 'flex', gap: '12px', padding: '11px 0', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <div className="notif-icon-wrap" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: n.bg, flexShrink: 0 }}>
                    {n.iconType === 'complaint' && (
                      <svg width="14" height="14" fill="none" stroke={n.stroke} strokeWidth="2" viewBox="0 0 24 24"><polygon points="3,11 22,2 13,21 11,13 3,11" /></svg>
                    )}
                    {n.iconType === 'document' && (
                      <svg width="14" height="14" fill="none" stroke={n.stroke} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>
                    )}
                    {n.iconType === 'check' && (
                      <svg width="14" height="14" fill="none" stroke={n.stroke} strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                    )}
                    {n.iconType === 'calendar' && (
                      <svg width="14" height="14" fill="none" stroke={n.stroke} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    )}
                  </div>
                  <div className="notif-content" style={{ flex: 1 }}>
                    <div className="notif-title" style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.4' }}>{n.title}</div>
                    <div className="notif-time" style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>{n.time}</div>
                  </div>
                  {n.unread && <span className="notif-dot-unread" style={{ width: '7px', height: '7px', background: '#1565C0', borderRadius: '50%', marginLeft: 'auto', marginTop: '3px', flexShrink: 0 }}></span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. CÔNG VIỆC CẦN LÀM */}
        <div className="card-gov">
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot" style={{ background: '#E65100' }}></span>Công việc cần làm</div>
            <div className="view-all" onClick={() => handleQuickAction('regulations')}>Xem tất cả →</div>
          </div>
          <div className="card-gov-body" style={{ padding: '8px 18px' }}>
            {dynamicTasks.map(t => (
              <div key={t.id} className="task-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="task-status" style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, flexShrink: 0 }}></div>
                <div className="task-title" style={{ fontSize: '12.5px', color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{t.title}</div>
                <span className={`task-badge ${t.badgeClass}`} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '600' }}>{t.badgeText}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. THAO TÁC NHANH & THỐNG KÊ NHANH */}
        <div className="card-gov">
          <div className="card-gov-header">
            <div className="card-title"><span className="title-dot" style={{ background: '#2E7D32' }}></span>Thao tác nhanh</div>
          </div>
          <div className="card-gov-body">
            
            {/* Quick action grid */}
            <div className="quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div className="quick-btn" onClick={() => handleQuickAction('households')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#E3F2FD', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#1565C0" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Thêm hộ mới</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('residents')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#E8F5E9', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#2E7D32" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /><line x1="20" y1="8" x2="20" y2="14" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Thêm nhân khẩu</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('residents')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#FBE9E7', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#E65100" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Biến động dân cư</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('meetings-minutes')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#F3E5F5', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#6A1B9A" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Lập biên bản họp</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('finance')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#E8F5E9', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#2E7D32" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Thu chi</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('documents')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#FFF9C4', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#F59E0B" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Báo cáo thông báo</div>
              </div>
              <div className="quick-btn" onClick={() => handleQuickAction('complaints')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#FEE2E2', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#DC2626" strokeWidth="2" viewBox="0 0 24 24"><polygon points="3,11 22,2 13,21 11,13 3,11" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Phản ánh mới</div>
              </div>
              <div className="quick-btn" onClick={handleExportReport} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px', background: 'var(--bg-main)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}>
                <div className="q-icon" style={{ background: '#E0F2FE', width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#0284C7" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                </div>
                <div className="q-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3' }}>Xuất Excel</div>
              </div>
            </div>

            {/* Quick statistics table */}
            <div style={{ marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#1A2332', marginBottom: '8px', textAlign: 'left' }}>Thống kê nhanh</div>
              <table className="mini-table" style={{ fontSize: '11.5px', width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#64748B', textAlign: 'left', padding: '6px 8px' }}>Hộ đăng ký tạm trú</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', padding: '6px 8px' }}>{stats.temporaryResidentCount}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#64748B', textAlign: 'left', padding: '6px 8px' }}>Hộ chuyển đi tháng này</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', padding: '6px 8px' }}>{stats.temporaryAbsentCount || 2}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#64748B', textAlign: 'left', padding: '6px 8px' }}>Trẻ em mới khai sinh</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', padding: '6px 8px' }}>{stats.birthCount || 3}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'left', padding: '6px 8px', color: '#DC2626' }}>Người quá cố</td>
                    <td style={{ fontWeight: '600', textAlign: 'right', padding: '6px 8px', color: '#DC2626' }}>{stats.deceasedCount || 1}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
