/**
 * NavX Pathfinding Engine
 * Implements Dijkstra and A* algorithms for indoor navigation
 * With auto-connect, fallback routing, and disconnected-graph handling
 */

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    const item = { element, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (item.priority < this.items[i].priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }
    if (!added) this.items.push(item);
  }

  dequeue() {
    return this.items.shift();
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

/**
 * Compute geo-distance in meters between two lat/lng-like coordinates
 */
function geoDistMeters(x1, y1, x2, y2) {
  const dx = (x1 - x2) * 111320;
  const dy = (y1 - y2) * 111320 * Math.cos(x1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build adjacency list from nodes and paths
 */
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
    
    const effectiveWeight = path.distance * path.weight * (1 + path.congestionLevel * 0.1);
    
    graph[a].neighbors.push({ 
      nodeId: b, 
      distance: path.distance,
      weight: effectiveWeight,
      pathType: path.type,
      accessible: path.accessible
    });
    
    if (path.bidirectional) {
      graph[b].neighbors.push({ 
        nodeId: a, 
        distance: path.distance,
        weight: effectiveWeight,
        pathType: path.type,
        accessible: path.accessible
      });
    }
  });

  return graph;
}

/**
 * Auto-connect disconnected graph components.
 * Finds isolated subgraphs and bridges them by adding virtual edges
 * between the closest pair of nodes in different components.
 * This ensures ANY node can reach ANY other node.
 */
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
  // Strategy: iteratively merge the two closest components
  while (components.length > 1) {
    let bestDist = Infinity;
    let bestA = null;
    let bestB = null;
    let bestI = -1;
    let bestJ = -1;

    // Find the closest pair of nodes across different components
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        for (const aId of components[i]) {
          for (const bId of components[j]) {
            const nodeA = graph[aId];
            const nodeB = graph[bId];
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
      // Add bidirectional virtual edge
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

      // Merge the two components
      components[bestI] = components[bestI].concat(components[bestJ]);
      components.splice(bestJ, 1);
    } else {
      break;
    }
  }

  return graph;
}

/**
 * Heuristic function for A* (geo-distance in meters)
 */
function heuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  return geoDistMeters(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
}

/**
 * A* pathfinding algorithm
 */
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

  // Reconstruct path
  const path = [];
  let current = endId;
  
  if (distances[endId] === Infinity) {
    return { path: [], distance: 0, found: false };
  }

  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  // Build detailed path with coordinates
  const detailedPath = path.map(nodeId => ({
    nodeId,
    x: graph[nodeId].x,
    y: graph[nodeId].y,
    floorId: graph[nodeId].floorId,
    type: graph[nodeId].type
  }));

  // Calculate actual distance (sum of edge distances, not weights)
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const node = graph[path[i]];
    const neighbor = node.neighbors.find(n => n.nodeId === path[i + 1]);
    if (neighbor) totalDistance += neighbor.distance;
  }

  return {
    path: detailedPath,
    distance: totalDistance,
    found: true,
    nodeCount: path.length
  };
}

/**
 * Dijkstra's algorithm (simpler, no heuristic)
 */
function dijkstra(graph, startId, endId, options = {}) {
  const { requireAccessible = false } = options;
  
  if (!graph[startId] || !graph[endId]) {
    return { path: [], distance: 0, found: false };
  }

  const pq = new PriorityQueue();
  const distances = {};
  const previous = {};
  const visited = new Set();

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
        pq.enqueue(neighbor.nodeId, newDist);
      }
    }
  }

  const path = [];
  let current = endId;
  
  if (distances[endId] === Infinity) {
    return { path: [], distance: 0, found: false };
  }

  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  const detailedPath = path.map(nodeId => ({
    nodeId,
    x: graph[nodeId].x,
    y: graph[nodeId].y,
    floorId: graph[nodeId].floorId,
    type: graph[nodeId].type
  }));

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const node = graph[path[i]];
    const neighbor = node.neighbors.find(n => n.nodeId === path[i + 1]);
    if (neighbor) totalDistance += neighbor.distance;
  }

  return {
    path: detailedPath,
    distance: totalDistance,
    found: true,
    nodeCount: path.length
  };
}

/**
 * Find nearest node to a given position
 */
function findNearestNode(graph, x, y, floorId = null) {
  let nearest = null;
  let minDist = Infinity;

  Object.values(graph).forEach(node => {
    if (floorId && node.floorId !== floorId) return;
    
    const dist = geoDistMeters(node.x, node.y, x, y);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  });

  return nearest;
}

/**
 * Find all nodes reachable from a given startId using BFS.
 * Returns a Set of reachable node IDs.
 */
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

/**
 * Find the nearest REACHABLE node to a target (x, y).
 * Only considers nodes that are reachable from startId.
 * This is the core fallback: if the destination node can't be reached,
 * we find the closest node to the destination that CAN be reached.
 */
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

  // If floor-restricted search found nothing, try all floors
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

/**
 * Generate turn-by-turn directions from a path
 */
function generateDirections(detailedPath) {
  if (detailedPath.length < 2) return [];

  const directions = [];
  const WALKING_SPEED = 1.2; // m/s average walking speed

  for (let i = 0; i < detailedPath.length - 1; i++) {
    const current = detailedPath[i];
    const next = detailedPath[i + 1];
    
    const distMeters = geoDistMeters(current.x, current.y, next.x, next.y);
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    let direction = 'Continue straight';
    
    if (i > 0) {
      const prev = detailedPath[i - 1];
      const prevDx = current.x - prev.x;
      const prevDy = current.y - prev.y;
      const prevAngle = Math.atan2(prevDy, prevDx) * (180 / Math.PI);
      
      let turnAngle = angle - prevAngle;
      if (turnAngle > 180) turnAngle -= 360;
      if (turnAngle < -180) turnAngle += 360;

      if (turnAngle > 30 && turnAngle <= 90) direction = 'Turn right';
      else if (turnAngle > 90) direction = 'Turn sharp right';
      else if (turnAngle < -30 && turnAngle >= -90) direction = 'Turn left';
      else if (turnAngle < -90) direction = 'Turn sharp left';
      else direction = 'Continue straight';
    }

    // Floor change
    if (current.floorId !== next.floorId) {
      if (next.type === 'elevator') direction = 'Take elevator';
      else if (next.type === 'stairs') direction = 'Take stairs';
      else direction = 'Change floor';
    }

    directions.push({
      step: i + 1,
      instruction: direction,
      from: { x: current.x, y: current.y, floorId: current.floorId },
      to: { x: next.x, y: next.y, floorId: next.floorId },
      distance: Math.round(distMeters),
      angle: Math.round(angle),
      eta: Math.round(distMeters / WALKING_SPEED)
    });
  }

  return directions;
}

module.exports = {
  buildGraph,
  autoConnectGraph,
  astar,
  dijkstra,
  findNearestNode,
  findNearestReachableNode,
  findReachableNodes,
  generateDirections,
  geoDistMeters,
  PriorityQueue
};
