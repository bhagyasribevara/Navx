const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Room = require('../backend/models/Room');
const NavNode = require('../backend/models/NavNode');
const Block = require('../backend/models/Block');
const Floor = require('../backend/models/Floor');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const block5 = await Block.findOne({ name: /BLOCK 5/i });
  const floor1 = await Floor.findOne({ blockId: block5._id, level: 1 });
  console.log('Floor 1:', floor1?.name, floor1?._id);

  const rooms = await Room.find({ floorId: floor1._id }).lean();
  console.log('Floor 1 rooms count:', rooms.length);
  const sample = rooms.filter(r => r.name && r.name.includes('5-F-'));
  console.log('Sample 5-F rooms:', sample.map(r => ({ name: r.name, points: r.shape?.points })));

  const nodes = await NavNode.find({ floorId: floor1._id }).lean();
  console.log('Floor 1 nodes count:', nodes.length);
  const doorNodes = nodes.filter(n => n.type === 'door' || (n.name && n.name.toLowerCase().includes('door')) || n.roomId);
  console.log('Floor 1 door nodes count:', doorNodes.length);
  if (doorNodes.length > 0) {
    console.log('Sample door nodes:', doorNodes.slice(0, 5).map(d => ({ name: d.name, type: d.type, coords: [d.longitude, d.latitude], roomId: d.roomId })));
  }

  await mongoose.disconnect();
}
check().catch(console.error);
