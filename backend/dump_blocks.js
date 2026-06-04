const mongoose = require('mongoose');
const Block = require('./models/Block');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/navx';

mongoose.connect(MONGODB_URI).then(async () => {
  const blocks = await Block.find({ isActive: true });
  console.log("BLOCKS:", JSON.stringify(blocks.map(b => ({
    _id: b._id,
    name: b.name,
    shape: b.shape
  })), null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
