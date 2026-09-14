const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Campus = require('../backend/models/Campus');
const Block = require('../backend/models/Block');
const Room = require('../backend/models/Room');
const Floor = require('../backend/models/Floor');

// Test ProceduralDigitalTwinEngine functions directly
const {
  CATEGORY_PALETTE,
  TARGET_HIGHLIGHT_PALETTE,
  snapCoord,
  snapPolygonRing,
  areEdgesCollinear,
  resolveRoomCategory,
  buildRoomDigitalTwinFeatures,
  computeRoomLabelAnchor,
  raycastRoomHitTest
} = require('../user/src/components/ProceduralDigitalTwinEngine');

async function runTests() {
  console.log('=== TEST 1: ProceduralDigitalTwinEngine Unit Tests ===');
  
  // 1. Vertex Snapping Test
  const coordA = [83.37521012, 17.78123048];
  const coordB = [83.37521045, 17.78123072];
  const registry = [];
  const snappedA = snapCoord(coordA, registry);
  const snappedB = snapCoord(coordB, registry);
  console.log('Snap test:', { coordA, coordB, snappedA, snappedB, equal: snappedA[0] === snappedB[0] && snappedA[1] === snappedB[1] });
  if (snappedA[0] !== snappedB[0] || snappedA[1] !== snappedB[1]) {
    throw new Error('Vertex snapping failed to reconcile nearby coordinates within epsilon!');
  }
  console.log('✔ Vertex snapping passed');

  // 2. Category Resolution Test
  const catTests = [
    { room: { name: '5-G-03 Class', category: 'classroom' }, expected: 'classroom' },
    { room: { name: 'Main Corridor Ground Floor', category: 'corridor' }, expected: 'corridor' },
    { room: { name: 'IBM Software Lab', category: 'lab' }, expected: 'computer_lab' },
    { room: { name: 'LADIES WASHROOM', category: 'washroom' }, expected: 'restroom' },
    { room: { name: 'CSE Seminar Hall', category: 'seminar' }, expected: 'seminar_hall' },
    { room: { name: 'Staff Room Block 5', category: 'office' }, expected: 'staff_room' }
  ];
  for (const t of catTests) {
    const res = resolveRoomCategory(t.room);
    if (res !== t.expected) {
      throw new Error(`Category resolution failed for ${t.room.name}: got ${res}, expected ${t.expected}`);
    }
  }
  console.log('✔ Category resolution passed for all test cases');

  // 3. Multi-Tier Extrusion Test for Classroom
  const mockClassroom = {
    _id: 'room_123',
    name: 'Classroom 5-G-01',
    category: 'classroom',
    shape: {
      points: [
        { lat: 17.7812, lng: 83.3752 },
        { lat: 17.7812, lng: 83.3754 },
        { lat: 17.7810, lng: 83.3754 },
        { lat: 17.7810, lng: 83.3752 }
      ]
    }
  };
  const classroomTiers = buildRoomDigitalTwinFeatures(mockClassroom, 0, false);
  console.log('Classroom multi-tier features count:', classroomTiers.length);
  if (classroomTiers.length !== 3) {
    throw new Error(`Expected 3 tiers for regular room, got ${classroomTiers.length}`);
  }
  const [baseTier, bodyTier, parapetTier] = classroomTiers;
  console.log('Base tier:', { part: baseTier.properties.part, minH: baseTier.properties.min_height, maxH: baseTier.properties.height, color: baseTier.properties.color });
  console.log('Body tier:', { part: bodyTier.properties.part, minH: bodyTier.properties.min_height, maxH: bodyTier.properties.height, color: bodyTier.properties.color });
  console.log('Parapet tier:', { part: parapetTier.properties.part, minH: parapetTier.properties.min_height, maxH: parapetTier.properties.height, color: parapetTier.properties.color });

  if (baseTier.properties.height !== 0.9 || bodyTier.properties.height !== 2.7 || parapetTier.properties.height !== 2.95) {
    throw new Error('Tier heights do not match architectural specification!');
  }
  console.log('✔ Multi-tier geometry heights verified (0-0.9m, 0.9-2.7m, 2.7-2.95m)');

  // 4. Corridor Flat Walkway Test
  const mockCorridor = {
    _id: 'corr_456',
    name: 'Block 5 Central Corridor',
    category: 'corridor',
    shape: {
      points: [
        { lat: 17.7811, lng: 83.37525 },
        { lat: 17.7811, lng: 83.37535 },
        { lat: 17.7809, lng: 83.37535 },
        { lat: 17.7809, lng: 83.37525 }
      ]
    }
  };
  const corridorFeatures = buildRoomDigitalTwinFeatures(mockCorridor, 0, false);
  if (corridorFeatures.length !== 1 || corridorFeatures[0].properties.part !== 'corridor' || corridorFeatures[0].properties.height !== 0.04) {
    throw new Error('Corridor should produce single 0.04m floor slab feature!');
  }
  console.log('✔ Corridor flat walkway slab verified (part=corridor, height=0.04m)');

  // 5. Target Room Highlight Test
  const targetTiers = buildRoomDigitalTwinFeatures(mockClassroom, 0, true);
  if (targetTiers[1].properties.color !== TARGET_HIGHLIGHT_PALETTE.body || targetTiers[2].properties.color !== TARGET_HIGHLIGHT_PALETTE.parapet) {
    throw new Error('Target room highlight did not apply vibrant rose accent colors!');
  }
  console.log('✔ Target room highlight verified (body=#f43f5e, parapet=#be123c)');

  // 6. Raycasting Hit-Test
  const hit = raycastRoomHitTest([83.3753, 17.7811], classroomTiers);
  console.log('Raycasting hit test result:', hit ? hit.properties.name : null);
  if (!hit || hit.properties.roomId !== 'room_123') {
    throw new Error('Raycasting hit-test failed to detect click inside room boundary!');
  }
  const miss = raycastRoomHitTest([83.3755, 17.7811], classroomTiers);
  if (miss !== null) {
    throw new Error('Raycasting hit-test falsely detected point outside boundary!');
  }
  console.log('✔ Raycasting point-in-polygon hit-test verified');

  console.log('\n=== TEST 2: Backend GeoJSON Digital Twin Pipeline ===');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('No MONGODB_URI found, skipping DB check');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected successfully');

  // Check Block 5 rooms in DB
  const block5 = await Block.findOne({ name: /BLOCK 5/i });
  console.log('Block 5 found:', block5 ? `${block5.name} (id: ${block5._id})` : 'Not found');
  if (block5) {
    const rooms = await Room.find({ blockId: block5._id }).lean();
    console.log(`Block 5 total rooms: ${rooms.length}`);
    const nonCorridor = rooms.filter(r => !(r.category === 'corridor' || (r.name && r.name.toLowerCase().includes('corridor'))));
    const corridors = rooms.filter(r => r.category === 'corridor' || (r.name && r.name.toLowerCase().includes('corridor')));
    console.log(`- Non-corridor rooms: ${nonCorridor.length} (will generate ${nonCorridor.length * 3} multi-tier features)`);
    console.log(`- Corridors: ${corridors.length} (will generate ${corridors.length} flat floor slabs)`);
  }

  await mongoose.disconnect();
  console.log('All procedural twin checks passed successfully!');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
