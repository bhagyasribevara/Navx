import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import './Login.css';

export default function FacultyLogin({ onLogin }) {
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
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
      const { data } = await axios.post(`${API_BASE}/faculty/login`, { username, password });
      if (data.success) {
        toast.success(`Welcome, Prof. ${data.faculty.name}!`);
        localStorage.setItem('navx_faculty_token', data.token);
        localStorage.setItem('navx_faculty', JSON.stringify(data.faculty));
        onLogin(data.faculty, data.token);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
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
          <img src="/navx-icon.png" alt="NavX Logo" className="login-logo-img" />
        </div>

        {/* Header Title & Subtitle */}
        <div className="login-header-text">
          <h2>Faculty Portal</h2>
          <p>Sign in to manage classes, mark attendance & upload grades</p>
          <div className="login-venue-tag">
            👨‍🏫 Academic Console
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="faculty-username">Username / Employee ID</label>
            <div className="login-input-wrapper">
              <span className="input-icon">
                <FiUser />
              </span>
              <input
                id="faculty-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter your employee ID..."
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
            <label htmlFor="faculty-password">Password</label>
            <div className="login-input-wrapper">
              <span className="input-icon">
                <FiLock />
              </span>
              <input
                id="faculty-password"
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
            {loading ? 'Authenticating...' : 'Sign In as Faculty'}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span>or switch portal</span>
        </div>

        {/* Switch to Admin Login */}
        <div className="login-switch-link">
          <Link to="/">
            Admin Console Sign In <FiArrowRight />
          </Link>
        </div>

        {/* Brand watermark footer */}
        <div className="login-brand-watermark">
          NAVX · SMART CAMPUS PLATFORM
        </div>
      </div>
    </div>
  );
}
