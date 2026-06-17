import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('navx_user_token');
      if (storedToken) {
        setToken(storedToken);
        // Verify token & get user data
        const res = await api.get('/app-auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          logout();
        }
      }
    } catch (e) {
      console.warn('Failed to load auth state', e);
      if (e.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    try {
      const res = await api.post('/app-auth/login', { identifier, password });
      if (res.data.success) {
        setUser(res.data.user);
        setToken(res.data.token);
        await AsyncStorage.setItem('navx_user_token', res.data.token);
        return { success: true };
      }
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Login failed' };
    }
  };

  const guestLogin = async () => {
    try {
      const res = await api.post('/app-auth/guest-login');
      if (res.data.success) {
        setUser(res.data.user);
        setToken(res.data.token);
        await AsyncStorage.setItem('navx_user_token', res.data.token);
        return { success: true };
      }
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Guest login failed' };
    }
  };

  const register = async (username, mobileNumber, password) => {
    try {
      const res = await api.post('/app-auth/register', { username, mobileNumber, password });
      if (res.data.success) {
        setUser(res.data.user);
        setToken(res.data.token);
        await AsyncStorage.setItem('navx_user_token', res.data.token);
        return { success: true };
      }
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = async () => {
    if (user?.isGuest) {
      try {
        await api.post('/app-auth/guest-logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        console.warn('Failed to notify backend on guest logout', e);
      }
    }
    setUser(null);
    setToken(null);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const navxKeys = keys.filter(k => k.startsWith('navx_'));
      if (navxKeys.length > 0) {
        await AsyncStorage.multiRemove(navxKeys);
      }
    } catch (e) {
      console.warn("Failed to wipe local storage on logout", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, guestLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
