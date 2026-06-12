const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'navx_super_secret_access_key_123';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'navx_super_secret_refresh_key_987';

// Rate Limiter for Authentication endpoints (Phase 12: Security)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generate JWT tokens
const generateTokens = (admin) => {
  const payload = {
    id: admin._id,
    username: admin.username,
    role: admin.role,
    campusId: admin.campusId,
    sessionVersion: admin.sessionVersion || 1
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: admin._id, sessionVersion: admin.sessionVersion || 1 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// Authenticate JWT middleware (Phase 4, 5, 12)
const authenticateJWT = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Session invalid. User not found.' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ error: 'Your account has been disabled.' });
    }

    if (admin.sessionVersion !== decoded.sessionVersion) {
      return res.status(401).json({ error: 'Session revoked. Please log in again.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Optional JWT authentication for public-facing GET endpoints
const optionalAuthenticateJWT = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(); // Continue as public guest
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (admin && admin.status === 'active' && admin.sessionVersion === decoded.sessionVersion) {
      req.admin = admin;
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    // If token is invalid for other reasons, fallback to public guest silently
    next();
  }
};

// Verify Refresh Token Helper
const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.status !== 'active' || admin.sessionVersion !== decoded.sessionVersion) {
      return null;
    }
    return admin;
  } catch (err) {
    return null;
  }
};

// Dynamic Campus Isolation Middleware (Phase 6: Campus Data Isolation)
const enforceCampusIsolation = async (req, res, next) => {
  // 1. Enforce constraints on anonymous public users
  if (!req.admin) {
    if (req.method === 'GET') {
      // Require campusId in query filters for public endpoints (to prevent cross-campus data leakage)
      const bypassPublicRoutes = ['/api/campus', '/api/weather', '/api/ai'];
      const isBypassed = bypassPublicRoutes.some(route => req.baseUrl.startsWith(route));
      
      if (!isBypassed && !req.params.id && !req.query.campusId) {
        const mongoose = require('mongoose');
        if (req.query.blockId && mongoose.Types.ObjectId.isValid(req.query.blockId)) {
          try {
            const Block = require('../models/Block');
            const block = await Block.findById(req.query.blockId);
            if (block) {
              req.query.campusId = block.campusId.toString();
            }
          } catch (e) {}
        } else if (req.query.floorId && req.query.floorId !== 'null' && mongoose.Types.ObjectId.isValid(req.query.floorId)) {
          try {
            const Floor = require('../models/Floor');
            const floor = await Floor.findById(req.query.floorId);
            if (floor) {
              req.query.campusId = floor.campusId.toString();
            }
          } catch (e) {}
        }
      }
      
      if (!isBypassed && !req.params.id && !req.query.campusId) {
        return res.status(400).json({ error: 'campusId parameter is required for this query.' });
      }
      return next();
    }
    return res.status(401).json({ error: 'Authentication required for modifying data.' });
  }

  // 2. SuperAdmin has unrestricted access
  if (req.admin.role === 'SuperAdmin') {
    return next();
  }

  // 3. campus_admin constraints
  const adminCampusId = req.admin.campusId ? req.admin.campusId.toString() : null;
  if (!adminCampusId) {
    return res.status(403).json({ error: 'Access Denied: No campus assigned to this account.' });
  }

  // Overwrite request filters/body to lock them to the assigned campus (Phase 12)
  if (req.method === 'GET') {
    if (req.query.campusId && req.query.campusId !== adminCampusId) {
      return res.status(403).json({ error: 'Access Denied: You cannot view data from another campus.' });
    }
    req.query.campusId = adminCampusId;
  }

  if (req.method === 'POST') {
    if (req.body.campusId && req.body.campusId !== adminCampusId) {
      return res.status(403).json({ error: 'Access Denied: You cannot write data for another campus.' });
    }
    req.body.campusId = adminCampusId;
  }

  // Verify URL ID parameter documents belong to this admin's campus (GET /:id, PUT /:id, DELETE /:id)
  if (req.params.id) {
    const ModelMap = {
      '/api/blocks': require('../models/Block'),
      '/api/rooms': require('../models/Room'),
      '/api/floors': require('../models/Floor'),
      '/api/nodes': require('../models/NavNode'),
      '/api/paths': require('../models/NavPath'),
      '/api/campaigns': require('../models/Campaign'),
      '/api/qrcodes': require('../models/QRCode'),
      '/api/beacons': require('../models/Beacon'),
      '/api/mapLayers': require('../models/MapLayer'),
      '/api/analytics': require('../models/Analytics'),
      '/api/campus': require('../models/Campus'),
      '/api/landmarks': require('../models/Landmark'),
      '/api/announcements': require('../models/Announcement'),
      '/api/navigationGraphs': require('../models/NavigationGraph')
    };

    const matchedBaseUrl = Object.keys(ModelMap).find(base => req.baseUrl.startsWith(base));
    const Model = ModelMap[matchedBaseUrl];

    if (Model) {
      try {
        const doc = await Model.findById(req.params.id);
        if (doc) {
          const docCampusId = doc.campusId ? doc.campusId.toString() : (doc._id.toString() === adminCampusId ? adminCampusId : null);
          if (docCampusId !== adminCampusId) {
            return res.status(403).json({ error: 'Access Denied: Document belongs to another campus.' });
          }
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid reference ID or query error.' });
      }
    }
  }

  next();
};

module.exports = {
  authLimiter,
  generateTokens,
  authenticateJWT,
  optionalAuthenticateJWT,
  verifyRefreshToken,
  enforceCampusIsolation,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};
