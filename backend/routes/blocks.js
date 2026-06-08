const router = require('express').Router();
const Block = require('../models/Block');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all blocks (optionally filter by campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const blocks = await Block.find(filter).sort({ order: 1 });
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single block
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create block
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const block = new Block(req.body);
    await block.save();
    res.status(201).json(block);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update block
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    console.log(`[UPDATE BLOCK] Received shape for ${req.params.id}:`, JSON.stringify(req.body.shape));
    const block = await Block.findByIdAndUpdate(req.params.id, req.body, { new: true });
    console.log(`[UPDATE BLOCK] Saved shape:`, JSON.stringify(block.shape));
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE block
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    await Block.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Block deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
