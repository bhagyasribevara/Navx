const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

const newReturn = `
  return (
    <div className="dashboard-landing">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">
          Unlock Your <span className="text-primary">Campus!</span>
        </h1>
        <p className="hero-subtitle">Access tools, maps, and insights all in one place.</p>
        
        {/* Quick Links Row */}
        <div className="quick-links-scroll">
          <div className="quick-link-card" onClick={() => navigate("/campus")}>
            <div className="quick-icon-wrapper venues">
              <FiGrid />
            </div>
            <span>Venues</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate("/campaigns")}>
            <div className="quick-icon-wrapper campaigns">
              <FiLayers />
            </div>
            <span>Campaigns</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate("/faculty")}>
            <div className="quick-icon-wrapper faculty">
              <FiUsers />
            </div>
            <span>Faculty</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate("/timetable")}>
            <div className="quick-icon-wrapper timetable">
              <FiCalendar />
            </div>
            <span>Timetable</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate("/reports")}>
            <div className="quick-icon-wrapper reports">
              <FiFileText />
            </div>
            <span>Reports</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate("/spatial-studio")}>
            <div className="quick-icon-wrapper spatial">
              <FiBox />
            </div>
            <span>Spatial Studio</span>
          </div>
        </div>
      </div>

      {/* Featured Section */}
      <div className="featured-section">
        <h2 className="section-title">
          <span className="title-marker">|</span> Featured
        </h2>
        
        <div className="featured-grid">
          <div className="featured-card">
            <img src="/public/featured_campus_1788892611450.jpg" alt="Campus Challenge" />
          </div>
          <div className="featured-card">
            <img src="/public/featured_spatial_1788892645375.jpg" alt="Spatial AI Lab" />
          </div>
          <div className="featured-card">
            <img src="/public/featured_sprint_1788892705382.jpg" alt="Developer Sprint" />
          </div>
        </div>
      </div>
      
      {/* Existing Content -> Your Venues */}
      <div className="venues-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Your Venues</h2>
          {(!admin || admin.role === 'SuperAdmin') && (
            <button className="btn btn-primary" onClick={() => navigate("/campus")}>
              <FiPlus /> New Venue
            </button>
          )}
        </div>
        {loading ? (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        ) : campuses.length === 0 ? (
          <div className="empty-state">
            <FiMap style={{ fontSize: 48, opacity: 0.3 }} />
            <h3>No venues yet</h3>
            <p>Create your first venue to start building indoor maps</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate("/campus")}
            >
              <FiPlus /> Create Venue
            </button>
          </div>
        ) : (
          <div className="card-grid">
            {campuses.map((c) => {
              const prefix = context.campus ? \`/campus/\${context.campus.campusCode}\` : '';
              return (
                <div
                  className="card"
                  key={c._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(\`\${prefix}/editor/\${c._id}\`)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>
                          {({'campus':'🎓','hospital':'🏥','airport':'✈️','mall':'🛍️','building':'🏢'})[c.venueType] || '📍'}
                        </span>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{c.name}</h3>
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          marginTop: 4,
                        }}
                      >
                        {c.description || "No description"}
                      </p>
                    </div>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      gap: 16,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>📍 {c.address || "No address"}</span>
                  </div>
                  <div style={{ 
                    marginTop: 16, 
                    paddingTop: 14, 
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)', 
                    display: "flex", 
                    gap: 8 
                  }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(\`\${prefix}/editor/\${c._id}\`);
                      }}
                    >
                      <FiMap /> Edit Map
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(\`\${prefix}/positioning/\${c._id}\`);
                      }}
                    >
                      <FiNavigation /> Positioning
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
`;

const returnIndex = code.indexOf('  return (');
if(returnIndex > -1) {
  code = code.substring(0, returnIndex) + newReturn;
  // Also add missing imports
  if (!code.includes('FiUsers')) {
    code = code.replace(/import {([^}]+)} from "react-icons\/fi";/, 'import { $1, FiUsers, FiCalendar, FiFileText, FiBox } from "react-icons/fi";');
  }
  fs.writeFileSync('src/pages/Dashboard.jsx', code, 'utf8');
  console.log('Dashboard updated');
} else {
  console.log('Could not find return statement');
}
