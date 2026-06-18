require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const MapLayer = require('./models/MapLayer');
  const layers = await MapLayer.find({});
  layers.forEach(b => {
    if (b.name.toLowerCase().includes('himalaya') || b.name.toLowerCase().includes('nilgiri')) {
      console.log(`- MapLayer: ${b.name}: _id=${b._id}, geometry.coordinates[0].length=${b.geometry?.coordinates?.[0]?.length}`);
    }
  });
  process.exit(0);
});
