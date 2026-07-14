const mongoose = require('mongoose');

const AppUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  fullName: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  mobileNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: true
  },
  collegeEmail: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  collegeId: {
    type: String,
    required: false
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
  },
  role: { 
    type: String, 
    enum: ['student', 'guest', 'regular'], 
    default: 'student' 
  },
  department: { 
    type: String, 
    default: 'CSE' 
  },
  semester: { 
    type: String, 
    default: '6' 
  },
  section: { 
    type: String, 
    default: 'A' 
  },
  rollNumber: { 
    type: String, 
    default: '2026CS101' 
  },
  academicStatus: { 
    type: String, 
    enum: ['Active', 'Suspended', 'Probation'], 
    default: 'Active' 
  },
  feeStatus: { 
    type: String, 
    enum: ['Paid', 'Pending'], 
    default: 'Pending' 
  },
  attendancePercent: { 
    type: Number, 
    default: 85 
  }
});

module.exports = mongoose.model('AppUser', AppUserSchema);
