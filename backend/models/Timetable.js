const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  section: { type: String, required: true },
  dayOfWeek: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true },
  period: { type: Number, required: true }, // 1, 2, 3...
  subject: { type: String, required: true },
  roomName: { type: String, required: true }, // e.g. C-302
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  facultyName: { type: String, required: true },
  startTime: { type: String, required: true }, // "09:00 AM"
  endTime: { type: String, required: true } // "10:00 AM"
}, { timestamps: true });

timetableSchema.index({ campusId: 1, department: 1, semester: 1, section: 1 });
timetableSchema.index({ facultyId: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
