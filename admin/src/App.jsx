import React from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, useParams, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMap, FiGrid, FiLayers, FiNavigation, FiBarChart2, FiSettings, FiHome, FiAlertCircle, FiMenu, FiX, FiUsers, FiCalendar, FiFileText, FiCpu, FiLogOut, FiBox } from 'react-icons/fi';
import NavXAIChat from './components/NavXAIChat';
import NavXAdminCopilot from './components/NavXAdminCopilot';
import { AdminPageProvider } from './components/AdminPageContext';
import Dashboard from './pages/Dashboard';
import CampusManager from './pages/CampusManager';
import MapEditor from './pages/MapEditor';
import PositioningSetup from './pages/PositioningSetup';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import EmergencyDashboard from './pages/EmergencyDashboard';
import CampaignManager from './pages/CampaignManager';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import FacultyLogin from './pages/FacultyLogin';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyManager from './pages/FacultyManager';
import TimetableAllocation from './pages/TimetableAllocation';
import AdminReports from './pages/AdminReports';
import AdminAiAssistant from './pages/AdminAiAssistant';
import SpatialStudioDashboard from './pages/SpatialStudioDashboard';
import { getCampusByCode } from './api';

const isCampusAdminRole = (role) => 
  role === 'campus_admin' || role === 'CampusAdmin' || role === 'VenueAdmin';

function App() {
  const [admin, setAdmin] = React.useState(null);
  const [faculty, setFaculty] = React.useState(null);
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
        if (location.pathname === '/' && isCampusAdminRole(parsed.role) && parsed.campus?.campusCode) {
          navigate(`/campus/${parsed.campus.campusCode}`);
        }
      } catch (e) {}
    }

    const savedFaculty = localStorage.getItem('navx_faculty');
    if (savedFaculty) {
      try {
        setFaculty(JSON.parse(savedFaculty));
      } catch (e) {}
    }
  }, []);

  // Security guard (Phase 12): Prevent campus admins from typing URLs to escape their workspace
  React.useEffect(() => {
    if (admin && isCampusAdminRole(admin.role) && admin.campus?.campusCode) {
      const workspacePrefix = `/campus/${admin.campus.campusCode}`;
      if (!location.pathname.startsWith(workspacePrefix)) {
        navigate(workspacePrefix);
      }
    }
  }, [location.pathname, admin]);

  const handleLogin = (adminData) => {
    localStorage.setItem('navx_admin', JSON.stringify(adminData));
    setAdmin(adminData);
    
    if (isCampusAdminRole(adminData.role) && adminData.campus?.campusCode) {
      navigate(`/campus/${adminData.campus.campusCode}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('navx_admin');
    localStorage.removeItem('navx_token');
    setAdmin(null);
    navigate('/');
  };

  const handleFacultyLogin = (facultyData, token) => {
    localStorage.setItem('navx_faculty', JSON.stringify(facultyData));
    localStorage.setItem('navx_faculty_token', token);
    setFaculty(facultyData);
    navigate('/faculty/dashboard');
  };

  const handleFacultyLogout = () => {
    localStorage.removeItem('navx_faculty');
    localStorage.removeItem('navx_faculty_token');
    setFaculty(null);
    navigate('/facultylogin');
  };

  const isFacultyRoute = location.pathname === '/facultylogin' || location.pathname.startsWith('/faculty');

  // If not authenticated and NOT accessing a specific campus workspace URL, show generic login
  if (!admin && !isCampusSpecificWorkspace && !isFacultyRoute) {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  // SuperAdmin layout
  if (admin && admin.role === 'SuperAdmin' && !isCampusSpecificWorkspace && !isEditorPage && !isFacultyRoute) {
    return (
      <>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
        <SuperAdminDashboard admin={admin} onLogout={handleLogout} />
      </>
    );
  }

  // Derive campusId from admin state for AI chatbot context
  const adminCampusId = admin?.campusId?._id || admin?.campusId || admin?.campus?._id || null;
  const adminCampusName = admin?.campus?.name || admin?.campus?.campusName || null;

  return (
    <AdminPageProvider>
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
      {/* <NavXAIChat campusId={adminCampusId} campusName={adminCampusName} /> */}
      <NavXAdminCopilot admin={admin} />
      <Routes>
        <Route path="/facultylogin" element={<FacultyLogin onLogin={handleFacultyLogin} />} />
        <Route
          path="/faculty/dashboard"
          element={
            faculty ? (
              <FacultyDashboard
                faculty={faculty}
                onLogout={handleFacultyLogout}
                token={localStorage.getItem('navx_faculty_token')}
              />
            ) : (
              <FacultyLogin onLogin={handleFacultyLogin} />
            )
          }
        />
        {/* Default SuperAdmin or Legacy Routes */}
        <Route
          path="/"
          element={
            <div className="app-layout">
              {!isEditorPage && <Sidebar admin={admin} onLogout={handleLogout} />}
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
              <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
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
          <Route path="faculty" element={<FacultyManager admin={admin} />} />
          <Route path="timetable" element={<TimetableAllocation admin={admin} />} />
          <Route path="reports" element={<AdminReports admin={admin} />} />
          <Route path="ai-assistant" element={<AdminAiAssistant admin={admin} />} />
          <Route path="spatial-studio" element={<SpatialStudioDashboard admin={admin} />} />
        </Route>
      </Routes>
    </AdminPageProvider>
  );
}

// Dedicated Workspace wrapper for campus-specific admin access (Phase 3, 5, 7, 12)
function CampusWorkspaceWrapper({ admin, setAdmin, onLogout }) {
  const { campusCode } = useParams();
  const [campus, setCampus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState(null);
  const location = useLocation();

  React.useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setError(null);
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
        if (err.response && err.response.status === 404) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.error || err.message || "Failed to connect to the backend server");
        }
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

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0e1a', color: '#fff', fontFamily: 'sans-serif', padding: 20, textAlign: 'center' }}>
        <h1 style={{ fontSize: '5rem', margin: 0, color: '#f59e0b' }}>⚠️</h1>
        <h2 style={{ marginTop: 16 }}>Connection Error</h2>
        <p style={{ color: '#94a3b8', marginTop: 8, marginBottom: 24, maxWidth: '500px', lineHeight: 1.5 }}>
          {error}. The backend server may be waking up or currently offline.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
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
      <div className={`main-content ${isEditorPage ? 'editor-mode' : ''}`}>
        {!isEditorPage && <TopBar />}
        <Outlet context={{ campus }} />
      </div>
    </div>
  );
}

function Sidebar({ admin, onLogout, campusCode }) {
  const prefix = campusCode ? `/campus/${campusCode}` : '';
  const venuesPath = campusCode ? `${prefix}/venues` : '/campus';
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside className={`campus-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/navx-icon.png" alt="NavX Logo" className="sidebar-logo" style={{ objectFit: 'cover' }} />
          {!collapsed && (
            <div className="sidebar-brand-text">
              <div className="sidebar-title">NavX</div>
              <div className="sidebar-subtitle">{campusCode ? `${campusCode}` : 'Admin'}</div>
            </div>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <FiMenu /> : <FiX />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {campusCode && !collapsed && (
          <div className="sidebar-section-label">Workspace</div>
        )}
        <NavLink to={campusCode ? prefix : "/"} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`} end>
          <FiHome className="sidebar-icon" />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to={venuesPath} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`} end>
          <FiGrid className="sidebar-icon" />
          {!collapsed && <span>Venues &amp; Maps</span>}
        </NavLink>
        <NavLink to={`${prefix}/campaigns`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <FiLayers className="sidebar-icon" />
          {!collapsed && <span>Campaigns</span>}
        </NavLink>
        {campusCode && (
          <>
            {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 16 }}>Management</div>}
            <NavLink to={`${prefix}/faculty`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              <FiUsers className="sidebar-icon" />
              {!collapsed && <span>Faculty</span>}
            </NavLink>
            <NavLink to={`${prefix}/timetable`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              <FiCalendar className="sidebar-icon" />
              {!collapsed && <span>Timetable</span>}
            </NavLink>
            <NavLink to={`${prefix}/reports`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              <FiFileText className="sidebar-icon" />
              {!collapsed && <span>Reports</span>}
            </NavLink>
            {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 16 }}>Tools</div>}
            <NavLink to={`${prefix}/spatial-studio`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              <FiBox className="sidebar-icon" />
              {!collapsed && <span>Spatial Studio (3D)</span>}
            </NavLink>
            <NavLink to={`${prefix}/ai-assistant`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
              <FiCpu className="sidebar-icon" />
              {!collapsed && <span>AI Assistant</span>}
            </NavLink>
          </>
        )}
        {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 16 }}>Monitoring</div>}
        <NavLink to={`${prefix}/emergency`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <FiAlertCircle className="sidebar-icon" />
          {!collapsed && <span>Emergency Alert</span>}
        </NavLink>
        <NavLink to={`${prefix}/analytics`} className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <FiBarChart2 className="sidebar-icon" />
          {!collapsed && <span>Analytics</span>}
        </NavLink>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(admin?.username || 'A')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-username">{admin?.username || 'Admin'}</div>
              <div className="sidebar-user-role">{admin?.role === 'SuperAdmin' ? 'Super Admin' : 'Campus Admin'}</div>
            </div>
          )}
        </div>
        <button
          className="sidebar-logout-btn"
          onClick={onLogout}
          title="Logout"
        >
          <FiLogOut />
          {!collapsed && <span>Logout</span>}
        </button>
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
      <div className="navbar-wrapper admin-navbar-wrapper">
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
    </div>
  );
}

export default App;
