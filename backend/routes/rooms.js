const router = require('express').Router();
const Room = require('../models/Room');

// GET all rooms (filter by floorId, blockId, campusId)
router.get('/', async (req, res) => {
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
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    
    const rooms = await Room.find({
      ...filter,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { roomNumber: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { type: { $regex: query, $options: 'i' } }
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update room
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    await Room.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE stairs/elevator from a specific floor (adds floor to excludedFloors)
router.delete('/:id/floor/:floorId', async (req, res) => {
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
router.put('/:id/floor/:floorId/restore', async (req, res) => {
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
router.get('/:id/excluded-floors', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('excludedFloors', 'name level');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ excludedFloors: room.excludedFloors || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
