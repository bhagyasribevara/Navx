import axios from "axios";

let API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
if (API_BASE.startsWith("http") && !API_BASE.endsWith("/api")) {
  API_BASE = API_BASE.replace(/\/$/, "") + "/api";
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true // Phase 12: Secure Cookies support
});

// Request Interceptor: Attach JWT Access Token (Phase 4, 12)
api.interceptors.request.use(
  (config) => {
    const savedAdmin = localStorage.getItem("navx_admin");
    if (savedAdmin) {
      try {
        const { token } = JSON.parse(savedAdmin);
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      } catch (e) {}
    }
    const token = localStorage.getItem("navx_token");
    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-Refresh Access Token (Phase 4, 12)
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
    if (error.response?.status === 401 && error.response?.data?.code === "TOKEN_EXPIRED" && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const savedAdmin = localStorage.getItem("navx_admin");
        let localRefreshToken = "";
        if (savedAdmin) {
          const parsed = JSON.parse(savedAdmin);
          localRefreshToken = parsed.refreshToken || "";
        }
        
        // Hitting the refresh route
        const res = await axios.post(`${API_BASE}/admin/refresh`, { refreshToken: localRefreshToken }, { withCredentials: true });
        if (res.data.success) {
          const { token, refreshToken } = res.data;
          
          // Update tokens in localStorage
          if (savedAdmin) {
            const parsed = JSON.parse(savedAdmin);
            parsed.token = token;
            if (refreshToken) parsed.refreshToken = refreshToken;
            localStorage.setItem("navx_admin", JSON.stringify(parsed));
          }
          localStorage.setItem("navx_token", token);
          
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          
          processQueue(null, token);
          isRefreshing = false;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Refresh token invalid/expired - force logout (Phase 12)
        localStorage.removeItem("navx_admin");
        localStorage.removeItem("navx_token");
        window.location.href = "/";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Admin Auth & Management
export const loginAdmin = (data) => api.post("/admin/login", data);
export const createCampusAdmin = (data) => api.post("/admin/create-campus-admin", data);
export const getAdmins = (superAdminId) => api.get(`/admin/admins/${superAdminId}`);
export const deleteCampusAdmin = (superAdminId, adminId) => api.delete(`/admin/admins/${superAdminId}/${adminId}`);
export const updateCampusAdmin = (superAdminId, adminId, data) => api.put(`/admin/admins/${superAdminId}/${adminId}`, data);
export const toggleAdminStatus = (adminId, status) => api.post(`/admin/admins/${adminId}/status`, { status });
export const revokeAdminSessions = (adminId) => api.post(`/admin/admins/${adminId}/revoke`);
export const regenerateCampusUrl = (campusId, campusCode) => api.post(`/campus/${campusId}/regenerate-url`, { campusCode });
export const getCampusByCode = (campusCode) => api.get(`/campus/code/${campusCode}`);

// Campus
export const getCampuses = () => api.get("/campus");
export const getCampus = (id) => api.get(`/campus/${id}`);
export const createCampus = (data) => api.post("/campus", data);
export const updateCampus = (id, data) => api.put(`/campus/${id}`, data);
export const deleteCampus = (id) => api.delete(`/campus/${id}`);
export const triggerEmergency = (id, data) => api.post(`/campus/${id}/emergency`, data);
export const publishMap = (id) => api.post(`/campus/${id}/publish`);

// Blocks
export const getBlocks = (campusId) => api.get(`/blocks?campusId=${campusId}`);
export const createBlock = (data) => api.post("/blocks", data);
export const updateBlock = (id, data) => api.put(`/blocks/${id}`, data);
export const deleteBlock = (id) => api.delete(`/blocks/${id}`);

// Floors
export const getFloors = (blockId) => api.get(`/floors?blockId=${blockId}`);
export const createFloor = (data) => api.post("/floors", data);
export const updateFloor = (id, data) => api.put(`/floors/${id}`, data);
export const deleteFloor = (id) => api.delete(`/floors/${id}`);

// Rooms
export const getRooms = (floorId, blockId) => api.get(`/rooms?floorId=${floorId}${blockId ? `&blockId=${blockId}` : ''}`);
export const createRoom = (data) => api.post("/rooms", data);
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`);
export const deleteStairsFromFloor = (roomId, floorId) => api.delete(`/rooms/${roomId}/floor/${floorId}`);
export const restoreStairsToFloor = (roomId, floorId) => api.put(`/rooms/${roomId}/floor/${floorId}/restore`);
export const getExcludedFloors = (roomId) => api.get(`/rooms/${roomId}/excluded-floors`);

// Nav Nodes
export const getAllRoomsByCampus = (campusId) => api.get(`/rooms?campusId=${campusId}`);
export const getNodes = (floorId, blockId) => api.get(`/nodes?floorId=${floorId}${blockId ? `&blockId=${blockId}` : ''}`);
export const getAllCampusNodes = (campusId) => api.get(`/nodes?campusId=${campusId}&floorId=null`);
export const createNode = (data) => api.post("/nodes", data);
export const updateNode = (id, data) => api.put(`/nodes/${id}`, data);
export const deleteNode = (id) => api.delete(`/nodes/${id}`);

// Nav Paths
export const getPaths = (floorId) => api.get(`/paths?floorId=${floorId}`);
export const getAllCampusPaths = (campusId) => api.get(`/paths?campusId=${campusId}&floorId=null`);
export const createPath = (data) => api.post("/paths", data);
export const updatePath = (id, data) => api.put(`/paths/${id}`, data);
export const deletePath = (id) => api.delete(`/paths/${id}`);

// Map Layers (GeoJSON Overlays)
export const getMapLayers = (campusId) => api.get(`/mapLayers?campusId=${campusId}`);
export const createMapLayer = (data) => api.post("/mapLayers", data);
export const updateMapLayer = (id, data) => api.put(`/mapLayers/${id}`, data);
export const deleteMapLayer = (id) => api.delete(`/mapLayers/${id}`);

// QR Codes
export const getQRCodes = (floorId) => api.get(`/qrcodes?floorId=${floorId}`);
export const createQRCode = (data) => api.post("/qrcodes", data);
export const updateQRCode = (id, data) => api.put(`/qrcodes/${id}`, data);
export const deleteQRCode = (id) => api.delete(`/qrcodes/${id}`);
export const getQRImage = (id) => api.get(`/qrcodes/${id}/image`);
export const exportFloorQR = (floorId) => api.get(`/qrcodes/export/${floorId}`);

// Beacons
export const getBeacons = (floorId) => api.get(`/beacons?floorId=${floorId}`);
export const createBeacon = (data) => api.post("/beacons", data);
export const updateBeacon = (id, data) => api.put(`/beacons/${id}`, data);
export const deleteBeacon = (id) => api.delete(`/beacons/${id}`);

// Analytics
export const getAnalyticsSummary = (campusId) =>
  api.get(`/analytics/summary/${campusId}`);
export const getHeatmap = (campusId, floorId) =>
  api.get(`/analytics/heatmap/${campusId}?floorId=${floorId}`);

// Campaigns
export const getCampaigns = (campusId) => api.get(`/campaigns/campus/${campusId}`);
export const getCampaign = (id) => api.get(`/campaigns/${id}`);
export const getSubCampaigns = (parentId) => api.get(`/campaigns/${parentId}/sub`);
export const createCampaign = (data) => api.post("/campaigns", data);
export const updateCampaign = (id, data) => api.put(`/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);


// Uploads
export const uploadImage = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
};

export default api;
