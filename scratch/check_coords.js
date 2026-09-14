const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Room = require('../backend/models/Room');
const Floor = require('../backend/models/Floor');
const Block = require('../backend/models/Block');

async function checkCoords() {
  await mongoose.connect(process.env.MONGODB_URI);
  const block5 = await Block.findOne({ name: /BLOCK 5/i });
  const floor1 = await Floor.findOne({ blockId: block5._id, level: 1 });
  const rooms = await Room.find({ floorId: floor1._id, name: /5-F-(10|11|12|13|14)/ }).lean();

  for (const r of rooms.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`--- ${r.name} ---`);
    console.log(r.shape?.points);
  }

  await mongoose.disconnect();
}
checkCoords().catch(console.error);
