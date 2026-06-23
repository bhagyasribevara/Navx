import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUser, FiLock } from 'react-icons/fi';
import { loginAdmin } from '../api';
import './Login.css';

const VENUE_ICONS = { campus: '🎓', hospital: '🏥', airport: '✈️', mall: '🛍️', building: '🏢', other: '📍' };

export default function Login({ onLogin, campus }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginAdmin({ username, password });
      if (data.success) {
        toast.success(`Welcome, ${data.admin.username}!`);
        // Handle token storage in localStorage (Phase 5)
        localStorage.setItem("navx_token", data.token);
        
        // Pass complete data including token to onLogin
        onLogin({
          ...data.admin,
          token: data.token,
          refreshToken: data.refreshToken
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background grid pattern */}
      <div className="login-bg-grid" />

      <div className="login-box">
        <div className="login-header">
          {/* App Icon */}
          <div className="login-logo">
            {campus ? (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                fontSize: 42
              }}>
                {VENUE_ICONS[campus.venueType] || '📍'}
              </div>
            ) : (
              <img src="/navx-icon.png" alt="NavX Logo" />
            )}
          </div>

          <h2>{campus ? `${campus.campusName} Workspace` : 'NavX Admin Console'}</h2>
          <p>{campus
            ? `Sign in to manage ${campus.campusName} maps & navigation`
            : 'Sign in to manage indoor navigation'
          }</p>

          {campus && (
            <div className="login-venue-badge">
              {VENUE_ICONS[campus.venueType] || '📍'} {campus.campusName}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <div className="login-input-wrapper">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
              <span className="input-icon"><FiUser /></span>
            </div>
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="login-input-wrapper">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <span className="input-icon"><FiLock /></span>
            </div>
          </div>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          {campus && (
            <p>Workspace path: /campus/{campus.campusCode}</p>
          )}
        </div>

        <div className="login-brand">
          <span>NavX</span> Indoor Navigation Platform
        </div>
      </div>
    </div>
  );
}
