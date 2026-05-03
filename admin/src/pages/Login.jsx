import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginAdmin } from '../api';
import './Login.css';

export default function Login({ onLogin }) {
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
        onLogin(data.admin);
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
          <div className="login-logo">N</div>
          <h2>NavX Admin Console</h2>
          <p>Login to manage campus navigation</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. superadmin"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
        <div className="login-footer">
          <p>Default SuperAdmin: superadmin / admin123</p>
        </div>
      </div>
    </div>
  );
}
