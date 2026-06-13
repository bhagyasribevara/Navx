const mongoose = require('mongoose');
const Block = require('./models/Block');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const blocks = await Block.find({}, 'name shape');
  console.log(JSON.stringify(blocks, null, 2));
  process.exit(0);
});
