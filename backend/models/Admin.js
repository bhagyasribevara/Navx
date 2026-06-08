const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String }, // Legacy plain password field
  passwordHash: { type: String }, // Hashed password field
  role: { 
    type: String, 
    enum: ['SuperAdmin', 'CampusAdmin', 'VenueAdmin', 'campus_admin'], 
    default: 'campus_admin' 
  },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' }, // Links to venue (campus/hospital/etc)
  managedVenueType: { type: String, enum: ['campus', 'hospital', 'airport', 'mall', 'building', 'other'], default: 'campus' },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  sessionVersion: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
