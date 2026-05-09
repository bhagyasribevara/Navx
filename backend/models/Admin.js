const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['SuperAdmin', 'CampusAdmin', 'VenueAdmin'], default: 'CampusAdmin' },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' }, // Links to venue (campus/hospital/etc)
  managedVenueType: { type: String, enum: ['campus', 'hospital', 'airport', 'mall', 'building', 'other'], default: 'campus' }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
