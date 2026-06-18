import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FiBarChart2, FiNavigation, FiSearch } from 'react-icons/fi';
import { MdQrCode2 } from 'react-icons/md';
import * as api from '../api';
import { useAdminPageContext } from '../components/AdminPageContext';

export default function AnalyticsDashboard({ admin }) {
  const [campuses, setCampuses] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [summary, setSummary] = useState(null);
  const context = useOutletContext() || {};
  const { setPageContext } = useAdminPageContext();

  useEffect(() => { 
    if (context.campus) {
      setCampuses([context.campus]);
      setSelectedCampus(context.campus);
    } else {
      api.getCampuses().then(r => { 
        let campusList = r.data;
        if (admin && (admin.role === 'CampusAdmin' || admin.role === 'VenueAdmin' || admin.role === 'campus_admin') && admin.campusId) {
          const cId = admin.campusId._id || admin.campusId;
          campusList = campusList.filter(c => c._id === cId);
        }
        setCampuses(campusList); 
        if (campusList.length) setSelectedCampus(campusList[0]); 
      }); 
    }
  }, [context.campus]);

  useEffect(() => {
    if (selectedCampus) {
      api.getAnalyticsSummary(selectedCampus._id).then(r => setSummary(r.data)).catch(() => setSummary(null));
    }
  }, [selectedCampus]);

  const stats = summary ? [
    { label: 'Navigations', value: summary.navCount, icon: <FiNavigation />, color: '#6366f1' },
    { label: 'Searches', value: summary.searchCount, icon: <FiSearch />, color: '#22c55e' },
    { label: 'QR Scans', value: summary.qrCount, icon: <MdQrCode2 />, color: '#f59e0b' },
  ] : [];

  useEffect(() => {
    setPageContext({
      pageName: 'Analytics Dashboard',
      data: {
        selectedCampusName: selectedCampus?.name || 'All/None',
        summary,
        widgets: stats.map(s => ({ label: s.label, value: s.value }))
      }
    });
  }, [selectedCampus, summary]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Navigation usage and popular routes {context.campus ? `for ${context.campus.campusName}` : ''}</p>
        </div>
        {!context.campus && (
          <select className="input" style={{ width: 200 }} value={selectedCampus?._id || ''} onChange={e => setSelectedCampus(campuses.find(c => c._id === e.target.value))}>
            {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {!summary ? (
        <div className="empty-state">
          <FiBarChart2 style={{ fontSize: 48, opacity: 0.3 }} />
          <h3>No analytics data yet</h3>
          <p>Data will appear once users start navigating</p>
        </div>
      ) : (
        <>
          <div className="card-grid" style={{ marginBottom: 24 }}>
            {stats.map((s, i) => (
              <div className="stat-card" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                  <div style={{ fontSize: 28, color: s.color, opacity: 0.6 }}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Top Searches</h3>
              {summary.topSearches?.length > 0 ? (
                <table><thead><tr><th>Query</th><th>Count</th></tr></thead><tbody>
                  {summary.topSearches.map((s, i) => <tr key={i}><td>{s._id}</td><td><span className="badge badge-primary">{s.count}</span></td></tr>)}
                </tbody></table>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No search data</p>}
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Popular Routes</h3>
              {summary.topRoutes?.length > 0 ? (
                <table><thead><tr><th>Route</th><th>Count</th></tr></thead><tbody>
                  {summary.topRoutes.map((r, i) => <tr key={i}><td>{r._id?.from} → {r._id?.to}</td><td><span className="badge badge-success">{r.count}</span></td></tr>)}
                </tbody></table>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No route data</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
