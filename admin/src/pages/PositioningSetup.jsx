import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2, FiDownload } from 'react-icons/fi';
import { MdQrCode2, MdBluetooth } from 'react-icons/md';
import * as api from '../api';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const qrIcon = new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background:#ef4444; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h-2v2h2v-2zm-2 2h-2v2h2v-2zm2 2h-2v2h2v-2z"/></svg></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const beaconIcon = new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/></svg></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function MapClickHandler({ onAdd }) {
  useMapEvents({ click(e) { onAdd(e.latlng); } });
  return null;
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) { map.setView(center, map.getZoom() || 19); }
  }, [center]);
  return null;
}

export default function PositioningSetup() {
  const { campusId } = useParams();
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [qrcodes, setQrcodes] = useState([]);
  const [beacons, setBeacons] = useState([]);
  const [tab, setTab] = useState('qr');
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [qrImages, setQrImages] = useState({});
  const [rooms, setRooms] = useState([]);
  
  const center = selectedBlock?.shape?.points?.[0] ? [selectedBlock.shape.points[0].x, selectedBlock.shape.points[0].y] : [18.4665, 83.6629];

  useEffect(() => { api.getBlocks(campusId).then(r => setBlocks(r.data)); }, [campusId]);

  useEffect(() => {
    if (selectedBlock) {
      console.log('Fetching floors for block:', selectedBlock._id);
      api.getFloors(selectedBlock._id, campusId)
        .then(r => { 
          console.log('Got floors:', r.data);
          setFloors(r.data); 
          if (r.data.length) setSelectedFloor(r.data[0]); 
          else toast.info('No floors found for this block');
        })
        .catch(err => {
          console.error('Error fetching floors:', err);
          toast.error('Failed to fetch floors: ' + (err.response?.data?.error || err.message));
        });
    }
  }, [selectedBlock]);

  useEffect(() => {
    if (selectedFloor) {
      api.getQRCodes(selectedFloor._id).then(r => setQrcodes(r.data));
      api.getBeacons(selectedFloor._id).then(r => setBeacons(r.data));
      api.getRooms(selectedFloor._id, selectedBlock?._id).then(r => setRooms(r.data));
    } else {
      setRooms([]);
    }
  }, [selectedFloor]);

  const addQR = async (latlng) => {
    if (!selectedFloor) return toast.warn('Select a floor first');
    try {
      const r = await api.createQRCode({
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        label: `QR Point ${qrcodes.length + 1}`, position: { x: latlng.lat, y: latlng.lng }
      });
      setQrcodes([...qrcodes, r.data]);
      toast.success('QR code created at clicked location');
    } catch { toast.error('Failed to create QR code'); }
  };

  const addBeacon = (latlng) => {
    if (!selectedFloor) return toast.warn('Select a floor first');
    setForm({ beaconId: '', uuid: '', major: 1, minor: 1, label: `Beacon ${beacons.length + 1}`, x: latlng.lat, y: latlng.lng, txPower: -59 });
    setShowModal('beacon');
  };

  const saveBeacon = async (e) => {
    e.preventDefault();
    try {
      const r = await api.createBeacon({
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        beaconId: form.beaconId, uuid: form.uuid, major: +form.major, minor: +form.minor,
        label: form.label, position: { x: +form.x, y: +form.y }, txPower: +form.txPower
      });
      setBeacons([...beacons, r.data]);
      setShowModal(null);
      toast.success('Beacon added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteQR = async (id) => {
    if (!confirm('Delete?')) return;
    await api.deleteQRCode(id);
    setQrcodes(qrcodes.filter(q => q._id !== id));
    toast.success('Deleted');
  };

  const deleteBeaconItem = async (id) => {
    if (!confirm('Delete?')) return;
    await api.deleteBeacon(id);
    setBeacons(beacons.filter(b => b._id !== id));
    toast.success('Deleted');
  };

  const showQRImage = async (qr) => {
    try {
      const r = await api.getQRImage(qr._id);
      setQrImages({ ...qrImages, [qr._id]: r.data.image });
    } catch { toast.error('Failed to generate QR image'); }
  };

  const exportAll = async () => {
    if (!selectedFloor) return;
    try {
      const r = await api.exportFloorQR(selectedFloor._id);
      const w = window.open('', '_blank');
      w.document.write('<html><head><title>NavX QR Codes</title><style>body{font-family:sans-serif;padding:20px}.qr{display:inline-block;margin:20px;text-align:center;border:1px solid #ddd;padding:16px;border-radius:8px}img{width:200px}</style></head><body><h1>NavX QR Codes</h1>');
      r.data.forEach(q => {
        w.document.write(`<div class="qr"><img src="${q.image}"/><p><strong>${q.label}</strong></p><p>Code: ${q.code}</p><p>Position: (${q.position.x}, ${q.position.y})</p></div>`);
      });
      w.document.write('</body></html>');
      w.document.close();
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Positioning Setup</h1>
          <p className="page-subtitle">Configure QR codes and BLE beacons for indoor positioning</p>
        </div>
      </div>

      {/* Block/Floor selection */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="input" style={{ width: 200 }} value={selectedBlock?._id || ''} onChange={e => setSelectedBlock(blocks.find(b => b._id === e.target.value))}>
          <option value="">Select Block</option>
          {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select className="input" style={{ width: 200 }} value={selectedFloor?._id || ''} onChange={e => setSelectedFloor(floors.find(f => f._id === e.target.value))}>
          <option value="">Select Floor</option>
          {floors.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        <button className={`tool-btn ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')} style={{ padding: '8px 20px', fontSize: 13 }}>
          <MdQrCode2 style={{ marginRight: 6 }} /> QR Codes ({qrcodes.length})
        </button>
        <button className={`tool-btn ${tab === 'beacon' ? 'active' : ''}`} onClick={() => setTab('beacon')} style={{ padding: '8px 20px', fontSize: 13 }}>
          <MdBluetooth style={{ marginRight: 6 }} /> BLE Beacons ({beacons.length})
        </button>
      </div>

      {tab === 'qr' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-sec)', padding: '8px 0' }}>💡 Click on the map below to place a QR code at that exact location.</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={exportAll} disabled={!selectedFloor}><FiDownload /> Export All for Printing</button>
          </div>
          <div style={{ height: 400, borderRadius: 8, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--border)' }}>
            <MapContainer center={center} zoom={19} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={import.meta.env.VITE_MAPBOX_URL || "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA"} maxZoom={24} maxNativeZoom={19} />
              <MapUpdater center={center} />
              {rooms.map(r => r.shape?.points && (
                <Polygon key={r._id} positions={r.shape.points.map(p => [p.x, p.y])} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}>
                  <Tooltip permanent direction="center" className="room-label"><span style={{ fontSize: 9, fontWeight: 800, color: '#1e293b' }}>{r.name}</span></Tooltip>
                </Polygon>
              ))}
              {qrcodes.map(qr => (
                <Marker key={qr._id} position={[qr.position.x, qr.position.y]} icon={qrIcon} draggable={true} eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    api.updateQRCode(qr._id, { position: { x: pos.lat, y: pos.lng } })
                      .then(() => {
                        setQrcodes(qrcodes.map(q => q._id === qr._id ? { ...q, position: { x: pos.lat, y: pos.lng } } : q));
                        toast.success('QR Code moved');
                      });
                  }
                }}>
                  <Tooltip direction="top" offset={[0, -10]}>{qr.label} (Drag to move)</Tooltip>
                </Marker>
              ))}
              {selectedFloor && <MapClickHandler onAdd={addQR} />}
            </MapContainer>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Code</th><th>Label</th><th>Position</th><th>QR Image</th><th>Actions</th></tr></thead>
              <tbody>
                {qrcodes.map(qr => (
                  <tr key={qr._id}>
                    <td><code style={{ color: 'var(--accent-secondary)' }}>{qr.code}</code></td>
                    <td>
                      <input className="input" value={qr.label} style={{ width: 150, padding: '4px 8px' }}
                        onChange={e => { const v = e.target.value; api.updateQRCode(qr._id, { label: v }).then(() => setQrcodes(qrcodes.map(q => q._id === qr._id ? { ...q, label: v } : q))); }} />
                    </td>
                    <td style={{ fontSize: 13 }}>({qr.position.x?.toFixed(6)}, {qr.position.y?.toFixed(6)})</td>
                    <td>
                      {qrImages[qr._id] || qr.image ? <img src={qrImages[qr._id] || qr.image} style={{ width: 80 }} alt="QR" /> : <button className="btn btn-secondary btn-sm" onClick={() => showQRImage(qr)}>Generate</button>}
                    </td>
                    <td><button type="button" className="btn btn-danger btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteQR(qr._id); }}><FiTrash2 /></button></td>
                  </tr>
                ))}
                {qrcodes.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No QR codes yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'beacon' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>💡 Click on the map below to place a BLE beacon.</span>
          </div>
          <div style={{ height: 400, borderRadius: 8, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--border)' }}>
            <MapContainer center={center} zoom={19} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={import.meta.env.VITE_MAPBOX_URL || "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA"} maxZoom={24} maxNativeZoom={19} />
              <MapUpdater center={center} />
              {rooms.map(r => r.shape?.points && (
                <Polygon key={r._id} positions={r.shape.points.map(p => [p.x, p.y])} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}>
                  <Tooltip permanent direction="center" className="room-label"><span style={{ fontSize: 9, fontWeight: 800, color: '#1e293b' }}>{r.name}</span></Tooltip>
                </Polygon>
              ))}
              {beacons.map(b => (
                <Marker key={b._id} position={[b.position.x, b.position.y]} icon={beaconIcon} draggable={true} eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    api.updateBeacon(b._id, { position: { x: pos.lat, y: pos.lng } })
                      .then(() => {
                        setBeacons(beacons.map(q => q._id === b._id ? { ...q, position: { x: pos.lat, y: pos.lng } } : q));
                        toast.success('Beacon moved');
                      });
                  }
                }}>
                  <Tooltip direction="top" offset={[0, -10]}>{b.label || b.beaconId} (Drag to move)</Tooltip>
                </Marker>
              ))}
              {selectedFloor && <MapClickHandler onAdd={addBeacon} />}
            </MapContainer>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Beacon ID</th><th>UUID</th><th>Major/Minor</th><th>Label</th><th>Position</th><th>TX Power</th><th>Actions</th></tr></thead>
              <tbody>
                {beacons.map(b => (
                  <tr key={b._id}>
                    <td><code style={{ color: 'var(--accent-secondary)' }}>{b.beaconId}</code></td>
                    <td style={{ fontSize: 11 }}>{b.uuid}</td>
                    <td>{b.major}/{b.minor}</td>
                    <td>{b.label}</td>
                    <td>({b.position.x?.toFixed(6)}, {b.position.y?.toFixed(6)})</td>
                    <td>{b.txPower} dBm</td>
                    <td><button type="button" className="btn btn-danger btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteBeaconItem(b._id); }}><FiTrash2 /></button></td>
                  </tr>
                ))}
                {beacons.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No beacons configured</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal === 'beacon' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add BLE Beacon</h2>
              <button className="btn-icon" onClick={() => setShowModal(null)}>✕</button>
            </div>
            <form onSubmit={saveBeacon}>
              <div className="input-group"><label>Beacon ID</label><input className="input" required value={form.beaconId} onChange={e => setForm({ ...form, beaconId: e.target.value })} placeholder="e.g., BLE-001" /></div>
              <div className="input-group"><label>UUID</label><input className="input" required value={form.uuid} onChange={e => setForm({ ...form, uuid: e.target.value })} placeholder="e.g., FDA50693-A4E2-4FB1-AFCF-C6EB07647825" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group"><label>Major</label><input className="input" type="number" value={form.major} onChange={e => setForm({ ...form, major: e.target.value })} /></div>
                <div className="input-group"><label>Minor</label><input className="input" type="number" value={form.minor} onChange={e => setForm({ ...form, minor: e.target.value })} /></div>
              </div>
              <div className="input-group"><label>Label</label><input className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="input-group"><label>X</label><input className="input" type="number" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} /></div>
                <div className="input-group"><label>Y</label><input className="input" type="number" value={form.y} onChange={e => setForm({ ...form, y: e.target.value })} /></div>
                <div className="input-group"><label>TX Power</label><input className="input" type="number" value={form.txPower} onChange={e => setForm({ ...form, txPower: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Beacon</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
