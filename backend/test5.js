require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Room = require('./models/Room');
  const rooms = await Room.find({ blockId: '69f61b2ed1091d1ff243afe5' });
  console.log("Rooms in Himalaya:", rooms.length);
  rooms.forEach(r => {
    console.log(`- ${r.name}: points.length=${r.shape?.points?.length}`);
    if (r.shape?.points?.length > 0) {
      console.log("  First point:", r.shape.points[0]);
    }
  });
  process.exit(0);
});
