/**
 * NavX Pathfinding Engine
 * Implements Dijkstra and A* algorithms for indoor navigation
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
      floorId: node.floorId.toString(),
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
 * Heuristic function for A* (Euclidean distance)
 */
function heuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  return Math.sqrt(dx * dx + dy * dy);
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
    
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  });

  return nearest;
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
    
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const distDegrees = Math.sqrt(dx * dx + dy * dy);
    const distMeters = distDegrees * 111320; // Approx convert degrees to meters
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
  astar,
  dijkstra,
  findNearestNode,
  generateDirections,
  PriorityQueue
};
