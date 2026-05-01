const router = require('express').Router();
const Campus = require('../models/Campus');

// GET all campuses
router.get('/', async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(campuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single campus
router.get('/:id', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create campus
router.post('/', async (req, res) => {
  try {
    const campus = new Campus(req.body);
    await campus.save();
    res.status(201).json(campus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update campus
router.put('/:id', async (req, res) => {
  try {
    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE campus
router.delete('/:id', async (req, res) => {
  try {
    await Campus.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Campus deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
