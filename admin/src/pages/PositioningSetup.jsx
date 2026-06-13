import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { MdQrCode2, MdBluetooth } from 'react-icons/md';
import * as api from '../api';

/* ─── helpers ─────────────────────────────────────────── */
function downloadQR(dataUrl, label) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${label || 'qr-code'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ─── Beacon modal ────────────────────────────────────── */
function BeaconModal({ onClose, onSave }) {
  const [form, setForm] = useState({ beaconId: '', uuid: '', major: 1, minor: 1, label: '', txPower: -59, x: '', y: '' });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add BLE Beacon</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
          <div className="input-group"><label>Beacon ID</label><input className="input" required value={form.beaconId} onChange={e => setForm({ ...form, beaconId: e.target.value })} placeholder="e.g., BLE-001" /></div>
          <div className="input-group"><label>UUID</label><input className="input" required value={form.uuid} onChange={e => setForm({ ...form, uuid: e.target.value })} placeholder="FDA50693-A4E2-4FB1-AFCF-C6EB07647825" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group"><label>Major</label><input className="input" type="number" value={form.major} onChange={e => setForm({ ...form, major: e.target.value })} /></div>
            <div className="input-group"><label>Minor</label><input className="input" type="number" value={form.minor} onChange={e => setForm({ ...form, minor: e.target.value })} /></div>
          </div>
          <div className="input-group"><label>Label</label><input className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="input-group"><label>X (lat)</label><input className="input" type="number" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} /></div>
            <div className="input-group"><label>Y (lng)</label><input className="input" type="number" value={form.y} onChange={e => setForm({ ...form, y: e.target.value })} /></div>
            <div className="input-group"><label>TX Power</label><input className="input" type="number" value={form.txPower} onChange={e => setForm({ ...form, txPower: e.target.value })} /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Beacon</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────── */
export default function PositioningSetup() {
  const { campusId } = useParams();
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [qrcodes, setQrcodes] = useState([]);
  const [beacons, setBeacons] = useState([]);
  const [tab, setTab] = useState('qr');
  const [showBeaconModal, setShowBeaconModal] = useState(false);
  const [addingQR, setAddingQR] = useState(false);
  const isCreatingRef = useRef(false); // synchronous lock — prevents double-create

  // Load blocks once
  useEffect(() => {
    api.getBlocks(campusId).then(r => setBlocks(r.data)).catch(() => toast.error('Failed to load blocks'));
  }, [campusId]);

  // When block changes, load floors
  useEffect(() => {
    setFloors([]);
    setSelectedFloor(null);
    setQrcodes([]);
    setBeacons([]);
    if (!selectedBlock) return;
    api.getFloors(selectedBlock._id, campusId)
      .then(r => {
        setFloors(r.data);
        if (r.data.length) setSelectedFloor(r.data[0]);
        else toast.info('No floors found for this block');
      })
      .catch(() => toast.error('Failed to load floors'));
  }, [selectedBlock]);

  // When floor changes, load QR codes & beacons
  useEffect(() => {
    setQrcodes([]);
    setBeacons([]);
    if (!selectedFloor) return;
    api.getQRCodes(selectedFloor._id).then(r => setQrcodes(r.data)).catch(() => {});
    api.getBeacons(selectedFloor._id).then(r => setBeacons(r.data)).catch(() => {});
  }, [selectedFloor]);

  /* ── QR actions ── */
  const addQR = async () => {
    // Hard lock — synchronous ref prevents any second invocation
    if (isCreatingRef.current) return;
    if (!selectedFloor || !selectedBlock) return toast.warn('Select a block and floor first');
    isCreatingRef.current = true;
    setAddingQR(true);
    try {
      // Resolve campusId: prefer floor's campusId (authoritative from DB), then block's, then URL param
      const floorCampus = typeof selectedFloor.campusId === 'object' ? selectedFloor.campusId._id : selectedFloor.campusId;
      const blockCampus = typeof selectedBlock.campusId === 'object' ? selectedBlock.campusId._id : selectedBlock.campusId;
      const resolvedCampusId = String(floorCampus || blockCampus || campusId);
      
      let posX = 0;
      let posY = 0;
      if (selectedBlock.shape) {
        if (selectedBlock.shape.type === 'polygon' && selectedBlock.shape.points?.length > 0) {
          posX = selectedBlock.shape.points[0].x;
          posY = selectedBlock.shape.points[0].y;
        } else if (selectedBlock.shape.x !== undefined && selectedBlock.shape.y !== undefined) {
          posX = selectedBlock.shape.x;
          posY = selectedBlock.shape.y;
        }
      }

      const payload = {
        floorId: String(selectedFloor._id),
        blockId: String(selectedBlock._id),
        campusId: resolvedCampusId,
        label: `QR Point ${qrcodes.length + 1}`,
        position: { x: posX, y: posY }
      };
      console.log('Creating QR with payload:', payload);
      const r = await api.createQRCode(payload);
      setQrcodes(prev => [...prev, r.data]);
      toast.success('QR code created and saved to DB ✅');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create QR code';
      console.error('QR create error:', err?.response?.status, err?.response?.data || err);
      toast.error(msg);
    } finally {
      isCreatingRef.current = false;
      setAddingQR(false);
    }
  };

  const deleteQR = async (id) => {
    try {
      await api.deleteQRCode(id);
      setQrcodes(prev => prev.filter(q => q._id !== id));
      toast.success('QR code deleted');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete QR code';
      console.error('QR delete error:', err);
      toast.error(msg);
    }
  };

  const generateQRImage = async (qr) => {
    try {
      const r = await api.getQRImage(qr._id);
      setQrcodes(prev => prev.map(q => q._id === qr._id ? { ...q, image: r.data.image } : q));
    } catch { toast.error('Failed to generate QR image'); }
  };

  /* ── Beacon actions ── */
  const saveBeacon = async (form) => {
    try {
      const r = await api.createBeacon({
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        beaconId: form.beaconId, uuid: form.uuid, major: +form.major, minor: +form.minor,
        label: form.label, position: { x: +form.x, y: +form.y }, txPower: +form.txPower
      });
      setBeacons(prev => [...prev, r.data]);
      setShowBeaconModal(false);
      toast.success('Beacon added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteBeacon = async (id) => {
    if (!confirm('Delete beacon?')) return;
    await api.deleteBeacon(id);
    setBeacons(prev => prev.filter(b => b._id !== id));
    toast.success('Beacon deleted');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Positioning Setup</h1>
          <p className="page-subtitle">Configure QR codes and BLE beacons — managed block-wise &amp; floor-wise</p>
        </div>
      </div>

      {/* ── Block / Floor selectors ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Block</label>
          <select
            className="input"
            style={{ width: 220, fontSize: 14 }}
            value={selectedBlock?._id || ''}
            onChange={e => setSelectedBlock(blocks.find(b => b._id === e.target.value) || null)}
          >
            <option value="">— Select Block —</option>
            {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Floor</label>
          <select
            className="input"
            style={{ width: 220, fontSize: 14 }}
            value={selectedFloor?._id || ''}
            onChange={e => setSelectedFloor(floors.find(f => f._id === e.target.value) || null)}
            disabled={!selectedBlock}
          >
            <option value="">— Select Floor —</option>
            {floors.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>

        {/* Context badge */}
        {selectedBlock && selectedFloor && (
          <div style={{
            marginTop: 20,
            padding: '6px 16px',
            borderRadius: 99,
            background: 'linear-gradient(135deg, #6366f120, #8b5cf620)',
            border: '1px solid #6366f140',
            fontSize: 13,
            fontWeight: 600,
            color: '#818cf8'
          }}>
            📍 {selectedBlock.name} → {selectedFloor.name}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        <button
          className={`tool-btn ${tab === 'qr' ? 'active' : ''}`}
          onClick={() => setTab('qr')}
          style={{ padding: '8px 24px', fontSize: 13, borderRadius: 7 }}
        >
          <MdQrCode2 style={{ marginRight: 6 }} /> QR Codes ({qrcodes.length})
        </button>
        <button
          className={`tool-btn ${tab === 'beacon' ? 'active' : ''}`}
          onClick={() => setTab('beacon')}
          style={{ padding: '8px 24px', fontSize: 13, borderRadius: 7 }}
        >
          <MdBluetooth style={{ marginRight: 6 }} /> BLE Beacons ({beacons.length})
        </button>
      </div>

      {/* ═══════════ QR TAB ═══════════ */}
      {tab === 'qr' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={addQR}
              disabled={!selectedFloor || addingQR}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {addingQR ? <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <FiPlus />}
              {addingQR ? 'Generating...' : 'Add QR Code'}
            </button>
            {!selectedBlock && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>👈 Select a block first to manage QR codes</span>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>QR Code</th>
                  <th>Label</th>
                  <th>Block</th>
                  <th>Floor</th>
                  <th>QR Image</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {qrcodes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                      {selectedFloor ? 'No QR codes yet — click "Add QR Code" to create one' : 'Select a block and floor to view QR codes'}
                    </td>
                  </tr>
                )}
                {qrcodes.map(qr => (
                  <tr key={qr._id}>
                    <td>
                      <code style={{ color: 'var(--accent-secondary)', fontSize: 12 }}>{qr.code}</code>
                    </td>
                    <td>
                      <input
                        className="input"
                        value={qr.label}
                        style={{ width: 160, padding: '4px 8px', fontSize: 13 }}
                        onChange={e => {
                          const v = e.target.value;
                          setQrcodes(prev => prev.map(q => q._id === qr._id ? { ...q, label: v } : q));
                        }}
                        onBlur={e => api.updateQRCode(qr._id, { label: e.target.value })}
                      />
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        background: '#6366f118', color: '#818cf8', border: '1px solid #6366f130'
                      }}>
                        {selectedBlock?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e30'
                      }}>
                        {selectedFloor?.name || '—'}
                      </span>
                    </td>
                    <td>
                      {qr.image ? (
                        <img src={qr.image} style={{ width: 72, height: 72, borderRadius: 4, border: '1px solid var(--border)' }} alt="QR" />
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => generateQRImage(qr)}>
                          Generate
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        {qr.image && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Download QR as PNG"
                            onClick={() => downloadQR(qr.image, `${selectedBlock?.name || 'block'}_${selectedFloor?.name || 'floor'}_${qr.code}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <FiDownload size={13} /> Download
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          title="Delete QR code"
                          onClick={() => deleteQR(qr._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════ BEACON TAB ═══════════ */}
      {tab === 'beacon' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!selectedFloor) return toast.warn('Select a floor first');
                setShowBeaconModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FiPlus /> Add Beacon
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Beacon ID</th>
                  <th>UUID</th>
                  <th>Major / Minor</th>
                  <th>Label</th>
                  <th>Block</th>
                  <th>Floor</th>
                  <th>TX Power</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {beacons.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                      {selectedFloor ? 'No beacons configured' : 'Select a block and floor to view beacons'}
                    </td>
                  </tr>
                )}
                {beacons.map(b => (
                  <tr key={b._id}>
                    <td><code style={{ color: 'var(--accent-secondary)', fontSize: 12 }}>{b.beaconId}</code></td>
                    <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.uuid}</td>
                    <td>{b.major}/{b.minor}</td>
                    <td>{b.label}</td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: '#6366f118', color: '#818cf8', border: '1px solid #6366f130' }}>
                        {selectedBlock?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e30' }}>
                        {selectedFloor?.name || '—'}
                      </span>
                    </td>
                    <td>{b.txPower} dBm</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteBeacon(b._id)}>
                        <FiTrash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showBeaconModal && (
        <BeaconModal onClose={() => setShowBeaconModal(false)} onSave={saveBeacon} />
      )}
    </div>
  );
}
