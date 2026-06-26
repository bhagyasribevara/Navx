# Business Workflow - Live Meet Session Flow

This document details the real-time coordinator sharing workflow between two users on campus.

---

## Workflow Details

- **Trigger**: Selecting "Create Live Meet" or joining via code/invite URI in the user app.
- **Steps**:
  1. Creator triggers `handleCreateMeet`, fetching GPS coordinates.
  2. Client calls `/api/meet/create` with user location and duration specifications.
  3. Server creates a `LiveMeetSession` and returns a room session code.
  4. Client connects to WebSocket namespace and emits `join_campus` with session ID.
  5. Recipient clicks the invite link (e.g. `navx://meet/:sessionId`), joins the session, and connects to the same WebSocket room.
  6. Both clients continuously track location coordinates, emitting movement updates over WebSocket.
  7. Map HTML Leaflet layers listen to WebSocket broadcasts and update positions in real-time.
- **APIs Involved**:
  - `POST /api/meet/create`
  - `POST /api/meet/join/:sessionId`
  - WebSocket: `join_campus` (room event), coordinates sync event.
- **Database Operations**:
  - `LiveMeetSession.create(...)`
  - `LiveMeetSession.findByIdAndUpdate(...)`
- **Success Flow**: WebSockets established -> real-time markers rendered -> meeting routes resolved.
- **Failure Flow**: Session expires or host exits -> WebSocket room closed -> users returned to HomeScreen.
