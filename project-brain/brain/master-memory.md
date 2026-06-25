# Master Memory - NavX System Executive Summary

## 1. Project Overview
NavX is an enterprise-grade indoor positioning, mapping, and routing application designed for complex physical venues like university campuses, hospitals, airports, shopping malls, and corporate office complexes. 

### Purpose
NavX solves the problem of GPS-denied indoor navigation. It allows users to scan entry QR codes to unlock high-fidelity indoor floor plans, search for classrooms, labs, offices, restrooms, or gates, and receive step-by-step turn-by-turn indoor directions. It also includes real-time location sharing ("Live Meet"), emergency evacuation routing, and an AI chat assistant for context-sensitive campus information.

### Target Users
- **General Users / Guests**: Students, visitors, hospital patients, travelers, and shoppers who need navigation.
- **Venue Admins**: Campus managers who design, maintain, and publish map structures (blocks, floors, rooms, nodes, paths, beacons).
- **Super Administrators**: Managers who onboard new campuses, generate unique QR access links, and oversee platform health.

---

## 2. Technology Stack

### User Mobile Client (Frontend)
- **Core**: React Native (Expo SDK 54), JavaScript.
- **Navigation**: React Navigation (Bottom Tabs & Native Stacks).
- **Mapping**: Leaflet.js rendered inside a React Native WebView overlay, pulling street tiles from Mapbox API.
- **Sensors**: Expo Location (GPS & Geofencing), Expo Sensors (Magnetometer & Accelerometer for dead reckoning).
- **Voice/Audio**: Expo Speech (turn-by-turn audio directions).

### Admin Dashboard (Web Frontend)
- **Core**: React 19 (Vite), JavaScript.
- **Styling**: TailwindCSS, Vanilla CSS, React Icons.
- **Mapping/Editor**: Leaflet.js, React Leaflet, and `@geoman-io/leaflet-geoman-free` (for vector drawing of blocks, rooms, nodes, and path segments).

### Core Backend (API & Socket Server)
- **Framework**: Node.js, Express.
- **WebSockets**: Socket.io (real-time position sync for Live Meet, typing status for AI chat, and map updates notifications).
- **Authentication**: JSON Web Tokens (JWT), cookie-parser.
- **File Uploads**: Multer (processing local uploads for campus banners and map media).

### Database (Mongoose / MongoDB)
- **Engine**: MongoDB (local and MongoDB Atlas SRV clusters).
- **ODM**: Mongoose.
- **Indices**: Spatial index arrays, compounds on `campusId`, code lookups.

### Third-Party Services
- **Mapbox API**: Rendering high-resolution street tiles under custom campus overlays.
- **OSRM (Open Source Routing Machine)**: Footway street routing snapping when the user is located off-campus.
- **Gemini API / Vertex AI**: Processing natural language inquiries inside the AI Chatbot context.

---

## 3. Current Status

### Completed Modules
- **Authentication**: Password hashing (bcrypt) and JWT credentials matching for SuperAdmin, Admin, and AppUsers. Guest session initiation.
- **Entrance QR Scanning**: Resolving scanned codes to specific coordinates/floors and verifying access boundaries via GPS-backed Geofencing.
- **Indoor Positioning Engine**: Dead reckoning fusion combining step detector (accelerometer) and compass direction (magnetometer) anchored by QR/BLE scans.
- **Pathfinding Engine**: Dijkstra and A* pathfinding algorithms executed client-side (offline) and server-side (online).
- **Interactive WebView Map**: Responsive zoom/pan floor maps, restroom filtering, and user puck rotation.
- **Admin Map Editor**: Interactive web portal to upload campus blueprints, draw blocks/rooms, place nodes, and connect path coordinates.
- **Live Meet (Real-time Sharing)**: Socket.io rooms allowing two users on campus to share real-time positions on a map.

### Active/Refining Modules
- **AI Chat Overlay**: Natural language RAG context parser using custom system instructions and campus database information.
- **Offline Maps**: Native synchronization downloading campus JSON nodes, paths, and metadata to AsyncStorage.

### Pending/Future Modules
- **Emergency Evacuation**: Auto-routing users to the nearest exit node when emergency status is activated.
- **Advanced Crowdsensing**: Engine to monitor density metrics based on user location pings.

---

## 4. Core Features Inventory
1. **Entrance QR Verification**: Gatekeeper mechanism that checks user distance to venue center.
2. **Indoor Geofence Guard**: Continuous location checking that revokes session access if the user wanders away from campus bounds.
3. **Interactive Campus Directory**: Browse structures by category (Labs, Classrooms, Restrooms, Elevators, Offices).
4. **Step-by-step Audio Routing**: Turn-by-turn voice directions with visual directional arrows and distance meters.
5. **Real-time position puck**: Rotates based on compass heading and pulses to represent GPS accuracy weights.
6. **Live Meeting Room**: Generates an invitation URI (e.g. `navx://meet/:id`) so users can meet and see each other's live coordinates.
7. **Weather Widget**: Context-sensitive home page widget.
8. **Interactive Map Vector Editor**: Administrative toolkit to draw polygons for rooms, rectangles for blocks, and linear path guides.
