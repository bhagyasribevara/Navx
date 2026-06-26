# System Feature Inventory Map

This file details all core features implemented within the NavX application, mapping their user interfaces, API routing points, and database schemas.

---

## 1. QR Verification & Entrance Scan
- **Feature Name**: QR Verification & Entrance Scan
- **Purpose**: Authenticates users at campus entrances and maps their baseline coordinate coordinates.
- **Frontend Components**: `QRScanScreen.js`
- **Backend APIs**:
  - `GET /api/qrcodes/scan/:code`
  - `POST /api/campus/qr/:campusId/verify`
- **Database Tables**: `QRCode`, `Campus`
- **Services Used**: Geofencing check, Location request services.
- **Dependencies**: `expo-camera`, `expo-location`.
- **Status**: Completed.

---

## 2. Geofence Guard (Continuous boundary monitoring)
- **Feature Name**: Geofence Guard
- **Purpose**: Validates continuously that users are present inside the allowed geofence boundary. Automatically signs them out if they walk off-campus.
- **Frontend Components**: `GeofenceGuard.js` (Component), `GeofenceContext.js` (Context Provider)
- **Backend APIs**: `POST /api/app-auth/heartbeat` (Guest check-ins ping every 10s)
- **Database Tables**: `AppUser`
- **Services Used**: Continuous background tracking.
- **Dependencies**: `expo-location`, `expo-haptics`.
- **Status**: Completed.

---

## 3. Indoor Interactive Directory
- **Feature Name**: Indoor Interactive Directory
- **Purpose**: Allows users to filter rooms, restrooms, stairs, and parking garages on interactive floor maps.
- **Frontend Components**: `MapScreen.js` (floating directory sheet)
- **Backend APIs**:
  - `GET /api/navigation/map-data/:campusId`
  - `GET /api/rooms?floorId=:floorId`
- **Database Tables**: `Room`, `Floor`, `Block`
- **Services Used**: Leaflet Webview renderer.
- **Dependencies**: `react-native-webview`.
- **Status**: Completed.

---

## 4. Turn-by-Turn Audio Navigation
- **Feature Name**: Turn-by-Turn Audio Navigation
- **Purpose**: Computes short-path routing and plays spoken instructions (e.g. "Turn left in 5 meters").
- **Frontend Components**: `NavigationScreen.js`
- **Backend APIs**: `POST /api/navigation/route`
- **Database Tables**: `NavNode`, `NavPath`
- **Services Used**: Client-side graph routing engine (`user/src/utils/pathfinding.js`).
- **Dependencies**: `expo-speech`, `expo-sensors` (step counters), `expo-location` (snapping updates).
- **Status**: Completed.

---

## 5. Real-Time Location Share (Live Meet)
- **Feature Name**: Real-Time Location Share (Live Meet)
- **Purpose**: Permits two active campus users to share coordinate points in real-time.
- **Frontend Components**: `LiveMeetScreen.js`
- **Backend APIs**:
  - `POST /api/meet/create`
  - `POST /api/meet/join/:sessionId`
  - `GET /api/meet/:sessionId`
- **Database Tables**: `LiveMeetSession`
- **Services Used**: WebSocket communication (Socket.io rooms).
- **Dependencies**: `socket.io-client`.
- **Status**: Completed.

---

## 6. Admin Vector Map Editor
- **Feature Name**: Admin Vector Map Editor
- **Purpose**: Permits campus admins to draw boundaries, create blocks/rooms, place beacons, and link navigation route paths.
- **Frontend Components**: `MapEditor.jsx`
- **Backend APIs**:
  - `POST /api/blocks`
  - `POST /api/rooms`
  - `POST /api/nodes`
  - `POST /api/paths`
- **Database Tables**: `Block`, `Floor`, `Room`, `NavNode`, `NavPath`, `MapLayer`
- **Services Used**: Leaflet vector overlays.
- **Dependencies**: `@geoman-io/leaflet-geoman-free`, `react-leaflet`.
- **Status**: Completed.

---

## 7. AI Chat Overlay (Assistant)
- **Feature Name**: AI Chat Overlay
- **Purpose**: Dynamic dialogue panel providing information about campus rooms, schedules, and events.
- **Frontend Components**: `AIChatOverlay.js`
- **Backend APIs**: `POST /api/ai/chat`
- **Database Tables**: `Campus`, `Room` (for context indexing)
- **Services Used**: Gemini API Vertex AI models.
- **Dependencies**: `socket.io-client` (typing indicators).
- **Status**: Completed.
