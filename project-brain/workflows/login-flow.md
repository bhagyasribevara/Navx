# Business Workflow - Login Flow

This document details how admin users and registered app users authenticate on the platform.

---

## 1. Web Console Admin Login Flow
Admin login is cookie-based using secure tokens to authorize administrative panels access.

### Workflow Details
- **Trigger**: Entering email/password credentials in the web dashboard login screen.
- **Steps**:
  1. User submits login form.
  2. Server queries the `Admin` collection by username.
  3. Server compares the hashed password utilizing `bcrypt.compare()`.
  4. Server signs a secure JWT session payload containing role and campus isolation limits.
  5. Server sets a secure `token` cookie (`httpOnly: true, secure: true, maxAge: 24h`).
- **APIs Involved**: `POST /api/admin/login`
- **Database Operations**: `Admin.findOne({ username })`
- **Success Flow**: JWT cookie set -> user redirected to `/dashboard`.
- **Failure Flow**: Incorrect password -> returns HTTP 401 with "Invalid credentials" error.

---

## 2. Mobile User Login Flow
Mobile users authenticate using standard bearer tokens stored in AsyncStorage.

### Workflow Details
- **Trigger**: Submitting the login form on the mobile application auth screen.
- **Steps**:
  1. Client posts credentials to `/api/app-auth/login`.
  2. Server compares credentials against `AppUser` records.
  3. Server signs JWT token.
  4. Client stores the token locally and configures Axios headers.
- **APIs Involved**: `POST /api/app-auth/login`
- **Database Operations**: `AppUser.findOne({ email })`
- **Success Flow**: Token received -> stored in `AsyncStorage` -> navigates to MainTabs.
- **Failure Flow**: Network error or bad password -> alerts client -> displays text label.
