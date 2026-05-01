const router = require('express').Router();
const NavNode = require('../models/NavNode');

// GET all nodes (filter by floorId, campusId)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    const nodes = await NavNode.find(filter);
    res.json(nodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single node
router.get('/:id', async (req, res) => {
  try {
    const node = await NavNode.findById(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create node
router.post('/', async (req, res) => {
  try {
    const node = new NavNode(req.body);
    await node.save();
    res.status(201).json(node);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk create nodes
router.post('/bulk', async (req, res) => {
  try {
    const nodes = await NavNode.insertMany(req.body.nodes);
    res.status(201).json(nodes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update node
router.put('/:id', async (req, res) => {
  try {
    const node = await NavNode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE node
router.delete('/:id', async (req, res) => {
  try {
    await NavNode.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Node deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
