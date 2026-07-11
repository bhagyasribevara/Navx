const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true },
  date: { type: String, required: true }, // Format: "YYYY-MM-DD"
  originalFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  originalFacultyName: { type: String, required: true },
  substituteFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },
  substituteFacultyName: { type: String, required: true },
  status: { type: String, enum: ['On Leave', 'Substituted'], default: 'On Leave' }
}, { timestamps: true });

substitutionSchema.index({ campusId: 1, date: 1 });
substitutionSchema.index({ timetableId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TimetableSubstitution', substitutionSchema);
