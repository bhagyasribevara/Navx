import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Admin Auth
export const loginAdmin = (data) => api.post("/admin/login", data);
export const createCampusAdmin = (data) => api.post("/admin/create-campus-admin", data);
export const getAdmins = (superAdminId) => api.get(`/admin/admins/${superAdminId}`);
export const deleteCampusAdmin = (superAdminId, adminId) => api.delete(`/admin/admins/${superAdminId}/${adminId}`);
export const updateCampusAdmin = (superAdminId, adminId, data) => api.put(`/admin/admins/${superAdminId}/${adminId}`, data);

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
