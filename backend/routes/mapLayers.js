const router = require('express').Router();
const MapLayer = require('../models/MapLayer');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// Get all map layers for a campus
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const { campusId } = req.query;
    if (!campusId) return res.status(400).json({ error: 'campusId is required' });
    
    const layers = await MapLayer.find({ campusId, isActive: true });
    res.json(layers);
  } catch (err) {
    next(err);
  }
});

// Create a new map layer
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const layer = new MapLayer(req.body);
    const saved = await layer.save();
    
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a map layer
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const updated = await MapLayer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Layer not found' });
    
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a map layer
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const layer = await MapLayer.findById(req.params.id);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });
    
    layer.isActive = false;
    await layer.save();
    
    res.json({ message: 'Map layer deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
