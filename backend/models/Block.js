const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  shape: {
    type: { type: String, enum: ['rectangle', 'polygon', 'circle'], default: 'rectangle' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 150 },
    radius: { type: Number, default: 0 },
    points: [{ x: Number, y: Number }],
    rotation: { type: Number, default: 0 },
    fill: { type: String, default: '#4A90D9' },
    stroke: { type: String, default: '#2C5F8A' },
    strokeWidth: { type: Number, default: 2 },
    opacity: { type: Number, default: 0.8 }
  },
  floorCount: { type: Number, default: 1 },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

blockSchema.index({ campusId: 1 });

module.exports = mongoose.model('Block', blockSchema);
