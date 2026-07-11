const mongoose = require('mongoose');

const academicCalendarSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['Exam', 'Holiday', 'Event', 'Academic'], default: 'Academic' }
}, { timestamps: true });

academicCalendarSchema.index({ campusId: 1 });

module.exports = mongoose.model('AcademicCalendar', academicCalendarSchema);
