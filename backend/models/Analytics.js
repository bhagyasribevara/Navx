const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  type: {
    type: String,
    enum: ['navigation', 'search', 'qr_scan', 'page_view'],
    required: true
  },
  data: {
    fromRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    toRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    searchQuery: String,
    qrCode: String,
    floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
    path: [{ x: Number, y: Number }],
    duration: Number, // in seconds
    distance: Number  // in pixels/meters
  },
  sessionId: String,
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

analyticsSchema.index({ campusId: 1, type: 1, timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
