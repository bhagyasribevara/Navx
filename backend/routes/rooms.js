const router = require('express').Router();
const Room = require('../models/Room');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all rooms (filter by floorId, blockId, campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.type) filter.type = req.query.type;
    const rooms = await Room.find(filter)
      .populate('floorId', 'name level')
      .populate('blockId', 'name')
      .sort({ name: 1 });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// GET search rooms
router.get('/search/:query', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const query = req.params.query;
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    
    const Block = require('../models/Block');

    // Clean and split the query for flexible matching
    const cleanQuery = query.trim().replace(/\s+/g, ' ');
    if (!cleanQuery) return res.json([]);

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedWords = cleanQuery.split(' ').map(w => escapeRegExp(w));
    const regex = new RegExp(escapedWords.map(w => `(?=.*${w})`).join(''), 'i');

    const matchingBlocks = await Block.find({
      ...filter,
      name: { $regex: regex }
    });
    const blockIds = matchingBlocks.map(b => b._id);

    const rooms = await Room.find({
      ...filter,
      $or: [
        { name: { $regex: regex } },
        { roomNumber: { $regex: regex } },
        { description: { $regex: regex } },
        { type: { $regex: regex } },
        ...(blockIds.length > 0 ? [{ blockId: { $in: blockIds } }] : [])
      ]
    })
    .populate('floorId', 'name level')
    .populate('blockId', 'name')
    .limit(20);
    
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// GET single room
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('floorId', 'name level')
      .populate('blockId', 'name');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    next(err);
  }
});

// POST create room
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update room
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    console.log(`[UPDATE ROOM] Received shape for ${req.params.id}:`, JSON.stringify(req.body.shape));
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    console.log(`[UPDATE ROOM] Saved shape:`, JSON.stringify(room.shape));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    // Auto-sync stairs navigation nodes/paths
    if (room.type === 'stairs' && room.stairsConfig) {
      await syncStairsNavigation(room);
    }
    
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE room
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { isActive: false });
    
    // Deactivate associated navigation nodes and paths
    const NavNode = require('../models/NavNode');
    const NavPath = require('../models/NavPath');
    const nodes = await NavNode.find({ roomId: req.params.id });
    const nodeIds = nodes.map(n => n._id);
    await NavNode.updateMany({ roomId: req.params.id }, { isActive: false });
    await NavPath.updateMany({ $or: [{ nodeA: { $in: nodeIds } }, { nodeB: { $in: nodeIds } }] }, { isActive: false });

    res.json({ message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
});

async function syncStairsNavigation(room) {
  try {
    if (room.type !== 'stairs' || !room.stairsConfig || !room.stairsConfig.startFloorId || !room.stairsConfig.endFloorId) {
      return;
    }
    const pts = room.shape?.points;
    if (!pts || pts.length < 4) return;

    const NavNode = require('../models/NavNode');
    const NavPath = require('../models/NavPath');
    const Floor = require('../models/Floor');

    // Calculate midpoints of opposite sides to find bottom and top center coords
    const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const m2 = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
    const m3 = { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2 };
    const m4 = { x: (pts[3].x + (pts[4] || pts[0]).x) / 2, y: (pts[3].y + (pts[4] || pts[0]).y) / 2 };

    const d13 = Math.sqrt(Math.pow(m1.x - m3.x, 2) + Math.pow(m1.y - m3.y, 2));
    const d24 = Math.sqrt(Math.pow(m2.x - m4.x, 2) + Math.pow(m2.y - m4.y, 2));

    let startPoint, endPoint;
    if (d13 >= d24) {
      startPoint = m1;
      endPoint = m3;
    } else {
      startPoint = m2;
      endPoint = m4;
    }

    // Find or create bottom node
    let nodeA = await NavNode.findOne({ roomId: room._id, floorId: room.stairsConfig.startFloorId, isActive: true });
    if (!nodeA) {
      nodeA = new NavNode({
        floorId: room.stairsConfig.startFloorId,
        blockId: room.blockId,
        campusId: room.campusId,
        type: 'stairs',
        roomId: room._id,
        label: `${room.name} (Bottom)`
      });
    }
    nodeA.x = startPoint.x;
    nodeA.y = startPoint.y;
    await nodeA.save();

    // Find or create top node
    let nodeB = await NavNode.findOne({ roomId: room._id, floorId: room.stairsConfig.endFloorId, isActive: true });
    if (!nodeB) {
      nodeB = new NavNode({
        floorId: room.stairsConfig.endFloorId,
        blockId: room.blockId,
        campusId: room.campusId,
        type: 'stairs',
        roomId: room._id,
        label: `${room.name} (Top)`
      });
    }
    nodeB.x = endPoint.x;
    nodeB.y = endPoint.y;
    await nodeB.save();

    // Link floor connections
    nodeA.connectedFloorNodeId = nodeB._id;
    nodeA.connectedFloorId = nodeB.floorId;
    await nodeA.save();

    nodeB.connectedFloorNodeId = nodeA._id;
    nodeB.connectedFloorId = nodeA.floorId;
    await nodeB.save();

    // Calculate 3D distance
    const dx = (nodeA.x - nodeB.x) * 111320;
    const dy = (nodeA.y - nodeB.y) * 111320 * Math.cos(nodeA.x * Math.PI / 180);
    const horizDist = Math.sqrt(dx * dx + dy * dy);

    const startFloorObj = await Floor.findById(nodeA.floorId);
    const endFloorObj = await Floor.findById(nodeB.floorId);
    const heightDiff = Math.abs((startFloorObj?.level || 0) - (endFloorObj?.level || 0)) * 3.5;
    const distance = Math.round(Math.sqrt(horizDist * horizDist + heightDiff * heightDiff));

    // Find or create cross-floor navigation path
    let path = await NavPath.findOne({
      $or: [
        { nodeA: nodeA._id, nodeB: nodeB._id },
        { nodeA: nodeB._id, nodeB: nodeA._id }
      ],
      isActive: true
    });
    if (!path) {
      path = new NavPath({
        campusId: room.campusId,
        nodeA: nodeA._id,
        nodeB: nodeB._id,
        type: 'stairs',
        bidirectional: true
      });
    }
    path.distance = distance || 1;
    path.floorId = null; // null for multi-floor path
    await path.save();
  } catch (err) {
    console.error('Error synchronizing stairs navigation:', err);
  }
}

// DELETE stairs/elevator from a specific floor (adds floor to excludedFloors)
router.delete('/:id/floor/:floorId', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!['stairs', 'elevator'].includes(room.type)) {
      return res.status(400).json({ error: 'Per-floor deletion is only available for stairs and elevators' });
    }
    const floorId = req.params.floorId;
    if (!room.excludedFloors) room.excludedFloors = [];
    if (!room.excludedFloors.map(f => f.toString()).includes(floorId)) {
      room.excludedFloors.push(floorId);
    }
    await room.save();
    res.json({ message: `Stairs removed from floor ${floorId}`, room });
  } catch (err) {
    next(err);
  }
});

// RESTORE stairs/elevator to a specific floor (removes floor from excludedFloors)
router.put('/:id/floor/:floorId/restore', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    room.excludedFloors = (room.excludedFloors || []).filter(
      f => f.toString() !== req.params.floorId
    );
    await room.save();
    res.json({ message: `Stairs restored to floor ${req.params.floorId}`, room });
  } catch (err) {
    next(err);
  }
});

// GET excluded floors for a specific stairs/elevator room
router.get('/:id/excluded-floors', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('excludedFloors', 'name level');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ excludedFloors: room.excludedFloors || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
