# System Dependency Graph & Package Mapping

This document describes all packages, frameworks, external servers, and internal service connections inside NavX.

---

## 1. High-Level Dependency Schema

```mermaid
graph TD
  UserApp[User Client App] -->|package.json dependencies| RN_Expo[Expo SDK 54 / React Native]
  RN_Expo --> ExpoLocation[expo-location]
  RN_Expo --> ExpoSensors[expo-sensors]
  RN_Expo --> RNWebView[react-native-webview]
  RNWebView --> Leaflet[Leaflet.js CDN]

  AdminWeb[Admin Web Dashboard] -->|package.json dependencies| ReactVite[React Vite Console]
  ReactVite --> ReactLeaflet[react-leaflet]
  ReactVite --> Geoman[@geoman-io/leaflet-geoman-free]

  BackendAPI[Backend server] -->|package.json dependencies| Express[Express Server]
  Express --> Mongoose[Mongoose ODM]
  Express --> SocketIO[Socket.io]
  Express --> JWT[jsonwebtoken / bcrypt]
```

---

## 2. Package-Level Mapping

### A. User App Client (`user/package.json`)
- **`expo` (~54.0.35)**: Framework engine.
- **`react-native-webview` (13.15.0)**: Container to execute Leaflet maps in isolation.
- **`expo-location` (~19.0.8)**: Query GPS coordinates and trigger geofence boundaries checks.
- **`expo-sensors` (~15.0.8)**: Accelerometer and Magnetometer updates for dead-reckoning calculations.
- **`expo-speech` (~14.0.8)**: Synthesis audio guidance for turn-by-turn directions.
- **`@react-navigation/native` (^7.2.2)**: Mobile pages stack management.
- **`socket.io-client` (^4.8.3)**: Real-time socket sync with server.

### B. Admin Web Console (`admin/package.json`)
- **`react-leaflet` (^4.2.1)**: React wrapper for Leaflet map component binding.
- **`@geoman-io/leaflet-geoman-free` (^2.18.0)**: Coordinates drawing and shape manipulation.
- **`react-router-dom` (^6.22.3)**: Admin URL route handling.
- **`react-icons` (^5.0.1)**: Visual icons package.

### C. Backend API (`backend/package.json`)
- **`mongoose` (^8.2.0)**: Object Document Mapper for MongoDB collections.
- **`socket.io` (^4.7.4)**: Real-time communication server.
- **`bcrypt` (^5.1.1)**: Hashing and salting password keys.
- **`jsonwebtoken` (^9.0.2)**: Signing secure session payloads.
- **`multer` (^1.4.5-lts.1)**: Stream processing file uploads.

---

## 3. External API Integrations
- **Mapbox API**: Serves street tile map layers inside WebView overlays.
- **OpenStreetMap / OSRM (`router.project-osrm.org`)**: Snaps navigation paths to public walking paths when users are outside campus coordinates bounds.
