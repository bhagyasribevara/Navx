const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  maxMarks: { type: Number, default: 10 },
  fileUrl: { type: String, default: '' },
  submissions: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser' },
    studentName: String,
    submittedAt: { type: Date, default: Date.now },
    fileUrl: String,
    obtainedMarks: { type: Number, default: null }
  }]
}, { timestamps: true });

assignmentSchema.index({ campusId: 1, department: 1, semester: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
