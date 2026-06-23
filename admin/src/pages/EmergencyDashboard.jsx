import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { getCampuses, triggerEmergency } from '../api';

export default function EmergencyDashboard({ admin }) {
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const context = useOutletContext() || {};

  const fetchCampuses = async () => {
    try {
      let campusList = [];
      if (context.campus) {
        const { getCampus } = await import('../api');
        const { data } = await getCampus(context.campus._id);
        campusList = [data];
      } else {
        const { data } = await getCampuses();
        campusList = data;
        if (admin && (admin.role === 'CampusAdmin' || admin.role === 'VenueAdmin' || admin.role === 'campus_admin') && admin.campusId) {
          const cId = admin.campusId._id || admin.campusId;
          campusList = campusList.filter(c => c._id === cId);
        }
      }
      setCampuses(campusList);
    } catch (err) {
      toast.error('Failed to load campuses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
    const interval = setInterval(fetchCampuses, 5000); // Poll for updates
    return () => clearInterval(interval);
  }, []);

  const handleTrigger = async (campusId, type) => {
    if (!window.confirm(`Are you sure you want to trigger a ${type} emergency? This will alert all users immediately.`)) return;
    try {
      await triggerEmergency(campusId, { isActive: true, message: `A ${type.toLowerCase()} emergency has been reported. Proceed to the nearest emergency exit immediately.`, type });
      toast.success('Emergency triggered successfully');
      fetchCampuses();
    } catch (err) {
      toast.error('Failed to trigger emergency');
    }
  };

  const handleResolve = async (campusId) => {
    if (!window.confirm('Are you sure the emergency is resolved?')) return;
    try {
      await triggerEmergency(campusId, { isActive: false, message: '', type: '' });
      toast.success('Emergency resolved');
      fetchCampuses();
    } catch (err) {
      toast.error('Failed to resolve emergency');
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg, #fecaca 0%, #f87171 50%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Emergency Broadcast</h1>
          <p className="page-subtitle">Instantly alert all users and guide them to emergency exits</p>
        </div>
      </div>

      <div className="card-grid">
        {campuses.map(c => {
          const isEmergency = c.emergencyState && c.emergencyState.isActive;
          return (
            <div className="card" key={c._id} style={{ border: isEmergency ? '2px solid #ef4444' : '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
              {isEmergency && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#ef4444' }} />}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 18 }}>{c.name}</h3>
                {isEmergency ? (
                  <span className="badge badge-danger">EMERGENCY ACTIVE</span>
                ) : (
                  <span className="badge badge-success">SAFE</span>
                )}
              </div>
              
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                {isEmergency ? `Since ${new Date(c.emergencyState.timestamp).toLocaleTimeString()}` : c.address}
              </p>

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!isEmergency ? (
                  <>
                    <button 
                      className="btn btn-danger emergency-trigger-fire" 
                      style={{ 
                        width: '100%', 
                        justifyContent: 'center', 
                        padding: '16px 20px', 
                        borderRadius: 12,
                        border: '2px solid rgba(239, 68, 68, 0.4)',
                        fontSize: '15px',
                        fontWeight: 800,
                        letterSpacing: '0.5px'
                      }} 
                      onClick={() => handleTrigger(c._id, 'Fire')}
                    >
                      <FiAlertTriangle /> Trigger Fire Alarm
                    </button>
                    <button 
                      className="btn emergency-trigger-security" 
                      style={{ 
                        width: '100%', 
                        justifyContent: 'center', 
                        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', 
                        color: 'white',
                        padding: '16px 20px',
                        borderRadius: 12,
                        border: '2px solid rgba(59, 130, 246, 0.4)',
                        fontSize: '15px',
                        fontWeight: 800,
                        letterSpacing: '0.5px'
                      }} 
                      onClick={() => handleTrigger(c._id, 'Security')}
                    >
                      <FiAlertTriangle /> Security Threat
                    </button>
                  </>
                ) : (
                  <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', background: '#22c55e', color: 'white', padding: '14px 20px', borderRadius: 12 }} onClick={() => handleResolve(c._id)}>
                    <FiCheckCircle /> Mark as Resolved
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
