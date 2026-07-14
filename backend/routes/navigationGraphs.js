const router = require('express').Router();
const NavigationGraph = require('../models/NavigationGraph');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all navigation graphs (filter by campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const graphs = await NavigationGraph.find(filter);
    res.json(graphs);
  } catch (err) {
    next(err);
  }
});

// GET single navigation graph
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const graph = await NavigationGraph.findById(req.params.id);
    if (!graph) return res.status(404).json({ error: 'Navigation graph not found' });
    res.json(graph);
  } catch (err) {
    next(err);
  }
});

// POST create navigation graph
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const graph = new NavigationGraph(req.body);
    await graph.save();
    res.status(201).json(graph);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update navigation graph
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const graph = await NavigationGraph.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!graph) return res.status(404).json({ error: 'Navigation graph not found' });
    res.json(graph);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE navigation graph
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    await NavigationGraph.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Navigation graph deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
