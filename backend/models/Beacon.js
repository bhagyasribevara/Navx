const mongoose = require('mongoose');

const beaconSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  beaconId: { type: String, required: true, unique: true },
  uuid: { type: String, required: true },
  major: { type: Number, required: true },
  minor: { type: Number, required: true },
  label: { type: String, default: '' },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  txPower: { type: Number, default: -59 }, // RSSI at 1 meter
  calibration: {
    rssiAt1m: { type: Number, default: -59 },
    pathLossExponent: { type: Number, default: 2.0 },
    environmentFactor: { type: Number, default: 1.0 }
  },
  nearestNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

beaconSchema.index({ floorId: 1 });

module.exports = mongoose.model('Beacon', beaconSchema);
