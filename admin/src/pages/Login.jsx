import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import { loginAdmin } from '../api';
import './Login.css';

const VENUE_ICONS = {
  campus: '🎓',
  hospital: '🏥',
  airport: '✈️',
  mall: '🛍️',
  building: '🏢',
  other: '📍'
};

export default function Login({ onLogin, campus }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginAdmin({ username, password });
      if (data.success) {
        toast.success(`Welcome, ${data.admin.username}!`);
        localStorage.setItem('navx_token', data.token);
        onLogin({
          ...data.admin,
          token: data.token,
          refreshToken: data.refreshToken
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Horizontal celestial horizon line behind card */}
      <div className="login-horizon-line" />

      {/* Constellation dot mesh across horizon */}
      <div className="login-bg-grid" />

      {/* Ambient center violet glow */}
      <div className="login-ambient-glow" />

      {/* Main Login Card (Axes Reference Match) */}
      <div className="login-box">
        {/* Card header dot matrix */}
        <div className="login-card-dots" />

        {/* Ambient violet backlight behind logo */}
        <div className="login-logo-glow" />

        {/* Top-Left Squircle with Perforated Grill & NavX Logo */}
        <div className="login-logo-box">
          {campus ? (
            <span className="login-logo-emblem">
              {VENUE_ICONS[campus.venueType] || '📍'}
            </span>
          ) : (
            <img src="/navx-icon.png" alt="NavX Logo" className="login-logo-img" />
          )}
        </div>

        {/* Header Title & Subtitle */}
        <div className="login-header-text">
          <h2>{campus ? `Welcome to ${campus.campusName}` : 'Welcome to NavX'}</h2>
          <p>
            {campus
              ? `Sign in to manage ${campus.campusName} maps & navigation`
              : 'Admin Console · Indoor Navigation Platform'}
          </p>

          {campus && (
            <div className="login-venue-tag">
              {VENUE_ICONS[campus.venueType] || '📍'} {campus.campusName}
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="login-input-wrapper">
              <span className="input-icon">
                <FiUser />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter your username..."
                autoComplete="username"
                required
              />
              {username && (
                <div className="input-glow-badge" title="Active input">
                  ✓
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="login-input-wrapper">
              <span className="input-icon">
                <FiLock />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="enter your password..."
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span>or switch portal</span>
        </div>

        {/* Switch to Faculty Portal */}
        <div className="login-switch-link">
          <Link to="/facultylogin">
            Faculty Portal Sign In <FiArrowRight />
          </Link>
        </div>

        {/* Brand watermark footer */}
        <div className="login-brand-watermark">
          NAVX · INDOOR NAVIGATION PLATFORM
        </div>
      </div>
    </div>
  );
}
