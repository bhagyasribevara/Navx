require('dotenv').config();
const mongoose = require('mongoose');
const Block = require('./models/Block');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  const blocks = await Block.find();
  for (let block of blocks) {
    const name = block.name.toLowerCase();
    let domain = 'Academic Blocks';
    
    if (name.includes('boys hostel')) domain = 'Boys Hostels';
    else if (name.includes('girls hostel')) domain = 'Girls Hostels';
    else if (name.includes('library')) domain = 'Libraries';
    else if (name.includes('dinning') || name.includes('canteen') || name.includes('cafeteria') || name.includes('dining')) domain = 'Cafeteria & Dining';
    else if (name.includes('gate')) domain = 'Main Gates';
    else if (name.includes('sports') || name.includes('gym')) domain = 'Sports & Recreation';
    
    block.domain = domain;
    await block.save();
    console.log(`Updated ${block.name} -> ${domain}`);
  }
  console.log('Done');
  process.exit();
}).catch(console.error);
