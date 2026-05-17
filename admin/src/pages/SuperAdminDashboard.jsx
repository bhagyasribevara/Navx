import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { getAdmins, createCampusAdmin, deleteCampusAdmin, updateCampusAdmin } from '../api';
import './SuperAdminDashboard.css';

const VENUE_TYPES = [
  { value: 'campus', label: '🎓 Campus / University', color: '#6366f1' },
  { value: 'hospital', label: '🏥 Hospital / Clinic', color: '#ef4444' },
  { value: 'airport', label: '✈️ Airport', color: '#3b82f6' },
  { value: 'mall', label: '🛍️ Shopping Mall', color: '#f59e0b' },
  { value: 'building', label: '🏢 Large Building / Office', color: '#22c55e' },
  { value: 'other', label: '📍 Other Venue', color: '#94a3b8' },
];

const VENUE_BADGE_COLORS = {
  campus: '#6366f1',
  hospital: '#ef4444',
  airport: '#3b82f6',
  mall: '#f59e0b',
  building: '#22c55e',
  other: '#94a3b8',
};

const VENUE_ICONS = {
  campus: '🎓',
  hospital: '🏥',
  airport: '✈️',
  mall: '🛍️',
  building: '🏢',
  other: '📍',
};

export default function SuperAdminDashboard({ admin, onLogout }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
  const [venueType, setVenueType] = useState('campus');
  const [existingCampuses, setExistingCampuses] = useState([]);
  const [selectedCampusId, setSelectedCampusId] = useState('new');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Edit State
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    fetchAdmins();
    fetchCampuses();
  }, []);

  const fetchCampuses = async () => {
    try {
      const { getCampuses } = await import('../api');
      const { data } = await getCampuses();

      // Filter out duplicate campus names to prevent confusion
      const uniqueCampuses = [];
      const seenNames = new Set();

      for (const campus of data) {
        const normalizedName = campus.name.trim().toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueCampuses.push(campus);
        }
      }

      setExistingCampuses(uniqueCampuses);
    } catch (err) {
      console.error('Failed to fetch campuses', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data } = await getAdmins(admin._id);
      setAdmins(data);
    } catch (err) {
      toast.error('Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill all required fields');
      return;
    }

    let finalCampusName = campusName;
    let finalCampusAddress = campusAddress;
    let finalVenueType = venueType;

    if (selectedCampusId !== 'new') {
      const selected = existingCampuses.find(c => c._id === selectedCampusId);
      if (selected) {
        finalCampusName = selected.name;
        finalCampusAddress = selected.address;
        finalVenueType = selected.venueType || venueType;
      }
    } else if (!campusName) {
      toast.error('Please provide a venue name');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCampusAdmin({
        superAdminId: admin._id,
        newUsername: username,
        newPassword: password,
        campusName: finalCampusName,
        campusAddress: finalCampusAddress,
        venueType: finalVenueType
      });
      toast.success('Venue Admin created successfully');
      setUsername('');
      setPassword('');
      setCampusName('');
      setCampusAddress('');
      setVenueType('campus');
      setSelectedCampusId('new');
      fetchAdmins();
      fetchCampuses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to delete this admin? They will lose access immediately.')) return;

    try {
      await deleteCampusAdmin(admin._id, adminId);
      toast.success('Admin deleted successfully');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete admin');
    }
  };

  const startEditing = (a) => {
    setEditingAdminId(a._id);
    setEditUsername(a.username);
    setEditPassword(a.password || '');
  };

  const cancelEditing = () => {
    setEditingAdminId(null);
    setEditUsername('');
    setEditPassword('');
  };

  const handleUpdateAdmin = async (adminId) => {
    if (!editUsername || !editPassword) {
      toast.error('Username and password are required');
      return;
    }
    try {
      await updateCampusAdmin(admin._id, adminId, { username: editUsername, password: editPassword });
      toast.success('Admin credentials updated');
      setEditingAdminId(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update admin');
    }
  };

  const getVenueLabel = (type) => {
    const vt = VENUE_TYPES.find(v => v.value === type);
    return vt ? vt.label : '📍 Venue';
  };

  return (
    <div className="superadmin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">S</div>
          <div>
            <div className="sidebar-title">NavX</div>
            <div className="sidebar-subtitle">Super Admin</div>
          </div>
        </div>
        <nav className="sidebar-nav" style={{ padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Role: Super Admin</p>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>Supported Venues</p>
            {VENUE_TYPES.map(v => (
              <div key={v.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: v.color, display: 'inline-block' }} />
                <span>{v.label}</span>
              </div>
            ))}
          </div>
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div>NavX Admin v2.0</div>
          <div style={{ marginTop: '8px', cursor: 'pointer', color: 'var(--danger-color, #ef4444)' }} onClick={onLogout}>
            Logout
          </div>
        </div>
      </aside>

      <div className="main-content">
        <div className="top-bar">
          <div className="breadcrumbs">
            <span className="breadcrumb active">Super Admin Dashboard</span>
          </div>
        </div>

        <div className="page-container">
          <div className="dashboard-header">
            <div>
              <h1 className="page-title">Manage Venue Admins</h1>
              <p className="page-subtitle">Create administrators for campuses, hospitals, airports, malls, and large buildings.</p>
            </div>
          </div>

          <div className="dashboard-grid superadmin-grid">
            <div className="card form-card">
              <h3 className="card-title">Add New Venue Admin</h3>
              <form onSubmit={handleCreateAdmin} className="admin-form">
                <div className="form-group">
                  <label>Admin Username *</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. city_hospital_admin" />
                </div>
                <div className="form-group">
                  <label>Admin Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>

                <div className="form-group">
                  <label>Venue Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {VENUE_TYPES.map(v => (
                      <button
                        type="button"
                        key={v.value}
                        onClick={() => setVenueType(v.value)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: venueType === v.value ? `2px solid ${v.color}` : '2px solid var(--border-color)',
                          background: venueType === v.value ? v.color + '15' : 'var(--bg-card)',
                          color: venueType === v.value ? v.color : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 12,
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Assign to Venue *</label>
                  <select
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="input"
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="new" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Create a New Venue --</option>
                    {existingCampuses.map(c => (
                      <option key={c._id} value={c._id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {VENUE_ICONS[c.venueType] || '📍'} {c.name} {c.address ? `(${c.address})` : ''} [{c.venueType || 'campus'}]
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCampusId === 'new' && (
                  <>
                    <div className="form-group">
                      <label>New Venue Name *</label>
                      <input type="text" value={campusName} onChange={e => setCampusName(e.target.value)} placeholder={
                        venueType === 'hospital' ? 'e.g. City General Hospital' :
                          venueType === 'airport' ? 'e.g. Rajam International Airport' :
                            venueType === 'mall' ? 'e.g. Phoenix MarketCity' :
                              venueType === 'building' ? 'e.g. Tech Park Tower A' :
                                'e.g. GMRIT'
                      } />
                    </div>
                    <div className="form-group">
                      <label>Venue Address</label>
                      <input type="text" value={campusAddress} onChange={e => setCampusAddress(e.target.value)} placeholder="e.g. Rajam, Andhra Pradesh" />
                    </div>
                  </>
                )}
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ marginTop: '10px' }}>
                  {isSubmitting ? 'Creating...' : 'Create Venue Admin'}
                </button>
              </form>
            </div>

            <div className="card list-card">
              <h3 className="card-title">Existing Admins</h3>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="admin-list">
                  {admins.filter(a => a.role !== 'SuperAdmin').length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No venue admins found.</p>
                  ) : (
                    admins.filter(a => a.role !== 'SuperAdmin').map(a => {
                      const vType = a.managedVenueType || a.campusId?.venueType || 'campus';
                      const badgeColor = VENUE_BADGE_COLORS[vType] || '#94a3b8';
                      return (
                        <div key={a._id} className="admin-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>

                          {editingAdminId === a._id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                  className="input"
                                  value={editUsername}
                                  onChange={e => setEditUsername(e.target.value)}
                                  placeholder="Username"
                                  style={{ flex: 1 }}
                                />
                                <input
                                  className="input"
                                  value={editPassword}
                                  onChange={e => setEditPassword(e.target.value)}
                                  placeholder="Password"
                                  style={{ flex: 1 }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={cancelEditing}>
                                  <FiX /> Cancel
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => handleUpdateAdmin(a._id)}>
                                  <FiSave /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                              <div className="admin-info" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong>{a.username}</strong>
                                  <span className="badge" style={{ background: badgeColor + '20', color: badgeColor, border: `1px solid ${badgeColor}40` }}>
                                    {VENUE_ICONS[vType]} {vType.charAt(0).toUpperCase() + vType.slice(1)} Admin
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                                  Pass: {a.password}
                                </div>
                                <div className="admin-campus" style={{ marginTop: '12px', textAlign: 'left' }}>
                                  {a.campusId ? (
                                    <>
                                      <div style={{ fontWeight: 500 }}>{VENUE_ICONS[a.campusId.venueType || vType]} {a.campusId.name}</div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.campusId.address}</div>
                                    </>
                                  ) : (
                                    <span style={{ color: 'var(--danger-color)', fontWeight: 500 }}>No Venue Assigned</span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 10 }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(a);
                                  }}
                                  title="Edit Credentials"
                                >
                                  <FiEdit2 />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteAdmin(a._id);
                                  }}
                                  title="Delete Admin"
                                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
