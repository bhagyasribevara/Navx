import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FiMap, FiGrid, FiLayers, FiNavigation, FiPlus } from "react-icons/fi";
import { getBlocks, getCampuses, getFloors } from "../api";
import { useAdminPageContext } from '../components/AdminPageContext';

export default function Dashboard({ admin }) {
  const [campuses, setCampuses] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    totalFloors: 0,
    navReady: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const { setPageContext } = useAdminPageContext();

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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome to NavX Indoor Navigation Admin
          </p>
        </div>
        {(!admin || admin.role === 'SuperAdmin') && (
          <button className="btn btn-primary" onClick={() => navigate("/campus")}>
            <FiPlus /> New Venue
          </button>
        )}
      </div>

      <div className="card-grid" style={{ marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `${s.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: s.color,
                boxShadow: `0 0 12px ${s.color}15`
              }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Your Venues
      </h2>
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
            const prefix = context.campus ? `/campus/${context.campus.campusCode}` : '';
            return (
              <div
                className="card"
                key={c._id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`${prefix}/editor/${c._id}`)}
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
                      navigate(`${prefix}/editor/${c._id}`);
                    }}
                  >
                    <FiMap /> Edit Map
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`${prefix}/positioning/${c._id}`);
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
  );
}
