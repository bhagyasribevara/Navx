const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const AppUser = require('../models/AppUser');

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.\n");

    // Remove students / regular accounts
    console.log("Removing student and regular accounts...");
    const result = await AppUser.deleteMany({ role: { $in: ['student', 'regular'] } });
    console.log(`Deleted ${result.deletedCount} student/regular accounts.\n`);

    // Get Database Stats
    console.log("Fetching database storage statistics...");
    const db = mongoose.connection.db;
    const stats = await db.command({ dbStats: 1 });
    
    // stats.dataSize, stats.storageSize in bytes
    const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
    const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    
    console.log(`Data Size (Uncompressed): ${dataSizeMB} MB`);
    console.log(`Storage Size (Compressed on disk): ${storageSizeMB} MB`);
    console.log(`Collections: ${stats.collections}`);
    console.log(`Total Objects: ${stats.objects}`);
    
    console.log("\nNote: Free MongoDB Atlas clusters (M0) typically have a 512 MB storage limit.");
    console.log(`Estimated Available Space (Assuming 512MB limit): ${(512 - storageSizeMB).toFixed(2)} MB`);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
