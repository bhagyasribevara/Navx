const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const AppUser = require('../models/AppUser');

const JWT_SECRET = process.env.JWT_SECRET || 'navx_fallback_secret_key_2025';

// ─── POST /api/app-auth/register ───────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, mobileNumber, password } = req.body;

    if (!username || !password || !mobileNumber) {
      return res.status(400).json({ error: 'Username, mobile number, and password are required' });
    }

    // Check if user already exists
    const existingUser = await AppUser.findOne({ 
      $or: [
        { username: username },
        { mobileNumber: mobileNumber }
      ] 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Mobile Number already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new AppUser({
      username,
      mobileNumber,
      password: hashedPassword
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign({ userId: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: { id: newUser._id, username: newUser.username, mobileNumber: newUser.mobileNumber }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/app-auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be username or mobile

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide credentials' });
    }

    // Find user
    const user = await AppUser.findOne({
      $or: [
        { username: identifier },
        { mobileNumber: identifier }
      ]
    });

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
      user: { id: user._id, username: user.username, mobileNumber: user.mobileNumber }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/app-auth/me ──────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await AppUser.findById(decoded.userId).select('-password');
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ─── POST /api/app-auth/request-otp ──────────────────────────────────────────
router.post('/request-otp', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });

    const user = await AppUser.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ error: 'User not found with this mobile number' });

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Simulating sending SMS by printing to backend logs
    console.log(`\n========================================`);
    console.log(`[NavX SMS MOCK] To: ${mobileNumber}`);
    console.log(`Your NavX password reset OTP is: ${otpCode}`);
    console.log(`========================================\n`);

    // Returning devOtp in the response for frontend dev Alert
    res.json({ success: true, message: 'OTP simulated successfully', devOtp: otpCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/app-auth/verify-otp ───────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobileNumber, otpCode, newPassword } = req.body;
    if (!mobileNumber || !otpCode || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await AppUser.findOne({ mobileNumber });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
