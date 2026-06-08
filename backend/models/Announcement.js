const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  announcementData: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

announcementSchema.index({ campusId: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
