require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Block = require('./models/Block');
  const blocks = await Block.find({});
  blocks.forEach(b => {
    if (b.name.toLowerCase().includes('himalaya') || b.name.toLowerCase().includes('nilgiri')) {
      console.log(`- ${b.name}: _id=${b._id}, shape.points.length=${b.shape?.points?.length}`);
    }
  });
  process.exit(0);
});
