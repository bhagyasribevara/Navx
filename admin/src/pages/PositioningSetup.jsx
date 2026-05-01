import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2, FiDownload } from 'react-icons/fi';
import { MdQrCode2, MdBluetooth } from 'react-icons/md';
import * as api from '../api';

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

  useEffect(() => { api.getBlocks(campusId).then(r => setBlocks(r.data)); }, [campusId]);

  useEffect(() => {
    if (selectedBlock) api.getFloors(selectedBlock._id).then(r => { setFloors(r.data); if (r.data.length) setSelectedFloor(r.data[0]); });
  }, [selectedBlock]);

  useEffect(() => {
    if (selectedFloor) {
      api.getQRCodes(selectedFloor._id).then(r => setQrcodes(r.data));
      api.getBeacons(selectedFloor._id).then(r => setBeacons(r.data));
    }
  }, [selectedFloor]);

  const addQR = async () => {
    if (!selectedFloor) return toast.warn('Select a floor');
    try {
      const r = await api.createQRCode({
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        label: `QR Point ${qrcodes.length + 1}`, position: { x: 100, y: 100 }
      });
      setQrcodes([...qrcodes, r.data]);
      toast.success('QR code created');
    } catch { toast.error('Failed'); }
  };

  const addBeacon = () => {
    setForm({ beaconId: '', uuid: '', major: 1, minor: 1, label: '', x: 100, y: 100, txPower: -59 });
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
            <button className="btn btn-primary" onClick={addQR} disabled={!selectedFloor}><FiPlus /> Add QR Code</button>
            <button className="btn btn-secondary" onClick={exportAll} disabled={!selectedFloor}><FiDownload /> Export All for Printing</button>
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
                    <td style={{ fontSize: 13 }}>({qr.position.x}, {qr.position.y})</td>
                    <td>
                      {qrImages[qr._id] ? <img src={qrImages[qr._id]} style={{ width: 80 }} alt="QR" /> : <button className="btn btn-secondary btn-sm" onClick={() => showQRImage(qr)}>Generate</button>}
                    </td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => deleteQR(qr._id)}><FiTrash2 /></button></td>
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
            <button className="btn btn-primary" onClick={addBeacon} disabled={!selectedFloor}><FiPlus /> Add Beacon</button>
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
                    <td>({b.position.x}, {b.position.y})</td>
                    <td>{b.txPower} dBm</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => deleteBeaconItem(b._id)}><FiTrash2 /></button></td>
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
