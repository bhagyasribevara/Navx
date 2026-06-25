# AI Skill - Creating a New Express API Endpoint

This document outlines the standard procedure for implementing a new REST API endpoint in the NavX backend database system.

---

## Step 1: Create the Route File or Add to Existing
If creating a new endpoint group (e.g. `/api/announcements`), create a file under `backend/routes/announcements.js`:
```javascript
const router = require('express').Router();
const Announcement = require('../models/Announcement');
const { authenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all active announcements for a campus
router.get('/campus/:campusId', async (req, res) => {
  try {
    const { campusId } = req.params;
    const list = await Announcement.find({ campusId, isActive: true });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

module.exports = router;
```

---

## Step 2: Register in `server.js`
Open `backend/server.js` and mount the router:
```javascript
app.use('/api/announcements', require('./routes/announcements'));
```

---

## Step 3: Implement Authorization Guard
- For public/user endpoints: Use `authenticateJWT` if the endpoint requires guest validation.
- For tenant admin endpoints: Apply role checking (`req.admin.role === 'Admin'`) or utilize `enforceCampusIsolation` to check that the campus ID query parameter matches the admin's tenant campus constraints.
