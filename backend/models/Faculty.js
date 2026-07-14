const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  department: { 
    type: String, 
    required: true,
    enum: ['CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'MBA', 'MCA']
  },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  facultyRoom: { type: String, required: true }, // e.g. "F-12"
  facultyRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  subjects: [String],
  assignedSections: [String],
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  leaveStatus: { type: String, enum: ['Present', 'On Leave'], default: 'Present' },
  photo: { type: String, default: '' },
  officeHours: { type: String, default: '9:00 AM - 5:00 PM' },
  maxWeeklyHours: { type: Number, default: 16 },
  assignedSubjectsSections: [{
    subject: { type: String, required: true },
    section: { type: String, required: true },
    semester: { type: String, required: true }
  }]
}, { timestamps: true });

facultySchema.index({ campusId: 1 });


module.exports = mongoose.model('Faculty', facultySchema);
