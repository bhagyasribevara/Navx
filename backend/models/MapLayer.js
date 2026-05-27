const mongoose = require('mongoose');

const mapLayerSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['polygon', 'polyline', 'marker', 'zone'],
    default: 'polygon'
  },
  category: { type: String, default: 'custom' },
  color: { type: String, default: '#3b82f6' },
  geometry: {
    type: {
      type: String,
      enum: ['Point', 'LineString', 'Polygon'],
      required: true
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  properties: { type: mongoose.Schema.Types.Mixed, default: {} },
  navigationAllowed: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

mapLayerSchema.index({ campusId: 1 });

module.exports = mongoose.model('MapLayer', mapLayerSchema);
