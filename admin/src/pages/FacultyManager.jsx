import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useOutletContext } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiUsers, FiSearch } from 'react-icons/fi';

const DEPARTMENTS = ['CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'MBA', 'MCA'];

export default function FacultyManager({ admin }) {
  const { campus } = useOutletContext();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '',
    employeeId: '',
    department: 'CSE',
    designation: 'Assistant Professor',
    email: '',
    phone: '',
    facultyRoom: '',
    subjects: '',
    assignedSections: '',
    username: '',
    password: '',
    status: 'active'
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("navx_token");
  const headers = { Authorization: `Bearer ${token}` };

  const loadFaculties = async () => {
    setLoading(true);
    try {
      // Find all faculties for this campus
      const campusId = campus._id;
      // Define a custom API fetch for faculties on this campus
      const res = await axios.get(`${API_BASE}/campus/${campusId}/faculties`, { headers });
      setFaculties(res.data.faculties || []);
    } catch (e) {
      toast.error('Failed to load faculty roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campus?._id) {
      loadFaculties();
    }
  }, [campus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.employeeId || !form.email || !form.username || (!editing && !form.password)) {
      toast.error('Please fill all required fields');
      return;
    }

    const payload = {
      ...form,
      campusId: campus._id,
      subjects: form.subjects.split(',').map(s => s.trim()).filter(Boolean),
      assignedSections: form.assignedSections.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      if (editing) {
        await axios.put(`${API_BASE}/campus/${campus._id}/faculties/${editing._id}`, payload, { headers });
        toast.success('Faculty details updated!');
      } else {
        await axios.post(`${API_BASE}/campus/${campus._id}/faculties`, payload, { headers });
        toast.success('New Faculty created!');
      }
      setShowModal(false);
      setEditing(null);
      resetForm();
      loadFaculties();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit form');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      employeeId: '',
      department: 'CSE',
      designation: 'Assistant Professor',
      email: '',
      phone: '',
      facultyRoom: '',
      subjects: '',
      assignedSections: '',
      username: '',
      password: '',
      status: 'active'
    });
  };

  const handleEdit = (f) => {
    setEditing(f);
    setForm({
      name: f.name,
      employeeId: f.employeeId,
      department: f.department,
      designation: f.designation,
      email: f.email,
      phone: f.phone,
      facultyRoom: f.facultyRoom,
      subjects: f.subjects?.join(', ') || '',
      assignedSections: f.assignedSections?.join(', ') || '',
      username: f.username,
      password: '', // blank by default for edit
      status: f.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this faculty member?')) return;
    try {
      await axios.delete(`${API_BASE}/campus/${campus._id}/faculties/${id}`, { headers });
      toast.success('Faculty deleted successfully');
      loadFaculties();
    } catch (err) {
      toast.error('Failed to delete faculty');
    }
  };

  const handleResetPassword = async (f) => {
    const newPass = prompt(`Enter new password for ${f.name}:`);
    if (!newPass) return;
    try {
      await axios.post(`${API_BASE}/campus/${campus._id}/faculties/${f._id}/reset-password`, { password: newPass }, { headers });
      toast.success('Password reset successfully!');
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  const filteredFaculties = faculties.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Management</h1>
          <p className="page-subtitle">Add, edit, and configure teaching staff, class timetables, and cabins for {campus?.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>
          <FiPlus /> Add Faculty
        </button>
      </div>

      {/* Roster Panel */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiUsers /> Registered Faculty ({faculties.length})</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 12px', width: '300px' }}>
            <FiSearch style={{ color: 'var(--text-muted)', marginRight: 8 }} />
            <input 
              type="text" 
              placeholder="Search faculty..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        {loading ? (
          <p>Loading roster...</p>
        ) : filteredFaculties.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No faculty matching query found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="venues-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Faculty Cabin</th>
                  <th>Office Hours</th>
                  <th>Assigned Sections</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculties.map(f => (
                  <tr key={f._id}>
                    <td><strong>{f.employeeId}</strong></td>
                    <td>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.designation}</div>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background: '#6366f120', color: '#6366f1' }}>{f.department}</span></td>
                    <td>{f.facultyRoom}</td>
                    <td style={{ fontSize: 12 }}>{f.officeHours}</td>
                    <td style={{ fontSize: 12 }}>{f.assignedSections?.join(', ') || 'None'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(f)} title="Edit"><FiEdit2 size={12} /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(f)} title="Reset Password"><FiKey size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f._id)} title="Delete" style={{ backgroundColor: '#ef4444', color: '#fff' }}><FiTrash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '650px', maxHeight: '90%', overflowY: 'auto', padding: 24 }}>
            <h3 className="card-title">{editing ? 'Edit Faculty Details' : 'Add New Faculty Member'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="input" required />
                </div>
                <div className="form-group">
                  <label>Employee ID *</label>
                  <input type="text" value={form.employeeId} onChange={e => setForm(prev => ({ ...prev, employeeId: e.target.value }))} className="input" required />
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select value={form.department} onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))} className="input">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input type="text" value={form.designation} onChange={e => setForm(prev => ({ ...prev, designation: e.target.value }))} className="input" />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} className="input" required />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} className="input" />
                </div>
                <div className="form-group">
                  <label>Faculty Cabin Room (e.g. F-12) *</label>
                  <input type="text" value={form.facultyRoom} onChange={e => setForm(prev => ({ ...prev, facultyRoom: e.target.value }))} className="input" required />
                </div>
                <div className="form-group">
                  <label>Office Hours</label>
                  <input type="text" value={form.officeHours} onChange={e => setForm(prev => ({ ...prev, officeHours: e.target.value }))} placeholder="e.g. 10:00 AM - 1:00 PM" className="input" />
                </div>
                <div className="form-group">
                  <label>Assigned Subjects (comma-separated)</label>
                  <input type="text" value={form.subjects} onChange={e => setForm(prev => ({ ...prev, subjects: e.target.value }))} placeholder="e.g. DBMS, OS" className="input" />
                </div>
                <div className="form-group">
                  <label>Assigned Sections (comma-separated)</label>
                  <input type="text" value={form.assignedSections} onChange={e => setForm(prev => ({ ...prev, assignedSections: e.target.value }))} placeholder="e.g. A, B" className="input" />
                </div>
                <div className="form-group">
                  <label>Username *</label>
                  <input type="text" value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))} className="input" required />
                </div>
                {!editing && (
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className="input" required />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
