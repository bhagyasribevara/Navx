const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  bounds: {
    width: { type: Number, default: 1000 },
    height: { type: Number, default: 800 }
  },
  settings: {
    gridSize: { type: Number, default: 20 },
    snapToGrid: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Campus', campusSchema);
