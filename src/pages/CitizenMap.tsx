import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Home, 
  MapPin, 
  X, 
  Search, 
  Share2, 
  Users,
  Check,
  LocateFixed,
  Navigation,
  ClipboardPaste,
  Link as LinkIcon
} from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { Household, Resident } from '../types';
import { parseCoordinatesFromText, type ParsedCoordinates } from '../utils/geoUtils';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom pulsing GPS marker icon cho vị trí người dùng
const userGpsIcon = L.divIcon({
  className: 'user-gps-marker',
  html: `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(37, 99, 235, 0.4); animation: gpsPing 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Child component to control map viewport flying/centering
const ChangeView = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1 });
  }, [center, zoom, map]);
  return null;
};

// Child component to capture click events on the map
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

// Child component to automatically recalculate map size and prevent grey/blank map
const MapResizeHandler = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
};

const getMarkerIcon = (type: string, isSelected: boolean = false) => {
  let color = '#2563eb'; // blue
  if (type === 'poor') color = '#ef4444'; // red
  else if (type === 'near_poor') color = '#f59e0b'; // orange
  else if (type === 'policy_family') color = '#6366f1'; // indigo

  const size = isSelected ? 22 : 16;
  const border = isSelected ? '3px solid #facc15' : '2.5px solid white';
  const pulse = isSelected ? 'animation: markerPulse 1.5s infinite;' : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: 0 3px 8px rgba(0,0,0,0.45); transition: all 0.2s; ${pulse}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// MEMOIZED MAP VIEW COMPONENT: TÁCH RIÊNG ĐỂ KHÔNG BỊ RE-RENDER KHI GÕ TÌM KIẾM
// ═════════════════════════════════════════════════════════════════════════════
interface MapViewProps {
  mapLayer: 'street' | 'satellite' | 'terrain';
  defaultPosition: [number, number];
  mapCenter: [number, number];
  mapZoom: number;
  mappedHouseholds: Household[];
  residentMap: Record<string, Resident[]>;
  residentById: Record<string, Resident>;
  isGuest: boolean;
  selectedHouseholdId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onSelectHouseholdId: (id: string) => void;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
  onShareZalo: (h: Household) => void;
  onShareFacebook: (h: Household) => void;
  onOpenGoogleMaps: (h: Household) => void;
  onCopyLocation: (h: Household) => void;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
}

const InteractiveMapView = React.memo(({
  mapLayer,
  defaultPosition,
  mapCenter,
  mapZoom,
  mappedHouseholds,
  residentMap,
  residentById,
  isGuest,
  selectedHouseholdId,
  onMapClick,
  onSelectHouseholdId,
  markerRefs,
  onShareZalo,
  onShareFacebook,
  onOpenGoogleMaps,
  onCopyLocation,
  userLocation
}: MapViewProps) => {
  return (
    <MapContainer center={defaultPosition} zoom={16} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
      {/* Lớp bản đồ 1: Bản đồ đường phố Google Maps (Nét, chi tiết, tải tức thì không bị trắng) */}
      {mapLayer === 'street' && (
        <TileLayer
          key="google-street"
          attribution='&copy; Google Maps'
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />
      )}

      {/* Lớp bản đồ 2: Vệ tinh Google Hybrid (Ảnh vệ tinh quang học kèm tên đường ngõ xóm) */}
      {mapLayer === 'satellite' && (
        <TileLayer
          key="google-satellite"
          attribution='&copy; Google Maps'
          url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />
      )}

      {/* Lớp bản đồ 3: Bản đồ Địa hình Google Maps (Đúng như ảnh số 2 của bạn) */}
      {mapLayer === 'terrain' && (
        <TileLayer
          key="google-terrain"
          attribution='&copy; Google Maps'
          url="https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />
      )}

      <ChangeView center={mapCenter} zoom={mapZoom} />
      <MapResizeHandler />
      {!isGuest && <MapClickHandler onMapClick={onMapClick} />}
      
      {/* Vị trí GPS của người dùng khi bật theo dõi thực địa */}
      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={Math.max(userLocation.accuracy || 15, 8)}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 1.5,
              dashArray: '4, 4'
            }}
          />
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon} zIndexOffset={1000}>
            <Popup>
              <div style={{ padding: '4px', textAlign: 'center', minWidth: '170px' }}>
                <strong style={{ color: '#2563eb', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span>📍</span> Vị trí GPS của bạn
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#475569' }}>
                  Độ chính xác: <strong>±{Math.round(userLocation.accuracy)}m</strong>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* Render các ghim hộ dân */}
      {mappedHouseholds.map(h => {
        const isSelected = selectedHouseholdId === h.id;
        const head = h.head_of_household_id ? residentById[h.head_of_household_id] : null;
        const headName = head ? head.full_name : 'Chưa rõ chủ hộ';
        const householdMembers = residentMap[h.id] || [];

        return (
          <Marker 
            key={h.id} 
            position={[h.latitude!, h.longitude!]} 
            icon={getMarkerIcon(h.policy_type, isSelected)}
            ref={(el) => {
              if (el) markerRefs.current[h.id] = el;
              else delete markerRefs.current[h.id];
            }}
            eventHandlers={{
              click: () => {
                onSelectHouseholdId(h.id);
              }
            }}
          >
            <Popup>
              <div className="popup-content" style={{ minWidth: '250px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: '800' }}>
                    {headName}
                  </h4>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: '700'
                  }}>
                    {h.policy_type === 'poor' ? 'Hộ nghèo' : h.policy_type === 'near_poor' ? 'Cận nghèo' : h.policy_type === 'policy_family' ? 'Chính sách' : 'Hộ dân'}
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#475569', margin: '3px 0', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                  <MapPin size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#64748b' }} />
                  <span>{h.address || 'Địa bàn TDP'}</span>
                </p>
                
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 6px 0' }}>
                  <strong>Sổ hộ khẩu:</strong> {h.household_number || 'Chưa cập nhật'}
                </p>

                {/* Danh sách thành viên trong hộ */}
                {householdMembers.length > 0 && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    border: '1px solid #e2e8f0',
                    maxHeight: '75px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontWeight: '700', color: '#334155', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} />
                      <span>Thành viên trong hộ ({householdMembers.length}):</span>
                    </div>
                    <div>
                      {householdMembers.map((r, idx) => (
                        <span key={r.id}>
                          {r.full_name} {r.relationship_with_head ? `(${r.relationship_with_head})` : ''}
                          {idx < householdMembers.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tiện ích chia sẻ vị trí & Chỉ đường qua Zalo, Facebook, Google Maps */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '6px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Share2 size={12} color="#2563eb" />
                    <span>Chia sẻ vị trí & Chỉ đường:</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {/* Chia sẻ qua Zalo */}
                    <button
                      type="button"
                      onClick={() => onShareZalo(h)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #0068ff',
                        background: '#0068ff',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Gửi vị trí qua Zalo"
                    >
                      <span>💬 Gửi Zalo</span>
                    </button>

                    {/* Chia sẻ qua Facebook */}
                    <button
                      type="button"
                      onClick={() => onShareFacebook(h)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #1877f2',
                        background: '#1877f2',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Chia sẻ lên Facebook"
                    >
                      <span>🌐 Facebook</span>
                    </button>

                    {/* Google Maps Chỉ đường */}
                    <button
                      type="button"
                      onClick={() => onOpenGoogleMaps(h)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #10b981',
                        background: '#10b981',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Mở chỉ đường Google Maps"
                    >
                      <span>🧭 Chỉ đường</span>
                    </button>

                    {/* Copy Link vị trí */}
                    <button
                      type="button"
                      onClick={() => onCopyLocation(h)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Sao chép link vị trí"
                    >
                      <span>📋 Copy link</span>
                    </button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN CITIZEN MAP PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const CitizenMap = () => {
  const [currentRole, setCurrentRole] = useState(localStorage.getItem('current_role') || 'demo');
  const isGuest = localStorage.getItem('guest_mode') === 'true' || (currentRole !== 'to_truong' && currentRole !== 'admin');

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentRole(customEvent.detail || 'demo');
    };
    window.addEventListener('role-changed', handleRoleChange);
    return () => window.removeEventListener('role-changed', handleRoleChange);
  }, []);

  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  
  // Tọa độ trung tâm mặc định (Phường Nam Sầm Sơn / Quảng Giao)
  const defaultPosition: [number, number] = [19.7420, 105.9230];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultPosition);
  const [mapZoom, setMapZoom] = useState(16);

  // Filter & Click Assign states
  const [policyFilter, setPolicyFilter] = useState<string>('all');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHouseholdToMove, setSelectedHouseholdToMove] = useState<string>('');
  
  // 3 Chế độ xem bản đồ: 'street' (Xem bản đồ), 'satellite' (Xem vệ tinh), 'terrain' (Địa hình)
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'terrain'>('street');
  
  // Search states với useDeferredValue để gõ phím siêu mượt 60fps không giật lag
  const [mapSearchTerm, setMapSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(mapSearchTerm);
  
  const [popupSearchTerm, setPopupSearchTerm] = useState<string>('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // ─── ĐỊNH VỊ GPS THỰC ĐỊA ───
  const [isTrackingGps, setIsTrackingGps] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // ─── NHẬP TỪ ZALO / GOOGLE MAPS ───
  const [showZaloImportModal, setShowZaloImportModal] = useState<boolean>(false);
  const [importInputText, setImportInputText] = useState<string>('');
  const [parsedCoords, setParsedCoords] = useState<ParsedCoordinates | null>(null);
  const [selectedHouseholdForImport, setSelectedHouseholdForImport] = useState<string>('');
  const [importSearchTerm, setImportSearchTerm] = useState<string>('');

  // Lưu trữ tham chiếu các Leaflet Markers để mở Popup theo lập trình
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const loadData = async () => {
    try {
      const [hList, rList] = await Promise.all([
        db.getHouseholds(),
        db.getResidents()
      ]);
      setHouseholds(hList);
      setResidents(rList);

      // Nếu có hộ dân đã ghim tọa độ, tự động căn giữa vào hộ đầu tiên
      const firstPinned = hList.find(h => h.latitude && h.longitude);
      if (firstPinned && firstPinned.latitude && firstPinned.longitude) {
        setMapCenter([firstPinned.latitude, firstPinned.longitude]);
      }
    } catch (e) {
      showToast('Lỗi tải dữ liệu bản đồ!', 'danger');
    }
  };

  const [tdpName, setTdpName] = useState(
    localStorage.getItem('tdp_name') || 'Nam Sầm Sơn'
  );

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      setTdpName(localStorage.getItem('tdp_name') || 'Nam Sầm Sơn');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tdp-name-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tdp-name-changed', handleStorageChange);
    };
  }, []);

  // ─── TỐI ƯU HÓA: PRE-INDEX TRA CỨU DỮ LIỆU NHÂN KHẨU & CHỦ HỘ TRONG BỘ NHỚ O(1) ───
  const { residentMap, residentById } = useMemo(() => {
    const rMap: Record<string, Resident[]> = {};
    const rById: Record<string, Resident> = {};

    for (let i = 0; i < residents.length; i++) {
      const r = residents[i];
      rById[r.id] = r;
      if (r.household_id) {
        if (!rMap[r.household_id]) rMap[r.household_id] = [];
        rMap[r.household_id].push(r);
      }
    }
    return { residentMap: rMap, residentById: rById };
  }, [residents]);

  const getHeadName = useCallback((h: Household) => {
    const head = h.head_of_household_id ? residentById[h.head_of_household_id] : null;
    return head ? head.full_name : 'Chưa rõ chủ hộ';
  }, [residentById]);

  // Tạo cấu trúc Index tìm kiếm sẵn có (Pre-computed Search Index)
  const householdSearchIndex = useMemo(() => {
    return households.map(h => {
      const headName = getHeadName(h);
      const members = residentMap[h.id] || [];
      const memberNames = members.map(m => m.full_name).join(' ');
      const searchTarget = `${headName} ${memberNames} ${h.address || ''} ${h.household_number || ''}`.toLowerCase();

      return {
        household: h,
        headName,
        members,
        searchTarget
      };
    });
  }, [households, residentMap, getHeadName]);

  // Lọc danh sách hộ dân siêu tốc bằng chuỗi tìm kiếm đã Deferred (Chạy < 1ms)
  const filteredIndexedHouseholds = useMemo(() => {
    const s = deferredSearchTerm.trim().toLowerCase();
    if (!s) {
      return householdSearchIndex.map(item => ({
        ...item,
        matchReason: ''
      }));
    }

    return householdSearchIndex
      .filter(item => item.searchTarget.includes(s))
      .map(item => {
        let reason = '';
        if (item.headName.toLowerCase().includes(s)) {
          reason = `Chủ hộ: ${item.headName}`;
        } else {
          const matchedMem = item.members.find(m => m.full_name.toLowerCase().includes(s));
          if (matchedMem) {
            reason = `Có nhân khẩu: ${matchedMem.full_name} (${matchedMem.relationship_with_head || 'Thành viên'})`;
          } else if ((item.household.address || '').toLowerCase().includes(s)) {
            reason = `Địa chỉ: ${item.household.address}`;
          } else if ((item.household.household_number || '').toLowerCase().includes(s)) {
            reason = `Số sổ: ${item.household.household_number}`;
          }
        }
        return {
          ...item,
          matchReason: reason
        };
      });
  }, [householdSearchIndex, deferredSearchTerm]);

  // Gợi ý tìm kiếm nhanh (Tối đa 6 kết quả)
  const searchSuggestions = useMemo(() => {
    if (!deferredSearchTerm.trim()) return [];
    return filteredIndexedHouseholds.slice(0, 6);
  }, [filteredIndexedHouseholds, deferredSearchTerm]);

  // Hộ dân đã có tọa độ hiển thị trên bản đồ (áp dụng cả lọc chính sách)
  const mappedHouseholds = useMemo(() => {
    return households.filter(h => {
      const hasCoords = h.latitude !== null && h.latitude !== undefined && 
                        h.longitude !== null && h.longitude !== undefined;
      const matchesPolicy = policyFilter === 'all' || h.policy_type === policyFilter;
      return hasCoords && matchesPolicy;
    });
  }, [households, policyFilter]);

  // Chọn hộ dân và bay đến vị trí trên bản đồ, tự động bật popup
  const handleSelectHousehold = useCallback((h: Household) => {
    setShowSearchDropdown(false);
    setSelectedHouseholdId(h.id);

    if (h.latitude && h.longitude) {
      setMapCenter([h.latitude, h.longitude]);
      setMapZoom(18);

      setTimeout(() => {
        const marker = markerRefs.current[h.id];
        if (marker) {
          marker.openPopup();
        }
      }, 350);
    } else {
      showToast(`Hộ của ông/bà ${getHeadName(h)} chưa được chấm tọa độ trên bản đồ!`, 'warning');
    }
  }, [getHeadName]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setClickedCoords({ lat, lng });
    setSelectedHouseholdToMove('');
    setPopupSearchTerm('');
  }, []);

  const handleAssignCoordsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickedCoords || !selectedHouseholdToMove) return;

    const hh = households.find(h => h.id === selectedHouseholdToMove);
    if (!hh) return;

    const updated: Household = {
      ...hh,
      latitude: clickedCoords.lat,
      longitude: clickedCoords.lng
    };

    try {
      await db.saveHousehold(updated);
      showToast(`Đã định vị thành công hộ của ${getHeadName(hh)}!`, 'success');
      setClickedCoords(null);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));
    } catch (e) {
      showToast('Lỗi khi lưu tọa độ định vị!', 'danger');
    }
  };

  // ─── CÁC TIỆN ÍCH CHIA SẺ VỊ TRÍ ───
  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const getDirectionsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  const handleOpenGoogleMaps = useCallback((h: Household) => {
    if (!h.latitude || !h.longitude) return;
    window.open(getDirectionsUrl(h.latitude, h.longitude), '_blank');
  }, []);

  const handleShareZalo = useCallback((h: Household) => {
    if (!h.latitude || !h.longitude) return;
    const url = getGoogleMapsUrl(h.latitude, h.longitude);
    const zaloShareUrl = `https://zalo.me/share?url=${encodeURIComponent(url)}`;
    window.open(zaloShareUrl, '_blank', 'width=600,height=520');
  }, []);

  const handleShareFacebook = useCallback((h: Household) => {
    if (!h.latitude || !h.longitude) return;
    const url = getGoogleMapsUrl(h.latitude, h.longitude);
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbShareUrl, '_blank', 'width=600,height=520');
  }, []);

  const handleCopyLocation = useCallback((h: Household) => {
    if (!h.latitude || !h.longitude) return;
    const headName = getHeadName(h);
    const textToCopy = `📍 Vị trí hộ gia đình: ${headName} (${tdpName})\n🏠 Địa chỉ: ${h.address || 'Địa bàn ' + tdpName}\n🧭 Tọa độ: ${h.latitude.toFixed(6)}, ${h.longitude.toFixed(6)}\n🗺️ Xem trên Google Maps (Chỉ đường): ${getDirectionsUrl(h.latitude, h.longitude)}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      showToast('Đã sao chép liên kết vị trí & hướng dẫn chỉ đường!', 'success');
    } else {
      showToast('Trình duyệt không hỗ trợ tự động copy!', 'warning');
    }
  }, [getHeadName, tdpName]);

  // ─── TỰ ĐỘNG PHÂN TÍCH TỌA ĐỘ TỪ LINK ZALO / GOOGLE MAPS KHI DÁN ───
  useEffect(() => {
    if (!importInputText.trim()) {
      setParsedCoords(null);
      return;
    }
    const res = parseCoordinatesFromText(importInputText);
    setParsedCoords(res);
  }, [importInputText]);

  // ─── BẬT / TẮT THEO DÕI GPS THỰC ĐỊA ───
  const toggleGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt hoặc thiết bị của bạn không hỗ trợ định vị GPS!', 'warning');
      return;
    }

    if (isTrackingGps) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingGps(false);
      showToast('Đã tắt định vị GPS thực địa', 'info');
    } else {
      setIsLocating(true);
      showToast('Đang kết nối GPS...', 'info');

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude, accuracy });
          setIsTrackingGps(true);
          setIsLocating(false);
        },
        (err) => {
          console.error('Lỗi Geolocation:', err);
          setIsLocating(false);
          setIsTrackingGps(false);
          if (err.code === err.PERMISSION_DENIED) {
            showToast('Quyền truy cập vị trí bị từ chối. Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt!', 'danger');
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            showToast('Không thể xác định vị trí GPS. Vui lòng kiểm tra GPS trên thiết bị!', 'warning');
          } else {
            showToast('Quá thời gian lấy vị trí GPS. Vui lòng thử lại!', 'warning');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000
        }
      );
    }
  }, [isTrackingGps]);

  // Dọn dẹp watchPosition khi unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Căn giữa bản đồ vào vị trí GPS của tôi
  const handleCenterOnMe = useCallback(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(18);
      showToast(`Đã căn giữa vị trí GPS của bạn (±${Math.round(userLocation.accuracy)}m)`, 'success');
    } else {
      toggleGpsTracking();
    }
  }, [userLocation, toggleGpsTracking]);

  // Ghim hộ dân tại vị trí GPS hiện tại của tôi
  const handlePinAtCurrentLocation = useCallback((householdId?: string) => {
    if (!userLocation) {
      showToast('Chưa có vị trí GPS. Vui lòng bấm "Bật GPS của tôi" trước!', 'warning');
      return;
    }
    setClickedCoords({ lat: userLocation.lat, lng: userLocation.lng });
    if (householdId) {
      setSelectedHouseholdToMove(householdId);
    }
  }, [userLocation]);

  // Lưu tọa độ từ Zalo / Google Maps
  const handleSaveImportCoords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedCoords || !selectedHouseholdForImport) return;

    const hh = households.find(h => h.id === selectedHouseholdForImport);
    if (!hh) return;

    const updated: Household = {
      ...hh,
      latitude: parsedCoords.lat,
      longitude: parsedCoords.lng
    };

    try {
      await db.saveHousehold(updated);
      showToast(`Đã ghim vị trí thành công cho hộ của ${getHeadName(hh)}!`, 'success');
      setShowZaloImportModal(false);
      setImportInputText('');
      setSelectedHouseholdForImport('');
      setMapCenter([parsedCoords.lat, parsedCoords.lng]);
      setMapZoom(18);
      setSelectedHouseholdId(hh.id);
      loadData();
      window.dispatchEvent(new CustomEvent('db-changed'));

      setTimeout(() => {
        const marker = markerRefs.current[hh.id];
        if (marker) marker.openPopup();
      }, 400);
    } catch (e) {
      showToast('Lỗi khi lưu tọa độ định vị!', 'danger');
    }
  };

  // Lọc danh sách hộ trong modal nhập từ Zalo / Google Maps
  const filteredImportHouseholds = useMemo(() => {
    const s = importSearchTerm.trim().toLowerCase();
    if (!s) return householdSearchIndex;
    return householdSearchIndex.filter(item => item.searchTarget.includes(s));
  }, [householdSearchIndex, importSearchTerm]);

  // Tự động chọn nếu kết quả tìm kiếm đúng 1 hộ trong modal Zalo
  useEffect(() => {
    if (importSearchTerm.trim() && filteredImportHouseholds.length === 1) {
      setSelectedHouseholdForImport(filteredImportHouseholds[0].household.id);
    }
  }, [importSearchTerm, filteredImportHouseholds]);

  // Lọc danh sách hộ trong popup ghim tọa độ
  const filteredPopupHouseholds = useMemo(() => {
    const s = popupSearchTerm.trim().toLowerCase();
    if (!s) return householdSearchIndex;
    return householdSearchIndex.filter(item => item.searchTarget.includes(s));
  }, [householdSearchIndex, popupSearchTerm]);

  // Tự động chọn hộ nếu kết quả tìm kiếm đúng 1 hộ
  useEffect(() => {
    if (popupSearchTerm.trim() && filteredPopupHouseholds.length === 1) {
      setSelectedHouseholdToMove(filteredPopupHouseholds[0].household.id);
    }
  }, [popupSearchTerm, filteredPopupHouseholds]);

  const pinnedCount = households.filter(h => h.latitude && h.longitude).length;

  return (
    <div className="map-page-container">
      {/* Header Bản đồ */}
      <div className="map-header">
        <div className="header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🗺️</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#0f172a' }}>
                Bản đồ số dân cư {tdpName}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                {isGuest 
                  ? 'Tra cứu vị trí thực tế của từng hộ gia đình và nhân khẩu trên địa bàn.' 
                  : 'Tra cứu vị trí thực tế, xem ảnh vệ tinh, chia sẻ chỉ đường và chấm tọa độ định vị hộ dân.'}
              </p>
            </div>
          </div>
        </div>

        {/* Thống kê nhanh số hộ đã ghim */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: '#f8fafc', padding: '6px 14px', borderRadius: '10px',
          border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569'
        }}>
          <div>
            Đã ghim vị trí: <strong style={{ color: '#2563eb' }}>{pinnedCount}</strong> / {households.length} hộ
          </div>
          <div style={{
            width: '80px', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden'
          }}>
            <div style={{
              width: `${households.length > 0 ? (pinnedCount / households.length) * 100 : 0}%`,
              height: '100%', background: '#2563eb', borderRadius: '4px'
            }} />
          </div>
        </div>
      </div>

      {/* Thanh công cụ định vị GPS thực địa & Dán link Zalo / Google Maps */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        padding: '10px 16px', borderRadius: '12px',
        border: '1px solid #bae6fd', boxShadow: '0 2px 6px rgba(14, 165, 233, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>🧭</span> Công cụ định vị:
          </span>

          {/* Nút bật/tắt GPS */}
          <button
            type="button"
            onClick={toggleGpsTracking}
            disabled={isLocating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isTrackingGps ? '#10b981' : '#ffffff',
              color: isTrackingGps ? '#ffffff' : '#0284c7',
              border: isTrackingGps ? '1px solid #059669' : '1px solid #7dd3fc',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: isLocating ? 'wait' : 'pointer',
              boxShadow: isTrackingGps ? '0 2px 8px rgba(16, 185, 129, 0.35)' : '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <LocateFixed size={15} className={isLocating ? 'spin-icon' : ''} />
            <span>
              {isLocating 
                ? 'Đang kết nối GPS...' 
                : isTrackingGps 
                  ? `Đang bật GPS (±${userLocation ? Math.round(userLocation.accuracy) : '?'}m)` 
                  : '📍 Bật GPS của tôi'}
            </span>
          </button>

          {/* Nút Căn giữa vào vị trí của tôi */}
          {userLocation && (
            <button
              type="button"
              onClick={handleCenterOnMe}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#ffffff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Căn giữa màn hình vào vị trí của bạn"
            >
              <Navigation size={13} />
              <span>Đến vị trí tôi</span>
            </button>
          )}

          {/* Nút Ghim tại vị trí tôi đang đứng */}
          {!isGuest && userLocation && (
            <button
              type="button"
              onClick={() => handlePinAtCurrentLocation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#2563eb',
                color: '#ffffff',
                border: '1px solid #1d4ed8',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
              }}
              title="Ghim hộ dân tại vị trí bạn đang đứng"
            >
              <MapPin size={14} />
              <span>Ghim hộ tại vị trí đang đứng</span>
            </button>
          )}
        </div>

        {/* Nút Nhập từ Zalo / Google Maps */}
        {!isGuest && (
          <button
            type="button"
            onClick={() => {
              setShowZaloImportModal(true);
              setImportInputText('');
              setParsedCoords(null);
              setSelectedHouseholdForImport('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              color: '#047857',
              border: '1px solid #6ee7b7',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(5, 150, 105, 0.1)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#ecfdf5'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            <ClipboardPaste size={15} color="#059669" />
            <span>📋 Dán link Zalo / Google Maps</span>
          </button>
        )}
      </div>

      {/* Thanh bộ lọc chính sách & tìm kiếm tổng quan */}
      <div style={{ 
        display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', 
        alignItems: 'center', background: '#f8fafc', padding: '10px 16px', 
        borderRadius: '12px', border: '1px solid var(--border)' 
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#64748b' }}>
          🔍 Phân loại hộ:
        </span>
        {[
          { key: 'all', label: 'Tất cả các hộ', color: '#2563eb' },
          { key: 'none', label: 'Hộ bình thường', color: '#64748b' },
          { key: 'poor', label: 'Hộ nghèo', color: '#ef4444' },
          { key: 'near_poor', label: 'Hộ cận nghèo', color: '#f59e0b' },
          { key: 'policy_family', label: 'Hộ chính sách', color: '#6366f1' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setPolicyFilter(item.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'white',
              border: policyFilter === item.key ? '2px solid ' + item.color : '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '0.8rem',
              fontWeight: '700',
              color: policyFilter === item.key ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: policyFilter === item.key ? `0 2px 8px ${item.color}35` : 'none'
            }}
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="map-main">
        {/* Cột danh sách & Tìm kiếm bên trái */}
        <div className="map-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#1e293b' }}>
              Danh sách hộ dân ({filteredIndexedHouseholds.length})
            </h3>
            {mapSearchTerm && (
              <button 
                onClick={() => setMapSearchTerm('')}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Xóa tìm
              </button>
            )}
          </div>
          
          {/* Ô tìm kiếm thông minh: Tìm tên nhân khẩu hoặc tên chủ hộ (Tối ưu phản hồi tức thì) */}
          <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tìm tên nhân khẩu, tên chủ hộ, đ/c..."
                value={mapSearchTerm}
                onChange={(e) => {
                  setMapSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                style={{
                  width: '100%',
                  padding: '9px 32px 9px 36px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.84rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'white',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
              />
              {mapSearchTerm && (
                <button
                  type="button"
                  onClick={() => setMapSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex'
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Gợi ý xổ xuống tức thì khi gõ tìm kiếm */}
            {showSearchDropdown && searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'white',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                zIndex: 2000,
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>
                  Gợi ý kết quả ({searchSuggestions.length} hộ):
                </div>
                {searchSuggestions.map(item => {
                  const h = item.household;
                  const hasC = h.latitude !== null && h.latitude !== undefined && 
                               h.longitude !== null && h.longitude !== undefined;
                  return (
                    <div
                      key={h.id}
                      onClick={() => handleSelectHousehold(h)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{item.headName}</strong>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: '700',
                          background: hasC ? '#dcfce7' : '#f1f5f9',
                          color: hasC ? '#16a34a' : '#94a3b8'
                        }}>
                          {hasC ? '📍 Đã ghim' : 'Chưa ghim'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {h.address || 'Địa bàn TDP'}
                      </div>
                      {item.matchReason && (
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '600' }}>
                          👉 {item.matchReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Danh sách cuộn mini-cards */}
          <div className="household-mini-list">
            {filteredIndexedHouseholds.map(item => {
              const h = item.household;
              const hasC = h.latitude !== null && h.latitude !== undefined && 
                           h.longitude !== null && h.longitude !== undefined;
              const isSelected = selectedHouseholdId === h.id;

              return (
                <div 
                  key={h.id} 
                  className={`mini-card ${hasC ? 'positioned' : 'unpositioned'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectHousehold(h)}
                  style={{
                    backgroundColor: isSelected ? '#eff6ff' : undefined,
                    borderColor: isSelected ? '#3b82f6' : undefined
                  }}
                >
                  <Home size={18} style={{ color: hasC ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="h-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.headName}
                    </div>
                    <div className="h-addr" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {h.address || 'Địa bàn TDP'}
                    </div>
                    {item.matchReason && (
                      <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>
                        {item.matchReason}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={`pos-badge ${hasC ? 'yes' : 'no'}`}>
                        {hasC ? 'Đã ghim' : 'Chưa'}
                      </span>
                      {hasC && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLocation(h);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Sao chép link vị trí"
                        >
                          <Share2 size={13} />
                        </button>
                      )}
                    </div>
                    {!isGuest && userLocation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePinAtCurrentLocation(h.id);
                        }}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '5px',
                          padding: '2px 6px',
                          color: '#1d4ed8',
                          fontSize: '0.66rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap'
                        }}
                        title="Ghim hộ này tại vị trí GPS bạn đang đứng"
                      >
                        <MapPin size={10} />
                        <span>Ghim vị trí tôi</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredIndexedHouseholds.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🔍</div>
                Không tìm thấy hộ dân hoặc nhân khẩu nào phù hợp với từ khóa: <strong>"{mapSearchTerm}"</strong>
              </div>
            )}
          </div>
        </div>

        {/* Khung bản đồ tương tác */}
        <div className="map-wrapper">
          {/* Nút chuyển đổi 2 chế độ xem: Xem bản đồ & Xem vệ tinh */}
          <div 
            className="map-layer-toggle-container"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              padding: '4px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              transition: 'all 0.2s'
            }}
          >
            <button
              type="button"
              style={{
                padding: '7px 13px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: mapLayer === 'street' ? '#2563eb' : 'transparent',
                color: mapLayer === 'street' ? 'white' : '#475569',
                transition: 'all 0.15s ease',
                boxShadow: mapLayer === 'street' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('street'); }}
            >
              <span>🗺️ Xem bản đồ</span>
            </button>

            <button
              type="button"
              style={{
                padding: '7px 13px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: mapLayer === 'satellite' ? '#2563eb' : 'transparent',
                color: mapLayer === 'satellite' ? 'white' : '#475569',
                transition: 'all 0.15s ease',
                boxShadow: mapLayer === 'satellite' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('satellite'); }}
            >
              <span>🛰️ Xem vệ tinh</span>
            </button>

            <button
              type="button"
              style={{
                padding: '7px 13px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: mapLayer === 'terrain' ? '#2563eb' : 'transparent',
                color: mapLayer === 'terrain' ? 'white' : '#475569',
                transition: 'all 0.15s ease',
                boxShadow: mapLayer === 'terrain' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('terrain'); }}
            >
              <span>⛰️ Địa hình</span>
            </button>
          </div>

          <InteractiveMapView 
            mapLayer={mapLayer}
            defaultPosition={defaultPosition}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            mappedHouseholds={mappedHouseholds}
            residentMap={residentMap}
            residentById={residentById}
            isGuest={isGuest}
            selectedHouseholdId={selectedHouseholdId}
            onMapClick={handleMapClick}
            onSelectHouseholdId={setSelectedHouseholdId}
            markerRefs={markerRefs}
            onShareZalo={handleShareZalo}
            onShareFacebook={handleShareFacebook}
            onOpenGoogleMaps={handleOpenGoogleMaps}
            onCopyLocation={handleCopyLocation}
            userLocation={userLocation}
          />
        </div>
      </div>

      {/* Modal ghim vị trí khi click lên bản đồ hoặc lấy từ GPS (Dành cho Quản trị viên / Tổ trưởng) */}
      {!isGuest && clickedCoords && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ maxWidth: '450px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>📍</span>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>Định vị hộ gia đình</h2>
              </div>
              <button className="close-btn" onClick={() => setClickedCoords(null)}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                  Tọa độ: <strong style={{ color: '#2563eb' }}>{clickedCoords.lat.toFixed(6)}, {clickedCoords.lng.toFixed(6)}</strong>
                </p>
                {userLocation && Math.abs(clickedCoords.lat - userLocation.lat) < 0.0001 && Math.abs(clickedCoords.lng - userLocation.lng) < 0.0001 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: '700'
                  }}>
                    🛰️ GPS thực tế (±{Math.round(userLocation.accuracy)}m)
                  </span>
                )}
              </div>

              {/* Tùy chọn đổi tọa độ bằng dán link */}
              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '0.74rem', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>
                  🔗 Hoặc dán link Zalo / Google Maps để đổi sang tọa độ mới:
                </div>
                <input
                  type="text"
                  placeholder="Dán link Zalo, Google Maps hoặc tọa độ mới..."
                  onChange={(e) => {
                    const parsed = parseCoordinatesFromText(e.target.value);
                    if (parsed) {
                      setClickedCoords({ lat: parsed.lat, lng: parsed.lng });
                      showToast('Đã trích xuất và đổi tọa độ thành công!', 'success');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <form onSubmit={handleAssignCoordsSubmit} className="modal-form">
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                    Chọn hộ gia đình cần ghim vào vị trí này:
                  </label>
                  
                  {/* Ô tìm kiếm hộ để ghim nhanh */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Gõ tìm tên chủ hộ hoặc nhân khẩu..."
                      value={popupSearchTerm}
                      onChange={(e) => setPopupSearchTerm(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '8px 30px 8px 32px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.84rem',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                    {popupSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setPopupSearchTerm('');
                          setSelectedHouseholdToMove('');
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '7px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Danh sách gợi ý sổ trực tiếp bên dưới */}
                  <div style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{
                      padding: '6px 12px',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      color: '#64748b',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2
                    }}>
                      <span>GỢI Ý HỘ DÂN ({filteredPopupHouseholds.length} hộ)</span>
                      {selectedHouseholdToMove && (
                        <span style={{ color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> Đã chọn
                        </span>
                      )}
                    </div>

                    {filteredPopupHouseholds.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                        Không có hộ nào trùng khớp với "{popupSearchTerm}"
                      </div>
                    ) : (
                      filteredPopupHouseholds.map(item => {
                        const h = item.household;
                        const isSelected = selectedHouseholdToMove === h.id;
                        return (
                          <div
                            key={h.id}
                            onClick={() => setSelectedHouseholdToMove(h.id)}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#ffffff';
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '0.86rem',
                                  fontWeight: isSelected ? '700' : '600',
                                  color: isSelected ? '#1d4ed8' : '#0f172a'
                                }}>
                                  {item.headName}
                                </span>
                                {h.household_number && (
                                  <span style={{
                                    fontSize: '0.68rem',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    background: '#f1f5f9',
                                    color: '#475569'
                                  }}>
                                    Số: {h.household_number}
                                  </span>
                                )}
                              </div>

                              <div style={{
                                fontSize: '0.74rem',
                                color: '#64748b',
                                marginTop: '2px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                🏠 {h.address || 'Chưa rõ địa chỉ'} 
                                {h.latitude ? (
                                  <span style={{ color: '#d97706', marginLeft: '6px', fontWeight: '500' }}>• Đã có tọa độ cũ</span>
                                ) : (
                                  <span style={{ color: '#16a34a', marginLeft: '6px', fontWeight: '500' }}>• Chưa ghim</span>
                                )}
                              </div>

                              {/* Nếu trùng theo tên nhân khẩu thì hiển thị rõ */}
                              {popupSearchTerm.trim() && !item.headName.toLowerCase().includes(popupSearchTerm.trim().toLowerCase()) && (
                                <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '2px' }}>
                                  👥 Có nhân khẩu trùng từ khóa
                                </div>
                              )}
                            </div>

                            <input
                              type="radio"
                              name="selectedHouseholdToMove"
                              checked={isSelected}
                              onChange={() => setSelectedHouseholdToMove(h.id)}
                              style={{ accentColor: '#2563eb', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setClickedCoords(null)}>
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={!selectedHouseholdToMove}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      opacity: selectedHouseholdToMove ? 1 : 0.6,
                      cursor: selectedHouseholdToMove ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <MapPin size={15} />
                    <span>Xác nhận ghim vị trí</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dán link Zalo / Google Maps (Dành cho Quản trị viên / Tổ trưởng) */}
      {!isGuest && showZaloImportModal && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ maxWidth: '480px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                  Ghim vị trí từ Zalo / Google Maps
                </h2>
              </div>
              <button className="close-btn" onClick={() => setShowZaloImportModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <form onSubmit={handleSaveImportCoords} className="modal-form">
                {/* Ô dán đường link hoặc tọa độ */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <LinkIcon size={14} />
                    <span>Dán tin nhắn Zalo, link Google Maps hoặc tọa độ người dân gửi:</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: dán link chia sẻ vị trí Zalo, link https://maps.google.com/?q=... hoặc số tọa độ: 19.742351, 105.923412"
                    value={importInputText}
                    onChange={(e) => setImportInputText(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid ' + (parsedCoords ? '#10b981' : importInputText.trim() ? '#f59e0b' : '#cbd5e1'),
                      fontSize: '0.84rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      background: parsedCoords ? '#f0fdf4' : '#ffffff'
                    }}
                  />

                  {/* Trạng thái nhận diện tọa độ */}
                  {parsedCoords ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      fontSize: '0.8rem',
                      color: '#065f46',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>✅</span>
                      <div>
                        <strong>Nhận diện tọa độ thành công:</strong>
                        <div style={{ marginTop: '2px', fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>
                          Vĩ độ: {parsedCoords.lat.toFixed(6)} | Kinh độ: {parsedCoords.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  ) : importInputText.trim() ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      fontSize: '0.78rem',
                      color: '#92400e',
                      lineHeight: '1.4'
                    }}>
                      ⚠️ Chưa nhận diện được tọa độ trong văn bản. Bạn hãy dán link Google Maps hoặc chuỗi số tọa độ (Ví dụ: <code>19.742351, 105.923412</code>).
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
                      💡 Mẹo: Bạn có thể copy trực tiếp tin nhắn chia sẻ vị trí từ Zalo hoặc link từ Google Maps dán vào đây.
                    </div>
                  )}
                </div>

                {/* Chọn hộ gia đình cần ghim */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                    Chọn hộ gia đình cần ghim vào vị trí này:
                  </label>

                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Tìm theo tên chủ hộ, nhân khẩu, số nhà..."
                      value={importSearchTerm}
                      onChange={(e) => setImportSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 30px 8px 32px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.84rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {importSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setImportSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '7px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          padding: '2px',
                          display: 'flex'
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Danh sách hộ */}
                  <div style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    maxHeight: '190px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {filteredImportHouseholds.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                        Không có hộ nào trùng khớp với "{importSearchTerm}"
                      </div>
                    ) : (
                      filteredImportHouseholds.map(item => {
                        const h = item.household;
                        const isSelected = selectedHouseholdForImport === h.id;
                        return (
                          <div
                            key={h.id}
                            onClick={() => setSelectedHouseholdForImport(h.id)}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: isSelected ? '700' : '600', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                                  {item.headName}
                                </span>
                                {h.household_number && (
                                  <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: '#f1f5f9', color: '#475569' }}>
                                    Số: {h.household_number}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                                🏠 {h.address || 'Chưa rõ địa chỉ'}
                                {h.latitude ? (
                                  <span style={{ color: '#d97706', marginLeft: '6px' }}>• Đã có tọa độ cũ</span>
                                ) : (
                                  <span style={{ color: '#16a34a', marginLeft: '6px' }}>• Chưa ghim</span>
                                )}
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="selectedHouseholdForImport"
                              checked={isSelected}
                              onChange={() => setSelectedHouseholdForImport(h.id)}
                              style={{ accentColor: '#2563eb', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="form-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowZaloImportModal(false)}>
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!parsedCoords || !selectedHouseholdForImport}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: parsedCoords && selectedHouseholdForImport ? 1 : 0.6,
                      cursor: parsedCoords && selectedHouseholdForImport ? 'pointer' : 'not-allowed',
                      background: '#059669',
                      borderColor: '#059669'
                    }}
                  >
                    <Check size={15} />
                    <span>Lưu ghim vị trí</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .map-page-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.4s ease-out;
          min-height: calc(100vh - var(--header-height) - 48px);
        }

        .map-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .map-main {
          flex: 1;
          display: flex;
          gap: 16px;
          min-height: 520px;
        }

        .map-sidebar {
          width: 320px;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          max-height: 600px;
          box-shadow: var(--shadow-sm);
        }

        .map-wrapper {
          flex: 1;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          position: relative;
          box-shadow: var(--shadow-sm);
          min-height: 480px;
        }

        .household-mini-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          flex: 1;
          padding-right: 4px;
        }

        .mini-card {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          align-items: center;
          transition: all 0.2s ease;
        }

        .mini-card:hover {
          background-color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
          transform: translateY(-1px);
        }
        
        .mini-card.positioned {
          border-left: 3.5px solid #2563eb;
        }

        .mini-card.unpositioned {
          border-left: 3.5px solid #cbd5e1;
          opacity: 0.85;
        }

        .mini-card.selected {
          border-color: #2563eb !important;
          background-color: #eff6ff !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15) !important;
        }

        .h-name { font-weight: 700; font-size: 0.88rem; color: #0f172a; }
        .h-addr { font-size: 0.76rem; color: #64748b; margin-top: 1px; }

        .pos-badge {
          font-size: 0.68rem;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 700;
          white-space: nowrap;
        }
        .pos-badge.yes { background-color: rgba(16, 185, 129, 0.12); color: #059669; }
        .pos-badge.no { background-color: #f1f5f9; color: #94a3b8; }

        @keyframes markerPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7); }
          70% { transform: scale(1.15); box-shadow: 0 0 0 10px rgba(250, 204, 21, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); }
        }

        @keyframes gpsPing {
          0% { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* Leaflet popup customization */
        .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.96) !important;
          backdrop-filter: blur(8px) !important;
          border-radius: 14px !important;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16) !important;
          border: 1px solid #e2e8f0 !important;
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.96) !important;
        }

        @media (max-width: 1024px) {
          .map-main { flex-direction: column; }
          .map-sidebar { width: 100%; max-height: 280px; }
          .map-wrapper { height: 450px; }
        }
      `}</style>
    </div>
  );
};

export default CitizenMap;
