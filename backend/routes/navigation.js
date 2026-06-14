const router = require('express').Router();
const NavNode = require('../models/NavNode');
const NavPath = require('../models/NavPath');
const Room = require('../models/Room');
const Floor = require('../models/Floor');
const {
  buildGraph, autoConnectGraph, astar,
  findNearestNode, findNearestReachableNode,
  generateDirections, computeRouteSummary,
  haversineDistMeters
} = require('../utils/pathfinding');

// ─── In-Memory Graph Cache ──────────────────────────────────────────────
// Avoid rebuilding the graph from DB on every single route request.
// Cache is keyed by campusId and auto-expires after 60 seconds.
const graphCache = new Map();
const GRAPH_CACHE_TTL = 60_000; // 60 seconds

async function getCachedGraph(campusId) {
  const key = campusId.toString();
  const cached = graphCache.get(key);
  if (cached && Date.now() - cached.timestamp < GRAPH_CACHE_TTL) {
    return cached;
  }

  const [nodes, paths, floors] = await Promise.all([
    NavNode.find({ campusId, isActive: true }).lean(),
    NavPath.find({ campusId, isActive: true }).lean(),
    Floor.find({ campusId, isActive: true }).lean(),
  ]);

  const floorMap = {};
  floors.forEach(f => { floorMap[f._id.toString()] = f.level; });

  let graph = buildGraph(nodes, paths, floorMap);
  graph = autoConnectGraph(graph);

  const entry = { graph, nodes, paths, floors, floorMap, timestamp: Date.now() };
  graphCache.set(key, entry);

  // Limit cache size
  if (graphCache.size > 50) {
    const oldest = graphCache.keys().next().value;
    graphCache.delete(oldest);
  }

  return entry;
}

// Invalidate cache when admin updates navigation data
function invalidateGraphCache(campusId) {
  if (campusId) {
    graphCache.delete(campusId.toString());
  } else {
    graphCache.clear();
  }
}

// POST find route to nearest exit
router.post('/route-to-exit', async (req, res) => {
  try {
    const { startX, startY, campusId } = req.body;
    const cached = await getCachedGraph(campusId);
    const graph = { ...cached.graph };
    const nodes = cached.nodes;

    if (Object.keys(graph).length === 0) {
      return res.status(400).json({ error: 'No nodes found' });
    }

    // Find all exits
    const exits = nodes.filter(n =>
      n.type === 'entrance' || n.type === 'exit' ||
      (n.label && (n.label.toLowerCase().includes('exit') || n.label.toLowerCase().includes('entrance')))
    );
    if (exits.length === 0) return res.status(404).json({ error: 'No exit found on campus' });

    let startNodeId = req.body.startNodeId;
    if (!startNodeId && startX != null && startY != null) {
      const allNodes = Object.values(graph);
      const withDists = allNodes.map(n => ({
        node: n,
        dist: haversineDistMeters(startX, startY, n.x, n.y)
      }));
      withDists.sort((a, b) => a.dist - b.dist);

      if (withDists.length > 0) {
        const virtualStartId = 'user_gps_start';
        graph[virtualStartId] = { id: virtualStartId, x: startX, y: startY, neighbors: [], type: 'user' };
        
        const kNearest = withDists.slice(0, Math.min(3, withDists.length));
        kNearest.forEach(n => {
          graph[virtualStartId].neighbors.push({ nodeId: n.node.id, distance: n.dist, weight: n.dist, pathType: 'street' });
        });
        startNodeId = virtualStartId;
      }
    }
    if (!startNodeId) return res.status(404).json({ error: 'Could not find starting point' });

    let bestResult = null;
    let shortestDist = Infinity;

    // Try routing to all exits and pick the shortest
    for (const exit of exits) {
      const result = astar(graph, startNodeId, exit._id.toString());
      if (result.found && result.distance < shortestDist) {
        shortestDist = result.distance;
        bestResult = { ...result, targetExit: exit };
      }
    }

    if (!bestResult) return res.status(404).json({ error: 'No path to any exit found' });

    const directions = generateDirections(bestResult.path);
    const summary = computeRouteSummary(directions);
    res.json({
      ...bestResult,
      distance: summary.totalDistance,
      directions,
      eta: summary.totalEta,
      totalSteps: summary.totalSteps,
      routeType: 'emergency_exit',
    });
  } catch (err) {
    console.error('[Navigation Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST find route between two points
router.post('/route', async (req, res) => {
  try {
    const { startNodeId, endNodeId, campusId, accessible = false } = req.body;

    const { graph } = await getCachedGraph(campusId);

    if (Object.keys(graph).length === 0) {
      return res.status(400).json({ error: 'No navigation nodes found' });
    }

    let result = astar(graph, startNodeId, endNodeId, { requireAccessible: accessible });

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
    console.error('[Navigation Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST find route between coordinates (for Live Meet / dynamic routing)
router.post('/route-coords', async (req, res) => {
  try {
    const { startX, startY, endX, endY, campusId, accessible = false } = req.body;

    if (startX == null || startY == null || endX == null || endY == null || !campusId) {
      return res.status(400).json({ error: 'Missing required fields: startX, startY, endX, endY, campusId' });
    }

    const cached = await getCachedGraph(campusId);
    // Deep copy/clone graph to prevent polluting the cache with virtual nodes/edges
    const graph = JSON.parse(JSON.stringify(cached.graph));

    if (Object.keys(graph).length === 0) {
      return res.status(400).json({ error: 'No navigation nodes found on this campus.' });
    }

    const allNodes = Object.values(graph);

    // Find nearest nodes to start coordinate
    const startDists = allNodes.map(n => ({
      node: n,
      dist: haversineDistMeters(startX, startY, n.x, n.y)
    })).sort((a, b) => a.dist - b.dist);

    if (startDists.length === 0) {
      return res.status(404).json({ error: 'No graph nodes found near starting location' });
    }

    const virtualStartId = 'user_gps_start';
    graph[virtualStartId] = {
      id: virtualStartId,
      x: startX,
      y: startY,
      floorId: null,
      floorLevel: null,
      type: 'user',
      neighbors: []
    };

    // Connect virtual start to nearest 3 nodes
    const kNearestStart = startDists.slice(0, Math.min(3, startDists.length));
    kNearestStart.forEach(n => {
      graph[virtualStartId].neighbors.push({
        nodeId: n.node.id,
        distance: n.dist,
        weight: n.dist,
        pathType: 'connector',
        accessible: true
      });
    });

    // Find nearest nodes to end coordinate
    const endDists = allNodes.map(n => ({
      node: n,
      dist: haversineDistMeters(endX, endY, n.x, n.y)
    })).sort((a, b) => a.dist - b.dist);

    if (endDists.length === 0) {
      return res.status(404).json({ error: 'No graph nodes found near ending location' });
    }

    const virtualEndId = 'user_gps_end';
    graph[virtualEndId] = {
      id: virtualEndId,
      x: endX,
      y: endY,
      floorId: null,
      floorLevel: null,
      type: 'user',
      neighbors: []
    };

    // Connect nearest 3 nodes TO virtual end node (since graph neighbors are directed)
    const kNearestEnd = endDists.slice(0, Math.min(3, endDists.length));
    kNearestEnd.forEach(n => {
      if (graph[n.node.id]) {
        graph[n.node.id].neighbors.push({
          nodeId: virtualEndId,
          distance: n.dist,
          weight: n.dist,
          pathType: 'connector',
          accessible: true
        });
      }
    });

    // Run A* search
    let result = astar(graph, virtualStartId, virtualEndId, { requireAccessible: accessible });

    if (!result.found) {
      return res.status(404).json({ error: 'No route found between coordinates' });
    }

    const directions = generateDirections(result.path);
    const summary = computeRouteSummary(directions);

    res.json({
      ...result,
      distance: summary.totalDistance,
      directions,
      eta: summary.totalEta,
      totalSteps: summary.totalSteps
    });

  } catch (err) {
    console.error('[Navigation Route-Coords Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST find route to a room — with multi-level fallback
router.post('/route-to-room', async (req, res) => {
  try {
    const { startNodeId, startX, startY, roomId, campusId, accessible = false } = req.body;

    const cached = await getCachedGraph(campusId);
    const graph = { ...cached.graph };

    if (Object.keys(graph).length === 0) {
      return res.status(400).json({ error: 'No navigation nodes have been placed on this campus yet.' });
    }

    // --- Resolve start node from GPS coordinates if provided ---
    let startId;
    if (startX != null && startY != null) {
      const allNodes = Object.values(graph);
      const withDists = allNodes.map(n => ({
        node: n,
        dist: haversineDistMeters(startX, startY, n.x, n.y)
      }));
      withDists.sort((a, b) => a.dist - b.dist);

      if (withDists.length === 0) {
        return res.status(400).json({ error: 'No navigation node found near your location.' });
      }

      const virtualStartId = 'user_gps_start';
      graph[virtualStartId] = { id: virtualStartId, x: startX, y: startY, neighbors: [], type: 'user' };
      
      const kNearest = withDists.slice(0, Math.min(3, withDists.length));
      kNearest.forEach(n => {
        graph[virtualStartId].neighbors.push({ nodeId: n.node.id, distance: n.dist, weight: n.dist, pathType: 'street' });
      });

      startId = virtualStartId;
      console.log(`[Navigation] GPS start (${startX.toFixed(6)}, ${startY.toFixed(6)}) → virtual node connected to top ${kNearest.length} nodes`);
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

      // Find nearest node to the room's position
      const nearest = findNearestNode(graph, destX, destY, destFloorId);
      if (!nearest) {
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
    let result = astar(graph, startId, endNodeId, { requireAccessible: accessible });

    let routeType = 'direct';

    // --- Step 3: If direct route failed, find nearest reachable node to destination ---
    if (!result.found && destX !== null && destY !== null) {
      console.log(`[Navigation] Direct route failed. Trying nearest reachable node fallback...`);

      const fallback = findNearestReachableNode(graph, startId, destX, destY, destFloorId);

      if (fallback.node) {
        result = astar(graph, startId, fallback.node.id, { requireAccessible: accessible });

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

    // Count floor transitions
    const totalFloorTransitions = directions.filter(d => d.isFloorChange).length;

    res.json({
      ...result,
      distance: summary.totalDistance,
      directions,
      eta: summary.totalEta,
      totalSteps: summary.totalSteps,
      totalFloorTransitions,
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
    const { graph } = await getCachedGraph(campusId);
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
    const FloorModel = require('../models/Floor');
    const blocks = await Block.find({ campusId, isActive: true });
    const floors = await FloorModel.find({ campusId, isActive: true });

    // Invalidate graph cache when map data is fetched fresh (usually means admin updated data)
    invalidateGraphCache(campusId);

    res.json({ nodes, paths, rooms, qrcodes, beacons, blocks, floors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
