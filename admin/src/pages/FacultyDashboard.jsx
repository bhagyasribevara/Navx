import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FiHome, FiCheckSquare, FiAward, FiBarChart2, FiCpu, FiUser, 
  FiLogOut, FiCalendar, FiClock, FiMapPin, FiUsers, FiUpload, 
  FiDownload, FiArrowRight, FiFileText, FiInfo, FiMenu, FiX, FiActivity
} from 'react-icons/fi';
import './SuperAdminDashboard.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const PERIOD_TIMINGS = {
  1: { start: '09:00 AM', end: '10:00 AM' },
  2: { start: '10:00 AM', end: '11:00 AM' },
  3: { start: '11:00 AM', end: '12:00 PM' },
  4: { start: '12:00 PM', end: '01:00 PM' },
  5: { start: '02:00 PM', end: '03:00 PM' },
  6: { start: '03:00 PM', end: '04:00 PM' },
  7: { start: '04:00 PM', end: '05:00 PM' },
};

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Classes', icon: FiHome },
  { key: 'schedule', label: 'My Schedule', icon: FiCalendar },
  { key: 'attendance', label: 'Attendance', icon: FiCheckSquare },
  { key: 'marks', label: 'Marks', icon: FiAward },
  { key: 'analytics', label: 'Analytics', icon: FiBarChart2 },
  { key: 'copilot', label: 'AI Copilot', icon: FiCpu },
  { key: 'profile', label: 'Profile', icon: FiUser },
];

export default function FacultyDashboard({ faculty, onLogout, token }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
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
  const [attendanceList, setAttendanceList] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Marks Category
  const [marksType, setMarksType] = useState('Mid 1');
  const [obtainedMarks, setObtainedMarks] = useState({});
  const [totalMarks, setTotalMarks] = useState(25);
  const [marksComments, setMarksComments] = useState({});

  // Bulk Upload
  const [attendanceFileContent, setAttendanceFileContent] = useState('');
  const [marksFileContent, setMarksFileContent] = useState('');

  // Analytics
  const [analyticsData, setAnalyticsData] = useState({ passPercentage: 0, averageMarks: 0, weakStudents: [], strongStudents: [] });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsMarksType, setAnalyticsMarksType] = useState('Mid 1');

  // AI Excel states
  const [excelColumns, setExcelColumns] = useState([
    { title: 'Roll Number', instruction: 'student roll number or ID' },
    { title: 'Student Name', instruction: 'student username' },
    { title: 'Status', instruction: 'daily attendance status (Present or Absent)' }
  ]);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColInstr, setNewColInstr] = useState('');
  const [generatedSheet, setGeneratedSheet] = useState(null);
  const [generatingSheet, setGeneratingSheet] = useState(false);
  const [sheetRefinement, setSheetRefinement] = useState('');

  // Leave & Substitution states
  const [substitutions, setSubstitutions] = useState([]);
  const [allFaculties, setAllFaculties] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedSlotForLeave, setSelectedSlotForLeave] = useState(null);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [substituteFacultyId, setSubstituteFacultyId] = useState('');

  // AI Copilot
  const [aiAction, setAiAction] = useState('CREATE_PPT');
  const [aiPrompt, setAiPrompt] = useState('Unit 3: Database Indexing, B-Trees and Hash Indexing with practical exercises.');
  const [aiOutput, setAiOutput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

  // Data Fetching
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
        `${API_BASE}/faculty/students?department=${selectedDept}&semester=${selectedSem}&section=${selectedSec}`,
        { headers }
      );
      if (data.success) {
        setStudents(data.students);
        const attInit = {};
        const marksInit = {};
        const commInit = {};
        data.students.forEach(s => {
          attInit[s._id] = null; // Default to unmarked so faculty knows who needs marking
          marksInit[s._id] = '';
          commInit[s._id] = '';
        });
        setAttendanceList(attInit);
        setObtainedMarks(marksInit);
        setMarksComments(commInit);
        if (data.students.length > 0) setActiveStudentId(data.students[0]._id);
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
        `${API_BASE}/faculty/analytics?subject=${selectedSubject}&department=${selectedDept}&section=${selectedSec}&marksType=${analyticsMarksType}`,
        { headers }
      );
      if (data.success) setAnalyticsData(data);
    } catch (err) {
      toast.error('Failed to load class analytics.');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  useEffect(() => {
    if (activeTab === 'attendance' || activeTab === 'marks') fetchStudents();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'schedule') {
      fetchSubstitutions();
      fetchAllFaculties();
    }

    // Auto-setup defaults for columns based on tab selection
    if (activeTab === 'attendance') {
      setExcelColumns([
        { title: 'Roll Number', instruction: 'student roll number or ID' },
        { title: 'Student Name', instruction: 'student username' },
        { title: 'Status', instruction: 'daily attendance status (Present or Absent)' }
      ]);
      setGeneratedSheet(null);
    } else if (activeTab === 'marks') {
      setExcelColumns([
        { title: 'Roll Number', instruction: 'student roll number or ID' },
        { title: 'Student Name', instruction: 'student username' },
        { title: 'Obtained Marks', instruction: 'student test marks obtained' },
        { title: 'Total Marks', instruction: 'maximum test marks total limit' },
        { title: 'Remarks', instruction: 'student remarks comments' }
      ]);
      setGeneratedSheet(null);
    }
  }, [activeTab, selectedDept, selectedSec, selectedSem, selectedSubject, analyticsMarksType]);

  const handleGenerateExcel = async (type) => {
    setGeneratingSheet(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_BASE}/faculty/ai-excel`, {
        students,
        attendanceList: type === 'attendance' ? attendanceList : null,
        obtainedMarks: type === 'marks' ? obtainedMarks : null,
        marksComments: type === 'marks' ? marksComments : null,
        columns: excelColumns,
        previousSheet: generatedSheet,
        modificationPrompt: sheetRefinement
      }, { headers });
      if (res.data.success) {
        setGeneratedSheet(res.data.sheetData);
        setSheetRefinement('');
        toast.success('Spreadsheet generated successfully!');
      }
    } catch (e) {
      toast.error('Failed to generate sheet via AI.');
    } finally {
      setGeneratingSheet(false);
    }
  };

  const handleDownloadGeneratedSheet = () => {
    if (!generatedSheet) return;
    const csvRows = [];
    csvRows.push(generatedSheet.headers.join(','));
    generatedSheet.rows.forEach(row => {
      csvRows.push(row.map(cell => `"${cell}"`).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AI_Generated_Class_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportGeneratedSheet = async (type) => {
    if (!generatedSheet) return;
    const csvContent = [
      generatedSheet.headers.join(','),
      ...generatedSheet.rows.map(row => row.join(','))
    ].join('\n');
    
    const records = [];
    const lines = csvContent.split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',');
      const username = cols[0]?.trim();
      const student = students.find(s => s.username === username || s.rollNumber === username);
      if (!student) continue;
      
      if (type === 'attendance') {
        const statusIdx = generatedSheet.headers.findIndex(h => h.toLowerCase().includes('status') || h.toLowerCase().includes('attendance'));
        const status = cols[statusIdx]?.trim() || 'Present';
        records.push({
          studentId: student._id,
          subject: selectedSubject,
          date: attendanceDate,
          status: status,
          period: Number(attendancePeriod)
        });
      } else {
        const obtainedIdx = generatedSheet.headers.findIndex(h => h.toLowerCase().includes('obtained') || h.toLowerCase().includes('mark') || h.toLowerCase().includes('grade'));
        const totalIdx = generatedSheet.headers.findIndex(h => h.toLowerCase().includes('total'));
        const commentIdx = generatedSheet.headers.findIndex(h => h.toLowerCase().includes('comment') || h.toLowerCase().includes('remark'));
        
        const obtainedVal = Number(cols[obtainedIdx]?.trim() || 0);
        const totalVal = Number(cols[totalIdx]?.trim() || totalMarks);
        const commentVal = cols[commentIdx]?.trim() || '';
        
        records.push({
          studentId: student._id,
          subject: selectedSubject,
          marksType: marksType,
          obtainedMarks: obtainedVal,
          totalMarks: totalVal,
          comments: commentVal
        });
      }
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = type === 'attendance' ? '/faculty/attendance/bulk-upload' : '/faculty/marks/bulk-upload';
      const payload = type === 'attendance' ? { attendanceRecords: records } : { marksRecords: records };
      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload, { headers });
      if (data.success) {
        toast.success(`Successfully imported ${records.length} records!`);
        setGeneratedSheet(null);
        fetchStudents();
      }
    } catch (err) {
      toast.error('Failed to import generated sheet.');
    }
  };

  const handleDownloadTimetable = () => {
    if (!fullTimetable || fullTimetable.length === 0) {
      toast.warn('No timetable data scheduled to download.');
      return;
    }

    const csvRows = [];
    
    // Header
    const headers = ['Day', ...PERIODS.map(p => `Period ${p} (${PERIOD_TIMINGS[p].start} - ${PERIOD_TIMINGS[p].end})`)];
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    // Rows for each day
    DAYS.forEach(day => {
      const rowCells = [day];
      PERIODS.forEach(p => {
        const slot = fullTimetable.find(s => s.dayOfWeek === day && s.period === p);
        if (slot) {
          rowCells.push(`${slot.subject} (Room: ${slot.roomName}, Sec: ${slot.section})`);
        } else {
          rowCells.push('Off Period');
        }
      });
      csvRows.push(rowCells.map(c => `"${c}"`).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${faculty.name}_Teaching_Schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Timetable downloaded successfully!');
  };

  const fetchSubstitutions = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API_BASE}/faculty/substitutions`, { headers });
      if (data.success) {
        setSubstitutions(data.substitutions || []);
      }
    } catch (err) {
      console.error('Failed to load substitutions.');
    }
  };

  const fetchAllFaculties = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API_BASE}/faculty/list`, { headers });
      if (data.success) {
        setAllFaculties(data.faculties || []);
      }
    } catch (err) {
      console.error('Failed to load faculties list.');
    }
  };

  const handleApplyLeave = async () => {
    if (!selectedSlotForLeave) return;
    if (!substituteFacultyId) {
      toast.warn('Please select a substitute faculty.');
      return;
    }

    const subFacObj = allFaculties.find(f => f._id === substituteFacultyId);
    if (!subFacObj) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_BASE}/faculty/leave`, {
        timetableId: selectedSlotForLeave._id,
        date: leaveDate,
        substituteFacultyId: subFacObj._id,
        substituteFacultyName: subFacObj.name
      }, { headers });

      if (data.success) {
        toast.success(data.message);
        setShowLeaveModal(false);
        setSelectedSlotForLeave(null);
        setSubstituteFacultyId('');
        fetchSubstitutions(); // refresh grid colors
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply leave.');
    }
  };

  const handleRemoveLeave = async () => {
    if (!selectedSlotForLeave) return;
    if (!window.confirm('Are you sure you want to cancel and remove this leave substitution?')) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_BASE}/faculty/leave/cancel`, {
        timetableId: selectedSlotForLeave._id,
        date: leaveDate
      }, { headers });

      if (data.success) {
        toast.success(data.message);
        setShowLeaveModal(false);
        setSelectedSlotForLeave(null);
        setSubstituteFacultyId('');
        fetchSubstitutions(); // refresh grid colors
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove leave.');
    }
  };

  const renderAIExcelSection = (type) => {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiCpu /> AI-Powered Excel Builder ({type === 'attendance' ? 'Attendance' : 'Marks'})
        </h3>
        
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Define custom columns, and the AI Copilot will automatically aggregate student data (Roll Number, Name, today's attendance/marks, etc.) and calculate formula columns (sums, averages, grades) without manual typing.
        </p>

        {/* Custom Columns Config */}
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Column Definitions</div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {excelColumns.map((col, idx) => (
              <div key={idx} className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none' }}>
                <span><strong>{col.title}</strong>: {col.instruction}</span>
                <FiX onClick={() => setExcelColumns(prev => prev.filter((_, i) => i !== idx))} style={{ cursor: 'pointer' }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="Column Title (e.g., Total Marks)" value={newColTitle} onChange={e => setNewColTitle(e.target.value)} className="input" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }} />
            <input type="text" placeholder="Formula or Data Source (e.g., sum of test 1 and test 2)" value={newColInstr} onChange={e => setNewColInstr(e.target.value)} className="input" style={{ flex: 2, padding: '8px 12px', fontSize: 12 }} />
            <button className="btn btn-secondary" onClick={() => {
              if (!newColTitle.trim() || !newColInstr.trim()) return toast.error('Enter both title and instructions.');
              setExcelColumns(prev => [...prev, { title: newColTitle.trim(), instruction: newColInstr.trim() }]);
              setNewColTitle(''); setNewColInstr('');
            }} style={{ padding: '0 16px', fontSize: 12, height: 40, border: 'none', cursor: 'pointer' }}>+ Add Column</button>
          </div>
        </div>

        {/* Generate / Action Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => handleGenerateExcel(type)} disabled={generatingSheet} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer' }}>
            {generatingSheet ? 'Orchestrating Sheet via AI...' : 'Compile Excel Sheet'}
          </button>
          {generatedSheet && (
            <>
              <button className="btn btn-secondary" onClick={handleDownloadGeneratedSheet} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer' }}><FiDownload /> Download CSV</button>
              <button className="btn btn-primary" onClick={() => handleImportGeneratedSheet(type)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', cursor: 'pointer' }}><FiCheckSquare /> Save to DB</button>
            </>
          )}
        </div>

        {/* Preview and Refine */}
        {generatedSheet && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Spreadsheet Preview</div>
            
            <div style={{ overflowX: 'auto', maxHeight: '220px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, background: 'rgba(255,255,255,0.01)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {generatedSheet.headers.map((h, i) => <th key={i} style={{ padding: '8px 12px', fontWeight: 600, color: '#fff' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {generatedSheet.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {row.map((cell, cIdx) => <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Refinement Prompt */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Iterative Modification Instruction</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" placeholder="e.g. Change column 3 name to Attendance Rate, make student name uppercase, or recalculate average..." value={sheetRefinement} onChange={e => setSheetRefinement(e.target.value)} className="input" style={{ flex: 1, padding: '10px 14px', fontSize: 12 }} />
                <button className="btn btn-secondary" onClick={() => handleGenerateExcel(type)} disabled={generatingSheet} style={{ padding: '0 20px', fontSize: 12, height: 40, border: 'none', cursor: 'pointer' }}>Refine Sheet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Attendance Logic
  const handleMarkStatus = (status) => {
    if (!activeStudentId) return;
    setAttendanceList(prev => ({ ...prev, [activeStudentId]: status }));
    
    // Auto-advance to next student
    const currentIdx = students.findIndex(s => s._id === activeStudentId);
    if (currentIdx < students.length - 1) {
      setActiveStudentId(students[currentIdx + 1]._id);
    } else {
      toast.info('Reached the end of the class roster!');
    }
  };

  const handleSaveAttendance = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const recordPromises = Object.keys(attendanceList).map(studentId => {
        // Save status, fallback to Present if unmarked
        const status = attendanceList[studentId] || 'Present';
        return axios.post(`${API_BASE}/faculty/attendance`, {
          studentId, subject: selectedSubject, date: attendanceDate,
          status, period: attendancePeriod
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
          studentId, subject: selectedSubject, marksType,
          obtainedMarks: Number(obtainedMarks[studentId]),
          totalMarks: Number(totalMarks), comments: marksComments[studentId]
        }, { headers });
      });
      await Promise.all(recordPromises);
      toast.success('Grades uploaded successfully!');
    } catch (e) {
      toast.error('Failed to upload grades.');
    }
  };

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

  const handleBulkUpload = async (type) => {
    const records = [];
    const content = type === 'attendance' ? attendanceFileContent : marksFileContent;
    if (!content.trim()) { toast.error("Please paste CSV contents first!"); return; }
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',');
      const username = cols[0]?.trim();
      const student = students.find(s => s.username === username);
      if (!student) continue;
      if (type === 'attendance') {
        records.push({ studentId: student._id, subject: cols[1]?.trim() || selectedSubject, date: cols[2]?.trim() || attendanceDate, status: cols[3]?.trim() || 'Present', period: Number(cols[4]?.trim() || 1) });
      } else {
        records.push({ studentId: student._id, subject: cols[1]?.trim() || selectedSubject, marksType: cols[2]?.trim() || marksType, obtainedMarks: Number(cols[3]?.trim() || 0), totalMarks: Number(cols[4]?.trim() || 25), comments: cols[5]?.trim() || '' });
      }
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = type === 'attendance' ? '/faculty/attendance/bulk-upload' : '/faculty/marks/bulk-upload';
      const payload = type === 'attendance' ? { attendanceRecords: records } : { marksRecords: records };
      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload, { headers });
      if (data.success) {
        toast.success(data.message);
        if (type === 'attendance') setAttendanceFileContent(''); else setMarksFileContent('');
        fetchStudents();
      }
    } catch (err) { toast.error('Failed to parse and upload records.'); }
  };

  const handleTriggerAiCopilot = async () => {
    setLoadingAi(true); setAiOutput('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_BASE}/faculty/ai-action`, { actionType: aiAction, promptText: aiPrompt }, { headers });
      if (data.success) setAiOutput(data.result);
    } catch (e) { toast.error('Failed to execute AI Copilot action.'); }
    finally { setLoadingAi(false); }
  };

  // Clock-derived period
  const getCurrentPeriodNum = () => {
    const now = new Date();
    const t = now.getHours() * 60 + now.getMinutes();
    if (t >= 540 && t < 600) return 1;
    if (t >= 600 && t < 660) return 2;
    if (t >= 660 && t < 720) return 3;
    if (t >= 720 && t < 780) return 4;
    if (t >= 840 && t < 900) return 5;
    if (t >= 900 && t < 960) return 6;
    if (t >= 960 && t < 1020) return 7;
    return null;
  };
  const activePeriod = getCurrentPeriodNum();
  const liveActivePeriodClass = activePeriod ? todayClasses.find(c => c.period === activePeriod) : null;
  const activeClass = liveActivePeriodClass || currentClass;
  const activeStudent = students.find(s => s._id === activeStudentId);

  return (
    <div className="app-layout">

      {/* ═══════ FIXED SIDEBAR (PERFECT MATCH ADMIN PORTAL) ═══════ */}
      <aside className={`campus-sidebar ${collapsed ? 'collapsed' : ''}`}>
        
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/navx-icon.png" alt="NavX Logo" className="sidebar-logo" style={{ objectFit: 'cover' }} />
            {!collapsed && (
              <div className="sidebar-brand-text">
                <div className="sidebar-title">NavX</div>
                <div className="sidebar-subtitle">Faculty Portal</div>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            {collapsed ? <FiMenu /> : <FiX />}
          </button>
        </div>

        {/* Welcome Section */}
        {!collapsed && (
          <div style={{ padding: '16px 14px 4px 14px' }}>
            <div className="sidebar-user" style={{ background: 'rgba(99, 102, 241, 0.04)' }}>
              <div className="sidebar-avatar" style={{ background: 'var(--gradient-primary)' }}>
                {faculty.name?.charAt(0).toUpperCase() || 'F'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-role">WELCOME,</div>
                <div className="sidebar-username">Prof. {faculty.name}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">Management</div>}
          {SIDEBAR_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button 
                key={item.key} 
                onClick={() => setActiveTab(item.key)}
                className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
                style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                data-tooltip={item.label}
              >
                <Icon className="sidebar-icon" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout Footer */}
        <div className="sidebar-footer">
          <button 
            onClick={onLogout}
            className="sidebar-logout-btn" 
            style={{ border: 'none', background: 'rgba(239, 68, 68, 0.06)', cursor: 'pointer' }}
          >
            <FiLogOut />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT AREA (FLEX siblings alignment) ═══════ */}
      <div className="main-content">
        <div className="page-container" style={{ padding: '24px 32px' }}>

          {/* TAB 1: CLASSES (DASHBOARD) */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="page-title">Today's Class Schedule</h1>
                <p className="page-subtitle">Manage class attendance and check upcoming lectures of the day.</p>
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
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiActivity color={liveActivePeriodClass ? "#ef4444" : "var(--text-muted)"} />
                    Current Class Period {liveActivePeriodClass ? '(Live Status: Active Now)' : '(No Active Slot)'}
                  </h3>
                  {activeClass ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                      <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{activeClass.subject}</h2>
                            <p style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><FiMapPin /> Classroom: {activeClass.roomName}</p>
                          </div>
                          <span className="badge" style={{ background: liveActivePeriodClass ? '#ef444420' : '#3b82f620', color: liveActivePeriodClass ? '#ef4444' : '#3b82f6', border: liveActivePeriodClass ? '1px solid #ef444440' : '1px solid #3b82f640' }}>
                            Period {activeClass.period}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiClock /> {activeClass.startTime} - {activeClass.endTime}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiUsers /> Section: {activeClass.section} (Sem {activeClass.semester})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-primary" onClick={() => {
                          setSelectedSubject(activeClass.subject);
                          setSelectedSec(activeClass.section);
                          setSelectedSem(activeClass.semester);
                          setActiveTab('attendance');
                        }}>
                          Mark Attendance
                        </button>
                        <button className="btn btn-secondary" onClick={() => {
                          setSelectedSubject(activeClass.subject);
                          setSelectedSec(activeClass.section);
                          setSelectedSem(activeClass.semester);
                          setActiveTab('marks');
                        }}>
                          Upload Internal Grades
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', padding: '24px 0' }}>No classes currently scheduled today.</p>
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

          {/* TAB 2: MY WEEKLY SCHEDULE */}
          {activeTab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="page-title">My Weekly Teaching Schedule</h1>
                <p className="page-subtitle">Visualize your teaching slots, rooms, labs, and weekly workload hours.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 24 }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Teaching Calendar Grid</h3>
                    <button className="btn btn-secondary btn-sm" onClick={handleDownloadTimetable} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                      <FiDownload /> Download Timetable
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="venues-table" style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th>Day</th>
                          {PERIODS.map(p => (
                            <th key={p}>
                              <div>P{p}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 'normal', marginTop: 2 }}>{PERIOD_TIMINGS[p].start}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => (
                          <tr key={day}>
                            <td style={{ textAlign: 'left', padding: '12px 16px' }}><strong>{day}</strong></td>
                             {PERIODS.map(p => {
                              const slot = fullTimetable.find(s => s.dayOfWeek === day && s.period === p);
                              const subEntry = slot ? substitutions.find(s => s.timetableId === slot._id) : null;
                              return (
                                <td key={p} style={{ padding: 6, minWidth: '120px' }}>
                                  {slot ? (
                                    <div 
                                      onClick={() => {
                                        setSelectedSlotForLeave(slot);
                                        setSubstituteFacultyId('');
                                        setShowLeaveModal(true);
                                      }}
                                      title="Click to apply substitution leave"
                                      style={{ 
                                        background: subEntry ? 'rgba(239, 68, 68, 0.08)' : (slot.subject.toLowerCase().includes('lab') ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)'), 
                                        border: subEntry ? '1px solid rgba(239, 68, 68, 0.4)' : (slot.subject.toLowerCase().includes('lab') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)'), 
                                        padding: 8, 
                                        borderRadius: 8, 
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center'
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: subEntry ? '#ef4444' : '#fff' }}>{slot.subject}</div>
                                      <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 10 }}>Room {slot.roomName}</div>
                                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Sec {slot.section} (Sem {slot.semester})</div>
                                      {subEntry ? (
                                        <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>[Sub: {subEntry.substituteFacultyName}]</div>
                                      ) : (
                                        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>Click to apply leave</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'rgba(255,255,255,0.05)', fontSize: 13 }}>Off Period</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 className="card-title">Schedule Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Weekly Teaching Load</span>
                      <strong style={{ color: '#fff' }}>{fullTimetable.length} hours</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Contract Workload Cap</span>
                      <strong style={{ color: '#6366f1' }}>{faculty.maxWeeklyHours || 16} hours</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Remaining Cap Limit</span>
                      <strong style={{ color: '#10b981' }}>{Math.max((faculty.maxWeeklyHours || 16) - fullTimetable.length, 0)} hours</strong>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: 12, marginTop: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><FiInfo /> Quick Tip</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                      Lab sessions are highlighted in green. If you have schedule clashes or need room changes, contact the Campus Administrator.
                    </p>
                  </div>
              {/* Leave Modal Overlay */}
              {showLeaveModal && selectedSlotForLeave && (() => {
                const existingSubForDate = substitutions.find(s => s.timetableId === selectedSlotForLeave._id && s.date === leaveDate);
                return (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(4px)'
                  }}>
                    <div className="card" style={{ width: '400px', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>Apply Substitution Leave</h3>
                        <button onClick={() => { setShowLeaveModal(false); setSelectedSlotForLeave(null); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}><FiX /></button>
                      </div>
                      
                      <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <div><strong>Slot:</strong> <span style={{ color: '#fff' }}>{selectedSlotForLeave.subject}</span></div>
                        <div style={{ marginTop: 4 }}><strong>Timing:</strong> <span style={{ color: '#fff' }}>{selectedSlotForLeave.startTime} - {selectedSlotForLeave.endTime} ({selectedSlotForLeave.dayOfWeek})</span></div>
                        <div style={{ marginTop: 4 }}><strong>Class:</strong> <span style={{ color: '#fff' }}>Sec {selectedSlotForLeave.section} (Sem {selectedSlotForLeave.semester})</span></div>
                      </div>

                      {existingSubForDate && (
                        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: 11, color: '#ef4444' }}>
                          Currently Substituted by <strong>{existingSubForDate.substituteFacultyName}</strong> on this date.
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date of Leave</label>
                        <input 
                          type="date" 
                          value={leaveDate} 
                          onChange={e => setLeaveDate(e.target.value)} 
                          className="input" 
                          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: 6 }} 
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Select Substitute Faculty</label>
                        <select 
                          value={substituteFacultyId} 
                          onChange={e => setSubstituteFacultyId(e.target.value)} 
                          className="input" 
                          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: 6 }}
                        >
                          <option value="">-- Choose Substitute Faculty --</option>
                          {allFaculties.filter(f => f._id !== faculty._id).map(f => (
                            <option key={f._id} value={f._id}>{f.name} ({f.department})</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => { setShowLeaveModal(false); setSelectedSlotForLeave(null); }} 
                          style={{ 
                            padding: '10px 16px', 
                            fontSize: 13, 
                            borderRadius: 8, 
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.02)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Cancel
                        </button>
                        {existingSubForDate && (
                          <button 
                            className="btn btn-danger" 
                            onClick={handleRemoveLeave} 
                            style={{ 
                              padding: '10px 16px', 
                              fontSize: 13, 
                              borderRadius: 8, 
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444', 
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Remove Leave
                          </button>
                        )}
                        <button 
                          className="btn btn-primary" 
                          onClick={handleApplyLeave} 
                          style={{ 
                            padding: '10px 16px', 
                            fontSize: 13, 
                            borderRadius: 8, 
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            color: '#fff', 
                            cursor: 'pointer',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {existingSubForDate ? 'Change Substitute' : 'Apply Leave'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

          {/* TAB 3: ATTENDANCE (Split-Screen Roster Grid) */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 className="page-title">Class Attendance</h1>
                  <p className="page-subtitle">Select students from the roster grid and mark presence with one click.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSaveAttendance} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiCheckSquare /> Save All Attendance
                </button>
              </div>

              {/* Top Control Bar */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 2, minWidth: 150 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Subject</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Section</label>
                    <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Semester</label>
                    <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="input" style={{ width: '100%' }}>
                      {['1', '2', '3', '4', '5', '6', '7', '8'].map(sem => <option key={sem} value={sem}>Sem {sem}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1.5, minWidth: 150 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Date</label>
                    <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="input" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Period</label>
                    <input type="number" value={attendancePeriod} onChange={e => setAttendancePeriod(Number(e.target.value))} className="input" style={{ width: '100%' }} min={1} max={7} />
                  </div>
                </div>
              </div>

              {/* Split view Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                
                {/* Left Column: Roster and Bulk Import */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Roster Card */}
                  <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiUsers /> Roster Grid ({students.length} students)</h3>
                    {loadingStudents ? (
                      <p>Loading roster grid...</p>
                    ) : students.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>No students enrolled for Sec {selectedSec}.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                        {students.map(stud => {
                          const isActive = stud._id === activeStudentId;
                          const status = attendanceList[stud._id];
                          const borderColor = status === 'Present' ? '#10b981' : status === 'Absent' ? '#ef4444' : 'rgba(255,255,255,0.06)';
                          
                          return (
                            <button
                              key={stud._id}
                              onClick={() => setActiveStudentId(stud._id)}
                              className="relative flex flex-col items-center justify-center rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer"
                              style={{
                                minWidth: 110,
                                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                                border: isActive ? '2px solid #6366f1' : `2px solid ${borderColor}`,
                                boxShadow: isActive ? '0 0 24px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(99, 102, 241, 0.3)' : 'none',
                              }}
                            >
                              {/* Status dot indicator */}
                              {status && (
                                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                                  style={{ background: status === 'Present' ? '#10b981' : '#ef4444' }} />
                              )}
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mb-2"
                                style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
                                {stud.username?.slice(0, 2)?.toUpperCase() || '?'}
                              </div>
                              <div className="text-white font-semibold text-[11px] text-center leading-tight">{stud.rollNumber || stud.username}</div>
                              <div className="text-[9px] mt-0.5 text-center" style={{ color: 'var(--text-muted)' }}>
                                {stud.username}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* AI Excel Generator */}
                  {renderAIExcelSection('attendance')}
                </div>

                {/* Right Column: Student Profile Action Sidebar */}
                <div className="card flex flex-col items-center" style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
                  <h3 className="card-title w-full mb-4">Student Profile & Action</h3>
                  {activeStudent ? (
                    <div className="flex flex-col items-center w-full">
                      {/* Avatar */}
                      <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4"
                        style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 0 32px rgba(99, 102, 241, 0.3)' }}>
                        {activeStudent.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>

                      {/* Name & Roll */}
                      <div className="text-white font-bold text-lg text-center">{activeStudent.rollNumber || activeStudent.username}</div>
                      <div className="text-xs mt-1 text-center" style={{ color: 'var(--text-secondary)' }}>@{activeStudent.username}</div>

                      {/* Profile Fields list */}
                      <div className="w-full mt-5 flex flex-col gap-2.5">
                        {[
                          { label: 'Department', value: activeStudent.department || selectedDept },
                          { label: 'Semester', value: `Sem ${activeStudent.semester || selectedSem}` },
                          { label: 'Section', value: activeStudent.section || selectedSec },
                          { label: 'Attendance', value: `${activeStudent.attendancePercent || 85}%` },
                          { label: 'Fee Status', value: activeStudent.feeStatus || 'Pending' },
                          { label: 'Status', value: activeStudent.academicStatus || 'Active' },
                        ].map((r, i) => (
                          <div key={i} className="flex justify-between text-xs pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                            <span className="text-white font-medium">{r.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Status indicator banner */}
                      {attendanceList[activeStudent._id] && (
                        <div className="mt-4 px-4 py-2 rounded-lg text-xs font-bold text-center w-full"
                          style={{
                            background: attendanceList[activeStudent._id] === 'Present' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: attendanceList[activeStudent._id] === 'Present' ? '#10b981' : '#ef4444',
                            border: `1px solid ${attendanceList[activeStudent._id] === 'Present' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                          Status: {attendanceList[activeStudent._id]}
                        </div>
                      )}

                      {/* Present/Absent Actions */}
                      <div className="w-full mt-5 flex flex-col gap-3">
                        <button onClick={() => handleMarkStatus('Present')}
                          className="btn btn-primary"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '12px 0', fontSize: '13px', fontWeight: 700, width: '100%', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)' }}>
                          Present
                        </button>
                        <button onClick={() => handleMarkStatus('Absent')}
                          className="btn btn-danger"
                          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: '#fff', padding: '12px 0', fontSize: '13px', fontWeight: 700, width: '100%', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)' }}>
                          Absent
                        </button>
                      </div>

                      <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
                        Selection advances automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-12 gap-3">
                      <FiUsers size={40} style={{ color: 'var(--text-muted)' }} />
                      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Select a student from the grid to view profile and mark status.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: MARKS */}
          {activeTab === 'marks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div><h1 className="page-title">Student Grades</h1><p className="page-subtitle">Upload results for Internal Exams, Assignments, or Semesters.</p></div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>Subject</label><select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>{faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="form-group" style={{ flex: 1, minWidth: 120 }}><label>Section</label><select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>{faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="form-group" style={{ flex: 1, minWidth: 100 }}><label>Semester</label><select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="input" style={{ width: '100%' }}>{['1', '2', '3', '4', '5', '6', '7', '8'].map(sem => <option key={sem} value={sem}>Sem {sem}</option>)}</select></div>
                  <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>Marks Category</label><select value={marksType} onChange={e => setMarksType(e.target.value)} className="input" style={{ width: '100%' }}><option value="Mid 1">Mid 1</option><option value="Mid 2">Mid 2</option><option value="OBE">OBE</option><option value="Assignment">Assignment</option><option value="Internal Exam">Internal Exam</option></select></div>
                  <div className="form-group" style={{ flex: 1, minWidth: 100 }}><label>Max Marks</label><input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} className="input" style={{ width: '100%' }} /></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
                <div className="card">
                  <h3 className="card-title">Grades Roster</h3>
                  {loadingStudents ? (<p>Loading roster...</p>) : students.length === 0 ? (<p style={{ color: 'var(--text-secondary)' }}>No students enrolled.</p>) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                      {students.map(stud => (
                        <div key={stud._id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ color: '#fff', fontWeight: 600 }}>{stud.username}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Roll: {stud.rollNumber || 'N/A'}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="number" placeholder="Marks" value={obtainedMarks[stud._id] || ''} onChange={e => setObtainedMarks(prev => ({ ...prev, [stud._id]: e.target.value }))} className="input" style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }} />
                              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>/ {totalMarks}</span>
                            </div>
                          </div>
                          <input type="text" placeholder="Remarks (e.g. Excellent, Good progress)" value={marksComments[stud._id] || ''} onChange={e => setMarksComments(prev => ({ ...prev, [stud._id]: e.target.value }))} className="input" style={{ width: '100%', padding: '6px 10px', fontSize: 12 }} />
                        </div>
                      ))}
                      <button className="btn btn-primary" onClick={handleSaveMarks} style={{ alignSelf: 'flex-end', marginTop: 16 }}>Upload Grades</button>
                    </div>
                  )}
                </div>

                {/* AI Excel Generator */}
                {renderAIExcelSection('marks')}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="page-title">Subject Performance Analytics</h1>
                <p className="page-subtitle">Monitor class pass percentages, averages, and student performance clusters.</p>
              </div>

              {/* Filters */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1.5, minWidth: 150 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Select Subject</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Select Section</label>
                    <select value={selectedSec} onChange={e => setSelectedSec(e.target.value)} className="input" style={{ width: '100%' }}>
                      {faculty.assignedSections?.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1.5, minWidth: 150 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Exam Category</label>
                    <select value={analyticsMarksType} onChange={e => setAnalyticsMarksType(e.target.value)} className="input" style={{ width: '100%' }}>
                       <option value="Mid 1">Mid 1</option>
                       <option value="Mid 2">Mid 2</option>
                       <option value="OBE">OBE</option>
                       <option value="Assignment">Assignment</option>
                       <option value="Internal Exam">Internal Exam</option>
                       <option value="Semester">End Sem Exam</option>
                    </select>
                  </div>
                </div>
              </div>

              {loadingAnalytics ? (
                <p>Loading analytics graphs...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="card-grid">
                    <div className="stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="stat-value" style={{ color: '#10b981' }}>{analyticsData.passPercentage}%</div>
                          <div className="stat-label">Pass Rate ({analyticsMarksType})</div>
                        </div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="stat-value" style={{ color: '#6366f1' }}>{analyticsData.averageMarks}%</div>
                          <div className="stat-label">Class Average Score</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div className="card">
                      <h3 className="card-title" style={{ color: '#ec4899', marginBottom: 12 }}>Underperforming Students (&lt;50%)</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {analyticsData.weakStudents?.length > 0 ? (
                          analyticsData.weakStudents.map((s, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 8 }}>
                              <span style={{ color: '#fff', fontWeight: 600 }}>{s.name}</span>
                              <span style={{ color: '#ec4899' }}>{s.percentage}%</span>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)' }}>No students in this bracket.</p>
                        )}
                      </div>
                    </div>

                    <div className="card">
                      <h3 className="card-title" style={{ color: '#10b981', marginBottom: 12 }}>High Achievers (&gt;=80%)</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {analyticsData.strongStudents?.length > 0 ? (
                          analyticsData.strongStudents.map((s, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8 }}>
                              <span style={{ color: '#fff', fontWeight: 600 }}>{s.name}</span>
                              <span style={{ color: '#10b981' }}>{s.percentage}%</span>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)' }}>No students in this bracket.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AI COPILOT */}
          {activeTab === 'copilot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="page-title">AI Faculty Copilot</h1>
                <p className="page-subtitle">Generate lecture notes, homework templates, and exam question sheets using Google Gemini.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card">
                  <h3 className="card-title">Copilot Settings</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>AI Task Category</label>
                      <select value={aiAction} onChange={e => setAiAction(e.target.value)} className="input" style={{ width: '100%' }}>
                        <option value="CREATE_PPT">Create Presentation Slides Outline</option>
                        <option value="CREATE_ASSIGNMENT">Create Assignment sheets</option>
                        <option value="CREATE_QUESTION_PAPER">Design Exam Question Paper</option>
                        <option value="CREATE_LESSON_PLAN">Draft Weekly Lesson Plan</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Instruction Prompt / Context</label>
                      <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. Unit 3: Database Indexing, B-Trees and Hash Indexing with practical exercises." className="input" style={{ width: '100%', height: '100px', resize: 'none' }} />
                    </div>

                    <button className="btn btn-primary" onClick={handleTriggerAiCopilot} disabled={loadingAi} style={{ display: 'flex', alignItems: 'center', justify: 'center', gap: 8 }}>
                      {loadingAi ? 'AI Thinking...' : 'Generate with Gemini'}
                    </button>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 className="card-title">AI Copilot Output</h3>
                  <div style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginTop: 16, overflowY: 'auto', maxHeight: '400px' }}>
                    {aiOutput ? (
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, color: '#fff', lineHeight: 1.6 }}>
                        {aiOutput}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gemini outputs will be displayed here in Markdown.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="page-title">My Faculty Profile</h1>
                <p className="page-subtitle">Manage office hours, contact numbers, and check mapped cabin locations.</p>
              </div>

              <div className="card" style={{ maxWidth: '600px' }}>
                <h3 className="card-title" style={{ marginBottom: 16 }}>Profile Information</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Full Name</span>
                    <strong style={{ color: '#fff' }}>{faculty.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Employee ID</span>
                    <strong style={{ color: '#fff' }}>{faculty.employeeId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Department</span>
                    <strong style={{ color: '#fff' }}>{faculty.department}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Designation</span>
                    <strong style={{ color: '#fff' }}>{faculty.designation}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Faculty Cabin</span>
                    <strong style={{ color: '#fff' }}>{faculty.facultyRoom}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Email Address</span>
                    <strong style={{ color: '#fff' }}>{faculty.email}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Office Hours</span>
                    <strong style={{ color: '#fff' }}>{faculty.officeHours}</strong>
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
