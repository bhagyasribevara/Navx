const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const collections = ['timetables', 'campuses', 'maplayers', 'campaigns', 'faculties', 'appusers'];
    console.log("Storage breakdown by collection:");
    
    for (const collName of collections) {
      try {
        const stats = await db.command({ collStats: collName });
        const sizeKB = (stats.storageSize / 1024).toFixed(2);
        console.log(`- ${collName}: ${stats.count} records, ${sizeKB} KB storage size`);
      } catch (e) {
        console.log(`- ${collName}: Collection not found or empty`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
