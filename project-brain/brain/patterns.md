# Codebase Patterns & Development Standards

This document describes the key software engineering patterns, coding styles, and development conventions followed across the NavX project.

---

## 1. Component Patterns

### React & React Native Functional Components
- Components are written as functional components using standard React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`).
- Context patterns are used for global states:
  - `AuthContext`: User token, profile info.
  - `GeofenceContext`: Active campus, location tracking.
- Client-side data fetching uses `useFocusEffect` (on React Native) and standard `useEffect` lifecycle triggers on web.

---

## 2. API Patterns

### REST Endpoints
- REST APIs are designed in route files (e.g. `/api/rooms`, `/api/campus`).
- Response payloads are uniform JSON objects:
  - Success responses return the document or array directly, or `{ success: true, ... }`.
  - Failure responses return HTTP error statuses with a payload of `{ error: "Error Name", message: "Error message details" }`.

### Axios Wrapper
- Defined in `src/api.js` (both user and admin directories).
- Features dynamic hostname resolution for React Native testing (resolving to standard localhost vs. Expo's host URI on physical devices).

---

## 3. Database Patterns (MongoDB / Mongoose)
- Every data resource maps to a dedicated Mongoose Schema file under `backend/models/`.
- Schema files export a compiled model, e.g. `module.exports = mongoose.model('Room', roomSchema)`.
- Indices are configured explicitly for search performance:
  - `campusId` is indexed across Blocks, Floors, Rooms, Nodes, Paths, and QRCodes.
  - Case-insensitive lookups (e.g. `campusCode` or `code`) use lowercased indexed strings.
- Object relationships are modeled using Mongoose references (`ref: 'Campus'`) and loaded dynamically via query population hooks (`.populate('floorId')`).

---

## 4. Authentication & Security Patterns
- **User Client**: Stores JWT tokens in `AsyncStorage` and includes them inside request header `Authorization: Bearer <token>`.
- **Admin Console**: Sets secure, HttpOnly cookies for session verification using `cookie-parser` middleware.
- **Middleware Guard**: Express route files require `authenticateJWT` validation middleware, and route handlers check user roles (`req.admin.role === 'SuperAdmin'`) or enforce campus isolation (`enforceCampusIsolation` helper).

---

## 5. Error Handling Patterns

### Backend Server
- Global error boundary middleware in `server.js` catches unhandled exceptions and outputs JSON format:
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});
```

### Client Frontend
- Safe calls wrapped in `try/catch` statements showing user-facing alerts (e.g. Toasts in Web Admin, Alert dialogs or custom `deniedCard` panels in Mobile Client).
- Graceful API fallbacks: if an API call fails due to connection issues, the app falls back to AsyncStorage cached payloads (such as offline map hierarchies).

---

## 6. Naming & Folder Conventions
- **Variables & Functions**: camelCase (e.g. `selectedFloor`, `onRefresh`).
- **Files & Components**: PascalCase for React components (e.g. `MapScreen.js`), camelCase or lowercase for utility/routes (e.g. `appAuth.js`, `pathfinding.js`).
- **Endpoints**: lowercase nouns, pluralized resource mappings (e.g. `GET /api/rooms`, `POST /api/blocks`).
