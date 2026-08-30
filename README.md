# 🧭 NavX — AI-Powered Indoor Navigation System

> **NavX** is a full-stack indoor navigation platform that transforms how people navigate complex indoor spaces — college campuses, hospitals, airports, malls, and large buildings. It combines 2D map editing, 3D digital twins, AI-powered chatbots, real-time location sharing, AR-guided navigation, street-view walkthroughs, and a complete academic management suite — all stitched together into a cohesive product.

---

## 📖 The Story: How NavX Works End-to-End

Imagine a student named **Yusuf** walks into his college campus on Day 1. He has no idea where anything is. Here's how NavX guides his entire journey — and the technology behind every moment.

### Chapter 1: The Campus is Born (Admin Setup)

Before Yusuf ever opens the app, a **Campus Admin** logs into the **Admin Dashboard** (`admin/`) — a React + Vite web app. The admin:

1. **Creates a Campus** — gives it a name, location (lat/lng), radius, venue type (campus, hospital, airport, mall, building), contact info, and operating hours. Behind the scenes, a `Campus` document is saved in MongoDB with fields like `venueType`, `location`, `bounds`, `emergencyState`, and `subscriptionPlan`. The campus gets a unique QR code image (`campusQRImage`) so users can scan-to-join.

2. **Draws the Map** — opens the **Map Editor** (`MapEditor.jsx`, 111KB of pure interactive canvas logic). Here, the admin:
   - Creates **Blocks** (buildings) — rectangles/polygons on the campus map with shapes, colors, rotation, and floor counts. Each `Block` stores its shape geometry, domain (e.g., "Academic Blocks"), and parent `campusId`.
   - Creates **Floors** within blocks — each `Floor` has a level number, map dimensions, background image (floor plan), grid settings, and optional wall/obstacle data.
   - Creates **Rooms** on each floor — classrooms, labs, offices, restrooms, cafeterias, libraries, auditoriums, elevators, stairs, corridors, entrances, and exits. But NavX isn't just for campuses — rooms can also be hospital wards, ICUs, pharmacies; airport gates, lounges, baggage claims; or mall stores, food courts, and ATMs. Each `Room` stores its shape, wall colors, stairs configuration (step count, rise height, tread depth, L-shape support), capacity, amenities, and accessibility flag.
   - Places **Navigation Nodes** — waypoints, entrances, exits, elevators, stairs entry points, room entries, and intersections. Each `NavNode` has x/y coordinates, floor level, type, and optionally links to a connected node on another floor (`connectedFloorNodeId`).
   - Draws **Navigation Paths** between nodes — each `NavPath` connects two nodes with a distance, type (hallway, stairs, elevator, outdoor, connector), weight multiplier, congestion level, and accessibility flag.

3. **Sets Up Positioning** — The admin configures **QR Codes** and **BLE Beacons** throughout the building. QR codes are placed at known positions and linked to the nearest navigation node. Beacons store UUID, major/minor IDs, TX power, and calibration data (RSSI at 1m, path-loss exponent, environment factor) for trilateration.

**How the navigation graph is built internally:**
When a user requests a route, the backend (`navigation.js`) loads all nodes and paths from MongoDB, constructs an adjacency-list graph using `buildGraph()`, then calls `autoConnectGraph()` to bridge any disconnected components. The graph is cached in memory for 60 seconds per campus (`graphCache`) to avoid rebuilding on every request.

---

### Chapter 2: The Pathfinding Brain (Backend Engine)

The heart of navigation lives in `utils/pathfinding.js` — a 772-line pathfinding engine that implements:

- **Dijkstra's Algorithm** — finds the shortest weighted path through the navigation graph
- **A* Algorithm** — uses heuristic (Haversine or Euclidean distance) to find optimal paths faster
- **Binary-Heap Priority Queue** — O(log n) push/pop operations for efficient graph traversal
- **Haversine Formula** — calculates real geodesic distances between GPS coordinates (Earth radius = 6,371,000m)
- **Auto-Connect** — detects disconnected graph components and adds virtual "connector" edges
- **Multi-Floor Routing** — follows `connectedFloorNodeId` links through stairs and elevators
- **Turn-by-Turn Directions** — bearing-based direction generation with walking speed presets:
  - Hallway: 1.3 m/s | Outdoor: 1.4 m/s | Stairs: 0.6 m/s | Elevator: 0.8 m/s
- **Route Summary** — total distance, estimated time, step count (avg stride 0.72m), floor changes

**Available navigation routes:**
| Endpoint | What It Does |
|---|---|
| `POST /navigation/route` | Find shortest path between two rooms/nodes |
| `POST /navigation/route-to-exit` | Emergency: find nearest exit from current position |
| `POST /navigation/route-by-name` | Search rooms by name and route to them |
| `POST /navigation/multi-floor-route` | Cross-floor pathfinding via stairs/elevators |

---

### Chapter 3: Ravi Opens the App (User Mobile App)

Ravi downloads the **NavX mobile app** (`user/`) — an **Expo / React Native** application. The app structure:

```
user/
├── App.js                    # Root navigator with tab + stack navigation
├── src/
│   ├── screens/
│   │   ├── AuthScreen.js         # Student registration & login (email/OTP)
│   │   ├── HomeScreen.js         # Campus dashboard, weather, campaigns, announcements
│   │   ├── MapScreen.js          # Interactive 2D campus map with floor switching
│   │   ├── SearchScreen.js       # Search rooms, faculty, facilities by name
│   │   ├── NavigationScreen.js   # Turn-by-turn navigation with animated path
│   │   ├── ARScreen.js           # AR camera view with 3D robot guide overlay
│   │   ├── ARMeetScreen.js       # AR view for live meet-up navigation
│   │   ├── QRScanScreen.js       # QR code scanner for positioning & room info
│   │   ├── LiveMeetScreen.js     # Real-time location sharing with friends
│   │   ├── StreetViewScreen.js   # Google Street View-style indoor walkthrough
│   │   ├── AcademicsScreen.js    # Timetable, attendance, marks, assignments
│   │   ├── FeesScreen.js         # Fee payment status and history
│   │   ├── FavoritesScreen.js    # Saved/bookmarked locations
│   │   ├── OfflineMapsScreen.js  # Download maps for offline use
│   │   ├── ProfileScreen.js      # User profile management
│   │   ├── SettingsScreen.js     # App settings, dark mode, language
│   │   ├── CampaignDetailScreen.js # Event/campaign details with navigate-to
│   │   └── SplashScreen.js       # App loading screen
│   ├── components/
│   │   ├── AIChatOverlay.js      # Floating AI assistant chat bubble
│   │   ├── ARRobotGuide.js       # 3D animated robot for AR navigation
│   │   ├── EmergencyOverlay.js   # Full-screen emergency alert overlay
│   │   ├── GeofenceGuard.js      # GPS-based campus boundary enforcement
│   │   ├── WeatherWidget.js      # Real-time weather display
│   │   └── NotificationBanner.js # Push notification banners
│   ├── context/
│   │   ├── AuthContext.js        # JWT token management & user session
│   │   ├── GeofenceContext.js    # Campus boundary detection & enforcement
│   │   ├── LiveMeetContext.js    # Real-time meet-up state management
│   │   └── ThemeContext.js       # Light/dark theme toggle
│   ├── services/
│   │   └── weatherService.js     # Weather data processing & forecasting
│   ├── positioning.js            # BLE beacon trilateration engine
│   └── api.js                    # Axios API client with base URL config
```

**When Ravi signs up:** The app calls `POST /api/app-auth/register` with his college email, department, semester, section, and password. The backend hashes the password with bcrypt (10 salt rounds), creates an `AppUser` document with fields like `role` (student/guest), `department`, `semester`, `section`, `rollNumber`, `academicStatus`, `feeStatus`, and `attendancePercent`, and returns a JWT token.

**When Ravi enters campus:** The `GeofenceGuard` component checks his GPS against the campus location and radius. Once inside, the campus data loads — blocks, floors, rooms — and the interactive map renders.

---

### Chapter 4: Finding His Way (Navigation in Action)

Ravi asks *"Where is Room C-302?"*

1. **Search** (`SearchScreen.js`) — The app sends a text search to the backend, which runs a MongoDB text index query across room names, room numbers, and descriptions.

2. **Route Calculation** — The backend loads the navigation graph, finds the nearest node to Ravi's position (via QR scan or beacon trilateration), and runs A* pathfinding to C-302. The response includes:
   - Ordered list of waypoint coordinates
   - Turn-by-turn directions ("Walk 15m, Turn right, Take stairs to Floor 3")
   - Total distance, estimated walking time, step count
   - Floor transitions with stairs/elevator options

3. **Visual Navigation** (`NavigationScreen.js`, 62KB) — The path is rendered as an animated polyline on the 2D map. Floor transitions are highlighted. Ravi follows the blue line.

4. **AR Navigation** (`ARScreen.js`, 50KB) — Ravi can switch to camera mode. An **AR Robot Guide** (`ARRobotGuide.js`) — a 3D animated character — appears overlaid on the camera feed, walking ahead to guide him. The robot uses device orientation and step detection to maintain position.

5. **QR Positioning** (`QRScanScreen.js`) — At any point, Ravi can scan a QR code on the wall. The app decodes it, looks up the linked `NavNode` position, and instantly re-calibrates his map position. Each QR stores its x/y position and nearest nav node reference.

---

### Chapter 5: The AI Assistant (Gemini-Powered Copilot)

Ravi taps the floating chat bubble and asks *"Where is Dr. Sharma right now?"*

The AI pipeline processes his message through 4 stages:

```
User Message → Intent Detector → Domain Guard → Campus Knowledge → Gemini API → Response
```

**Stage 1: Intent Detection** (`services/intentDetector.js`)
- Detects language: English, Hindi, or Telugu (supports native script + transliteration)
- Classifies intent: navigation, search, faculty lookup, timetable query, weather, emergency, etc.
- Extracts entities: room names, faculty names, time references

**Stage 2: Domain Guard** (`services/domainGuard.js`)
- Checks if the query is campus-related using keyword whitelists (English + Telugu + Hindi)
- Blocks off-topic queries (politics, coding help, recipes) with polite multilingual refusals
- Ambiguous queries are allowed through (Gemini's system prompt handles the rest)

**Stage 3: Campus Knowledge** (`services/campusKnowledge.js`)
- Fetches live campus data from MongoDB: all blocks, floors, rooms, faculty, today's timetable, announcements, landmarks
- Builds a rich structured context string injected into Gemini's system prompt
- Uses a 2-minute cache (`contextCache`) to avoid hammering the database
- Resolves faculty schedules in real-time: "Dr. Sharma is currently in Room C-302 teaching Data Structures (Period 3, 11:00 AM - 12:00 PM)"

**Stage 4: Gemini Response** (`routes/ai.js`)
- Sends the message + campus context to Google Gemini API (`@google/generative-ai`)
- Returns the response with optional action buttons:
  - `NAVIGATE_TO_ROOM` — deep-links to navigation
  - `SHOW_ON_MAP` — highlights a room on the map
  - `SHOW_TIMETABLE` — opens the timetable view

**Admin Copilot** (`routes/adminAi.js`, `NavXAdminCopilot.jsx`)
Admins get their own AI assistant that can query campus statistics, help manage rooms, and answer operational questions. Chat history is persisted in the `CopilotChat` collection.

---

### Chapter 6: Live Meet-Up (Real-Time Location Sharing)

Ravi wants to meet his friend in the library. He creates a **Live Meet Session**:

1. `POST /api/meet/create` — generates a unique 8-character session ID, sets expiry (default 30 min), saves creator's location with lat/lng, floor, heading, and speed
2. Ravi shares the session ID with his friend
3. Friend joins via `POST /api/meet/join/:sessionId` — both locations are now tracked
4. **Socket.IO** enables real-time location broadcasting — both users see each other's live position on the map
5. The `LiveMeetContext` in the mobile app manages state, polls for updates, and renders both markers on the map
6. Sessions auto-delete via MongoDB TTL index 1 minute after expiry (`expiresAt`)

---

### Chapter 7: Spatial Studio & Digital Twins (3D Building Scanning)

The **Spatial Studio** is NavX's most innovative feature. An admin walks through a building with the **NavX Admin Studio** mobile app (`navx-admin-studio/`), and the system creates a 3D digital twin.

**The Scanning Flow:**

```
Admin walks → Device sensors capture trajectory → Room segments recorded → AI processes scan → 3D Digital Twin generated
```

1. **Start Scan** (`SpatialStudioScanner.js`) — The admin selects a building and floor, then starts walking. The app captures:
   - 6DOF trajectory (x, y, z + quaternion rotation: qw, qx, qy, qz)
   - Room boundaries (start/end timestamps per room)
   - Coverage percentage and tracking quality (poor/fair/good/excellent)

2. **Live Trajectory** — Each pose is streamed to `POST /api/spatialStudio/session/:id/trajectory`. The backend optionally queries the **AI Microservice** for corridor width detection.

3. **AI Microservice** (`ai-service/main.py`) — A **FastAPI** Python service running on port 8000 that provides:
   - `POST /detect-objects` — identifies room labels, doorframes, exit signs, wall materials, floor types
   - `POST /extract-scene-palette` — extracts wall colors (top/bottom), floor material & color, corridor dimensions
   - `POST /build-navigation-graph` — processes walk trajectory into navigation waypoints and edges
   - `POST /generate-digital-twin` — creates the full 3D architectural model with:
     - Rooms positioned alternately along both sides of the corridor
     - Realistic materials (drywall, carpet, tile, vinyl, glass, wood) assigned by room type
     - Dynamic wall generation from room bounding boxes
     - Proper door placement facing the corridor

4. **Digital Twin Model** (`DigitalTwin.js`) — Stores the complete 3D representation:
   - Wall segments with start/end coordinates, height, thickness, bi-color (cream top, sandstone bottom)
   - Doors with position, dimensions, room association, open/closed state
   - Detected rooms with 3D position, dimensions, materials (wall/floor/door)
   - Landmarks (exit signs, fire extinguishers, switches)
   - Scanned elements with full 3D geometry (vertices, faces, world matrix)

5. **3D Viewer** (`DigitalTwinViewer.jsx`, `Admin3DViewer.jsx`) — A web-based Three.js viewer renders the digital twin with:
   - Realistic corridor with proper wall colors
   - Doors and room labels
   - Drag-and-drop assembly canvas (`SpatialAssemblyCanvas.jsx`)
   - Staging tray for unplaced scanned elements (`StagingTray.jsx`)

---

### Chapter 8: Indoor Street View (Google Street View, but Indoors)

The admin creates an indoor walkthrough using the **Street View Manager** (`StreetViewManager.jsx`):

1. **Capture Session** — The admin walks through a corridor, capturing 360-degree images at regular intervals (1.5m default). Each image is uploaded via `POST /api/streetView/upload-session`.

2. **Image Processing** — Images are:
   - Resized to max 2048px width
   - Converted to WebP (quality 80) using **Sharp**
   - Uploaded to **Cloudinary** (organized in folders: `navx-campus/{campusId}/{blockId}/{floorId}`)

3. **Node Graph** — Each capture point becomes a `StreetViewNode` with:
   - Image URL + Cloudinary public ID
   - Position (x, y, z) and orientation (heading, pitch)
   - Connected edges (forward, backward, left, right, stair_up, stair_down) with direction, distance, and bearing
   - Door detection (isDoorway, roomName, relativeAngle)

4. **User Experience** (`StreetViewScreen.js`) — Users can virtually "walk" through corridors by clicking directional arrows, seeing photorealistic views of the building interior. A minimap (`StreetViewMiniMap.jsx`) shows their position on the floor plan.

---

### Chapter 9: Emergency System

When danger strikes, the admin activates **Emergency Mode** from the Emergency Dashboard (`EmergencyDashboard.jsx`):

1. The campus `emergencyState` is updated: `{ isActive: true, type: 'Fire', message: '...' }`
2. **Socket.IO** broadcasts the emergency to all connected mobile clients in that campus room
3. The `EmergencyOverlay.js` component immediately covers the user's screen with a full-screen alert
4. The **Route-to-Exit** endpoint (`POST /navigation/route-to-exit`) finds the nearest exit from the user's current position
5. The AI assistant automatically provides emergency guidance when asked

---

### Chapter 10: Academic Suite (Student Life Management)

NavX isn't just navigation — it's a complete campus companion:

| Feature | Model | Route | What It Does |
|---|---|---|---|
| **Timetable** | `Timetable.js` | `/api/student/timetable` | Day-wise class schedule with subject, room, faculty, time |
| **Attendance** | `Attendance.js` | `/api/student/attendance` | Per-subject attendance tracking (Present/Absent) |
| **Marks** | `Mark.js` | `/api/student/marks` | Mid 1, Mid 2, OBE, Assignment, Semester scores |
| **Fees** | `Fee.js` | `/api/student/fees` | Payment status, due dates, transaction history |
| **Assignments** | `Assignment.js` | `/api/student/assignments` | Homework with file upload & submission tracking |
| **Study Materials** | `StudyMaterial.js` | `/api/student/study-materials` | Faculty-uploaded lecture notes and resources |
| **Academic Calendar** | `AcademicCalendar.js` | `/api/student/calendar` | Exams, holidays, events, academic milestones |
| **Substitutions** | `TimetableSubstitution.js` | `/api/student/timetable` | Faculty on leave - substitute teacher info |
| **Announcements** | `Announcement.js` | `/api/announcements` | Campus-wide notices and updates |

**Faculty Dashboard** (`FacultyDashboard.jsx`, 82KB) — Faculty members log in and can:
- View their assigned sections and timetable
- Mark attendance for each period
- Upload marks, assignments, and study materials
- Request leave (triggers substitution workflow)
- View their student roster

**Timetable Allocation** (`TimetableAllocation.jsx`, 36KB) — Admins allocate timetables by:
- Selecting department, semester, section
- Assigning subjects to periods with faculty and room
- System validates conflicts (same faculty in two places, room double-booking)

---

### Chapter 11: Campaign & Event Management

The admin creates **Campaigns** (events, fests, workshops) via the Campaign Manager (`CampaignManager.jsx`):

- Each `Campaign` has a title, description, image, category, dates, and a destination (block/floor/room)
- **Sub-campaigns** are supported — a parent event can have child events (tech, non-tech, cultural, workshop)
- Users see campaigns on the Home screen and can tap "Navigate" to get routed directly to the event venue

---

### Chapter 12: Weather Intelligence

The `WeatherWidget` on the Home screen provides real-time weather:

1. **Backend** (`routes/weather.js`) — Proxies OpenWeather API with a 5-minute cache. Returns:
   - Temperature, feels-like, humidity, wind speed/direction
   - Weather condition mapping (storm, rain, clear, cloudy, snow, hot, cold)
   - Sunrise/sunset times
   - Weather advisories

2. **Frontend** (`weatherService.js`, 18KB) — Full weather processing engine with:
   - Animated weather icons
   - 5-day forecast visualization
   - Outdoor activity recommendations based on conditions

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NavX Architecture                            │
├──────────────┬───────────────┬──────────────┬────────────────────────┤
│  User App    │  Admin Panel  │ Admin Studio │   AI Microservice      │
│  (Expo/RN)   │  (Vite/React) │ (Expo/RN)    │   (FastAPI/Python)     │
│  Port: 8081  │  Port: 5173   │  Mobile App  │   Port: 8000           │
└──────┬───────┴───────┬───────┴──────┬───────┴────────────┬───────────┘
       │               │              │                    │
       └───────────────┴──────────────┴────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │    Node.js Backend     │
                    │    Express + Socket.IO │
                    │    Port: 5001          │
                    ├────────────────────────┤
                    │  Rate Limiting         │
                    │  JWT Authentication    │
                    │  Input Validation      │
                    │  Error Masking         │
                    └───────────┬────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
        │  MongoDB   │  │ Cloudinary  │  │ Gemini API  │
        │  Atlas     │  │ (Images)    │  │ (AI Chat)   │
        └────────────┘  └─────────────┘  └─────────────┘
```

---

## 📁 Complete Folder Structure

```
Navx/
├── backend/                          # Node.js + Express API Server
│   ├── server.js                     # Entry point: Express, Socket.IO, MongoDB, routes
│   ├── package.json                  # Dependencies
│   ├── seedData.js                   # Database seeder
│   ├── models/                       # 32 Mongoose schemas
│   │   ├── Campus.js                 # Campus/venue definition
│   │   ├── Block.js                  # Building within campus
│   │   ├── Floor.js                  # Floor within a block
│   │   ├── Room.js                   # Room (multi-venue types)
│   │   ├── NavNode.js                # Navigation waypoint
│   │   ├── NavPath.js                # Path between two nodes
│   │   ├── NavigationGraph.js        # Cached navigation graph
│   │   ├── Admin.js                  # Admin user
│   │   ├── AppUser.js                # Mobile app user
│   │   ├── Faculty.js                # Faculty member
│   │   ├── Timetable.js              # Class schedule entries
│   │   ├── TimetableSubstitution.js  # Faculty substitution records
│   │   ├── Attendance.js             # Student attendance
│   │   ├── Mark.js                   # Student marks
│   │   ├── Fee.js                    # Fee records
│   │   ├── Assignment.js             # Homework assignments
│   │   ├── StudyMaterial.js          # Lecture notes
│   │   ├── AcademicCalendar.js       # Academic events
│   │   ├── Announcement.js           # Campus announcements
│   │   ├── QRCode.js                 # QR positioning markers
│   │   ├── Beacon.js                 # BLE beacons
│   │   ├── Campaign.js               # Events & campaigns
│   │   ├── Analytics.js              # Usage analytics
│   │   ├── Landmark.js               # Campus landmarks
│   │   ├── MapLayer.js               # GeoJSON overlays
│   │   ├── DigitalTwin.js            # 3D digital twin data
│   │   ├── SpatialScanSession.js     # Scanning session
│   │   ├── StreetViewSession.js      # Street view session
│   │   ├── StreetViewNode.js         # Street view panorama
│   │   ├── LiveMeetSession.js        # Meet-up session
│   │   ├── CopilotChat.js            # Admin AI chat history
│   │   └── SectionTiming.js          # Section time slots
│   ├── routes/                       # 27 API route handlers
│   │   ├── appAuth.js                # User auth (register/login/OTP)
│   │   ├── admin.js                  # Admin management
│   │   ├── campus.js                 # Campus CRUD
│   │   ├── blocks.js / floors.js / rooms.js  # Map data CRUD
│   │   ├── navigation.js             # Pathfinding engine
│   │   ├── nodes.js / paths.js       # Nav graph CRUD
│   │   ├── ai.js                     # AI chatbot (user)
│   │   ├── adminAi.js                # AI copilot (admin)
│   │   ├── student.js                # Student academic APIs
│   │   ├── faculty.js                # Faculty dashboard APIs
│   │   ├── analytics.js              # Usage analytics
│   │   ├── qrcodes.js / beacons.js   # Positioning setup
│   │   ├── campaigns.js              # Event management
│   │   ├── weather.js                # Weather proxy
│   │   ├── spatialStudio.js          # 3D scanning & digital twin
│   │   ├── streetView.js             # Indoor street view
│   │   ├── liveMeet.js               # Real-time meet-ups
│   │   ├── upload.js / serveUpload.js # File management
│   │   ├── mapLayers.js / landmarks.js / announcements.js
│   │   └── navigationGraphs.js
│   ├── services/                     # AI Pipeline
│   │   ├── aiConstants.js            # Keywords, FAQs, emojis
│   │   ├── intentDetector.js         # Language & intent classification
│   │   ├── domainGuard.js            # Off-topic filtering
│   │   └── campusKnowledge.js        # Real-time campus context
│   ├── middleware/                   # Security
│   │   ├── rateLimiter.js            # Tiered rate limiting
│   │   ├── errorHandler.js           # Global error handler
│   │   ├── inputValidator.js         # Request validation
│   │   └── schemas.js                # Validation schemas
│   ├── utils/                        # Core Utilities
│   │   ├── pathfinding.js            # Dijkstra, A*, Haversine (772 lines)
│   │   ├── auth.js                   # JWT, RBAC
│   │   └── cloudinaryConfig.js       # Image CDN setup
│   └── scripts/                      # DB scripts & seeders
│
├── admin/                            # Admin Dashboard (Vite + React)
│   └── src/
│       ├── pages/                    # 19 admin pages
│       │   ├── Dashboard.jsx / SuperAdminDashboard.jsx
│       │   ├── MapEditor.jsx         # Full map editor (112KB)
│       │   ├── FacultyDashboard.jsx  # Faculty portal (83KB)
│       │   ├── TimetableAllocation.jsx # Timetable management
│       │   ├── CampaignManager.jsx / CampusManager.jsx
│       │   ├── SpatialStudioDashboard.jsx / StreetViewManager.jsx
│       │   ├── EmergencyDashboard.jsx / AnalyticsDashboard.jsx
│       │   └── PositioningSetup.jsx / AdminAiAssistant.jsx
│       └── components/               # 12 components
│           ├── DigitalTwinViewer.jsx  # 3D viewer (45KB)
│           ├── Admin3DViewer.jsx      # 3D building viewer (38KB)
│           ├── SpatialAssemblyCanvas.jsx # 3D editor (34KB)
│           ├── NavXAIChat.jsx / NavXAdminCopilot.jsx
│           └── StreetViewCanvas.jsx / StreetViewMiniMap.jsx
│
├── user/                             # Mobile App (Expo / React Native)
│   └── src/
│       ├── screens/                  # 18 user screens
│       ├── components/               # 7 reusable components
│       ├── context/                  # Auth, Geofence, LiveMeet, Theme
│       ├── services/                 # Weather service
│       └── positioning.js            # BLE trilateration
│
├── ai-service/                       # Python AI Microservice (FastAPI)
│   ├── main.py                       # Object detection, scene analysis, digital twin
│   └── requirements.txt
│
├── navx-admin-studio/                # Mobile Admin App (Expo / React Native)
│   └── src/screens/                  # 10 admin screens
│       ├── SpatialStudioScanner.js   # AR spatial scanning
│       ├── ScanReviewScreen.js       # Scan review & edit
│       ├── QRGeneratorScreen.js      # QR code generator
│       └── EmergencyScreen.js        # Emergency controls
│
├── navx-secure-uploads/              # Secure uploaded files
├── timetables/                       # Source timetable PDFs (6 departments)
├── project-brain/                    # Project documentation & skills
└── package.json                      # Root monorepo scripts
```

---

## 🔒 Security Architecture

NavX implements defense-in-depth security:

| Layer | Implementation |
|---|---|
| **Authentication** | JWT access tokens (7-day expiry) + refresh tokens (30-day) with session versioning |
| **Password Security** | bcrypt hashing with 10 salt rounds |
| **Rate Limiting** | Tiered: Auth (30/15min), API (3000/15min), AI (30/min), Upload (20/15min) |
| **Input Validation** | Schema-based validation on all request bodies via middleware |
| **Error Masking** | Global error handler: full details logged internally, only error IDs sent to clients |
| **Secure Uploads** | Files served via controlled route (not express.static), with filename-only redirect |
| **RBAC** | SuperAdmin > CampusAdmin > Faculty > Student role hierarchy |
| **Session Revocation** | `sessionVersion` counter — increment to invalidate all existing tokens |
| **Env Validation** | Server refuses to start if `MONGODB_URI`, `JWT_SECRET`, or `JWT_REFRESH_SECRET` are missing |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18
- **Python** >= 3.9
- **MongoDB Atlas** account (or local MongoDB)
- **Cloudinary** account (for image uploads)
- **Google Gemini API** key (for AI chat)
- **OpenWeather API** key (for weather)

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/navx.git
cd navx
npm run install:all
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in:
#   MONGODB_URI=mongodb+srv://...
#   JWT_SECRET=your-secret-key
#   JWT_REFRESH_SECRET=your-refresh-secret
#   GEMINI_API_KEY=your-gemini-key
#   OPENWEATHER_API_KEY=your-weather-key
#   CLOUDINARY_CLOUD_NAME=...
#   CLOUDINARY_API_KEY=...
#   CLOUDINARY_API_SECRET=...
```

### 3. Start All Services

```bash
# Option 1: Start everything
npm start

# Option 2: Start individually
npm run start:backend   # Backend on port 5001
npm run start:admin     # Admin panel on port 5173
npm run start:mobile    # Mobile app (Expo)

# AI Microservice (separate terminal)
cd ai-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Seed Demo Data (Optional)

```bash
cd backend
node seedData.js
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Backend API** | Node.js, Express.js, Socket.IO |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **AI Chat** | Google Gemini API (@google/generative-ai) |
| **AI Microservice** | Python, FastAPI, Uvicorn, Pydantic |
| **Admin Dashboard** | React, Vite, TailwindCSS |
| **Mobile App** | React Native, Expo |
| **3D Rendering** | Three.js (web), React Three Fiber |
| **Image Processing** | Sharp (Node.js), Jimp |
| **Image Storage** | Cloudinary |
| **QR Codes** | qrcode (generation), jsqr (scanning) |
| **Weather** | OpenWeather API |
| **Real-Time** | Socket.IO (WebSocket) |
| **Deployment** | Vercel (admin), Render/Railway (backend) |

---

## 📊 API Endpoints Summary

| Category | Count | Base Path |
|---|---|---|
| Authentication | 8+ | `/api/app-auth/*` |
| Campus Management | 15+ | `/api/campus/*` |
| Map Data (Blocks/Floors/Rooms) | 12+ | `/api/blocks/*`, `/api/floors/*`, `/api/rooms/*` |
| Navigation & Pathfinding | 6+ | `/api/navigation/*` |
| AI Chat | 5+ | `/api/ai/*` |
| Admin AI Copilot | 4+ | `/api/adminAi/*` |
| Student Academic | 10+ | `/api/student/*` |
| Faculty Portal | 8+ | `/api/faculty/*` |
| Spatial Studio | 8+ | `/api/spatialStudio/*` |
| Street View | 5+ | `/api/streetView/*` |
| Live Meet | 4 | `/api/meet/*` |
| Analytics | 3+ | `/api/analytics/*` |
| Campaigns | 4+ | `/api/campaigns/*` |
| Weather | 2+ | `/api/weather/*` |
| QR Codes / Beacons | 6+ | `/api/qrcodes/*`, `/api/beacons/*` |
| File Uploads | 2+ | `/api/upload/*`, `/api/uploads/*` |

---

## 🌐 Multi-Venue Support

NavX is not limited to campuses. The `venueType` field supports:

| Venue Type | Room Types Available |
|---|---|
| **Campus** | Classrooms, labs, offices, libraries, auditoriums, cafeterias |
| **Hospital** | Wards, ICU, OT, pharmacy, reception, emergency, radiology, pathology |
| **Airport** | Gates, terminals, check-in, security, lounges, baggage claim, customs |
| **Mall** | Stores, food courts, anchor stores, kiosks, parking, entertainment |
| **Building** | Conference rooms, server rooms, lobbies, gyms, rooftops, break rooms |

---

## 🌍 Multilingual AI Support

The AI assistant supports three languages:
- **English** — Full support with keyword detection
- **Hindi** — Native Devanagari script + transliteration (e.g., "kahan hai library?")
- **Telugu** — Native Telugu script + transliteration (e.g., "library ekkada undi?")

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ by the <strong>NavX Team</strong>
</p>
