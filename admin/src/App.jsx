import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMap, FiGrid, FiLayers, FiNavigation, FiBarChart2, FiSettings, FiHome, FiAlertCircle } from 'react-icons/fi';
import { MdQrCode2, MdBluetooth } from 'react-icons/md';
import Dashboard from './pages/Dashboard';
import CampusManager from './pages/CampusManager';
import MapEditor from './pages/MapEditor';
import PositioningSetup from './pages/PositioningSetup';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import EmergencyDashboard from './pages/EmergencyDashboard';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

function App() {
  const [admin, setAdmin] = React.useState(null);
  const location = useLocation();
  const isEditorPage = location.pathname.startsWith('/editor');

  React.useEffect(() => {
    const savedAdmin = localStorage.getItem('navx_admin');
    if (savedAdmin) {
      setAdmin(JSON.parse(savedAdmin));
    }
  }, []);

  const handleLogin = (adminData) => {
    localStorage.setItem('navx_admin', JSON.stringify(adminData));
    setAdmin(adminData);
  };

  const handleLogout = () => {
    localStorage.removeItem('navx_admin');
    setAdmin(null);
  };

  if (!admin) {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  if (admin.role === 'SuperAdmin') {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <SuperAdminDashboard admin={admin} onLogout={handleLogout} />
      </>
    );
  }

  return (
    <div className="app-layout">
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
      {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
      <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
        {!isEditorPage && <TopBar />}
        <Routes>
          <Route path="/" element={<Dashboard admin={admin} />} />
          <Route path="/campus" element={<CampusManager admin={admin} />} />
          <Route path="/editor/:campusId" element={<MapEditor />} />
          <Route path="/positioning/:campusId" element={<PositioningSetup />} />
          <Route path="/analytics" element={<AnalyticsDashboard admin={admin} />} />
          <Route path="/emergency" element={<EmergencyDashboard admin={admin} />} />
        </Routes>
      </div>
    </div>
  );
}

function Sidebar({ admin, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">N</div>
        <div>
          <div className="sidebar-title">NavX</div>
          <div className="sidebar-subtitle">Admin Console</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <FiHome /> Dashboard
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Management</div>
          <NavLink to="/campus" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiGrid /> Venues & Maps
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Safety</div>
          <NavLink to="/emergency" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiAlertCircle /> Emergency Alert
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Analytics</div>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiBarChart2 /> Analytics
          </NavLink>
        </div>
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div>NavX Admin v1.0</div>
        <div style={{ marginTop: '8px', cursor: 'pointer', color: 'var(--danger-color, #ef4444)' }} onClick={onLogout}>
          Logout
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  return (
    <div className="top-bar">
      <div className="breadcrumbs">
        <span className="breadcrumb">NavX</span>
        {pathParts.map((p, i) => (
          <span key={i}>
            <span className="breadcrumb-sep">/</span>
            <span className={`breadcrumb ${i === pathParts.length - 1 ? 'active' : ''}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </span>
          </span>
        ))}
        {pathParts.length === 0 && <><span className="breadcrumb-sep">/</span><span className="breadcrumb active">Dashboard</span></>}
      </div>
    </div>
  );
}

export default App;
