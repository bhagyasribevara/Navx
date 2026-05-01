require('dotenv').config();
const mongoose = require('mongoose');
const Campus = require('./models/Campus');
const Block = require('./models/Block');
const Floor = require('./models/Floor');
const Room = require('./models/Room');
const NavNode = require('./models/NavNode');
const NavPath = require('./models/NavPath');
const QRCode = require('./models/QRCode');
const Beacon = require('./models/Beacon');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/navx';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Clear existing
    await Promise.all([
      Campus.deleteMany({}),
      Block.deleteMany({}),
      Floor.deleteMany({}),
      Room.deleteMany({}),
      NavNode.deleteMany({}),
      NavPath.deleteMany({}),
      QRCode.deleteMany({}),
      Beacon.deleteMany({})
    ]);
    console.log('🧹 Cleared existing data');

    // 1. Create Campus
    const campus = await Campus.create({
      name: 'Tech University Main Campus',
      description: 'The primary campus featuring state-of-the-art facilities.',
      address: '123 Innovation Drive, Tech City',
      location: { lat: 37.7749, lng: -122.4194 }
    });

    // 2. Create Block
    const block = await Block.create({
      campusId: campus._id,
      name: 'Engineering Building',
      description: 'Computer Science and Electrical Engineering block',
      shape: { type: 'rectangle', x: 100, y: 100, width: 600, height: 400, fill: '#4A90D9' }
    });

    // 3. Create Floor
    const floor = await Floor.create({
      campusId: campus._id,
      blockId: block._id,
      name: 'Ground Floor',
      level: 0,
      mapData: { width: 800, height: 600, gridSize: 20 }
    });

    // 4. Create Rooms
    const rooms = await Room.insertMany([
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Main Entrance', type: 'entrance', shape: { type: 'rectangle', x: 360, y: 500, width: 80, height: 40 }, roomNumber: 'G-ENT' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Lobby', type: 'corridor', shape: { type: 'rectangle', x: 300, y: 400, width: 200, height: 100 }, roomNumber: 'G-LBY' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'CS Lecture Hall 1', type: 'auditorium', shape: { type: 'rectangle', x: 100, y: 300, width: 160, height: 120 }, roomNumber: 'G-101', capacity: 150 },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Robotics Lab', type: 'lab', shape: { type: 'rectangle', x: 540, y: 300, width: 160, height: 120 }, roomNumber: 'G-102' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Cafeteria', type: 'cafeteria', shape: { type: 'rectangle', x: 100, y: 100, width: 200, height: 150 }, roomNumber: 'G-CAF' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Restrooms', type: 'restroom', shape: { type: 'rectangle', x: 540, y: 150, width: 100, height: 80 }, roomNumber: 'G-RST' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, name: 'Elevator A', type: 'elevator', shape: { type: 'rectangle', x: 400, y: 200, width: 60, height: 60 }, roomNumber: 'G-ELV1' }
    ]);

    const [entrance, lobby, lectureHall, lab, cafeteria, restroom, elevator] = rooms;

    // 5. Create Nodes
    const nodes = await NavNode.insertMany([
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 400, y: 520, type: 'entrance', label: 'Entrance', roomId: entrance._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 400, y: 450, type: 'intersection', label: 'Lobby Center', roomId: lobby._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 260, y: 450, type: 'waypoint' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 260, y: 360, type: 'room_entry', label: 'Hall 1 Door', roomId: lectureHall._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 540, y: 450, type: 'waypoint' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 540, y: 360, type: 'room_entry', label: 'Lab Door', roomId: lab._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 400, y: 350, type: 'intersection' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 300, y: 350, type: 'waypoint' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 300, y: 200, type: 'room_entry', label: 'Cafe Door', roomId: cafeteria._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 500, y: 350, type: 'waypoint' },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 500, y: 200, type: 'room_entry', label: 'Restroom Door', roomId: restroom._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, x: 400, y: 280, type: 'room_entry', label: 'Elevator', roomId: elevator._id }
    ]);

    const [nEnt, nLobby, nLeft, nHall, nRight, nLab, nMid, nCafeWay, nCafe, nRestWay, nRest, nElev] = nodes;

    // Helper to calc distance
    const dist = (n1, n2) => Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));

    // 6. Create Paths
    await NavPath.insertMany([
      { campusId: campus._id, floorId: floor._id, nodeA: nEnt._id, nodeB: nLobby._id, distance: dist(nEnt, nLobby), type: 'hallway' },
      
      // Left wing
      { campusId: campus._id, floorId: floor._id, nodeA: nLobby._id, nodeB: nLeft._id, distance: dist(nLobby, nLeft), type: 'hallway' },
      { campusId: campus._id, floorId: floor._id, nodeA: nLeft._id, nodeB: nHall._id, distance: dist(nLeft, nHall), type: 'hallway' },
      
      // Right wing
      { campusId: campus._id, floorId: floor._id, nodeA: nLobby._id, nodeB: nRight._id, distance: dist(nLobby, nRight), type: 'hallway' },
      { campusId: campus._id, floorId: floor._id, nodeA: nRight._id, nodeB: nLab._id, distance: dist(nRight, nLab), type: 'hallway' },
      
      // Middle corridor up
      { campusId: campus._id, floorId: floor._id, nodeA: nLobby._id, nodeB: nMid._id, distance: dist(nLobby, nMid), type: 'hallway' },
      { campusId: campus._id, floorId: floor._id, nodeA: nMid._id, nodeB: nElev._id, distance: dist(nMid, nElev), type: 'hallway' },
      
      // Cafe
      { campusId: campus._id, floorId: floor._id, nodeA: nMid._id, nodeB: nCafeWay._id, distance: dist(nMid, nCafeWay), type: 'hallway' },
      { campusId: campus._id, floorId: floor._id, nodeA: nCafeWay._id, nodeB: nCafe._id, distance: dist(nCafeWay, nCafe), type: 'hallway' },
      
      // Restroom
      { campusId: campus._id, floorId: floor._id, nodeA: nMid._id, nodeB: nRestWay._id, distance: dist(nMid, nRestWay), type: 'hallway' },
      { campusId: campus._id, floorId: floor._id, nodeA: nRestWay._id, nodeB: nRest._id, distance: dist(nRestWay, nRest), type: 'hallway' }
    ]);

    // 7. Create QR Codes
    await QRCode.insertMany([
      { campusId: campus._id, blockId: block._id, floorId: floor._id, code: 'NAVX-ENTRANCE', label: 'Main Entrance QR', position: { x: 400, y: 520 }, nearestNodeId: nEnt._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, code: 'NAVX-LOBBY', label: 'Lobby Info Desk', position: { x: 400, y: 450 }, nearestNodeId: nLobby._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, code: 'NAVX-CAFETERIA', label: 'Cafeteria Entrance', position: { x: 300, y: 200 }, nearestNodeId: nCafe._id }
    ]);

    // 8. Create Beacons
    await Beacon.insertMany([
      { campusId: campus._id, blockId: block._id, floorId: floor._id, beaconId: 'BLE-LOBBY', uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D', major: 1, minor: 1, label: 'Lobby Beacon', position: { x: 400, y: 450 }, nearestNodeId: nLobby._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, beaconId: 'BLE-WEST', uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D', major: 1, minor: 2, label: 'West Corridor', position: { x: 260, y: 450 }, nearestNodeId: nLeft._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, beaconId: 'BLE-EAST', uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D', major: 1, minor: 3, label: 'East Corridor', position: { x: 540, y: 450 }, nearestNodeId: nRight._id },
      { campusId: campus._id, blockId: block._id, floorId: floor._id, beaconId: 'BLE-NORTH', uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D', major: 1, minor: 4, label: 'North Hub', position: { x: 400, y: 250 }, nearestNodeId: nMid._id }
    ]);

    console.log('🌱 Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();
