import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2, FiEdit2, FiSave, FiX, FiCopy, FiExternalLink, FiRefreshCw, FiKey, FiLock, FiUnlock } from 'react-icons/fi';
import { 
  getAdmins, 
  createCampusAdmin, 
  deleteCampusAdmin, 
  updateCampusAdmin,
  toggleAdminStatus,
  revokeAdminSessions,
  regenerateCampusUrl
} from '../api';
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
  const [campusCode, setCampusCode] = useState('');
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
    } else {
      if (!campusName) {
        toast.error('Please provide a venue name');
        return;
      }
      if (!campusCode) {
        toast.error('Please provide a unique campus code');
        return;
      }
      // Alphanumeric code validation
      const codeRegex = /^[a-z0-9-_]+$/;
      if (!codeRegex.test(campusCode.trim())) {
        toast.error('Campus code must contain only lowercase letters, numbers, hyphens, and underscores.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createCampusAdmin({
        superAdminId: admin._id,
        newUsername: username,
        newPassword: password,
        campusName: finalCampusName,
        campusAddress: finalCampusAddress,
        venueType: finalVenueType,
        campusCode: selectedCampusId === 'new' ? campusCode.trim().toLowerCase() : undefined
      });
      toast.success('Venue Admin and Campus Workspace created!');
      setUsername('');
      setPassword('');
      setCampusName('');
      setCampusAddress('');
      setCampusCode('');
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
      fetchCampuses();
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
    if (!editUsername) {
      toast.error('Username is required');
      return;
    }
    try {
      const payload = { username: editUsername };
      if (editPassword) payload.password = editPassword;
      
      await updateCampusAdmin(admin._id, adminId, payload);
      toast.success('Admin credentials updated');
      setEditingAdminId(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update admin');
    }
  };

  // Toggle Admin Status Active/Disabled (Phase 10, 12)
  const handleToggleStatus = async (adminId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const msg = `Are you sure you want to ${nextStatus === 'active' ? 'Enable' : 'Disable'} this admin workspace?`;
    if (!window.confirm(msg)) return;

    try {
      await toggleAdminStatus(adminId, nextStatus);
      toast.success(`Admin account is now ${nextStatus}`);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  // Invalidate JWT tokens / Revoke Sessions (Phase 10, 12)
  const handleRevokeSessions = async (adminId) => {
    if (!window.confirm('Revoke all active login sessions for this admin? They will be signed out instantly.')) return;

    try {
      await revokeAdminSessions(adminId);
      toast.success('All sessions revoked successfully');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke sessions');
    }
  };

  // Regenerate Campus URL code (Phase 10, 11)
  const handleRegenerateUrl = async (campusId, currentCode) => {
    const newCode = window.prompt(`Enter a new unique campus code for the URL:`, currentCode);
    if (!newCode || newCode.trim() === '' || newCode.trim() === currentCode) return;

    const codeRegex = /^[a-z0-9-_]+$/;
    if (!codeRegex.test(newCode.trim())) {
      toast.error('Code must contain only lowercase letters, numbers, hyphens, and underscores.');
      return;
    }

    try {
      await regenerateCampusUrl(campusId, newCode.trim().toLowerCase());
      toast.success('Campus URL regenerated successfully. All old sessions invalidated.');
      fetchAdmins();
      fetchCampuses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to regenerate URL');
    }
  };

  const getWorkspaceLocalLink = (url) => {
    if (!url) return '#';
    try {
      const urlObj = new URL(url);
      // Ensure the link always uses the current domain (resolves localhost and production domains dynamically)
      return window.location.origin + urlObj.pathname + urlObj.search + urlObj.hash;
    } catch (e) {
      return url;
    }
  };

  const handleCopyUrl = (url) => {
    if (!url) return;
    const finalUrl = getWorkspaceLocalLink(url);
    navigator.clipboard.writeText(finalUrl);
    toast.success('URL copied to clipboard!');
  };

  return (
    <div className="superadmin-layout">
      <header className="top-navbar" style={{ height: '96px' }}>
        <div className="navbar-wrapper" style={{ maxWidth: '100%', padding: '0 32px' }}>
          <div className="navbar-left">
            <img src="/navx-icon.png" alt="NavX Logo" className="navbar-logo super-logo" style={{ objectFit: 'cover' }} />
            <div>
              <div className="navbar-title">NavX</div>
              <div className="navbar-subtitle">Super Admin Console</div>
            </div>
          </div>
          <nav className="navbar-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div className="nav-info-banner">
              ✨ Super Admin Dashboard
            </div>
            <div className="venues-legend-inline" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>Supported:</span>
              {VENUE_TYPES.map(v => (
                <div key={v.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: v.color, display: 'inline-block' }} />
                  <span>{v.label.split(' ').slice(1).join(' ')}</span>
                </div>
              ))}
            </div>
          </nav>
          <div className="navbar-right">
            <button className="btn-logout" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="main-content" style={{ marginTop: 0, paddingTop: '96px' }}>
        <div className="page-container">
          <div className="dashboard-header">
            <div>
              <h1 className="page-title">Manage Venue Workspace Admins</h1>
              <p className="page-subtitle">Create administrators and generate dedicated workspace URLs for campuses, hospitals, airports, malls & buildings.</p>
            </div>
          </div>

          <div className="dashboard-grid superadmin-grid">
            <div className="card form-card">
              <h3 className="card-title">Create Admin & Venue Workspace</h3>
              <form onSubmit={handleCreateAdmin} className="admin-form">
                <div className="form-group">
                  <label>Admin Username *</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. gmr_admin" required />
                </div>
                <div className="form-group">
                  <label>Admin Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
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
                        {VENUE_ICONS[c.venueType] || '📍'} {c.name} {c.address ? `(${c.address})` : ''}
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
                                'e.g. GMRIT Campus'
                      } required />
                    </div>
                    <div className="form-group">
                      <label>Campus Code * <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(for URL, e.g. "gmr")</span></label>
                      <input type="text" value={campusCode} onChange={e => setCampusCode(e.target.value)} placeholder="e.g. gmr" required />
                    </div>
                    <div className="form-group">
                      <label>Venue Address</label>
                      <input type="text" value={campusAddress} onChange={e => setCampusAddress(e.target.value)} placeholder="e.g. Rajam, Andhra Pradesh" />
                    </div>
                  </>
                )}
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }}>
                  {isSubmitting ? 'Creating...' : 'Create Admin & Generate URL'}
                </button>
              </form>
            </div>

            <div className="card list-card">
              <h3 className="card-title">Existing Admin Workspaces</h3>
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
                      const isUserDisabled = a.status === 'disabled' || a.campusId?.status === 'disabled';
                      return (
                        <div key={a._id} className="admin-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', opacity: isUserDisabled ? 0.7 : 1 }}>

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
                                  placeholder="New Password (optional)"
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                <div className="admin-info" style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong style={{ fontSize: '15px' }}>{a.username}</strong>
                                    <span className="badge" style={{ background: badgeColor + '20', color: badgeColor, border: `1px solid ${badgeColor}40` }}>
                                      {VENUE_ICONS[vType]} {vType.toUpperCase()} Admin
                                    </span>
                                    {isUserDisabled && <span className="badge badge-danger">DISABLED</span>}
                                  </div>
                                  
                                  <div className="admin-campus" style={{ marginTop: '8px', textAlign: 'left' }}>
                                    {a.campusId ? (
                                      <>
                                        <div style={{ fontWeight: 600 }}>{VENUE_ICONS[a.campusId.venueType || vType]} {a.campusId.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{a.campusId.address || 'No address registered'}</div>
                                      </>
                                    ) : (
                                      <span style={{ color: 'var(--danger-color)', fontWeight: 500 }}>No Venue Assigned</span>
                                    )}
                                  </div>

                                  {/* URL Display (Phase 2, 10) */}
                                  {a.campusId?.adminUrl ? (
                                    <div style={{ 
                                      marginTop: 12, 
                                      padding: '8px 12px', 
                                      background: 'var(--bg-input)', 
                                      border: '1px solid var(--border-color)', 
                                      borderRadius: 8, 
                                      fontSize: 12, 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between', 
                                      fontFamily: 'monospace' 
                                    }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                        {getWorkspaceLocalLink(a.campusId.adminUrl)}
                                      </span>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button 
                                          type="button" 
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 2 }}
                                          onClick={() => handleCopyUrl(a.campusId.adminUrl)}
                                          title="Copy URL"
                                        >
                                          <FiCopy size={13} />
                                        </button>
                                        <a 
                                          href={getWorkspaceLocalLink(a.campusId.adminUrl)} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          style={{ color: '#22c55e', display: 'flex', alignItems: 'center', padding: 2 }}
                                          title="Open Workspace"
                                        >
                                          <FiExternalLink size={13} />
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    a.campusId && (
                                      <div style={{ 
                                        marginTop: 12, 
                                        padding: '8px 12px', 
                                        background: 'rgba(245, 158, 11, 0.1)', 
                                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                                        borderRadius: 8, 
                                        fontSize: 12, 
                                        color: '#f59e0b',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between'
                                      }}>
                                        <span>⚠️ No Workspace URL generated yet.</span>
                                        <button 
                                          type="button" 
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: 10, padding: '2px 8px', background: '#f59e0b20', color: '#f59e0b', borderColor: '#f59e0b40', cursor: 'pointer' }}
                                          onClick={() => handleRegenerateUrl(a.campusId._id, '')}
                                        >
                                          Generate URL
                                        </button>
                                      </div>
                                    )
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 10, marginLeft: 16 }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => startEditing(a)}
                                    title="Edit Credentials"
                                  >
                                    <FiEdit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteAdmin(a._id)}
                                    title="Delete Admin"
                                    style={{ backgroundColor: '#ef4444', color: '#fff' }}
                                  >
                                    <FiTrash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              {/* Extra admin controls (Phase 10: Status, Reset, Revoke, Regenerate) */}
                              {a.campusId && (
                                <div style={{ 
                                  display: 'flex', 
                                  gap: 8, 
                                  flexWrap: 'wrap', 
                                  marginTop: 8, 
                                  paddingTop: 10, 
                                  borderTop: '1px dashed var(--border-color)' 
                                }}>
                                  <button 
                                    className={`btn-control ${a.status === 'active' ? 'btn-control-danger' : 'btn-control-primary'}`}
                                    onClick={() => handleToggleStatus(a._id, a.status)}
                                  >
                                    {a.status === 'active' ? <><FiLock size={11} /> Disable Workspace</> : <><FiUnlock size={11} /> Enable Workspace</>}
                                  </button>
                                  <button 
                                    className="btn-control btn-control-warning"
                                    onClick={() => handleRevokeSessions(a._id)}
                                  >
                                    <FiKey size={11} /> Revoke Sessions
                                  </button>
                                  <button 
                                    className="btn-control btn-control-primary"
                                    onClick={() => handleRegenerateUrl(a.campusId._id, a.campusId.campusCode)}
                                  >
                                    <FiRefreshCw size={11} /> Regenerate URL
                                  </button>
                                </div>
                              )}
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
