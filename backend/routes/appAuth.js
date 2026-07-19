const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const AppUser = require('../models/AppUser');
const { JWT_SECRET } = require('../utils/auth');
const { validateBody } = require('../middleware/inputValidator');
const { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema, profileUpdateSchema } = require('../middleware/schemas');

// ─── POST /api/app-auth/register ───────────────────────────────────────────
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { username, mobileNumber, password, collegeEmail, collegeId, isStudent, department, semester, section } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (isStudent && !collegeEmail) {
      return res.status(400).json({ error: 'College Email is required for students' });
    }
    if (!isStudent && !mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required for regular users' });
    }

    // Check if user already exists
    let finalUsername = username;
    if (isStudent) {
      finalUsername = `stu_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    const existingConditions = [];
    if (!isStudent) {
      existingConditions.push({ username: finalUsername });
    }
    if (mobileNumber) existingConditions.push({ mobileNumber });
    if (collegeEmail) existingConditions.push({ collegeEmail });

    let existingUser = null;
    if (existingConditions.length > 0) {
      existingUser = await AppUser.findOne({ $or: existingConditions });
    }

    if (existingUser) {
      if (mobileNumber && existingUser.mobileNumber === mobileNumber) {
        return res.status(400).json({ error: 'Mobile number already registered' });
      }
      if (collegeEmail && existingUser.collegeEmail === collegeEmail) {
        return res.status(400).json({ error: 'College Email already registered' });
      }
      if (!isStudent && existingUser.username === finalUsername) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      return res.status(400).json({ error: 'User details already exist' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new AppUser({
      username: finalUsername,
      fullName: isStudent ? username : undefined,
      mobileNumber: mobileNumber || undefined,
      password: hashedPassword,
      collegeEmail,
      collegeId,
      rollNumber: isStudent ? (collegeId || undefined) : undefined,
      role: isStudent ? 'student' : 'guest',
      department: isStudent ? (department || 'CSE') : undefined,
      semester: isStudent ? (semester || '3') : undefined,
      section: isStudent ? (section || 'A') : undefined
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign({ userId: newUser._id, username: newUser.username, fullName: newUser.fullName }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        fullName: newUser.fullName,
        mobileNumber: newUser.mobileNumber,
        profileImage: newUser.profileImage,
        role: newUser.role,
        department: newUser.department,
        semester: newUser.semester,
        section: newUser.section,
        collegeEmail: newUser.collegeEmail,
        collegeId: newUser.collegeId,
        rollNumber: newUser.rollNumber
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/app-auth/login ──────────────────────────────────────────────
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password, isStudent, collegeEmail, collegeId } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Please provide a password' });
    }

    let user;
    if (isStudent) {
      if (!collegeEmail) {
        return res.status(400).json({ error: 'College Email is required for student login' });
      }
      user = await AppUser.findOne({ collegeEmail });
      // If a student tries to login, make sure they actually registered as a student.
      if (user && user.role !== 'student') {
         return res.status(401).json({ error: 'This account is not a student account. Try regular login.' });
      }
    } else {
      if (!identifier) {
        return res.status(400).json({ error: 'Please provide credentials' });
      }
      user = await AppUser.findOne({
        $or: [
          { username: identifier },
          { mobileNumber: identifier }
        ]
      });
      if (user && user.role === 'student') {
        return res.status(401).json({ error: 'This account is a student account. Please use Student login.' });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        profileImage: user.profileImage,
        role: user.role,
        department: user.department,
        semester: user.semester,
        section: user.section,
        collegeEmail: user.collegeEmail,
        collegeId: user.collegeId,
        rollNumber: user.rollNumber
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/app-auth/me ──────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await AppUser.findById(decoded.userId).select('-password');
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.isGuest && user.guestStatus !== 'active') {
      return res.status(401).json({ error: 'Guest session expired or deactivated' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ─── POST /api/app-auth/update-profile ─────────────────────────────────────────
router.post('/update-profile', validateBody(profileUpdateSchema), async (req, res, next) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fullName, mobileNumber, profileImage } = req.body;

    if (fullName) user.fullName = fullName;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/app-auth/request-otp ──────────────────────────────────────────
router.post('/request-otp', validateBody(otpRequestSchema), async (req, res, next) => {
  try {
    const { isStudent, mobileNumber, collegeEmail } = req.body;
    
    let user;
    if (isStudent) {
      if (!collegeEmail) return res.status(400).json({ error: 'College Email is required' });
      user = await AppUser.findOne({ collegeEmail });
      if (!user) return res.status(404).json({ error: 'User not found with this college email' });
    } else {
      if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });
      user = await AppUser.findOne({ mobileNumber });
      if (!user) return res.status(404).json({ error: 'User not found with this mobile number' });
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Simulating sending SMS/Email by printing to backend logs
    console.log(`\n========================================`);
    if (isStudent) {
      console.log(`[NavX EMAIL MOCK] To: ${collegeEmail} (Outlook)`);
    } else {
      console.log(`[NavX SMS MOCK] To: ${mobileNumber}`);
    }
    console.log(`Your NavX password reset OTP is: ${otpCode}`);
    console.log(`========================================\n`);

    // Returning devOtp in the response for frontend dev Alert
    res.json({ success: true, message: `OTP sent successfully to ${isStudent ? 'your email' : 'your mobile'}`, devOtp: otpCode });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/app-auth/verify-otp ───────────────────────────────────────────
router.post('/verify-otp', validateBody(otpVerifySchema), async (req, res, next) => {
  try {
    const { isStudent, mobileNumber, collegeEmail, otpCode, newPassword } = req.body;
    
    if (!otpCode || !newPassword) {
      return res.status(400).json({ error: 'OTP and new password are required' });
    }

    let user;
    if (isStudent) {
      if (!collegeEmail) return res.status(400).json({ error: 'College Email is required' });
      user = await AppUser.findOne({ collegeEmail });
    } else {
      if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });
      user = await AppUser.findOne({ mobileNumber });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.otpCode !== otpCode) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
const getAuthUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await AppUser.findById(decoded.userId);
    if (user && user.isGuest && user.guestStatus !== 'active') {
      return null;
    }
    return user;
  } catch (err) {
    return null;
  }
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ─── POST /api/app-auth/guest-login ──────────────────────────────────────────
router.post('/guest-login', async (req, res, next) => {
  try {
    // 1. Find and atomically lock an existing inactive guest user to recycle
    let guest = await AppUser.findOneAndUpdate(
      { isGuest: true, guestStatus: 'inactive' },
      { $set: { guestStatus: 'active', lastHeartbeat: new Date(), activeCampusId: null } },
      { new: true }
    );
    const tempPassword = Math.random().toString(36).substring(2, 10);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    if (guest) {
      // Recycle the guest user (now already locked as active, update password)
      guest.password = hashedPassword;
      await guest.save();
      console.log(`[Guest Login] Recycled inactive guest user: ${guest.username}`);
    } else {
      // Generate unique credentials if none exist in the inactive pool
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      const username = `guest_${timestamp}_${randomSuffix}`;
      const mobileNumber = `guest_mob_${timestamp}_${randomSuffix}`;

      guest = new AppUser({
        username,
        mobileNumber,
        password: hashedPassword,
        isGuest: true,
        guestStatus: 'active',
        lastHeartbeat: new Date(),
        activeCampusId: null
      });
      await guest.save();
      console.log(`[Guest Login] Created new guest user: ${username}`);
    }

    // Generate JWT token containing guest claims
    const token = jwt.sign(
      { userId: guest._id, username: guest.username, isGuest: true },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: guest._id,
        username: guest.username,
        mobileNumber: guest.mobileNumber,
        isGuest: true,
        guestStatus: guest.guestStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/app-auth/guest-logout ─────────────────────────────────────────
router.post('/guest-logout', async (req, res, next) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.isGuest) {
      user.guestStatus = 'inactive';
      user.activeCampusId = null;
      user.lastHeartbeat = null;
      // Scramble password to make session invalid
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(Math.random().toString(36), salt);
      await user.save();
      console.log(`[Guest Logout] Manual guest logout, user recycled: ${user.username}`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/app-auth/heartbeat ────────────────────────────────────────────
router.post('/heartbeat', async (req, res, next) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Registered users can update, but we only check boundaries/expiry for guests
    if (!user.isGuest) {
      return res.json({ success: true, active: true });
    }

    const { location, campusId } = req.body;
    user.lastHeartbeat = new Date();
    if (campusId) {
      user.activeCampusId = campusId;
    }

    // Geofencing verification
    const activeCampusId = user.activeCampusId;
    if (activeCampusId && location && location.lat && location.lng) {
      const Campus = require('../models/Campus');
      const campus = await Campus.findById(activeCampusId);
      if (campus && campus.location && campus.location.lat && campus.location.lng) {
        const dist = haversine(
          location.lat,
          location.lng,
          campus.location.lat,
          campus.location.lng
        );
        const radiusLimit = (campus.radius || 500) + 20; // 20m buffer

        if (dist > radiusLimit) {
          console.log(`[Guest Heartbeat] Guest ${user.username} exited campus boundary: ${Math.round(dist)}m > ${radiusLimit}m. Deactivating.`);
          user.guestStatus = 'inactive';
          user.activeCampusId = null;
          user.lastHeartbeat = null;
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(Math.random().toString(36), salt);
          await user.save();

          return res.json({ success: true, active: false, reason: 'exited_geofence' });
        }
      }
    }

    await user.save();
    res.json({ success: true, active: true });
  } catch (error) {
    next(error);
  }
});

// ─── BACKGROUND GUEST RECYCLING LOOP ──────────────────────────────────────────
setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
    // Recycle active guests with lastHeartbeat older than 12 hours
    const expiredGuests = await AppUser.find({
      isGuest: true,
      guestStatus: 'active',
      $or: [
        { lastHeartbeat: { $lt: threshold } },
        { lastHeartbeat: null }
      ]
    });

    for (const guest of expiredGuests) {
      console.log(`[Background Recycler] Auto-recycling guest: ${guest.username} due to heartbeat timeout.`);
      guest.guestStatus = 'inactive';
      guest.activeCampusId = null;
      guest.lastHeartbeat = null;
      const salt = await bcrypt.genSalt(10);
      guest.password = await bcrypt.hash(Math.random().toString(36), salt);
      await guest.save();
    }
  } catch (err) {
    console.error('Background guest recycler loop error:', err);
  }
}, 30000);

module.exports = router;
