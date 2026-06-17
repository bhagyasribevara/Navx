const mongoose = require('mongoose');

const AppUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true, // Mandatory for OTP
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  otpCode: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  guestStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  },
  lastHeartbeat: {
    type: Date,
    default: null
  },
  activeCampusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    default: null
  }
});

module.exports = mongoose.model('AppUser', AppUserSchema);
