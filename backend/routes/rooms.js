const router = require('express').Router();
const Room = require('../models/Room');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all rooms (filter by floorId, blockId, campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId && req.query.blockId) {
      filter.$or = [
        { floorId: req.query.floorId },
        { blockId: req.query.blockId, type: { $in: ['stairs', 'elevator'] }, excludedFloors: { $nin: [req.query.floorId] } }
      ];
    } else {
      if (req.query.floorId) filter.floorId = req.query.floorId;
      if (req.query.blockId) filter.blockId = req.query.blockId;
    }
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.type) filter.type = req.query.type;
    const rooms = await Room.find(filter)
      .populate('floorId', 'name level')
      .populate('blockId', 'name')
      .sort({ name: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET search rooms
router.get('/search/:query', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// GET single room
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('floorId', 'name level')
      .populate('blockId', 'name');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create room
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update room
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    console.log(`[UPDATE ROOM] Received shape for ${req.params.id}:`, JSON.stringify(req.body.shape));
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    console.log(`[UPDATE ROOM] Saved shape:`, JSON.stringify(room.shape));
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE room
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    await Room.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE stairs/elevator from a specific floor (adds floor to excludedFloors)
router.delete('/:id/floor/:floorId', authenticateJWT, enforceCampusIsolation, async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// RESTORE stairs/elevator to a specific floor (removes floor from excludedFloors)
router.put('/:id/floor/:floorId/restore', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    room.excludedFloors = (room.excludedFloors || []).filter(
      f => f.toString() !== req.params.floorId
    );
    await room.save();
    res.json({ message: `Stairs restored to floor ${req.params.floorId}`, room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET excluded floors for a specific stairs/elevator room
router.get('/:id/excluded-floors', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('excludedFloors', 'name level');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ excludedFloors: room.excludedFloors || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
