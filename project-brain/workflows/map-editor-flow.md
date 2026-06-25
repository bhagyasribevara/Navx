# Business Workflow - Admin Map Editor Flow

This document details the vector drawing and map deployment workflow in the admin console.

---

## Workflow Details

- **Trigger**: Selecting a campus and loading the Map Editor workspace.
- **Steps**:
  1. Web console loads the selected campus coordinates, centering the Leaflet canvas.
  2. Campus map data (blocks, floors, rooms, nodes, paths) is retrieved and loaded onto vector layers.
  3. Admin draws a room polygon using Leaflet-Geoman tool overlays.
  4. Geoman captures the coordinates points array.
  5. Admin inputs room details (e.g. name, type, room number) and submits.
  6. Admin adds path nodes (doors, waypoints) and draws linear path connections.
  7. Client posts new vectors to the API.
  8. Admin clicks "Publish Map", which regenerates the unified campus GeoJSON file.
  9. Server broadcasts a WebSocket event to all active clients of that campus indicating a map update is available.
- **APIs Involved**:
  - `GET /api/navigation/map-data/:campusId`
  - `POST /api/rooms`
  - `POST /api/nodes`
  - `POST /api/paths`
  - `POST /api/campus/publish`
- **Database Operations**:
  - `Room.create(...)`
  - `NavNode.create(...)`
  - `NavPath.create(...)`
- **Success Flow**: Vector stored -> published -> active mobile devices reload maps via WebSockets.
- **Failure Flow**: Validation check fails (e.g. self-intersecting polygon) -> error toast displayed -> changes rolled back.
