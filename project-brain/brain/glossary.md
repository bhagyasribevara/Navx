# Project Glossary & Terminology

This glossary defines the core business concepts, technical systems, database terminologies, and modules used in the NavX project.

---

## 1. Business Concepts & Terms
- **Campus**: A collection of physical structures (blocks, floors, rooms, routes) bound by a shared geographic location and name.
- **Block**: An individual building or division inside a campus (e.g. "Engineering Building").
- **Domain**: A business categorization category for blocks (e.g. "Academic Blocks", "Administrative Block", "OPD Block").
- **Tenant / Isolation**: The partitioning model restricting venue administrators to view and configure only objects belonging to their specific campus ID.
- **Campaign**: Public announcements, notifications, or services with linked banner graphics, targeted to a specific campus.

---

## 2. Technical Terms & Algorithms
- **Leaflet.js**: The open-source JavaScript map library used to render interactive floor plans.
- **Leaflet-Geoman**: The drawing framework integrated on the admin panel map editor to draw rooms, blocks, and path nodes.
- **Haversine Formula**: The formula used to calculate spherical distance between two sets of GPS (latitude, longitude) coordinates.
- **A\* Pathfinding**: The routing algorithm used to calculate the shortest path between waypoints, optimized with heuristic guidance.
- **Dijkstra's Algorithm**: The fallback pathfinding algorithm used when heuristic A* searches are unavailable.
- **Dead Reckoning**: The mathematical process of calculating current position by using a previously determined anchor point and applying step displacement vectors (heading and distance).

---

## 3. Internal Module Names
- **PositionEngine (`user/src/positioning.js`)**: The sensor fusion component that monitors accelerometer steps, magnetometer heading, and anchors (QR/BLE) to determine indoor location coordinates.
- **GeofenceGuard (`user/src/components/GeofenceGuard.js`)**: The UI component that warns the user when they leave the active campus area.
- **LiveMeet (`user/src/screens/LiveMeetScreen.js`)**: The feature mapping real-time navigation locations of two users on a single map.
- **AIChatOverlay (`user/src/components/AIChatOverlay.js`)**: The context-aware chatbot interface.
- **MapEditor (`admin/src/pages/MapEditor.jsx`)**: The drawing board workspace.

---

## 4. Database & Collection Terms
- **Mongoose ODM**: Object Document Mapper for MongoDB.
- **NavNode Collection**: MongoDB collection storing vector points of routes.
- **NavPath Collection**: MongoDB collection defining the line segments connecting routing nodes.
- **Population**: The Mongoose process of automatically replacing paths in a document with the actual matching documents from other collections (e.g. populating `nodeA` on a path).
