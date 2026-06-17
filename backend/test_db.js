require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Room = require('./models/Room');
const Campus = require('./models/Campus');
const Block = require('./models/Block');

async function main() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const campuses = await Campus.find().lean();
    console.log('\n--- CAMPUSES ---');
    campuses.forEach(c => console.log(`ID: ${c._id}, Name: ${c.name || c.campusName}`));

    const blocks = await Block.find().lean();
    console.log('\n--- BLOCKS ---');
    blocks.forEach(b => console.log(`ID: ${b._id}, Name: ${b.name}, CampusId: ${b.campusId}`));

    const rooms = await Room.find().lean();
    console.log('\n--- ROOMS ---');
    console.log(`Total rooms: ${rooms.length}`);
    rooms.forEach(r => {
      if (r.name.toLowerCase().includes('lib') || r.name.toLowerCase().includes('dig') || r.type === 'library') {
        console.log(`ID: ${r._id}, Name: "${r.name}", roomNumber: "${r.roomNumber}", type: "${r.type}", campusId: ${r.campusId}`);
      }
    });

    // Also let's print a sample of 10 rooms just to see what names they have
    console.log('\n--- SAMPLE 10 ROOMS ---');
    rooms.slice(0, 10).forEach(r => {
      console.log(`Name: "${r.name}", RoomNumber: "${r.roomNumber}", Type: "${r.type}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
