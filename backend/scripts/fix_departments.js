const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Timetable = require('../models/Timetable');
const Faculty = require('../models/Faculty');

const deptMapping = {
  "Electronics and Communication Engineering": "ECE",
  "Electrical and Electronics Engineering": "EEE",
  "Mechanical Engineering": "Mechanical",
  "Information Technology": "IT",
  "Civil Engineering": "Civil",
  "Civil": "Civil"
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  
  // Fix Timetables
  let ttUpdated = 0;
  for (const [wrong, correct] of Object.entries(deptMapping)) {
    const res = await Timetable.updateMany({ department: wrong }, { $set: { department: correct } });
    ttUpdated += res.modifiedCount;
  }
  console.log(`Updated ${ttUpdated} timetables to correct department names.`);

  // Fix Faculty (who were assigned 'CSE' but belong to others, we can find them by looking at their assignedSubjectsSections or timetable entries)
  // Or we can just read the timetables and update their faculty.
  const tts = await Timetable.find({});
  let facUpdated = 0;
  for (const tt of tts) {
    if (tt.facultyId) {
      const fac = await Faculty.findById(tt.facultyId);
      if (fac && fac.department !== tt.department) {
        fac.department = tt.department;
        await fac.save();
        facUpdated++;
      }
    }
  }
  console.log(`Updated ${facUpdated} faculty departments based on their timetables.`);

  // Print final stats
  const faculties = await Faculty.find({});
  const depts = {};
  faculties.forEach(f => {
    depts[f.department] = (depts[f.department] || 0) + 1;
  });
  console.log('Faculties per department now: ', depts);
  
  process.exit();
}
run();
