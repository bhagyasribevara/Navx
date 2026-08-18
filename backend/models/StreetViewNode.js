const mongoose = require('mongoose');

const streetViewNodeSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreetViewSession', required: true },
  nodeIndex: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, default: 0 },
    z: { type: Number, required: true }
  },
  orientation: {
    heading: { type: Number, required: true },
    pitch: { type: Number, default: 0 }
  },
  connectedEdges: [{
    targetNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreetViewNode' },
    direction: { type: String, enum: ['forward', 'backward', 'left', 'right', 'stair_up', 'stair_down'] },
    distance: Number,
    bearing: Number
  }],
  isDoorway: { type: Boolean, default: false },
  isStaircase: { type: Boolean, default: false },
  doorDetails: {
    roomName: String,
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    relativeAngle: Number
  }
}, { timestamps: true });

streetViewNodeSchema.index({ campusId: 1, blockId: 1, floorId: 1 });
streetViewNodeSchema.index({ sessionId: 1, nodeIndex: 1 });

module.exports = mongoose.model('StreetViewNode', streetViewNodeSchema);
