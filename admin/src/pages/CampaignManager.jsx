import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiNavigation,
  FiCalendar, FiTag, FiUpload, FiChevronDown, FiChevronUp,
  FiLayers, FiX, FiArrowLeft
} from 'react-icons/fi';
import {
  getCampaigns, getSubCampaigns, createCampaign, updateCampaign,
  deleteCampaign, getBlocks, getFloors, getRooms, uploadImage
} from '../api';

const CATEGORIES = [
  'Admissions', 'Workshops', 'Seminars', 'Cultural Events', 'Conferences',
  'Administrative Announcements', 'Tech Events', 'Non-Tech Events', 'Hackathons',
  'Discounts', 'Flash Sales', 'Seasonal Offers', 'New Arrivals',
  'Doctor Availability', 'Department Updates', 'Lab Services', 'Emergency Notices',
  'Boarding Updates', 'Gate Changes', 'Check-In Information', 'General'
];

const SUB_TYPES = ['Tech', 'Non-Tech', 'Cultural', 'Workshop', 'Hackathon', 'Sports', 'Fun Events', 'General'];

const EMPTY_FORM = {
  title: '', description: '', image: '', category: 'General',
  subCampaignType: '', startDate: '', endDate: '', isActive: true,
  destination: { blockId: '', floorId: '', roomId: '' },
  parentId: null,
};

// ─── Sub-Campaign Row ─────────────────────────────────────────────────────────
function SubCampaignRow({ sub, onEdit, onDelete, onToggle, SOCKET_URL }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'var(--bg-color)', borderRadius: 10, border: '1px solid var(--border-color)',
      marginBottom: 8,
    }}>
      {sub.image && (
        <img
          src={sub.image.startsWith('http') ? sub.image : `http://localhost:5001${sub.image}`}
          alt="" style={{ width: 48, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
            padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            {sub.subCampaignType || sub.category || 'General'}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: sub.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: sub.isActive ? '#22c55e' : '#ef4444' }}>
            {sub.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{sub.title}</p>
        {sub.description && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub.description}
          </p>
        )}
        {sub.destination?.roomId?.name && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <FiNavigation size={10} /> {sub.destination.roomId.name}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={() => onEdit(sub)}
          style={{ padding: '5px 9px', fontSize: 11 }}>
          <FiEdit2 size={11} />
        </button>
        <button className={`btn ${sub.isActive ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => onToggle(sub)} style={{ padding: '5px 9px', fontSize: 11 }}>
          {sub.isActive ? <FiEyeOff size={11} /> : <FiEye size={11} />}
        </button>
        <button className="btn btn-secondary" onClick={() => onDelete(sub._id)}
          style={{ padding: '5px 9px', fontSize: 11, color: '#ef4444' }}>
          <FiTrash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({ c, onEdit, onDelete, onToggle, onAddSub, onEditSub, onDeleteSub, onToggleSub }) {
  const [expanded, setExpanded] = useState(false);
  const [subs, setSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const res = await getSubCampaigns(c._id);
      setSubs(res.data);
    } catch (e) { /* silent */ }
    setLoadingSubs(false);
  }, [c._id]);

  useEffect(() => {
    if (expanded) loadSubs();
  }, [expanded, loadSubs]);

  // Re-load subs when parent says to refresh
  const handleAddSub = () => {
    onAddSub(c);
    setExpanded(true);
  };

  return (
    <div className="card" style={{ overflow: 'hidden', opacity: c.isActive ? 1 : 0.65 }}>
      {c.image && (
        <div style={{ height: 120, background: `url(${c.image.startsWith('http') ? c.image : `http://localhost:5001${c.image}`}) center/cover`,
          borderBottom: '1px solid var(--border-color)' }} />
      )}
      <div style={{ padding: 16 }}>
        {/* Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
              padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
              {c.category || 'General'}
            </span>
            {c.subCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
                padding: '3px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiLayers size={10} /> {c.subCount} Sub-event{c.subCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: c.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: c.isActive ? '#22c55e' : '#ef4444' }}>
            {c.isActive ? 'Active' : 'Inactive'}
          </span>
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" onClick={() => onEdit(c)} style={{ flex: 1, fontSize: 12 }}>
            <FiEdit2 size={12} style={{ marginRight: 4 }} /> Edit
          </button>
          <button className={`btn ${c.isActive ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onToggle(c)}
            style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {c.isActive ? <><FiEyeOff size={12} style={{ marginRight: 4 }} />Unpublish</> : <><FiEye size={12} style={{ marginRight: 4 }} />Publish</>}
          </button>
          <button className="btn btn-secondary" onClick={() => onDelete(c._id)}
            style={{ flex: 1, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiTrash2 size={12} style={{ marginRight: 4 }} /> Delete
          </button>
        </div>

        {/* Sub-campaigns section */}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? 10 : 0 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setExpanded(e => !e)}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FiLayers size={12} />
              {expanded ? 'Hide' : 'Show'} Sub-events
              {c.subCount > 0 && <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{c.subCount}</span>}
              {expanded ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            </button>
            <button className="btn btn-primary" onClick={handleAddSub}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px' }}>
              <FiPlus size={12} /> Add Sub-event
            </button>
          </div>

          {expanded && (
            <div style={{ marginTop: 10 }}>
              {loadingSubs ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>Loading…</p>
              ) : subs.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12, background: 'var(--bg-color)', borderRadius: 8 }}>
                  No sub-events yet. Click "+ Add Sub-event" to create one.
                </p>
              ) : (
                subs.map(sub => (
                  <SubCampaignRow key={sub._id} sub={sub}
                    onEdit={(s) => onEditSub(s)}
                    onDelete={async (id) => {
                      if (!window.confirm('Delete this sub-event?')) return;
                      await deleteCampaign(id);
                      toast.success('Sub-event deleted');
                      loadSubs();
                    }}
                    onToggle={async (s) => {
                      await updateCampaign(s._id, { isActive: !s.isActive });
                      toast.success(s.isActive ? 'Sub-event deactivated' : 'Sub-event activated');
                      loadSubs();
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignManager({ admin }) {
  const context = useOutletContext() || {};
  const campusId = context.campus?._id || admin?.campusId?._id || admin?.campusId;
  const [campaigns, setCampaigns] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // campaign id being edited
  const [parentCampaign, setParentCampaign] = useState(null); // parent for sub-campaign creation
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (campusId) loadData(); }, [campusId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campRes, blockRes] = await Promise.all([
        getCampaigns(campusId).catch(() => ({ data: [] })),
        getBlocks(campusId).catch(() => ({ data: [] })),
      ]);
      setCampaigns(campRes.data);
      setBlocks(blockRes.data);
    } catch (e) { toast.error('Failed to load data'); }
    setLoading(false);
  };

  // Block → Floor → Room cascade
  useEffect(() => {
    if (form.destination.blockId) {
      getFloors(form.destination.blockId, campusId).then(res => setFloors(res.data)).catch(console.error);
    } else { setFloors([]); setRooms([]); }
  }, [form.destination.blockId]);

  useEffect(() => {
    if (form.destination.floorId) {
      getRooms(form.destination.floorId, form.destination.blockId).then(res => setRooms(res.data)).catch(console.error);
    } else { setRooms([]); }
  }, [form.destination.floorId, form.destination.blockId]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setParentCampaign(null); };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (c) => {
    const parent = c.parentId ? { _id: c.parentId } : null;
    setParentCampaign(parent);
    setForm({
      title: c.title, description: c.description || '', image: c.image || '',
      category: c.category || 'General', subCampaignType: c.subCampaignType || '',
      startDate: c.startDate?.split('T')[0] || '', endDate: c.endDate?.split('T')[0] || '',
      isActive: c.isActive,
      destination: {
        blockId: c.destination?.blockId?._id || c.destination?.blockId || '',
        floorId: c.destination?.floorId?._id || c.destination?.floorId || '',
        roomId: c.destination?.roomId?._id || c.destination?.roomId || '',
      },
      parentId: c.parentId || null,
    });
    setEditing(c._id);
    setShowForm(true);
  };

  const openAddSub = (parent) => {
    resetForm();
    setParentCampaign(parent);
    setForm({ ...EMPTY_FORM, parentId: parent._id, campusId });
    setShowForm(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage(file);
      setForm(f => ({ ...f, image: res.data.url }));
      toast.success('Image uploaded');
    } catch { toast.error('Failed to upload image'); }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form, campusId,
        startDate: form.startDate || new Date().toISOString(),
        endDate: form.endDate || null,
        parentId: form.parentId || null,
        destination: {
          blockId: form.destination.blockId || null,
          floorId: form.destination.floorId || null,
          roomId: form.destination.roomId || null,
        },
      };
      if (editing) {
        await updateCampaign(editing, payload);
        toast.success(parentCampaign ? 'Sub-event updated' : 'Campaign updated');
      } else {
        await createCampaign(payload);
        toast.success(parentCampaign ? 'Sub-event created!' : 'Campaign created!');
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign and all its sub-events?')) return;
    try {
      await deleteCampaign(id);
      toast.success('Deleted');
      loadData();
    } catch { toast.error('Delete failed'); }
  };

  const toggleActive = async (c) => {
    try {
      await updateCampaign(c._id, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Deactivated' : 'Activated');
      loadData();
    } catch { toast.error('Toggle failed'); }
  };

  const filtered = filter === 'all' ? campaigns
    : filter === 'active' ? campaigns.filter(c => c.isActive)
    : campaigns.filter(c => !c.isActive);

  const isSubForm = !!parentCampaign;

  if (!campusId) return <div className="card" style={{ padding: 40, textAlign: 'center' }}>No campus assigned.</div>;

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Campaign Manager</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Create campaigns and nested sub-events with navigation.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiPlus /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)} style={{ fontSize: 12, padding: '6px 14px', textTransform: 'capitalize' }}>
            {f} ({f === 'all' ? campaigns.length : f === 'active' ? campaigns.filter(c => c.isActive).length : campaigns.filter(c => !c.isActive).length})
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading campaigns…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <FiTag size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 600 }}>No campaigns found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click "+ New Campaign" to get started</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <CampaignCard
              key={c._id} c={c}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={toggleActive}
              onAddSub={openAddSub}
              onEditSub={openEdit}
              onDeleteSub={handleDelete}
              onToggleSub={toggleActive}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          paddingTop: 48, overflowY: 'auto',
        }} onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="card" style={{ width: 580, maxWidth: '92vw', padding: 28, maxHeight: '88vh', overflowY: 'auto', marginBottom: 48 }}
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              {isSubForm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                  background: 'rgba(139,92,246,0.15)', borderRadius: 8, fontSize: 12, color: '#8b5cf6', fontWeight: 700 }}>
                  <FiLayers size={13} />
                  Sub-event of: <strong>{parentCampaign?.title || '—'}</strong>
                </div>
              )}
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>
                {editing ? (isSubForm ? 'Edit Sub-event' : 'Edit Campaign') : (isSubForm ? '+ New Sub-event' : 'Create Campaign')}
              </h3>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Title *</label>
                  <input className="input" value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    required placeholder={isSubForm ? 'e.g. Hackathon 2025' : 'e.g. Stepcone 2025'} />
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Description</label>
                  <textarea className="input" rows={3} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe this event…" style={{ resize: 'vertical' }} />
                </div>

                {/* Category + Sub-type row */}
                <div style={{ display: 'grid', gridTemplateColumns: isSubForm ? '1fr 1fr' : '1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Category</label>
                    <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {isSubForm && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Sub-event Type</label>
                      <select className="input" value={form.subCampaignType} onChange={e => setForm({ ...form, subCampaignType: e.target.value })}>
                        <option value="">-- Select Type --</option>
                        {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Image Upload */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                    {isSubForm ? 'Sub-event Image' : 'Campaign Image'}
                  </label>
                  {form.image ? (
                    <div style={{ position: 'relative', width: 140, height: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <img src={form.image.startsWith('http') ? form.image : `http://localhost:5001${form.image}`}
                        alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setForm({ ...form, image: '' })}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer' }}>
                        <FiX size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input type="file" accept="image/*" onChange={handleImageUpload}
                        style={{ display: 'none' }} id="campaign-image-upload" />
                      <label htmlFor="campaign-image-upload" className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        {uploading ? '⏳ Uploading…' : <><FiUpload /> Upload Image</>}
                      </label>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

                {/* Destination / Navigation Setup */}
                <div style={{ padding: 14, background: 'var(--bg-color)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block' }}>
                    <FiNavigation size={12} style={{ marginRight: 5 }} />
                    Navigation Setup <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(where is this happening?)</span>
                  </label>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, marginTop: 0 }}>
                    Users tap "Navigate" to be guided here on the indoor map.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Block</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.blockId}
                        onChange={e => setForm({ ...form, destination: { blockId: e.target.value, floorId: '', roomId: '' } })}>
                        <option value="">-- Block --</option>
                        {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Floor</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.floorId}
                        disabled={!form.destination.blockId}
                        onChange={e => setForm({ ...form, destination: { ...form.destination, floorId: e.target.value, roomId: '' } })}>
                        <option value="">-- Floor --</option>
                        {floors.map(f => <option key={f._id} value={f._id}>{f.name} (L{f.level})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>Room</label>
                      <select className="input" style={{ fontSize: 13, padding: '6px 10px' }} value={form.destination.roomId}
                        disabled={!form.destination.floorId}
                        onChange={e => setForm({ ...form, destination: { ...form.destination, roomId: e.target.value } })}>
                        <option value="">-- Room --</option>
                        {rooms.map(r => <option key={r._id} value={r._id}>{r.name}{r.roomNumber ? ` (${r.roomNumber})` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                  Active (visible to users)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary"
                  onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Update' : 'Create'} {isSubForm ? 'Sub-event' : 'Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
