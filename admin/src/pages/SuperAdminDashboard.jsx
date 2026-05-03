import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { getAdmins, createCampusAdmin, deleteCampusAdmin, updateCampusAdmin } from '../api';
import './SuperAdminDashboard.css';

export default function SuperAdminDashboard({ admin, onLogout }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
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
    
    if (selectedCampusId !== 'new') {
      const selected = existingCampuses.find(c => c._id === selectedCampusId);
      if (selected) {
        finalCampusName = selected.name;
        finalCampusAddress = selected.address;
      }
    } else if (!campusName) {
      toast.error('Please provide a new campus name');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCampusAdmin({
        superAdminId: admin._id,
        newUsername: username,
        newPassword: password,
        campusName: finalCampusName,
        campusAddress: finalCampusAddress
      });
      toast.success('Campus Admin created successfully');
      setUsername('');
      setPassword('');
      setCampusName('');
      setCampusAddress('');
      fetchAdmins();
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
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div>NavX Admin v1.0</div>
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
              <h1 className="page-title">Manage Campus Admins</h1>
              <p className="page-subtitle">Create administrators and assign them to specific campuses.</p>
            </div>
          </div>

          <div className="dashboard-grid superadmin-grid">
            <div className="card form-card">
              <h3 className="card-title">Add New Campus Admin</h3>
              <form onSubmit={handleCreateAdmin} className="admin-form">
                <div className="form-group">
                  <label>Admin Username *</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. gmrit_admin" />
                </div>
                <div className="form-group">
                  <label>Admin Password *</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>Assign to Campus *</label>
                  <select 
                    value={selectedCampusId} 
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="input"
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="new" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Create a New Campus --</option>
                    {existingCampuses.map(c => (
                      <option key={c._id} value={c._id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {c.name} {c.address ? `(${c.address})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedCampusId === 'new' && (
                  <>
                    <div className="form-group">
                      <label>New Campus Name *</label>
                      <input type="text" value={campusName} onChange={e => setCampusName(e.target.value)} placeholder="e.g. GMRIT" />
                    </div>
                    <div className="form-group">
                      <label>New Campus Address</label>
                      <input type="text" value={campusAddress} onChange={e => setCampusAddress(e.target.value)} placeholder="e.g. Rajam, Andhra Pradesh" />
                    </div>
                  </>
                )}
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ marginTop: '10px' }}>
                  {isSubmitting ? 'Creating...' : 'Create Admin & Campus'}
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
                    <p style={{ color: 'var(--text-muted)' }}>No campus admins found.</p>
                  ) : (
                    admins.filter(a => a.role !== 'SuperAdmin').map(a => (
                      <div key={a._id} className="admin-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                        
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="admin-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>{a.username}</strong>
                                <span className="badge">Campus Admin</span>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                Pass: {a.password}
                              </div>
                            </div>
                        <div className="admin-campus">
                          {a.campusId ? (
                            <>
                              <div>Campus: {a.campusId.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.campusId.address}</div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--danger-color)' }}>No Campus Assigned</span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => startEditing(a)}
                            title="Edit Credentials"
                          >
                            <FiEdit2 />
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleDeleteAdmin(a._id)}
                            title="Delete Admin"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                          </div>
                        )}
                      </div>
                    ))
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
