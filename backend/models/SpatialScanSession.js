const mongoose = require('mongoose');

const SpatialScanSessionSchema = new mongoose.Schema({
  building: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'completed', 'failed'], default: 'active' },
  trajectory: [{
    x: Number,
    y: Number,
    z: Number,
    qw: Number,
    qx: Number,
    qy: Number,
    qz: Number,
    timestamp: Date
  }],
  detectedRooms: [{
    roomNumber: String,
    roomName: String,
    confidence: Number
  }],
  wallColors: {
    top: { type: String, default: '#f6f6eb' },
    bottom: { type: String, default: '#b8aa8f' }
  },
  floorMaterial: { type: String, default: 'terrazzo_mosaic' },
  floorColor: { type: String, default: '#dcd6cc' },
  landmarks: [{
    type: { type: String },
    label: String
  }],
  coveragePercentage: { type: Number, default: 0 },
  trackingQuality: { type: String, enum: ['poor', 'fair', 'good', 'excellent'], default: 'good' },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SpatialScanSession', SpatialScanSessionSchema);
