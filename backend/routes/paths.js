const router = require('express').Router();
const NavPath = require('../models/NavPath');
const NavNode = require('../models/NavNode');

// GET all paths (filter by floorId, campusId)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) {
      filter.floorId = req.query.floorId === 'null' ? { $eq: null } : req.query.floorId;
    }
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const paths = await NavPath.find(filter);
    res.json(paths);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create path (auto-calculate distance)
router.post('/', async (req, res) => {
  try {
    const nodeA = await NavNode.findById(req.body.nodeA);
    const nodeB = await NavNode.findById(req.body.nodeB);
    
    if (!nodeA || !nodeB) {
      return res.status(400).json({ error: 'Invalid node IDs' });
    }
    
    // Auto-calculate distance in meters if not provided
    if (!req.body.distance) {
      const dx = (nodeA.x - nodeB.x) * 111320;
      const dy = (nodeA.y - nodeB.y) * 111320 * Math.cos(nodeA.x * Math.PI / 180);
      req.body.distance = Math.round(Math.sqrt(dx * dx + dy * dy));
    }
    
    const path = new NavPath(req.body);
    await path.save();
    res.status(201).json(path);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk create paths
router.post('/bulk', async (req, res) => {
  try {
    const paths = await NavPath.insertMany(req.body.paths);
    res.status(201).json(paths);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update path
router.put('/:id', async (req, res) => {
  try {
    const path = await NavPath.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!path) return res.status(404).json({ error: 'Path not found' });
    res.json(path);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE path
router.delete('/:id', async (req, res) => {
  try {
    await NavPath.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Path deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
