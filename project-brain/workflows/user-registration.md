# Business Workflow - User Registration & Onboarding

This document details the business and database workflows for onboarding new users.

---

## 1. Guest Registration Flow (Mobile App)
Mobile guest users do not complete username/password sign-up forms. Instead, they scan entrance QR codes, which automatically registers a guest session mapped to their current coordinates.

### Workflow Details
- **Trigger**: Scanning a campus QR code.
- **Steps**:
  1. Client sends coordinates + campus ID to `/api/app-auth/register-guest`.
  2. Server verifies coordinates are within range of campus boundaries.
  3. Server creates a temporary `AppUser` document marked `isGuest: true`.
  4. Server signs a guest JWT token.
  5. Client stores token and unlocks the navigation modules.
- **APIs Involved**: `POST /api/app-auth/register-guest`
- **Database Operations**: `AppUser.create({ username, isGuest: true, currentCampus: campusId })`
- **Success Flow**: JWT token returned -> stored in `AsyncStorage` -> transitions to HomeScreen.
- **Failure Flow**: Coordinates verification fails -> geofence alert shown -> entrance gate remains locked.

---

## 2. Administrator Onboarding Flow (SuperAdmin Console)
SuperAdmins onboarding a new campus must register a corresponding administrator account.

### Workflow Details
- **Trigger**: Submitting the onboarding form on the SuperAdmin panel.
- **Steps**:
  1. SuperAdmin posts admin credentials (username, password, assigned campusId).
  2. Server hashes the password using `bcrypt` (10 salt rounds).
  3. Server creates the `Admin` user document.
  4. Server links `adminId` reference in the `Campus` model.
- **APIs Involved**: `POST /api/admin/onboard`
- **Database Operations**:
  - `Admin.create({ username, passwordHash, role: 'Admin', campusId })`
  - `Campus.findByIdAndUpdate(campusId, { adminId })`
- **Success Flow**: Account created -> onboarding confirmation banner shown -> welcome email links sent.
- **Failure Flow**: Duplicate username/email -> returns HTTP 400 with duplicate warning message.
