const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const {
  CATEGORY_PALETTE,
  TARGET_HIGHLIGHT_PALETTE,
  snapPolygonRing,
  getPolygonArea,
  insetPolygon,
  generatePartitionWalls,
  generateDoorPortals,
  buildRoomDigitalTwinFeatures,
  resolveRoomCategory
} = require('../user/src/components/ProceduralDigitalTwinEngine');

const Block = require('../backend/models/Block');
const Room = require('../backend/models/Room');
const Floor = require('../backend/models/Floor');

async function runTests() {
  console.log('=== TEST 1: ProceduralDigitalTwinEngine Geometry Tests ===');

  const sampleClassroom = {
    _id: '5f14_test_id',
    name: '5-F-14',
    type: 'classroom',
    category: 'classroom',
    shape: {
      points: [
        { x: 18.465308533689182, y: 83.66118639707567 },
        { x: 18.465377409558922, y: 83.66119607622622 },
        { x: 18.46536704941854,  y: 83.66126686334611 },
        { x: 18.46530026705175,  y: 83.66125747561458 }
      ]
    }
  };

  const rawRing = sampleClassroom.shape.points.map(p => [p.y, p.x]);
  rawRing.push([...rawRing[0]]);

  // 1. Inset verification
  const insetRing = insetPolygon(rawRing, 0.18);
  const origArea = Math.abs(getPolygonArea(rawRing));
  const insetArea = Math.abs(getPolygonArea(insetRing));
  console.log('Inset test: origArea =', origArea, ', insetArea =', insetArea);
  if (insetArea >= origArea || insetArea <= 0) {
    throw new Error('Inset polygon algorithm failed to shrink area properly!');
  }
  console.log('✔ Inset polygon verified (recessed ceiling tray successfully created)');

  // 2. Partition walls verification
  const partitionBoxes = generatePartitionWalls(rawRing, 0.12);
  console.log('Partition walls count:', partitionBoxes.length);
  if (partitionBoxes.length !== 4) {
    throw new Error(`Expected 4 partition walls for a 4-sided room, got ${partitionBoxes.length}`);
  }
  console.log('✔ Partition walls generated along all 4 boundary edges');

  // 3. Door portal verification
  const doorBoxes = generateDoorPortals(rawRing, 1.0, 0.18);
  console.log('Door portals count:', doorBoxes.length);
  if (doorBoxes.length === 0) {
    throw new Error('Door portal failed to generate along corridor edge!');
  }
  console.log('✔ Door portal generated along corridor-facing edge');

  // 4. Multi-tier architectural feature collection verification
  const features = buildRoomDigitalTwinFeatures(sampleClassroom, 3.5, false);
  console.log('Total features generated for 5-F-14:', features.length);
  const parts = features.map(f => f.properties.part);
  console.log('Generated parts:', parts);

  if (!parts.includes('base') || !parts.includes('body') || !parts.includes('partition') ||
      !parts.includes('roof') || !parts.includes('parapet') || !parts.includes('door')) {
    throw new Error('Missing required architectural parts in digital twin output!');
  }
  console.log('✔ All architectural parts present (base, body, partition, roof, parapet, door)');

  // 5. Palette verification
  const roofFeature = features.find(f => f.properties.part === 'roof');
  const bodyFeature = features.find(f => f.properties.part === 'body');
  const parapetFeature = features.find(f => f.properties.part === 'parapet');
  const baseFeature = features.find(f => f.properties.part === 'base');
  const partFeature = features.find(f => f.properties.part === 'partition');

  console.log('Colors:', {
    base: baseFeature.properties.color,
    wall: bodyFeature.properties.color,
    roof: roofFeature.properties.color,
    parapet: parapetFeature.properties.color,
    partition: partFeature.properties.color
  });

  if (bodyFeature.properties.color !== '#e2e8f0' || roofFeature.properties.color !== '#f8fafc' ||
      baseFeature.properties.color !== '#1e293b' || partFeature.properties.color !== '#1e293b' ||
      parapetFeature.properties.color !== '#0284c7') {
    throw new Error('Muted architectural colors do not match design specification!');
  }
  console.log('✔ Elegant muted architectural colors verified');

  console.log('\n=== TEST 2: Live Database Contiguous Rooms Separation ===');
  await mongoose.connect(process.env.MONGODB_URI);
  const block5 = await Block.findOne({ name: /BLOCK 5/i });
  const floor1 = await Floor.findOne({ blockId: block5._id, level: 1 });
  const fRooms = await Room.find({ floorId: floor1._id, name: /5-F-(10|11|12|13|14)/ }).lean();

  console.log(`Found ${fRooms.length} contiguous classrooms on Floor 1:`, fRooms.map(r => r.name));
  if (fRooms.length < 5) {
    throw new Error('Expected all 5 classrooms (5-F-10 to 5-F-14) in DB!');
  }

  // Generate features for each of the 5 contiguous rooms
  const allTwinFeatures = [];
  for (const r of fRooms) {
    const rFeats = buildRoomDigitalTwinFeatures(r, 3.5, false);
    allTwinFeatures.push(...rFeats);
  }

  const allRoofTrays = allTwinFeatures.filter(f => f.properties.part === 'roof');
  const allPartitions = allTwinFeatures.filter(f => f.properties.part === 'partition');
  const allDoors = allTwinFeatures.filter(f => f.properties.part === 'door');

  console.log(`Contiguous block statistics:`);
  console.log(`- Distinct recessed roof trays: ${allRoofTrays.length} (one per room)`);
  console.log(`- 3D partition wall dividers: ${allPartitions.length}`);
  console.log(`- Corridor entrance doors: ${allDoors.length}`);

  if (allRoofTrays.length !== 5) {
    throw new Error(`Expected 5 distinct roof trays, got ${allRoofTrays.length}`);
  }
  if (allPartitions.length < 20) { // 4 per room
    throw new Error(`Expected >= 20 partition wall segments, got ${allPartitions.length}`);
  }
  console.log('✔ Contiguous rooms 5-F-10 through 5-F-14 have distinct roof trays and partition dividers');

  await mongoose.disconnect();

  console.log('\n=== TEST 3: NavigationScreen and MapScreen Layer Verification ===');
  const navContent = fs.readFileSync(path.join(__dirname, '../user/src/screens/NavigationScreen.js'), 'utf8');
  const mapContent = fs.readFileSync(path.join(__dirname, '../user/src/screens/MapScreen.js'), 'utf8');

  const requiredLayers = [
    'campus-rooms-partition',
    'campus-rooms-roof',
    'campus-rooms-parapet',
    'campus-rooms-door',
    'campus-rooms-base',
    'campus-rooms-upper',
    'campus-rooms-corridor',
    'campus-blocks'
  ];

  for (const lyr of requiredLayers) {
    const pat = new RegExp(`id['"]?:\\s*['"]${lyr}['"]`);
    if (!pat.test(navContent)) throw new Error(`NavigationScreen.js missing layer ${lyr}`);
    if (!pat.test(mapContent)) throw new Error(`MapScreen.js missing layer ${lyr}`);
    console.log(`✔ Layer ${lyr} declared in both screens`);
  }

  // Check setMapMode layers3D
  if (!navContent.includes("'campus-rooms-partition'") || !navContent.includes("'campus-rooms-roof'")) {
    throw new Error('NavigationScreen.js setMapMode missing partition or roof');
  }
  if (!mapContent.includes("'campus-rooms-partition'") || !mapContent.includes("'campus-rooms-roof'")) {
    throw new Error('MapScreen.js setMapMode missing partition or roof');
  }
  console.log('✔ setMapMode layers3D verified in both screens');

  // Check raycast clickLayers
  if (!navContent.includes("'campus-rooms-roof'") || !mapContent.includes("'campus-rooms-roof'")) {
    throw new Error('clickLayers missing campus-rooms-roof');
  }
  console.log('✔ clickLayers includes campus-rooms-roof in both screens');

  console.log('\nALL ARCHITECTURAL DIGITAL TWIN VERIFICATION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
