import React from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, useParams, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMap, FiGrid, FiLayers, FiNavigation, FiBarChart2, FiSettings, FiHome, FiAlertCircle } from 'react-icons/fi';
import Dashboard from './pages/Dashboard';
import CampusManager from './pages/CampusManager';
import MapEditor from './pages/MapEditor';
import PositioningSetup from './pages/PositioningSetup';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import EmergencyDashboard from './pages/EmergencyDashboard';
import CampaignManager from './pages/CampaignManager';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { getCampusByCode } from './api';

function App() {
  const [admin, setAdmin] = React.useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isEditorPage = location.pathname.includes('/editor/');

  const pathParts = location.pathname.split('/').filter(Boolean);
  const isCampusSpecificWorkspace = pathParts[0] === 'campus' && pathParts.length >= 2;

  React.useEffect(() => {
    const savedAdmin = localStorage.getItem('navx_admin');
    if (savedAdmin) {
      try {
        const parsed = JSON.parse(savedAdmin);
        setAdmin(parsed);
        
        // Auto-redirect campus admins to their dedicated workspace if hitting root
        if (location.pathname === '/' && parsed.role === 'campus_admin' && parsed.campus?.campusCode) {
          navigate(`/campus/${parsed.campus.campusCode}`);
        }
      } catch (e) {}
    }
  }, []);

  // Security guard (Phase 12): Prevent campus admins from typing URLs to escape their workspace
  React.useEffect(() => {
    if (admin && admin.role === 'campus_admin' && admin.campus?.campusCode) {
      const workspacePrefix = `/campus/${admin.campus.campusCode}`;
      if (!location.pathname.startsWith(workspacePrefix)) {
        navigate(workspacePrefix);
      }
    }
  }, [location.pathname, admin]);

  const handleLogin = (adminData) => {
    localStorage.setItem('navx_admin', JSON.stringify(adminData));
    setAdmin(adminData);
    
    if (adminData.role === 'campus_admin' && adminData.campus?.campusCode) {
      navigate(`/campus/${adminData.campus.campusCode}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('navx_admin');
    localStorage.removeItem('navx_token');
    setAdmin(null);
    navigate('/');
  };

  // If not authenticated and NOT accessing a specific campus workspace URL, show generic login
  if (!admin && !isCampusSpecificWorkspace) {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  // SuperAdmin layout
  if (admin && admin.role === 'SuperAdmin' && !isCampusSpecificWorkspace) {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <SuperAdminDashboard admin={admin} onLogout={handleLogout} />
      </>
    );
  }

  return (
    <>
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
      <Routes>
        {/* Default SuperAdmin or Legacy Routes */}
        <Route
          path="/"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <Dashboard admin={admin} />
              </div>
            </div>
          }
        />
        <Route
          path="/campus"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <CampusManager admin={admin} />
              </div>
            </div>
          }
        />
        <Route path="/editor/:campusId" element={<MapEditor />} />
        <Route
          path="/positioning/:campusId"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <PositioningSetup />
              </div>
            </div>
          }
        />
        <Route
          path="/campaigns"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <CampaignManager admin={admin} />
              </div>
            </div>
          }
        />
        <Route
          path="/analytics"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <AnalyticsDashboard admin={admin} />
              </div>
            </div>
          }
        />
        <Route
          path="/emergency"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
                {!isEditorPage && <TopBar />}
                <EmergencyDashboard admin={admin} />
              </div>
            </div>
          }
        />

        {/* Campus Admin Workspace Routes (Phase 7, 13) */}
        <Route
          path="/campus/:campusCode"
          element={
            <CampusWorkspaceWrapper
              admin={admin}
              setAdmin={setAdmin}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<Dashboard admin={admin} />} />
          <Route path="venues" element={<CampusManager admin={admin} />} />
          <Route path="editor/:campusId" element={<MapEditor />} />
          <Route path="positioning/:campusId" element={<PositioningSetup />} />
          <Route path="campaigns" element={<CampaignManager admin={admin} />} />
          <Route path="analytics" element={<AnalyticsDashboard admin={admin} />} />
          <Route path="emergency" element={<EmergencyDashboard admin={admin} />} />
        </Route>
      </Routes>
    </>
  );
}

// Dedicated Workspace wrapper for campus-specific admin access (Phase 3, 5, 7, 12)
function CampusWorkspaceWrapper({ admin, setAdmin, onLogout }) {
  const { campusCode } = useParams();
  const [campus, setCampus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setLoading(true);
    setNotFound(false);
    getCampusByCode(campusCode)
      .then((res) => {
        if (res.data && typeof res.data === 'object' && res.data._id) {
          setCampus(res.data);
          setLoading(false);
        } else {
          setNotFound(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        setNotFound(true);
        setLoading(false);
      });
  }, [campusCode]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading workspace for {campusCode}...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a', color: '#fff', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: '5rem', margin: 0, color: '#ef4444' }}>404</h1>
        <h2>Campus Not Found</h2>
        <p style={{ color: '#94a3b8', marginTop: 8, marginBottom: 24 }}>The campus code <strong>{campusCode}</strong> does not exist.</p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/'}>Go to Main Dashboard</button>
      </div>
    );
  }

  // Prompt login if not authenticated (Phase 4)
  if (!admin) {
    return (
      <Login
        campus={campus}
        onLogin={(adminData) => {
          localStorage.setItem('navx_admin', JSON.stringify(adminData));
          setAdmin(adminData);
        }}
      />
    );
  }

  // Cross-campus access protection (Phase 12)
  const targetCampusId = campus._id;
  const adminCampusId = admin.campusId?._id || admin.campusId;

  if (admin.role !== 'SuperAdmin' && adminCampusId !== targetCampusId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a', color: '#fff', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#ef4444', fontSize: '24px', marginBottom: 12 }}>Access Denied</h2>
        <p style={{ maxWidth: '500px', color: '#94a3b8', lineHeight: 1.5 }}>
          You are logged in as <strong>{admin.username}</strong>, but you do not have permission to access the workspace for <strong>{campus.campusName}</strong>.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onLogout}>Logout & Log in as {campus.campusName} Admin</button>
          <button className="btn btn-primary" onClick={() => window.location.href = `/campus/${admin.campus?.campusCode || ''}`}>My Workspace</button>
        </div>
      </div>
    );
  }

  const isEditorPage = location.pathname.includes('/editor/');

  return (
    <div className="app-layout">
      {!isEditorPage && <Sidebar admin={admin} onLogout={onLogout} campusCode={campusCode} />}
      <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
        {!isEditorPage && <TopBar />}
        <Outlet context={{ campus }} />
      </div>
    </div>
  );
}

function Sidebar({ admin, onLogout, campusCode }) {
  const prefix = campusCode ? `/campus/${campusCode}` : '';
  const venuesPath = campusCode ? `${prefix}/venues` : '/campus';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">N</div>
        <div>
          <div className="sidebar-title">NavX</div>
          <div className="sidebar-subtitle">{campusCode ? 'Workspace' : 'Admin Console'}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <NavLink to={campusCode ? prefix : "/"} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <FiHome /> Dashboard
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Management</div>
          <NavLink to={venuesPath} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <FiGrid /> Venues & Maps
          </NavLink>
          <NavLink to={`${prefix}/campaigns`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiAlertCircle /> Campaigns
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Safety</div>
          <NavLink to={`${prefix}/emergency`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiAlertCircle /> Emergency Alert
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Analytics</div>
          <NavLink to={`${prefix}/analytics`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiBarChart2 /> Analytics
          </NavLink>
        </div>
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div>NavX Admin v2.0</div>
        {campusCode && <div style={{ fontSize: '10px', color: '#22c55e', marginTop: 4 }}>Workspace: {campusCode}</div>}
        <div style={{ marginTop: '12px', cursor: 'pointer', color: 'var(--danger-color, #ef4444)', fontWeight: 600 }} onClick={onLogout}>
          Logout
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  
  // Format breadcrumbs intelligently, omitting workspace prefix elements
  const displayParts = pathParts[0] === 'campus' && pathParts.length >= 2 
    ? pathParts.slice(2) 
    : pathParts;

  return (
    <div className="top-bar">
      <div className="breadcrumbs">
        <span className="breadcrumb">NavX</span>
        {displayParts.map((p, i) => (
          <span key={i}>
            <span className="breadcrumb-sep">/</span>
            <span className={`breadcrumb ${i === displayParts.length - 1 ? 'active' : ''}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </span>
          </span>
        ))}
        {displayParts.length === 0 && <><span className="breadcrumb-sep">/</span><span className="breadcrumb active">Dashboard</span></>}
      </div>
    </div>
  );
}

export default App;
