import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FiHome, FiCheckSquare, FiAward, FiBarChart2, FiCpu, FiUser, 
  FiLogOut, FiCalendar, FiClock, FiMapPin, FiUsers, FiUpload, 
  FiDownload, FiActivity, FiArrowRight, FiFileText
} from 'react-icons/fi';
import './SuperAdminDashboard.css'; // Leverage existing dashboard styles

export default function FacultyDashboard({ faculty, onLogout, token }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [todayClasses, setTodayClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState(null);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [fullTimetable, setFullTimetable] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Attendance & Marks State
  const [selectedDept, setSelectedDept] = useState(faculty.department || 'CSE');
  const [selectedSem, setSelectedSem] = useState('6');
  const [selectedSec, setSelectedSec] = useState('A');
  const [selectedSubject, setSelectedSubject] = useState(faculty.subjects?.[0] || 'DBMS');
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendancePeriod, setAttendancePeriod] = useState(1);
  const [attendanceList, setAttendanceList] = useState({}); // { studentId: 'Present' | 'Absent' }
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Marks Category
  const [marksType, setMarksType] = useState('Internal');
  const [obtainedMarks, setObtainedMarks] = useState({}); // { studentId: score }
  const [totalMarks, setTotalMarks] = useState(25);
  const [marksComments, setMarksComments] = useState({}); // { studentId: comment }

  // Bulk Upload File
  const [attendanceFileContent, setAttendanceFileContent] = useState('');
  const [marksFileContent, setMarksFileContent] = useState('');

  // Subject Analytics
  const [analyticsData, setAnalyticsData] = useState({
    passPercentage: 0,
    averageMarks: 0,
    weakStudents: [],
    strongStudents: []
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // AI Faculty Copilot State
  const [aiAction, setAiAction] = useState('CREATE_PPT');
  const [aiPrompt, setAiPrompt] = useState('Unit 3: Database Indexing, B-Trees and Hash Indexing with practical exercises.');
  const [aiOutput, setAiOutput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API_BASE}/faculty/dashboard`, { headers });
      if (data.success) {
        setTodayClasses(data.todayClasses || []);
        setCurrentClass(data.currentClass || null);
        setUpcomingClasses(data.upcomingClasses || []);
        setFullTimetable(data.fullTimetable || []);
      }
    } catch (err) {
      toast.error('Failed to load dashboard classes.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(
        `${API_BASE}/faculty/students?department=${selectedDept}&section=${selectedSec}`,
        { headers }
      );
      if (data.success) {
        setStudents(data.students);
        // Initialize default values
        const attInit = {};
        const marksInit = {};
        const commInit = {};
        data.students.forEach(s => {
          attInit[s._id] = 'Present';
          marksInit[s._id] = '';
          commInit[s._id] = '';
        });
        setAttendanceList(attInit);
        setObtainedMarks(marksInit);
        setMarksComments(commInit);
      }
    } catch (err) {
      toast.error('Failed to fetch class roster.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(
        `${API_BASE}/faculty/analytics?subject=${selectedSubject}&department=${selectedDept}&section=${selectedSec}`,
        { headers }
      );
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (err) {
      toast.error('Failed to load class analytics.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance' || activeTab === 'marks') {
      fetchStudents();
    }
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, selectedDept, selectedSec, selectedSubject]);

  const handleSaveAttendance = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const recordPromises = Object.keys(attendanceList).map(studentId => {
        return axios.post(`${API_BASE}/faculty/attendance`, {
          studentId,
          subject: selectedSubject,
          date: attendanceDate,
          status: attendanceList[studentId],
          period: attendancePeriod
        }, { headers });
      });

      await Promise.all(recordPromises);
      toast.success('Attendance saved successfully!');
    } catch (e) {
      toast.error('Failed to save attendance.');
    }
  };

  const handleSaveMarks = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const recordPromises = Object.keys(obtainedMarks).map(studentId => {
        if (obtainedMarks[studentId] === '') return Promise.resolve();
        return axios.post(`${API_BASE}/faculty/marks`, {
          studentId,
          subject: selectedSubject,
          marksType,
          obtainedMarks: Number(obtainedMarks[studentId]),
          totalMarks: Number(totalMarks),
          comments: marksComments[studentId]
        }, { headers });
      });

      await Promise.all(recordPromises);
      toast.success('Grades uploaded successfully!');
    } catch (e) {
      toast.error('Failed to upload grades.');
    }
  };

  // Mock template generator
  const downloadTemplate = (type) => {
    let csvContent = "";
    if (type === 'attendance') {
      csvContent = "StudentUsername,Subject,Date(YYYY-MM-DD),Status(Present/Absent),Period\n" + 
        students.map(s => `${s.username},${selectedSubject},${attendanceDate},Present,1`).join('\n');
    } else {
      csvContent = "StudentUsername,Subject,MarksType(Internal/Semester),ObtainedMarks,TotalMarks,Comments\n" + 
        students.map(s => `${s.username},${selectedSubject},${marksType},20,25,Good`).join('\n');
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mock Bulk Excel upload reader
  const handleBulkUpload = async (type) => {
    const records = [];
    const content = type === 'attendance' ? attendanceFileContent : marksFileContent;
    if (!content.trim()) {
      toast.error("Please paste CSV contents first!");
      return;
    }

    const lines = content.split('\n');
    // Skip headers
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',');
      const username = cols[0]?.trim();
      const student = students.find(s => s.username === username);
      if (!student) continue;

      if (type === 'attendance') {
        records.push({
          studentId: student._id,
          subject: cols[1]?.trim() || selectedSubject,
          date: cols[2]?.trim() || attendanceDate,
          status: cols[3]?.trim() || 'Present',
          period: Number(cols[4]?.trim() || 1)
        });
      } else {
        records.push({
          studentId: student._id,
          subject: cols[1]?.trim() || selectedSubject,
          marksType: cols[2]?.trim() || marksType,
          obtainedMarks: Number(cols[3]?.trim() || 0),
          totalMarks: Number(cols[4]?.trim() || 25),
          comments: cols[5]?.trim() || ''
        });
      }
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = type === 'attendance' ? '/faculty/attendance/bulk-upload' : '/faculty/marks/bulk-upload';
      const payload = type === 'attendance' ? { attendanceRecords: records } : { marksRecords: records };

      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload, { headers });
      if (data.success) {
        toast.success(data.message);
        if (type === 'attendance') setAttendanceFileContent('');
        else setMarksFileContent('');
        fetchStudents();
      }
    } catch (err) {
      toast.error('Failed to parse and upload records.');
    }
  };

  const handleTriggerAiCopilot = async () => {
    setLoadingAi(true);
    setAiOutput('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_BASE}/faculty/ai-action`, {
        actionType: aiAction,
        promptText: aiPrompt
      }, { headers });
      if (data.success) {
        setAiOutput(data.result);
      }
    } catch (e) {
      toast.error('Failed to execute AI Copilot action.');
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="superadmin-layout faculty-layout">
      {/* Top Navbar */}
      <header className="top-navbar" style={{ height: '96px' }}>
        <div className="navbar-wrapper" style={{ maxWidth: '100%', padding: '0 32px' }}>
          <div className="navbar-header-row">
            <div className="navbar-left">
              <div style={{ fontSize: 28 }}>👨‍🏫</div>
              <div style={{ marginLeft: 8 }}>
                <div className="navbar-title">NavX Faculty Portal</div>
                <div className="navbar-subtitle">Welcome, Prof. {faculty.name}</div>
              </div>
            </div>
          </div>
          
          <nav className="navbar-center" style={{ display: 'flex', gap: 12 }}>
            <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><FiHome /> Classes</button>
            <button className={`nav-link ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}><FiCheckSquare /> Attendance</button>
            <button className={`nav-link ${activeTab === 'marks' ? 'active' : ''}`} onClick={() => setActiveTab('marks')}><FiAward /> Marks</button>
            <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}><FiBarChart2 /> Analytics</button>
            <button className={`nav-link ${activeTab === 'copilot' ? 'active' : ''}`} onClick={() => setActiveTab('copilot')}><FiCpu /> AI Copilot</button>
            <button className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><FiUser /> Profile</button>
          </nav>

          <div className="navbar-right">
            <button className="btn-logout" onClick={onLogout}><FiLogOut /> Logout</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="main-content" style={{ marginTop: 0, paddingTop: '110px' }}>
        <div className="page-container" style={{ padding: '0 32px' }}>

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Today's Class Schedule</h1>
                  <p className="page-subtitle">Manage class attendance and check upcoming lectures of the day.</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="card-grid">
                <div className="stat-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="stat-value">{todayClasses.length}</div>
                      <div className="stat-label">Total Classes Today</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: '50%', background: '#6366f120', color: '#6366f1' }}><FiCalendar size={24} /></div>
                  </div>
                </div>
                <div className="stat-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="stat-value">{faculty.subjects?.join(', ') || 'N/A'}</div>
                      <div className="stat-label">My Subjects</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: '50%', background: '#10b98120', color: '#10b981' }}><FiFileText size={24} /></div>
                  </div>
                </div>
                <div className="stat-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="stat-value">{faculty.facultyRoom}</div>
                      <div className="stat-label">Faculty Cabin</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: '50%', background: '#f59e0b20', color: '#f59e0b' }}><FiMapPin size={24} /></div>
                  </div>
                </div>
              </div>

              {/* Active & Upcoming Classes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
                {/* Active Period */}
                <div className="card">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiActivity color="#ef4444" /> Current Class Period</h3>
                  {currentClass ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                      <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{currentClass.subject}</h2>
                            <p style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><FiMapPin /> Classroom: {currentClass.roomName}</p>
                          </div>
                          <span className="badge" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>Period {currentClass.period}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiClock /> {currentClass.startTime} - {currentClass.endTime}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiUsers /> Section: {currentClass.section} (Sem {currentClass.semester})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-primary" onClick={() => {
                          setSelectedSubject(currentClass.subject);
                          setSelectedSec(currentClass.section);
                          setSelectedSem(currentClass.semester);
                          setActiveTab('attendance');
                        }}>
                          Mark Attendance
                        </button>
                        <button className="btn btn-secondary" onClick={() => {
                          setSelectedSubject(currentClass.subject);
                          setSelectedSec(currentClass.section);
                          setSelectedSem(currentClass.semester);
                          setActiveTab('marks');
                        }}>
                          Upload Internal Grades
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', padding: '24px 0' }}>No classes currently active.</p>
                  )}
                </div>

                {/* Upcoming */}
                <div className="card">
                  <h3 className="card-title">Next Classes Today</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {upcomingClasses.length > 0 ? (
                      upcomingClasses.map((u, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{u.subject}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{u.startTime} · Room {u.roomName} · Sec {u.section}</div>
                          </div>
                          <FiArrowRight color="var(--text-secondary)" />
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>No upcoming classes left for today.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Class Attendance</h1>
                  <p className="page-subtitle">Mark daily rosters or upload bulk records via Excel sheets.</p>
                </div>
              </div>

              {/* Configuration panel */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                    <label>Subject</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                    <label>Section</label>
                    <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                    <label>Date</label>
                    <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="input" style={{ width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 100 }}>
                    <label>Period</label>
                    <input type="number" value={attendancePeriod} onChange={e => setAttendancePeriod(Number(e.target.value))} className="input" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Roster & Bulk Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
                {/* Student List */}
                <div className="card">
                  <h3 className="card-title">Student Roster</h3>
                  {loadingStudents ? (
                    <p style={{ padding: 20 }}>Loading roster...</p>
                  ) : students.length === 0 ? (
                    <p style={{ padding: 20, color: 'var(--text-secondary)' }}>No students found in this section.</p>
                  ) : (
                    <div style={{ marginTop: 16 }}>
                      <table className="venues-table" style={{ width: '100%', textAlign: 'left' }}>
                        <thead>
                          <tr>
                            <th>Student Username</th>
                            <th>Roll Number</th>
                            <th style={{ textAlign: 'center' }}>Attendance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(s => (
                            <tr key={s._id}>
                              <td><strong>{s.username}</strong></td>
                              <td>{s.rollNumber}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                  <button
                                    onClick={() => setAttendanceList(prev => ({ ...prev, [s._id]: 'Present' }))}
                                    style={{
                                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                                      border: attendanceList[s._id] === 'Present' ? '1px solid #10b981' : '1px solid var(--border-color)',
                                      background: attendanceList[s._id] === 'Present' ? '#10b98120' : 'none',
                                      color: attendanceList[s._id] === 'Present' ? '#10b981' : 'var(--text-secondary)',
                                      fontWeight: 600
                                    }}
                                  >
                                    Present
                                  </button>
                                  <button
                                    onClick={() => setAttendanceList(prev => ({ ...prev, [s._id]: 'Absent' }))}
                                    style={{
                                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                                      border: attendanceList[s._id] === 'Absent' ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                      background: attendanceList[s._id] === 'Absent' ? '#ef444420' : 'none',
                                      color: attendanceList[s._id] === 'Absent' ? '#ef4444' : 'var(--text-secondary)',
                                      fontWeight: 600
                                    }}
                                  >
                                    Absent
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <button onClick={handleSaveAttendance} className="btn btn-primary" style={{ marginTop: 20 }}>
                        Submit Attendance Sheet
                      </button>
                    </div>
                  )}
                </div>

                {/* Bulk Excel Upload */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 className="card-title">Bulk Excel / CSV Upload</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Download the template, populate records, and paste or upload them below for bulk processing.
                  </p>
                  
                  <button onClick={() => downloadTemplate('attendance')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                    <FiDownload /> Download Attendance Template
                  </button>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>Paste CSV Contents (Plain-text)</label>
                    <textarea
                      value={attendanceFileContent}
                      onChange={e => setAttendanceFileContent(e.target.value)}
                      placeholder="StudentUsername,Subject,Date,Status,Period&#10;2026CS101,DBMS,2026-07-11,Present,1"
                      className="input"
                      rows={6}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, borderRadius: 10, background: 'var(--bg-input)' }}
                    />
                  </div>

                  <button onClick={() => handleBulkUpload('attendance')} className="btn btn-primary btn-sm">
                    <FiUpload /> Upload Bulk Attendance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MARKS */}
          {activeTab === 'marks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Gradebook Manager</h1>
                  <p className="page-subtitle">Upload semester results, internal test marks, or assignments.</p>
                </div>
              </div>

              {/* Config Panel */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                    <label>Subject</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                    <label>Section</label>
                    <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                    <label>Assessment Type</label>
                    <select value={marksType} onChange={e => setMarksType(e.target.value)} className="input" style={{ width: '100%' }}>
                      <option value="Internal">Internal Marks</option>
                      <option value="Semester">Semester Results</option>
                      <option value="Assignment">Assignment Marks</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 100 }}>
                    <label>Max Marks</label>
                    <input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} className="input" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Table / Bulk */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
                {/* Roster Marks */}
                <div className="card">
                  <h3 className="card-title">Roster Grades</h3>
                  {loadingStudents ? (
                    <p style={{ padding: 20 }}>Loading roster...</p>
                  ) : students.length === 0 ? (
                    <p style={{ padding: 20, color: 'var(--text-secondary)' }}>No students found.</p>
                  ) : (
                    <div style={{ marginTop: 16 }}>
                      <table className="venues-table" style={{ width: '100%', textAlign: 'left' }}>
                        <thead>
                          <tr>
                            <th>Student Username</th>
                            <th>Roll Number</th>
                            <th>Score (Obtained)</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(s => (
                            <tr key={s._id}>
                              <td><strong>{s.username}</strong></td>
                              <td>{s.rollNumber}</td>
                              <td>
                                <input
                                  type="number"
                                  value={obtainedMarks[s._id] || ''}
                                  onChange={e => setObtainedMarks(prev => ({ ...prev, [s._id]: e.target.value }))}
                                  placeholder={`Max: ${totalMarks}`}
                                  className="input"
                                  style={{ width: '100px', padding: '6px 12px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={marksComments[s._id] || ''}
                                  onChange={e => setMarksComments(prev => ({ ...prev, [s._id]: e.target.value }))}
                                  placeholder="Feedback"
                                  className="input"
                                  style={{ width: '100%', padding: '6px 12px' }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <button onClick={handleSaveMarks} className="btn btn-primary" style={{ marginTop: 20 }}>
                        Submit Grade Sheet
                      </button>
                    </div>
                  )}
                </div>

                {/* Bulk Grades Upload */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 className="card-title">Bulk Grades Upload</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Upload grades via CSV file structure. Download the template below.
                  </p>
                  
                  <button onClick={() => downloadTemplate('marks')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                    <FiDownload /> Download Marks Template
                  </button>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>Paste CSV Contents</label>
                    <textarea
                      value={marksFileContent}
                      onChange={e => setMarksFileContent(e.target.value)}
                      placeholder="StudentUsername,Subject,MarksType,ObtainedMarks,TotalMarks,Comments&#10;2026CS101,DBMS,Internal,22,25,Excellent"
                      className="input"
                      rows={6}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, borderRadius: 10, background: 'var(--bg-input)' }}
                    />
                  </div>

                  <button onClick={() => handleBulkUpload('marks')} className="btn btn-primary btn-sm">
                    <FiUpload /> Upload Bulk Grades
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Student Performance Analytics</h1>
                  <p className="page-subtitle">Monitor class averages, pass rates, strong performers & weak students.</p>
                </div>
              </div>

              {/* Filter */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Subject</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Section</label>
                    <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Display */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                {/* Metric Summary */}
                <div className="card">
                  <h3 className="card-title">Semester Exam Summary Metrics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pass Percentage</span>
                      <strong style={{ fontSize: 24, color: '#10b981' }}>{analyticsData.passPercentage}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Class Average Score</span>
                      <strong style={{ fontSize: 24, color: '#6366f1' }}>{analyticsData.averageMarks}%</strong>
                    </div>
                  </div>
                </div>

                {/* Performance Lists */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 className="card-title">Student Performance Standing</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                    <div>
                      <h4 style={{ color: '#10b981', fontWeight: 600, fontSize: 14 }}>Strong Students (≥ 80%)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {analyticsData.strongStudents?.length > 0 ? (
                          analyticsData.strongStudents.map((s, idx) => (
                            <div key={idx} style={{ fontSize: 13, color: 'var(--text-primary)' }}>- {s.name} ({s.percentage}%)</div>
                          ))
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>None registered</div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 style={{ color: '#ef4444', fontWeight: 600, fontSize: 14 }}>Weak Students (&lt; 50%)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {analyticsData.weakStudents?.length > 0 ? (
                          analyticsData.weakStudents.map((s, idx) => (
                            <div key={idx} style={{ fontSize: 13, color: 'var(--text-primary)' }}>- {s.name} ({s.percentage}%)</div>
                          ))
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>None registered</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI COPILOT */}
          {activeTab === 'copilot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Agentic AI Faculty Copilot</h1>
                  <p className="page-subtitle">Ask AI to generate PPT layouts, syllabus schedules, assignments, and templates.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 24 }}>
                {/* Query Pane */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 className="card-title">Copilot Actions</h3>
                  
                  <div className="form-group">
                    <label>Select Action Type</label>
                    <select value={aiAction} onChange={e => setAiAction(e.target.value)} className="input" style={{ width: '100%' }}>
                      <option value="CREATE_PPT">Create PPT Outline</option>
                      <option value="CREATE_ASSIGNMENT">Create Assignment</option>
                      <option value="CREATE_QUESTION_PAPER">Create Question Paper</option>
                      <option value="CREATE_LESSON_PLAN">Create Lesson Plan</option>
                      <option value="GENERATE_EXCEL_TEMPLATE">Generate Attendance Template</option>
                      <option value="ANALYZE_PERFORMANCE">Analyze Performance</option>
                      <option value="CO_PO_REPORT">Generate CO-PO Report</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Details / Prompt</label>
                    <textarea
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      className="input"
                      rows={5}
                      style={{ width: '100%', borderRadius: 10 }}
                    />
                  </div>

                  <button onClick={handleTriggerAiCopilot} disabled={loadingAi} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loadingAi ? 'AI working...' : <><FiCpu /> Generate Content</>}
                  </button>
                </div>

                {/* Output Display */}
                <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                  <h3 className="card-title">Generated Output</h3>
                  <div style={{
                    flex: 1,
                    marginTop: 12,
                    padding: 16,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: '#94a3b8',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {aiOutput || 'Generate contents to view Markdown response here.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="dashboard-header">
                <div>
                  <h1 className="page-title">Faculty Profile</h1>
                  <p className="page-subtitle">View details, office hours, and subjects.</p>
                </div>
              </div>

              <div className="card" style={{ maxWidth: '600px' }}>
                <h3 className="card-title">Personal Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Full Name</span>
                    <strong style={{ color: '#fff' }}>Prof. {faculty.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Employee ID</span>
                    <strong style={{ color: '#fff' }}>{faculty.employeeId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Department</span>
                    <strong style={{ color: '#fff' }}>{faculty.department}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Faculty Room / Office</span>
                    <strong style={{ color: '#fff' }}>{faculty.facultyRoom}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Office Hours</span>
                    <strong style={{ color: '#fff' }}>{faculty.officeHours}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Email</span>
                    <strong style={{ color: '#fff' }}>{faculty.email}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
