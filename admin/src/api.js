import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Campus
export const getCampuses = () => api.get("/campus");
export const getCampus = (id) => api.get(`/campus/${id}`);
export const createCampus = (data) => api.post("/campus", data);
export const updateCampus = (id, data) => api.put(`/campus/${id}`, data);
export const deleteCampus = (id) => api.delete(`/campus/${id}`);

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
export const getRooms = (floorId) => api.get(`/rooms?floorId=${floorId}`);
export const createRoom = (data) => api.post("/rooms", data);
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`);

// Nav Nodes
export const getNodes = (floorId) => api.get(`/nodes?floorId=${floorId}`);
export const getAllCampusNodes = (campusId) => api.get(`/nodes?campusId=${campusId}`);
export const createNode = (data) => api.post("/nodes", data);
export const updateNode = (id, data) => api.put(`/nodes/${id}`, data);
export const deleteNode = (id) => api.delete(`/nodes/${id}`);

// Nav Paths
export const getPaths = (floorId) => api.get(`/paths?floorId=${floorId}`);
export const getAllCampusPaths = (campusId) => api.get(`/paths?campusId=${campusId}`);
export const createPath = (data) => api.post("/paths", data);
export const updatePath = (id, data) => api.put(`/paths/${id}`, data);
export const deletePath = (id) => api.delete(`/paths/${id}`);

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

export default api;
