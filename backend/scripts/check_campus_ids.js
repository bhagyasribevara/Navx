const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Faculty = require('../models/Faculty');
const Campus = require('../models/Campus');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const faculties = await Faculty.find({});
  console.log(`Total faculties: ${faculties.length}`);

  const campusGroups = {};
  faculties.forEach(f => {
    const idStr = f.campusId ? f.campusId.toString() : 'missing';
    campusGroups[idStr] = (campusGroups[idStr] || 0) + 1;
  });
  console.log("Campus ID groups for faculties:", campusGroups);

  const campuses = await Campus.find({});
  console.log(`Total campuses: ${campuses.length}`);
  campuses.forEach(c => console.log(c._id.toString(), c.name));

  process.exit();
}
run();
