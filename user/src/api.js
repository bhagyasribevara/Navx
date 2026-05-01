import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const devHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:5000/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Cache helpers
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

export async function cachedGet(key, fetcher) {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return data;
    }
  } catch {}
  const data = await fetcher();
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {}
  return data;
}

// API calls
export const getCampuses = () => api.get("/campus").then((r) => r.data);
export const getBlocks = (campusId) =>
  api.get(`/blocks?campusId=${campusId}`).then((r) => r.data);
export const getFloors = (blockId) =>
  api.get(`/floors?blockId=${blockId}`).then((r) => r.data);
export const getRooms = (floorId) =>
  api.get(`/rooms?floorId=${floorId}`).then((r) => r.data);
export const searchRooms = (query, campusId) =>
  api.get(`/rooms/search/${query}?campusId=${campusId}`).then((r) => r.data);
export const getMapData = (campusId) =>
  api.get(`/navigation/map-data/${campusId}`).then((r) => r.data);
export const findRoute = (data) =>
  api.post("/navigation/route", data).then((r) => r.data);
export const findRouteToRoom = (data) =>
  api.post("/navigation/route-to-room", data).then((r) => r.data);
export const findNearestNode = (data) =>
  api.post("/navigation/nearest-node", data).then((r) => r.data);
export const scanQRCode = (code) =>
  api.get(`/qrcodes/scan/${code}`).then((r) => r.data);
export const getBeaconsForFloor = (floorId) =>
  api.get(`/beacons/floor/${floorId}`).then((r) => r.data);
export const logAnalytics = (data) =>
  api.post("/analytics", data).catch(() => {});

export default api;
