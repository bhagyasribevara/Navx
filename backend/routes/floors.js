const router = require('express').Router();
const Floor = require('../models/Floor');

// GET all floors (filter by blockId or campusId)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.blockId) filter.blockId = req.query.blockId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const floors = await Floor.find(filter).sort({ level: 1 });
    res.json(floors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single floor
router.get('/:id', async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);
    if (!floor) return res.status(404).json({ error: 'Floor not found' });
    res.json(floor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create floor
router.post('/', async (req, res) => {
  try {
    const floor = new Floor(req.body);
    await floor.save();
    res.status(201).json(floor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update floor
router.put('/:id', async (req, res) => {
  try {
    const floor = await Floor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!floor) return res.status(404).json({ error: 'Floor not found' });
    res.json(floor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE floor
router.delete('/:id', async (req, res) => {
  try {
    await Floor.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Floor deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
