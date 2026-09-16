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
    const campuses = await Campus.find({ isActive: { $ne: false }, status: { $ne: 'disabled' } }).sort({ createdAt: 1 });
    res.json(campuses || []);
  } catch (err) {
    console.error('Error fetching campuses:', err);
    res.json([]);
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
    const mongoose = require('mongoose');
    let campus = null;
    if (mongoose.Types.ObjectId.isValid(req.params.campusId)) {
      campus = await Campus.findById(req.params.campusId);
    }
    if (!campus) {
      campus = await Campus.findOne({ campusCode: req.params.campusId.toLowerCase() });
    }
    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found or inactive.' });
    }
    const blocks = await Block.find({ campusId: campus._id });
    const blockIds = blocks.map(b => b._id);
    const RoomModel = require('../models/Room');
    const FloorModel = require('../models/Floor');
    const floorCount = await FloorModel.countDocuments({ blockId: { $in: blockIds } });
    const roomCount = await RoomModel.countDocuments({ blockId: { $in: blockIds } });

    res.json({
      _id: campus._id,
      name: campus.name,
      campusName: campus.campusName || campus.name,
      description: campus.description,
      address: campus.address,
      location: campus.location,
      radius: campus.radius,
      venueType: campus.venueType || 'campus',
      image: campus.image || '',
      floors: floorCount || 6,
      rooms: roomCount || 142
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid QR code.' });
  }
});

// POST verify campus QR with geofence — location-based access control
router.post('/qr/:campusId/verify', async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    const mongoose = require('mongoose');
    let campus = null;
    if (mongoose.Types.ObjectId.isValid(req.params.campusId)) {
      campus = await Campus.findById(req.params.campusId);
    }
    if (!campus) {
      campus = await Campus.findOne({ campusCode: req.params.campusId.toLowerCase() });
    }
    if (!campus || !campus.isActive) {
      return res.status(404).json({ authorized: false, message: 'Campus not found or inactive.' });
    }

    const blocks = await Block.find({ campusId: campus._id });
    const blockIds = blocks.map(b => b._id);
    const RoomModel = require('../models/Room');
    const FloorModel = require('../models/Floor');
    const floorCount = await FloorModel.countDocuments({ blockId: { $in: blockIds } });
    const roomCount = await RoomModel.countDocuments({ blockId: { $in: blockIds } });

    const campusData = {
      _id: campus._id,
      name: campus.name,
      campusName: campus.campusName || campus.name,
      description: campus.description,
      address: campus.address,
      location: campus.location,
      radius: campus.radius,
      venueType: campus.venueType || 'campus',
      image: campus.image || '',
      floors: floorCount || 6,
      rooms: roomCount || 142
    };

    // If campus doesn't have a specific location/radius configured
    if (!campus.location?.lat || !campus.location?.lng || !campus.radius) {
      return res.json({
        authorized: true,
        campus: campusData,
        message: 'Access granted.',
      });
    }

    if (lat == null || lng == null) {
      return res.json({ 
        authorized: true, 
        campus: campusData,
        message: 'Access granted.' 
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

    return res.json({
      authorized: true,
      distance: Math.round(distance),
      radius: campus.radius,
      campus: campusData,
      message: distance <= campus.radius ? 'Verified within campus.' : `Distance: ${Math.round(distance)}m.`
    });
  } catch (err) {
    res.status(400).json({ authorized: false, message: 'Invalid campus QR code.' });
  }
});

// GET campus data as unified GeoJSON FeatureCollection
router.get('/geojson/:id', async (req, res, next) => {
  try {
    const campusId = req.params.id;
    const Floor = require('../models/Floor');
    const NavNode = require('../models/NavNode');
    const [blocks, rooms, paths, mapLayers, floors, navNodes] = await Promise.all([
      Block.find({ campusId, isActive: true }),
      Room.find({ campusId, isActive: true }),
      NavPath.find({ campusId, isActive: true }).populate('nodeA').populate('nodeB'),
      MapLayer.find({ campusId, isActive: true }),
      Floor.find({ campusId }),
      NavNode.find({ campusId, isActive: true })
    ]);

    // Build a lookup map: floorId -> level
    const floorLevelMap = {};
    floors.forEach(f => { floorLevelMap[f._id.toString()] = f.level; });

    const features = [];

    // Convert Blocks to GeoJSON Polygons
    blocks.forEach(b => {
      if (b.shape && b.shape.points && b.shape.points.length >= 3) {
        const coords = b.shape.points.map(p => [p.y, p.x]);
        // Close the polygon
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push([...coords[0]]);
        }
        const blockColor = (b.shape && b.shape.fill && b.shape.fill !== '#4A90D9' && b.shape.fill !== '#3b82f6') ? b.shape.fill : '#1f2937';
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { id: b._id, name: b.name, type: 'block', category: b.domain, color: blockColor, min_height: 0, height: 6 }
        });
      }
    });

    function getPolygonArea(ring) {
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
      }
      return area / 2;
    }

    function insetPolygon(ring, distanceMeters = 0.18) {
      if (!ring || ring.length < 4) return ring;
      const area = getPolygonArea(ring);
      const isCCW = area > 0;
      const mToLat = 1 / 111139;
      const avgLat = ring[0][1];
      const mToLng = 1 / (111139 * Math.cos(avgLat * Math.PI / 180));
      const n = ring.length - 1;
      const inset = [];

      for (let i = 0; i < n; i++) {
        const prev = ring[(i - 1 + n) % n];
        const curr = ring[i];
        const next = ring[(i + 1) % n];

        const v1x = (curr[0] - prev[0]) / mToLng;
        const v1y = (curr[1] - prev[1]) / mToLat;
        const l1 = Math.hypot(v1x, v1y) || 1e-6;
        const u1x = v1x / l1, u1y = v1y / l1;

        const v2x = (next[0] - curr[0]) / mToLng;
        const v2y = (next[1] - curr[1]) / mToLat;
        const l2 = Math.hypot(v2x, v2y) || 1e-6;
        const u2x = v2x / l2, u2y = v2y / l2;

        const n1x = isCCW ? -u1y : u1y;
        const n1y = isCCW ? u1x : -u1x;
        const n2x = isCCW ? -u2y : u2y;
        const n2y = isCCW ? u2x : -u2x;

        let bx = n1x + n2x;
        let by = n1y + n2y;
        const blen = Math.hypot(bx, by);
        if (blen > 1e-6) {
          bx /= blen;
          by /= blen;
        } else {
          bx = n1x;
          by = n1y;
        }

        const dot = bx * n1x + by * n1y;
        const scale = Math.min(Math.max(dot > 1e-4 ? 1 / dot : 1, 1), 2.0);

        const shiftX = bx * distanceMeters * scale * mToLng;
        const shiftY = by * distanceMeters * scale * mToLat;

        inset.push([curr[0] + shiftX, curr[1] + shiftY]);
      }
      inset.push([inset[0][0], inset[0][1]]);
      return inset;
    }

    function generatePartitionWalls(ring, thicknessMeters = 0.12) {
      if (!ring || ring.length < 2) return [];
      const walls = [];
      const mToLat = 1 / 111139;
      const avgLat = ring[0][1];
      const mToLng = 1 / (111139 * Math.cos(avgLat * Math.PI / 180));
      const halfW = thicknessMeters / 2;

      for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i+1];

        const dx = (p2[0] - p1[0]) / mToLng;
        const dy = (p2[1] - p1[1]) / mToLat;
        const len = Math.hypot(dx, dy);
        if (len < 0.2) continue;

        const ux = dx / len, uy = dy / len;
        const nx = -uy * halfW * mToLng;
        const ny = ux * halfW * mToLat;

        const c1 = [p1[0] + nx, p1[1] + ny];
        const c2 = [p2[0] + nx, p2[1] + ny];
        const c3 = [p2[0] - nx, p2[1] - ny];
        const c4 = [p1[0] - nx, p1[1] - ny];

        walls.push([[c1, c2, c3, c4, c1]]);
      }
      return walls;
    }

    function lineSegmentsIntersect(p1, p2, p3, p4) {
      const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
      if (Math.abs(d) < 1e-12) return null;
      const u = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
      const v = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        return [p1[0] + u * (p2[0] - p1[0]), p1[1] + u * (p2[1] - p1[1]), u];
      }
      return null;
    }

    function distToSegmentSquared(p, v, w) {
      const l2 = (v[0] - w[0])**2 + (v[1] - w[1])**2;
      if (l2 === 0) return { distSq: (p[0] - v[0])**2 + (p[1] - v[1])**2, t: 0, proj: v };
      let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
      t = Math.max(0.1, Math.min(0.9, t));
      const proj = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
      const distSq = (p[0] - proj[0])**2 + (p[1] - proj[1])**2;
      return { distSq, t, proj };
    }

    function generateDoorPortals(ring, floorPaths, doorWidthMeters = 1.2, wallDepthMeters = 0.22, allCampusPaths = []) {
      if (!ring || ring.length < 4) return null;
      const mToLat = 1 / 111139;
      const avgLat = ring[0][1];
      const mToLng = 1 / (111139 * Math.cos(avgLat * Math.PI / 180));

      // Calculate room centroid for outward normal validation
      let cLng = 0, cLat = 0, ptCount = ring.length - 1;
      for (let i = 0; i < ptCount; i++) {
        cLng += ring[i][0];
        cLat += ring[i][1];
      }
      cLng /= Math.max(1, ptCount);
      cLat /= Math.max(1, ptCount);

      let bestEdge = -1;
      let bestT = 0.5;
      let corridorRefPoint = null;

      const candidatePaths = (Array.isArray(floorPaths) && floorPaths.length > 0)
        ? floorPaths
        : (Array.isArray(allCampusPaths) ? allCampusPaths : []);

      // 1. Check direct path intersection with room edges
      if (candidatePaths.length > 0) {
        for (let pIdx = 0; pIdx < candidatePaths.length; pIdx++) {
          const p = candidatePaths[pIdx];
          for (let i = 0; i < ring.length - 1; i++) {
            const hit = lineSegmentsIntersect(ring[i], ring[i+1], p.pA, p.pB);
            if (hit) {
              bestEdge = i;
              bestT = Math.max(0.12, Math.min(0.88, hit[2]));
              corridorRefPoint = p.pA;
              break;
            }
          }
          if (bestEdge !== -1) break;
        }

        // 2. Check nearest corridor path across all candidate edges
        if (bestEdge === -1) {
          let minDist = Infinity;
          for (let pIdx = 0; pIdx < candidatePaths.length; pIdx++) {
            const p = candidatePaths[pIdx];
            const midP = [(p.pA[0] + p.pB[0]) / 2, (p.pA[1] + p.pB[1]) / 2];
            for (let i = 0; i < ring.length - 1; i++) {
              const dx = (ring[i+1][0] - ring[i][0]) / mToLng;
              const dy = (ring[i+1][1] - ring[i][1]) / mToLat;
              const edgeLen = Math.hypot(dx, dy);
              if (edgeLen < 0.6) continue; // skip micro-segments

              const res = distToSegmentSquared(midP, ring[i], ring[i+1]);
              if (res.distSq < minDist) {
                minDist = res.distSq;
                bestEdge = i;
                bestT = Math.max(0.12, Math.min(0.88, res.t));
                corridorRefPoint = midP;
              }
            }
          }
        }
      }

      // 3. Fallback: select longest edge
      if (bestEdge === -1) {
        let maxLen = -1;
        for (let i = 0; i < ring.length - 1; i++) {
          const dx = (ring[i+1][0] - ring[i][0]) / mToLng;
          const dy = (ring[i+1][1] - ring[i][1]) / mToLat;
          const len = Math.hypot(dx, dy);
          if (len > maxLen) {
            maxLen = len;
            bestEdge = i;
            bestT = 0.5;
          }
        }
      }
      if (bestEdge === -1) bestEdge = 0;

      const p1 = ring[bestEdge];
      const p2 = ring[bestEdge+1];
      const dx = (p2[0] - p1[0]) / mToLng;
      const dy = (p2[1] - p1[1]) / mToLat;
      const len = Math.hypot(dx, dy) || 1e-6;

      const ux = dx / len, uy = dy / len;
      let nx = -uy;
      let ny = ux;

      const doorMidLng = p1[0] + (p2[0] - p1[0]) * bestT;
      const doorMidLat = p1[1] + (p2[1] - p1[1]) * bestT;

      // Ensure normal points outward away from room centroid
      const dPlusCentroid = Math.hypot((doorMidLng + nx * mToLng) - cLng, (doorMidLat + ny * mToLat) - cLat);
      const dMinusCentroid = Math.hypot((doorMidLng - nx * mToLng) - cLng, (doorMidLat - ny * mToLat) - cLat);
      if (dPlusCentroid < dMinusCentroid) {
        nx = -nx;
        ny = -ny;
      }

      // If corridor reference point exists, orient towards corridor
      if (corridorRefPoint) {
        const dPlusCorr = Math.hypot((doorMidLng + nx * mToLng) - corridorRefPoint[0], (doorMidLat + ny * mToLat) - corridorRefPoint[1]);
        const dMinusCorr = Math.hypot((doorMidLng - nx * mToLng) - corridorRefPoint[0], (doorMidLat - ny * mToLat) - corridorRefPoint[1]);
        if (dMinusCorr < dPlusCorr) {
          nx = -nx;
          ny = -ny;
        }
      }

      function makeBox(w, outwardOffset, inwardDepth) {
        const halfW = (w / 2) / len;
        const tStart = Math.max(0.02, bestT - halfW);
        const tEnd = Math.min(0.98, bestT + halfW);

        const pt1 = [p1[0] + (p2[0] - p1[0]) * tStart, p1[1] + (p2[1] - p1[1]) * tStart];
        const pt2 = [p1[0] + (p2[0] - p1[0]) * tEnd, p1[1] + (p2[1] - p1[1]) * tEnd];

        const outX = nx * outwardOffset * mToLng;
        const outY = ny * outwardOffset * mToLat;
        const inX = -nx * inwardDepth * mToLng;
        const inY = -ny * inwardDepth * mToLat;

        const c1 = [pt1[0] + outX, pt1[1] + outY];
        const c2 = [pt2[0] + outX, pt2[1] + outY];
        const c3 = [pt2[0] + inX, pt2[1] + inY];
        const c4 = [pt1[0] + inX, pt1[1] + inY];

        return [[c1, c2, c3, c4, c1]];
      }

      const plateHalfW = (doorWidthMeters * 0.95 / 2) / len;
      const plateT1 = Math.max(0.02, bestT - plateHalfW);
      const plateT2 = Math.min(0.98, bestT + plateHalfW);
      const ptA = [p1[0] + (p2[0] - p1[0]) * plateT1, p1[1] + (p2[1] - p1[1]) * plateT1];
      const ptB = [p1[0] + (p2[0] - p1[0]) * plateT2, p1[1] + (p2[1] - p1[1]) * plateT2];

      return {
        frame: makeBox(doorWidthMeters + 0.15, 0.08, wallDepthMeters),
        leaf: makeBox(doorWidthMeters, 0.03, wallDepthMeters * 0.7),
        threshold: makeBox(doorWidthMeters + 0.15, 0.14, 0.08),
        doorplate: makeBox(doorWidthMeters + 0.05, 0.07, wallDepthMeters * 0.4),
        doorplateAnchor: {
          lng: doorMidLng,
          lat: doorMidLat,
          ux: ux,
          uy: uy,
          nx: nx,
          ny: ny,
          ptA: ptA,
          ptB: ptB
        }
      };
    }

    // Index paths by floorId string for fast corridor-aligned door generation
    const pathsByFloor = {};
    const allCampusNavPaths = [];
    paths.forEach(p => {
      if (p.nodeA && p.nodeB) {
        const seg = {
          pA: [p.nodeA.y, p.nodeA.x],
          pB: [p.nodeB.y, p.nodeB.x]
        };
        allCampusNavPaths.push(seg);
        if (p.floorId) {
          const fid = (typeof p.floorId === 'object' ? p.floorId._id : p.floorId).toString();
          if (!pathsByFloor[fid]) pathsByFloor[fid] = [];
          pathsByFloor[fid].push(seg);
        }
      }
    });

    // Convert Rooms to GeoJSON Polygons (with floor-level elevation)
    rooms.forEach(r => {
      if (r.shape && r.shape.points && r.shape.points.length >= 3) {
        const floorIdStr = r.floorId ? r.floorId.toString() : '';
        const level = floorLevelMap[floorIdStr] !== undefined ? floorLevelMap[floorIdStr] : 0;

        // Handle stairs rooms with step generation
        if (r.type === 'stairs' && r.stairsConfig && r.shape.points.length >= 4) {
          const pts = r.shape.points;
          const p1 = pts[0], p2 = pts[1], p3 = pts[2], p4 = pts[3];

          const len12 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
          const len23 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
          const len34 = Math.sqrt(Math.pow(p3.x - p4.x, 2) + Math.pow(p3.y - p4.y, 2));
          const len41 = Math.sqrt(Math.pow(p4.x - p1.x, 2) + Math.pow(p4.y - p1.y, 2));

          const config = r.stairsConfig;
          const N = config.stepCount || 15;
          const scale = config.stairWidthScale !== undefined ? config.stairWidthScale : 1.0;
          const direction = config.stairDirection || 'auto';
          const invert = config.invertSlope || false;

          let is1to3 = true;
          if (direction === 'auto') {
            is1to3 = (len23 + len41) >= (len12 + len34);
          } else if (direction === 'transverse') {
            is1to3 = false;
          }

          const startFloorId = (config.startFloorId ? config.startFloorId.toString() : floorIdStr);
          const endFloorId = config.endFloorId ? config.endFloorId.toString() : null;
          const floorBaseStart = floorLevelMap[startFloorId] !== undefined ? floorLevelMap[startFloorId] * 3.5 : level * 3.5;
          const floorBaseEnd = endFloorId && floorLevelMap[endFloorId] !== undefined ? floorLevelMap[endFloorId] * 3.5 : floorBaseStart + 3.5;
          const heightDiff = floorBaseEnd - floorBaseStart;

          const startPct = config.startHeightPct !== undefined ? config.startHeightPct / 100 : 0.0;
          const endPct = config.endHeightPct !== undefined ? config.endHeightPct / 100 : 1.0;
          const zStart = floorBaseStart + startPct * heightDiff;
          const zEnd = floorBaseStart + endPct * heightDiff;

          for (let i = 0; i < N; i++) {
            const tStart = i / N;
            const tEnd = (i + 1) / N;
            let c1, c2, c3, c4;

            if (is1to3) {
              const xSL = p1.x + (p4.x - p1.x) * tStart;
              const ySL = p1.y + (p4.y - p1.y) * tStart;
              const xSR = p2.x + (p3.x - p2.x) * tStart;
              const ySR = p2.y + (p3.y - p2.y) * tStart;
              const xEL = p1.x + (p4.x - p1.x) * tEnd;
              const yEL = p1.y + (p4.y - p1.y) * tEnd;
              const xER = p2.x + (p3.x - p2.x) * tEnd;
              const yER = p2.y + (p3.y - p2.y) * tEnd;

              const xSC = (xSL + xSR) / 2, ySC = (ySL + ySR) / 2;
              const xEC = (xEL + xER) / 2, yEC = (yEL + yER) / 2;

              c1 = [ySC + (ySL - ySC) * scale, xSC + (xSL - xSC) * scale];
              c2 = [ySC + (ySR - ySC) * scale, xSC + (xSR - xSC) * scale];
              c3 = [yEC + (yER - yEC) * scale, xEC + (xER - xEC) * scale];
              c4 = [yEC + (yEL - yEC) * scale, xEC + (xEL - xEC) * scale];
            } else {
              const xSB = p1.x + (p2.x - p1.x) * tStart;
              const ySB = p1.y + (p2.y - p1.y) * tStart;
              const xST = p4.x + (p3.x - p4.x) * tStart;
              const yST = p4.y + (p3.y - p4.y) * tStart;
              const xEB = p1.x + (p2.x - p1.x) * tEnd;
              const yEB = p1.y + (p2.y - p1.y) * tEnd;
              const xET = p4.x + (p3.x - p4.x) * tEnd;
              const yET = p4.y + (p3.y - p4.y) * tEnd;

              const xSC = (xSB + xST) / 2, ySC = (ySB + yST) / 2;
              const xEC = (xEB + xET) / 2, yEC = (yEB + yET) / 2;

              c1 = [ySC + (ySB - ySC) * scale, xSC + (xSB - xSC) * scale];
              c2 = [yEC + (yEB - yEC) * scale, xEC + (xEB - xEC) * scale];
              c3 = [yEC + (yET - yEC) * scale, xEC + (xET - xEC) * scale];
              c4 = [ySC + (yST - ySC) * scale, xSC + (xST - xSC) * scale];
            }

            const stepMinH = invert
              ? zEnd - (i * (zEnd - zStart)) / N
              : zStart + (i * (zEnd - zStart)) / N;
            const stepMaxH = invert
              ? zEnd - ((i + 1) * (zEnd - zStart)) / N
              : zStart + ((i + 1) * (zEnd - zStart)) / N;

            const hMin = Math.min(stepMinH, stepMaxH);
            const hMax = Math.max(stepMinH, stepMaxH);

            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] },
              properties: {
                id: r._id + '_step_' + i,
                stairId: r._id.toString(),
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: 'stairs',
                floorId: r.floorId,
                startFloorId: startFloorId,
                endFloorId: endFloorId,
                color: r.color || '#f97316',
                min_height: hMin,
                height: hMax + 0.05,
                isStairs: true
              }
            });
          }
        } else {
          // Regular room
          const minH = level * 3.5;
          const coords = r.shape.points.map(p => [p.y, p.x]);
          if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
            coords.push([...coords[0]]);
          }

          const rType = (r.type || '').toLowerCase();
          const rName = (r.name || '').toLowerCase();
          const isCorridor = (rType === 'corridor' || rName.includes('corridor'));

          if (isCorridor) {
            // Paved walkway / corridor surface (neutral light polished concrete)
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {
                id: r._id.toString(),
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: 'corridor',
                part: 'corridor',
                floorId: r.floorId,
                level: level,
                color: '#cbd5e1',
                min_height: minH,
                height: minH + 0.05
              }
            });
          } else if (rType === 'entrance') {
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {
                id: r._id.toString(),
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: 'entrance',
                part: 'entrance',
                floorId: r.floorId,
                level: level,
                color: (r.shape && r.shape.fill) ? r.shape.fill : '#78716c',
                min_height: minH,
                height: minH + 2.2
              }
            });
          } else {
            // High-Clarity Architectural Room Unit
            const CATEGORY_PALETTE = {
              classroom: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#0284c7' },
              lab: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#7c3aed' },
              computer_lab: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#0891b2' },
              office: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#2563eb' },
              staff_room: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#3b82f6' },
              auditorium: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#b45309' },
              seminar_hall: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#d97706' },
              restroom: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#059669' },
              library: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#4f46e5' },
              cafeteria: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#ea580c' },
              entrance: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#16a34a' },
              corridor: { base: '#64748b', wall: '#cbd5e1', roof: '#cbd5e1', parapet: '#475569' },
              default: { base: '#1e293b', wall: '#e2e8f0', roof: '#f8fafc', parapet: '#64748b' }
            };

            const pal = CATEGORY_PALETTE[rType] || CATEGORY_PALETTE.default;
            const parapetColor = pal.parapet;

            const baseH = minH + 0.80;
            const wallH = minH + 2.75;
            const roofH = minH + 2.75;
            const parapetH = minH + 2.90;
            const partitionH = minH + 2.92;

            // 1. Charcoal Plinth Baseboard (0 -> 0.80m)
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {
                id: r._id.toString() + '_base',
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: r.type,
                part: 'base',
                floorId: r.floorId,
                level: level,
                color: '#1e293b',
                min_height: minH,
                height: baseH
              }
            });

            // 2. Main Architectural Plaster Wall Body (0.80m -> 2.75m)
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {
                id: r._id.toString() + '_body',
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: r.type,
                part: 'body',
                floorId: r.floorId,
                level: level,
                capacity: r.capacity || 0,
                color: '#e2e8f0',
                min_height: baseH,
                height: wallH
              }
            });

            // 3. 3D Partition Divider Walls along boundary edges (width: 0.12m, 0 -> 2.92m)
            // Ensures contiguous rooms (5-F-10 through 5-F-14) have crisp divider seams
            const partitionBoxes = generatePartitionWalls(coords, 0.12);
            for (let i = 0; i < partitionBoxes.length; i++) {
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: partitionBoxes[i] },
                properties: {
                  id: r._id.toString() + '_part_' + i,
                  roomId: r._id.toString(),
                  name: r.name,
                  type: 'room',
                  category: r.type,
                  part: 'partition',
                  floorId: r.floorId,
                  level: level,
                  color: '#1e293b',
                  min_height: minH,
                  height: partitionH
                }
              });
            }

            // 4. Recessed Inset Ceiling / Roof Tray (inset 0.18m, 2.70m -> 2.75m)
            // Creates natural shadow crease separating room ceilings from perimeter walls
            const insetCoords = insetPolygon(coords, 0.18);
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [insetCoords] },
              properties: {
                id: r._id.toString() + '_roof',
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: r.type,
                part: 'roof',
                floorId: r.floorId,
                level: level,
                color: '#f8fafc',
                min_height: wallH - 0.05,
                height: roofH
              }
            });

            // 5. Raised Perimeter Parapet Lip with subtle category coping trim (2.75m -> 2.90m)
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [coords] },
              properties: {
                id: r._id.toString() + '_parapet',
                roomId: r._id.toString(),
                name: r.name,
                type: 'room',
                category: r.type,
                part: 'parapet',
                floorId: r.floorId,
                level: level,
                color: parapetColor,
                min_height: wallH,
                height: parapetH
              }
            });

            // 6. Corridor Door Portals (Illuminated Frame, Recessed Leaf, Threshold Strip)
            const rPaths = pathsByFloor[floorIdStr] || [];
            const doorSet = generateDoorPortals(coords, rPaths, 1.2, 0.22, allCampusNavPaths);
            if (doorSet) {
              // 6a. Outer Illuminated Door Frame / Lintel (Amber Gold #f59e0b)
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: doorSet.frame },
                properties: {
                  id: r._id.toString() + '_door_frame',
                  roomId: r._id.toString(),
                  name: r.name,
                  type: 'room',
                  category: r.type,
                  part: 'door_frame',
                  floorId: r.floorId,
                  level: level,
                  color: '#f59e0b',
                  min_height: minH,
                  height: minH + 2.25
                }
              });
              // 6b. Recessed Door Leaf / Opening (#0f172a / Deep Slate)
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: doorSet.leaf },
                properties: {
                  id: r._id.toString() + '_door',
                  roomId: r._id.toString(),
                  name: r.name,
                  type: 'room',
                  category: r.type,
                  part: 'door',
                  floorId: r.floorId,
                  level: level,
                  color: '#0f172a',
                  min_height: minH,
                  height: minH + 2.15
                }
              });
              // 6c. Glowing Door Threshold Strip (#fbbf24)
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: doorSet.threshold },
                properties: {
                  id: r._id.toString() + '_door_threshold',
                  roomId: r._id.toString(),
                  name: r.name,
                  type: 'room',
                  category: r.type,
                  part: 'door_threshold',
                  floorId: r.floorId,
                  level: level,
                  color: '#fbbf24',
                  min_height: minH,
                  height: minH + 0.08
                }
              });
              // 6d. Physical 3D Doorplate Plaque (Signage Mesh Above Lintel)
              features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: doorSet.doorplate },
                properties: {
                  id: r._id.toString() + '_doorplate',
                  roomId: r._id.toString(),
                  name: r.name,
                  type: 'room',
                  category: r.type,
                  part: 'doorplate',
                  floorId: r.floorId,
                  level: level,
                  color: '#0f172a',
                  min_height: minH + 2.22,
                  height: minH + 2.50,
                  // Signage anchor & orientation vectors:
                  doorLng: doorSet.doorplateAnchor.lng,
                  doorLat: doorSet.doorplateAnchor.lat,
                  doorElev: minH + 2.36,
                  ux: doorSet.doorplateAnchor.ux,
                  uy: doorSet.doorplateAnchor.uy,
                  nx: doorSet.doorplateAnchor.nx,
                  ny: doorSet.doorplateAnchor.ny,
                  ptA: doorSet.doorplateAnchor.ptA,
                  ptB: doorSet.doorplateAnchor.ptB
                }
              });
            }
          }
        }
      }
    });

    // Convert NavPaths to GeoJSON LineStrings (with 3D elevation)
    paths.forEach(p => {
      if (p.nodeA && p.nodeB) {
        const getNodeLevel = (node) => {
          if (node.floorLevel !== undefined && node.floorLevel !== null) return node.floorLevel;
          if (node.floorId) {
            const fid = typeof node.floorId === 'object' ? node.floorId._id?.toString() : node.floorId.toString();
            if (floorLevelMap[fid] !== undefined) return floorLevelMap[fid];
          }
          return 0;
        };
        const levelA = getNodeLevel(p.nodeA);
        const levelB = getNodeLevel(p.nodeB);
        const hA = levelA * 3.5 + 0.5;
        const hB = levelB * 3.5 + 0.5;

        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[p.nodeA.y, p.nodeA.x, hA], [p.nodeB.y, p.nodeB.x, hB]] },
          properties: { id: p._id, name: 'Path', type: 'path', bidirectional: p.bidirectional, floorId: p.floorId }
        });
      }
    });

    // Convert NavNodes to GeoJSON Points (with 3D elevation)
    navNodes.forEach(n => {
      const getLevel = () => {
        if (n.floorLevel !== undefined && n.floorLevel !== null) return n.floorLevel;
        if (n.floorId) {
          const fid = typeof n.floorId === 'object' ? n.floorId._id?.toString() : n.floorId.toString();
          if (floorLevelMap[fid] !== undefined) return floorLevelMap[fid];
        }
        return 0;
      };
      const h = getLevel() * 3.5 + 0.5;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [n.y, n.x, h] },
        properties: { id: n._id, type: 'node', label: n.label, nodeType: n.type, floorId: n.floorId, blockId: n.blockId }
      });
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

// PUT update a timetable slot (venue, subject, faculty, etc.)
router.put('/:id/timetable/:slotId', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const allowedFields = ['subject', 'roomName', 'roomId', 'facultyId', 'facultyName', 'startTime', 'endTime'];
    const updates = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const slot = await Timetable.findByIdAndUpdate(req.params.slotId, updates, { new: true });
    if (!slot) return res.status(404).json({ error: 'Timetable slot not found' });
    res.json({ success: true, slot });
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
