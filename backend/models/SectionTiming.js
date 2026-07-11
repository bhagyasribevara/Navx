const mongoose = require('mongoose');

const sectionTimingSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  section: { type: String, required: true },
  timings: [{
    period: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  }]
}, { timestamps: true });

sectionTimingSchema.index({ campusId: 1, department: 1, semester: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('SectionTiming', sectionTimingSchema);
