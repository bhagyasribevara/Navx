# AI Skill - Applying Authentication & Roles Guard

This guide explains how to secure routes and validate permissions in the NavX API.

---

## 1. Authentication Middleware (`backend/utils/auth.js`)
Apply the `authenticateJWT` middleware to routes to populate the `req.user` (or `req.admin`) payload from request cookies or headers.

```javascript
const { authenticateJWT } = require('../utils/auth');

router.get('/secure-profile', authenticateJWT, (req, res) => {
  res.json({ user: req.user || req.admin });
});
```

---

## 2. Admin Roles Separation
Enforce boundaries inside controller functions by checking `req.admin.role`.

```javascript
router.post('/campus', authenticateJWT, async (req, res) => {
  if (req.admin.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'UNAUTHORIZED', message: 'Only SuperAdmins may create campuses.' });
  }
  // execution...
});
```

---

## 3. Campus Tenant Isolation
Enforce data boundary checks to prevent a campus administrator from reading or updating other campus data coordinates:

```javascript
const { enforceCampusIsolation } = require('../utils/auth');

// Apply Isolation guard as route middleware
router.post('/rooms', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  // Safe execution: campus isolation guarantees campusId matches user's tenant constraints
});
```
