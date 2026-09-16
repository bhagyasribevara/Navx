import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FiMap, FiGrid, FiLayers, FiNavigation, FiPlus, FiUsers, FiCalendar, FiFileText, FiBox, FiEye, FiClock, FiArrowRight } from "react-icons/fi";
import { getBlocks, getCampuses, getFloors, getCampaigns } from "../api";
import { useAdminPageContext } from '../components/AdminPageContext';

export default function Dashboard({ admin }) {
  const [campuses, setCampuses] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    totalFloors: 0,
    navReady: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const { setPageContext } = useAdminPageContext();

  const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
    : '';

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        let campusList = [];
        
        if (context.campus) {
          campusList = [context.campus];
        } else {
          const campusesRes = await getCampuses();
          campusList = campusesRes.data;
          
          // Filter for CampusAdmin or VenueAdmin or campus_admin
          if (admin && (admin.role === 'CampusAdmin' || admin.role === 'VenueAdmin' || admin.role === 'campus_admin') && admin.campusId) {
            const cId = admin.campusId._id || admin.campusId;
            campusList = campusList.filter(c => c._id === cId);
          }
        }

        if (!mounted) return;
        setCampuses(campusList);

        const blocksByCampus = await Promise.all(
          campusList.map(async (campus) => {
            try {
              const blocksRes = await getBlocks(campus._id);
              return { campusId: campus._id, blocks: blocksRes.data };
            } catch {
              return { campusId: campus._id, blocks: [] };
            }
          }),
        );

        const floorCountsByCampus = await Promise.all(
          blocksByCampus.map(async ({ campusId, blocks }) => {
            if (!blocks.length) return { campusId, floorCount: 0 };
            const floorsPerBlock = await Promise.all(
              blocks.map(async (block) => {
                try {
                  const floorsRes = await getFloors(block._id, campusId);
                  return floorsRes.data.length;
                } catch {
                  return 0;
                }
              }),
            );
            return {
              campusId,
              floorCount: floorsPerBlock.reduce((sum, count) => sum + count, 0),
            };
          }),
        );

        if (!mounted) return;
        const totalFloors = floorCountsByCampus.reduce(
          (sum, item) => sum + item.floorCount,
          0,
        );
        const navReady = floorCountsByCampus.filter(
          (item) => item.floorCount > 0,
        ).length;
        setNetworkStats({ totalFloors, navReady });

        // Fetch active campaigns across all campuses
        try {
          const allCampaigns = await Promise.all(
            campusList.map(async (campus) => {
              try {
                const res = await getCampaigns(campus._id);
                return (res.data || []).map(c => ({ ...c, campusName: campus.name }));
              } catch { return []; }
            })
          );
          const now = new Date();
          const active = allCampaigns.flat()
            .filter(c => !c.parentId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (mounted) setActiveCampaigns(active);
        } catch { /* campaigns are non-critical */ }
      } catch {
        if (!mounted) return;
        setCampuses([]);
        setNetworkStats({ totalFloors: 0, navReady: 0 });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = [
    {
      label: "Total Venues",
      value: campuses.length,
      icon: <FiGrid />,
      color: "#6366f1",
    },
    {
      label: "Active Maps",
      value: campuses.filter((c) => c.isActive).length,
      icon: <FiMap />,
      color: "#22c55e",
    },
    {
      label: "Navigation Ready",
      value: networkStats.navReady,
      icon: <FiNavigation />,
      color: "#f59e0b",
    },
    {
      label: "Total Floors",
      value: networkStats.totalFloors,
      icon: <FiLayers />,
      color: "#3b82f6",
    },
  ];

  useEffect(() => {
    if (!loading) {
      setPageContext({
        pageName: 'Dashboard',
        data: {
          campuses: campuses.map(c => ({ id: c._id, name: c.name, type: c.venueType })),
          networkStats,
          widgets: stats.map(s => ({ label: s.label, value: s.value }))
        }
      });
    }
  }, [loading, campuses, networkStats]);

  const prefix = context.campus ? `/campus/${context.campus.campusCode}` : '';

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
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/venues" : "/campus")}>
            <div className="quick-icon-wrapper venues">
              <FiGrid />
            </div>
            <span>Venues</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/campaigns" : "/campaigns")}>
            <div className="quick-icon-wrapper campaigns">
              <FiLayers />
            </div>
            <span>Campaigns</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/faculty" : "/faculty")}>
            <div className="quick-icon-wrapper faculty">
              <FiUsers />
            </div>
            <span>Faculty</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/timetable" : "/timetable")}>
            <div className="quick-icon-wrapper timetable">
              <FiCalendar />
            </div>
            <span>Timetable</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/reports" : "/reports")}>
            <div className="quick-icon-wrapper reports">
              <FiFileText />
            </div>
            <span>Reports</span>
          </div>
          <div className="quick-link-card" onClick={() => navigate(prefix ? prefix + "/spatial-studio" : "/spatial-studio")}>
            <div className="quick-icon-wrapper spatial">
              <FiBox />
            </div>
            <span>Spatial Studio</span>
          </div>
        </div>
      </div>

      {/* Active Campaigns Section */}
      <div className="active-campaigns-section">
        <div className="campaigns-section-header">
          <h2 className="section-title">
            <span className="title-marker">|</span> Active Campaigns
          </h2>
          <button
            className="campaigns-view-all-btn"
            onClick={() => navigate(prefix ? prefix + "/campaigns" : "/campaigns")}
          >
            View All <FiArrowRight />
          </button>
        </div>

        {activeCampaigns.length > 0 ? (
          <div className="campaigns-scroll-row">
            {activeCampaigns.map((c) => {
              const imgSrc = c.image
                ? (c.image.startsWith('http') ? c.image : `${BACKEND_URL}${c.image}`)
                : null;
              const startStr = c.startDate ? new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
              const endStr = c.endDate ? new Date(c.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
              const now = new Date();
              const isLive = c.isActive && (!c.endDate || new Date(c.endDate) >= now);

              return (
                <div
                  key={c._id}
                  className="campaign-card-dash"
                  onClick={() => navigate(prefix ? prefix + "/campaigns" : "/campaigns")}
                >
                  <div className="campaign-card-img-wrap">
                    {imgSrc ? (
                      <img src={imgSrc} alt={c.title} />
                    ) : (
                      <div className="campaign-card-placeholder">
                        <FiLayers />
                      </div>
                    )}
                    <span className={`campaign-live-badge ${isLive ? '' : 'campaign-ended-badge'}`}>
                      <span className="live-dot" /> {isLive ? 'Live' : 'Ended'}
                    </span>
                  </div>

                  <div className="campaign-card-body">
                    <h4 className="campaign-card-title">{c.title}</h4>
                    {c.category && (
                      <span className="campaign-category-tag">{c.category}</span>
                    )}
                    {(startStr || endStr) && (
                      <div className="campaign-date-row">
                        <FiClock className="campaign-date-icon" />
                        <span>{startStr}{endStr ? ` – ${endStr}` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="campaigns-empty-state">
            <FiLayers className="campaigns-empty-icon" />
            <p>No active campaigns right now</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(prefix ? prefix + "/campaigns" : "/campaigns")}
            >
              <FiPlus /> Create Campaign
            </button>
          </div>
        )}
      </div>
      
      {/* Existing Content -> Your Venues */}
      <div className="venues-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 40 }}>
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
              const itemPrefix = context.campus ? `/campus/${context.campus.campusCode}` : '';
              return (
                <div
                  className="card"
                  key={c._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`${itemPrefix}/editor/${c._id}`)}
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
                        navigate(`${itemPrefix}/editor/${c._id}`);
                      }}
                    >
                      <FiMap /> Edit Map
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${itemPrefix}/positioning/${c._id}`);
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
