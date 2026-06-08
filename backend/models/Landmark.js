const mongoose = require('mongoose');

const landmarkSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  landmarkData: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

landmarkSchema.index({ campusId: 1 });

module.exports = mongoose.model('Landmark', landmarkSchema);
