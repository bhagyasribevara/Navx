# Known Mistakes, Bugs & Technical Debt

This document tracks known issues, technical debt, and refactoring opportunities in the NavX workspace.

---

## 1. Hardcoded Default Coordinates Fallback

- **Issue**: Map defaults to GMRIT coordinates `[18.4665, 83.6629]` when the user has scanned another campus (e.g. SRM).
- **Affected Area**: `MapScreen.js`, `LiveMeetScreen.js`, `NavigationScreen.js`, `ARScreen.js`.
- **Cause**: The Leaflet map initialization HTML string had GMRIT coordinates hardcoded as the default fallback when variables were loading.
- **Recommended Fix**: Resolved by retrieving active campus location dynamically from the geofence context and from `getCampusByQR(campusId)` with cached offline options.
- **Priority**: High (Resolved).

---

## 2. WebView Rebuilding Overhead

- **Issue**: Any updates to the route or floor maps rebuild the entire HTML source code in `useMemo` hooks, triggering a flash and reload of the WebView.
- **Affected Area**: `MapScreen.js`, `NavigationScreen.js`.
- **Cause**: Re-evaluating HTML string payloads forces the WebView component to reload from scratch instead of modifying the DOM elements.
- **Recommended Fix**: Move map state modifications to javascript injections using `injectJavaScript(...)` to dynamically call functions (e.g. `window.updateGeoJSON`, `window.panTo`) without reloading the page.
- **Priority**: High (Completed/Ongoing).

---

## 3. Local Development Host IP Address Binding

- **Issue**: Developers testing on physical Android devices cannot connect to `localhost:5001`.
- **Affected Area**: `user/src/api.js`.
- **Cause**: Physical devices do not map `localhost` to the host computer's loopback interface.
- **Recommended Fix**: Use `expo-constants` to extract the network host IP dynamically (`Constants.expoConfig.hostUri.split(':')[0]`).
- **Priority**: Medium (Resolved).

---

## 4. Heavy Array Operations in Client-Side Pathfinding
 
 - **Issue**: Dijkstra and A* pathfinding scan large arrays of nodes, which causes UI freezing or frame drops on low-end devices during long-distance campus routing.
 - **Affected Area**: `user/src/utils/pathfinding.js`.
 - **Cause**: Pathfinding algorithms run on the React Native JS thread, blocking rendering cycles.
 - **Recommended Fix**: Offload pathfinding computations to React Native Web Workers or perform them on the backend when network connectivity is solid, using client calculations only as a fallback.
 - **Priority**: Medium.
