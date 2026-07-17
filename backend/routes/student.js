const router = require('express').Router();
const jwt = require('jsonwebtoken');
const AppUser = require('../models/AppUser');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Fee = require('../models/Fee');
const Assignment = require('../models/Assignment');
const StudyMaterial = require('../models/StudyMaterial');
const AcademicCalendar = require('../models/AcademicCalendar');
const Faculty = require('../models/Faculty');
const Announcement = require('../models/Announcement');
const TimetableSubstitution = require('../models/TimetableSubstitution');
const Room = require('../models/Room');
const Campus = require('../models/Campus');

// Helper to get campusId with fallback
const getStudentCampusId = async (student) => {
  if (student.activeCampusId) return student.activeCampusId;
  if (student.campusId) return student.campusId;
  const campus = await Campus.findOne({ name: 'GMRIT' }) || await Campus.findOne();
  return campus ? campus._id : null;
};

const { JWT_SECRET } = require('../utils/auth');

// Helper to normalize semester format: "3rd" -> "3", "3" -> "3", "6th" -> "6"
const normalizeSemester = (sem) => {
  if (!sem) return sem;
  return sem.toString().replace(/(st|nd|rd|th)$/i, '');
};

// Get all possible semester format variants for DB queries
const getSemesterVariants = (sem) => {
  if (!sem) return [];
  const num = normalizeSemester(sem);
  const suffixes = { '1': 'st', '2': 'nd', '3': 'rd' };
  const suffix = suffixes[num] || 'th';
  return [num, `${num}${suffix}`];
};

// Middleware to authenticate student AppUser
const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const student = await AppUser.findById(decoded.userId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    req.student = student;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired student token.' });
  }
};

// Helper to auto-seed mock data for a student if none exists
const autoSeedStudentData = async (student) => {
  const campusId = await getStudentCampusId(student);
  if (!campusId) return;

  // Check if timetable exists for this student's department/semester (try all format variants)
  const semVariants = getSemesterVariants(student.semester);
  const count = await Timetable.countDocuments({ campusId, department: student.department, semester: { $in: semVariants } });
  if (count > 0) return; // real or previously-seeded timetable already exists

  // Create mock Faculty
  let faculty = await Faculty.findOne({ campusId, employeeId: 'EMP1001' });
  if (!faculty) {
    faculty = new Faculty({
      campusId,
      name: 'Dr. Ganesh Prasad',
      employeeId: 'EMP1001',
      department: 'CSE',
      designation: 'Professor & HOD',
      email: 'ganesh@institution.edu',
      phone: '9876543210',
      facultyRoom: 'F-12',
      subjects: ['DBMS', 'OS'],
      assignedSections: ['A'],
      username: 'ganesh_hod',
      password: 'hashedpassword',
      leaveStatus: 'Present',
      officeHours: '11:00 AM - 1:00 PM'
    });
    await faculty.save();
  }

  // Create another faculty
  let faculty2 = await Faculty.findOne({ campusId, employeeId: 'EMP1002' });
  if (!faculty2) {
    faculty2 = new Faculty({
      campusId,
      name: 'Dr. Sarma HOD',
      employeeId: 'EMP1002',
      department: 'CSE',
      designation: 'HOD CSE',
      email: 'sarma@institution.edu',
      phone: '9876543211',
      facultyRoom: 'F-05',
      subjects: ['Computer Networks', 'AI'],
      assignedSections: ['A'],
      username: 'sarma_hod',
      password: 'hashedpassword',
      leaveStatus: 'Present',
      officeHours: '10:00 AM - 12:00 PM'
    });
    await faculty2.save();
  }

  // Create Timetable for Monday - Friday
  const dbRooms = await Room.find({ campusId });
  const classrooms = dbRooms.filter(r => ['classroom', 'auditorium'].includes(r.type));
  const labs = dbRooms.filter(r => r.type === 'lab');

  const classroomName = classrooms.length > 0 ? classrooms[0].name : 'CS Lecture Hall 1';
  const classroomId = classrooms.length > 0 ? classrooms[0]._id : null;

  const labName = labs.length > 0 ? labs[0].name : 'Robotics Lab';
  const labId = labs.length > 0 ? labs[0]._id : null;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const subjectsList = [
    { name: 'DBMS', room: classroomName, roomId: classroomId, faculty: faculty },
    { name: 'OS', room: classroomName, roomId: classroomId, faculty: faculty },
    { name: 'Computer Networks', room: classroomName, roomId: classroomId, faculty: faculty2 },
    { name: 'AI & ML', room: labName, roomId: labId, faculty: faculty2 },
    { name: 'Theory of Computation', room: classroomName, roomId: classroomId, faculty: faculty }
  ];

  for (const day of days) {
    for (let p = 1; p <= 5; p++) {
      const sub = subjectsList[(p + days.indexOf(day)) % subjectsList.length];
      const startHours = 8 + p;
      const endHours = 9 + p;
      
      const timetableEntry = new Timetable({
        campusId,
        department: student.department,
        semester: student.semester,
        section: student.section,
        dayOfWeek: day,
        period: p,
        subject: sub.name,
        roomName: sub.room,
        roomId: sub.roomId,
        facultyId: sub.faculty._id,
        facultyName: sub.faculty.name,
        startTime: `${startHours.toString().padStart(2, '0')}:00 AM`,
        endTime: `${endHours.toString().padStart(2, '0')}:00 AM`
      });
      await timetableEntry.save();
    }
  }

  // Create Attendance logs (Subject-wise)
  const subjects = ['DBMS', 'OS', 'Computer Networks', 'AI & ML', 'Theory of Computation'];
  for (const sub of subjects) {
    for (let d = 1; d <= 15; d++) {
      const log = new Attendance({
        campusId,
        studentId: student._id,
        subject: sub,
        date: new Date(Date.now() - d * 24 * 60 * 60 * 1000),
        status: Math.random() > 0.15 ? 'Present' : 'Absent',
        period: 1
      });
      await log.save();
    }
  }

  // Create Marks
  for (const sub of subjects) {
    const internalMark = new Mark({
      campusId,
      studentId: student._id,
      subject: sub,
      marksType: 'Internal',
      obtainedMarks: Math.floor(Math.random() * 5) + 18, // 18 to 23
      totalMarks: 25,
      comments: 'Good Performance'
    });
    await internalMark.save();

    const semMark = new Mark({
      campusId,
      studentId: student._id,
      subject: sub,
      marksType: 'Semester',
      obtainedMarks: Math.floor(Math.random() * 20) + 65, // 65 to 85
      totalMarks: 100,
      comments: 'Passed'
    });
    await semMark.save();
  }

  // Create Fees
  const feesList = [
    { title: 'Tution Fee Sem 6', amount: 75000, status: 'Pending', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    { title: 'Examination Fee Sem 6', amount: 2500, status: 'Pending', dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
    { title: 'Library Membership Fee', amount: 1500, status: 'Paid', dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), paidDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), transactionId: 'TXN8912381', paymentMethod: 'UPI' }
  ];
  for (const f of feesList) {
    const feeItem = new Fee({
      campusId,
      studentId: student._id,
      title: f.title,
      amount: f.amount,
      status: f.status,
      dueDate: f.dueDate,
      paidDate: f.paidDate || null,
      transactionId: f.transactionId || null,
      paymentMethod: f.paymentMethod || null
    });
    await feeItem.save();
  }

  // Create Assignments
  for (const sub of subjects) {
    const assign = new Assignment({
      campusId,
      department: student.department,
      semester: student.semester,
      subject: sub,
      title: `${sub} Assignment 1`,
      description: 'Please submit unit 1 and unit 2 answers in PDF format.',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxMarks: 10
    });
    await assign.save();
  }

  // Create Study Material
  for (const sub of subjects) {
    const sm = new StudyMaterial({
      campusId,
      department: student.department,
      semester: student.semester,
      subject: sub,
      title: `${sub} - Unit 1 Notes`,
      description: 'Introductory notes and slides for unit 1.',
      fileUrl: '/uploads/unit_1_notes.pdf',
      uploadedBy: faculty._id,
      uploadedByName: faculty.name
    });
    await sm.save();
  }

  // Create Academic Calendar events
  const calEvents = [
    { title: 'Semester Exams Start', description: 'Regular exams for sem 6', startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), type: 'Exam' },
    { title: 'Independence Day Holiday', description: 'National holiday', startDate: new Date('2026-08-15'), endDate: new Date('2026-08-15'), type: 'Holiday' },
    { title: 'Technical Symposium', description: 'Tech Fest', startDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000), type: 'Event' }
  ];
  for (const ev of calEvents) {
    const calendarItem = new AcademicCalendar({
      campusId,
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate,
      endDate: ev.endDate,
      type: ev.type
    });
    await calendarItem.save();
  }

  // Seed Announcements
  const announcementsList = [
    { title: 'AI Symposium Registrations Open', desc: 'Students can register for the symposium on student portal.' },
    { title: 'Fee Payment Deadline Extension', desc: 'Semester 6 fee payment deadline extended by 10 days.' }
  ];
  for (const ann of announcementsList) {
    const announcementItem = new Announcement({
      campusId,
      announcementData: {
        title: ann.title,
        message: ann.desc,
        createdAt: new Date()
      },
      isActive: true
    });
    await announcementItem.save();
  }

  console.log(`Auto-seeded data for student: ${student.username}`);
};

// GET /api/student/dashboard
router.get('/dashboard', authenticateStudent, async (req, res, next) => {
  try {
    const student = req.student;
    
    // Auto seed if empty
    await autoSeedStudentData(student);

    const campusId = await getStudentCampusId(student);

    // Get live attendance % from DB
    const attendanceLogs = await Attendance.find({ studentId: student._id });
    let attendancePercent = student.attendancePercent || 85;
    if (attendanceLogs.length > 0) {
      const presents = attendanceLogs.filter(a => a.status === 'Present').length;
      attendancePercent = Math.round((presents / attendanceLogs.length) * 1000) / 10;
    }

    // Get today's classes
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    
    // Fallback to Monday if it is Sunday/Saturday for demo purposes
    const queryDay = (currentDay === 'Sunday' || currentDay === 'Saturday') ? 'Monday' : currentDay;

    const semVariants = getSemesterVariants(student.semester);
    const timetable = await Timetable.find({
      campusId,
      department: student.department,
      semester: { $in: semVariants },
      section: student.section,
      dayOfWeek: queryDay
    }).sort({ period: 1 });

    // Look up today's substitutions to override faculty details dynamically
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySubs = await TimetableSubstitution.find({ campusId, date: todayStr });

    const processedTimetable = timetable.map(entry => {
      const sub = todaySubs.find(s => s.timetableId.toString() === entry._id.toString());
      if (sub) {
        const obj = entry.toObject();
        obj.isSubstituted = true;
        obj.originalFacultyName = entry.facultyName;
        obj.facultyName = `${sub.substituteFacultyName} (Substitute)`;
        return obj;
      }
      return entry;
    });

    // Find next class based on period or time
    const currentHour = new Date().getHours();
    let nextClass = null;
    let upcomingClasses = [];

    for (const entry of processedTimetable) {
      const match = entry.startTime.match(/^(\d+):/);
      if (match) {
        let startHour = parseInt(match[1]);
        if (entry.startTime.includes('PM') && !entry.startTime.startsWith('12')) {
          startHour += 12;
        }
        if (startHour > currentHour) {
          if (!nextClass) {
            nextClass = entry;
          } else {
            upcomingClasses.push(entry);
          }
        }
      }
    }

    // Fallback to first class if none are upcoming in the day
    if (!nextClass && processedTimetable.length > 0) {
      nextClass = processedTimetable[0];
    }

    // Get pending fees status
    const pendingFees = await Fee.find({ studentId: student._id, status: 'Pending' });
    const pendingAmount = pendingFees.reduce((sum, f) => sum + f.amount, 0);
    const feeStatus = pendingAmount > 0 ? `Pending: ₹${pendingAmount}` : 'Paid';

    // Get Announcements
    const announcements = await Announcement.find({ campusId }).sort({ createdAt: -1 }).limit(3);

    res.json({
      success: true,
      student: {
        id: student._id,
        username: student.username,
        rollNumber: student.rollNumber,
        department: student.department,
        semester: student.semester,
        section: student.section,
        academicStatus: student.academicStatus,
        feeStatus,
        attendancePercent
      },
      nextClass,
      todayTimetable: processedTimetable,
      announcements: announcements.map(a => ({
        id: a._id,
        title: a.announcementData?.title || 'Announcement',
        message: a.announcementData?.message || '',
        createdAt: a.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/student/academics
router.get('/academics', authenticateStudent, async (req, res, next) => {
  try {
    const student = req.student;
    const campusId = await getStudentCampusId(student);

    // Get timetable (all days)
    const semVariants = getSemesterVariants(student.semester);
    const timetable = await Timetable.find({
      campusId,
      department: student.department,
      semester: { $in: semVariants },
      section: student.section
    }).sort({ period: 1 });

    // Group timetable by day
    const groupedTimetable = {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
    };
    timetable.forEach(t => {
      if (groupedTimetable[t.dayOfWeek]) {
        groupedTimetable[t.dayOfWeek].push(t);
      }
    });

    // Get subject-wise attendance breakdown
    const attendanceLogs = await Attendance.find({ studentId: student._id });
    const attendanceBreakdown = {};
    attendanceLogs.forEach(log => {
      if (!attendanceBreakdown[log.subject]) {
        attendanceBreakdown[log.subject] = { present: 0, total: 0 };
      }
      attendanceBreakdown[log.subject].total++;
      if (log.status === 'Present') {
        attendanceBreakdown[log.subject].present++;
      }
    });

    // Format breakdown with percentages
    const attendance = Object.keys(attendanceBreakdown).map(sub => {
      const item = attendanceBreakdown[sub];
      return {
        subject: sub,
        present: item.present,
        total: item.total,
        percentage: Math.round((item.present / item.total) * 100)
      };
    });

    // Get marks
    const marksList = await Mark.find({ studentId: student._id });
    const internalMarks = marksList.filter(m => m.marksType === 'Internal');
    const semesterResults = marksList.filter(m => m.marksType === 'Semester');

    // Get assignments
    const assignments = await Assignment.find({
      campusId,
      department: student.department,
      semester: student.semester
    }).sort({ dueDate: 1 });

    // Get study materials
    const studyMaterials = await StudyMaterial.find({
      campusId,
      department: student.department,
      semester: student.semester
    });

    // Get academic calendar
    const calendar = await AcademicCalendar.find({ campusId }).sort({ startDate: 1 });

    res.json({
      success: true,
      campusId,
      timetable: groupedTimetable,
      attendance,
      internalMarks,
      semesterResults,
      assignments,
      studyMaterials,
      calendar
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/student/fees
router.get('/fees', authenticateStudent, async (req, res, next) => {
  try {
    const student = req.student;
    const fees = await Fee.find({ studentId: student._id }).sort({ dueDate: 1 });
    res.json({ success: true, fees });
  } catch (err) {
    next(err);
  }
});

// POST /api/student/fees/pay
router.post('/fees/pay', authenticateStudent, async (req, res, next) => {
  try {
    const { feeId, transactionId, paymentMethod } = req.body;
    if (!feeId) return res.status(400).json({ error: 'Fee ID is required' });

    const fee = await Fee.findById(feeId);
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });
    if (fee.status === 'Paid') return res.status(400).json({ error: 'Fee is already paid' });

    fee.status = 'Paid';
    fee.paidDate = new Date();
    fee.transactionId = transactionId || 'TXN_RP_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    fee.paymentMethod = paymentMethod || 'UPI/Card';
    await fee.save();

    // Dynamically update student's overall fee status if all fees are paid
    const student = req.student;
    const pendingFeesCount = await Fee.countDocuments({ studentId: student._id, status: 'Pending' });
    if (pendingFeesCount === 0) {
      student.feeStatus = 'Paid';
      await student.save();
    }

    res.json({ success: true, message: 'Payment simulated successfully!', fee });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
