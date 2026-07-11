import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUser, FiLock } from 'react-icons/fi';
import './Login.css';

export default function FacultyLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
      const { data } = await axios.post(`${API_BASE}/faculty/login`, { username, password });
      if (data.success) {
        toast.success(`Welcome, Prof. ${data.faculty.name}!`);
        localStorage.setItem("navx_faculty_token", data.token);
        localStorage.setItem("navx_faculty", JSON.stringify(data.faculty));
        onLogin(data.faculty, data.token);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Check your username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg-grid" />

      <div className="login-box">
        <div className="login-header">
          <div className="login-logo" style={{
            width: 80, height: 80, borderRadius: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            fontSize: 42, margin: '0 auto 20px auto'
          }}>
            👨‍🏫
          </div>

          <h2>Faculty Portal</h2>
          <p>Sign in to manage classes, mark attendance & upload grades</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username / Employee ID</label>
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
          <button type="submit" disabled={loading} className="login-btn" style={{ background: 'linear-gradient(to right, #a855f7, #6366f1)' }}>
            {loading ? 'Authenticating...' : 'Sign In as Faculty'}
          </button>
        </form>

        <div className="login-footer">
          <p>Created by Campus Administration</p>
        </div>

        <div className="login-brand">
          <span>NavX</span> Smart Campus Platform
        </div>
      </div>
    </div>
  );
}
