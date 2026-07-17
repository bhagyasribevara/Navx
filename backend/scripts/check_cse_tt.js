const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Timetable = require('../models/Timetable');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const cseClasses = await Timetable.find({ department: 'CSE', semester: '3', section: 'A' });
  console.log(`CSE Sem 3 Sec A has ${cseClasses.length} total classes in DB`);
  cseClasses.forEach(c => console.log(c.dayOfWeek, c.period, c.subject));
  process.exit();
}
run();
