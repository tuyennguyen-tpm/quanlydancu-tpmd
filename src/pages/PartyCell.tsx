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
          background: linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(239,68,68,0.08) 100%);
          border: 1px solid rgba(220,38,38,0.25);
          border-radius: 14px 14px 0 0;
          padding: 18px 24px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .party-title-group h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fff;
          margin: 6px 0 2px;
          letter-spacing: -0.3px;
        }
        .party-title-group p { font-size: 0.8rem; color: #94a3b8; margin: 0; }
        .party-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(220,38,38,0.2);
          color: #f87171;
          border: 1px solid rgba(220,38,38,0.4);
          border-radius: 6px;
          padding: 3px 10px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .party-tabs {
          display: flex;
          gap: 0;
          background: rgba(15,23,42,0.6);
          border-left: 1px solid rgba(220,38,38,0.2);
          border-right: 1px solid rgba(220,38,38,0.2);
          overflow-x: auto;
        }
        .party-tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 18px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .party-tab-btn:hover { color: #f87171; background: rgba(220,38,38,0.06); }
        .party-tab-btn.active { color: #f87171; border-bottom-color: #dc2626; background: rgba(220,38,38,0.08); }

        .party-content {
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(220,38,38,0.2);
          border-top: none;
          border-radius: 0 0 14px 14px;
          padding: 20px;
          min-height: 400px;
        }

        /* ── Stats row ── */
        .party-stats { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
        .party-stat-card {
          flex: 1; min-width: 100px;
          background: rgba(30,41,59,0.7);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 16px;
          text-align: center;
        }
        .party-stat-card .stat-num { font-size: 1.6rem; font-weight: 800; color: #f87171; }
        .party-stat-card .stat-label { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }

        /* ── Table ── */
        .party-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
        .party-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .party-table th {
          background: rgba(220,38,38,0.12);
          color: #f87171;
          font-weight: 700;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 14px;
          text-align: left;
          white-space: nowrap;
        }
        .party-table td { padding: 10px 14px; color: #e2e8f0; border-top: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .party-table tr:hover td { background: rgba(220,38,38,0.05); }

        /* ── Buttons ── */
        .party-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: white; border: none; border-radius: 8px;
          padding: 8px 16px; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .party-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220,38,38,0.4); }
        .party-btn-icon {
          background: none; border: none; cursor: pointer;
          padding: 5px; border-radius: 6px; transition: all 0.2s;
          color: #64748b;
        }
        .party-btn-icon:hover { background: rgba(220,38,38,0.12); color: #f87171; }
        .party-btn-icon.delete:hover { background: rgba(239,68,68,0.12); color: #ef4444; }

        /* ── Status badges ── */
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700;
          white-space: nowrap;
        }

        /* ── Modal ── */
        .party-modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .party-modal {
          background: #1e293b;
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 16px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 25px 60px rgba(0,0,0,0.6);
          animation: fadeIn 0.2s ease;
        }
        .party-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 18px 22px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .party-modal-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #fff; }
        .party-modal-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
        .party-modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 14px 22px 18px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .party-form-group { display: flex; flex-direction: column; gap: 5px; }
        .party-form-group label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; }
        .party-form-group input,
        .party-form-group select,
        .party-form-group textarea {
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; color: #fff; padding: 9px 12px;
          font-size: 0.85rem; outline: none; width: 100%; box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .party-form-group input:focus,
        .party-form-group select:focus,
        .party-form-group textarea:focus { border-color: rgba(220,38,38,0.5); }
        .party-form-group textarea { resize: vertical; min-height: 80px; }
        .party-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .party-form-group select option { background: #1e293b; }

        .btn-cancel {
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 8px; padding: 8px 16px;
          font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-cancel:hover { background: rgba(255,255,255,0.12); color: #fff; }

        /* ── Fee matrix ── */
        .fee-matrix-wrap { overflow-x: auto; }
        .fee-table { border-collapse: collapse; font-size: 0.78rem; min-width: 700px; width: 100%; }
        .fee-table th { background: rgba(220,38,38,0.12); color: #f87171; font-weight: 700; padding: 8px 10px; text-align: center; border: 1px solid rgba(255,255,255,0.06); font-size: 0.7rem; }
        .fee-table th.name-col { text-align: left; min-width: 140px; }
        .fee-table td { padding: 7px 10px; border: 1px solid rgba(255,255,255,0.04); text-align: center; color: #e2e8f0; vertical-align: middle; }
        .fee-table td.name-col { text-align: left; font-weight: 600; color: #fff; white-space: nowrap; }
        .fee-cell-btn {
          width: 28px; height: 28px; border-radius: 6px; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; margin: auto;
          transition: all 0.2s;
        }
        .fee-cell-btn.paid { background: rgba(34,197,94,0.15); color: #22c55e; }
        .fee-cell-btn.unpaid { background: rgba(255,255,255,0.05); color: #475569; }
        .fee-cell-btn:hover { transform: scale(1.15); }

        /* ── Progress bar ── */
        .rating-bar { height: 6px; border-radius: 3px; margin-top: 3px; transition: width 0.5s ease; }

        /* ── Search ── */
        .party-search {
          position: relative; flex: 1;
        }
        .party-search input {
          width: 100%; padding: 8px 12px 8px 36px;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; color: #fff; font-size: 0.82rem; outline: none;
          box-sizing: border-box;
        }
        .party-search input:focus { border-color: rgba(220,38,38,0.4); }
        .party-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; }

        .party-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .no-data { text-align: center; color: #64748b; padding: 40px 20px; font-size: 0.88rem; }
        .no-data svg { margin: 0 auto 12px; display: block; opacity: 0.4; }
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
    try {
      const payload: Omit<PartyMember, 'created_at'> = {
        id: editing?.id || generateUUID(),
        full_name: form.full_name!.trim(),
        party_code: form.party_code || '',
        join_date: form.join_date || '',
        probation_date: form.probation_date || '',
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

  const filteredResidents = residents.filter(r =>
    r.full_name.toLowerCase().includes(residentSearch.toLowerCase())
  ).slice(0, 6);

  return (
    <>
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
        <button className="party-btn-primary" onClick={openAdd}><Plus size={15} />Thêm Đảng viên</button>
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
                <th>Trạng thái</th>
                <th>Ghi chú</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: '#64748b' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{m.full_name}</td>
                  <td style={{ color: '#94a3b8' }}>{m.party_code || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}>
                      {POSITION_LABEL[m.position] || m.position}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{fmtDate(m.join_date)}</td>
                  <td>
                    <span className="status-badge" style={{ background: `${STATUS_COLOR[m.status]}20`, color: STATUS_COLOR[m.status], border: `1px solid ${STATUS_COLOR[m.status]}40` }}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
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
                  <label>Ngày kết nạp (dự bị)</label>
                  <input type="date" value={form.probation_date || ''} onChange={e => setForm(f => ({ ...f, probation_date: e.target.value }))} />
                </div>
                <div className="party-form-group">
                  <label>Ngày vào Đảng (chính thức)</label>
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
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
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
                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📅 {fmtDate(m.date)}{m.time ? ` — ${m.time}` : ''}</span>
                    {m.location && <span>📍 {m.location}</span>}
                    <span>👥 {m.attendance_count} đảng viên tham dự</span>
                  </div>
                  {m.content && <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{m.content}</div>}
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
          <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>Năm:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          Đã đánh giá <strong style={{ color: '#f87171' }}>{rated}/{total}</strong> đảng viên
        </span>
      </div>

      {/* Rating summary */}
      {rated > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
            <div key={r} style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${RATING_COLOR[r]}30`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: RATING_COLOR[r] }}>{ratingCounts[r]}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{RATING_LABEL[r]}</div>
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
                    <td style={{ color: '#64748b' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{m.full_name}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{POSITION_LABEL[m.position]}</td>
                    {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
                      <td key={r}>
                        <button
                          onClick={() => handleRate(m, r)}
                          disabled={isSaving}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                            background: ev?.rating === r ? `${RATING_COLOR[r]}25` : 'rgba(255,255,255,0.04)',
                            color: ev?.rating === r ? RATING_COLOR[r] : '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto',
                            transition: 'all 0.2s',
                            boxShadow: ev?.rating === r ? `0 0 0 2px ${RATING_COLOR[r]}60` : 'none',
                          }}
                          title={`Xếp loại: ${RATING_LABEL[r]}`}
                        >
                          {ev?.rating === r ? <CheckCircle size={16} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: 0.4 }} />}
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
// TAB 4: THU ĐẢNG PHÍ
// ═══════════════════════════════════════════════════════════
const FeesTab: React.FC = () => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [fees, setFees] = useState<PartyFee[]>([]);
  const [year, setYear] = useState(currentYear);
  const [feeAmount, setFeeAmount] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, f] = await Promise.all([partyDb.getPartyMembers(), partyDb.getPartyFees(year)]);
    setMembers(m.filter(m => m.status !== 'inactive'));
    setFees(f);
    setLoading(false);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const isPaid = (memberId: string, month: number) =>
    fees.some(f => f.member_id === memberId && f.month === month && f.paid_at);

  const toggleFee = async (member: PartyMember, month: number) => {
    const key = `${member.id}-${month}`;
    if (toggling === key) return;
    setToggling(key);
    const existing = fees.find(f => f.member_id === member.id && f.month === month);
    const paid = isPaid(member.id, month);
    try {
      await partyDb.savePartyFee({
        id: existing?.id,
        member_id: member.id,
        year,
        month,
        amount: feeAmount,
        paid_at: paid ? null : new Date().toISOString().slice(0, 10),
      });
      // Optimistic update
      setFees(prev => {
        const filtered = prev.filter(f => !(f.member_id === member.id && f.month === month));
        filtered.push({
          id: existing?.id || generateUUID(),
          member_id: member.id,
          year,
          month,
          amount: feeAmount,
          paid_at: paid ? null : new Date().toISOString().slice(0, 10),
        });
        return filtered;
      });
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'danger');
      load();
    } finally {
      setToggling(null);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalPaid = fees.filter(f => f.paid_at).length;
  const totalAmount = totalPaid * feeAmount;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>Năm:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>Mức phí/tháng:</label>
          <input type="number" step={1000} value={feeAmount}
            onChange={e => setFeeAmount(parseInt(e.target.value) || 10000)}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: '0.82rem', outline: 'none', width: 100 }} />
          <span style={{ color: '#64748b', fontSize: '0.78rem' }}>đ</span>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>
            {new Intl.NumberFormat('vi-VN').format(totalAmount)}đ đã thu
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{totalPaid} lượt / {members.length * 12} tổng</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '0.75rem', color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} color="#22c55e" /> Đã nộp</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12} color="#475569" /> Chưa nộp</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} color="#f59e0b" /> (click để thay đổi)</span>
      </div>

      {loading ? <div className="no-data">Đang tải...</div> : members.length === 0 ? (
        <div className="no-data"><DollarSign size={36} /><p>Chưa có đảng viên hoạt động nào</p></div>
      ) : (
        <div className="fee-matrix-wrap">
          <table className="fee-table">
            <thead>
              <tr>
                <th className="name-col">Đảng viên</th>
                {months.map(m => <th key={m}>T{m}</th>)}
                <th>Đã nộp</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const paidCount = months.filter(m => isPaid(member.id, m)).length;
                return (
                  <tr key={member.id}>
                    <td className="name-col">
                      <div>{member.full_name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{POSITION_LABEL[member.position]}</div>
                    </td>
                    {months.map(month => {
                      const paid = isPaid(member.id, month);
                      const key = `${member.id}-${month}`;
                      return (
                        <td key={month}>
                          <button
                            className={`fee-cell-btn ${paid ? 'paid' : 'unpaid'}`}
                            onClick={() => toggleFee(member, month)}
                            disabled={toggling === key}
                            title={paid ? `Tháng ${month}: Đã nộp` : `Tháng ${month}: Chưa nộp — click để xác nhận`}
                          >
                            {paid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: paidCount === 12 ? '#22c55e' : paidCount > 0 ? '#f59e0b' : '#64748b',
                        fontSize: '0.82rem',
                      }}>{paidCount}/12</span>
                    </td>
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

export default PartyCell;
