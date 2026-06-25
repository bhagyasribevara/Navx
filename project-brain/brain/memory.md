# Central Memory - NavX System Log

## 1. Project Summary
NavX is an enterprise indoor map navigation suite consisting of:
1. **User Client**: A React Native (Expo) app for campus geofencing, QR scans, indoor navigation, AR support, and Live Meet coordinates sharing.
2. **Admin Panel**: A Vite+React web dashboard allowing managers to customize campuses, draw map vectors (rooms, blocks), set routes, and deploy Bluetooth beacons.
3. **Backend API**: An Express.js REST and WebSocket server connected to MongoDB.

---

## 2. Current Development State

### Important Modules
- **Indoor dead-reckoning engine (`user/src/positioning.js`)**: Interprets steps and headings, scales them to latitude/longitude offsets, and correction updates using GPS locks.
- **Pathfinding Router (`user/src/utils/pathfinding.js` and `backend/utils/pathfinding.js`)**: Executes search algorithms (Dijkstra, A*) client-side (for offline functionality) and server-side.
- **Map Vector Editor (`admin/src/pages/MapEditor.jsx`)**: Comprehensive drawing dashboard utilizing Leaflet-Geoman to edit polygons (rooms), path nodes, and bidirectionals.

### Active Features
- **Live Meet Coordinates Sync**: WebSocket room logic matching coordinates in real-time between clients.
- **Geofence Guard**: In-app boundary verification. If a user walks outside the configured campus boundary (radius + buffer), the app automatically wipes cached maps and signs them out.

---

## 3. Recent Implementations

### Dynamic Map Centering Fixes
- Added logic in `MapScreen.js` to fetch campus-level metadata using `/campus/qr/:campusId` (`getCampusByQR`).
- Implemented offline fallbacks that query the local `"campuses"` cache in AsyncStorage if the network is disconnected.
- Changed map HTML templates in `MapScreen.js`, `LiveMeetScreen.js`, `NavigationScreen.js`, and `ARScreen.js` to dynamically center on the resolved campus location (or target destination coordinates) rather than defaulting to hardcoded GMRIT coordinates.

### Auto-Reconnections
- Implemented exponential backoff auto-reconnection logic for MongoDB in `server.js` with whitelist warning hints.
- Added client-side network error handling in `QRScanScreen.js` to report connection state accurately.

---

## 4. Future Expansion Areas
- **3D Map Layers**: Integrating GL models inside React Native WebViews for multi-level complexes.
- **Evacuation Route Generation**: Dynamically calculating shortest routes from user's current node to nearest exit nodes during emergencies.
- **BLE Beacon Trilateration**: Upgrading positioning logic to calculate exact distance metrics using RSSI values.
