const router = require('express').Router();
const Campus = require('../models/Campus');
const Block = require('../models/Block');
const Room = require('../models/Room');
const NavPath = require('../models/NavPath');
const MapLayer = require('../models/MapLayer');
const Admin = require('../models/Admin');
const qrcode = require('qrcode');
const { authenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all campuses (Phase 13: Scalability - public)
router.get('/', async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true, status: 'active' }).sort({ createdAt: 1 });
    res.json(campuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single campus by campusCode (Phase 3: Dynamic Route Resolution)
router.get('/code/:campusCode', async (req, res) => {
  try {
    const campus = await Campus.findOne({ campusCode: req.params.campusCode.toLowerCase() });
    if (!campus) {
      return res.status(404).json({ error: 'Campus Not Found' });
    }
    if (campus.status === 'disabled') {
      return res.status(403).json({ error: 'Campus has been disabled by administrator.' });
    }
    res.json(campus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single campus by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    if (campus.status === 'disabled') {
      return res.status(403).json({ error: 'Campus is disabled' });
    }
    res.json(campus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create campus (SuperAdmin only)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { name, campusName, campusCode, address, venueType } = req.body;
    
    if (!campusCode) {
      return res.status(400).json({ error: 'Campus Code is required' });
    }

    const existingCampus = await Campus.findOne({ $or: [{ name }, { campusName }, { campusCode }] });
    
    if (existingCampus) {
      if (!existingCampus.isActive) {
        // Reactivate soft-deleted campus
        const updatedCampus = await Campus.findByIdAndUpdate(
          existingCampus._id, 
          { ...req.body, isActive: true, status: 'active' }, 
          { new: true }
        );
        return res.status(201).json(updatedCampus);
      } else {
        return res.status(400).json({ error: 'A campus with this name or code already exists.' });
      }
    }
    
    const hostBase = process.env.ADMIN_URL_BASE || 'https://admin.navx.com';
    const adminUrl = `${hostBase}/campus/${campusCode.toLowerCase()}`;

    const campus = new Campus({
      ...req.body,
      name: name || campusName,
      campusName: campusName || name,
      campusCode: campusCode.toLowerCase(),
      adminUrl,
      status: 'active'
    });

    await campus.save();
    res.status(201).json(campus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST regenerate campus URL (Phase 11: URL Regeneration - SuperAdmin only)
router.post('/:id/regenerate-url', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { campusCode } = req.body;
    if (!campusCode) {
      return res.status(400).json({ error: 'Campus Code is required' });
    }

    const codeRegex = /^[a-z0-9-_]+$/;
    if (!codeRegex.test(campusCode)) {
      return res.status(400).json({ error: 'Campus Code must contain only lowercase letters, numbers, hyphens, and underscores.' });
    }

    const existingCampus = await Campus.findOne({ campusCode, _id: { $ne: req.params.id } });
    if (existingCampus) {
      return res.status(400).json({ error: `Campus Code '${campusCode}' is already in use.` });
    }

    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ error: 'Campus not found' });
    }

    const hostBase = process.env.ADMIN_URL_BASE || 'https://admin.navx.com';
    campus.campusCode = campusCode.toLowerCase();
    campus.adminUrl = `${hostBase}/campus/${campusCode.toLowerCase()}`;
    await campus.save();

    // Invalidate current sessions if a campus admin exists
    if (campus.adminId) {
      const admin = await Admin.findById(campus.adminId);
      if (admin) {
        admin.sessionVersion += 1;
        await admin.save();
      }
    }

    res.json({ success: true, campus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update campus details
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE campus (SuperAdmin only)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    await Campus.findByIdAndUpdate(req.params.id, { isActive: false, status: 'disabled' });
    res.json({ message: 'Campus deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST trigger emergency (Phase 12: Campus Level Authorization)
router.post('/:id/emergency', authenticateJWT, enforceCampusIsolation, async (req, res) => {
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

// POST verify campus QR with geofence — location-based access control
router.post('/qr/:campusId/verify', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ authorized: false, message: 'User location (lat, lng) is required.' });
    }

    const campus = await Campus.findById(req.params.campusId);
    if (!campus || !campus.isActive) {
      return res.status(404).json({ authorized: false, message: 'Campus not found or inactive.' });
    }

    // Campus must have a geofence configured (location + radius)
    if (!campus.location?.lat || !campus.location?.lng || !campus.radius) {
      // No geofence configured — allow access (admin hasn't drawn boundary yet)
      return res.json({
        authorized: true,
        campus: {
          _id: campus._id,
          name: campus.name,
          description: campus.description,
          address: campus.address,
          location: campus.location,
          radius: campus.radius,
          venueType: campus.venueType || 'campus',
        },
        message: 'No geofence configured — access granted.',
      });
    }

    // Haversine distance calculation
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat * Math.PI) / 180;
    const φ2 = (campus.location.lat * Math.PI) / 180;
    const Δφ = ((campus.location.lat - lat) * Math.PI) / 180;
    const Δλ = ((campus.location.lng - lng) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // distance in meters

    if (distance <= campus.radius) {
      return res.json({
        authorized: true,
        distance: Math.round(distance),
        campus: {
          _id: campus._id,
          name: campus.name,
          description: campus.description,
          address: campus.address,
          location: campus.location,
          radius: campus.radius,
          venueType: campus.venueType || 'campus',
        },
      });
    } else {
      return res.json({
        authorized: false,
        distance: Math.round(distance),
        radius: campus.radius,
        campusName: campus.name,
        message: `You are ${Math.round(distance)}m away from ${campus.name}. You must be within ${campus.radius}m to access campus data.`,
      });
    }
  } catch (err) {
    res.status(400).json({ authorized: false, message: 'Invalid campus QR code.' });
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

// POST generate & save campus entry QR code to DB (Admin)
router.post('/:id/campus-qr', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });

    const qrData = `navx://campus/${campus._id}`;
    const image = await qrcode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });

    campus.campusQRImage = image;
    await campus.save();

    res.json({ success: true, image, campusId: campus._id, campusName: campus.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET retrieve saved campus QR image
router.get('/:id/campus-qr', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id).select('campusQRImage name _id');
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json({ image: campus.campusQRImage, campusName: campus.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
