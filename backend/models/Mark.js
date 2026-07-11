const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  subject: { type: String, required: true },
  marksType: { type: String, enum: ['Internal', 'Semester', 'Assignment'], required: true },
  obtainedMarks: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  comments: { type: String, default: '' }
}, { timestamps: true });

markSchema.index({ studentId: 1 });

module.exports = mongoose.model('Mark', markSchema);
