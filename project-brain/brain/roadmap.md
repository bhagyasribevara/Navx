# Project Roadmap & Scaling Recommendations

This document outlines the milestones completed, current focus, and planned items for the NavX platform, as well as recommendations for scaling and optimization.

---

## 1. Development Phases

```
Completed (Auth, Map Vectors, A* Router) 
  --> In Progress (AI Chat overlay, Local caching) 
  --> Planned (BLE Beacon positioning, Evacuation routes)
```

### Completed Milestones
- **Multi-Tenant Onboarding**: SuperAdmin panel to onboard new campuses and generate isolation keys.
- **Visual Map Design**: Geoman-backed vector editor for admins to compile maps.
- **Dynamic Access Boundary**: Geofence checks at entrance coordinates.
- **Client Routing**: A* and Dijkstra pathfinding operations.
- **Real-Time Meet**: Socket.io coordinates sharing.

### In Progress
- **AI Chatbot Optimization**: Contextual prompts refinement.
- **Offline Maps**: Native AsyncStorage sync engine.
- **Map Centering**: dynamic centering based on selected campus details (Resolved).

### Planned
- **Evacuation Guidance**: Shortest path to nearest exits during active alarm state.
- **Bluetooth BLE RSSI Trilateration**: Advanced positioning based on beacon distance calculations.

---

## 2. Scaling Recommendations
- **Redis Query Cache**: Cache static navigation graphs, GeoJSON boundaries, and floors layouts on the backend server.
- **CDN Asset Delivery**: Serve maps graphics, campus banners, and uploaded assets via a Content Delivery Network (e.g. AWS CloudFront, Cloudflare).
- **Read Replicas**: Separate database writes (adding maps, logging analytics) from read queries (fetching maps GeoJSON, searching rooms) by using MongoDB Read Replicas.

---

## 3. Security Improvements
- **Rate Limiting**: Enforce API rate-limiting middleware (`express-rate-limit`) on public auth/scan endpoints to prevent script automation.
- **CSRF Token Validation**: Ensure web admin requests carry CSRF verification tags.
- **Geofence Server Enforcement**: Verify user location coords on all room navigation queries.

---

## 4. Performance Optimizations
- **Web Worker Pathfinding**: Run pathfinding algorithms inside native Web Workers on the user app client to keep React Native UI thread fluid.
- **WebView Layer Pruning**: Crop GeoJSON vectors to only active floor scopes to reduce Leaflet rendering overhead.
- **Socket.io Heartbeat Pings Throttle**: Throttle client coordinates updates in Live Meet sessions to every 500-1000ms.
