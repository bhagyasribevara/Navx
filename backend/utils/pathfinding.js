/**
 * NavX Pathfinding Engine
 * Implements Dijkstra and A* algorithms for indoor navigation
 * With auto-connect, fallback routing, and disconnected-graph handling
 *
 * Uses the Haversine formula for geodesic distance calculations,
 * a binary-heap priority queue for O(log n) operations,
 * and bearing-based turn-by-turn direction generation.
 */

// ──────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;          // Mean Earth radius in meters
const DEG_TO_RAD     = Math.PI / 180;
const RAD_TO_DEG     = 180 / Math.PI;

// Walking speed presets (meters per second)
const SPEED = {
  hallway:   1.3,   // normal indoor corridor
  outdoor:   1.4,   // slightly faster outdoors
  stairs:    0.6,   // significantly slower on stairs
  elevator:  0.8,   // waiting + elevator travel averaged
  connector: 1.1,   // virtual bridge segments
  default:   1.2,
};

// Average stride length in meters (used for step-count estimation)
const AVG_STRIDE_M = 0.72;

// ──────────────────────────────────────────────
//  Binary-Heap Priority Queue — O(log n) push/pop
// ──────────────────────────────────────────────

class PriorityQueue {
  constructor() {
    this._heap = [];
  }

  enqueue(element, priority) {
    this._heap.push({ element, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  dequeue() {
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0 && last) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty() {
    return this._heap.length === 0;
  }

  _bubbleUp(idx) {
    const heap = this._heap;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[idx].priority >= heap[parent].priority) break;
      [heap[idx], heap[parent]] = [heap[parent], heap[idx]];
      idx = parent;
    }
  }

  _sinkDown(idx) {
    const heap = this._heap;
    const len = heap.length;
    while (true) {
      let smallest = idx;
      const left  = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left  < len && heap[left].priority  < heap[smallest].priority) smallest = left;
      if (right < len && heap[right].priority < heap[smallest].priority) smallest = right;
      if (smallest === idx) break;
      [heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
      idx = smallest;
    }
  }
}

// ──────────────────────────────────────────────
//  Haversine distance (meters) between two lat/lng points
// ──────────────────────────────────────────────

function haversineDistMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keep the legacy name as an alias so callers that use `geoDistMeters` still work
const geoDistMeters = haversineDistMeters;

// ──────────────────────────────────────────────
//  Initial bearing (forward azimuth) from point A → B
//  Returns degrees [0, 360)
// ──────────────────────────────────────────────

function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

// ──────────────────────────────────────────────
//  Signed angle difference in degrees (−180, 180]
// ──────────────────────────────────────────────

function angleDiff(fromDeg, toDeg) {
  let d = toDeg - fromDeg;
  while (d >  180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

// ──────────────────────────────────────────────
//  Build adjacency list from nodes and paths
// ──────────────────────────────────────────────

function buildGraph(nodes, paths) {
  const graph = {};

  // Initialize all nodes
  nodes.forEach(node => {
    const id = node._id.toString();
    graph[id] = {
      id,
      x: node.x,
      y: node.y,
      floorId: node.floorId ? node.floorId.toString() : null,
      type: node.type,
      neighbors: []
    };
  });

  // Add edges from paths
  paths.forEach(path => {
    const a = path.nodeA.toString();
    const b = path.nodeB.toString();

    if (!graph[a] || !graph[b]) return;

    // Recompute true geodesic distance between the two end-nodes
    const trueDist = haversineDistMeters(graph[a].x, graph[a].y, graph[b].x, graph[b].y);
    // Use the larger of stored distance and haversine (stored may include vertical component)
    const edgeDist = Math.max(path.distance, trueDist);

    const effectiveWeight = edgeDist * path.weight * (1 + path.congestionLevel * 0.1);

    graph[a].neighbors.push({
      nodeId: b,
      distance: edgeDist,
      weight: effectiveWeight,
      pathType: path.type,
      accessible: path.accessible
    });

    if (path.bidirectional) {
      graph[b].neighbors.push({
        nodeId: a,
        distance: edgeDist,
        weight: effectiveWeight,
        pathType: path.type,
        accessible: path.accessible
      });
    }
  });

  return graph;
}

// ──────────────────────────────────────────────
//  Auto-connect disconnected graph components
// ──────────────────────────────────────────────

function autoConnectGraph(graph) {
  const nodeIds = Object.keys(graph);
  if (nodeIds.length === 0) return graph;

  // BFS to find connected components
  const visited = new Set();
  const components = [];

  for (const startId of nodeIds) {
    if (visited.has(startId)) continue;
    const component = [];
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of graph[current].neighbors) {
        if (!visited.has(neighbor.nodeId) && graph[neighbor.nodeId]) {
          visited.add(neighbor.nodeId);
          queue.push(neighbor.nodeId);
        }
      }
    }
    components.push(component);
  }

  // If only one component, graph is already fully connected
  if (components.length <= 1) return graph;

  console.log(`[Pathfinding] Found ${components.length} disconnected components. Auto-connecting...`);

  // Merge components by connecting closest nodes between them
  while (components.length > 1) {
    let bestDist = Infinity;
    let bestA = null;
    let bestB = null;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        for (const aId of components[i]) {
          for (const bId of components[j]) {
            const nodeA = graph[aId];
            const nodeB = graph[bId];
            const dist = haversineDistMeters(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestA = aId;
              bestB = bId;
              bestI = i;
              bestJ = j;
            }
          }
        }
      }
    }

    if (bestA && bestB) {
      const virtualDistance = bestDist;
      const virtualWeight = virtualDistance * 1.5; // Slightly penalize virtual edges

      graph[bestA].neighbors.push({
        nodeId: bestB,
        distance: virtualDistance,
        weight: virtualWeight,
        pathType: 'connector',
        accessible: true
      });
      graph[bestB].neighbors.push({
        nodeId: bestA,
        distance: virtualDistance,
        weight: virtualWeight,
        pathType: 'connector',
        accessible: true
      });

      console.log(`[Pathfinding] Connected component ${bestI} <-> ${bestJ} via virtual edge (${Math.round(bestDist)}m)`);

      components[bestI] = components[bestI].concat(components[bestJ]);
      components.splice(bestJ, 1);
    } else {
      break;
    }
  }

  return graph;
}

// ──────────────────────────────────────────────
//  Heuristic for A* — Haversine great-circle distance
// ──────────────────────────────────────────────

function heuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  return haversineDistMeters(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
}

// ──────────────────────────────────────────────
//  Reconstruct path, compute true segment distances
// ──────────────────────────────────────────────

function reconstructPath(graph, previous, startId, endId, distances) {
  if (distances[endId] === Infinity) {
    return { path: [], distance: 0, found: false };
  }

  const nodeIdList = [];
  let current = endId;
  while (current) {
    nodeIdList.unshift(current);
    current = previous[current];
  }

  // Build detailed path with coordinates and per-segment data
  const detailedPath = [];
  let totalDistance = 0;

  for (let i = 0; i < nodeIdList.length; i++) {
    const nid = nodeIdList[i];
    const gNode = graph[nid];

    const entry = {
      nodeId: nid,
      x: gNode.x,
      y: gNode.y,
      floorId: gNode.floorId,
      type: gNode.type,
    };

    // Attach the distance & pathType of the edge LEADING TO this node
    if (i > 0) {
      const prevId = nodeIdList[i - 1];
      const prevNode = graph[prevId];
      const edgeInfo = prevNode.neighbors.find(n => n.nodeId === nid);
      entry.segmentDistance = edgeInfo ? edgeInfo.distance : haversineDistMeters(prevNode.x, prevNode.y, gNode.x, gNode.y);
      entry.segmentType    = edgeInfo ? edgeInfo.pathType : 'hallway';
      totalDistance += entry.segmentDistance;
    }

    detailedPath.push(entry);
  }

  return {
    path: detailedPath,
    distance: totalDistance,
    found: true,
    nodeCount: nodeIdList.length,
  };
}

// ──────────────────────────────────────────────
//  A* pathfinding algorithm
// ──────────────────────────────────────────────

function astar(graph, startId, endId, options = {}) {
  const { requireAccessible = false } = options;

  if (!graph[startId] || !graph[endId]) {
    return { path: [], distance: 0, found: false };
  }

  const pq = new PriorityQueue();
  const distances = {};
  const previous = {};
  const visited = new Set();

  // Initialize
  Object.keys(graph).forEach(nodeId => {
    distances[nodeId] = Infinity;
  });
  distances[startId] = 0;
  pq.enqueue(startId, 0);

  while (!pq.isEmpty()) {
    const { element: current } = pq.dequeue();

    if (current === endId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph[current];
    if (!node) continue;

    for (const neighbor of node.neighbors) {
      if (requireAccessible && !neighbor.accessible) continue;
      if (visited.has(neighbor.nodeId)) continue;

      const newDist = distances[current] + neighbor.weight;

      if (newDist < distances[neighbor.nodeId]) {
        distances[neighbor.nodeId] = newDist;
        previous[neighbor.nodeId] = current;

        const h = heuristic(graph[neighbor.nodeId], graph[endId]);
        pq.enqueue(neighbor.nodeId, newDist + h);
      }
    }
  }

  return reconstructPath(graph, previous, startId, endId, distances);
}


// ──────────────────────────────────────────────
//  Find nearest node to a given position
// ──────────────────────────────────────────────

function findNearestNode(graph, x, y, floorId = null) {
  let nearest = null;
  let minDist = Infinity;

  Object.values(graph).forEach(node => {
    if (floorId && node.floorId !== floorId) return;

    const dist = haversineDistMeters(node.x, node.y, x, y);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  });

  return nearest;
}

// ──────────────────────────────────────────────
//  Find all reachable nodes (BFS)
// ──────────────────────────────────────────────

function findReachableNodes(graph, startId) {
  const reachable = new Set();
  if (!graph[startId]) return reachable;

  const queue = [startId];
  reachable.add(startId);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of graph[current].neighbors) {
      if (!reachable.has(neighbor.nodeId) && graph[neighbor.nodeId]) {
        reachable.add(neighbor.nodeId);
        queue.push(neighbor.nodeId);
      }
    }
  }

  return reachable;
}

// ──────────────────────────────────────────────
//  Find nearest REACHABLE node to a target
// ──────────────────────────────────────────────

function findNearestReachableNode(graph, startId, targetX, targetY, floorId = null) {
  const reachable = findReachableNodes(graph, startId);

  let nearest = null;
  let minDist = Infinity;

  for (const nodeId of reachable) {
    const node = graph[nodeId];
    if (!node) continue;
    if (floorId && node.floorId !== floorId) continue;

    const dist = haversineDistMeters(node.x, node.y, targetX, targetY);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  // If floor-restricted search found nothing, try all floors
  if (!nearest && floorId) {
    for (const nodeId of reachable) {
      const node = graph[nodeId];
      if (!node) continue;
      const dist = haversineDistMeters(node.x, node.y, targetX, targetY);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }
  }

  return { node: nearest, distanceToTarget: minDist };
}

// ──────────────────────────────────────────────
//  Turn-by-turn direction generation
//
//  Each direction step corresponds exactly to one
//  edge (segment) of the path so the UI can advance
//  steps in lock-step with the path nodes shown on
//  the map.
// ──────────────────────────────────────────────

function generateDirections(detailedPath) {
  if (detailedPath.length < 2) return [];

  const directions = [];

  for (let i = 0; i < detailedPath.length - 1; i++) {
    const current = detailedPath[i];
    const next    = detailedPath[i + 1];

    // True geodesic distance for this segment
    const segDist = next.segmentDistance != null
      ? next.segmentDistance
      : haversineDistMeters(current.x, current.y, next.x, next.y);

    // Forward bearing of THIS segment
    const fwdBearing = bearing(current.x, current.y, next.x, next.y);

    // Determine turn instruction relative to previous segment
    let instruction = 'Continue straight';

    if (i > 0) {
      const prev = detailedPath[i - 1];
      const prevBearing = bearing(prev.x, prev.y, current.x, current.y);
      const turn = angleDiff(prevBearing, fwdBearing);

      if      (turn >  135)                instruction = 'Make a U-turn right';
      else if (turn < -135)                instruction = 'Make a U-turn left';
      else if (turn >   60 && turn <=  135) instruction = 'Turn sharp right';
      else if (turn < -60  && turn >= -135) instruction = 'Turn sharp left';
      else if (turn >   20 && turn <=   60) instruction = 'Turn right';
      else if (turn < -20  && turn >= -60)  instruction = 'Turn left';
      else if (turn >   5)                  instruction = 'Bear right';
      else if (turn <  -5)                  instruction = 'Bear left';
      // else within ±5° → straight
    } else {
      // First step — give a "Head toward …" instruction
      instruction = `Head ${compassLabel(fwdBearing)}`;
    }

    // Floor-change overrides
    if (current.floorId !== next.floorId) {
      if (next.type === 'elevator' || current.type === 'elevator') instruction = 'Take the elevator';
      else if (next.type === 'stairs' || current.type === 'stairs') instruction = 'Take the stairs';
      else instruction = 'Change floor';
    }

    // Walking speed depends on segment type
    const segType = next.segmentType || 'default';
    const speed   = SPEED[segType] || SPEED.default;
    const segEta  = Math.round(segDist / speed);           // seconds
    const segSteps = Math.max(1, Math.round(segDist / AVG_STRIDE_M));

    directions.push({
      step: i + 1,
      instruction,
      from: { x: current.x, y: current.y, floorId: current.floorId },
      to:   { x: next.x,    y: next.y,    floorId: next.floorId },
      distance: Math.round(segDist * 10) / 10,   // 1-decimal meter accuracy
      bearing: Math.round(fwdBearing),
      eta: segEta,
      steps: segSteps,
      pathType: segType,
    });
  }

  return directions;
}

// ──────────────────────────────────────────────
//  Compass label from bearing angle
// ──────────────────────────────────────────────

function compassLabel(deg) {
  const dirs = ['north','north-east','east','south-east','south','south-west','west','north-west'];
  return dirs[Math.round(deg / 45) % 8];
}

// ──────────────────────────────────────────────
//  Compute route-level summary metrics
// ──────────────────────────────────────────────

function computeRouteSummary(directions) {
  let totalDistance = 0;
  let totalEta = 0;
  let totalSteps = 0;

  for (const d of directions) {
    totalDistance += d.distance;
    totalEta     += d.eta;
    totalSteps   += d.steps;
  }

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalEta,          // seconds
    totalSteps,
  };
}

module.exports = {
  buildGraph,
  autoConnectGraph,
  astar,
  findNearestNode,
  findNearestReachableNode,
  findReachableNodes,
  generateDirections,
  computeRouteSummary,
  geoDistMeters,
  haversineDistMeters,
  bearing,
  PriorityQueue
};
