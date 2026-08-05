const mongoose = require('mongoose');

const navNodeSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', default: null },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['waypoint', 'entrance', 'exit', 'elevator', 'stairs', 'room_entry', 'intersection', 'connector'],
    default: 'waypoint' 
  },
  label: { type: String, default: '' },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  floorLevel: { type: Number, default: null },
  // For multi-floor connections
  connectedFloorNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', default: null },
  connectedFloorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
  // Spatial Studio properties
  z: { type: Number, default: 0 },
  localCoordinates: { 
    x: Number,
    y: Number,
    z: Number
  },
  arAnchorId: { type: String, default: null },
  walkingCost: { type: Number, default: 1 },
  accessible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

navNodeSchema.index({ floorId: 1 });
navNodeSchema.index({ campusId: 1 });

module.exports = mongoose.model('NavNode', navNodeSchema);
