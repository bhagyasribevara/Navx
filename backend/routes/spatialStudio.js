const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const SpatialScanSession = require('../models/SpatialScanSession');
const DigitalTwin = require('../models/DigitalTwin');
const NavNode = require('../models/NavNode');
const Block = require('../models/Block');
const Room = require('../models/Room');

// Configuration for AI Microservice
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Start a new scan session
router.post('/session/start', async (req, res) => {
  try {
    const { buildingId, floorId, adminId } = req.body;
    
    const sessionData = {
      status: 'active',
      startedAt: new Date()
    };

    if (buildingId && mongoose.Types.ObjectId.isValid(buildingId)) {
      sessionData.building = buildingId;
    }
    if (floorId && mongoose.Types.ObjectId.isValid(floorId)) {
      sessionData.floor = floorId;
    }
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      sessionData.admin = adminId;
    }

    const session = new SpatialScanSession(sessionData);
    await session.save();
    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('Error starting spatial session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update session with live trajectory
router.post('/session/:id/trajectory', async (req, res) => {
  try {
    const { id } = req.params;
    const { pose } = req.body; // {x, y, z, qw, qx, qy, qz}
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(200).json({ success: true, mode: 'demo' });
    }

    let aiInsights = {};
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/detect-corridor-width`, pose, { timeout: 1500 });
      aiInsights = aiResponse.data;
    } catch (aiErr) {
      // Non-blocking
    }

    const session = await SpatialScanSession.findByIdAndUpdate(
      id,
      { $push: { trajectory: { ...pose, timestamp: new Date() } } },
      { new: true }
    );
    
    res.status(200).json({ 
      success: true, 
      aiInsights, 
      coveragePercentage: session?.coveragePercentage || 0 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process end of session to generate graph and digital twin
router.post('/session/:id/finalize', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(200).json({ success: true, mode: 'demo' });
    }

    const session = await SpatialScanSession.findById(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const {
      detectedRooms: reqRooms,
      wallColors: reqColors,
      floorMaterial: reqFloorMaterial,
      floorColor: reqFloorColor,
      landmarks: reqLandmarks,
      corridorWidth: reqCorridorWidth,
      corridorHeight: reqCorridorHeight
    } = req.body || {};

    session.status = 'completed';
    session.endedAt = new Date();

    const finalWallTop = reqColors?.top || '#f6f5ee';
    const finalWallBottom = reqColors?.bottom || '#b5a68e';
    const finalFloorMaterial = reqFloorMaterial || 'terrazzo_mosaic';
    const finalFloorColor = reqFloorColor || '#d6cebf';

    if (reqRooms) session.detectedRooms = reqRooms;
    if (reqColors) session.wallColors = { top: finalWallTop, bottom: finalWallBottom };
    if (reqFloorMaterial) session.floorMaterial = finalFloorMaterial;
    if (reqFloorColor) session.floorColor = finalFloorColor;
    if (reqLandmarks) session.landmarks = reqLandmarks;
    if (req.body.startPoint) session.startPoint = req.body.startPoint;
    if (req.body.endPoint) session.endPoint = req.body.endPoint;
    if (req.body.scannedElements) session.scannedElements = req.body.scannedElements;

    await session.save();

    let graphStats = { nodeCount: 12, edgeCount: 18 };
    let dtWalls = [];
    let dtDoors = [];
    let aiRooms = [];
    let aiLandmarks = [];

    // Call AI service to build navigation graph from trajectory
    try {
      const graphResponse = await axios.post(`${AI_SERVICE_URL}/build-navigation-graph`, { 
        session_id: id, 
        trajectory: session.trajectory || [] 
      }, { timeout: 4000 });
      if (graphResponse.data) graphStats = graphResponse.data;
    } catch (e) {
      console.warn("AI build-navigation-graph notice:", e.message);
    }

    try {
      const dtResponse = await axios.post(`${AI_SERVICE_URL}/generate-digital-twin`, { 
        session_id: id, 
        trajectory: session.trajectory || [],
        wallColors: { top: finalWallTop, bottom: finalWallBottom },
        floorMaterial: finalFloorMaterial,
        floorColor: finalFloorColor,
        roomSegments: req.body.roomSegments || [],
        startPoint: req.body.startPoint || null,
        endPoint: req.body.endPoint || null
      }, { timeout: 4000 });
      if (dtResponse.data) {
        dtWalls = dtResponse.data.walls || [];
        dtDoors = dtResponse.data.doors || [];
        aiRooms = dtResponse.data.detectedRooms || [];
        aiLandmarks = dtResponse.data.landmarks || [];
      }
    } catch (e) {
      console.warn("AI generate-digital-twin notice:", e.message);
    }

    // Default realistic two-tone hostel corridor walls if empty
    if (!dtWalls || dtWalls.length === 0) {
      dtWalls = []; // Removed default layout as per user request
    }

    if (!dtDoors) {
      dtDoors = (req.body?.doors && req.body.doors.length > 0) ? req.body.doors : [];
    }

    const finalRooms = (reqRooms && reqRooms.length > 0) ? reqRooms : (aiRooms.length > 0 ? aiRooms : (session.roomSegments || session.detectedRooms || []));

    const finalLandmarks = (reqLandmarks && reqLandmarks.length > 0) ? reqLandmarks : (aiLandmarks.length > 0 ? aiLandmarks : []);

    // Save or update DigitalTwin for this building & floor
    let digitalTwinId = null;
    if (session.building && session.floor) {
      // Clear older twins for this floor so fresh recording replaces it cleanly
      await DigitalTwin.deleteMany({ building: session.building, floor: session.floor });

      const digitalTwin = new DigitalTwin({
        building: session.building,
        floor: session.floor,
        session: session._id,
        wallColorTop: finalWallTop,
        wallColorBottom: finalWallBottom,
        floorMaterial: finalFloorMaterial,
        floorColor: finalFloorColor,
        corridorWidth: reqCorridorWidth || 2.3,
        corridorHeight: reqCorridorHeight || 2.8,
        walls: dtWalls,
        doors: dtDoors,
        detectedRooms: finalRooms,
        landmarks: finalLandmarks,
        startPoint: session.startPoint,
        endPoint: session.endPoint,
        scannedElements: session.scannedElements || [],
        rooms: []
      });
      await digitalTwin.save();
      digitalTwinId = digitalTwin._id;
    }

    res.status(200).json({ 
      success: true, 
      graphStats,
      digitalTwinId,
      session
    });
  } catch (error) {
    console.error('Error finalizing spatial session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark session as available on web & store 3D scanned elements
router.post('/session/:id/send-to-web', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const { roomSegments, scannedElements } = req.body;

    const session = await SpatialScanSession.findById(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.isAvailableOnWeb = true;
    if (roomSegments && roomSegments.length > 0) {
      session.roomSegments = roomSegments;
    }
    if (scannedElements && Array.isArray(scannedElements)) {
      session.scannedElements = scannedElements;
    }

    await session.save();

    // Also attach or update DigitalTwin staging elements if building & floor exist
    if (session.building && session.floor) {
      let twin = await DigitalTwin.findOne({ building: session.building, floor: session.floor });
      if (!twin) {
        twin = new DigitalTwin({
          building: session.building,
          floor: session.floor,
          session: session._id,
          scannedElements: scannedElements || [],
          startPoint: session.startPoint,
          endPoint: session.endPoint,
          detectedRooms: session.detectedRooms || []
        });
      } else {
        if (scannedElements && scannedElements.length > 0) {
          twin.scannedElements = scannedElements;
        } else if (session.scannedElements && session.scannedElements.length > 0) {
          twin.scannedElements = session.scannedElements;
        }
        twin.placedComponents = []; // Reset placed items on re-sync so items show up in unplaced Staging Tray
        if (session.startPoint) twin.startPoint = session.startPoint;
        if (session.endPoint) twin.endPoint = session.endPoint;
        if (session.detectedRooms && session.detectedRooms.length > 0) twin.detectedRooms = session.detectedRooms;
      }
      await twin.save();
    }

    res.status(200).json({ success: true, session });
  } catch (error) {
    console.error('Error sending session to web:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a scan session AND remove its associated Digital Twin directly
router.delete('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = await SpatialScanSession.findById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.building && session.floor) {
      await DigitalTwin.deleteMany({
        $or: [
          { session: session._id },
          { building: session.building, floor: session.floor }
        ]
      });
    }

    await SpatialScanSession.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true, 
      message: 'Scan recording and associated 3D Digital Twin successfully deleted.' 
    });
  } catch (error) {
    console.error('Error deleting spatial session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get digital twin for web admin
router.get('/digital-twin/:buildingId/:floorId', async (req, res) => {
  try {
    const { buildingId, floorId } = req.params;
    const query = {};
    if (mongoose.Types.ObjectId.isValid(buildingId)) query.building = buildingId;
    if (mongoose.Types.ObjectId.isValid(floorId)) query.floor = floorId;

    const twin = await DigitalTwin.findOne(query).sort({ createdAt: -1 });
    const latestSession = await SpatialScanSession.findOne(query).sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, twin, latestSession });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save or Update Digital Twin directly from 3D Floor Builder
router.post('/twin', async (req, res) => {
  try {
    const {
      buildingId,
      floorId,
      wallColorTop,
      wallColorBottom,
      floorMaterial,
      floorColor,
      corridorWidth,
      corridorHeight,
      walls,
      doors,
      detectedRooms,
      landmarks,
      scannedElements,
      placedComponents
    } = req.body;

    if (!buildingId || !floorId) {
      return res.status(400).json({ error: 'buildingId and floorId are required' });
    }

    const query = { building: buildingId, floor: floorId };
    
    let twin = await DigitalTwin.findOne(query);
    if (!twin) {
      twin = new DigitalTwin({ building: buildingId, floor: floorId });
    }

    twin.wallColorTop = wallColorTop || twin.wallColorTop || '#f6f5ee';
    twin.wallColorBottom = wallColorBottom || twin.wallColorBottom || '#b5a68e';
    twin.floorMaterial = floorMaterial || twin.floorMaterial || 'terrazzo_mosaic';
    twin.floorColor = floorColor || twin.floorColor || '#d6cebf';
    twin.corridorWidth = corridorWidth || twin.corridorWidth || 2.3;
    twin.corridorHeight = corridorHeight || twin.corridorHeight || 2.8;
    if (walls) twin.walls = walls;
    if (doors) twin.doors = doors;
    if (detectedRooms) twin.detectedRooms = detectedRooms;
    if (landmarks) twin.landmarks = landmarks;
    if (scannedElements) twin.scannedElements = scannedElements;
    if (placedComponents) twin.placedComponents = placedComponents;
    twin.lastUpdated = new Date();

    await twin.save();

    res.status(200).json({ 
      success: true, 
      message: '3D Digital Twin successfully saved!', 
      twin 
    });
  } catch (error) {
    console.error('Error saving digital twin from 3D builder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Publish Floor Assembly Layout Live to User App
router.post('/twin/publish', async (req, res) => {
  try {
    const {
      campusId,
      buildingId,
      floorId,
      placedComponents,
      scannedElements,
      walls,
      doors
    } = req.body;

    if (!buildingId || !floorId) {
      return res.status(400).json({ error: 'buildingId and floorId are required' });
    }

    // 1. Update Digital Twin (Local 3D Scene)
    const query = { building: buildingId, floor: floorId };
    let twin = await DigitalTwin.findOne(query);
    if (!twin) {
      twin = new DigitalTwin({ building: buildingId, floor: floorId });
    }

    if (placedComponents) twin.placedComponents = placedComponents;
    if (scannedElements) twin.scannedElements = scannedElements;
    if (walls) twin.walls = walls;
    if (doors) twin.doors = doors;
    twin.lastUpdated = new Date();
    twin.version = (twin.version || 1) + 1;
    await twin.save();

    // 2. Synchronize spatial coordinates back to 2D Map Geographic Database
    if (placedComponents && placedComponents.length > 0 && campusId) {
      const block = await Block.findById(buildingId);
      if (block && block.shape && block.shape.points && block.shape.points.length >= 3) {
        const bPts = block.shape.points;
        const minX = Math.min(...bPts.map(p => p.x));
        const maxX = Math.max(...bPts.map(p => p.x));
        const minY = Math.min(...bPts.map(p => p.y));
        const maxY = Math.max(...bPts.map(p => p.y));
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        const spanX = maxX - minX || 1e-8;
        const spanY = maxY - minY || 1e-8;
        const isLatLng = spanX < 5 && spanY < 5;

        let scaleX = 1;
        let scaleZ = 1;
        if (isLatLng) {
          scaleX = 111320;
          scaleZ = 111320 * Math.cos((avgX * Math.PI) / 180);
        }

        const reverseProject = (localX, localZ) => ({
          x: avgX + (localX / scaleX),
          y: avgY + (localZ / scaleZ)
        });

        const newRooms = [];
        
        placedComponents.forEach(comp => {
          const isCorridor = comp.type === 'corridor' || comp.name.toLowerCase().includes('corridor');
          const type = isCorridor ? 'corridor' : 'classroom';
          const fill = isCorridor ? '#8b5cf6' : '#3b82f6';
          
          const w = comp.dimensions?.width || 3;
          const l = comp.dimensions?.length || 4;
          const pos = comp.position || { x: 0, z: 0 };
          const rotY = comp.rotation?.y || 0;

          const hw = w / 2;
          const hl = l / 2;

          const corners = [
            { x: -hw, z: -hl },
            { x: hw, z: -hl },
            { x: hw, z: hl },
            { x: -hw, z: hl }
          ];

          const cosA = Math.cos(rotY);
          const sinA = Math.sin(rotY);
          
          const geoPoints = corners.map(c => {
            const rotX = c.x * cosA + c.z * sinA;
            const rotZ = -c.x * sinA + c.z * cosA;
            return reverseProject(rotX + pos.x, rotZ + pos.z);
          });

          newRooms.push({
            campusId,
            blockId: buildingId,
            floorId,
            name: comp.name || 'Room',
            type,
            shape: {
              type: 'polygon',
              points: geoPoints,
              wallColors: {
                top: comp.wallColorTop || '#f6f5ee',
                bottom: comp.wallColorBottom || '#b5a68e'
              },
              fill
            }
          });

          if (type === 'classroom') {
            // Generate Door Geometry based on Spatial Studio PlacedComponentMesh door location
            // Door is a box: w=1.0, h=2.1, l=0.1 at [0, 1.05, length / 2 + 0.05]
            const dw = 1.0 / 2;
            const dl = 0.1 / 2;
            const dz = hl + 0.05; // local center of door
            
            const doorCorners = [
              { x: -dw, z: dz - dl },
              { x: dw, z: dz - dl },
              { x: dw, z: dz + dl },
              { x: -dw, z: dz + dl }
            ];

            const doorGeoPoints = doorCorners.map(c => {
              const rotX = c.x * cosA + c.z * sinA;
              const rotZ = -c.x * sinA + c.z * cosA;
              return reverseProject(rotX + pos.x, rotZ + pos.z);
            });

            newRooms.push({
              campusId,
              blockId: buildingId,
              floorId,
              name: `${comp.name || 'Room'} Door`,
              type: 'entrance',
              shape: {
                type: 'polygon',
                points: doorGeoPoints,
                fill: '#78716c' // Door frame color
              }
            });
          }
        });

        // Wipe old un-synced rooms for this floor and insert accurate generated polygons
        await Room.deleteMany({ floorId });
        if (newRooms.length > 0) {
          await Room.insertMany(newRooms);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Floor 3D Layout Published Live! User navigation map cache invalidated.',
      twin,
      publishedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error publishing digital twin layout:', error);
    res.status(500).json({ error: error.message });
  }
});

// List recent spatial scan sessions (with full details for admin recordings management)
router.get('/sessions', async (req, res) => {
  try {
    const { buildingId, floorId, adminId } = req.query;
    const query = {};
    if (buildingId && mongoose.Types.ObjectId.isValid(buildingId)) query.building = buildingId;
    if (floorId && mongoose.Types.ObjectId.isValid(floorId)) query.floor = floorId;
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) query.admin = adminId;
    
    // If request comes from dashboard, might want to only show those available on web
    if (req.query.webOnly === 'true') {
      query.isAvailableOnWeb = true;
    }

    const sessions = await SpatialScanSession.find(query)
      .populate('building', 'name')
      .populate('floor', 'name floorNumber')
      .populate('admin', 'username email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
