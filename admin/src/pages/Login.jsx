import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
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
      <div className="login-box">
        <div className="login-header">
          <div className="login-logo">
            {campus ? (VENUE_ICONS[campus.venueType] || '📍') : 'N'}
          </div>
          <h2>{campus ? `${campus.campusName} Workspace` : 'NavX Admin Console'}</h2>
          <p>{campus ? `Login to manage ${campus.campusName} maps & navigation` : 'Login to manage campus navigation'}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
        <div className="login-footer">
          {campus && (
            <p>Dedicated workspace path: /campus/{campus.campusCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}
