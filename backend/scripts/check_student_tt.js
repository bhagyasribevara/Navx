const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Timetable = require('../models/Timetable');
const AppUser = require('../models/AppUser');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  
  // Find all students
  const students = await AppUser.find({ role: 'student' });
  console.log(`Found ${students.length} students`);
  for (const student of students) {
      console.log(`Student: ${student.username}, Dept: ${student.department}, Sem: ${student.semester}, Sec: ${student.section}`);
      const tt = await Timetable.find({
          campusId: student.campusId,
          department: student.department,
          semester: student.semester,
          section: student.section,
          dayOfWeek: 'Tuesday'
      });
      console.log(`  Classes on Tuesday: ${tt.length}`);
  }

  process.exit();
}
run();
