import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiMap } from 'react-icons/fi';
import { getCampuses, createCampus, updateCampus, deleteCampus } from '../api';

export default function CampusManager() {
  const [campuses, setCampuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', address: '' });
  const navigate = useNavigate();

  const load = () => getCampuses().then(r => setCampuses(r.data)).catch(e => toast.error('Failed to load'));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateCampus(editing._id, form);
        toast.success('Campus updated');
      } else {
        await createCampus(form);
        toast.success('Campus created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', address: '' });
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
    setForm({ name: c.name, description: c.description, address: c.address });
    setShowModal(true);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campus Management</h1>
          <p className="page-subtitle">Create and manage campus structures</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', address: '' }); setShowModal(true); }}>
          <FiPlus /> New Campus
        </button>
      </div>

      {campuses.length === 0 ? (
        <div className="empty-state">
          <h3>No campuses yet</h3>
          <p>Get started by creating your first campus</p>
        </div>
      ) : (
        <div className="card-grid">
          {campuses.map(c => (
            <div className="card" key={c._id}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{c.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.description || 'No description'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📍 {c.address || 'No address'}</p>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/editor/${c._id}`)}>
                  <FiMap /> Open Editor
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                  <FiEdit2 /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c._id)}>
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Campus' : 'New Campus'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Campus Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Main Campus" />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div className="input-group">
                <label>Address</label>
                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
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
