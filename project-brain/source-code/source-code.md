# Source Code Layout & Directory Structure

This document details the folder structures, module ownerships, entry points, and database configurations of the NavX project.

---

## 1. Directory Tree Map

```
NavX/
├── admin/                 # Admin Dashboard web console
│   ├── public/            # Assets and HTML templates
│   └── src/               # React components and configurations
│       ├── components/    # Common widgets and chatbot panel
│       ├── pages/         # Core views (MapEditor, Dashboards)
│       └── App.jsx        # Routing and mount entries
├── backend/               # Core Express APIs and WebSockets
│   ├── models/            # Mongoose Schemas (database)
│   ├── routes/            # REST API controllers
│   ├── services/          # Business logic wrappers
│   ├── utils/             # Helper classes (auth, pathfinding)
│   └── server.js          # App entry point
└── user/                  # React Native mobile client
    ├── src/
    │   ├── components/    # Mobile components (AI Chat, widgets)
    │   ├── context/       # Auth and geofencing context providers
    │   ├── screens/       # Mobile views (Map, Scan, Nav, Meet)
    │   ├── utils/         # Client calculations (Dijkstra, A*)
    │   └── positioning.js # Sensor dead-reckoning engine
    └── App.js             # Main navigation navigator
```

---

## 2. Key Code Entry Points

### Backend Server (`backend/server.js`)
- Initializes Express app instance.
- Boots Socket.io namespaces (`/ai-chat` and base rooms).
- Sets up exponential database reconnect backoffs to MongoDB Atlas.

### User App (`user/App.js`)
- Establishes the `AuthContext` and `GeofenceContext` context wraps.
- Configures bottom tab layouts and modal stacks.

### Admin App (`admin/src/main.jsx`)
- Mounts standard router settings.

---

## 3. Core Database Models (`backend/models/`)
- `Campus.js`: Configuration properties (GPS, radius).
- `Block.js`: Poly/rect descriptors.
- `Floor.js`: Height/width constraints.
- `Room.js`: Specific entity profiles (classroom, restroom, elevator).
- `NavNode.js`: Pathway graph nodes.
- `NavPath.js`: Linked vector lines.

---

## 4. Crucial Routing & Services (`backend/routes/`)
- `navigation.js`: Endpoint `/api/navigation/route` computes Dijkstra or A* arrays of waypoints.
- `appAuth.js`: Handles guest sign-up and geofenced check pings.
- `campusKnowledge.js`: Services parser gathering context lists for LLM queries inside the RAG chat wrapper.
- `pathfinding.js` (`backend/utils/`): Pure JavaScript graph-mapping, coordinate transformations, and A* algorithm steps.
