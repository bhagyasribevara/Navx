require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Block = require('./models/Block');
  const blocks = await Block.find({}, 'name shape');
  console.log(JSON.stringify(blocks, null, 2));
  process.exit(0);
});
