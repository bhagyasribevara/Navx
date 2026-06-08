const mongoose = require('mongoose');

const navigationGraphSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  graphData: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

navigationGraphSchema.index({ campusId: 1 });

module.exports = mongoose.model('NavigationGraph', navigationGraphSchema);
