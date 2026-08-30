// NavX Pathfinding Engine (Client)
// High-performance A-Star and Dijkstra for on-device indoor navigation.
// Binary-heap PQ, Haversine distance, bearing-based turns, sampled auto-connect.

// --- Constants ---
const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const AVG_STRIDE_M = 0.72;

const SPEED = {
  hallway:   1.3,
  outdoor:   1.4,
  stairs:    0.6,
  elevator:  0.8,
  connector: 1.1,
  default:   1.2,
};

// --- Binary-Heap Priority Queue ---
class PriorityQueue {
  constructor() {
    this._heap = [];
  }

  get size() {
    return this._heap.length;
  }

  enqueue(element, priority) {
    this._heap.push({ element, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  dequeue() {
    const heap = this._heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
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
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left  < len && heap[left].priority  < heap[smallest].priority) smallest = left;
      if (right < len && heap[right].priority < heap[smallest].priority) smallest = right;
      if (smallest === idx) break;
      [heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
      idx = smallest;
    }
  }
}

// --- Haversine Distance (meters) ---
function geoDistMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Bearing (forward azimuth) A to B in degrees [0, 360) ---
function bearing(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

// --- Signed angle difference (-180, 180] ---
function angleDiff(fromDeg, toDeg) {
  let d = toDeg - fromDeg;
  while (d >  180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

// --- Compass label ---
function compassLabel(deg) {
  const dirs = ['north','north-east','east','south-east','south','south-west','west','north-west'];
  return dirs[Math.round(deg / 45) % 8];
}

// --- Ordinal floor name ---
function ordinalFloor(level) {
  if (level === 0) return 'ground floor';
  const abs = Math.abs(level);
  const suffix =
    abs % 100 >= 11 && abs % 100 <= 13 ? 'th'
    : abs % 10 === 1 ? 'st'
    : abs % 10 === 2 ? 'nd'
    : abs % 10 === 3 ? 'rd'
    : 'th';
  if (level < 0) return `basement ${abs}`;
  return `${level}${suffix} floor`;
}

// --- Build Graph ---
function buildGraph(nodes, paths, floorMap = {}) {
  const graph = {};

  for (const node of nodes) {
    const id = node._id.toString();
    const floorId = node.floorId ? node.floorId.toString() : null;
    graph[id] = {
      id,
      x: node.x,
      y: node.y,
      floorId,
      floorLevel: floorId && floorMap[floorId] != null ? floorMap[floorId] : null,
      type: node.type,
      neighbors: [],
    };
  }

  for (const path of paths) {
    const a = path.nodeA.toString();
    const b = path.nodeB.toString();
    if (!graph[a] || !graph[b]) continue;

    const trueDist = geoDistMeters(graph[a].x, graph[a].y, graph[b].x, graph[b].y);
    const edgeDist = Math.max(path.distance, trueDist);
    const effectiveWeight = edgeDist * path.weight * (1 + path.congestionLevel * 0.1);

    graph[a].neighbors.push({
      nodeId: b,
      distance: edgeDist,
      weight: effectiveWeight,
      pathType: path.type,
      accessible: path.accessible,
    });

    if (path.bidirectional) {
      graph[b].neighbors.push({
        nodeId: a,
        distance: edgeDist,
        weight: effectiveWeight,
        pathType: path.type,
        accessible: path.accessible,
      });
    }
  }

  return graph;
}

// --- Auto-Connect Disconnected Components ---
// Optimized: uses BFS for component detection and samples representative
// nodes from each component to avoid O(n^2 * m^2) brute force.
function autoConnectGraph(graph) {
  const nodeIds = Object.keys(graph);
  if (nodeIds.length === 0) return graph;

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

  if (components.length <= 1) return graph;

  // Merge by connecting closest representative nodes between components.
  // Sample up to 20 nodes per component to keep O(k^2) manageable.
  const MAX_SAMPLES = 20;

  function sampleNodes(comp) {
    if (comp.length <= MAX_SAMPLES) return comp;
    const step = Math.floor(comp.length / MAX_SAMPLES);
    const result = [];
    for (let i = 0; i < comp.length && result.length < MAX_SAMPLES; i += step) {
      result.push(comp[i]);
    }
    return result;
  }

  while (components.length > 1) {
    let bestDist = Infinity;
    let bestA = null;
    let bestB = null;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < components.length; i++) {
      const samplesI = sampleNodes(components[i]);
      for (let j = i + 1; j < components.length; j++) {
        const samplesJ = sampleNodes(components[j]);
        for (const aId of samplesI) {
          const nodeA = graph[aId];
          for (const bId of samplesJ) {
            const nodeB = graph[bId];

            // STRICT RULE: Only auto-connect components on the SAME floor.
            const isSameFloor = (nodeA.floorId && nodeB.floorId && nodeA.floorId === nodeB.floorId) ||
              (nodeA.floorLevel != null && nodeB.floorLevel != null && nodeA.floorLevel === nodeB.floorLevel) ||
              (!nodeA.floorId && !nodeB.floorId);

            if (!isSameFloor) continue;

            const dist = geoDistMeters(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
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
      const virtualWeight = bestDist * 2.0;
      graph[bestA].neighbors.push({
        nodeId: bestB, distance: bestDist, weight: virtualWeight,
        pathType: 'connector', accessible: true,
      });
      graph[bestB].neighbors.push({
        nodeId: bestA, distance: bestDist, weight: virtualWeight,
        pathType: 'connector', accessible: true,
      });
      components[bestI] = components[bestI].concat(components[bestJ]);
      components.splice(bestJ, 1);
    } else {
      break;
    }
  }

  return graph;
}

// --- Heuristic for A-Star ---
function heuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  return geoDistMeters(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
}

// --- Reconstruct path from predecessor map ---
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
      floorLevel: gNode.floorLevel != null ? gNode.floorLevel : null,
      type: gNode.type,
    };

    if (i > 0) {
      const prevId = nodeIdList[i - 1];
      const prevNode = graph[prevId];
      const edgeInfo = prevNode.neighbors.find(n => n.nodeId === nid);
      entry.segmentDistance = edgeInfo
        ? edgeInfo.distance
        : geoDistMeters(prevNode.x, prevNode.y, gNode.x, gNode.y);
      entry.segmentType = edgeInfo ? edgeInfo.pathType : 'hallway';
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

// --- A-Star Algorithm ---
function astar(graph, startId, endId, options = {}) {
  const { requireAccessible = false } = options;

  if (!graph[startId] || !graph[endId]) {
    return { path: [], distance: 0, found: false };
  }

  const pq = new PriorityQueue();
  const distances = {};
  const previous = {};
  const visited = new Set();

  // Only initialize start - lazy init for the rest via Infinity default
  const nodeIds = Object.keys(graph);
  for (let i = 0; i < nodeIds.length; i++) {
    distances[nodeIds[i]] = Infinity;
  }
  distances[startId] = 0;
  pq.enqueue(startId, 0);

  while (!pq.isEmpty()) {
    const { element: current } = pq.dequeue();

    if (current === endId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph[current];
    if (!node) continue;

    const neighbors = node.neighbors;
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
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

// --- Dijkstra Algorithm ---
function dijkstra(graph, startId, endId, options = {}) {
  const { requireAccessible = false } = options;

  if (!graph[startId] || !graph[endId]) {
    return { path: [], distance: 0, found: false };
  }

  const pq = new PriorityQueue();
  const distances = {};
  const previous = {};
  const visited = new Set();

  const nodeIds = Object.keys(graph);
  for (let i = 0; i < nodeIds.length; i++) {
    distances[nodeIds[i]] = Infinity;
  }
  distances[startId] = 0;
  pq.enqueue(startId, 0);

  while (!pq.isEmpty()) {
    const { element: current } = pq.dequeue();

    if (current === endId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph[current];
    if (!node) continue;

    const neighbors = node.neighbors;
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (requireAccessible && !neighbor.accessible) continue;
      if (visited.has(neighbor.nodeId)) continue;

      const newDist = distances[current] + neighbor.weight;

      if (newDist < distances[neighbor.nodeId]) {
        distances[neighbor.nodeId] = newDist;
        previous[neighbor.nodeId] = current;
        pq.enqueue(neighbor.nodeId, newDist);
      }
    }
  }

  return reconstructPath(graph, previous, startId, endId, distances);
}

// --- Find Nearest Node ---
function findNearestNode(graph, x, y, floorId = null) {
  let nearest = null;
  let minDist = Infinity;

  const nodes = Object.values(graph);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (floorId && node.floorId !== floorId) continue;

    const dist = geoDistMeters(node.x, node.y, x, y);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  return nearest;
}

// --- Find All Reachable Nodes (BFS) ---
function findReachableNodes(graph, startId) {
  const reachable = new Set();
  if (!graph[startId]) return reachable;

  const queue = [startId];
  reachable.add(startId);

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = graph[current].neighbors;
    for (let i = 0; i < neighbors.length; i++) {
      const nid = neighbors[i].nodeId;
      if (!reachable.has(nid) && graph[nid]) {
        reachable.add(nid);
        queue.push(nid);
      }
    }
  }

  return reachable;
}

// --- Find Nearest Reachable Node to Target ---
function findNearestReachableNode(graph, startId, targetX, targetY, floorId = null) {
  const reachable = findReachableNodes(graph, startId);

  let nearest = null;
  let minDist = Infinity;

  for (const nodeId of reachable) {
    const node = graph[nodeId];
    if (!node) continue;
    if (floorId && node.floorId !== floorId) continue;

    const dist = geoDistMeters(node.x, node.y, targetX, targetY);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  // Fallback to any floor if floor-restricted search found nothing
  if (!nearest && floorId) {
    for (const nodeId of reachable) {
      const node = graph[nodeId];
      if (!node) continue;
      const dist = geoDistMeters(node.x, node.y, targetX, targetY);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }
  }

  return { node: nearest, distanceToTarget: minDist };
}

// --- Generate Turn-by-Turn Directions ---
function generateDirections(detailedPath) {
  if (detailedPath.length < 2) return [];

  const directions = [];

  // Pre-scan floor transitions
  const floorTransitions = [];
  for (let i = 0; i < detailedPath.length - 1; i++) {
    const current = detailedPath[i];
    const next = detailedPath[i + 1];
    if (current.floorId !== next.floorId) {
      let changeType = 'floor_change';
      if (next.type === 'elevator' || current.type === 'elevator') changeType = 'elevator';
      else if (next.type === 'stairs' || current.type === 'stairs') changeType = 'stairs';
      floorTransitions.push({ segmentIndex: i, changeType });
    }
  }

  const totalFloorTransitions = floorTransitions.length;
  let floorTransitionCounter = 0;

  for (let i = 0; i < detailedPath.length - 1; i++) {
    const current = detailedPath[i];
    const next = detailedPath[i + 1];

    const segDist = next.segmentDistance != null
      ? next.segmentDistance
      : geoDistMeters(current.x, current.y, next.x, next.y);

    const fwdBearing = bearing(current.x, current.y, next.x, next.y);

    // Determine instruction
    let instruction = 'Continue straight';

    if (i > 0) {
      const prev = detailedPath[i - 1];
      const prevBearing = bearing(prev.x, prev.y, current.x, current.y);
      const turn = angleDiff(prevBearing, fwdBearing);

      if      (turn >  135)                instruction = 'Make a U-turn right';
      else if (turn < -135)                instruction = 'Make a U-turn left';
      else if (turn >   60 && turn <=  135) instruction = 'Turn sharp right';
      else if (turn <  -60 && turn >= -135) instruction = 'Turn sharp left';
      else if (turn >   20 && turn <=   60) instruction = 'Turn right';
      else if (turn <  -20 && turn >=  -60) instruction = 'Turn left';
      else if (turn >    5)                 instruction = 'Bear right';
      else if (turn <   -5)                 instruction = 'Bear left';
    } else {
      instruction = 'Proceed straight ahead';
    }

    // Approach transition nodes
    const nextIsTransitionNode = (next.type === 'stairs' || next.type === 'elevator');
    if (nextIsTransitionNode && current.floorId === next.floorId) {
      instruction = next.type === 'elevator' ? 'Proceed to the elevator' : 'Proceed to the stairs';
    }

    // Floor change
    let isFloorChange = false;
    let floorChangeData = null;

    if (current.floorId !== next.floorId) {
      isFloorChange = true;
      floorTransitionCounter++;

      let changeType = 'floor_change';
      if (next.type === 'elevator' || current.type === 'elevator') changeType = 'elevator';
      else if (next.type === 'stairs' || current.type === 'stairs') changeType = 'stairs';

      const targetLevel = next.floorLevel != null ? next.floorLevel : null;
      if (targetLevel != null) {
        instruction = `Go to the ${ordinalFloor(targetLevel)}`;
      } else if (changeType === 'elevator') {
        instruction = 'Take the elevator to the next floor';
      } else if (changeType === 'stairs') {
        instruction = 'Take the stairs to the next floor';
      } else {
        instruction = 'Change floor';
      }

      floorChangeData = {
        isFloorChange: true,
        floorChangeType: changeType,
        fromFloorId: current.floorId,
        toFloorId: next.floorId,
        fromFloorLevel: current.floorLevel != null ? current.floorLevel : null,
        targetFloorLevel: targetLevel,
        floorTransitionNumber: floorTransitionCounter,
        totalFloorTransitions,
      };
    }

    const segType = next.segmentType || 'default';
    const speed = SPEED[segType] || SPEED.default;
    const segEta = Math.round(segDist / speed);
    const segSteps = Math.max(1, Math.round(segDist / AVG_STRIDE_M));

    const dirEntry = {
      step: i + 1,
      instruction,
      from: { x: current.x, y: current.y, floorId: current.floorId },
      to:   { x: next.x,    y: next.y,    floorId: next.floorId },
      distance: Math.round(segDist * 10) / 10,
      bearing: Math.round(fwdBearing),
      eta: segEta,
      steps: segSteps,
      pathType: segType,
    };

    if (isFloorChange && floorChangeData) {
      Object.assign(dirEntry, floorChangeData);
    }

    directions.push(dirEntry);
  }

  return directions;
}

// --- Compute Route Summary ---
function computeRouteSummary(directions) {
  let totalDistance = 0;
  let totalEta = 0;
  let totalSteps = 0;

  for (const d of directions) {
    totalDistance += d.distance;
    totalEta += d.eta;
    totalSteps += d.steps;
  }

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalEta,
    totalSteps,
  };
}

export {
  buildGraph,
  autoConnectGraph,
  astar,
  dijkstra,
  findNearestNode,
  findNearestReachableNode,
  findReachableNodes,
  generateDirections,
  computeRouteSummary,
  geoDistMeters,
  bearing,
  PriorityQueue,
};
