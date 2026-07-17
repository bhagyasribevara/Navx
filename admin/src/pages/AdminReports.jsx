import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useOutletContext } from 'react-router-dom';
import { FiFileText, FiBarChart2, FiUsers, FiSearch } from 'react-icons/fi';

export default function AdminReports({ admin }) {
  const { campus } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState({
    attendanceTrend: [
      { label: 'Mon', value: 88 },
      { label: 'Tue', value: 92 },
      { label: 'Wed', value: 85 },
      { label: 'Thu', value: 90 },
      { label: 'Fri', value: 82 }
    ],
    qrScans: [
      { label: 'Week 1', value: 142 },
      { label: 'Week 2', value: 215 },
      { label: 'Week 3', value: 310 },
      { label: 'Week 4', value: 450 }
    ],
    topSearches: [
      { term: 'Library', count: 184 },
      { term: 'Seminar Hall B', count: 120 },
      { term: 'Cafeteria', count: 95 },
      { term: 'Principal Office', count: 76 },
      { term: 'CSE HOD Room', count: 54 }
    ],
    facultyStatus: [],
    averageAttendance: "87.4",
    totalQrScansMonth: "1,121"
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("navx_token");
  const headers = { Authorization: `Bearer ${token}` };

  const loadReports = async () => {
    setLoading(true);
    try {
      const campusId = campus._id;
      // Load faculty roster to summarize leave status
      const res = await axios.get(`${API_BASE}/campus/${campusId}/faculties`, { headers });
      
      // Load analytics summary
      const analyticsRes = await axios.get(`${API_BASE}/analytics/summary/${campusId}`, { headers });
      const analyticsData = analyticsRes.data;

      setReportsData(prev => ({
        ...prev,
        facultyStatus: res.data.faculties || [],
        attendanceTrend: analyticsData.attendanceTrend && analyticsData.attendanceTrend.length > 0 ? analyticsData.attendanceTrend : prev.attendanceTrend,
        qrScans: analyticsData.qrScans && analyticsData.qrScans.length > 0 ? analyticsData.qrScans : prev.qrScans,
        topSearches: analyticsData.topSearches && analyticsData.topSearches.length > 0 ? analyticsData.topSearches.map(ts => ({ term: ts._id || 'Unknown', count: ts.count })) : prev.topSearches,
        averageAttendance: analyticsData.averageAttendance || "0",
        totalQrScansMonth: analyticsData.qrCount || 0,
      }));
    } catch (e) {
      toast.error('Failed to compile campus metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campus?._id) {
      loadReports();
    }
  }, [campus]);

  const activeFacultiesCount = reportsData.facultyStatus.filter(f => f.status === 'active').length;
  const onLeaveFacultiesCount = reportsData.facultyStatus.filter(f => f.leaveStatus === 'On Leave').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campus Reports & Analytics</h1>
          <p className="page-subtitle">Examine student attendance metrics, search behaviors, and faculty leave rosters.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div>
            <div className="stat-value">{activeFacultiesCount}</div>
            <div className="stat-label">Active Teachers</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-value">{onLeaveFacultiesCount}</div>
            <div className="stat-label">Teachers On Leave</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-value">{reportsData.averageAttendance}%</div>
            <div className="stat-label">Average Attendance</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-value">{reportsData.totalQrScansMonth}</div>
            <div className="stat-label">Total QR Scans (Month)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        
        {/* Attendance trend bar chart */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiBarChart2 color="#6366f1" /> Attendance Trend (%)</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '200px', padding: '20px 10px 10px 10px', marginTop: 12 }}>
            {reportsData.attendanceTrend.map((t, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{t.value}%</div>
                <div style={{
                  width: '35px',
                  height: `${t.value * 1.5}px`,
                  background: 'linear-gradient(to top, #6366f1, #a855f7)',
                  borderRadius: '6px 6px 0 0',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* QR Scan growth */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiFileText color="#10b981" /> QR Scan Volume</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '200px', padding: '20px 10px 10px 10px', marginTop: 12 }}>
            {reportsData.qrScans.map((q, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{q.value}</div>
                <div style={{
                  width: '40px',
                  height: `${q.value * 0.3}px`,
                  background: 'linear-gradient(to top, #10b981, #34d399)',
                  borderRadius: '6px 6px 0 0',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top searches */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiSearch color="#f59e0b" /> Top Navigation Searches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {reportsData.topSearches.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#fff' }}>
                  <span>{s.term}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{s.count} searches</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(s.count / 200) * 100}%`, height: '100%', background: 'linear-gradient(to right, #f59e0b, #ec4899)', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faculty Status List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiUsers color="#ec4899" /> Faculty Attendance Status</h3>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 16, maxHeight: '220px' }}>
            {loading ? (
              <p>Loading status...</p>
            ) : reportsData.facultyStatus.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No faculty registered.</p>
            ) : (
              <table className="venues-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Dept</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsData.facultyStatus.map(f => (
                    <tr key={f._id}>
                      <td><strong>{f.name}</strong></td>
                      <td>{f.department}</td>
                      <td>
                        <span className="badge" style={{
                          background: f.leaveStatus === 'On Leave' ? '#ef444420' : '#10b98120',
                          color: f.leaveStatus === 'On Leave' ? '#ef4444' : '#10b981',
                          border: f.leaveStatus === 'On Leave' ? '1px solid #ef444440' : '1px solid #10b98140'
                        }}>
                          {f.leaveStatus === 'On Leave' ? 'On Leave' : 'Active (Present)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
