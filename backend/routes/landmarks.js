const router = require('express').Router();
const Landmark = require('../models/Landmark');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all landmarks (filter by campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const landmarks = await Landmark.find(filter);
    res.json(landmarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single landmark
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const landmark = await Landmark.findById(req.params.id);
    if (!landmark) return res.status(404).json({ error: 'Landmark not found' });
    res.json(landmark);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create landmark
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const landmark = new Landmark(req.body);
    await landmark.save();
    res.status(201).json(landmark);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update landmark
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const landmark = await Landmark.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!landmark) return res.status(404).json({ error: 'Landmark not found' });
    res.json(landmark);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE landmark
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    await Landmark.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Landmark deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
