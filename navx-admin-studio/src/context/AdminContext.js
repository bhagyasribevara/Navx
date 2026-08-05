import React, { createContext, useState, useEffect, useContext } from 'react';
import safeStorage from '../utils/storage';
import { adminLogin as apiLogin } from '../services/adminApi';

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await safeStorage.getItem('navx_admin_studio_token');
      const storedAdmin = await safeStorage.getItem('navx_admin_studio_data');
      if (storedToken && storedAdmin) {
        setToken(storedToken);
        setAdmin(JSON.parse(storedAdmin));
      }
    } catch (e) {
      console.warn('Failed to restore admin session:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await apiLogin(username, password);
      if (res.data.success && res.data.token) {
        const adminData = res.data.admin;
        setAdmin(adminData);
        setToken(res.data.token);
        await safeStorage.setItem('navx_admin_studio_token', res.data.token);
        if (res.data.refreshToken) {
          await safeStorage.setItem('navx_admin_studio_refresh_token', res.data.refreshToken);
        }
        await safeStorage.setItem('navx_admin_studio_data', JSON.stringify(adminData));
        return { success: true, admin: adminData };
      }
      return { success: false, error: 'Invalid response from server' };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Login failed. Check credentials.' };
    }
  };

  const logout = async () => {
    setAdmin(null);
    setToken(null);
    try {
      await safeStorage.removeItem('navx_admin_studio_token');
      await safeStorage.removeItem('navx_admin_studio_refresh_token');
      await safeStorage.removeItem('navx_admin_studio_data');
    } catch (e) {
      console.warn('Failed to clear admin session:', e?.message || e);
    }
  };

  return (
    <AdminContext.Provider value={{ admin, token, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
export default AdminContext;
