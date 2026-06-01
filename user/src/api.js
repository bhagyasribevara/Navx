import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { buildGraph, astar, dijkstra, findNearestNode as localFindNearestNode, generateDirections } from './utils/pathfinding';

let Constants = null;
try { Constants = require("expo-constants").default; } catch (e) {}

let devHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
if (Constants?.expoConfig?.hostUri) {
  devHost = Constants.expoConfig.hostUri.split(':')[0];
}

let API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || `https://navx-backend-f8wa.onrender.com/api`;
let SOCKET_URL = process.env.EXPO_PUBLIC_API_BASE_URL ? process.env.EXPO_PUBLIC_API_BASE_URL.replace('/api', '') : `https://navx-backend-f8wa.onrender.com`;

if (__DEV__) {
  API_BASE = `http://${devHost}:5001/api`;
  SOCKET_URL = `http://${devHost}:5001`;
}

export { SOCKET_URL };
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Cache helpers
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

export async function cachedGet(key, fetcher) {
  let cachedData = null;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      cachedData = data;
      if (Date.now() - timestamp < CACHE_DURATION) return data;
    }
  } catch {}
  
  try {
    const data = await fetcher();
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch {}
    return data;
  } catch (err) {
    if (cachedData) return cachedData; // Fallback to stale cache if offline
    throw err;
  }
}

// Download Campus Offline
export const downloadCampusOffline = async (campusId) => {
  try {
    const mapData = await api.get(`/navigation/map-data/${campusId}?t=${Date.now()}`).then(r => r.data);
    await AsyncStorage.setItem(`navx_offline_${campusId}`, JSON.stringify(mapData));
    return true;
  } catch (e) {
    console.error("Failed to download offline maps:", e);
    return false;
  }
};

const runOfflinePathfinding = async (campusId, from, to, isToRoom = false) => {
  const offlineData = await AsyncStorage.getItem(`navx_offline_${campusId}`);
  if (!offlineData) throw new Error("Offline map not available");
  
  const mapData = JSON.parse(offlineData);
  const graph = buildGraph(mapData.nodes, mapData.paths);
  
  let startNodeId = from.nodeId;
  if (!startNodeId && from.position) {
     const nearest = localFindNearestNode(graph, from.position.x, from.position.y, from.floorId);
     if (nearest) startNodeId = nearest.id;
  }
  
  let endNodeId = to.nodeId;
  if (isToRoom && to.roomId) {
     const room = mapData.rooms?.find(r => r._id === to.roomId);
     if (room && room.nodes && room.nodes.length > 0) {
        endNodeId = room.nodes[0];
     } else if (room) {
        const nearest = localFindNearestNode(graph, room.x, room.y, room.floorId);
        if (nearest) endNodeId = nearest.id;
     }
  } else if (!endNodeId && to.position) {
     const nearest = localFindNearestNode(graph, to.position.x, to.position.y, to.floorId);
     if (nearest) endNodeId = nearest.id;
  }

  if (!startNodeId || !endNodeId) throw new Error("Start or End node not found offline");

  let result = astar(graph, startNodeId, endNodeId);
  
  if (!result.found) {
    console.log('[Offline Navigation] A* route failed, falling back to Dijkstra...');
    result = dijkstra(graph, startNodeId, endNodeId);
  }

  const directions = generateDirections(result.path);
  
  return { ...result, directions, offline: true };
};

// API calls
export const getCampuses = () => api.get("/campus").then((r) => r.data);
export const getBlocks = (campusId) =>
  api.get(`/blocks?campusId=${campusId}`).then((r) => r.data);
export const getFloors = (blockId) =>
  api.get(`/floors?blockId=${blockId}`).then((r) => r.data);
export const getRooms = (floorId) =>
  api.get(`/rooms?floorId=${floorId}`).then((r) => r.data);
export const getRoomsByCat = (campusId, type) =>
  api.get(`/rooms?campusId=${campusId}&type=${type}`).then((r) => r.data);
export const searchRooms = (query, campusId) =>
  api.get(`/rooms/search/${query}?campusId=${campusId}`).then((r) => r.data);
export const getCampaigns = (campusId) =>
  api.get(`/campaigns/campus/${campusId}?active=true`).then((r) => r.data);

export const getMapData = async (campusId) => {
  try {
    return await api.get(`/navigation/map-data/${campusId}?t=${Date.now()}`).then((r) => r.data);
  } catch (error) {
    const offlineData = await AsyncStorage.getItem(`navx_offline_${campusId}`);
    if (offlineData) {
      console.log("Serving offline map data");
      return JSON.parse(offlineData);
    }
    throw error;
  }
};

export const getGeoJSONMapData = async (campusId) => {
  return await api.get(`/campus/geojson/${campusId}`).then((r) => r.data);
};

export const findRoute = async (data) => {
  try {
    return await api.post("/navigation/route", data).then((r) => r.data);
  } catch (error) {
    return runOfflinePathfinding(data.campusId, data.from, data.to, false);
  }
};

export const findRouteToRoom = async (data) => {
  try {
    return await api.post("/navigation/route-to-room", data).then((r) => r.data);
  } catch (error) {
    return runOfflinePathfinding(data.campusId, data.from, { roomId: data.roomId }, true);
  }
};

export const findRouteToExit = async (data) => {
  try {
    return await api.post("/navigation/route-to-exit", data).then((r) => r.data);
  } catch (error) {
    throw error;
  }
};

export const findNearestNode = (data) =>
  api.post("/navigation/nearest-node", data).then((r) => r.data);
export const scanQRCode = (code) =>
  api.get(`/qrcodes/scan/${code}`).then((r) => r.data);
export const getCampusByQR = (campusId) =>
  api.get(`/campus/qr/${campusId}`).then((r) => r.data);
export const verifyCampusGeofence = (campusId, lat, lng) =>
  api.post(`/campus/qr/${campusId}/verify`, { lat, lng }).then((r) => r.data);
export const getBeaconsForFloor = (floorId) =>
  api.get(`/beacons/floor/${floorId}`).then((r) => r.data);
export const logAnalytics = (data) =>
  api.post("/analytics", data).catch(() => {});

// AI Chatbot
export const chatWithAI = (message, sessionId, context) =>
  api.post("/ai/chat", { message, sessionId, context }).then((r) => r.data);

export default api;
