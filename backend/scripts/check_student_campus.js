const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const AppUser = require('../models/AppUser');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const students = await AppUser.find({ role: 'student' });
  students.forEach(s => console.log(s.username, "campusId:", s.campusId));
  process.exit();
}
run();
