const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Present', 'Absent'], required: true },
  period: { type: Number, default: 1 }
}, { timestamps: true });

attendanceSchema.index({ studentId: 1 });
attendanceSchema.index({ studentId: 1, subject: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
