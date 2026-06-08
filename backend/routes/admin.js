const router = require('express').Router();
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Campus = require('../models/Campus');
const { generateTokens, authenticateJWT, verifyRefreshToken, authLimiter } = require('../utils/auth');

// POST /login (Phase 4, 5, 12 - with Rate Limiting)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Auto-create SuperAdmin if no admins exist
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      if (username === 'superadmin' && password === 'admin123') {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newSuper = new Admin({ 
          username, 
          password: password, // For legacy compatibility
          passwordHash: hashedPassword, 
          role: 'SuperAdmin' 
        });
        await newSuper.save();
        
        const tokens = generateTokens(newSuper);
        setTokenCookies(res, tokens);

        return res.json({ 
          success: true, 
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          admin: { _id: newSuper._id, username: newSuper.username, role: newSuper.role } 
        });
      }
    }

    const admin = await Admin.findOne({ username });
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }
    
    // Validate password (supports legacy plain-text and hashed passwords)
    let isMatch = false;
    if (admin.passwordHash) {
      isMatch = bcrypt.compareSync(password, admin.passwordHash);
    } else {
      isMatch = admin.password === password;
      // Auto-upgrade legacy password to hash
      if (isMatch) {
        admin.passwordHash = bcrypt.hashSync(password, 10);
        await admin.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    let campusDetails = null;
    if (admin.campusId) {
      campusDetails = await Campus.findById(admin.campusId);
    }
    
    const tokens = generateTokens(admin);
    setTokenCookies(res, tokens);

    res.json({
      success: true,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role,
        campusId: admin.campusId,
        campus: campusDetails,
        managedVenueType: admin.managedVenueType || campusDetails?.venueType || 'campus'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /refresh (Phase 4, 12)
router.post('/refresh', async (req, res) => {
  try {
    let refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const admin = await verifyRefreshToken(refreshToken);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokens = generateTokens(admin);
    setTokenCookies(res, tokens);

    res.json({
      success: true,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /logout (Phase 5)
router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /create-campus-admin (Phase 2, 12 - SuperAdmin only)
router.post('/create-campus-admin', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized. Only SuperAdmin can perform this operation.' });
    }

    const { newUsername, newPassword, campusName, campusAddress, venueType, campusCode } = req.body;

    if (!campusCode) {
      return res.status(400).json({ error: 'Campus Code is required' });
    }
    
    // Validate campusCode format (Phase 12: Input Validation)
    const codeRegex = /^[a-z0-9-_]+$/;
    if (!codeRegex.test(campusCode)) {
      return res.status(400).json({ error: 'Campus Code must contain only lowercase letters, numbers, hyphens, and underscores.' });
    }

    const existingCode = await Campus.findOne({ campusCode });
    if (existingCode) {
      return res.status(400).json({ error: `Campus Code '${campusCode}' is already in use. Please select a unique code.` });
    }

    const resolvedVenueType = venueType || 'campus';

    // Create the venue first
    let campus = await Campus.findOne({ name: campusName });
    const hostBase = process.env.ADMIN_URL_BASE || 'https://admin.navx.com';
    const adminUrl = `${hostBase}/campus/${campusCode}`;

    if (!campus) {
      campus = new Campus({ 
        name: campusName, 
        campusName: campusName,
        campusCode: campusCode,
        adminUrl: adminUrl,
        address: campusAddress, 
        venueType: resolvedVenueType 
      });
      await campus.save();
    } else {
      // Update campus fields if it already exists
      campus.campusName = campusName;
      campus.campusCode = campusCode;
      campus.adminUrl = adminUrl;
      campus.venueType = resolvedVenueType;
      await campus.save();
    }
    
    // Create the admin
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const newAdmin = new Admin({
      username: newUsername,
      password: newPassword, // For compatibility
      passwordHash: hashedPassword,
      role: 'campus_admin',
      campusId: campus._id,
      managedVenueType: resolvedVenueType,
      status: 'active'
    });
    
    await newAdmin.save();

    // Link admin back to campus
    campus.adminId = newAdmin._id;
    await campus.save();
    
    res.status(201).json({ success: true, admin: newAdmin, campus });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Admin username or Campus name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET all admins (SuperAdmin only)
router.get('/admins/:superAdminId', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    const admins = await Admin.find().populate('campusId');
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE admin (SuperAdmin only)
router.delete('/admins/:superAdminId/:adminId', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const adminToDelete = await Admin.findById(req.params.adminId);
    if (!adminToDelete) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    if (adminToDelete.role === 'SuperAdmin') {
      return res.status(403).json({ error: 'Cannot delete a SuperAdmin.' });
    }

    // Unlink admin from campus
    if (adminToDelete.campusId) {
      await Campus.findByIdAndUpdate(adminToDelete.campusId, { adminId: null, adminUrl: '' });
    }

    await Admin.findByIdAndDelete(req.params.adminId);
    res.json({ success: true, message: 'Admin deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update admin details (SuperAdmin only)
router.put('/admins/:superAdminId/:adminId', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { username, password } = req.body;
    const adminToUpdate = await Admin.findById(req.params.adminId);
    
    if (!adminToUpdate) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    if (username) adminToUpdate.username = username;
    if (password) {
      adminToUpdate.password = password;
      adminToUpdate.passwordHash = bcrypt.hashSync(password, 10);
      adminToUpdate.sessionVersion += 1; // Invalidate current session on password change
    }

    await adminToUpdate.save();
    res.json({ success: true, admin: adminToUpdate });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /admins/:adminId/status (SuperAdmin only - toggle active/disabled)
router.post('/admins/:adminId/status', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const admin = await Admin.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });

    admin.status = status;
    if (status === 'disabled') {
      admin.sessionVersion += 1; // Revoke active sessions instantly
    }
    await admin.save();

    res.json({ success: true, message: `Admin account has been ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admins/:adminId/revoke (SuperAdmin only - Session Revocation)
router.post('/admins/:adminId/revoke', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const admin = await Admin.findById(req.params.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });

    admin.sessionVersion += 1;
    await admin.save();

    res.json({ success: true, message: 'All active sessions for this admin have been revoked.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: set secure tokens inside cookies
function setTokenCookies(res, tokens) {
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

module.exports = router;
