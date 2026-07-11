import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import ExcelJS from 'exceljs';
import { partyDb, generateUUID } from '../services/db';
import type { PartyMember, PartyMeeting, PartyEvaluation, PartyFee } from '../services/db';
import { db } from '../services/db';
import type { Resident, Household } from '../types';
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
  party_213: 'Đảng viên 213',
  deceased: 'Đã mất'
};
const STATUS_COLOR: Record<string, string> = {
  official: '#22c55e',
  probation: '#f59e0b',
  inactive: '#64748b',
  party_213: '#f43f5e',
  deceased: '#94a3b8'
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
  if (d.includes('-')) {
    const parts = d.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const day = dt.getDate().toString().padStart(2, '0');
  const month = (dt.getMonth() + 1).toString().padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const currentYear = new Date().getFullYear();

// ─── Component chính ─────────────────────────────────────────
const PartyCell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'meetings' | 'evaluations' | 'fees'>('members');
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'mat_tran');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'bi_thu' && currentRole !== 'admin');
  const canPrintExport = currentRole !== 'demo' && localStorage.getItem('guest_mode') !== 'true';

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'mat_tran');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

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
        {activeTab === 'members' && <MembersTab isGuest={isGuest} />}
        {activeTab === 'meetings' && <MeetingsTab isGuest={isGuest} />}
        {activeTab === 'evaluations' && <EvaluationsTab isGuest={isGuest} />}
        {activeTab === 'fees' && <FeesTab isGuest={isGuest} />}
      </div>

      <style>{`
        .party-cell-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .party-header {
          background: linear-gradient(135deg, #fff1f2 0%, #fffbeb 100%);
          border: 1.5px solid rgba(239, 68, 68, 0.15);
          border-bottom: 3.5px solid #b91c1c;
          border-radius: 16px 16px 0 0;
          padding: 24px 28px 22px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 4px 15px rgba(185, 28, 28, 0.03);
        }
        .party-title-group h2 {
          font-size: 1.6rem;
          font-weight: 850;
          color: #991b1b;
          margin: 6px 0 3px;
          letter-spacing: -0.3px;
        }
        .party-title-group p { 
          font-size: 0.9rem; 
          color: #78350f; 
          margin: 0; 
          font-weight: 600; 
        }
        .party-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #b91c1c;
          color: #ffffff;
          border: 1px solid #dc2626;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 1.2px;
          box-shadow: 0 2px 6px rgba(185, 28, 28, 0.2);
        }

        .party-tabs {
          display: flex;
          gap: 0;
          background: #ffffff;
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          border-bottom: 3px solid #b91c1c;
          overflow-x: auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.01);
        }
        .party-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 15px 24px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.25s ease;
          white-space: nowrap;
        }
        .party-tab-btn:hover { 
          color: #b91c1c; 
          background: rgba(185, 28, 28, 0.02); 
        }
        .party-tab-btn.active { 
          color: #b91c1c; 
          border-bottom-color: #b91c1c; 
          background: rgba(185, 28, 28, 0.05); 
        }

        .party-content {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 16px 16px;
          padding: 28px;
          min-height: 450px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
        }

        /* ── Stats row ── */
        .party-stats { 
          display: flex; 
          gap: 16px; 
          margin-bottom: 24px; 
          flex-wrap: wrap; 
        }
        .party-stat-card {
          flex: 1; 
          min-width: 120px;
          background: linear-gradient(135deg, #ffffff 0%, #fefcfb 100%);
          border: 1.5px solid rgba(217, 119, 6, 0.12);
          border-radius: 14px;
          padding: 16px 20px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .party-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(185, 28, 28, 0.04);
        }
        .party-stat-card .stat-num { 
          font-size: 2.2rem; 
          font-weight: 900; 
          color: #b91c1c; 
          line-height: 1;
        }
        .party-stat-card .stat-label { 
          font-size: 0.82rem; 
          color: #475569; 
          margin-top: 6px; 
          font-weight: 700; 
        }

        /* ── Table ── */
        .party-table-wrap { 
          overflow: auto; 
          max-height: calc(100vh - 300px);
          border-radius: 12px; 
          border: 1px solid #e2e8f0; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.01);
        }
        .party-table { 
          width: 100%; 
          min-width: 1100px; 
          border-collapse: collapse; 
          font-size: 0.9rem; 
        }
        .party-table th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc;
          color: #475569;
          font-weight: 800;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 14px 16px;
          text-align: left;
          white-space: nowrap;
          box-shadow: inset 0 -2px 0 #e2e8f0;
        }
        .party-table td { 
          padding: 14px 16px; 
          color: #1e293b; 
          border-top: 1px solid #f1f5f9; 
          vertical-align: middle; 
        }
        .party-table tr:hover td { 
          background: #f8fafc; 
        }

        /* ── Buttons ── */
        .party-btn-primary {
          display: inline-flex; 
          align-items: center; 
          gap: 6px;
          background: linear-gradient(135deg, #b91c1c, #991b1b);
          color: white; 
          border: none; 
          border-radius: 8px;
          padding: 10px 22px; 
          font-size: 0.88rem; 
          font-weight: 750;
          cursor: pointer; 
          transition: all 0.25s ease;
          box-shadow: 0 4px 12px rgba(185, 28, 28, 0.2);
        }
        .party-btn-primary:hover { 
          transform: translateY(-1px); 
          box-shadow: 0 6px 16px rgba(185, 28, 28, 0.3); 
        }
        .party-btn-icon {
          background: none; 
          border: none; 
          cursor: pointer;
          padding: 7px; 
          border-radius: 8px; 
          transition: all 0.2s ease;
          color: #64748b;
        }
        .party-btn-icon:hover { 
          background: #fee2e2; 
          color: #b91c1c; 
        }
        .party-btn-icon.delete:hover { 
          background: #fef2f2; 
          color: #ef4444; 
        }

        /* ── Status badges ── */
        .status-badge {
          display: inline-flex; 
          align-items: center; 
          gap: 5px;
          padding: 5px 12px; 
          border-radius: 6px; 
          font-size: 0.78rem; 
          font-weight: 800;
          white-space: nowrap;
        }

        /* ── Modal ── */
        .party-modal-overlay {
          position: fixed; 
          inset: 0; 
          z-index: 10000;
          background: rgba(15, 23, 42, 0.6); 
          backdrop-filter: blur(6px);
          display: flex; 
          align-items: center; 
          justify-content: center; 
          padding: 20px;
        }
        .party-modal {
          background: #ffffff;
          border: 1.5px solid rgba(185, 28, 28, 0.15);
          border-radius: 16px;
          width: 100%; 
          max-width: 520px;
          max-height: 90vh; 
          overflow-y: auto;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .party-modal-header {
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .party-modal-header h3 { 
          margin: 0; 
          font-size: 1.15rem; 
          font-weight: 800; 
          color: #b91c1c; 
        }
        .party-modal-body { 
          padding: 22px 24px; 
          display: flex; 
          flex-direction: column; 
          gap: 18px; 
        }
        .party-modal-footer {
          display: flex; 
          gap: 12px; 
          justify-content: flex-end;
          padding: 16px 24px 20px;
          border-top: 1px solid #f1f5f9;
        }

        .party-form-group { 
          display: flex; 
          flex-direction: column; 
          gap: 6px; 
        }
        .party-form-group label { 
          font-size: 0.8rem; 
          color: #475569; 
          font-weight: 700; 
        }
        .party-form-group input,
        .party-form-group select,
        .party-form-group textarea {
          background: #f8fafc; 
          border: 1.5px solid #e2e8f0;
          border-radius: 8px; 
          color: #1e293b; 
          padding: 10px 14px;
          font-size: 0.9rem; 
          outline: none; 
          width: 100%; 
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .party-form-group input:focus,
        .party-form-group select:focus,
        .party-form-group textarea:focus { 
          border-color: #b91c1c; 
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1); 
        }
        .party-form-group textarea { 
          resize: vertical; 
          min-height: 90px; 
        }
        .party-form-row { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 14px; 
        }
        .party-form-group select option { 
          background: #ffffff; 
          color: #1e293b;
        }

        .btn-cancel {
          background: #f1f5f9; 
          border: 1px solid #e2e8f0;
          color: #475569; 
          border-radius: 8px; 
          padding: 10px 20px;
          font-size: 0.88rem; 
          font-weight: 650; 
          cursor: pointer; 
          transition: all 0.2s ease;
        }
        .btn-cancel:hover { 
          background: #e2e8f0; 
          color: #1e293b; 
        }

        /* ── Fee matrix ── */
        .fee-matrix-wrap { 
          overflow-x: auto; 
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.01);
        }
        .fee-table { 
          border-collapse: collapse; 
          font-size: 0.9rem; 
          min-width: 720px; 
          width: 100%; 
        }
        .fee-table th { 
          background: #f8fafc; 
          color: #475569; 
          font-weight: 800; 
          padding: 12px 10px; 
          text-align: center; 
          border: 1px solid #e2e8f0; 
          font-size: 0.8rem; 
          text-transform: uppercase; 
        }
        .fee-table th.name-col { 
          text-align: left; 
          min-width: 160px; 
          padding-left: 16px;
        }
        .fee-table td { 
          padding: 10px 8px; 
          border: 1px solid #f1f5f9; 
          text-align: center; 
          color: #1e293b; 
          vertical-align: middle; 
        }
        .fee-table td.name-col { 
          text-align: left; 
          font-weight: 700; 
          color: #0f172a; 
          white-space: nowrap; 
          padding-left: 16px;
        }
        .fee-cell-btn {
          width: 32px; 
          height: 32px; 
          border-radius: 8px; 
          border: none; 
          cursor: pointer;
          display: flex; 
          align-items: center; 
          justify-content: center; 
          margin: auto;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .fee-cell-btn.paid { 
          background: #10b981; 
          color: #ffffff; 
          border: 1px solid #059669; 
          box-shadow: 0 2px 6px rgba(16,185,129,0.3); 
        }
        .fee-cell-btn.unpaid { 
          background: #f1f5f9; 
          color: #94a3b8; 
          border: 1px solid #cbd5e1; 
        }
        .fee-cell-btn.paid:hover { 
          background: #059669; 
          transform: scale(1.15); 
        }
        .fee-cell-btn.unpaid:hover { 
          background: #cbd5e1; 
          color: #475569; 
          transform: scale(1.15); 
        }

        /* ── Progress bar ── */
        .rating-bar { 
          height: 6px; 
          border-radius: 3px; 
          margin-top: 5px; 
          transition: width 0.5s ease; 
        }

        /* ── Search ── */
        .party-search {
          position: relative; 
          flex: 1;
        }
        .party-search input {
          width: 100%; 
          padding: 10px 14px 10px 42px;
          background: #ffffff; 
          border: 1.5px solid #cbd5e1;
          border-radius: 8px; 
          color: #1e293b; 
          font-size: 0.9rem; 
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .party-search input::placeholder {
          color: #94a3b8;
          opacity: 1;
        }
        .party-search input:focus { 
          border-color: #b91c1c; 
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1); 
        }
        .party-search-icon { 
          position: absolute; 
          left: 14px; 
          top: 50%; 
          transform: translateY(-50%); 
          color: #94a3b8; 
          pointer-events: none; 
        }

        .party-toolbar { 
          display: flex; 
          gap: 14px; 
          align-items: center; 
          margin-bottom: 22px; 
          flex-wrap: wrap; 
        }
        .no-data { 
          text-align: center; 
          color: #94a3b8; 
          padding: 50px 20px; 
          font-size: 0.92rem; 
        }
        .no-data svg { 
          margin: 0 auto 14px; 
          display: block; 
          opacity: 0.5; 
        }
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .badge-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 600px) {
          .badge-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 1: DANH SÁCH ĐẢNG VIÊN
// ═══════════════════════════════════════════════════════════
const MembersTab: React.FC<{ isGuest: boolean }> = ({ isGuest }) => {
  const currentRole = localStorage.getItem('current_role') || 'mat_tran';
  const canPrintExport = currentRole !== 'demo' && localStorage.getItem('guest_mode') !== 'true';
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const search = useDeferredValue(searchInput);
  const [selectedPartyGroup, setSelectedPartyGroup] = useState<string>('all');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PartyMember | null>(null);
  const [badgeSectionOpen, setBadgeSectionOpen] = useState(false);



  // Form state
  const [form, setForm] = useState<Partial<PartyMember>>({
    position: 'member', status: 'official'
  });
  const [residentSearch, setResidentSearch] = useState('');
  const [showResidentDrop, setShowResidentDrop] = useState(false);
  const [partySecretaryName, setPartySecretaryName] = useState(() => {
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const biThu = sigs.find((s: {id:string;name:string}) => s.id === 'bi_thu');
      if (biThu?.name?.trim()) return biThu.name.trim();
    } catch { /* ignore */ }
    return localStorage.getItem('party_secretary_name') || '';
  });

  useEffect(() => {
    if (!localStorage.getItem('party_secretary_name') && members.length > 0) {
      const sec = members.find(m => m.position === 'secretary');
      if (sec) {
        setPartySecretaryName(sec.full_name);
      }
    }
  }, [members]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r, h] = await Promise.all([
        partyDb.getPartyMembers(), 
        db.getResidents(),
        db.getHouseholds()
      ]);
      
      // 1. Clean in-memory instantly (takes < 1ms)
      const corrupted: PartyMember[] = [];
      const cleanedMembers = m.map((member) => {
        let needsUpdate = false;
        let code = member.party_code || '';
        const isInvalid = code.includes('GMT') || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(code) || /^\d{4}-\d{2}-\d{2}/.test(code);
        if (isInvalid) {
          code = '';
          needsUpdate = true;
        }

        let notes = member.notes || '';
        if (notes.trim() === '3') {
          notes = '';
          needsUpdate = true;
        }

        if (needsUpdate) {
          const cleaned = { ...member, party_code: code, notes };
          corrupted.push(cleaned);
          return cleaned;
        }
        return member;
      });

      setMembers(cleanedMembers);
      setResidents(r);
      setHouseholds(h);
      setLoading(false);

      // 2. Background cleanup in database (sequential, non-blocking to UI)
      if (corrupted.length > 0) {
        (async () => {
          for (const member of corrupted) {
            try {
              await partyDb.savePartyMember(member);
            } catch (err) {
              console.error('Background cleanup failed for member:', member.full_name, err);
            }
          }
        })();
      }
    } catch (err) {
      console.error('Load failed:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ position: 'member', status: 'official', party_group: '' });
    setResidentSearch('');
    setShowModal(true);
  };
  const openEdit = (m: PartyMember) => {
    setEditing(m);
    const res = residents.find(r => r.id === m.resident_id);
    setResidentSearch(res ? res.full_name : '');
    
    const inheritedGroup = getMemberPartyGroup(m);
    setForm({
      ...m,
      party_group: m.party_group || (inheritedGroup !== 'Chưa phân tổ' ? inheritedGroup : '')
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
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
      let rId = form.resident_id || null;
      if (!rId) {
        const cleanFormName = form.full_name!.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
        const matchedRes = residents.find(r => r.full_name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim() === cleanFormName);
        if (matchedRes) {
          rId = matchedRes.id;
        }
      }

      const payload: Omit<PartyMember, 'created_at'> & { created_at?: string } = {
        id: editing?.id || generateUUID(),
        full_name: form.full_name!.trim(),
        party_code: form.party_code || '',
        join_date: form.join_date || undefined,
        probation_date: form.probation_date || undefined,
        position: form.position || 'member',
        status: form.status || 'official',
        resident_id: rId,
        is_exempt_party_activities: form.is_exempt_party_activities || false,
        notes: form.notes || '',
        party_group: form.party_group || '',
        fee_category: form.fee_category,
        salary_base: form.salary_base,
        wage_zone: form.wage_zone,
        created_at: editing?.created_at,
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
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
    if (!confirm(`Xóa đảng viên "${m.full_name}"?`)) return;
    await partyDb.deletePartyMember(m.id);
    showToast('Đã xóa đảng viên!', 'success');
    load();
  };

  const handleClearAll = async () => {
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
    const confirmName = prompt('⚠️ CẢNH BÁO CỰC KỲ QUAN TRỌNG:\nHành động này sẽ XÓA SẠCH toàn bộ danh sách đảng viên hiện có!\nHành động này KHÔNG THỂ HOÀN TÁC.\n\nNếu bạn thực sự muốn xóa, hãy gõ chữ "XÓA" vào ô dưới đây để xác nhận:');
    if (confirmName !== 'XÓA') {
      if (confirmName !== null) {
        showToast('Nhập xác nhận sai. Đã hủy thao tác xóa!', 'warning');
      }
      return;
    }
    
    setLoading(true);
    try {
      await partyDb.clearAllPartyMembers();
      showToast('Đã xóa sạch toàn bộ danh sách đảng viên!', 'success');
      await load();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'danger');
      setLoading(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getPositionFromLabel = (lbl: string): string => {
    const val = lbl.trim().toLowerCase();
    if (val.includes('bí thư') && !val.includes('phó')) return 'secretary';
    if (val.includes('phó bí thư')) return 'deputy_secretary';
    return 'member';
  };

  const getStatusFromLabel = (lbl: string): string => {
    const val = lbl.trim().toLowerCase();
    if (val.includes('chính thức')) return 'official';
    if (val.includes('dự bị')) return 'probation';
    if (val.includes('mất') || val.includes('qua đời') || val.includes('tử vong')) return 'deceased';
    if (val.includes('miễn') || val.includes('tạm miễn') || val.includes('không hoạt động') || val.includes('không hđ')) return 'inactive';
    return 'official';
  };

  const getFeeCatFromLabel = (lbl: string): string => {
    const val = lbl.trim().toLowerCase();
    if (val.includes('bắt buộc') || val.includes('bhxh')) return 'bhxh';
    if (val.includes('hưu')) return 'pension';
    if (val.includes('chưa đến tuổi') || val.includes('chưa hưu')) return 'no_bhxh_under_retire';
    if (val.includes('đủ tuổi') || val.includes('chưa có chế độ')) return 'no_bhxh_over_retire';
    if (val.includes('học sinh') || val.includes('sinh viên')) return 'student';
    return 'bhxh';
  };

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'warning');
      return;
    }
    showToast('Đang khởi tạo file Excel...', 'info');

    const tdpName = localStorage.getItem('tdp_name') || 'Nam Sầm Sơn';

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách đảng viên');

      // Title header rows (for premium look)
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `DANH SÁCH ĐẢNG VIÊN CHI BỘ TỔ DÂN PHỐ ${tdpName.toUpperCase()}`;
      titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF991B1B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 35;

      worksheet.mergeCells('A2:M2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Thời gian xuất bản: ${new Date().toLocaleDateString('vi-VN')} - Tổng cộng: ${filtered.length} đảng viên`;
      subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 20;

      // Empty separator row
      worksheet.addRow([]);
      worksheet.getRow(3).height = 10;

      // Headers definition
      const headers = [
        "STT", "Họ và tên", "Ngày tháng năm sinh", "Số thẻ Đảng", "Tổ đảng", "Chức vụ", "Ngày kết nạp dự bị", "Ngày chính thức",
        "Trạng thái", "Loại đảng phí", "Lương/trợ cấp căn cứ (VND)", "Vùng LTT", "Ghi chú"
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;

      headerRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB91C1C' } // Crimson Red
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Segoe UI',
          size: 10.5
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF990000' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Rows data
      filtered.forEach((m, index) => {
        const cleanMName = m.full_name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
        const res = residents.find(r => 
          r.id === m.resident_id || 
          r.full_name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim() === cleanMName
        );
        const dobStr = res && res.dob ? fmtDate(res.dob) : '';

        const addedRow = worksheet.addRow([
          index + 1,
          m.full_name,
          dobStr,
          m.party_code || '',
          getMemberPartyGroup(m),
          POSITION_LABEL[m.position] || m.position,
          m.probation_date ? fmtDate(m.probation_date) : '',
          m.join_date ? fmtDate(m.join_date) : '',
          STATUS_LABEL[m.status] || m.status,
          FEE_CATEGORY_LABEL[m.fee_category || 'bhxh'] || m.fee_category || 'bhxh',
          m.salary_base || 0,
          m.wage_zone || 3,
          m.notes || ''
        ]);

        addedRow.height = 22;

        // Custom cell formats
        const isLeader = m.position === 'secretary' || m.position === 'deputy_secretary';
        addedRow.eachCell((cell, colNumber) => {
          cell.font = {
            name: 'Segoe UI',
            size: 10,
            bold: isLeader && colNumber === 2
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
          
          // Alignments
          if (colNumber === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 2 || colNumber === 5 || colNumber === 11 || colNumber === 13) {
            cell.alignment = { vertical: 'middle', horizontal: colNumber === 11 ? 'right' : 'left' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }

          // Format numbers
          if (colNumber === 11) {
            cell.numFmt = '#,##0';
          }
          if (colNumber === 4) {
            cell.numFmt = '@'; // Force text format for party code
          }

          // Highlight leaders
          if (isLeader) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFBEB' } // light Gold highlight
            };
          }
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx > 12) return;
        let maxLen = colIdx === 0 ? 6 : 12;
        column.values?.forEach((v, rowIdx) => {
          if (rowIdx <= 4) return;
          const valStr = v ? v.toString() : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        column.width = Math.min(Math.max(maxLen + 4, colIdx === 0 ? 6 : 12), 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Danh_sach_Dang_vien_Chi_bo_${tdpName.replace(/\s+/g, '_')}_${currentYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Đã xuất file Excel thành công!', 'success');
    } catch (err: any) {
      showToast(`Lỗi xuất Excel: ${err.message}`, 'danger');
    }
  };

  const handleExportTemplate = async () => {
    showToast('Đang tải mẫu file Excel...', 'info');
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mẫu nhập đảng viên');

      // Instructions block
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'MẪU NHẬP LIỆU DANH SÁCH ĐẢNG VIÊN CHI BỘ';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF0F766E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;

      worksheet.mergeCells('A2:J2');
      const subCell = worksheet.getCell('A2');
      subCell.value = 'Lưu ý: Không thay đổi tiêu đề cột. Ngày nhập dạng DD/MM/YYYY (VD: 24/10/1995). Nhập đúng các trạng thái/chức vụ mẫu.';
      subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE11D48' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 20;

      worksheet.addRow([]);
      worksheet.getRow(3).height = 8;

      const headers = [
        "Họ và tên", "Số thẻ Đảng", "Chức vụ (Bí thư/Phó Bí thư/Đảng viên)", "Ngày kết nạp dự bị (DD/MM/YYYY)", "Ngày chính thức (DD/MM/YYYY)",
        "Trạng thái (Chính thức/Dự bị/Miễn sinh hoạt)", "Loại đảng phí", "Lương hoặc lương hưu căn cứ (VND)", "Vùng lương tối thiểu (1/2/3/4)", "Ghi chú"
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;

      headerRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF374151' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF1F2937' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      const samples = [
        ["Nguyễn Văn A", "DV-0001", "Bí thư", "19/05/2020", "19/05/2021", "Chính thức", "Có BHXH bắt buộc", 6500000, 3, "Chủ trì họp chi bộ"],
        ["Trần Thị B", "DV-0002", "Đảng viên", "01/10/2025", "", "Dự bị", "Học sinh, sinh viên", 0, 3, "Đảng viên dự bị"]
      ];

      samples.forEach(row => {
        const addedRow = worksheet.addRow(row);
        addedRow.height = 22;
        addedRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
          if (colNumber === 1 || colNumber === 10) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (colNumber === 8) cell.numFmt = '#,##0';
          if (colNumber === 2) cell.numFmt = '@';
        });
      });

      worksheet.columns.forEach((column, colIdx) => {
        if (colIdx > 9) return;
        column.width = colIdx === 0 ? 18 : colIdx === 2 ? 18 : colIdx === 6 ? 22 : colIdx === 7 ? 22 : 16;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "Mau_Nhap_Dang_Vien.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Đã tải file Excel mẫu thành công!', 'success');
    } catch (err: any) {
      showToast(`Lỗi tạo mẫu: ${err.message}`, 'danger');
    }
  };

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseInputDate = (dStr?: string) => {
    if (!dStr) return undefined;
    const clean = dStr.trim();
    if (!clean) return undefined;

    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    // If it's DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
      const parts = clean.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }

    // Fallback to standard JS parsing
    const d = new Date(clean);
    if (isNaN(d.getTime())) return undefined;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) {
      showToast('Bạn không có quyền nhập dữ liệu!', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'utf-8');
    }

    reader.onload = async (evt) => {
      try {
        let rows: string[][] = [];

        if (isXlsx) {
          const arrayBuffer = evt.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            showToast('File Excel không có trang tính nào!', 'danger');
            return;
          }
          
          worksheet.eachRow((row) => {
            const firstCellVal = row.getCell(1).value?.toString() || '';
            const secondCellVal = row.getCell(2).value?.toString() || '';
            
            // Skip title, description or notes rows
            if (
              firstCellVal.includes('DANH SÁCH') || 
              firstCellVal.includes('Thời gian') || 
              firstCellVal.includes('Lưu ý') || 
              firstCellVal.includes('MẪU') ||
              (firstCellVal.trim() === '' && secondCellVal.trim() === '')
            ) {
              return;
            }

            // Skip header row
            if (firstCellVal.includes('Họ và tên') || secondCellVal.includes('Họ và tên') || firstCellVal.includes('STT')) {
              return;
            }

            const rowValues: string[] = [];
            for (let c = 1; c <= 12; c++) {
              const cell = row.getCell(c);
              let val = cell.value;
              if (val && typeof val === 'object' && 'result' in val) {
                val = (val as any).result;
              }
              rowValues.push(val !== undefined && val !== null ? val.toString().trim() : '');
            }
            rows.push(rowValues);
          });
        } else {
          const text = evt.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length <= 1) {
            showToast('File CSV trống hoặc không đúng định dạng!', 'danger');
            return;
          }
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols = parseCSVLine(line).map(val => val.replace(/^"|"$/g, '').trim());
            
            // Skip title or header rows
            if (
              cols[0] === 'Họ và tên' || 
              cols[1] === 'Họ và tên' || 
              cols[0] === 'STT' || 
              cols[0].includes('DANH SÁCH') || 
              cols[0].includes('MẪU') || 
              (cols[0] === '' && (!cols[1] || cols[1] === ''))
            ) {
              continue;
            }
            rows.push(cols);
          }
        }

        if (rows.length === 0) {
          showToast('Không tìm thấy dòng dữ liệu nào hợp lệ trong file!', 'danger');
          return;
        }

        const currentMembers = await partyDb.getPartyMembers();
        let addedCount = 0;
        let updatedCount = 0;

        for (const columns of rows) {
          if (columns.length < 1) continue;

          // Check if the first column is a sequence number (STT). If so, offset indices by 1
          const isShifted = /^\d+$/.test(columns[0]) || columns[0] === '';
          const offset = isShifted ? 1 : 0;

          if (columns.length <= offset || !columns[offset]) continue;

          const fullName = columns[offset];
          // columns[offset + 1] is "Ngày tháng năm sinh" (dob). We skip it here as it's saved in residents and not directly in party_members.
          const partyCode = columns[offset + 2] || '';
          
          // Tự động nhận diện cấu trúc tệp mới (13 cột bao gồm STT) hoặc cũ (12 cột bao gồm STT)
          const hasBasePartyCol = columns.length >= (isShifted ? 13 : 12);
          const colIdxOffset = hasBasePartyCol ? 1 : 0;

          const pos = getPositionFromLabel(columns[offset + 3 + colIdxOffset] || 'Đảng viên') as any;
          const probationD = parseInputDate(columns[offset + 4 + colIdxOffset]) || null;
          const joinD = parseInputDate(columns[offset + 5 + colIdxOffset]) || null;
          const stat = getStatusFromLabel(columns[offset + 6 + colIdxOffset] || 'Chính thức') as any;
          const feeCat = getFeeCatFromLabel(columns[offset + 7 + colIdxOffset] || 'Có BHXH bắt buộc') as any;
          const salary = parseInt(columns[offset + 8 + colIdxOffset]) || 0;
          const zone = (parseInt(columns[offset + 9 + colIdxOffset]) || 3) as any;
          const notesStr = columns[offset + 10 + colIdxOffset] || '';

          // Chuẩn hóa tên loại bỏ ký tự tàng hình và Unicode NFC chuẩn
          const cleanNameStr = (str: string) => {
            return (str || '')
              .normalize('NFC')
              .replace(/[\u200B-\u200D\uFEFF]/g, '')
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .trim();
          };

          const cleanFullName = cleanNameStr(fullName);
          const cleanPartyCode = partyCode.trim().replace(/[-\s]/g, '').toLowerCase();

          // Lấy ngày sinh từ Excel để so khớp chính xác
          const excelDob = parseInputDate(columns[offset + 1]);

          const matched = currentMembers.find(m => {
            const dbPartyCode = (m.party_code || '').trim().replace(/[-\s]/g, '').toLowerCase();
            if (cleanPartyCode && dbPartyCode) {
              if (cleanPartyCode === dbPartyCode) return true;
            }
            return cleanNameStr(m.full_name) === cleanFullName;
          });

          // Auto-link to resident_id if not present (sử dụng cả Họ tên và Ngày sinh để tránh trùng tên)
          let rId = matched?.resident_id || null;
          if (!rId) {
            const matchedRes = residents.find(r => {
              const nameMatches = cleanNameStr(r.full_name) === cleanFullName;
              if (!nameMatches) return false;
              if (excelDob && r.dob) {
                return r.dob.trim() === excelDob.trim();
              }
              return true;
            });
            if (matchedRes) {
              rId = matchedRes.id;
            }
          }

          const partyGroupStr = hasBasePartyCol ? (columns[offset + 3] || '') : '';

          // Đồng bộ tự động Tổ đảng sang Tổ tự quản của Hộ khẩu nếu có liên kết
          if (partyGroupStr && rId) {
            const res = residents.find(r => r.id === rId);
            if (res && res.household_id) {
              const hhIdx = households.findIndex(h => h.id === res.household_id);
              if (hhIdx >= 0 && households[hhIdx].self_management_group !== partyGroupStr) {
                const updatedHh = { ...households[hhIdx], self_management_group: partyGroupStr };
                households[hhIdx] = updatedHh;
                await db.saveHousehold(updatedHh);
              }
            }
          }

          await partyDb.savePartyMember({
            id: matched ? matched.id : generateUUID(),
            full_name: fullName,
            party_code: cleanPartyCode,
            position: pos,
            probation_date: probationD || (matched ? matched.probation_date : undefined),
            join_date: joinD || (matched ? matched.join_date : undefined),
            status: stat,
            resident_id: rId,
            party_group: partyGroupStr || (matched ? matched.party_group : ''),
            fee_category: feeCat,
            salary_base: salary,
            wage_zone: [1, 2, 3, 4].includes(zone) ? zone : 3,
            notes: notesStr || (matched ? matched.notes : ''),
            created_at: matched ? matched.created_at : undefined,
          });

          if (matched) {
            updatedCount++;
          } else {
            addedCount++;
          }
        }

        showToast(`Đã nhập thành công! Thêm mới ${addedCount} và cập nhật ${updatedCount} đảng viên.`, 'success');
        load();
      } catch (err: any) {
        showToast(`Lỗi phân tích file: ${err.message}`, 'danger');
      }
    };

    if (e.target) e.target.value = '';
  };

  const [filterMilestones, setFilterMilestones] = useState(false);

  const getPartyAge = (m: PartyMember): number => {
    const dateStr = m.probation_date || m.join_date;
    if (!dateStr) return 0;
    const yr = new Date(dateStr).getFullYear();
    if (isNaN(yr)) return 0;
    return currentYear - yr;
  };
  const getMemberPartyGroup = useCallback((m: PartyMember): string => {
    if (m.party_group?.trim()) return m.party_group.trim();
    const res = residents.find(r => r.id === m.resident_id);
    if (!res) return 'Chưa phân tổ';
    const hh = households.find(h => h.id === res.household_id);
    if (!hh || !hh.self_management_group?.trim()) return 'Chưa phân tổ';
    return hh.self_management_group.trim();
  }, [residents, households]);

  const uniquePartyGroups = useMemo(() => {
    const groups = new Set<string>();
    members.forEach(m => {
      groups.add(getMemberPartyGroup(m));
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [members, getMemberPartyGroup]);

  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    households.forEach(h => {
      if (h.self_management_group?.trim()) {
        groups.add(h.self_management_group.trim());
      }
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [households]);

  const filtered = useMemo(() => members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) ||
                          (m.party_code || '').includes(search);
    if (!matchesSearch) return false;

    if (filterMilestones) {
      const age = getPartyAge(m);
      const milestones = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];
      if (!milestones.includes(age)) return false;
    }

    if (selectedPartyGroup !== 'all') {
      const group = getMemberPartyGroup(m);
      if (group !== selectedPartyGroup) return false;
    }

    return true;
  }), [members, search, filterMilestones, selectedPartyGroup, getMemberPartyGroup]);

  const stats = {
    total: members.filter(m => m.status !== 'deceased').length,
    official: members.filter(m => m.status === 'official').length,
    probation: members.filter(m => m.status === 'probation').length,
    party213: members.filter(m => m.status === 'party_213').length,
  };

  const badgeNominees = members
    .filter(m => m.status !== 'deceased')
    .map(m => {
      const age = getPartyAge(m);
      if (age === 0) return null;
      const milestones = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];
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
    const tdpName = localStorage.getItem('tdp_name') || 'Quảng Giao';
    
    let biThuSigUrl = '';
    try {
      const sigs = JSON.parse(localStorage.getItem('official_signatures') || '[]');
      const biThu = sigs.find((s: {id:string;name:string;signatureUrl?:string}) => s.id === 'bi_thu');
      if (biThu?.signatureUrl?.trim()) biThuSigUrl = biThu.signatureUrl.trim();
    } catch { /* ignore */ }
    
    const rowsHtml = filtered.map((m, idx) => {
      const dateStr = m.probation_date || m.join_date;
      let tuoiDangStr = '—';
      if (dateStr) {
        const yr = new Date(dateStr).getFullYear();
        if (!isNaN(yr)) tuoiDangStr = `${currentYear - yr} năm`;
      }

      // Tự động tính lùi 1 năm từ ngày chính thức nếu ngày kết nạp bị trống
      let probationDateStr = fmtDate(m.probation_date);
      if (probationDateStr === '—' && m.join_date) {
        const joinDt = new Date(m.join_date);
        if (!isNaN(joinDt.getTime())) {
          joinDt.setFullYear(joinDt.getFullYear() - 1);
          probationDateStr = fmtDate(joinDt.toISOString().slice(0, 10));
        }
      }
      
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px;"><strong>${m.full_name}</strong></td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${m.party_code || '—'}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${getMemberPartyGroup(m)}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${probationDateStr}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${fmtDate(m.join_date)}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${STATUS_LABEL[m.status] || m.status}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px;">${tuoiDangStr}</td>
          <td style="border: 1px solid #000; padding: 6px;">${m.notes && m.notes.trim() !== '3' ? m.notes : '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          <style>
            body { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.4; padding: 25px; color: #000; }
            .header-table { width: 100%; border: none; margin-bottom: 25px; border-collapse: collapse; }
            .header-table td { border: none; padding: 0; vertical-align: top; }
            .title { text-align: center; margin-bottom: 20px; }
            .title h2 { margin: 5px 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
            .title p { margin: 5px 0; font-style: italic; font-size: 14pt; }
            .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .main-table th, .main-table td { border: 1px solid #000; padding: 8px 6px; font-size: 13pt; }
            .main-table th { font-weight: bold; background-color: #f2f2f2; text-align: center; text-transform: uppercase; }
            .footer-section { width: 100%; margin-top: 35px; border: none; border-collapse: collapse; }
            .footer-section td { border: none; padding: 0; text-align: center; width: 50%; vertical-align: top; font-size: 14pt; }
            .footer-date { font-style: italic; margin-bottom: 5px; font-size: 14pt; }
            .footer-role { font-weight: bold; margin-bottom: 60px; font-size: 14pt; }
            @media print {
              @page {
                size: A4 portrait;
                margin-top: 20mm;
                margin-bottom: 20mm;
                margin-left: 30mm;
                margin-right: 15mm;
              }
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 45%; text-align: center; line-height: 1.3; font-size: 13pt;">
                <strong>ĐẢNG BỘ PHƯỜNG QUẢNG GIAO</strong><br>
                <strong style="text-decoration: underline;">CHI BỘ TDP ${tdpName.toUpperCase()}</strong>
              </td>
              <td style="width: 55%; text-align: center; line-height: 1.3; font-size: 13pt;">
                <strong>ĐẢNG CỘNG SẢN VIỆT NAM</strong><br>
                <span style="font-size: 12pt; font-style: italic;">Quảng Giao, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
              </td>
            </tr>
          </table>

          <div class="title">
            <h2>DANH SÁCH ĐẢNG VIÊN</h2>
            <p>Chi bộ Tổ dân phố ${tdpName} - Năm ${currentYear}</p>
          </div>

          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 5%;">STT</th>
                <th style="width: 22%;">Họ và tên</th>
                <th style="width: 12%;">Số thẻ Đảng</th>
                <th style="width: 12%;">Tổ đảng</th>
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
                ${biThuSigUrl 
                  ? `<div style="height: 60px; display: flex; align-items: center; justify-content: center; margin: 5px auto;"><img src="${biThuSigUrl}" alt="Chữ ký" style="height: 55px; max-height: 60px; object-fit: contain;" /></div>` 
                  : `<div style="height: 50px;"></div>`
                }
                <div style="font-weight: bold;">${partySecretaryName || 'Nguyễn Kim Tuyến'}</div>
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

  const filteredResidents = residents.filter(r => {
    const cleanR = r.full_name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
    const cleanS = residentSearch.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
    return cleanR.includes(cleanS);
  }).slice(0, 6);

  return (
    <>
      {/* Cảnh báo Huy hiệu Đảng */}
      {badgeNominees.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)', // premium soft red gradient for high contrast
          border: '1.5px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          fontSize: '0.88rem',
          color: '#991b1b', // dark crimson red for AAA readability
          boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.05)'
        }}>
          <div 
            onClick={() => setBadgeSectionOpen(!badgeSectionOpen)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              cursor: 'pointer',
              fontWeight: '700',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>🎖️</span>
              <span>
                Đề nghị nhận Huy hiệu Đảng năm {currentYear}: <span style={{ color: '#dc2626', fontWeight: '800' }}>Có {badgeNominees.length} đồng chí đủ tiêu chuẩn</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.85rem' }}>
              <span>{badgeSectionOpen ? 'Thu nhỏ' : 'Xem chi tiết'}</span>
              <ChevronDown 
                size={16} 
                style={{ 
                  transform: badgeSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                  transition: 'transform 0.25s' 
                }} 
              />
            </div>
          </div>

          {badgeSectionOpen && (
            <div style={{ 
              marginTop: '14px', 
              paddingTop: '14px', 
              borderTop: '1px solid rgba(239, 68, 68, 0.15)',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div className="badge-grid">
                {badgeNominees.map((n, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      background: 'white',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>•</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '750', color: '#1e293b' }}>{n.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>Đủ {n.age} năm tuổi Đảng</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="party-stats">
        <div className="party-stat-card"><div className="stat-num">{stats.total}</div><div className="stat-label">Tổng đảng viên</div></div>
        <div className="party-stat-card"><div className="stat-num" style={{ color: '#22c55e' }}>{stats.official}</div><div className="stat-label">Chính thức</div></div>
        <div className="party-stat-card"><div className="stat-num" style={{ color: '#f59e0b' }}>{stats.probation}</div><div className="stat-label">Dự bị</div></div>
        <div className="party-stat-card"><div className="stat-num" style={{ color: '#f43f5e' }}>{stats.party213}</div><div className="stat-label">Đảng viên 213</div></div>
      </div>

      {/* Cấu hình Bí thư Chi bộ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(251, 191, 36, 0.05) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        borderRadius: '12px',
        marginBottom: '16px',
        fontSize: '0.85rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.1rem' }}>✍️</span>
          <span style={{ fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bí thư Chi bộ:</span>
        </div>
        {isGuest ? (
          <span style={{ fontWeight: '700', color: '#fff', background: '#334155', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {partySecretaryName || 'Nguyễn Kim Tuyến'}
          </span>
        ) : (
          <input
            type="text"
            value={partySecretaryName}
            onChange={(e) => {
              const newVal = e.target.value;
              setPartySecretaryName(newVal);
              localStorage.setItem('party_secretary_name', newVal);
            }}
            placeholder="Nhập tên Bí thư Chi bộ..."
            style={{
              padding: '6px 12px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              width: '240px',
              outline: 'none',
              fontWeight: 'bold',
              color: '#f8fafc',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
            }}
          />
        )}
        <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>
          (Tên này sẽ hiển thị ở phần ký tên cuối danh sách khi in ấn)
        </span>
      </div>

      {/* Toolbar */}
      <div className="party-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="party-search" style={{ minWidth: 260 }}>
            <Search size={15} className="party-search-icon" />
            <input placeholder="Tìm kiếm tên, số thẻ..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          
          <button 
            onClick={() => setFilterMilestones(prev => !prev)}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: filterMilestones ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
              background: filterMilestones ? '#ef4444' : '#ffffff',
              color: filterMilestones ? '#ffffff' : '#1e293b',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            🎖️ {filterMilestones ? 'Đang lọc Huy hiệu (30 - 120 năm)' : 'Lọc Huy hiệu (30 - 120 năm)'}
          </button>

          {/* Bộ lọc Tổ đảng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}>
            <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 'bold' }}>Tổ đảng:</span>
            <select
              value={selectedPartyGroup}
              onChange={e => setSelectedPartyGroup(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: selectedPartyGroup !== 'all' ? '1.5px solid #1d4ed8' : '1.5px solid #cbd5e1',
                background: selectedPartyGroup !== 'all' ? '#2563eb' : '#ffffff',
                color: selectedPartyGroup !== 'all' ? '#ffffff' : '#1e293b',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                height: '38px',
                outline: 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <option value="all" style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>Tất cả các tổ</option>
              {uniquePartyGroups.map(g => (
                <option key={g} value={g} style={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '16px' }}>
        {canPrintExport && (
          <button className="party-btn-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderColor: '#15803d', boxShadow: '0 4px 10px rgba(22,163,74,0.2)' }} onClick={handleExportExcel}>📤 Xuất Excel</button>
        )}
        {!isGuest && (
          <button className="party-btn-primary" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', borderColor: '#0f766e', boxShadow: '0 4px 10px rgba(13,148,136,0.2)' }} onClick={() => fileInputRef.current?.click()}>📥 Nhập Excel</button>
        )}
        {canPrintExport && (
          <button className="party-btn-primary" style={{ background: 'linear-gradient(135deg, #4b5563, #374151)', borderColor: '#374151', boxShadow: '0 4px 10px rgba(75,85,99,0.2)' }} onClick={handleExportTemplate} title="Tải file Excel mẫu để nhập dữ liệu">📄 Tải mẫu</button>
        )}
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv,.xlsx,.xls" onChange={handleImportExcel} />
        
        {canPrintExport && (
          <button className="party-btn-primary" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderColor: '#1d4ed8', boxShadow: '0 4px 10px rgba(37,99,235,0.2)' }} onClick={handlePrint}>🖨️ In danh sách</button>
        )}
        {!isGuest && (
          <button 
            className="party-btn-primary" 
            style={{ 
              background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', 
              borderColor: '#3b82f6', 
              boxShadow: '0 4px 10px rgba(96,165,250,0.2)' 
            }} 
            onClick={openAdd}
          >
            <Plus size={15} />Thêm Đảng viên
          </button>
        )}
        {!isGuest && (
          <button 
            className="party-btn-primary" 
            style={{ 
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)', 
              borderColor: '#b91c1c', 
              boxShadow: '0 4px 10px rgba(220,38,38,0.2)' 
            }} 
            onClick={handleClearAll}
          >
            Xóa danh sách
          </button>
        )}
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
                  <td style={{ color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{m.full_name}</td>
                  <td>{m.party_code || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ 
                      background: m.position === 'secretary' ? '#fee2e2' : m.position === 'deputy_secretary' ? '#fef3c7' : '#f1f5f9', 
                      color: m.position === 'secretary' ? '#991b1b' : m.position === 'deputy_secretary' ? '#b45309' : '#475569', 
                      border: m.position === 'secretary' ? '1px solid #fca5a5' : m.position === 'deputy_secretary' ? '1px solid #fcd34d' : '1px solid #cbd5e1',
                      fontWeight: 'bold'
                    }}>
                      {POSITION_LABEL[m.position] || m.position}
                    </span>
                  </td>
                  <td>{fmtDate(m.join_date)}</td>
                  <td>
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
                              style={{ color: '#d97706', fontSize: '0.92rem', cursor: 'help' }}
                            >
                              🎖️
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: `${STATUS_COLOR[m.status]}15`, color: STATUS_COLOR[m.status], border: `1px solid ${STATUS_COLOR[m.status]}30` }}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                  <td>
                    {!isGuest && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="party-btn-icon" onClick={() => openEdit(m)} title="Sửa"><Pencil size={15} /></button>
                        <button className="party-btn-icon delete" onClick={() => handleDelete(m)} title="Xóa"><Trash2 size={15} /></button>
                      </div>
                    )}
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
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                    {filteredResidents.map(r => (
                      <div
                        key={r.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
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

              <div className="party-form-row">
                <div className="party-form-group">
                  <label>Trạng thái</label>
                  <select value={form.status || 'official'} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="official">Chính thức</option>
                    <option value="probation">Dự bị</option>
                    <option value="inactive">Không hoạt động</option>
                    <option value="party_213">Đảng viên 213 (Nơi cư trú)</option>
                    <option value="deceased">Đã mất</option>
                  </select>
                </div>

                <div className="party-form-group">
                  <label>Tổ đảng (Tổ tự quản)</label>
                  <input
                    list="modal-party-groups"
                    value={form.party_group || ''}
                    onChange={e => setForm(f => ({ ...f, party_group: e.target.value }))}
                    placeholder="Chọn hoặc nhập Tổ đảng..."
                  />
                  <datalist id="modal-party-groups">
                    {availableGroups.map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '10px', marginBottom: '10px' }}>
                <div className="party-form-group" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    id="isExemptCheck"
                    checked={form.is_exempt_party_activities || false} 
                    onChange={e => setForm(f => ({ ...f, is_exempt_party_activities: e.target.checked }))} 
                  />
                  <label htmlFor="isExemptCheck" style={{ cursor: 'pointer', margin: 0 }}>Miễn sinh hoạt Đảng</label>
                </div>

                <div className="party-form-group" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    id="isExemptFeeCheck"
                    checked={form.fee_category === 'exempt'} 
                    onChange={e => setForm(f => ({ ...f, fee_category: e.target.checked ? 'exempt' : 'bhxh' }))} 
                  />
                  <label htmlFor="isExemptFeeCheck" style={{ cursor: 'pointer', margin: 0 }}>Miễn đóng đảng phí</label>
                </div>
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
const MeetingsTab: React.FC<{ isGuest: boolean }> = ({ isGuest }) => {
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
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
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
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
    if (!confirm(`Xóa buổi sinh hoạt "${m.title}"?`)) return;
    await partyDb.deletePartyMeeting(m.id);
    showToast('Đã xóa!', 'success');
    load();
  };

  return (
    <>
      <div className="party-toolbar">
        <div style={{ flex: 1 }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
            <BookOpen size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Tổng cộng <strong style={{ color: '#b91c1c' }}>{meetings.length}</strong> buổi sinh hoạt
          </span>
        </div>
        {!isGuest && (
          <button className="party-btn-primary" onClick={openAdd}><Plus size={15} />Ghi buổi sinh hoạt</button>
        )}
      </div>

      {loading ? <div className="no-data">Đang tải...</div> : meetings.length === 0 ? (
        <div className="no-data"><Calendar size={36} /><p>Chưa có buổi sinh hoạt nào được ghi nhận</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meetings.map(m => (
            <div key={m.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap', fontWeight: 500 }}>
                    <span>📅 {fmtDate(m.date)}{m.time ? ` — ${m.time}` : ''}</span>
                    {m.location && <span>📍 {m.location}</span>}
                    <span>👥 {m.attendance_count} đảng viên tham dự</span>
                  </div>
                  {m.content && <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>{m.content}</div>}
                  {m.resolution && (
                    <div style={{ marginTop: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', color: '#991b1b' }}>
                      <strong>Nghị quyết:</strong> {m.resolution}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!isGuest && (
                    <>
                      <button className="party-btn-icon" onClick={() => openEdit(m)} title="Sửa"><Pencil size={15} /></button>
                      <button className="party-btn-icon delete" onClick={() => handleDelete(m)} title="Xóa"><Trash2 size={15} /></button>
                    </>
                  )}
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
const EvaluationsTab: React.FC<{ isGuest: boolean }> = ({ isGuest }) => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [evals, setEvals] = useState<PartyEvaluation[]>([]);
  const [year, setYear] = useState(currentYear);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const s = search.toLowerCase();
      return m.full_name.toLowerCase().includes(s) || (m.party_code || '').toLowerCase().includes(s);
    });
  }, [members, search]);



  const load = useCallback(async () => {
    const [m, e] = await Promise.all([partyDb.getPartyMembers(), partyDb.getPartyEvaluations(year)]);
    setMembers(m.filter(x => x.status !== 'party_213'));
    setEvals(e);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const getEval = (memberId: string) => evals.find(e => e.member_id === memberId);

  const handleRate = async (member: PartyMember, rating: PartyEvaluation['rating']) => {
    if (isGuest) { showToast('Bạn không có quyền chỉnh xếp loại chi bộ!', 'warning'); return; }
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
    <div style={{
      background: 'rgba(34, 197, 94, 0.06)',
      border: '1px solid rgba(34, 197, 94, 0.15)',
      borderRadius: 12,
      padding: '22px',
      margin: '-14px',
      boxShadow: '0 4px 12px rgba(22,163,74,0.03)'
    }}>
      {/* Selector & stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#374151', fontSize: '0.85rem', fontWeight: 700 }}>Năm:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none', fontWeight: 650 }}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
            Đã đánh giá <strong style={{ color: '#b91c1c' }}>{rated}/{total}</strong> đảng viên
          </span>
        </div>

        {/* Ô tìm kiếm */}
        <div className="party-search" style={{ minWidth: 260, maxWidth: 320 }}>
          <Search size={15} className="party-search-icon" />
          <input placeholder="Tìm kiếm tên, số thẻ..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Rating summary */}
      {rated > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
            <div key={r} style={{ background: '#ffffff', border: `2.5px solid ${RATING_COLOR[r]}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: RATING_COLOR[r] }}>{ratingCounts[r]}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4, fontWeight: 700 }}>{RATING_LABEL[r]}</div>
              <div className="rating-bar" style={{ background: '#f1f5f9', marginTop: 8 }}>
                <div className="rating-bar" style={{ width: total > 0 ? `${(ratingCounts[r] / total) * 100}%` : '0%', background: RATING_COLOR[r] }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <div className="no-data"><Award size={36} /><p>Chưa có đảng viên nào trong danh sách</p></div>
      ) : filteredMembers.length === 0 ? (
        <div className="no-data"><Search size={36} /><p>Không tìm thấy đảng viên phù hợp</p></div>
      ) : (
        <div className="party-table-wrap" style={{ background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <table className="party-table">
            <thead>
              <tr>
                <th>#</th><th>Họ và tên</th><th>Chức vụ</th>
                <th>Xuất sắc</th><th>Hoàn thành tốt</th><th>Hoàn thành</th><th>Không HT</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m, i) => {
                const ev = getEval(m.id);
                const isSaving = saving === m.id;
                return (
                  <tr key={m.id}>
                    <td style={{ color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{m.full_name}</td>
                    <td style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>{POSITION_LABEL[m.position]}</td>
                    {(['excellent', 'good', 'average', 'weak'] as const).map(r => (
                      <td key={r}>
                        <button
                          onClick={() => handleRate(m, r)}
                          disabled={isSaving || isGuest}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', cursor: isSaving ? 'wait' : 'pointer',
                            background: ev?.rating === r ? RATING_COLOR[r] : '#f1f5f9',
                            color: ev?.rating === r ? '#ffffff' : '#94a3b8',
                            border: ev?.rating === r ? `2px solid ${RATING_COLOR[r]}` : '2px solid #cbd5e1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto',
                            transition: 'all 0.2s',
                            boxShadow: ev?.rating === r ? `0 4px 10px ${RATING_COLOR[r]}40` : 'none',
                          }}
                          title={`Xếp loại: ${RATING_LABEL[r]}`}
                        >
                          {ev?.rating === r ? <CheckCircle size={18} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: 0.6 }} />}
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
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAB 4: THU ĐẢNG PHÍ — Theo Quy định 01-QĐ/TW ngày 03/02/2026
// ═══════════════════════════════════════════════════════════

// Mức lương tối thiểu vùng từ 01/01/2026 (Nghị định 293/2025/NĐ-CP)
const MIN_WAGE: Record<number, number> = { 1: 5310000, 2: 4730000, 3: 4140000, 4: 3700000 };

// Tính mức đảng phí theo loại đảng viên
const calcMonthlyFee = (member: PartyMember, year: number): number => {
  if (member.is_exempt_party_activities) return 0; // Miễn sinh hoạt thì không đóng đảng phí
  const cat = member.fee_category || 'bhxh';
  const salary = member.salary_base || 0;
  const zone = member.wage_zone || 3;
  const minWage = MIN_WAGE[zone];
  switch (cat) {
    case 'exempt':               return 0;
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
  exempt:                'Được miễn đóng đảng phí (0đ)',
};

const fmtMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

const FeesTab: React.FC<{ isGuest: boolean }> = ({ isGuest }) => {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [fees, setFees] = useState<PartyFee[]>([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [feeForm, setFeeForm] = useState<Partial<PartyMember>>({});
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const s = search.toLowerCase();
      return m.full_name.toLowerCase().includes(s) || (m.party_code || '').toLowerCase().includes(s);
    });
  }, [members, search]);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, f] = await Promise.all([partyDb.getPartyMembers(), partyDb.getPartyFees(year)]);
    setMembers(m.filter(x => x.status !== 'inactive' && x.status !== 'party_213' && x.status !== 'deceased'));
    setFees(f);
    setLoading(false);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const isPaid = (memberId: string, month: number) =>
    fees.some(f => f.member_id === memberId && f.month === month && f.paid_at);

  const getUnpaidCount = (memberId: string) =>
    Array.from({ length: 12 }, (_, i) => i + 1).filter(m => !isPaid(memberId, m)).length;

  const toggleFee = async (member: PartyMember, month: number) => {
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
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
    if (isGuest) { showToast('Bạn không có quyền chỉnh sửa chi bộ!', 'warning'); return; }
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
  const alertMembers = useMemo(() => {
    return members
      .map(m => ({
        ...m,
        unpaidCount: getUnpaidCount(m.id)
      }))
      .filter(m => m.unpaidCount >= 3)
      .sort((a, b) => {
        if (b.unpaidCount !== a.unpaidCount) {
          return b.unpaidCount - a.unpaidCount;
        }
        return a.full_name.localeCompare(b.full_name, 'vi');
      });
  }, [members, fees, year]);

  return (
    <>
      {/* Thông tin quy định */}
      <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '0.82rem', color: '#78350f', display: 'flex', alignItems: 'flex-start', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>📋</span>
        <span>
          <strong style={{ color: '#b45309' }}>Quy định 01-QĐ/TW (01/02/2026):</strong> Có BHXH = 1% lương | Lương hưu = 0,5% | Không BHXH chưa hưu = 0,3% LTT vùng | Đủ tuổi hưu chưa hưởng = 0,2% | Học sinh = 5.000đ/tháng.{' '}
          <strong style={{ color: '#991b1b' }}>⚠️ Không đóng 3 tháng trong năm → Chi bộ xem xét và Bí thư thực hiện xóa tên thủ công trong danh sách (hệ thống không tự động xóa).</strong>
        </span>
      </div>

      {/* Thống kê + Chọn năm */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div className="party-stat-card" style={{ flex: '1 1 130px' }}>
          <div className="stat-num" style={{ color: '#10b981', fontSize: '1.4rem', fontWeight: 900 }}>{fmtMoney(totalCollected)}</div>
          <div className="stat-label">Đã thu được</div>
        </div>
        <div className="party-stat-card" style={{ flex: '1 1 130px' }}>
          <div className="stat-num" style={{ color: '#d97706', fontSize: '1.4rem', fontWeight: 900 }}>{fmtMoney(Math.max(0, totalExpected - totalCollected))}</div>
          <div className="stat-label">Còn phải thu</div>
        </div>
        <div className="party-stat-card" style={{ flex: '1 1 90px' }}>
          <div className="stat-num" style={{ color: alertMembers.length > 0 ? '#b91c1c' : '#10b981' }}>{alertMembers.length}</div>
          <div className="stat-label">⚠️ Nợ ≥3 tháng</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>Năm:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: 8, padding: '6px 12px', fontSize: '0.85rem', outline: 'none', fontWeight: 650 }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Cảnh báo nợ phí */}
      {alertMembers.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', color: '#991b1b', fontWeight: 650, boxShadow: '0 4px 12px rgba(239,68,68,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowWarningDetails(p => !p)}>
            <span>
              <strong>⚠️ Cảnh báo nợ đảng phí:</strong> Có <strong>{alertMembers.length}</strong> đồng chí chưa nộp đủ từ 3 tháng trở lên trong năm {year}.
            </span>
            <button 
              style={{
                background: 'none',
                border: 'none',
                color: '#b91c1c',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              {showWarningDetails ? 'Ẩn chi tiết ▴' : 'Xem chi tiết ▾'}
            </button>
          </div>
          {showWarningDetails && (
            <div style={{
              marginTop: 10,
              borderTop: '1px solid #fca5a5',
              paddingTop: 10,
              maxHeight: 280,
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
              paddingRight: 4
            }}>
              {alertMembers.map((m, index) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    fontWeight: 650,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <span style={{ color: '#7f1d1d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.full_name}>
                    {index + 1}. {m.full_name}
                  </span>
                  <span style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {m.unpaidCount} tháng
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chú thích & Tìm kiếm */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.8rem', color: '#475569', fontWeight: 600, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} color="#10b981" /> Đã nộp</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12} color="#94a3b8" /> Chưa nộp — click để đánh dấu đã nộp</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={12} color="#2563eb" /> Nhấn ✏️ để cài mức phí từng đảng viên</span>
        </div>

        {/* Ô tìm kiếm */}
        <div className="party-search" style={{ minWidth: 260, maxWidth: 320 }}>
          <Search size={15} className="party-search-icon" />
          <input placeholder="Tìm kiếm tên, số thẻ..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="no-data">Đang tải...</div> : members.length === 0 ? (
        <div className="no-data"><DollarSign size={36} /><p>Chưa có đảng viên hoạt động nào</p></div>
      ) : filteredMembers.length === 0 ? (
        <div className="no-data"><Search size={36} /><p>Không tìm thấy đảng viên phù hợp</p></div>
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
              {filteredMembers.map(member => {
                const paidMonths = months.filter(m => isPaid(member.id, m)).length;
                const monthlyFee = calcMonthlyFee(member, year);
                const totalPaidAmt = fees.filter(f => f.member_id === member.id && f.paid_at).reduce((s, f) => s + (f.amount || monthlyFee), 0);
                const unpaid = getUnpaidCount(member.id);
                const isAlert = unpaid >= 3;
                return (
                  <tr key={member.id} style={{ background: isAlert ? 'rgba(239,68,68,0.03)' : undefined }}>
                    <td className="name-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isAlert && <span title={`Nợ ${unpaid} tháng!`}>⚠️</span>}
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{member.full_name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, fontWeight: 550 }}>{POSITION_LABEL[member.position]}</div>
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.88rem' }}>{fmtMoney(monthlyFee)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2, fontWeight: 500 }}>{FEE_CATEGORY_LABEL[member.fee_category || 'bhxh']?.split('(')[0]?.trim()}</div>
                    </td>
                    {months.map(month => {
                      const paid = isPaid(member.id, month);
                      const key = `${member.id}-${month}`;
                      return (
                        <td key={month}>
                          <button className={`fee-cell-btn ${paid ? 'paid' : 'unpaid'}`}
                            onClick={() => toggleFee(member, month)}
                            disabled={toggling === key || isGuest}
                            title={paid ? `T${month}: Đã nộp ${fmtMoney(monthlyFee)}` : `T${month}: Chưa nộp — click để xác nhận`}
                          >
                            {paid ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: paidMonths === 12 ? '#4ade80' : paidMonths > 0 ? '#f59e0b' : '#f87171' }}>
                        {paidMonths}/12 tháng
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: 2, fontWeight: 600 }}>{fmtMoney(totalPaidAmt)}</div>
                    </td>
                    <td>
                      {!isGuest && (
                        <button className="party-btn-icon" title="Cài mức phí cho đảng viên này"
                          onClick={() => { setEditingMember(member); setFeeForm({ fee_category: member.fee_category || 'bhxh', salary_base: member.salary_base || 0, wage_zone: member.wage_zone || 3 }); }}>
                          <Pencil size={13} />
                        </button>
                      )}
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
                  <option value="exempt">Được miễn đóng đảng phí → 0đ/tháng</option>
                </select>
              </div>

              {(feeForm.fee_category === 'bhxh' || feeForm.fee_category === 'pension') && (
                <div className="party-form-group">
                  <label>{feeForm.fee_category === 'bhxh' ? 'Mức lương đóng BHXH (đ/tháng)' : 'Mức lương hưu (đ/tháng)'}</label>
                  <input type="text"
                    value={feeForm.salary_base ? new Intl.NumberFormat('vi-VN').format(feeForm.salary_base) : ''}
                    onChange={e => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setFeeForm(f => ({ ...f, salary_base: parseInt(clean) || 0 }));
                    }}
                    placeholder="VD: 6.000.000" />
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
