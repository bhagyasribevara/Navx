const router = require('express').Router();
const Campus = require('../models/Campus');
const Block = require('../models/Block');
const Room = require('../models/Room');
const NavPath = require('../models/NavPath');
const MapLayer = require('../models/MapLayer');

// GET all campuses
router.get('/', async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true }).sort({ createdAt: 1 });
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
    const existingCampus = await Campus.findOne({ name: req.body.name });
    
    if (existingCampus) {
      if (!existingCampus.isActive) {
        // Reactivate soft-deleted campus
        const updatedCampus = await Campus.findByIdAndUpdate(
          existingCampus._id, 
          { ...req.body, isActive: true }, 
          { new: true }
        );
        return res.status(201).json(updatedCampus);
      } else {
        // Auto-append number to avoid E11000 failure
        let counter = 1;
        let newName = `${req.body.name} (${counter})`;
        while (await Campus.findOne({ name: newName })) {
          counter++;
          newName = `${req.body.name} (${counter})`;
        }
        req.body.name = newName;
      }
    }
    
    const campus = new Campus(req.body);
    await campus.save();
    res.status(201).json(campus);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A campus with this name already exists. Please choose a different name.' });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT update campus
router.put('/:id', async (req, res) => {
  try {
    if (req.body.name) {
      const existingCampus = await Campus.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
      if (existingCampus) {
        let counter = 1;
        let newName = `${req.body.name} (${counter})`;
        while (await Campus.findOne({ name: newName, _id: { $ne: req.params.id } })) {
          counter++;
          newName = `${req.body.name} (${counter})`;
        }
        req.body.name = newName;
      }
    }

    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A campus with this name already exists. Please choose a different name.' });
    }
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

// POST trigger emergency
router.post('/:id/emergency', async (req, res) => {
  try {
    const { isActive, message, type } = req.body;
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    
    campus.emergencyState = {
      isActive,
      message: message || '',
      type: type || 'Fire',
      timestamp: isActive ? new Date() : null
    };
    
    await campus.save();
    res.json({ success: true, emergencyState: campus.emergencyState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET campus by QR code — resolves QR data to campus info
router.get('/qr/:campusId', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.campusId);
    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found or inactive.' });
    }
    res.json({
      _id: campus._id,
      name: campus.name,
      description: campus.description,
      address: campus.address,
      location: campus.location,
      venueType: campus.venueType || 'campus',
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid QR code.' });
  }
});

// GET campus data as unified GeoJSON FeatureCollection
router.get('/geojson/:id', async (req, res) => {
  try {
    const campusId = req.params.id;
    const [blocks, rooms, paths, mapLayers] = await Promise.all([
      Block.find({ campusId, isActive: true }),
      Room.find({ campusId, isActive: true }),
      NavPath.find({ campusId, isActive: true }).populate('nodeA').populate('nodeB'),
      MapLayer.find({ campusId, isActive: true })
    ]);

    const features = [];

    // Convert Blocks to GeoJSON Polygons
    blocks.forEach(b => {
      if (b.shape && b.shape.points && b.shape.points.length >= 3) {
        const coords = b.shape.points.map(p => [p.y, p.x]);
        // Close the polygon
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { id: b._id, name: b.name, type: 'block', category: b.domain, color: b.shape.fill || '#64748b' }
        });
      }
    });

    // Convert Rooms to GeoJSON Polygons
    rooms.forEach(r => {
      if (r.shape && r.shape.points && r.shape.points.length >= 3) {
        const coords = r.shape.points.map(p => [p.y, p.x]);
        // Close the polygon
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { id: r._id, name: r.name, type: 'room', category: r.type, floorId: r.floorId }
        });
      }
    });

    // Convert NavPaths to GeoJSON LineStrings
    paths.forEach(p => {
      if (p.nodeA && p.nodeB) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[p.nodeA.y, p.nodeA.x], [p.nodeB.y, p.nodeB.x]] },
          properties: { id: p._id, name: 'Path', type: 'path', bidirectional: p.bidirectional, floorId: p.floorId }
        });
      }
    });

    // Convert custom MapLayers to GeoJSON
    mapLayers.forEach(l => {
      features.push({
        type: 'Feature',
        geometry: l.geometry,
        properties: { id: l._id, name: l.name, type: 'map_layer', category: l.category, color: l.color, ...l.properties }
      });
    });

    res.json({
      type: 'FeatureCollection',
      features
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST publish map to live
router.post('/:id/publish', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.id.toString()).emit('map_updated', { type: 'map_published' });
    }
    res.json({ success: true, message: 'Map published live successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
