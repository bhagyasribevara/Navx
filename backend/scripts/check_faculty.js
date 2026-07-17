const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Faculty = require('../models/Faculty');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const faculties = await Faculty.find({});
  console.log(`Total faculties: ${faculties.length}`);
  const depts = {};
  faculties.forEach(f => {
    depts[f.department] = (depts[f.department] || 0) + 1;
  });
  console.log('Faculties per department: ', depts);
  process.exit();
}
run();
