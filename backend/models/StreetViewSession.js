const mongoose = require('mongoose');

const streetViewSessionSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true, index: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true, index: true },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  status: { type: String, enum: ['uploading', 'processing', 'completed', 'failed'], default: 'uploading' },
  totalNodes: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  captureInterval: { type: Number, default: 1.5 },
  doorTags: [{
    nodeIndex: Number,
    roomName: String,
    taggedAt: Date
  }],
  isPublished: { type: Boolean, default: false },
  thumbnailUrl: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('StreetViewSession', streetViewSessionSchema);
