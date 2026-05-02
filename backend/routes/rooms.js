const router = require('express').Router();
const Room = require('../models/Room');

// GET all rooms (filter by floorId, blockId, campusId)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const rooms = await Room.find(filter).sort({ name: 1 });
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

module.exports = router;
