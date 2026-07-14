const router = require('express').Router();
const bcrypt = require('bcryptjs');
const Campus = require('../models/Campus');
const Block = require('../models/Block');
const Room = require('../models/Room');
const NavPath = require('../models/NavPath');
const MapLayer = require('../models/MapLayer');
const Admin = require('../models/Admin');
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');
const qrcode = require('qrcode');
const { authenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all campuses (Phase 13: Scalability - public)
router.get('/', async (req, res, next) => {
  try {
    const campuses = await Campus.find({ isActive: true, status: 'active' }).sort({ createdAt: 1 });
    res.json(campuses);
  } catch (err) {
    next(err);
  }
});

// GET single campus by campusCode (Phase 3: Dynamic Route Resolution)
router.get('/code/:campusCode', async (req, res, next) => {
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
    next(err);
  }
});

// GET single campus by ID (public)
router.get('/:id', async (req, res, next) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    if (campus.status === 'disabled') {
      return res.status(403).json({ error: 'Campus is disabled' });
    }
    res.json(campus);
  } catch (err) {
    next(err);
  }
});

// POST create campus (SuperAdmin only)
router.post('/', authenticateJWT, async (req, res, next) => {
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
router.post('/:id/regenerate-url', authenticateJWT, async (req, res, next) => {
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
    next(err);
  }
});

// PUT update campus details
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE campus (SuperAdmin only)
router.delete('/:id', authenticateJWT, async (req, res, next) => {
  try {
    if (req.admin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    await Campus.findByIdAndUpdate(req.params.id, { isActive: false, status: 'disabled' });
    res.json({ message: 'Campus deleted' });
  } catch (err) {
    next(err);
  }
});

// POST trigger emergency (Phase 12: Campus Level Authorization)
router.post('/:id/emergency', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
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
    next(err);
  }
});

// GET campus by QR code — resolves QR data to campus info
router.get('/qr/:campusId', async (req, res, next) => {
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
router.post('/qr/:campusId/verify', async (req, res, next) => {
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
router.get('/geojson/:id', async (req, res, next) => {
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
    next(err);
  }
});

// POST publish map to live
router.post('/:id/publish', async (req, res, next) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.id.toString()).emit('map_updated', { type: 'map_published' });
    }
    res.json({ success: true, message: 'Map published live successfully' });
  } catch (err) {
    next(err);
  }
});

// POST generate & save campus entry QR code to DB (Admin)
router.post('/:id/campus-qr', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
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
    next(err);
  }
});

// --- Campus Admin Faculty Management Routes ---

// GET all faculties for a campus
router.get('/:id/faculties', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const faculties = await Faculty.find({ campusId: req.params.id }).sort({ employeeId: 1 });
    
    // Dynamically calculate leave status based on today's substitutions and current period
    const todayStr = new Date().toISOString().split('T')[0];
    const TimetableSubstitution = require('../models/TimetableSubstitution');
    const todaySubs = await TimetableSubstitution.find({ campusId: req.params.id, date: todayStr }).populate('timetableId');
    
    const getCurrentPeriodNum = () => {
      const now = new Date();
      const t = now.getHours() * 60 + now.getMinutes();
      if (t >= 540 && t < 600) return 1;
      if (t >= 600 && t < 660) return 2;
      if (t >= 660 && t < 720) return 3;
      if (t >= 720 && t < 780) return 4;
      if (t >= 840 && t < 900) return 5;
      if (t >= 900 && t < 960) return 6;
      if (t >= 960 && t < 1020) return 7;
      return null;
    };
    
    const currentPeriod = getCurrentPeriodNum();
    
    const processedFaculties = faculties.map(f => {
      const hasActiveSubNow = todaySubs.some(s => 
        s.originalFacultyId.toString() === f._id.toString() && 
        s.timetableId && 
        s.timetableId.period === currentPeriod
      );
      
      const fObj = f.toObject();
      fObj.leaveStatus = hasActiveSubNow ? 'On Leave' : 'Present';
      return fObj;
    });

    res.json({ success: true, faculties: processedFaculties });
  } catch (err) {
    next(err);
  }
});

// POST create a faculty
router.post('/:id/faculties', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const { name, employeeId, department, designation, email, phone, facultyRoom, officeHours, subjects, assignedSections, username, password, maxWeeklyHours, assignedSubjectsSections } = req.body;
    
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const faculty = new Faculty({
      campusId: req.params.id,
      name,
      employeeId,
      department,
      designation,
      email,
      phone,
      facultyRoom,
      officeHours,
      subjects: Array.isArray(subjects) ? subjects : [],
      assignedSections: Array.isArray(assignedSections) ? assignedSections : [],
      username,
      password: hashedPassword,
      status: 'active',
      maxWeeklyHours: maxWeeklyHours !== undefined ? Number(maxWeeklyHours) : 16,
      assignedSubjectsSections: Array.isArray(assignedSubjectsSections) ? assignedSubjectsSections : []
    });

    await faculty.save();
    res.status(201).json({ success: true, faculty });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update a faculty
router.put('/:id/faculties/:facultyId', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    
    // If a new password is provided, hash it
    if (updateData.password) {
      updateData.password = bcrypt.hashSync(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const faculty = await Faculty.findByIdAndUpdate(req.params.facultyId, updateData, { new: true });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    res.json({ success: true, faculty });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a faculty
router.delete('/:id/faculties/:facultyId', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    await Faculty.findByIdAndDelete(req.params.facultyId);
    res.json({ success: true, message: 'Faculty deleted' });
  } catch (err) {
    next(err);
  }
});

// POST reset faculty password
router.post('/:id/faculties/:facultyId/reset-password', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const faculty = await Faculty.findByIdAndUpdate(req.params.facultyId, { password: hashedPassword }, { new: true });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    res.json({ success: true, message: 'Password reset successful!' });
  } catch (err) {
    next(err);
  }
});

// --- Campus Admin Timetable Management Routes ---

// GET timetable slots
router.get('/:id/timetable', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const timetable = await Timetable.find({ campusId: req.params.id }).sort({ period: 1 });
    res.json({ success: true, timetable });
  } catch (err) {
    next(err);
  }
});

// POST allocate a slot
router.post('/:id/timetable', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const slot = new Timetable({
      campusId: req.params.id,
      ...req.body
    });
    await slot.save();
    res.status(201).json({ success: true, slot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a timetable slot
router.delete('/:id/timetable/:slotId', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    await Timetable.findByIdAndDelete(req.params.slotId);
    res.json({ success: true, message: 'Slot deleted' });
  } catch (err) {
    next(err);
  }
});

// --- Section Timings Routes ---
const SectionTiming = require('../models/SectionTiming');

// GET section timings
router.get('/:id/section-timings', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const { department, semester, section } = req.query;
    if (!department || !semester || !section) {
      return res.status(400).json({ error: 'Missing query constraints parameters.' });
    }
    const timingRecord = await SectionTiming.findOne({
      campusId: req.params.id,
      department,
      semester,
      section
    });
    res.json({ success: true, timings: timingRecord ? timingRecord.timings : null });
  } catch (err) {
    next(err);
  }
});

// POST save section timings
router.post('/:id/section-timings', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const { department, semester, section, timings } = req.body;
    if (!department || !semester || !section || !Array.isArray(timings)) {
      return res.status(400).json({ error: 'Missing timing payload constraints.' });
    }

    const timingRecord = await SectionTiming.findOneAndUpdate(
      { campusId: req.params.id, department, semester, section },
      { timings },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, timings: timingRecord.timings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
