const router = require('express').Router();
const NavNode = require('../models/NavNode');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all nodes (filter by floorId, campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId && req.query.floorId !== 'null' && req.query.blockId) {
      filter.$or = [
        { floorId: req.query.floorId },
        { blockId: req.query.blockId, type: { $in: ['stairs', 'elevator'] } }
      ];
    } else {
      if (req.query.floorId) {
        filter.floorId = req.query.floorId === 'null' ? { $eq: null } : req.query.floorId;
      }
      if (req.query.campusId) filter.campusId = req.query.campusId;
      if (req.query.blockId) filter.blockId = req.query.blockId;
    }
    const nodes = await NavNode.find(filter);
    res.json(nodes);
  } catch (err) {
    next(err);
  }
});

// GET single node
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const node = await NavNode.findById(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  } catch (err) {
    next(err);
  }
});

// POST create node
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const node = new NavNode(req.body);
    await node.save();
    res.status(201).json(node);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST bulk create nodes
router.post('/bulk', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const nodesArray = req.body.nodes;
    if (req.admin.role !== 'SuperAdmin' && req.admin.campusId) {
      // Force campusId on all bulk items (Phase 12: Security Protection)
      req.body.nodes = nodesArray.map(n => ({ ...n, campusId: req.admin.campusId }));
    }
    const nodes = await NavNode.insertMany(req.body.nodes);
    res.status(201).json(nodes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update node
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const node = await NavNode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE node
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    await NavNode.findByIdAndUpdate(req.params.id, { isActive: false });
    
    // Also delete any paths connected to this node
    const NavPath = require('../models/NavPath');
    await NavPath.updateMany(
      { $or: [{ nodeA: req.params.id }, { nodeB: req.params.id }] },
      { isActive: false }
    );

    res.json({ message: 'Node and connected paths deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
