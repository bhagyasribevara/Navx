const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Timetable = require('../models/Timetable');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const tt = await Timetable.findOne();
  console.log("Sample Timetable entry:");
  console.log(tt);

  const depts = await Timetable.distinct('department');
  const sems = await Timetable.distinct('semester');
  const secs = await Timetable.distinct('section');

  console.log("Distinct departments:", depts);
  console.log("Distinct semesters:", sems);
  console.log("Distinct sections:", secs);
  process.exit();
}
run();
