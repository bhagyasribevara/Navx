import axios from 'axios';
import safeStorage from '../utils/storage';
import { Platform } from 'react-native';

let Constants = null;
try { Constants = require('expo-constants').default; } catch (e) {}

let devHost = '10.142.252.64'; // Explicit IP from Metro bundler for physical device testing
if (Constants?.expoConfig?.hostUri) {
  devHost = Constants.expoConfig.hostUri.split(':')[0];
}

const API_BASE = `http://${devHost}:5001/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach admin JWT token to every request if present
api.interceptors.request.use(async (config) => {
  try {
    const token = await safeStorage.getItem('navx_admin_studio_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
});

// Auto-refresh access token on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = await safeStorage.getItem('navx_admin_studio_refresh_token');

      // If no refresh token exists in storage, simply clear the stale token and reject with original error
      if (!refreshToken) {
        await safeStorage.removeItem('navx_admin_studio_token');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE}/admin/refresh`, { refreshToken });
        if (res.data?.success && res.data?.token) {
          const newToken = res.data.token;
          await safeStorage.setItem('navx_admin_studio_token', newToken);
          if (res.data.refreshToken) {
            await safeStorage.setItem('navx_admin_studio_refresh_token', res.data.refreshToken);
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

          processQueue(null, newToken);
          isRefreshing = false;
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        await safeStorage.removeItem('navx_admin_studio_token');
        await safeStorage.removeItem('navx_admin_studio_refresh_token');
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password });

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export const getDashboardStats = (campusId) =>
  api.get(`/admin/mobile-dashboard/${campusId}`).then(r => r.data);

// ─── Buildings (read-only) ───────────────────────────────────────────────────
export const getBuildings = (campusId) =>
  api.get(`/admin/mobile-buildings/${campusId}`).then(r => r.data);

export const getBlocks = (campusId) =>
  api.get(`/blocks?campusId=${campusId}`).then(r => r.data);

export const getFloors = (blockId) =>
  api.get(`/floors?blockId=${blockId}`).then(r => r.data);

export const createFloor = (data) =>
  api.post(`/floors`, data).then(r => r.data);

export const getRooms = (floorId) =>
  api.get(`/rooms?floorId=${floorId}`).then(r => r.data);

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const getCampaigns = (campusId) =>
  api.get(`/campaigns/campus/${campusId}`).then(r => r.data);

export const createCampaign = (data) =>
  api.post('/campaigns', data).then(r => r.data);

export const updateCampaign = (id, data) =>
  api.put(`/campaigns/${id}`, data).then(r => r.data);

export const deleteCampaign = (id) =>
  api.delete(`/campaigns/${id}`).then(r => r.data);

// ─── Emergency ───────────────────────────────────────────────────────────────
export const triggerEmergency = (campusId, data) =>
  api.post(`/campus/${campusId}/emergency`, data).then(r => r.data);

export const getCampus = (campusId) =>
  api.get(`/campus/${campusId}`).then(r => r.data);

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getAnalytics = (campusId, days = 30) =>
  api.get(`/analytics/summary/${campusId}?days=${days}`).then(r => r.data);

// ─── QR Codes ────────────────────────────────────────────────────────────────
export const generateCampusQR = (campusId) =>
  api.post(`/campus/${campusId}/campus-qr`).then(r => r.data);

export const getCampusQR = (campusId) =>
  api.get(`/campus/${campusId}/campus-qr`).then(r => r.data);

export const getQRCodes = (floorId) =>
  api.get(`/qrcodes?floorId=${floorId}`).then(r => r.data);

export const exportFloorQR = (floorId) =>
  api.get(`/qrcodes/export/${floorId}`).then(r => r.data);

// ─── Spatial Studio ──────────────────────────────────────────────────────────
export const startScanSession = (data) =>
  api.post('/spatialStudio/session/start', data).then(r => r.data);

export const updateTrajectory = (sessionId, data) =>
  api.post(`/spatialStudio/session/${sessionId}/trajectory`, data).then(r => r.data);

export const finalizeSession = (sessionId, data = {}) =>
  api.post(`/spatialStudio/session/${sessionId}/finalize`, data).then(r => r.data);

export const getSpatialSessions = (params) =>
  api.get('/spatialStudio/sessions', { params }).then(r => r.data);

export const deleteSpatialSession = (sessionId) =>
  api.delete(`/spatialStudio/session/${sessionId}`).then(r => r.data);

export const sendScanToWeb = (sessionId, data) =>
  api.post(`/spatialStudio/session/${sessionId}/send-to-web`, data).then(r => r.data);

export default api;
