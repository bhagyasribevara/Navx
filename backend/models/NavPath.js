const mongoose = require('mongoose');

const navPathSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  nodeA: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', required: true },
  nodeB: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', required: true },
  distance: { type: Number, required: true },
  type: {
    type: String,
    enum: ['hallway', 'stairs', 'elevator', 'outdoor', 'connector'],
    default: 'hallway'
  },
  bidirectional: { type: Boolean, default: true },
  accessible: { type: Boolean, default: true },
  weight: { type: Number, default: 1 }, // Multiplier for pathfinding
  congestionLevel: { type: Number, default: 0, min: 0, max: 10 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

navPathSchema.index({ floorId: 1 });
navPathSchema.index({ nodeA: 1, nodeB: 1 });

module.exports = mongoose.model('NavPath', navPathSchema);
