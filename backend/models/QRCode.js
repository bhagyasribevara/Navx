const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  code: { type: String, required: true, unique: true },
  label: { type: String, default: '' },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  // Links to nearest nav node for positioning
  nearestNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', default: null },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

qrCodeSchema.index({ floorId: 1 });

module.exports = mongoose.model('QRCode', qrCodeSchema);
