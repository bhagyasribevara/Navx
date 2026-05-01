import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiMap, FiGrid, FiLayers, FiNavigation, FiBarChart2, FiSettings, FiHome } from 'react-icons/fi';
import { MdQrCode2, MdBluetooth } from 'react-icons/md';
import Dashboard from './pages/Dashboard';
import CampusManager from './pages/CampusManager';
import MapEditor from './pages/MapEditor';
import PositioningSetup from './pages/PositioningSetup';
import AnalyticsDashboard from './pages/AnalyticsDashboard';

function App() {
  const location = useLocation();
  const isEditorPage = location.pathname.startsWith('/editor');

  return (
    <div className="app-layout">
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
      {!isEditorPage && <Sidebar />}
      <div className="main-content" style={isEditorPage ? { marginLeft: 0 } : {}}>
        {!isEditorPage && <TopBar />}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campus" element={<CampusManager />} />
          <Route path="/editor/:campusId" element={<MapEditor />} />
          <Route path="/positioning/:campusId" element={<PositioningSetup />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
        </Routes>
      </div>
    </div>
  );
}

function Sidebar() {
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
            <FiGrid /> Campus & Structures
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
        NavX Admin v1.0
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
