const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  name: { type: String, required: true },
  level: { type: Number, required: true, default: 0 },
  mapData: {
    width: { type: Number, default: 800 },
    height: { type: Number, default: 600 },
    backgroundImage: { type: String, default: '' },
    gridSize: { type: Number, default: 20 },
    walls: [{
      x1: Number, y1: Number, x2: Number, y2: Number,
      thickness: { type: Number, default: 4 }
    }],
    obstacles: [{
      type: { type: String, enum: ['rectangle', 'polygon', 'circle'] },
      x: Number, y: Number, width: Number, height: Number,
      radius: Number, points: [{ x: Number, y: Number }],
      label: String
    }]
  },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

floorSchema.index({ blockId: 1 });
floorSchema.index({ campusId: 1 });

module.exports = mongoose.model('Floor', floorSchema);
