import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useOutletContext } from 'react-router-dom';
import { FiPlus, FiTrash2, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const DEPARTMENTS = ['CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'MBA', 'MCA'];

export default function TimetableAllocation({ admin }) {
  const { campus } = useOutletContext();
  const [timetable, setTimetable] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [selectedDept, setSelectedDept] = useState('CSE');
  const [selectedSem, setSelectedSem] = useState('6');
  const [selectedSec, setSelectedSec] = useState('A');

  // Form
  const [form, setForm] = useState({
    dayOfWeek: 'Monday',
    period: 1,
    subject: '',
    roomName: '',
    roomId: '',
    facultyId: '',
    startTime: '09:00 AM',
    endTime: '10:00 AM'
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("navx_token");
  const headers = { Authorization: `Bearer ${token}` };

  const loadData = async () => {
    setLoading(true);
    try {
      const campusId = campus._id;
      // Load full timetable
      const timetableRes = await axios.get(`${API_BASE}/campus/${campusId}/timetable`, { headers });
      setTimetable(timetableRes.data.timetable || []);

      // Load faculties
      const facultyRes = await axios.get(`${API_BASE}/campus/${campusId}/faculties`, { headers });
      setFaculties(facultyRes.data.faculties || []);

      // Load campus rooms
      const roomsRes = await axios.get(`${API_BASE}/rooms?campusId=${campusId}`, { headers });
      setRooms(roomsRes.data || []);
    } catch (e) {
      toast.error('Failed to load timetables or support data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campus?._id) {
      loadData();
    }
  }, [campus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.roomName || !form.facultyId) {
      toast.error('Please fill all fields');
      return;
    }

    const selectedFaculty = faculties.find(f => f._id === form.facultyId);
    const selectedRoom = rooms.find(r => r.name === form.roomName);

    const payload = {
      ...form,
      campusId: campus._id,
      department: selectedDept,
      semester: selectedSem,
      section: selectedSec,
      facultyName: selectedFaculty ? selectedFaculty.name : 'Unknown',
      roomId: selectedRoom ? selectedRoom._id : null
    };

    try {
      await axios.post(`${API_BASE}/campus/${campus._id}/timetable`, payload, { headers });
      toast.success('Timetable slot allocated successfully!');
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate slot');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      await axios.delete(`${API_BASE}/campus/${campus._id}/timetable/${id}`, { headers });
      toast.success('Slot removed successfully');
      loadData();
    } catch (e) {
      toast.error('Failed to delete slot');
    }
  };

  // Run Conflict Detection
  const detectConflicts = () => {
    const conflicts = [];
    const roomBookingMap = {}; // key: "roomName-day-period" -> [slots]
    const facultyBookingMap = {}; // key: "facultyId-day-period" -> [slots]
    const sectionBookingMap = {}; // key: "dept-sem-sec-day-period" -> [slots]

    timetable.forEach(slot => {
      const roomKey = `${slot.roomName}-${slot.dayOfWeek}-${slot.period}`;
      const facultyKey = `${slot.facultyId}-${slot.dayOfWeek}-${slot.period}`;
      const sectionKey = `${slot.department}-${slot.semester}-${slot.section}-${slot.dayOfWeek}-${slot.period}`;

      if (!roomBookingMap[roomKey]) roomBookingMap[roomKey] = [];
      roomBookingMap[roomKey].push(slot);

      if (!facultyBookingMap[facultyKey]) facultyBookingMap[facultyKey] = [];
      facultyBookingMap[facultyKey].push(slot);

      if (!sectionBookingMap[sectionKey]) sectionBookingMap[sectionKey] = [];
      sectionBookingMap[sectionKey].push(slot);
    });

    // Check Room clashes
    Object.keys(roomBookingMap).forEach(key => {
      const slots = roomBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Room Conflict',
          desc: `Room ${slots[0].roomName} is double-booked for Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `${s.department} ${s.semester}-${s.section} (${s.subject})`).join(' vs ')
        });
      }
    });

    // Check Faculty clashes
    Object.keys(facultyBookingMap).forEach(key => {
      const slots = facultyBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Faculty Conflict',
          desc: `Faculty ${slots[0].facultyName} is scheduled to teach multiple sections at Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `${s.department} ${s.semester}-${s.section} in ${s.roomName}`).join(' vs ')
        });
      }
    });

    // Check Section collision
    Object.keys(sectionBookingMap).forEach(key => {
      const slots = sectionBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Section Conflict',
          desc: `Section ${slots[0].department} Sem ${slots[0].semester}-${slots[0].section} has slot collision at Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `${s.subject} in ${s.roomName}`).join(' vs ')
        });
      }
    });

    return conflicts;
  };

  const conflictsList = detectConflicts();

  // Filtered timetable matrix
  const filteredSlots = timetable.filter(t => 
    t.department === selectedDept && t.semester === selectedSem && t.section === selectedSec
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable & Room Allocation</h1>
          <p className="page-subtitle">Schedule class structures and allocate classrooms with active conflict detection warning checks.</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setForm({
            dayOfWeek: 'Monday',
            period: 1,
            subject: '',
            roomName: rooms[0]?.name || '',
            roomId: rooms[0]?._id || '',
            facultyId: faculties[0]?._id || '',
            startTime: '09:00 AM',
            endTime: '10:00 AM'
          });
          setShowModal(true);
        }}>
          <FiPlus /> Allocate Slot
        </button>
      </div>

      {/* Grid configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
        
        {/* Timetable matrix */}
        <div className="card">
          <h3 className="card-title">Schedule Sheet Matrix</h3>
          
          <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="input" style={{ width: '100%' }}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="input" style={{ width: '100%' }}>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                {['A', 'B', 'C'].map(s => <option key={s} value={s}>Sec {s}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p>Loading timetables...</p>
          ) : filteredSlots.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No slots allocated for this class section. Click "Allocate Slot" to get started.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="venues-table" style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Day</th>
                    {PERIODS.map(p => <th key={p}>P{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day}>
                      <td><strong>{day}</strong></td>
                      {PERIODS.map(p => {
                        const slot = filteredSlots.find(s => s.dayOfWeek === day && s.period === p);
                        return (
                          <td key={p} style={{ padding: 8, minWidth: '110px' }}>
                            {slot ? (
                              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', padding: 6, borderRadius: 8, fontSize: 11, position: 'relative' }}>
                                <div style={{ fontWeight: 600, color: '#fff' }}>{slot.subject}</div>
                                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{slot.roomName}</div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{slot.facultyName.split(' ')[0]}</div>
                                <button 
                                  onClick={() => handleDelete(slot._id)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', position: 'absolute', top: 2, right: 2, cursor: 'pointer', opacity: 0.7 }}
                                >
                                  <FiTrash2 size={10} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.1)' }}>-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Conflict Detection Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="card-title">Timetabler Conflict Detection</h3>
          
          {conflictsList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', background: '#10b98115', border: '1px solid #10b98130', padding: 14, borderRadius: 10, marginTop: 12 }}>
              <FiCheckCircle size={20} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No Scheduling Conflicts Detected!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', background: '#f59e0b15', border: '1px solid #f59e0b30', padding: 10, borderRadius: 8 }}>
                <FiAlertTriangle size={18} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{conflictsList.length} conflict(s) flag alerts:</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '400px', overflowY: 'auto' }}>
                {conflictsList.map((c, i) => (
                  <div key={i} style={{ padding: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                    <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>{c.type}</div>
                    <div style={{ color: '#fff', fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{c.desc}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>Clashing: {c.details}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Allocation Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: 24 }}>
            <h3 className="card-title">Allocate Timetable Slot</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Day of Week</label>
                  <select value={form.dayOfWeek} onChange={e => setForm(prev => ({ ...prev, dayOfWeek: e.target.value }))} className="input">
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Period</label>
                  <select value={form.period} onChange={e => setForm(prev => ({ ...prev, period: Number(e.target.value) }))} className="input">
                    {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject Title</label>
                  <input type="text" value={form.subject} onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. DBMS" className="input" required />
                </div>
                <div className="form-group">
                  <label>Room Allocation</label>
                  <select value={form.roomName} onChange={e => setForm(prev => ({ ...prev, roomName: e.target.value }))} className="input">
                    {rooms.map(r => <option key={r._id} value={r.name}>{r.name} (Floor {r.floorId?.name || '?'})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Assign Faculty</label>
                  <select value={form.facultyId} onChange={e => setForm(prev => ({ ...prev, facultyId: e.target.value }))} className="input">
                    {faculties.map(f => <option key={f._id} value={f._id}>{f.name} ({f.department})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="text" value={form.startTime} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} placeholder="09:00 AM" className="input" required />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="text" value={form.endTime} onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))} placeholder="10:00 AM" className="input" required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Allocate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
