const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  campusName: { type: String, unique: true, sparse: true, default: function() { return this.name; } },
  campusCode: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  adminUrl: { type: String, default: '' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  status: { 
    type: String, 
    enum: ['active', 'disabled'], 
    default: 'active' 
  },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  venueType: { 
    type: String, 
    enum: ['campus', 'hospital', 'airport', 'mall', 'building', 'other'], 
    default: 'campus' 
  },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  radius: { type: Number, default: 500 },
  bounds: {
    width: { type: Number, default: 1000 },
    height: { type: Number, default: 800 }
  },
  settings: {
    gridSize: { type: Number, default: 20 },
    snapToGrid: { type: Boolean, default: true }
  },
  contactInfo: {
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' }
  },
  operatingHours: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  emergencyState: {
    isActive: { type: Boolean, default: false },
    message: { type: String, default: '' },
    type: { type: String, default: 'Fire' },
    timestamp: { type: Date, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campus', campusSchema);
