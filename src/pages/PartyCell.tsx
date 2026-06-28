import React, { useState, useEffect, useCallback } from 'react';
import { partyDb, generateUUID } from '../services/db';
import type { PartyMember, PartyMeeting, PartyEvaluation, PartyFee } from '../services/db';
import { db } from '../services/db';
import type { Resident } from '../types';
import { showToast } from '../utils/toast';
import {
  Star, Users, Calendar, BarChart2, DollarSign, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Clock, ChevronDown, X, Search, Award, BookOpen
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────
const POSITION_LABEL: Record<string, string> = {
  secretary: 'Bí thư',
  deputy_secretary: 'Phó Bí thư',
  member: 'Đảng viên',
};
const STATUS_LABEL: Record<string, string> = {
  official: 'Chính thức',
  probation: 'Dự bị',
  inactive: 'Không HĐ',
};
const STATUS_COLOR: Record<string, string> = {
  official: '#22c55e',
  probation: '#f59e0b',
  inactive: '#64748b',
};
const RATING_LABEL: Record<string, string> = {
  excellent: 'Xuất sắc',
  good: 'Hoàn thành tốt',
  average: 'Hoàn thành',
  weak: 'Không HT nhiệm vụ',
};
const RATING_COLOR: Record<string, string> = {
  excellent: '#dc2626',
  good: '#2563eb',
  average: '#16a34a',
  weak: '#64748b',
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
};

const currentYear = new Date().getFullYear();

// ─── Component chính ─────────────────────────────────────────
const PartyCell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'meetings' | 'evaluations' | 'fees'>('members');

  const tabs = [
    { id: 'members', label: 'Danh sách Đảng viên', icon: Users },
    { id: 'meetings', label: 'Sinh hoạt Chi bộ', icon: Calendar },
    { id: 'evaluations', label: 'Đánh giá hàng năm', icon: BarChart2 },
    { id: 'fees', label: 'Thu đảng phí', icon: DollarSign },
  ] as const;

  return (
    <div className="party-cell-wrapper">
      {/* Header */}
      <div className="party-header">
        <div className="party-title-group">
          <div className="party-badge">
            <Star size={14} fill="currentColor" />
            CHI BỘ ĐẢNG
          </div>
          <h2>Quản lý Chi bộ Đảng</h2>
          <p>Hệ thống quản lý đảng viên, sinh hoạt và đánh giá</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="party-tabs">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`party-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="party-content">
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'meetings' && <MeetingsTab />}
        {activeTab === 'evaluations' && <EvaluationsTab />}
        {activeTab === 'fees' && <FeesTab />}
      </div>

      <style>{`
        .party-cell-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .party-header {
          background: #991b1b;
          border: 1px solid #7f1d1d;
          border-radius: 14px 14px 0 0;
          padding: 20px 24px 18px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .party-title-group h2 {
          font-size: 1.4rem;
          font-weight: 850;
          color: #ffffff;
          margin: 6px 0 2px;
          letter-spacing: -0.3px;
        }
        .party-title-group p { font-size: 0.88rem; color: #fecaca; margin: 0; font-weight: 600; }
        .party-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #7f1d1d;
          color: #ffffff;
          border: 1px solid #b91c1c;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .party-tabs {
          display: flex;
          gap: 0;
          background: #0f172a;
          border-left: 1px solid #7f1d1d;
          border-right: 1px solid #7f1d1d;
          border-bottom: 2px solid #b91c1c;
          overflow-x: auto;
        }
        .party-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 22px;
          border: none;
          background: transparent;
          color: #cbd5e1;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .party-tab-btn:hover { color: #ffffff; background: rgba(220,38,38,0.15); }
        .party-tab-btn.active { color: #ffffff; border-bottom-color: #f87171; background: #dc2626; }

        .party-content {
          background: #1e293b;
          border: 1px solid #b91c1c;
          border-top: none;
          border-radius: 0 0 14px 14px;
          padding: 24px;
          min-height: 420px;
        }

        /* ── Stats row ── */
        .party-stats { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
        .party-stat-card {
          flex: 1; min-width: 110px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 14px 18px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .party-stat-card .stat-num { font-size: 2rem; font-weight: 900; color: #f87171; }
        .party-stat-card .stat-label { font-size: 0.8rem; color: #ffffff; margin-top: 4px; font-weight: 700; }

        /* ── Table ── */
        .party-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #475569; }
        .party-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        .party-table th {
          background: #dc2626;
          color: #ffffff;
          font-weight: 800;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          text-align: left;
          white-space: nowrap;
          border-bottom: 2px solid #991b1b;
        }
        .party-table td { padding: 12px 14px; color: #ffffff; border-top: 1px solid #334155; vertical-align: middle; }
        .party-table tr:hover td { background: #334155; }

        /* ── Buttons ── */
        .party-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: white; border: none; border-radius: 8px;
          padding: 10px 20px; font-size: 0.88rem; font-weight: 750;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 10px rgba(220,38,38,0.3);
        }
        .party-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(220,38,38,0.5); }
        .party-btn-icon {
          background: none; border: none; cursor: pointer;
          padding: 6px; border-radius: 6px; transition: all 0.2s;
          color: #ffffff;
        }
        .party-btn-icon:hover { background: #dc2626; color: #ffffff; }
        .party-btn-icon.delete:hover { background: #ef4444; color: #ffffff; }

        /* ── Status badges ── */
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 12px; border-radius: 4px; font-size: 0.78rem; font-weight: 800;
          white-space: nowrap;
        }

        /* ── Modal ── */
        .party-modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .party-modal {
          background: #1e293b;
          border: 1px solid rgba(220,38,38,0.4);
          border-radius: 16px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 25px 60px rgba(0,0,0,0.75);
          animation: fadeIn 0.2s ease;
        }
        .party-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 18px 22px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .party-modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #fff; }
        .party-modal-body { padding: 20px 22px; display: flex; flex-direction: column; gap: 16px; }
        .party-modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 14px 22px 18px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .party-form-group { display: flex; flex-direction: column; gap: 6px; }
        .party-form-group label { font-size: 0.78rem; color: #cbd5e1; font-weight: 700; }
        .party-form-group input,
        .party-form-group select,
        .party-form-group textarea {
          background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 8px; color: #fff; padding: 10px 14px;
          font-size: 0.88rem; outline: none; width: 100%; box-sizing: border-box;
          transition: all 0.2s;
        }
        .party-form-group input:focus,
        .party-form-group select:focus,
        .party-form-group textarea:focus { border-color: rgba(220,38,38,0.6); box-shadow: 0 0 8px rgba(220,38,38,0.25); }
        .party-form-group textarea { resize: vertical; min-height: 80px; }
        .party-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .party-form-group select option { background: #1e293b; }

        .btn-cancel {
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: #cbd5e1; border-radius: 8px; padding: 8px 16px;
          font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-cancel:hover { background: rgba(255,255,255,0.15); color: #fff; }

        /* ── Fee matrix ── */
        .fee-matrix-wrap { overflow-x: auto; }
        .fee-table { border-collapse: collapse; font-size: 0.82rem; min-width: 720px; width: 100%; }
        .fee-table th { background: rgba(220,38,38,0.22); color: #ffffff; font-weight: 800; padding: 10px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.08); font-size: 0.72rem; }
        .fee-table th.name-col { text-align: left; min-width: 150px; }
        .fee-table td { padding: 8px 8px; border: 1px solid rgba(255,255,255,0.07); text-align: center; color: #f8fafc; vertical-align: middle; }
        .fee-table td.name-col { text-align: left; font-weight: 700; color: #fff; white-space: nowrap; }
        .fee-cell-btn {
          width: 30px; height: 30px; border-radius: 6px; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; margin: auto;
          transition: all 0.2s;
        }
        .fee-cell-btn.paid { background: rgba(34,197,94,0.25); color: #4ade80; border: 1px solid rgba(34,197,94,0.4); }
        .fee-cell-btn.unpaid { background: rgba(255,255,255,0.08); color: #94a3b8; border: 1px solid rgba(255,255,255,0.12); }
        .fee-cell-btn:hover { transform: scale(1.18); }

        /* ── Progress bar ── */
        .rating-bar { height: 6px; border-radius: 3px; margin-top: 3px; transition: width 0.5s ease; }

        /* ── Search ── */
        .party-search {
          position: relative; flex: 1;
        }
        .party-search input {
          width: 100%; padding: 9px 12px 9px 38px;
          background: #0f172a; border: 2px solid #cbd5e1;
          border-radius: 8px; color: #ffffff; font-size: 0.88rem; outline: none;
          box-sizing: border-box;
          transition: all 0.2s;
        }
        .party-search input::placeholder {
          color: #cbd5e1;
          opacity: 1;
        }
        .party-search input:focus { border-color: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.4); }
        .party-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #cbd5e1; pointer-events: none; }

        .party-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; }
        .no-data { text-align: center; color: #cbd5e1; padding: 40px 20px; font-size: 0.9rem; }
        .no-data svg { margin: 0 auto 12px; display: block; opacity: 0.6; }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 1: DANH SÁCH ĐẢNG VIÊN
// ═══════════════════════════════════════════════════════════
const MembersTab: React.FC = () => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PartyMember | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<PartyMember>>({
    position: 'member', status: 'official'
  });
  const [residentSearch, setResidentSearch] = useState('');
  const [showResidentDrop, setShowResidentDrop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, r] = await Promise.all([partyDb.getPartyMembers(), db.getResidents()]);
    setMembers(m);
    setResidents(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ position: 'member', status: 'official' });
    setResidentSearch('');
    setShowModal(true);
  };
  const openEdit = (m: PartyMember) => {
    setEditing(m);
    const res = residents.find(r => r.id === m.resident_id);
    setResidentSearch(res ? res.full_name : '');
    setForm(m);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name?.trim()) { showToast('Vui lòng nhập họ tên đảng viên!', 'warning'); return; }
    if (form.status === 'official' && !form.join_date) {
      showToast('Đảng viên chính thức bắt buộc phải nhập Ngày vào Đảng (chính thức)!', 'warning');
      return;
    }
    if (form.status === 'probation' && !form.probation_date) {
      showToast('Đảng viên dự bị bắt buộc phải nhập Ngày kết nạp (dự bị)!', 'warning');
      return;
    }
    try {
      const payload: Omit<PartyMember, 'created_at'> = {
        id: editing?.id || generateUUID(),
        full_name: form.full_name!.trim(),
        party_code: form.party_code || '',
        join_date: form.join_date || undefined,
        probation_date: form.probation_date || undefined,
        position: form.position || 'member',
        status: form.status || 'official',
        resident_id: form.resident_id || null,
        notes: form.notes || '',
      };
      await partyDb.savePartyMember(payload);
      showToast(editing ? 'Đã cập nhật đảng viên!' : 'Đã thêm đảng viên mới!', 'success');
      setShowModal(false);
      load();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'danger');
    }
  };

  const handleDelete = async (m: PartyMember) => {
    if (!confirm(`Xóa đảng viên "${m.full_name}"?`)) return;
    await partyDb.deletePartyMember(m.id);
    showToast('Đã xóa đảng viên!', 'success');
    load();
  };

  const filtered = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.party_code || '').includes(search)
  );
  const stats = {
    total: members.length,
    official: members.filter(m => m.status === 'official').length,
    probation: members.filter(m => m.status === 'probation').length,
  };

  const badgeNominees = members
    .map(m => {
      const dateStr = m.probation_date || m.join_date;
      if (!dateStr) return null;
      const year = new Date(dateStr).getFullYear();
      if (isNaN(year)) return null;
      const age = currentYear - year;
      const milestones = [30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
      if (milestones.includes(age)) {
        return { name: m.full_name, age };
      }
      return null;
    })
    .filter(Boolean) as { name: string; age: number }[];

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Vui lòng cho phép mở cửa sổ bật lên để in!', 'warning');
      return;
    }
    
    const rowsHtml = filtered.map((m, idx) => {
      const dateStr = m.probation_date || m.join_date;
      let tuoiDangStr = '—';
      if (dateStr) {
        const yr = new Date(dateStr).getFullYear();
        if (!isNaN(yr)) tuoiDangStr = `${currentYear - yr} năm`;
      }
      
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px;"><strong>${m.full_name}</strong></td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${m.party_code || '—'}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${POSITION_LABEL[m.position] || m.position}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${fmtDate(m.probation_date)}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${fmtDate(m.join_date)}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${STATUS_LABEL[m.status] || m.status}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${tuoiDangStr}</td>
          <td style="border: 1px solid #000; padding: 6px;">${m.notes || '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Danh sach Dang vien - Chi bo To dan pho Quang Giao</title>
          <style>
            body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.4; padding: 25px; color: #000; }
            .header-table { width: 100%; border: none; margin-bottom: 25px; border-collapse: collapse; }
            .header-table td { border: none; padding: 0; vertical-align: top; }
            .title { text-align: center; margin-bottom: 20px; }
            .title h2 { margin: 5px 0; font-size: 15pt; font-weight: bold; text-transform: uppercase; }
            .title p { margin: 5px 0; font-style: italic; }
            .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .main-table th, .main-table td { border: 1px solid #000; padding: 8px 6px; font-size: 11pt; }
            .main-table th { font-weight: bold; background-color: #f2f2f2; text-align: center; text-transform: uppercase; }
            .footer-section { width: 100%; margin-top: 35px; border: none; border-collapse: collapse; }
            .footer-section td { border: none; padding: 0; text-align: center; width: 50%; vertical-align: top; }
            .footer-date { font-style: italic; margin-bottom: 5px; }
            .footer-role { font-weight: bold; margin-bottom: 60px; }
            @media print {
              body { padding: 0; }
              @page { size: A4 portrait; margin: 1.5cm 1cm 1.5cm 1.5cm; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 45%; text-align: center; line-height: 1.3;">
                <strong>ĐẢNG BỘ PHƯỜNG QUẢNG GIAO</strong><br>
                <strong style="text-decoration: underline;">CHI BỘ TDP QUẢNG GIAO</strong>
              </td>
              <td style="width: 55%; text-align: center; line-height: 1.3;">
                <strong>ĐẢNG CỘNG SẢN VIỆT NAM</strong><br>
                <span style="font-size: 10pt; font-style: italic;">Quảng Giao, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
              </td>
            </tr>
          </table>

          <div class="title">
            <h2>DANH SÁCH ĐẢNG VIÊN</h2>
            <p>Chi bộ Tổ dân phố Quảng Giao - Năm ${currentYear}</p>
          </div>

          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 5%;">STT</th>
                <th style="width: 22%;">Họ và tên</th>
                <th style="width: 12%;">Số thẻ Đảng</th>
                <th style="width: 12%;">Chức vụ</th>
                <th style="width: 12%;">Ngày kết nạp</th>
                <th style="width: 12%;">Ngày chính thức</th>
                <th style="width: 10%;">Trạng thái</th>
                <th style="width: 10%;">Tuổi Đảng</th>
                <th style="width: 15%;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table class="footer-section">
            <tr>
              <td></td>
              <td>
                <div class="footer-date">Quảng Giao, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
                <div class="footer-role">T/M CHI BỘ<br>BÍ THƯ</div>
                <div style="font-weight: bold; margin-top: 50px;">Nguyễn Kim Tuyến</div>
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredResidents = residents.filter(r =>
    r.full_name.toLowerCase().includes(residentSearch.toLowerCase())
  ).slice(0, 6);

  return (
    <>
      {/* Cảnh báo Huy hiệu Đảng */}
      {badgeNominees.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '0.82rem', color: '#fef08a', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🎖️</span>
          <span>
            <strong>Đề nghị nhận Huy hiệu Đảng năm {currentYear}:</strong>{' '}
            {badgeNominees.map((n, idx) => (
              <span key={idx}>
                <strong>{n.name}</strong> (đủ {n.age} năm tuổi Đảng)
                {idx < badgeNominees.length - 1 ? ' • ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="party-stats">
        <div className="party-stat-card"><div className="stat-num">{stats.total}</div><div className="stat-label">Tổng đảng viên</div></div>
        <div className="party-stat-card"><div className="stat-num" style={{ color: '#22c55e' }}>{stats.official}</div><div className="stat-label">Chính thức</div></div>
        <div className="party-stat-card"><div className="stat-num" style={{ color: '#f59e0b' }}>{stats.probation}</div><div className="stat-label">Dự bị</div></div>
      </div>

      {/* Toolbar */}
      <div className="party-toolbar">
        <div className="party-search">
          <Search size={15} className="party-search-icon" />
          <input placeholder="Tìm kiếm tên, số thẻ..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="party-btn-primary" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 10px rgba(37,99,235,0.2)' }} onClick={handlePrint}>🖨️ In danh sách</button>
          <button className="party-btn-primary" onClick={openAdd}><Plus size={15} />Thêm Đảng viên</button>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="no-data">Đang tải...</div> : filtered.length === 0 ? (
        <div className="no-data"><Users size={36} /><p>Chưa có đảng viên nào</p></div>
      ) : (
        <div className="party-table-wrap">
          <table className="party-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Họ và tên</th>
                <th>Số thẻ</th>
                <th>Chức vụ</th>
                <th>Ngày vào Đảng</th>
                <th>Tuổi Đảng</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: '#cbd5e1', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{m.full_name}</td>
                  <td style={{ color: '#f1f5f9' }}>{m.party_code || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.25)' }}>
                      {POSITION_LABEL[m.position] || m.position}
                    </span>
                  </td>
                  <td style={{ color: '#f1f5f9' }}>{fmtDate(m.join_date)}</td>
                  <td style={{ color: '#f1f5f9' }}>
                    {(() => {
                      const dateStr = m.probation_date || m.join_date;
                      if (!dateStr) return '—';
                      const yr = new Date(dateStr).getFullYear();
                      if (isNaN(yr)) return '—';
                      const tuoiDang = currentYear - yr;
                      const milestones = [30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
                      const hasBadge = milestones.includes(tuoiDang);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{tuoiDang} năm</span>
                          {hasBadge && (
                            <span 
                              title={`Đủ điều kiện nhận Huy hiệu ${tuoiDang} năm tuổi Đảng!`} 
                              style={{ color: '#fbbf24', fontSize: '0.92rem', cursor: 'help' }}
                            >
                              🎖️
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: `${STATUS_COLOR[m.status]}20`, color: STATUS_COLOR[m.status] === '#64748b' ? '#cbd5e1' : STATUS_COLOR[m.status], border: `1px solid ${STATUS_COLOR[m.status]}40` }}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td style={{ color: '#cbd5e1', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="party-btn-icon" onClick={() => openEdit(m)} title="Sửa"><Pencil size={15} /></button>
                      <button className="party-btn-icon delete" onClick={() => handleDelete(m)} title="Xóa"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="party-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="party-modal">
            <div className="party-modal-header">
              <h3>{editing ? '✏️ Chỉnh sửa Đảng viên' : '➕ Thêm Đảng viên mới'}</h3>
              <button className="party-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="party-modal-body">
              {/* Liên kết nhân khẩu */}
              <div className="party-form-group" style={{ position: 'relative' }}>
                <label>Liên kết Nhân khẩu (tuỳ chọn)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    style={{ paddingLeft: 32 }}
                    placeholder="Tìm tên trong danh sách nhân khẩu..."
                    value={residentSearch}
                    onChange={e => { setResidentSearch(e.target.value); setShowResidentDrop(true); }}
                    onFocus={() => setShowResidentDrop(true)}
                  />
                </div>
                {showResidentDrop && residentSearch && filteredResidents.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                    {filteredResidents.map(r => (
                      <div
                        key={r.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseDown={() => {
                          setForm(f => ({ ...f, resident_id: r.id, full_name: r.full_name }));
                          setResidentSearch(r.full_name);
                          setShowResidentDrop(false);
                        }}
                      >
                        {r.full_name} — <span style={{ color: '#64748b' }}>{r.phone || 'Không có SĐT'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="party-form-group">
                <label>Họ và tên <span style={{ color: '#f87171' }}>*</span></label>
                <input value={form.full_name || ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
              </div>

              <div className="party-form-row">
                <div className="party-form-group">
                  <label>Số thẻ Đảng</label>
                  <input value={form.party_code || ''} onChange={e => setForm(f => ({ ...f, party_code: e.target.value }))} placeholder="DV-0001" />
                </div>
                <div className="party-form-group">
                  <label>Chức vụ</label>
                  <select value={form.position || 'member'} onChange={e => setForm(f => ({ ...f, position: e.target.value as any }))}>
                    <option value="secretary">Bí thư</option>
                    <option value="deputy_secretary">Phó Bí thư</option>
                    <option value="member">Đảng viên</option>
                  </select>
                </div>
              </div>

              <div className="party-form-row">
                <div className="party-form-group">
                  <label>Ngày kết nạp (dự bị) {form.status === 'probation' && <span style={{ color: '#f87171' }}>*</span>}</label>
                  <input type="date" value={form.probation_date || ''} onChange={e => setForm(f => ({ ...f, probation_date: e.target.value }))} />
                </div>
                <div className="party-form-group">
                  <label>Ngày vào Đảng (chính thức) {form.status === 'official' && <span style={{ color: '#f87171' }}>*</span>}</label>
                  <input type="date" value={form.join_date || ''} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} />
                </div>
              </div>

              <div className="party-form-group">
                <label>Trạng thái</label>
                <select value={form.status || 'official'} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="official">Chính thức</option>
                  <option value="probation">Dự bị</option>
                  <option value="inactive">Không hoạt động</option>
                </select>
              </div>

              <div className="party-form-group">
                <label>Ghi chú</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ghi chú thêm..." />
              </div>
            </div>
            <div className="party-modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="party-btn-primary" onClick={handleSave}>
                {editing ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 2: SINH HOẠT CHI BỘ
// ═══════════════════════════════════════════════════════════
const MeetingsTab: React.FC = () => {
  const [meetings, setMeetings] = useState<PartyMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PartyMeeting | null>(null);
  const [form, setForm] = useState<Partial<PartyMeeting>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMeetings(await partyDb.getPartyMeetings());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ date: new Date().toISOString().slice(0, 10), attendance_count: 0 });
    setShowModal(true);
  };
  const openEdit = (m: PartyMeeting) => { setEditing(m); setForm(m); setShowModal(true); };

  const handleSave = async () => {
    if (!form.title?.trim()) { showToast('Vui lòng nhập tiêu đề!', 'warning'); return; }
    try {
      await partyDb.savePartyMeeting({
        id: editing?.id || generateUUID(),
        title: form.title!,
        date: form.date || new Date().toISOString().slice(0, 10),
        time: form.time || '',
        location: form.location || '',
        content: form.content || '',
        attendance_count: form.attendance_count || 0,
        resolution: form.resolution || '',
      });
      showToast(editing ? 'Đã cập nhật!' : 'Đã thêm buổi sinh hoạt!', 'success');
      setShowModal(false);
      load();
    } catch (e: any) { showToast(`Lỗi: ${e.message}`, 'danger'); }
  };

  const handleDelete = async (m: PartyMeeting) => {
    if (!confirm(`Xóa buổi sinh hoạt "${m.title}"?`)) return;
    await partyDb.deletePartyMeeting(m.id);
    showToast('Đã xóa!', 'success');
    load();
  };

  return (
    <>
      <div className="party-toolbar">
        <div style={{ flex: 1 }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
            <BookOpen size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Tổng cộng <strong style={{ color: '#f87171' }}>{meetings.length}</strong> buổi sinh hoạt
          </span>
        </div>
        <button className="party-btn-primary" onClick={openAdd}><Plus size={15} />Ghi buổi sinh hoạt</button>
      </div>

      {loading ? <div className="no-data">Đang tải...</div> : meetings.length === 0 ? (
        <div className="no-data"><Calendar size={36} /><p>Chưa có buổi sinh hoạt nào được ghi nhận</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meetings.map(m => (
            <div key={m.id} style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', gap: 16, flexWrap: 'wrap', fontWeight: 500 }}>
                    <span>📅 {fmtDate(m.date)}{m.time ? ` — ${m.time}` : ''}</span>
                    {m.location && <span>📍 {m.location}</span>}
                    <span>👥 {m.attendance_count} đảng viên tham dự</span>
                  </div>
                  {m.content && <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>{m.content}</div>}
                  {m.resolution && (
                    <div style={{ marginTop: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', color: '#fca5a5' }}>
                      <strong>Nghị quyết:</strong> {m.resolution}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="party-btn-icon" onClick={() => openEdit(m)} title="Sửa"><Pencil size={15} /></button>
                  <button className="party-btn-icon delete" onClick={() => handleDelete(m)} title="Xóa"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="party-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="party-modal">
            <div className="party-modal-header">
              <h3>{editing ? '✏️ Chỉnh sửa buổi sinh hoạt' : '📅 Ghi nhận buổi sinh hoạt'}</h3>
              <button className="party-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="party-modal-body">
              <div className="party-form-group">
                <label>Tên / Chủ đề sinh hoạt <span style={{ color: '#f87171' }}>*</span></label>
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Sinh hoạt chi bộ tháng 6/2026" />
              </div>
              <div className="party-form-row">
                <div className="party-form-group">
                  <label>Ngày</label>
                  <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="party-form-group">
                  <label>Giờ bắt đầu</label>
                  <input type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div className="party-form-row">
                <div className="party-form-group">
                  <label>Địa điểm</label>
                  <input value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Nhà văn hóa tổ..." />
                </div>
                <div className="party-form-group">
                  <label>Số đảng viên tham dự</label>
                  <input type="number" min={0} value={form.attendance_count || 0} onChange={e => setForm(f => ({ ...f, attendance_count: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="party-form-group">
                <label>Nội dung sinh hoạt</label>
                <textarea value={form.content || ''} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Ghi tóm tắt nội dung..." rows={4} />
              </div>
              <div className="party-form-group">
                <label>Nghị quyết / Kết luận</label>
                <textarea value={form.resolution || ''} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} placeholder="Nghị quyết được thông qua..." rows={3} />
              </div>
            </div>
            <div className="party-modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="party-btn-primary" onClick={handleSave}>{editing ? 'Cập nhật' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 3: ĐÁNH GIÁ HÀNG NĂM
// ═══════════════════════════════════════════════════════════
const EvaluationsTab: React.FC = () => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [evals, setEvals] = useState<PartyEvaluation[]>([]);
  const [year, setYear] = useState(currentYear);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, e] = await Promise.all([partyDb.getPartyMembers(), partyDb.getPartyEvaluations(year)]);
    setMembers(m);
    setEvals(e);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const getEval = (memberId: string) => evals.find(e => e.member_id === memberId);

  const handleRate = async (member: PartyMember, rating: PartyEvaluation['rating']) => {
    setSaving(member.id);
    const existing = getEval(member.id);
    try {
      await partyDb.savePartyEvaluation({
        id: existing?.id || generateUUID(),
        member_id: member.id,
        year,
        rating,
        notes: existing?.notes || '',
      });
      showToast(`Đã lưu xếp loại cho ${member.full_name}!`, 'success');
      load();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'danger');
    } finally {
      setSaving(null);
    }
  };

  const ratingCounts = {
    excellent: evals.filter(e => e.rating === 'excellent').length,
    good: evals.filter(e => e.rating === 'good').length,
    average: evals.filter(e => e.rating === 'average').length,
    weak: evals.filter(e => e.rating === 'weak').length,
  };
  const rated = evals.length;
  const total = members.length;

  return (
    <>
      {/* Selector & stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}>Năm:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
          Đã đánh giá <strong style={{ color: '#f87171' }}>{rated}/{total}</strong> đảng viên
        </span>
      </div>

      {/* Rating summary */}
      {rated > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
            <div key={r} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${RATING_COLOR[r]}30`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: RATING_COLOR[r] }}>{ratingCounts[r]}</div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: 2, fontWeight: 700 }}>{RATING_LABEL[r]}</div>
              <div className="rating-bar" style={{ background: `${RATING_COLOR[r]}30`, marginTop: 6 }}>
                <div className="rating-bar" style={{ width: total > 0 ? `${(ratingCounts[r] / total) * 100}%` : '0%', background: RATING_COLOR[r] }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <div className="no-data"><Award size={36} /><p>Chưa có đảng viên nào trong danh sách</p></div>
      ) : (
        <div className="party-table-wrap">
          <table className="party-table">
            <thead>
              <tr>
                <th>#</th><th>Họ và tên</th><th>Chức vụ</th>
                <th>Xuất sắc</th><th>Hoàn thành tốt</th><th>Hoàn thành</th><th>Không HT</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const ev = getEval(m.id);
                const isSaving = saving === m.id;
                return (
                  <tr key={m.id}>
                    <td style={{ color: '#cbd5e1', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{m.full_name}</td>
                    <td style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}>{POSITION_LABEL[m.position]}</td>
                    {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
                      <td key={r}>
                        <button
                          onClick={() => handleRate(m, r)}
                          disabled={isSaving}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                            background: ev?.rating === r ? `${RATING_COLOR[r]}25` : 'rgba(255,255,255,0.06)',
                            color: ev?.rating === r ? RATING_COLOR[r] : '#94a3b8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto',
                            transition: 'all 0.2s',
                            boxShadow: ev?.rating === r ? `0 0 0 2px ${RATING_COLOR[r]}60` : '1px 1px 3px rgba(0,0,0,0.1)',
                          }}
                          title={`Xếp loại: ${RATING_LABEL[r]}`}
                        >
                          {ev?.rating === r ? <CheckCircle size={18} /> : <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'currentColor', opacity: 0.7 }} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 4: THU ĐẢNG PHÍ — Theo Quy định 01-QĐ/TW ngày 03/02/2026
// ═══════════════════════════════════════════════════════════

// Mức lương tối thiểu vùng từ 01/01/2026 (Nghị định 293/2025/NĐ-CP)
const MIN_WAGE: Record<number, number> = { 1: 5310000, 2: 4730000, 3: 4140000, 4: 3700000 };

// Tính mức đảng phí theo loại đảng viên
const calcMonthlyFee = (member: PartyMember, year: number): number => {
  const cat = member.fee_category || 'bhxh';
  const salary = member.salary_base || 0;
  const zone = member.wage_zone || 3;
  const minWage = MIN_WAGE[zone];
  switch (cat) {
    case 'bhxh':                 return Math.round(salary * 0.01);
    case 'pension':              return Math.round(salary * 0.005);
    case 'no_bhxh_under_retire': return Math.round(minWage * (year < 2028 ? 0.003 : 0.005));
    case 'no_bhxh_over_retire':  return Math.round(minWage * (year < 2028 ? 0.002 : 0.003));
    case 'student':              return 5000;
    default:                     return 10000;
  }
};

const FEE_CATEGORY_LABEL: Record<string, string> = {
  bhxh:                  'Có BHXH bắt buộc (1% lương)',
  pension:               'Hưởng lương hưu (0,5% lương hưu)',
  no_bhxh_under_retire:  'Chưa đến tuổi hưu, không BHXH (0,3% LTT vùng)',
  no_bhxh_over_retire:   'Đủ tuổi hưu chưa hưởng (0,2% LTT vùng)',
  student:               'Học sinh/Sinh viên (5.000đ cố định)',
};

const fmtMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

const FeesTab: React.FC = () => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [fees, setFees] = useState<PartyFee[]>([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [feeForm, setFeeForm] = useState<Partial<PartyMember>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [m, f] = await Promise.all([partyDb.getPartyMembers(), partyDb.getPartyFees(year)]);
    setMembers(m.filter(x => x.status !== 'inactive'));
    setFees(f);
    setLoading(false);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const isPaid = (memberId: string, month: number) =>
    fees.some(f => f.member_id === memberId && f.month === month && f.paid_at);

  const getUnpaidCount = (memberId: string) =>
    Array.from({ length: 12 }, (_, i) => i + 1).filter(m => !isPaid(memberId, m)).length;

  const toggleFee = async (member: PartyMember, month: number) => {
    const key = `${member.id}-${month}`;
    if (toggling === key) return;
    setToggling(key);
    const existing = fees.find(f => f.member_id === member.id && f.month === month);
    const paid = isPaid(member.id, month);
    const monthlyFee = calcMonthlyFee(member, year);
    try {
      await partyDb.savePartyFee({
        id: existing?.id,
        member_id: member.id,
        year,
        month,
        amount: monthlyFee,
        paid_at: paid ? null : new Date().toISOString().slice(0, 10),
      });
      setFees(prev => {
        const filtered = prev.filter(f => !(f.member_id === member.id && f.month === month));
        filtered.push({ id: existing?.id || generateUUID(), member_id: member.id, year, month, amount: monthlyFee, paid_at: paid ? null : new Date().toISOString().slice(0, 10) });
        return filtered;
      });
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'danger');
      load();
    } finally { setToggling(null); }
  };

  const handleSaveFeeConfig = async () => {
    if (!editingMember) return;
    try {
      await partyDb.savePartyMember({ ...editingMember, ...feeForm });
      showToast('Đã cập nhật thông tin đảng phí!', 'success');
      setEditingMember(null);
      load();
    } catch (e: any) { showToast(`Lỗi: ${e.message}`, 'danger'); }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalCollected = fees.filter(f => f.paid_at).reduce((s, f) => {
    const mem = members.find(m => m.id === f.member_id);
    const mFee = mem ? calcMonthlyFee(mem, year) : 10000;
    return s + (f.amount || mFee);
  }, 0);
  const totalExpected = members.reduce((s, m) => s + calcMonthlyFee(m, year) * 12, 0);
  const alertMembers = members.filter(m => getUnpaidCount(m.id) >= 3);

  return (
    <>
      {/* Thông tin quy định */}
      <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.78rem', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>📋</span>
        <span>
          <strong>Quy định 01-QĐ/TW (01/02/2026):</strong> Có BHXH = 1% lương | Lương hưu = 0,5% | Không BHXH chưa hưu = 0,3% LTT vùng | Đủ tuổi hưu chưa hưởng = 0,2% | Học sinh = 5.000đ/tháng.{' '}
          <strong style={{ color: '#fca5a5' }}>⚠️ Không đóng 3 tháng trong năm → Chi bộ xem xét và Bí thư thực hiện xóa tên thủ công trong danh sách (hệ thống không tự động xóa).</strong>
        </span>
      </div>

      {/* Thống kê + Chọn năm */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div className="party-stat-card" style={{ flex: '1 1 130px' }}>
          <div className="stat-num" style={{ color: '#22c55e', fontSize: '1.1rem' }}>{fmtMoney(totalCollected)}</div>
          <div className="stat-label">Đã thu được</div>
        </div>
        <div className="party-stat-card" style={{ flex: '1 1 130px' }}>
          <div className="stat-num" style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{fmtMoney(Math.max(0, totalExpected - totalCollected))}</div>
          <div className="stat-label">Còn phải thu</div>
        </div>
        <div className="party-stat-card" style={{ flex: '1 1 90px' }}>
          <div className="stat-num" style={{ color: alertMembers.length > 0 ? '#ef4444' : '#22c55e' }}>{alertMembers.length}</div>
          <div className="stat-label">⚠️ Nợ ≥3 tháng</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>Năm:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Cảnh báo nợ phí */}
      {alertMembers.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', color: '#fca5a5' }}>
          <strong>⚠️ Cảnh báo nợ đảng phí:</strong>{' '}
          {alertMembers.map(m => `${m.full_name} (${getUnpaidCount(m.id)} tháng)`).join(' • ')}
        </div>
      )}

      {/* Chú thích */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={11} color="#22c55e" /> Đã nộp</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><XCircle size={11} color="#475569" /> Chưa nộp — click để đánh dấu đã nộp</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Pencil size={11} color="#60a5fa" /> Nhấn ✏️ để cài mức phí từng đảng viên</span>
      </div>

      {loading ? <div className="no-data">Đang tải...</div> : members.length === 0 ? (
        <div className="no-data"><DollarSign size={36} /><p>Chưa có đảng viên hoạt động nào</p></div>
      ) : (
        <div className="fee-matrix-wrap">
          <table className="fee-table">
            <thead>
              <tr>
                <th className="name-col">Họ và tên</th>
                <th style={{ minWidth: 90, textAlign: 'left' }}>Mức phí/tháng</th>
                {months.map(m => <th key={m}>T{m}</th>)}
                <th>Đã thu</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const paidMonths = months.filter(m => isPaid(member.id, m)).length;
                const monthlyFee = calcMonthlyFee(member, year);
                const totalPaidAmt = fees.filter(f => f.member_id === member.id && f.paid_at).reduce((s, f) => s + (f.amount || monthlyFee), 0);
                const unpaid = getUnpaidCount(member.id);
                const isAlert = unpaid >= 3;
                return (
                  <tr key={member.id} style={{ background: isAlert ? 'rgba(239,68,68,0.05)' : undefined }}>
                    <td className="name-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isAlert && <span title={`Nợ ${unpaid} tháng!`}>⚠️</span>}
                        <span style={{ fontWeight: 600 }}>{member.full_name}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{POSITION_LABEL[member.position]}</div>
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.82rem' }}>{fmtMoney(monthlyFee)}</div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{FEE_CATEGORY_LABEL[member.fee_category || 'bhxh']?.split('(')[0]?.trim()}</div>
                    </td>
                    {months.map(month => {
                      const paid = isPaid(member.id, month);
                      const key = `${member.id}-${month}`;
                      return (
                        <td key={month}>
                          <button className={`fee-cell-btn ${paid ? 'paid' : 'unpaid'}`}
                            onClick={() => toggleFee(member, month)}
                            disabled={toggling === key}
                            title={paid ? `T${month}: Đã nộp ${fmtMoney(monthlyFee)}` : `T${month}: Chưa nộp — click để xác nhận`}
                          >
                            {paid ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: paidMonths === 12 ? '#22c55e' : paidMonths > 0 ? '#f59e0b' : '#ef4444' }}>
                        {paidMonths}/12 tháng
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{fmtMoney(totalPaidAmt)}</div>
                    </td>
                    <td>
                      <button className="party-btn-icon" title="Cài mức phí cho đảng viên này"
                        onClick={() => { setEditingMember(member); setFeeForm({ fee_category: member.fee_category || 'bhxh', salary_base: member.salary_base || 0, wage_zone: member.wage_zone || 3 }); }}>
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal cài mức phí */}
      {editingMember && (
        <div className="party-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingMember(null); }}>
          <div className="party-modal" style={{ maxWidth: 460 }}>
            <div className="party-modal-header">
              <h3>💰 Cài mức đảng phí — {editingMember.full_name}</h3>
              <button className="party-btn-icon" onClick={() => setEditingMember(null)}><X size={18} /></button>
            </div>
            <div className="party-modal-body">
              <div className="party-form-group">
                <label>Loại đảng viên (căn cứ tính đảng phí theo QĐ 01-QĐ/TW)</label>
                <select value={feeForm.fee_category || 'bhxh'} onChange={e => setFeeForm(f => ({ ...f, fee_category: e.target.value as any }))}>
                  <option value="bhxh">Có tham gia BHXH bắt buộc → 1% lương đóng BHXH</option>
                  <option value="pension">Đang hưởng lương hưu → 0,5% lương hưu</option>
                  <option value="no_bhxh_under_retire">Chưa đến tuổi hưu, không có BHXH → 0,3% LTT vùng</option>
                  <option value="no_bhxh_over_retire">Đủ tuổi nghỉ hưu nhưng chưa hưởng → 0,2% LTT vùng</option>
                  <option value="student">Học sinh / Sinh viên → 5.000đ/tháng cố định</option>
                </select>
              </div>

              {(feeForm.fee_category === 'bhxh' || feeForm.fee_category === 'pension') && (
                <div className="party-form-group">
                  <label>{feeForm.fee_category === 'bhxh' ? 'Mức lương đóng BHXH (đ/tháng)' : 'Mức lương hưu (đ/tháng)'}</label>
                  <input type="number" step={100000}
                    value={feeForm.salary_base || ''}
                    onChange={e => setFeeForm(f => ({ ...f, salary_base: parseInt(e.target.value) || 0 }))}
                    placeholder="VD: 6000000" />
                  <span style={{ fontSize: '0.72rem', color: '#60a5fa', marginTop: 2 }}>
                    → Đảng phí tính được: <strong>{fmtMoney(calcMonthlyFee({ ...editingMember, ...feeForm, salary_base: feeForm.salary_base || 0 } as PartyMember, year))}/tháng</strong>
                  </span>
                </div>
              )}

              {(feeForm.fee_category === 'no_bhxh_under_retire' || feeForm.fee_category === 'no_bhxh_over_retire') && (
                <div className="party-form-group">
                  <label>Vùng lương tối thiểu (nơi đảng viên sinh hoạt)</label>
                  <select value={feeForm.wage_zone || 3} onChange={e => setFeeForm(f => ({ ...f, wage_zone: parseInt(e.target.value) as any }))}>
                    <option value={1}>Vùng I — 5.310.000đ/tháng (TP Hà Nội, TP.HCM...)</option>
                    <option value={2}>Vùng II — 4.730.000đ/tháng (TP lớn)</option>
                    <option value={3}>Vùng III — 4.140.000đ/tháng (Thị xã, huyện tỉnh lỵ)</option>
                    <option value={4}>Vùng IV — 3.700.000đ/tháng (Nông thôn, miền núi)</option>
                  </select>
                  <span style={{ fontSize: '0.72rem', color: '#60a5fa', marginTop: 2 }}>
                    → Đảng phí: <strong>{fmtMoney(calcMonthlyFee({ ...editingMember, ...feeForm } as PartyMember, year))}/tháng</strong>
                    <em style={{ color: '#94a3b8', marginLeft: 4 }}>({year < 2028 ? 'mức 2026-2027' : 'mức từ 2028'})</em>
                  </span>
                </div>
              )}

              {feeForm.fee_category === 'student' && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.82rem', color: '#86efac' }}>
                  ✅ Học sinh/Sinh viên: Mức cố định <strong>5.000đ/tháng</strong> theo quy định Đảng.
                </div>
              )}
            </div>
            <div className="party-modal-footer">
              <button className="btn-cancel" onClick={() => setEditingMember(null)}>Hủy</button>
              <button className="party-btn-primary" onClick={handleSaveFeeConfig}>💾 Lưu cài đặt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PartyCell;
