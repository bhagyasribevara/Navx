const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const AppUser = require('../models/AppUser');
const Timetable = require('../models/Timetable');
const Campus = require('../models/Campus');

// Helper from student.js
const getStudentCampusId = async (student) => {
  if (student.activeCampusId) return student.activeCampusId;
  if (student.campusId) return student.campusId;
  const campus = await Campus.findOne({ name: 'GMRIT' }) || await Campus.findOne();
  return campus ? campus._id : null;
};
const getSemesterVariants = (sem) => {
  if (!sem) return [];
  const num = sem.toString().replace(/(st|nd|rd|th)$/i, '');
  const suffixes = { '1': 'st', '2': 'nd', '3': 'rd' };
  const suffix = suffixes[num] || 'th';
  return [num, `${num}${suffix}`];
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  
  const students = await AppUser.find({ role: 'student' });
  for (const student of students) {
      console.log(`\nStudent: ${student.username}, Dept: ${student.department}, Sem: ${student.semester}, Sec: ${student.section}`);
      const campusId = await getStudentCampusId(student);
      console.log(`Resolved CampusId: ${campusId}`);
      
      const semVariants = getSemesterVariants(student.semester);
      const tt = await Timetable.find({
          campusId,
          department: student.department,
          semester: { $in: semVariants },
          section: student.section,
          dayOfWeek: 'Tuesday'
      });
      console.log(`Classes on Tuesday: ${tt.length}`);
  }

  process.exit();
}
run();
