import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiNavigation, FiCalendar, FiTag, FiUpload } from 'react-icons/fi';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getBlocks, getFloors, getRooms, uploadImage } from '../api';

const CATEGORIES = [
  'Admissions', 'Workshops', 'Seminars', 'Cultural Events', 'Conferences', 'Administrative Announcements',
  'Discounts', 'Flash Sales', 'Seasonal Offers', 'New Arrivals',
  'Doctor Availability', 'Department Updates', 'Lab Services', 'Emergency Notices',
  'Boarding Updates', 'Gate Changes', 'Check-In Information', 'Lounge Access', 'Duty-Free Promotions'
];

export default function CampaignManager({ admin }) {
  const campusId = admin?.campusId;
  const [campaigns, setCampaigns] = useState([]);
  
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    title: '', description: '', image: '', category: 'Workshops',
    startDate: '', endDate: '', isActive: true,
    destination: { blockId: '', floorId: '', roomId: '' }
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (campusId) loadData(); }, [campusId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const campRes = await getCampaigns(campusId).catch(e => {
        console.error('Failed to fetch campaigns', e);
        return { data: [] };
      });
      const blockRes = await getBlocks(campusId).catch(e => {
        console.error('Failed to fetch blocks', e);
        return { data: [] };
      });
      setCampaigns(campRes.data);
      setBlocks(blockRes.data);
    } catch (e) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (form.destination.blockId) {
      getFloors(form.destination.blockId).then(res => setFloors(res.data)).catch(console.error);
    } else {
      setFloors([]);
      setRooms([]);
    }
  }, [form.destination.blockId]);

  useEffect(() => {
    if (form.destination.floorId) {
      getRooms(form.destination.floorId, form.destination.blockId).then(res => setRooms(res.data)).catch(console.error);
    } else {
      setRooms([]);
    }
  }, [form.destination.floorId, form.destination.blockId]);

  const resetForm = () => {
    setForm({
      title: '', description: '', image: '', category: 'Workshops',
      startDate: '', endDate: '', isActive: true,
      destination: { blockId: '', floorId: '', roomId: '' }
    });
    setEditing(null);
  };

  const openEdit = (c) => {
    setForm({
      title: c.title, description: c.description, image: c.image || '',
      category: c.category, startDate: c.startDate?.split('T')[0] || '',
      endDate: c.endDate?.split('T')[0] || '', isActive: c.isActive,
      destination: { 
        blockId: c.destination?.blockId?._id || c.destination?.blockId || '',
        floorId: c.destination?.floorId?._id || c.destination?.floorId || '',
        roomId: c.destination?.roomId?._id || c.destination?.roomId || '' 
      }
    });
    setEditing(c._id);
    setShowForm(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage(file);
      setForm({ ...form, image: res.data.url });
      toast.success('Image uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload image');
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        campusId,
        startDate: form.startDate || new Date().toISOString(),
        endDate: form.endDate || null,
        destination: { 
          blockId: form.destination.blockId || null,
          floorId: form.destination.floorId || null,
          roomId: form.destination.roomId || null 
        }
      };

      if (editing) {
        await updateCampaign(editing, payload);
        toast.success('Campaign updated');
      } else {
        await createCampaign(payload);
        toast.success('Campaign created');
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save campaign');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await deleteCampaign(id);
      toast.success('Campaign deleted');
      loadData();
    } catch (e) { toast.error('Delete failed'); }
  };

  const toggleActive = async (c) => {
    try {
      await updateCampaign(c._id, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Campaign deactivated' : 'Campaign activated');
      loadData();
    } catch (e) { toast.error('Toggle failed'); }
  };

  const filtered = filter === 'all' ? campaigns
    : filter === 'active' ? campaigns.filter(c => c.isActive)
    : filter === 'inactive' ? campaigns.filter(c => !c.isActive)
    : campaigns.filter(c => c.category === filter);

  if (!campusId) return <div className="card" style={{ padding: 40, textAlign: 'center' }}>No campus assigned to this admin.</div>;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Campaign Manager</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Create and manage location-specific active updates.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiPlus /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)} style={{ fontSize: 12, padding: '6px 14px', textTransform: 'capitalize' }}>
            {f} {f === 'all' ? `(${campaigns.length})` : f === 'active' ? `(${campaigns.filter(c => c.isActive).length})` : `(${campaigns.filter(c => !c.isActive).length})`}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading campaigns...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <FiTag size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 600 }}>No campaigns found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Create your first campaign to get started</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <div key={c._id} className="card" style={{ overflow: 'hidden', opacity: c.isActive ? 1 : 0.6 }}>
              {c.image && (
                <div style={{ height: 120, background: `url(${c.image}) center/cover`, borderBottom: '1px solid var(--border-color)' }} />
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
                    padding: '3px 8px', borderRadius: 4, background: 'var(--primary-alpha, rgba(99,102,241,0.15))',
                    color: 'var(--primary-color, #6366f1)',
                  }}>{c.category || 'General'}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: c.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: c.isActive ? '#22c55e' : '#ef4444',
                    }}>{c.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{c.title}</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {c.description}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {c.startDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiCalendar size={11} /> {new Date(c.startDate).toLocaleDateString()}</span>}
                  {c.destination?.roomId?.name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiNavigation size={11} /> {c.destination.roomId.name}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => openEdit(c)} style={{ flex: 1, fontSize: 12 }}>
                    <FiEdit2 size={12} style={{ marginRight: 4 }} /> Edit
                  </button>
                  <button className={`btn ${c.isActive ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(c)} style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.isActive ? <><FiEyeOff size={12} style={{ marginRight: 4 }} /> Unpublish</> : <><FiEye size={12} style={{ marginRight: 4 }} /> Publish</>}
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleDelete(c._id)}
                    style={{ flex: 1, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiTrash2 size={12} style={{ marginRight: 4 }} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          paddingTop: 60, overflowY: 'auto',
        }} onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="card" style={{ width: 560, maxWidth: '90vw', padding: 24, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>
              {editing ? 'Edit Campaign' : 'Create Campaign'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Title *</label>
                  <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    required placeholder="Campaign title" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Description</label>
                  <textarea className="input" rows={3} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe this campaign..." style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Category</label>
                  <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Campaign Image</label>
                  {form.image ? (
                    <div style={{ marginBottom: 10, position: 'relative', width: 120, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <img src={form.image.startsWith('http') ? form.image : `http://localhost:5000${form.image}`} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setForm({...form, image: ''})} 
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer' }}>
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        style={{ display: 'none' }} 
                        id="image-upload" 
                      />
                      <label htmlFor="image-upload" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        {uploading ? 'Uploading...' : <><FiUpload /> Upload Image</>}
                      </label>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Start Date</label>
                    <input className="input" type="date" value={form.startDate}
                      onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>End Date</label>
                    <input className="input" type="date" value={form.endDate}
                      onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--bg-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'block' }}>Destination Selection</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {/* Block Select */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Block</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.blockId}
                        onChange={e => setForm({ ...form, destination: { blockId: e.target.value, floorId: '', roomId: '' } })}>
                        <option value="">-- Select Block --</option>
                        {blocks.map(b => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Floor Select */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Floor</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.floorId} disabled={!form.destination.blockId}
                        onChange={e => setForm({ ...form, destination: { ...form.destination, floorId: e.target.value, roomId: '' } })}>
                        <option value="">-- Select Floor --</option>
                        {floors.map(f => (
                          <option key={f._id} value={f._id}>{f.name} (L{f.level})</option>
                        ))}
                      </select>
                    </div>

                    {/* Room Select */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Room</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.roomId} disabled={!form.destination.floorId}
                        onChange={e => setForm({ ...form, destination: { ...form.destination, roomId: e.target.value } })}>
                        <option value="">-- Select Room --</option>
                        {rooms.map(r => (
                          <option key={r._id} value={r._id}>{r.name}{r.roomNumber ? ` (${r.roomNumber})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.isActive}
                      onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                    Active Campaign
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'} Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
