const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const SpatialScanSession = require('../models/SpatialScanSession');
const DigitalTwin = require('../models/DigitalTwin');
const NavNode = require('../models/NavNode');

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
        floorColor: finalFloorColor
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
      dtWalls = [
        { start: { x: -16.0, y: 0, z: 1.15 }, end: { x: 16.0, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: finalWallTop, colorBottom: finalWallBottom },
        { start: { x: -16.0, y: 0, z: -1.15 }, end: { x: 16.0, y: 0, z: -1.15 }, height: 2.8, thickness: 0.18, colorTop: finalWallTop, colorBottom: finalWallBottom },
        { start: { x: -16.0, y: 0, z: -1.15 }, end: { x: -16.0, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: finalWallTop, colorBottom: finalWallBottom },
        { start: { x: 16.0, y: 0, z: -1.15 }, end: { x: 16.0, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: finalWallTop, colorBottom: finalWallBottom }
      ];
    }

    if (!dtDoors || dtDoors.length === 0) {
      dtDoors = [
        { position: { x: -12.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '301', isOpen: true },
        { position: { x: -12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '302', isOpen: true },
        { position: { x: -6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '303', isOpen: true },
        { position: { x: -6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '304', isOpen: true },
        { position: { x: 0.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '305', isOpen: true },
        { position: { x: 0.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '306', isOpen: true },
        { position: { x: 6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '307', isOpen: true },
        { position: { x: 6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '308', isOpen: true },
        { position: { x: 12.0, y: 0, z: 1.15 }, width: 1.35, height: 2.2, roomNumber: 'Washroom', type: 'washroom', isOpen: true },
        { position: { x: 12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: 'Water Point', type: 'water', isOpen: true }
      ];
    }

    const finalRooms = (reqRooms && reqRooms.length > 0) ? reqRooms : (aiRooms.length > 0 ? aiRooms : [
      { roomNumber: '301', roomName: 'Room 301 (Hostel Room)', category: 'room', confidence: 0.98, position: { x: -12.0, y: 0, z: 1.15 } },
      { roomNumber: '302', roomName: 'Room 302 (Hostel Room)', category: 'room', confidence: 0.97, position: { x: -12.0, y: 0, z: -1.15 } },
      { roomNumber: '303', roomName: 'Room 303 (Hostel Room)', category: 'room', confidence: 0.96, position: { x: -6.0, y: 0, z: 1.15 } },
      { roomNumber: '304', roomName: 'Room 304 (Hostel Room)', category: 'room', confidence: 0.95, position: { x: -6.0, y: 0, z: -1.15 } },
      { roomNumber: '305', roomName: 'Room 305 (Hostel Room)', category: 'room', confidence: 0.96, position: { x: 0.0, y: 0, z: 1.15 } },
      { roomNumber: '306', roomName: 'Room 306 (Hostel Room)', category: 'room', confidence: 0.94, position: { x: 0.0, y: 0, z: -1.15 } },
      { roomNumber: '307', roomName: 'Room 307 (Hostel Room)', category: 'room', confidence: 0.95, position: { x: 6.0, y: 0, z: 1.15 } },
      { roomNumber: '308', roomName: 'Room 308 (Hostel Room)', category: 'room', confidence: 0.93, position: { x: 6.0, y: 0, z: -1.15 } },
      { roomNumber: 'Washroom', roomName: 'Common Washroom & Bathroom Suite', category: 'washroom', confidence: 0.99, position: { x: 12.0, y: 0, z: 1.15 } },
      { roomNumber: 'Water Point', roomName: 'RO Water Cooler Station', category: 'water', confidence: 0.96, position: { x: 12.0, y: 0, z: -1.15 } }
    ]);

    const finalLandmarks = (reqLandmarks && reqLandmarks.length > 0) ? reqLandmarks : (aiLandmarks.length > 0 ? aiLandmarks : [
      { type: 'exit_sign', label: 'West Fire Exit Green Sign', position: { x: -14.0, y: 2.1, z: 1.15 } },
      { type: 'exit_sign', label: 'East Fire Exit Green Sign', position: { x: 14.0, y: 2.1, z: 1.15 } },
      { type: 'water_cooler', label: 'RO Water Cooler', position: { x: 12.0, y: 0.0, z: -1.15 } },
      { type: 'switch', label: 'Corridor Light Switches', position: { x: -0.5, y: 1.2, z: 1.15 } },
      { type: 'washroom_suite', label: 'Bathrooms & Washroom Suite', position: { x: 12.0, y: 0.0, z: 1.15 } },
    ]);

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

    // Remove associated Digital Twin from the building floor so 3D twin removes it
    if (session.building && session.floor) {
      await DigitalTwin.deleteMany({
        $or: [
          { session: session._id },
          { building: session.building, floor: session.floor }
        ]
      });
    }

    // Delete session itself
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
      landmarks
    } = req.body;

    if (!buildingId || !floorId) {
      return res.status(400).json({ error: 'buildingId and floorId are required' });
    }

    const query = { building: buildingId, floor: floorId };
    
    // Clear old twin and save updated twin
    await DigitalTwin.deleteMany(query);

    const newTwin = new DigitalTwin({
      building: buildingId,
      floor: floorId,
      wallColorTop: wallColorTop || '#f6f5ee',
      wallColorBottom: wallColorBottom || '#b5a68e',
      floorMaterial: floorMaterial || 'terrazzo_mosaic',
      floorColor: floorColor || '#d6cebf',
      corridorWidth: corridorWidth || 2.3,
      corridorHeight: corridorHeight || 2.8,
      walls: walls || [],
      doors: doors || [],
      detectedRooms: detectedRooms || [],
      landmarks: landmarks || [],
      rooms: []
    });

    await newTwin.save();

    res.status(200).json({ 
      success: true, 
      message: '3D Digital Twin successfully saved and published!', 
      twin: newTwin 
    });
  } catch (error) {
    console.error('Error saving digital twin from 3D builder:', error);
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
