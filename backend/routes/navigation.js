const router = require('express').Router();
const NavNode = require('../models/NavNode');
const NavPath = require('../models/NavPath');
const Room = require('../models/Room');
const { buildGraph, astar, dijkstra, findNearestNode, generateDirections } = require('../utils/pathfinding');

// POST find route between two points
router.post('/route', async (req, res) => {
  try {
    const { startNodeId, endNodeId, campusId, algorithm = 'astar', accessible = false } = req.body;
    
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });
    
    if (nodes.length === 0) return res.status(400).json({ error: 'No navigation nodes found' });
    
    const graph = buildGraph(nodes, paths);
    const pathfinder = algorithm === 'dijkstra' ? dijkstra : astar;
    const result = pathfinder(graph, startNodeId, endNodeId, { requireAccessible: accessible });
    
    if (!result.found) return res.status(404).json({ error: 'No route found' });
    
    const directions = generateDirections(result.path);
    const walkingSpeed = 1.2;
    const eta = Math.round(result.distance / walkingSpeed);
    
    res.json({ ...result, directions, eta, algorithm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST find route to a room
router.post('/route-to-room', async (req, res) => {
  try {
    const { startNodeId, roomId, campusId, algorithm = 'astar', accessible = false } = req.body;
    
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });
    const graph = buildGraph(nodes, paths);

    let endNodeId = null;
    const roomNode = await NavNode.findOne({ roomId, isActive: true });
    
    if (roomNode) {
      endNodeId = roomNode._id.toString();
    } else {
      // Fallback: Find nearest node to the room's location
      const room = await Room.findById(roomId);
      if (!room || !room.shape) return res.status(404).json({ error: 'Room not found or lacks geometry' });
      
      let destX = room.shape.x;
      let destY = room.shape.y;
      if (room.shape.points && room.shape.points.length > 0) {
        destX = room.shape.points[0].x;
        destY = room.shape.points[0].y;
      }
      
      const nearest = findNearestNode(graph, destX, destY, room.floorId ? room.floorId.toString() : null);
      if (!nearest) return res.status(404).json({ error: 'No navigation nodes near destination' });
      endNodeId = nearest.id;
    }
    
    const pathfinder = algorithm === 'dijkstra' ? dijkstra : astar;
    const result = pathfinder(graph, startNodeId, endNodeId, { requireAccessible: accessible });
    
    if (!result.found) return res.status(404).json({ error: 'No route found to this room' });
    
    const directions = generateDirections(result.path);
    const eta = Math.round(result.distance / 1.2);
    
    res.json({ ...result, directions, eta, roomId, algorithm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST find nearest node to coordinates
router.post('/nearest-node', async (req, res) => {
  try {
    const { x, y, floorId, campusId } = req.body;
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });
    const graph = buildGraph(nodes, paths);
    const nearest = findNearestNode(graph, x, y, floorId);
    if (!nearest) return res.status(404).json({ error: 'No nodes found' });
    res.json(nearest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET full navigation data for a campus (mobile app bulk download)
router.get('/map-data/:campusId', async (req, res) => {
  try {
    const { campusId } = req.params;
    const [nodes, paths, rooms, qrcodes, beacons] = await Promise.all([
      NavNode.find({ campusId, isActive: true }),
      NavPath.find({ campusId, isActive: true }),
      Room.find({ campusId, isActive: true }),
      require('../models/QRCode').find({ campusId, isActive: true }),
      require('../models/Beacon').find({ campusId, isActive: true })
    ]);
    
    const Block = require('../models/Block');
    const Floor = require('../models/Floor');
    const blocks = await Block.find({ campusId, isActive: true });
    const floors = await Floor.find({ campusId, isActive: true });
    
    res.json({ nodes, paths, rooms, qrcodes, beacons, blocks, floors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
