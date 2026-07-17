const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');

const TARGET_CAMPUS_ID = '69f5b53806b69be1479267c7'; // GMRIT
const WRONG_CAMPUS_ID = '69ec92ae005ce94ab0f0b898';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  
  const facultyRes = await Faculty.updateMany(
    { campusId: WRONG_CAMPUS_ID },
    { $set: { campusId: TARGET_CAMPUS_ID } }
  );
  console.log(`Updated ${facultyRes.modifiedCount} faculties to GMRIT campus`);

  const ttRes = await Timetable.updateMany(
    { campusId: WRONG_CAMPUS_ID },
    { $set: { campusId: TARGET_CAMPUS_ID } }
  );
  console.log(`Updated ${ttRes.modifiedCount} timetables to GMRIT campus`);

  process.exit();
}
run();
