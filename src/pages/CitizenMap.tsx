import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Home, Filter, MapPin, X, Plus, Search } from 'lucide-react';
import { db } from '../services/db';
import { showToast } from '../utils/toast';
import type { Household, Resident } from '../types';

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

const CitizenMap = () => {
  const isGuest = localStorage.getItem('guest_mode') === 'true';
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  
  // Viewport state (default center of Nam Sầm Sơn)
  const defaultPosition: [number, number] = [19.7420, 105.9230];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultPosition);
  const [mapZoom, setMapZoom] = useState(16);

  // Filter & Click Assign states
  const [policyFilter, setPolicyFilter] = useState<string>('all');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHouseholdToMove, setSelectedHouseholdToMove] = useState<string>('');
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'terrain'>('satellite');
  const [mapSearchTerm, setMapSearchTerm] = useState<string>('');
  const [popupSearchTerm, setPopupSearchTerm] = useState<string>('');

  const loadData = async () => {
    try {
      const [hList, rList] = await Promise.all([
        db.getHouseholds(),
        db.getResidents()
      ]);
      setHouseholds(hList);
      setResidents(rList);
    } catch (e) {
      showToast('Lỗi tải bản đồ!', 'danger');
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

  const getHeadName = (h: Household) => {
    const head = residents.find(r => r.id === h.head_of_household_id);
    return head ? head.full_name : 'Chưa rõ chủ hộ';
  };

  const getMarkerIcon = (type: string) => {
    let color = '#2563eb'; // blue
    if (type === 'poor') color = '#ef4444'; // red
    else if (type === 'near_poor') color = '#f59e0b'; // orange
    else if (type === 'policy_family') color = '#6366f1'; // indigo
    
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  const handleMiniCardClick = (h: Household) => {
    if (h.latitude && h.longitude) {
      setMapCenter([h.latitude, h.longitude]);
      setMapZoom(18);
    } else {
      showToast('Hộ dân này chưa được chấm tọa độ trên bản đồ!', 'warning');
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setClickedCoords({ lat, lng });
    setSelectedHouseholdToMove('');
    setPopupSearchTerm('');
  };

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
      showToast('Lỗi định vị!', 'danger');
    }
  };

  // Filter households that have coordinates for Map rendering
  const mappedHouseholds = households.filter(h => {
    const hasCoords = h.latitude !== null && h.latitude !== undefined && 
                      h.longitude !== null && h.longitude !== undefined;
    const matchesPolicy = policyFilter === 'all' || h.policy_type === policyFilter;
    return hasCoords && matchesPolicy;
  });

  // Filter households in the sidebar based on search query
  const filteredSidebarHouseholds = households.filter(h => {
    const headName = getHeadName(h).toLowerCase();
    const address = (h.address || '').toLowerCase();
    const householdNum = (h.household_number || '').toLowerCase();
    const search = mapSearchTerm.toLowerCase().trim();
    return headName.includes(search) || address.includes(search) || householdNum.includes(search);
  });

  // Filter households in the coordinate assignment modal based on search query
  const filteredPopupHouseholds = households.filter(h => {
    const headName = getHeadName(h).toLowerCase();
    const address = (h.address || '').toLowerCase();
    const householdNum = (h.household_number || '').toLowerCase();
    const search = popupSearchTerm.toLowerCase().trim();
    return headName.includes(search) || address.includes(search) || householdNum.includes(search);
  });

  return (
    <div className="map-page-container">
      <div className="map-header">
        <div className="header-info">
          <h1>Bản đồ số dân cư {tdpName}</h1>
          <p>{isGuest ? 'Hiển thị vị trí thực tế của từng hộ dân trên địa bàn.' : 'Hiển thị vị trí thực tế của từng hộ dân. Click lên bản đồ để chấm tọa độ định vị hộ dân mới hoặc di chuyển hộ cũ.'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>🔍 Phân loại hộ & Bộ lọc nhanh:</span>
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
              background: policyFilter === item.key ? 'white' : 'transparent',
              border: policyFilter === item.key ? '2.5px solid ' + item.color : '1.5px solid #e2e8f0',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: policyFilter === item.key ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: policyFilter === item.key ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }}></span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="map-main">
        <div className="map-sidebar">
           <h3>Danh sách hộ dân ({filteredSidebarHouseholds.length})</h3>
           
           <div style={{ marginBottom: '12px', position: 'relative' }}>
             <input
               type="text"
               placeholder="Tìm tên chủ hộ, địa chỉ..."
               value={mapSearchTerm}
               onChange={(e) => setMapSearchTerm(e.target.value)}
               style={{
                 width: '100%',
                 padding: '8px 12px 8px 32px',
                 borderRadius: '8px',
                 border: '1px solid var(--border)',
                 fontSize: '0.85rem',
                 outline: 'none',
                 fontFamily: 'inherit',
                 boxSizing: 'border-box'
               }}
             />
             <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
           </div>

           <div className="household-mini-list">
              {filteredSidebarHouseholds.map(h => {
                 const hasC = h.latitude !== null && h.latitude !== undefined && 
                              h.longitude !== null && h.longitude !== undefined;
                return (
                  <div 
                    key={h.id} 
                    className={`mini-card ${hasC ? 'positioned' : 'unpositioned'}`}
                    onClick={() => handleMiniCardClick(h)}
                  >
                     <Home size={18} />
                     <div style={{flex: 1}}>
                        <div className="h-name">{getHeadName(h)}</div>
                        <div className="h-addr">{h.address}</div>
                     </div>
                     <span className={`pos-badge ${hasC ? 'yes' : 'no'}`}>
                       {hasC ? 'Đã ghim' : 'Chưa ghim'}
                     </span>
                  </div>
                );
              })}
              {filteredSidebarHouseholds.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Không tìm thấy hộ dân nào
                </div>
              )}
           </div>
        </div>

        <div className="map-wrapper">
          <div 
            className="map-layer-toggle-container"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              padding: '4px',
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              transition: 'all 0.2s',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          >
            <button
              type="button"
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                backgroundColor: mapLayer === 'street' ? 'var(--primary)' : 'transparent',
                color: mapLayer === 'street' ? 'white' : '#475569',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('street'); }}
            >
              🗺️ Bản đồ 2D
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                backgroundColor: mapLayer === 'satellite' ? 'var(--primary)' : 'transparent',
                color: mapLayer === 'satellite' ? 'white' : '#475569',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('satellite'); }}
            >
              🛰️ Xem vệ tinh
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                backgroundColor: mapLayer === 'terrain' ? 'var(--primary)' : 'transparent',
                color: mapLayer === 'terrain' ? 'white' : '#475569',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onClick={(e) => { e.stopPropagation(); setMapLayer('terrain'); }}
            >
              ⛰️ Xem 3D
            </button>
          </div>
          <MapContainer center={defaultPosition} zoom={16} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            {mapLayer === 'street' && (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            {mapLayer === 'satellite' && (
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            )}
            {mapLayer === 'terrain' && (
              <TileLayer
                attribution='Map data &copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            )}
            <ChangeView center={mapCenter} zoom={mapZoom} />
            {!isGuest && <MapClickHandler onMapClick={handleMapClick} />}
            
            {mappedHouseholds.map(h => (
              <Marker 
                key={h.id} 
                position={[h.latitude!, h.longitude!]} 
                icon={getMarkerIcon(h.policy_type)}
              >
                <Popup>
                  <div className="popup-content">
                    <h4>{getHeadName(h)}</h4>
                    <p style={{fontSize: '0.85rem', color: '#64748b', margin: '4px 0'}}><MapPin size={12} style={{display: 'inline', marginRight: '4px'}} />{h.address}</p>
                    <p style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)'}}>Sổ hộ khẩu: {h.household_number}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Click Map Location Assignment Pop-up form */}
      {!isGuest && clickedCoords && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Định vị hộ gia đình</h2>
              <button className="close-btn" onClick={() => setClickedCoords(null)}><X size={24} /></button>
            </div>
            <p style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '14px'}}>
              Tọa độ đã chọn: Lat: {clickedCoords.lat.toFixed(5)}, Lng: {clickedCoords.lng.toFixed(5)}
            </p>
            <form onSubmit={handleAssignCoordsSubmit} className="modal-form">
              <div className="form-group">
                <label>Chọn hộ gia đình muốn ghim vào vị trí này:</label>
                <div style={{ marginBottom: '8px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Gõ tìm tên chủ hộ hoặc địa chỉ để lọc nhanh..."
                    value={popupSearchTerm}
                    onChange={(e) => setPopupSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
                </div>
                <select 
                  value={selectedHouseholdToMove} 
                  onChange={(e) => setSelectedHouseholdToMove(e.target.value)}
                  required
                >
                  <option value="">-- Chọn hộ dân từ danh sách ({filteredPopupHouseholds.length} hộ) --</option>
                  {filteredPopupHouseholds.map(h => (
                    <option key={h.id} value={h.id}>
                      {getHeadName(h)} - {h.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setClickedCoords(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary"><MapPin size={16} /> Xác nhận ghim vị trí</button>
              </div>
            </form>
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
          margin-bottom: 24px;
          align-items: center;
        }

        .map-select {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          font-weight: 600;
          font-size: 0.95rem;
          outline: none;
          background: white;
        }

        .map-main {
          flex: 1;
          display: flex;
          gap: 20px;
          min-height: 480px;
        }

        .map-sidebar {
          width: 320px;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          max-height: 550px;
        }

        .map-sidebar h3 {
          margin-bottom: 16px;
          font-size: 1.1rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }

        .map-wrapper {
          flex: 1;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          position: relative;
          box-shadow: var(--shadow-sm);
        }

        .household-mini-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          flex: 1;
        }

        .mini-card {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: var(--radius-md);
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          align-items: center;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mini-card:hover {
          background-color: #ffffff;
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
          transform: translateY(-2px);
        }
        
        .mini-card.positioned {
          border-left: 4px solid var(--primary);
        }

        .mini-card.unpositioned {
          border-left: 4px solid #cbd5e1;
          opacity: 0.85;
        }

        .h-name { font-weight: 700; font-size: 0.92rem; color: var(--text-main); }
        .h-addr { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }

        .pos-badge {
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 700;
        }
        .pos-badge.yes { background-color: rgba(16, 185, 129, 0.1); color: var(--success); }
        .pos-badge.no { background-color: #f1f5f9; color: var(--text-muted); }

        /* Leaflet Glassmorphism styling override */
        .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border: 1.5px solid rgba(255, 255, 255, 0.45) !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08) !important;
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: none !important;
        }
        .popup-content h4 { 
          margin: 0 0 6px 0; 
          font-weight: 800; 
          font-size: 1.05rem; 
          color: #0f172a; 
        }
        .popup-content p { 
          margin: 4px 0; 
          font-size: 0.82rem;
          color: #475569;
        }

        @media (max-width: 1024px) {
          .map-sidebar { display: none; }
        }
      `}</style>
    </div>
  );
};

export default CitizenMap;
