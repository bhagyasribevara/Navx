import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiMap, FiSearch } from 'react-icons/fi';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { QRCodeSVG } from 'qrcode.react';
import { getCampuses, createCampus, updateCampus, deleteCampus } from '../api';

const VENUE_TYPES = [
  { value: 'campus', label: '🎓 Campus', color: '#6366f1' },
  { value: 'hospital', label: '🏥 Hospital', color: '#ef4444' },
  { value: 'airport', label: '✈️ Airport', color: '#3b82f6' },
  { value: 'mall', label: '🛍️ Mall', color: '#f59e0b' },
  { value: 'building', label: '🏢 Building', color: '#22c55e' },
  { value: 'other', label: '📍 Other', color: '#94a3b8' },
];

const VENUE_ICONS = { campus: '🎓', hospital: '🏥', airport: '✈️', mall: '🛍️', building: '🏢', other: '📍' };

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

function MapClickHandler({ setMarkerPos, setMapCenter }) {
  useMapEvents({
    click(e) {
      setMarkerPos([e.latlng.lat, e.latlng.lng]);
      setMapCenter([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export default function CampusManager({ admin }) {
  const [campuses, setCampuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', address: '', venueType: 'campus' });
  const [mapCenter, setMapCenter] = useState([18.4665, 83.6629]);
  const [markerPos, setMarkerPos] = useState(null);
  const navigate = useNavigate();

  const handleSearchLocation = async () => {
    const searchTerms = [];
    if (form.name) searchTerms.push(form.name.trim());
    if (form.address) searchTerms.push(...form.address.split(',').map(p => p.trim()).filter(Boolean));

    if (searchTerms.length === 0) return toast.warn('Please enter Campus Name or Address to search');
    toast.info('Searching location...');
    
    // Construct progressive search queries
    const queries = [];
    
    // 1. Campus Name + Full Address
    if (form.name && form.address) queries.push(`${form.name.trim()}, ${form.address.trim()}`);
    
    // 2. Just Full Address
    if (form.address) queries.push(form.address.trim());
    
    // 3. Fallbacks: combinations of parts
    for (let i = 0; i < searchTerms.length; i++) {
      queries.push(searchTerms.slice(i).join(', '));
    }
    
    // 4. Just Campus Name
    if (form.name) queries.push(form.name.trim());

    // Remove duplicates
    const uniqueQueries = [...new Set(queries)];
    
    for (const query of uniqueQueries) {
      if (!query) continue;
      try {
        // Try Nominatim
        let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
          headers: { 'Accept-Language': 'en-US,en' }
        });
        let data = await res.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          setMapCenter([lat, lon]);
          setMarkerPos([lat, lon]);
          toast.success(`Found location: ${query}`);
          return;
        }

        // Try Photon fallback (better for fuzzy names)
        res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
        data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const lon = parseFloat(data.features[0].geometry.coordinates[0]);
          const lat = parseFloat(data.features[0].geometry.coordinates[1]);
          setMapCenter([lat, lon]);
          setMarkerPos([lat, lon]);
          toast.success(`Found location: ${query}`);
          return;
        }
      } catch(e) {
        console.warn('Geocoding error for query:', query);
      }
    }
    
    toast.error('Location not found. Please click on the map to pinpoint manually.');
  };

  const load = () => {
    getCampuses().then(r => {
      let campusList = r.data;
      if (admin && (admin.role === 'CampusAdmin' || admin.role === 'VenueAdmin') && admin.campusId) {
        const cId = admin.campusId._id || admin.campusId;
        campusList = campusList.filter(c => c._id === cId);
      }
      setCampuses(campusList);
    }).catch(e => toast.error('Failed to load'));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...form };
      if (markerPos) {
        dataToSubmit.location = { lat: markerPos[0], lng: markerPos[1] };
      }

      if (editing) {
        await updateCampus(editing._id, dataToSubmit);
        toast.success('Venue updated');
      } else {
        await createCampus(dataToSubmit);
        toast.success('Venue created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', address: '', venueType: 'campus' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campus?')) return;
    try { await deleteCampus(id); toast.success('Deleted'); load(); }
    catch (err) { toast.error('Delete failed'); }
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description, address: c.address, venueType: c.venueType || 'campus' });
    if (c.location && c.location.lat) {
      setMapCenter([c.location.lat, c.location.lng]);
      setMarkerPos([c.location.lat, c.location.lng]);
    } else {
      setMarkerPos(null);
    }
    setShowModal(true);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Venue Management</h1>
          <p className="page-subtitle">Create and manage campuses, hospitals, airports, malls & buildings</p>
        </div>
        {(!admin || admin.role === 'SuperAdmin') && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', address: '', venueType: 'campus' }); setMarkerPos(null); setShowModal(true); }}>
            <FiPlus /> New Venue
          </button>
        )}
      </div>

      {campuses.length === 0 ? (
        <div className="empty-state">
          <h3>No venues yet</h3>
          <p>Get started by creating your first venue</p>
        </div>
      ) : (
        <div className="card-grid">
          {campuses.map(c => (
            <div className="card" key={c._id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{VENUE_ICONS[c.venueType] || '📍'}</span>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{c.name}</h3>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: (VENUE_TYPES.find(v=>v.value===c.venueType)?.color || '#94a3b8') + '20', color: VENUE_TYPES.find(v=>v.value===c.venueType)?.color || '#94a3b8' }}>
                  {(c.venueType || 'campus').toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.description || 'No description'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📍 {c.address || 'No address'}</p>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, position: 'relative', zIndex: 10 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/editor/${c._id}`); }}>
                  <FiMap /> Open Editor
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedQR(c); setShowQRModal(true); }}>
                  QR Code
                </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <FiEdit2 /> Edit Details & Location
                    </button>
                {(!admin || admin.role === 'SuperAdmin') && (
                    <button type="button" className="btn btn-danger btn-sm" style={{ backgroundColor: '#ef4444', color: '#fff' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(c._id); }}>
                      <FiTrash2 />
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showQRModal && selectedQR && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title">Campus QR Code</h2>
              <button className="btn-icon" onClick={() => setShowQRModal(false)}>✕</button>
            </div>
            <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', margin: '20px auto', display: 'inline-block' }}>
              <QRCodeSVG 
                value={`navx://campus/${selectedQR._id}`} 
                size={256} 
                level="H" 
                includeMargin={true}
              />
            </div>
            <p style={{ marginTop: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Scan this QR to open the map for <strong>{selectedQR.name}</strong>.
            </p>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setShowQRModal(false)} style={{ width: '100%' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Venue' : 'New Venue'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                <label>Venue Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g., City General Hospital" />
              </div>
              <div className="input-group">
                <label>Venue Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {VENUE_TYPES.map(v => (
                    <button type="button" key={v.value} onClick={() => setForm({...form, venueType: v.value})}
                      style={{ padding: '6px 12px', borderRadius: 20, border: form.venueType === v.value ? `2px solid ${v.color}` : '1px solid var(--border)', background: form.venueType === v.value ? v.color + '18' : 'transparent', color: form.venueType === v.value ? v.color : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div className="input-group">
                <label>Address</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-secondary" onClick={handleSearchLocation} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiSearch /> Search Map
                  </button>
                </div>
              </div>

              <div style={{ height: '200px', width: '100%', marginTop: '16px', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapUpdater center={mapCenter} />
                  <MapClickHandler setMarkerPos={setMarkerPos} setMapCenter={setMapCenter} />
                  {markerPos && (
                    <CircleMarker center={markerPos} radius={8} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}>
                      <Popup>
                        <div style={{ textAlign: 'center', padding: '4px' }}>
                          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '13px' }}>Location Found</p>
                          <button 
                            type="button" 
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm(prev => ({ ...prev, location: { lat: markerPos[0], lng: markerPos[1] } }));
                              toast.success("Location fixed! Click Create/Update to save.");
                            }}
                          >
                            Fix & Save Location
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </MapContainer>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
