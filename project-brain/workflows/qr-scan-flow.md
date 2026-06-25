# Business Workflow - Entrance QR Verification Flow

This document maps how scanning physical campus entrance QR codes unlocks mapping services.

---

## Workflow Details

- **Trigger**: Pointing the mobile camera at a registered entrance QR code in `QRScanScreen.js`.
- **Steps**:
  1. Camera scans code, resolving code data (e.g. `navx://campus/<id>`).
  2. Mobile client fetches user's current GPS location coordinates via `Location.getCurrentPositionAsync()`.
  3. Client posts the campus ID and GPS coordinates to the server verification route.
  4. Server calculates the Haversine distance between user's GPS coords and the registered campus center.
  5. If user distance is within range of the configured campus boundary radius, the server authorizes access.
  6. Client saves the resolved campus payload to context state (`activateCampus`) and AsyncStorage (`navx_active_campus`), and transitions home.
- **APIs Involved**: `POST /api/campus/qr/:campusId/verify`
- **Database Operations**: `Campus.findById(campusId)`
- **Success Flow**: Verified -> Campus unlocked -> transition to HomeScreen.
- **Failure Flow**: Distance exceeds radius -> access denied panel shown with difference metrics.
