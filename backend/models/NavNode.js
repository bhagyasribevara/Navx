const mongoose = require('mongoose');

const navNodeSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
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
  // For multi-floor connections
  connectedFloorNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NavNode', default: null },
  connectedFloorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
  accessible: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

navNodeSchema.index({ floorId: 1 });
navNodeSchema.index({ campusId: 1 });

module.exports = mongoose.model('NavNode', navNodeSchema);
