const router = require('express').Router();
const NavNode = require('../models/NavNode');
const NavPath = require('../models/NavPath');
const Room = require('../models/Room');
const {
  buildGraph, autoConnectGraph, astar,
  findNearestNode, findNearestReachableNode,
  generateDirections, computeRouteSummary,
  haversineDistMeters
} = require('../utils/pathfinding');

// POST find route between two points
router.post('/route', async (req, res) => {
  try {
    const { startNodeId, endNodeId, campusId, accessible = false } = req.body;
    
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });
    
    if (nodes.length === 0) return res.status(400).json({ error: 'No navigation nodes found' });
    
    // Build graph and auto-connect disconnected components
    let graph = buildGraph(nodes, paths);
    graph = autoConnectGraph(graph);

    const pathfinder = algorithm === 'dijkstra' ? dijkstra : astar;
    const result = pathfinder(graph, startNodeId, endNodeId, { requireAccessible: accessible });
    
    if (!result.found) return res.status(404).json({ error: 'No route found' });
    
    const directions = generateDirections(result.path);
    const summary = computeRouteSummary(directions);
    
    res.json({
      ...result,
      distance: summary.totalDistance,
      directions,
      eta: summary.totalEta,
      totalSteps: summary.totalSteps,
      algorithm: 'astar',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST find route to a room — with multi-level fallback
router.post('/route-to-room', async (req, res) => {
  try {
    const { startNodeId, startX, startY, roomId, campusId, accessible = false } = req.body;
    
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });

    if (nodes.length === 0) {
      return res.status(400).json({ error: 'No navigation nodes have been placed on this campus yet.' });
    }

    // Build graph and auto-connect disconnected components
    let graph = buildGraph(nodes, paths);
    graph = autoConnectGraph(graph);

    // --- Resolve start node from GPS coordinates if provided ---
    let startId;
    if (startX != null && startY != null) {
      const nearestStart = findNearestNode(graph, startX, startY, null);
      if (!nearestStart) {
        return res.status(400).json({ error: 'No navigation node found near your location.' });
      }
      startId = nearestStart.id;
      console.log(`[Navigation] GPS start (${startX.toFixed(6)}, ${startY.toFixed(6)}) → nearest node ${startId} (${haversineDistMeters(startX, startY, nearestStart.x, nearestStart.y).toFixed(1)}m away)`);
    } else if (startNodeId) {
      startId = startNodeId.toString();
    } else {
      return res.status(400).json({ error: 'Provide startNodeId or startX/startY coordinates.' });
    }

    // --- Step 1: Resolve the destination node ---
    let endNodeId = null;
    let destX = null;
    let destY = null;
    let destFloorId = null;

    // Check if there's a node explicitly linked to this room
    const roomNode = await NavNode.findOne({ roomId, isActive: true });
    
    if (roomNode) {
      endNodeId = roomNode._id.toString();
      destX = roomNode.x;
      destY = roomNode.y;
      destFloorId = roomNode.floorId ? roomNode.floorId.toString() : null;
    } else {
      // Fallback: Find nearest node to the room's geometric center
      const room = await Room.findById(roomId);
      if (!room || !room.shape) {
        return res.status(404).json({ error: 'Room not found or has no map geometry. Please add it in the admin panel.' });
      }
      
      destX = room.shape.x;
      destY = room.shape.y;
      destFloorId = room.floorId ? room.floorId.toString() : null;

      if (room.shape.points && room.shape.points.length > 0) {
        // Use centroid of the polygon for better accuracy
        const sumX = room.shape.points.reduce((s, p) => s + p.x, 0);
        const sumY = room.shape.points.reduce((s, p) => s + p.y, 0);
        destX = sumX / room.shape.points.length;
        destY = sumY / room.shape.points.length;
      }
      
      // Find nearest node to the room's position (any floor first, then same floor)
      const nearest = findNearestNode(graph, destX, destY, destFloorId);
      if (!nearest) {
        // Try without floor restriction
        const nearestAny = findNearestNode(graph, destX, destY, null);
        if (!nearestAny) {
          return res.status(404).json({ error: 'No navigation nodes found anywhere near this room.' });
        }
        endNodeId = nearestAny.id;
      } else {
        endNodeId = nearest.id;
      }
    }

    // Verify start node exists in graph
    if (!graph[startId]) {
      console.log(`[Navigation] Start node ${startId} not found. Available nodes: ${Object.keys(graph).length}`);
      return res.status(400).json({ error: 'Start node not found in navigation graph.' });
    }

    // --- Step 2: Try direct route ---
    const pathfinder = astar;
    let result = pathfinder(graph, startId, endNodeId, { requireAccessible: accessible });
    let routeType = 'direct'; // direct | nearest_reachable

    // --- Step 3: If direct route failed, find nearest reachable node to destination ---
    if (!result.found && destX !== null && destY !== null) {
      console.log(`[Navigation] Direct route failed. Trying nearest reachable node fallback...`);
      
      const fallback = findNearestReachableNode(graph, startId, destX, destY, destFloorId);
      
      if (fallback.node) {
        result = pathfinder(graph, startId, fallback.node.id, { requireAccessible: accessible });
        if (result.found) {
          routeType = 'nearest_reachable';
          console.log(`[Navigation] Fallback route found via nearest reachable node (${Math.round(fallback.distanceToTarget)}m from destination)`);
        }
      }
    }

    // --- Step 4: Final check ---
    if (!result.found) {
      return res.status(404).json({
        error: 'No navigable path exists between your location and this room. Please ensure paths are drawn connecting all areas in the Admin panel.'
      });
    }

    const directions = generateDirections(result.path);
    const summary = computeRouteSummary(directions);

    // Add final "walk to destination" step if route ends at nearby node, not the actual room
    if (routeType === 'nearest_reachable' && destX !== null && destY !== null) {
      const lastNode = result.path[result.path.length - 1];
      const walkDist = haversineDistMeters(lastNode.x, lastNode.y, destX, destY);

      if (walkDist > 5) {
        const walkSteps = Math.max(1, Math.round(walkDist / 0.72));
        const walkEta   = Math.round(walkDist / 1.2);

        directions.push({
          step: directions.length + 1,
          instruction: `Walk ${Math.round(walkDist)}m to reach your destination`,
          from: { x: lastNode.x, y: lastNode.y, floorId: lastNode.floorId },
          to: { x: destX, y: destY, floorId: destFloorId },
          distance: Math.round(walkDist * 10) / 10,
          bearing: 0,
          eta: walkEta,
          steps: walkSteps,
          pathType: 'hallway',
        });

        // Also append a virtual path point at the actual destination for map rendering
        result.path.push({
          nodeId: 'destination',
          x: destX,
          y: destY,
          floorId: destFloorId,
          type: 'destination'
        });

        summary.totalDistance += Math.round(walkDist * 10) / 10;
        summary.totalEta     += walkEta;
        summary.totalSteps   += walkSteps;
      }
    }

    res.json({
      ...result,
      distance: summary.totalDistance,
      directions,
      eta: summary.totalEta,
      totalSteps: summary.totalSteps,
      roomId,
      algorithm: 'astar',
      routeType,
      message: routeType === 'nearest_reachable'
        ? 'Navigating to the nearest accessible path point near your destination.'
        : undefined
    });
  } catch (err) {
    console.error('[Navigation Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST find nearest node to coordinates
router.post('/nearest-node', async (req, res) => {
  try {
    const { x, y, floorId, campusId } = req.body;
    const nodes = await NavNode.find({ campusId, isActive: true });
    const paths = await NavPath.find({ campusId, isActive: true });
    let graph = buildGraph(nodes, paths);
    graph = autoConnectGraph(graph);
    const nearest = findNearestNode(graph, x, y, floorId);
    if (!nearest) return res.status(404).json({ error: 'No nodes found' });
    res.json(nearest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET full navigation data for a campus (mobile app bulk download)
router.get('/map-data/:campusId', async (req, res) => {
  try {
    const { campusId } = req.params;
    const [nodes, paths, rooms, qrcodes, beacons] = await Promise.all([
      NavNode.find({ campusId, isActive: true }),
      NavPath.find({ campusId, isActive: true }),
      Room.find({ campusId, isActive: true }),
      require('../models/QRCode').find({ campusId, isActive: true }),
      require('../models/Beacon').find({ campusId, isActive: true })
    ]);
    
    const Block = require('../models/Block');
    const Floor = require('../models/Floor');
    const blocks = await Block.find({ campusId, isActive: true });
    const floors = await Floor.find({ campusId, isActive: true });
    
    res.json({ nodes, paths, rooms, qrcodes, beacons, blocks, floors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
