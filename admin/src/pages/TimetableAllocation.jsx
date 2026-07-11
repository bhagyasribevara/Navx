import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useOutletContext } from 'react-router-dom';
import { FiPlus, FiTrash2, FiAlertTriangle, FiCheckCircle, FiCopy, FiInfo, FiActivity, FiClock } from 'react-icons/fi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const DEPARTMENTS = ['CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'MBA', 'MCA'];

// Fallback standard timings
const STANDARD_TIMINGS = {
  1: { start: '09:00 AM', end: '10:00 AM' },
  2: { start: '10:00 AM', end: '11:00 AM' },
  3: { start: '11:00 AM', end: '12:00 PM' },
  4: { start: '12:00 PM', end: '01:00 PM' },
  5: { start: '02:00 PM', end: '03:00 PM' },
  6: { start: '03:00 PM', end: '04:00 PM' },
  7: { start: '04:00 PM', end: '05:00 PM' },
};

export default function TimetableAllocation({ admin }) {
  const { campus } = useOutletContext();
  const [timetable, setTimetable] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showTimingsModal, setShowTimingsModal] = useState(false);

  // Filters
  const [selectedDept, setSelectedDept] = useState('CSE');
  const [selectedSem, setSelectedSem] = useState('6');
  const [selectedSec, setSelectedSec] = useState('A');

  // Timings State (custom timings loaded per section)
  const [sectionTimings, setSectionTimings] = useState(STANDARD_TIMINGS);
  const [tempTimings, setTempTimings] = useState([]);

  // Form State for quick popover allocation
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
  const [doublePeriod, setDoublePeriod] = useState(false);

  // Template Copy Destination State
  const [copyDestSec, setCopyDestSec] = useState('B');

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

  // Fetch timings specific to selected section
  const fetchSectionTimings = async () => {
    if (!campus?._id) return;
    try {
      const res = await axios.get(
        `${API_BASE}/campus/${campus._id}/section-timings?department=${selectedDept}&semester=${selectedSem}&section=${selectedSec}`,
        { headers }
      );
      if (res.data.success && res.data.timings && res.data.timings.length > 0) {
        const mapping = {};
        res.data.timings.forEach(t => {
          mapping[t.period] = { start: t.startTime, end: t.endTime };
        });
        setSectionTimings(mapping);
      } else {
        setSectionTimings(STANDARD_TIMINGS);
      }
    } catch (e) {
      setSectionTimings(STANDARD_TIMINGS);
    }
  };

  useEffect(() => {
    if (campus?._id) {
      loadData();
    }
  }, [campus]);

  useEffect(() => {
    fetchSectionTimings();
  }, [selectedDept, selectedSem, selectedSec, campus]);

  // Aggregate subjects registered when adding faculty
  const getDeptSemSubjects = () => {
    const subs = new Set();
    faculties.forEach(f => {
      // Add registered subjects
      f.subjects?.forEach(s => {
        if (s) subs.add(s.trim());
      });
      // Add assigned constraints
      f.assignedSubjectsSections?.forEach(mapping => {
        if (mapping.subject) {
          subs.add(mapping.subject.trim());
        }
      });
    });
    return [...subs].sort();
  };

  // Find teacher mapped to this subject
  const getSubjectTeacher = (subName) => {
    return faculties.find(f => 
      f.assignedSubjectsSections?.some(mapping => 
        mapping.subject.toLowerCase() === subName.toLowerCase() &&
        mapping.semester === selectedSem &&
        f.department === selectedDept
      ) || f.subjects?.some(s => s.toLowerCase() === subName.toLowerCase())
    );
  };

  // Check if a room is occupied at a given Day and Period by ANY other section
  const isRoomOccupied = (roomName, day, period) => {
    return timetable.some(slot => 
      slot.roomName === roomName && 
      slot.dayOfWeek === day && 
      slot.period === period
    );
  };

  // Check if a teacher is occupied at a given Day and Period elsewhere
  const isTeacherOccupied = (facId, day, period) => {
    return timetable.some(slot => 
      slot.facultyId === facId && 
      slot.dayOfWeek === day && 
      slot.period === period
    );
  };

  // Get total assigned weekly hours for a faculty member
  const getFacultyWeeklyHours = (facId) => {
    return timetable.filter(slot => slot.facultyId === facId).length;
  };

  // Handle cell click (Quick-Fill popover trigger)
  const handleCellClick = (day, p) => {
    const timing = sectionTimings[p];
    const availableSubjects = getDeptSemSubjects();
    const defaultSub = availableSubjects[0] || '';
    const defaultTeacher = getSubjectTeacher(defaultSub);

    // Auto-select first room that is not occupied
    const freeRoom = rooms.find(r => !isRoomOccupied(r.name, day, p));

    setForm({
      dayOfWeek: day,
      period: p,
      subject: defaultSub,
      roomName: freeRoom ? freeRoom.name : (rooms[0]?.name || ''),
      roomId: freeRoom ? freeRoom._id : (rooms[0]?._id || ''),
      facultyId: defaultTeacher ? defaultTeacher._id : (faculties[0]?._id || ''),
      startTime: timing.start,
      endTime: timing.end
    });
    setDoublePeriod(false);
    setShowModal(true);
  };

  // Auto-populate faculty on subject change
  const handleSubjectChange = (sub) => {
    const teacher = getSubjectTeacher(sub);
    setForm(prev => ({
      ...prev,
      subject: sub,
      facultyId: teacher ? teacher._id : prev.facultyId
    }));
  };

  // Handle slot submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.roomName || !form.facultyId) {
      toast.error('Please complete all selection inputs');
      return;
    }

    const selectedFaculty = faculties.find(f => f._id === form.facultyId);
    const selectedRoom = rooms.find(r => r.name === form.roomName);

    if (doublePeriod) {
      if (form.period >= 7) {
        toast.error('Cannot schedule a double period starting at Period 7.');
        return;
      }
      
      const nextPeriod = form.period + 1;
      const timingCurrent = sectionTimings[form.period];
      const timingNext = sectionTimings[nextPeriod];

      const payload1 = {
        ...form,
        campusId: campus._id,
        department: selectedDept,
        semester: selectedSem,
        section: selectedSec,
        facultyName: selectedFaculty ? selectedFaculty.name : 'Unknown',
        roomId: selectedRoom ? selectedRoom._id : null,
        startTime: timingCurrent.start,
        endTime: timingNext.end
      };

      const payload2 = {
        ...payload1,
        period: nextPeriod
      };

      // Conflict checks
      const isRoomClash1 = isRoomOccupied(form.roomName, form.dayOfWeek, form.period);
      const isRoomClash2 = isRoomOccupied(form.roomName, form.dayOfWeek, nextPeriod);
      const isTeacherClash1 = isTeacherOccupied(form.facultyId, form.dayOfWeek, form.period);
      const isTeacherClash2 = isTeacherOccupied(form.facultyId, form.dayOfWeek, nextPeriod);

      if (isRoomClash1 || isRoomClash2) {
        if (!confirm(`Warning: Room ${form.roomName} is occupied in one of these slots. Proceed?`)) return;
      }
      if (isTeacherClash1 || isTeacherClash2) {
        if (!confirm(`Warning: Prof. ${selectedFaculty?.name} is occupied in one of these slots. Proceed?`)) return;
      }

      try {
        await axios.post(`${API_BASE}/campus/${campus._id}/timetable`, payload1, { headers });
        await axios.post(`${API_BASE}/campus/${campus._id}/timetable`, payload2, { headers });
        toast.success('Double period allocated successfully!');
        setShowModal(false);
        loadData();
      } catch (err) {
        toast.error('Failed to allocate double periods.');
      }
    } else {
      // Single period allocation
      const payload = {
        ...form,
        campusId: campus._id,
        department: selectedDept,
        semester: selectedSem,
        section: selectedSec,
        facultyName: selectedFaculty ? selectedFaculty.name : 'Unknown',
        roomId: selectedRoom ? selectedRoom._id : null
      };

      // Conflict warnings
      const isRoomClash = isRoomOccupied(form.roomName, form.dayOfWeek, form.period);
      const isTeacherClash = isTeacherOccupied(form.facultyId, form.dayOfWeek, form.period);

      if (isRoomClash) {
        if (!confirm(`Warning: Room ${form.roomName} is occupied at this period. Proceed?`)) return;
      }
      if (isTeacherClash) {
        if (!confirm(`Warning: Prof. ${selectedFaculty?.name} is busy at this period. Proceed?`)) return;
      }

      try {
        await axios.post(`${API_BASE}/campus/${campus._id}/timetable`, payload, { headers });
        toast.success('Timetable slot allocated!');
        setShowModal(false);
        loadData();
      } catch (err) {
        toast.error('Failed to allocate slot.');
      }
    }
  };

  // Delete matching slots (handle lab double period clean remove)
  const handleDeleteSlot = async (slot) => {
    // Look for duplicate adjacent slot (for labs)
    const matching = timetable.find(s => 
      s.dayOfWeek === slot.dayOfWeek &&
      s.department === slot.department &&
      s.semester === slot.semester &&
      s.section === slot.section &&
      s.subject === slot.subject &&
      s.roomName === slot.roomName &&
      s.facultyId === slot.facultyId &&
      Math.abs(s.period - slot.period) === 1
    );

    if (!confirm(matching ? 'This is a double period (Lab). Delete both slots?' : 'Are you sure you want to remove this timetable slot?')) return;

    try {
      await axios.delete(`${API_BASE}/campus/${campus._id}/timetable/${slot._id}`, { headers });
      if (matching) {
        await axios.delete(`${API_BASE}/campus/${campus._id}/timetable/${matching._id}`, { headers });
      }
      toast.success('Timetable slot removed');
      loadData();
    } catch (e) {
      toast.error('Failed to delete slots.');
    }
  };

  // Save timings config for this section
  const handleSaveTimings = async () => {
    try {
      const res = await axios.post(`${API_BASE}/campus/${campus._id}/section-timings`, {
        department: selectedDept,
        semester: selectedSem,
        section: selectedSec,
        timings: tempTimings
      }, { headers });

      if (res.data.success) {
        toast.success('Period timings updated for this section!');
        setShowTimingsModal(false);
        const mapping = {};
        res.data.timings.forEach(t => {
          mapping[t.period] = { start: t.startTime, end: t.endTime };
        });
        setSectionTimings(mapping);
      }
    } catch (e) {
      toast.error('Failed to save timings configuration.');
    }
  };

  // Open Timings editor
  const handleOpenTimingsEditor = () => {
    const list = PERIODS.map(p => ({
      period: p,
      startTime: sectionTimings[p].start,
      endTime: sectionTimings[p].end
    }));
    setTempTimings(list);
    setShowTimingsModal(true);
  };

  // Copy Template layout
  const handleCopyTemplate = async () => {
    const currentSectionSlots = timetable.filter(t => 
      t.department === selectedDept && t.semester === selectedSem && t.section === selectedSec
    );

    if (currentSectionSlots.length === 0) {
      toast.error('No schedule slots found in current section to copy!');
      return;
    }

    if (copyDestSec === selectedSec) {
      toast.error('Destination section must be different!');
      return;
    }

    if (!confirm(`Duplicate this schedule template structure to Section ${copyDestSec}?`)) return;

    try {
      let successCount = 0;
      for (const slot of currentSectionSlots) {
        const payload = {
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
          subject: slot.subject,
          roomName: slot.roomName,
          roomId: slot.roomId,
          facultyId: slot.facultyId,
          facultyName: slot.facultyName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          campusId: campus._id,
          department: selectedDept,
          semester: selectedSem,
          section: copyDestSec
        };
        await axios.post(`${API_BASE}/campus/${campus._id}/timetable`, payload, { headers });
        successCount++;
      }
      toast.success(`Duplicated ${successCount} slots to Section ${copyDestSec}!`);
      setShowCopyModal(false);
      loadData();
    } catch (e) {
      toast.error('Duplication completed.');
      loadData();
    }
  };

  // Proactive Conflict Engine
  const detectConflicts = () => {
    const conflicts = [];
    const roomBookingMap = {};
    const facultyBookingMap = {};
    const sectionBookingMap = {};

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

    Object.keys(roomBookingMap).forEach(key => {
      const slots = roomBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Room Double-Booking',
          desc: `Room ${slots[0].roomName} occupied by multiple classes during Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `${s.department} ${s.semester}-${s.section} (${s.subject})`).join(' vs ')
        });
      }
    });

    Object.keys(facultyBookingMap).forEach(key => {
      const slots = facultyBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Faculty Double-Booking',
          desc: `${slots[0].facultyName} is teaching multiple sections during Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `Sem ${s.semester}-${s.section} in room ${s.roomName}`).join(' vs ')
        });
      }
    });

    Object.keys(sectionBookingMap).forEach(key => {
      const slots = sectionBookingMap[key];
      if (slots.length > 1) {
        conflicts.push({
          type: 'Section Collision',
          desc: `Section Sem ${slots[0].semester}-${slots[0].section} has overlapping slots at Period ${slots[0].period} on ${slots[0].dayOfWeek}.`,
          details: slots.map(s => `${s.subject} in room ${s.roomName}`).join(' vs ')
        });
      }
    });

    return conflicts;
  };

  const conflictsList = detectConflicts();

  // Filtered timetable slots for matrix grid
  const filteredSlots = timetable.filter(t => 
    t.department === selectedDept && t.semester === selectedSem && t.section === selectedSec
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relational Constraints Timetable Builder</h1>
          <p className="page-subtitle">Schedule class matrices and rooms with active double-booking checks and faculty workload audits.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleOpenTimingsEditor} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiClock /> Configure Timings
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCopyModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiCopy /> Copy Section Template
          </button>
        </div>
      </div>

      {/* Grid Configuration and Filter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        
        {/* Timetable Weekly Matrix */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="card-title">Schedule Sheet Matrix ({selectedDept} Sem {selectedSem}-{selectedSec})</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="input" style={{ padding: '4px 10px', fontSize: 13 }}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="input" style={{ padding: '4px 10px', fontSize: 13 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
              <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ padding: '4px 10px', fontSize: 13 }}>
                {['A', 'B', 'C'].map(s => <option key={s} value={s}>Sec {s}</option>)}
              </select>
            </div>
          </div>
          
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            💡 Click on any empty cell <span style={{ color: 'var(--border-active)' }}>(-)</span> to quick-fill and allocate a subject slot.
          </p>

          {loading ? (
            <p>Loading constraints matrix...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="venues-table" style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Day</th>
                    {PERIODS.map(p => (
                      <th key={p} style={{ padding: '8px 4px' }}>
                        <div>P{p}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 'normal', marginTop: 2 }}>
                          {sectionTimings[p]?.start || STANDARD_TIMINGS[p].start}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    const renderedPeriods = new Set();
                    return (
                      <tr key={day}>
                        <td style={{ textAlign: 'left', padding: '10px 14px' }}><strong>{day}</strong></td>
                        {PERIODS.map(p => {
                          if (renderedPeriods.has(p)) return null;

                          const slot = filteredSlots.find(s => s.dayOfWeek === day && s.period === p);
                          const nextSlot = filteredSlots.find(s => s.dayOfWeek === day && s.period === p + 1);

                          // Check visual merging for double lab periods
                          const isMerged = slot && nextSlot && 
                            slot.subject === nextSlot.subject && 
                            slot.roomName === nextSlot.roomName && 
                            slot.facultyId === nextSlot.facultyId &&
                            slot.startTime === nextSlot.startTime &&
                            slot.endTime === nextSlot.endTime;

                          if (isMerged) {
                            renderedPeriods.add(p + 1);
                          }

                          return (
                            <td 
                              key={p} 
                              colSpan={isMerged ? 2 : 1}
                              style={{ padding: 6, minWidth: isMerged ? '240px' : '120px' }}
                            >
                              {slot ? (
                                <div style={{ 
                                  background: slot.subject.toLowerCase().includes('lab') || isMerged ? 'rgba(16, 185, 129, 0.06)' : 'rgba(99,102,241,0.06)', 
                                  border: slot.subject.toLowerCase().includes('lab') || isMerged ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(99,102,241,0.2)', 
                                  padding: 8, 
                                  borderRadius: 8, 
                                  fontSize: 11, 
                                  position: 'relative' 
                                }}>
                                  <div style={{ fontWeight: 700, color: '#fff' }}>
                                    {slot.subject} {isMerged && '(Double Period)'}
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 10 }}>Room {slot.roomName}</div>
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{slot.facultyName.split(' ')[0]}</div>
                                  <button 
                                    onClick={() => handleDeleteSlot(slot)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', position: 'absolute', top: 2, right: 2, cursor: 'pointer', opacity: 0.7 }}
                                  >
                                    <FiTrash2 size={10} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleCellClick(day, p)} 
                                  style={{ 
                                    background: 'none', 
                                    border: '1px dashed rgba(255,255,255,0.06)', 
                                    width: '100%', 
                                    padding: '12px 0', 
                                    color: 'rgba(255,255,255,0.2)', 
                                    borderRadius: 8, 
                                    cursor: 'pointer' 
                                  }}
                                >
                                  -
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar Constraints and Conflict Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Workload Progress Tracker */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiActivity /> Faculty Workload Cap Tracker</h3>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 14 }}>Real-time weekly teaching hours vs contract caps.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '280px', overflowY: 'auto' }}>
              {faculties.filter(f => f.department === selectedDept).map(f => {
                const allocatedHours = getFacultyWeeklyHours(f._id);
                const cap = f.maxWeeklyHours || 16;
                const ratio = Math.min((allocatedHours / cap) * 100, 100);
                const isOverload = allocatedHours > cap;

                return (
                  <div key={f._id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{f.name}</span>
                      <span style={{ color: isOverload ? '#ef4444' : 'var(--text-secondary)' }}>
                        {allocatedHours} / {cap} hrs {isOverload && '⚠️'}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${ratio}%`, height: '100%', background: isOverload ? '#ef4444' : '#6366f1', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Warnings Panels */}
          <div className="card">
            <h3 className="card-title">Live Conflict Engine</h3>
            
            {conflictsList.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', background: '#10b98115', border: '1px solid #10b98130', padding: 14, borderRadius: 10, marginTop: 12 }}>
                <FiCheckCircle size={20} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>No conflicts detected!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', background: '#f59e0b15', border: '1px solid #f59e0b30', padding: 10, borderRadius: 8 }}>
                  <FiAlertTriangle size={18} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{conflictsList.length} constraint warnings:</div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '250px', overflowY: 'auto' }}>
                  {conflictsList.map((c, i) => (
                    <div key={i} style={{ padding: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8 }}>
                      <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 11 }}>{c.type}</div>
                      <div style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>{c.desc}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>{c.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timings Configuration Modal */}
      {showTimingsModal && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '550px', maxHeight: '90%', overflowY: 'auto', padding: 24 }}>
            <h3 className="card-title">Configure Period Timings ({selectedDept} Sem {selectedSem}-{selectedSec})</h3>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 16 }}>
              Set custom start and end timings for each period block to accommodate local session structures.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tempTimings.map((t, idx) => (
                <div key={t.period} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>Period {t.period}</span>
                  <input 
                    type="text" 
                    value={t.startTime} 
                    onChange={e => {
                      const updated = [...tempTimings];
                      updated[idx].startTime = e.target.value;
                      setTempTimings(updated);
                    }} 
                    placeholder="e.g. 09:00 AM" 
                    className="input" 
                  />
                  <input 
                    type="text" 
                    value={t.endTime} 
                    onChange={e => {
                      const updated = [...tempTimings];
                      updated[idx].endTime = e.target.value;
                      setTempTimings(updated);
                    }} 
                    placeholder="e.g. 10:00 AM" 
                    className="input" 
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTimingsModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveTimings}>Save Section Timings</button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Click Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: 24 }}>
            <h3 className="card-title">Allocate Cell: {form.dayOfWeek}, Period {form.period}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Current timing: {form.startTime} - {form.endTime}</p>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div className="form-group">
                <label>Select Faculty Subject *</label>
                <select 
                  value={form.subject} 
                  onChange={e => handleSubjectChange(e.target.value)} 
                  className="input"
                  required
                >
                  <option value="">-- Choose Mapped Subject --</option>
                  {getDeptSemSubjects().map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Populated from subjects recorded in faculty profiles.
                </p>
              </div>

              <div className="form-group">
                <label>Assigned Faculty (Auto-Selected)</label>
                <select 
                  value={form.facultyId} 
                  onChange={e => setForm(prev => ({ ...prev, facultyId: e.target.value }))} 
                  className="input"
                  required
                >
                  <option value="">-- Assign Faculty --</option>
                  {faculties.map(f => (
                    <option key={f._id} value={f._id}>{f.name} ({f.department})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Allocate Classroom *</label>
                <select 
                  value={form.roomName} 
                  onChange={e => setForm(prev => ({ ...prev, roomName: e.target.value }))} 
                  className="input"
                  required
                >
                  <option value="">-- Select Room --</option>
                  {rooms.map(r => {
                    const occupied = isRoomOccupied(r.name, form.dayOfWeek, form.period);
                    return (
                      <option key={r._id} value={r.name} style={{ color: occupied ? '#ef4444' : '#fff' }}>
                        {r.name} (Floor {r.floorId?.name || '?'}) {occupied ? '[OCCUPIED]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {form.period < 7 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input 
                    type="checkbox" 
                    id="doublePeriod" 
                    checked={doublePeriod} 
                    onChange={e => setDoublePeriod(e.target.checked)} 
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="doublePeriod" style={{ fontSize: 13, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    Double Period (2-Hour Lab mapping)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Allocate Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Template Modal */}
      {showCopyModal && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: 24 }}>
            <h3 className="card-title">Copy Section Timetable Template</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
              Copy the complete structured weekly grid from **Section {selectedSec}** to another section in Sem {selectedSem} {selectedDept}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div className="form-group">
                <label>Select Target Section</label>
                <select 
                  value={copyDestSec} 
                  onChange={e => setCopyDestSec(e.target.value)} 
                  className="input"
                >
                  {['A', 'B', 'C'].filter(s => s !== selectedSec).map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCopyModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleCopyTemplate}>Duplicate Schedule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
