# Engineering & Architecture Decisions

This document records the critical architectural design decisions made during the lifecycle of the NavX project.

---

## 1. Hybrid Indoor Map Rendering via Leaflet in WebViews

- **Decision**: Render custom maps using Leaflet.js inside React Native `WebView` components instead of using native mapping SDKs (e.g. Mapbox SDK or Google Maps SDK).
- **Reason**: Custom indoor vectors (polygons for rooms, nodes, routes) require high customization. Leaflet offers straightforward support for vector geometries, tooltip bindings, custom markers, and SVG manipulation. It allows shared map-rendering logic and markup templates between the React Native user client and React web admin map editor.
- **Benefits**:
  - High developer velocity through code sharing.
  - Cross-platform parity (iOS, Android, and Web Admin render the exact same Mapbox street tiles and campus overlays).
  - Simpler dynamic styling (Leaflet CSS maps).
- **Impact**: WebView container overhead is mitigated by keeping maps lightweight and optimizing custom SVG/GeoJSON rendering pipelines.

---

## 2. Dynamic Guest Auth with GPS Geofencing Verification

- **Decision**: Implement access control that permits Guest accounts to sign in *only* when they are physically present at the campus entrance.
- **Reason**: To protect campus maps, rooms layouts, and internal updates from remote database crawlers or unauthorized scrapers.
- **Benefits**:
  - Enhanced venue security.
  - Self-service onboarding for students/visitors on-premise without manual sign-up workflows.
- **Impact**: Requires continuous background location checks (`Location.watchPositionAsync`), which automatically logs guest accounts out if they leave the campus boundaries.

---

## 3. Client-Side Offline Pathfinding Execution

- **Decision**: Perform Dijkstra and A* route calculation logic directly on the mobile app client using local nodes and paths.
- **Reason**: Indoor navigation must work inside basements, stairwells, and areas with weak cellular coverage where network connectivity is intermittent.
- **Benefits**:
  - 100% offline navigation capability once campus map files are downloaded.
  - No server routing latency during active navigation steps.
- **Impact**: Requires downloading and storing the campus map nodes/paths array in `AsyncStorage` when the user enters the campus (via `downloadCampusOffline`).

---

## 4. MongoDB Document Datastore with Mongoose ODM

- **Decision**: Use MongoDB as the main database alongside the Mongoose Object Document Mapper.
- **Reason**: Campuses, hospitals, airports, and malls have highly polymorphic data formats. MongoDB's schema-less document structure allows rooms, campaigns, and blocks to store variable dimensions, attributes, and tags without complex SQL JOIN queries or migration scripts.
- **Benefits**:
  - Rapid schema iterations.
  - Native GeoJSON validation helper libraries.
- **Impact**: Demands strict application-level schema validations in Mongoose models to prevent dirty database states.
