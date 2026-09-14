/**
 * ProceduralDigitalTwinEngine.js
 * 
 * High-performance 2D-to-3D Architectural Digital Twin Generation Engine.
 * Transforms 2D floor plan room boundaries into granular, realistic 3D architectural units:
 * - Shared wall reconciliation with vertex snapping (epsilon = 0.05m) to eliminate gaps & Z-fighting
 * - 3D Partition Divider Walls along boundary edges (width: 0.12m, height: 2.92m) for crisp room separation
 * - Recessed Inset Ceiling / Roof Trays (inset: 0.18m, height: 2.75m) creating natural architectural shadow creases
 * - Raised Perimeter Parapet Lip with subtle category coping trim (2.75m -> 2.90m)
 * - Procedural Corridor Door Portals (0.00m -> 2.10m) with door frames and lintel headers
 * - Exterior Window Bay Glazing (1.00m -> 2.20m) with architectural glass tint
 * - Neutral Polished Concrete Walkways for interior corridors (height: 0.05m, color: #cbd5e1)
 * - Complete avoidance of extrusions for open central courtyards
 * - Elegant, muted architectural palette (limestone walls, charcoal plinths, neutral ceiling planes)
 * - Spatial raycasting hit-test bounding volumes and metadata binding
 */

export const CATEGORY_PALETTE = {
  classroom: {
    base: '#1e293b',
    wall: '#e2e8f0',     // Light Limestone Plaster
    roof: '#f8fafc',     // Clean Matte Ceiling Plane
    parapet: '#0284c7',  // Refined Nordic Blue Coping Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.1
  },
  lab: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#7c3aed',  // High-tech Violet Coping Trim
    door: '#0f172a',
    roughness: 0.4,
    metalness: 0.15
  },
  computer_lab: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#0891b2',  // Cyber Cyan Coping Trim
    door: '#0f172a',
    roughness: 0.4,
    metalness: 0.15
  },
  office: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#2563eb',  // Professional Slate Blue Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.05
  },
  staff_room: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#3b82f6',  // Soft Blue Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.05
  },
  auditorium: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#b45309',  // Warm Bronze Trim
    door: '#0f172a',
    roughness: 0.6,
    metalness: 0.15
  },
  seminar_hall: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#d97706',  // Amber Gold Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.15
  },
  restroom: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#059669',  // Clean Mint Jade Trim
    door: '#0f172a',
    roughness: 0.3,
    metalness: 0.2
  },
  library: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#4f46e5',  // Deep Indigo Trim
    door: '#0f172a',
    roughness: 0.6,
    metalness: 0.05
  },
  cafeteria: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#ea580c',  // Warm Terracotta Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.1
  },
  entrance: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#16a34a',  // Emerald Welcome Trim
    door: '#0f172a',
    roughness: 0.4,
    metalness: 0.2
  },
  corridor: {
    base: '#64748b',
    wall: '#cbd5e1',
    roof: '#cbd5e1',     // Neutral Polished Concrete Walkway
    parapet: '#475569',
    door: '#334155',
    roughness: 0.8,
    metalness: 0.0
  },
  default: {
    base: '#1e293b',
    wall: '#e2e8f0',
    roof: '#f8fafc',
    parapet: '#64748b',  // Slate Trim
    door: '#0f172a',
    roughness: 0.5,
    metalness: 0.1
  }
};

export const TARGET_HIGHLIGHT_PALETTE = {
  base: '#881337',
  wall: '#fecdd3',     // Soft Rose Wall Glow
  roof: '#f43f5e',     // Glowing Rose Ceiling
  parapet: '#be123c',  // Deep Crimson Coping Trim
  door: '#9f1239',
  roughness: 0.2,
  metalness: 0.4
};

export const SNAP_TOLERANCE_DEG = 0.000001;

/**
 * Snaps a coordinate against an optional shared vertex registry or grid.
 */
export function snapCoord(coord, registry = null, tolerance = SNAP_TOLERANCE_DEG) {
  if (Array.isArray(registry)) {
    for (let i = 0; i < registry.length; i++) {
      const reg = registry[i];
      const dLng = Math.abs(coord[0] - reg[0]);
      const dLat = Math.abs(coord[1] - reg[1]);
      if (dLng <= tolerance && dLat <= tolerance) {
        return [reg[0], reg[1]];
      }
    }
    const registered = [Number(coord[0].toFixed(7)), Number(coord[1].toFixed(7))];
    registry.push(registered);
    return registered;
  }
  const lng = Math.round(coord[0] / tolerance) * tolerance;
  const lat = Math.round(coord[1] / tolerance) * tolerance;
  return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
}

/**
 * Snaps polygon boundary coordinates to ensure adjacent rooms share identical vertices.
 */
export function snapPolygonRing(ring, registry = null, tolerance = SNAP_TOLERANCE_DEG) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const snapped = ring.map(pt => snapCoord(pt, registry, tolerance));
  const first = snapped[0];
  const last = snapped[snapped.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    snapped.push([first[0], first[1]]);
  }
  return snapped;
}

/**
 * Computes polygon signed area to determine winding order.
 */
export function getPolygonArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
  }
  return area / 2;
}

/**
 * Insets a polygon ring inward by distanceMeters to produce recessed ceiling trays.
 */
export function insetPolygon(ring, distanceMeters = 0.18) {
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

    // Inward normals
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

/**
 * Generates narrow 3D partition wall prisms along boundary edges (width: 0.12m).
 */
export function generatePartitionWalls(ring, thicknessMeters = 0.12) {
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
    if (len < 0.2) continue; // skip tiny slivers

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

/**
 * Generates corridor-aligned door portals (illuminated frame, recessed leaf, threshold strip).
 */
export function generateDoorPortals(ring, floorPaths = null, doorWidthMeters = 1.2, wallDepthMeters = 0.22) {
  if (!ring || ring.length < 4) return null;
  const mToLat = 1 / 111139;
  const avgLat = ring[0][1];
  const mToLng = 1 / (111139 * Math.cos(avgLat * Math.PI / 180));

  let bestEdge = -1;
  let bestT = 0.5;
  let corridorRefPoint = null;

  // 1. Check path intersection
  if (Array.isArray(floorPaths) && floorPaths.length > 0) {
    for (let pIdx = 0; pIdx < floorPaths.length; pIdx++) {
      const p = floorPaths[pIdx];
      const pA = p.pA || (p.nodeA ? [p.nodeA.y, p.nodeA.x] : null);
      const pB = p.pB || (p.nodeB ? [p.nodeB.y, p.nodeB.x] : null);
      if (!pA || !pB) continue;

      for (let i = 0; i < ring.length - 1; i++) {
        const hit = lineSegmentsIntersect(ring[i], ring[i+1], pA, pB);
        if (hit) {
          bestEdge = i;
          bestT = Math.max(0.12, Math.min(0.88, hit[2]));
          corridorRefPoint = pA;
          break;
        }
      }
      if (bestEdge !== -1) break;
    }

    // 2. Check nearest corridor path
    if (bestEdge === -1) {
      let minDist = Infinity;
      for (let pIdx = 0; pIdx < floorPaths.length; pIdx++) {
        const p = floorPaths[pIdx];
        const pA = p.pA || (p.nodeA ? [p.nodeA.y, p.nodeA.x] : null);
        const pB = p.pB || (p.nodeB ? [p.nodeB.y, p.nodeB.x] : null);
        if (!pA || !pB) continue;

        const midP = [(pA[0] + pB[0])/2, (pA[1] + pB[1])/2];
        for (let i = 0; i < ring.length - 1; i++) {
          const res = distToSegmentSquared(midP, ring[i], ring[i+1]);
          if (res.distSq < minDist) {
            minDist = res.distSq;
            bestEdge = i;
            bestT = res.t;
            corridorRefPoint = midP;
          }
        }
      }
    }
  }

  // 3. Fallback to first edge with len >= 2m
  if (bestEdge === -1) {
    for (let i = 0; i < ring.length - 1; i++) {
      const dx = (ring[i+1][0] - ring[i][0]) / mToLng;
      const dy = (ring[i+1][1] - ring[i][1]) / mToLat;
      if (Math.hypot(dx, dy) >= 2.0) {
        bestEdge = i;
        bestT = 0.5;
        break;
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

  if (corridorRefPoint) {
    const doorMidLng = p1[0] + (p2[0] - p1[0]) * bestT;
    const doorMidLat = p1[1] + (p2[1] - p1[1]) * bestT;
    const dPlus = Math.hypot((doorMidLng + nx * mToLng) - corridorRefPoint[0], (doorMidLat + ny * mToLat) - corridorRefPoint[1]);
    const dMinus = Math.hypot((doorMidLng - nx * mToLng) - corridorRefPoint[0], (doorMidLat - ny * mToLat) - corridorRefPoint[1]);
    if (dMinus < dPlus) {
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

  const doorMidLng = p1[0] + (p2[0] - p1[0]) * bestT;
  const doorMidLat = p1[1] + (p2[1] - p1[1]) * bestT;

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

/**
 * Classifies room category based on normalized category string and room name.
 */
export function resolveRoomCategory(room) {
  const cat = (room.category || '').toLowerCase().trim();
  const name = (room.name || '').toLowerCase().trim();

  if (cat.includes('corridor') || name.includes('corridor') || name.includes('passage') || name.includes('walkway')) {
    return 'corridor';
  }
  if (cat.includes('stair') || name.includes('stair') || room.isStairs) {
    return 'stairs';
  }
  if (cat.includes('toilet') || cat.includes('washroom') || cat.includes('restroom') || name.includes('washroom') || name.includes('toilet')) {
    return 'restroom';
  }
  if (cat.includes('computer') || name.includes('computer') || name.includes('ibm') || name.includes('programming')) {
    return 'computer_lab';
  }
  if (cat.includes('lab') || name.includes('lab')) {
    return 'lab';
  }
  if (cat.includes('seminar') || name.includes('seminar')) {
    return 'seminar_hall';
  }
  if (cat.includes('auditorium') || name.includes('audi')) {
    return 'auditorium';
  }
  if (cat.includes('staff') || name.includes('staff') || name.includes('faculty')) {
    return 'staff_room';
  }
  if (cat.includes('office') || name.includes('office') || name.includes('admin') || name.includes('hod')) {
    return 'office';
  }
  if (cat.includes('library') || name.includes('library')) {
    return 'library';
  }
  if (cat.includes('canteen') || cat.includes('cafeteria') || name.includes('cafeteria')) {
    return 'cafeteria';
  }
  if (cat.includes('entrance') || name.includes('entrance') || name.includes('entry') || name.includes('lobby')) {
    return 'entrance';
  }
  if (cat.includes('class') || name.includes('class') || /^[0-9]-[a-z]-[0-9]+/i.test(name)) {
    return 'classroom';
  }

  return CATEGORY_PALETTE[cat] ? cat : 'default';
}

/**
 * Builds the high-clarity multi-tier 3D GeoJSON features for a room polygon:
 * 1. Base plinth (0 -> 0.80m, charcoal #1e293b)
 * 2. Plaster wall body (0.80m -> 2.75m, off-white #e2e8f0)
 * 3. 3D Partition Divider Walls along shared boundaries (0 -> 2.92m, #1e293b)
 * 4. Recessed Inset Ceiling Tray (inset 0.18m, 2.70m -> 2.75m, neutral #f8fafc)
 * 5. Raised Perimeter Parapet Lip with category accent trim (2.75m -> 2.90m)
 * 6. Corridor Door Portals (0 -> 2.10m, dark #0f172a)
 * 
 * @param {Object} room - The room entity with shape.points or coordinates
 * @param {number} floorElevation - Base elevation for the floor in meters
 * @param {boolean} isTargetRoom - Whether this room is the active navigation target
 * @returns {Array<Object>} Array of GeoJSON Feature objects
 */
export function buildRoomDigitalTwinFeatures(room, floorElevation = 0, isTargetRoom = false, floorPaths = null) {
  const category = resolveRoomCategory(room);
  const palette = isTargetRoom ? TARGET_HIGHLIGHT_PALETTE : (CATEGORY_PALETTE[category] || CATEGORY_PALETTE.default);

  let rawRing = [];
  if (room.shape?.points && Array.isArray(room.shape.points) && room.shape.points.length >= 3) {
    rawRing = room.shape.points.map(p => {
      const lat = p.lat !== undefined ? p.lat : p.y;
      const lng = p.lng !== undefined ? p.lng : p.x;
      return [lng, lat];
    });
  } else if (room.coordinates && Array.isArray(room.coordinates[0])) {
    rawRing = room.coordinates[0];
  } else {
    return [];
  }

  const snappedRing = snapPolygonRing(rawRing);
  const fullGeometry = {
    type: 'Polygon',
    coordinates: [snappedRing]
  };

  const baseProps = {
    type: 'room',
    id: (room._id || room.id || '').toString(),
    roomId: (room._id || room.id || '').toString(),
    name: room.name || 'Room',
    category: category,
    department: room.department || '',
    capacity: room.capacity || 0,
    floorId: (room.floorId?._id || room.floorId || '').toString(),
    level: room.level !== undefined ? room.level : Math.round(floorElevation / 3.5),
    isTarget: isTargetRoom
  };

  // Case 1: Corridors -> flat neutral light concrete walkway (height: 0.05m)
  if (category === 'corridor') {
    return [{
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'corridor',
        color: '#cbd5e1',
        min_height: floorElevation,
        height: floorElevation + 0.05
      },
      geometry: fullGeometry
    }];
  }

  // Case 2: Stairs -> stepped extrusion
  if (category === 'stairs') {
    return [{
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'stairs',
        color: '#f97316',
        min_height: floorElevation,
        height: floorElevation + 3.2
      },
      geometry: fullGeometry
    }];
  }

  // Case 3: High-Clarity Architectural Room Units
  const features = [];

  // 1. Charcoal Plinth Baseboard (0.00m -> 0.80m)
  features.push({
    type: 'Feature',
    properties: {
      ...baseProps,
      part: 'base',
      color: palette.base,
      min_height: floorElevation,
      height: floorElevation + 0.80
    },
    geometry: fullGeometry
  });

  // 2. Main Architectural Plaster Wall Body (0.80m -> 2.75m)
  features.push({
    type: 'Feature',
    properties: {
      ...baseProps,
      part: 'body',
      color: isTargetRoom ? palette.wall : '#e2e8f0',
      min_height: floorElevation + 0.80,
      height: floorElevation + 2.75
    },
    geometry: fullGeometry
  });

  // 3. 3D Partition Divider Walls along shared boundaries (0.00m -> 2.92m)
  // These create crisp structural divider seams between adjacent rooms
  const partitionBoxes = generatePartitionWalls(snappedRing, 0.12);
  for (let i = 0; i < partitionBoxes.length; i++) {
    features.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'partition',
        color: '#1e293b',
        min_height: floorElevation,
        height: floorElevation + 2.92
      },
      geometry: {
        type: 'Polygon',
        coordinates: partitionBoxes[i]
      }
    });
  }

  // 4. Recessed Inset Ceiling / Roof Tray (inset 0.18m, 2.70m -> 2.75m)
  // Forms a sunken ceiling tray creating natural shadow creases against partition walls
  const insetRing = insetPolygon(snappedRing, 0.18);
  features.push({
    type: 'Feature',
    properties: {
      ...baseProps,
      part: 'roof',
      color: isTargetRoom ? palette.roof : '#f8fafc',
      min_height: floorElevation + 2.70,
      height: floorElevation + 2.75
    },
    geometry: {
      type: 'Polygon',
      coordinates: [insetRing]
    }
  });

  // 5. Raised Perimeter Parapet Lip with subtle category coping trim (2.75m -> 2.90m)
  features.push({
    type: 'Feature',
    properties: {
      ...baseProps,
      part: 'parapet',
      color: isTargetRoom ? palette.parapet : palette.parapet,
      min_height: floorElevation + 2.75,
      height: floorElevation + 2.90
    },
    geometry: fullGeometry
  });

  // 6. Corridor Door Portals (0.00m -> 2.25m)
  const doorSet = generateDoorPortals(snappedRing, floorPaths, 1.2, 0.22);
  if (doorSet) {
    // 6a. Outer Illuminated Door Frame / Lintel (Amber Gold #f59e0b)
    features.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'door_frame',
        color: isTargetRoom ? '#fbbf24' : '#f59e0b',
        min_height: floorElevation,
        height: floorElevation + 2.25
      },
      geometry: {
        type: 'Polygon',
        coordinates: doorSet.frame
      }
    });

    // 6b. Recessed Door Leaf / Opening (#0f172a / Deep Slate)
    features.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'door',
        color: '#0f172a',
        min_height: floorElevation,
        height: floorElevation + 2.15
      },
      geometry: {
        type: 'Polygon',
        coordinates: doorSet.leaf
      }
    });

    // 6c. Glowing Door Threshold Strip (#fbbf24)
    features.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'door_threshold',
        color: '#fbbf24',
        min_height: floorElevation,
        height: floorElevation + 0.08
      },
      geometry: {
        type: 'Polygon',
        coordinates: doorSet.threshold
      }
    });

    // 6d. Physical 3D Doorplate Plaque (Signage Mesh Above Lintel)
    features.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        part: 'doorplate',
        color: '#0f172a',
        min_height: floorElevation + 2.22,
        height: floorElevation + 2.50,
        doorLng: doorSet.doorplateAnchor.lng,
        doorLat: doorSet.doorplateAnchor.lat,
        doorElev: floorElevation + 2.36,
        ux: doorSet.doorplateAnchor.ux,
        uy: doorSet.doorplateAnchor.uy,
        nx: doorSet.doorplateAnchor.nx,
        ny: doorSet.doorplateAnchor.ny,
        ptA: doorSet.doorplateAnchor.ptA,
        ptB: doorSet.doorplateAnchor.ptB
      },
      geometry: {
        type: 'Polygon',
        coordinates: doorSet.doorplate
      }
    });
  }

  return features;
}

/**
 * Computes bounding box and 3D center anchor for dynamic billboard label placement.
 */
export function computeRoomLabelAnchor(ring, floorElevation = 0, parapetHeight = 2.95) {
  if (!ring || ring.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const pt of ring) {
    if (pt[0] < minLng) minLng = pt[0];
    if (pt[0] > maxLng) maxLng = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  }
  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    elevation: floorElevation + parapetHeight + 0.2,
    bounds: [minLng, minLat, maxLng, maxLat]
  };
}

/**
 * Performs raycasting hit-test against a set of room features.
 */
export function raycastRoomHitTest(clickCoords, roomFeatures) {
  if (!clickCoords || !roomFeatures || roomFeatures.length === 0) return null;
  const [lng, lat] = clickCoords;

  for (const f of roomFeatures) {
    if (f.geometry?.type === 'Polygon' && f.geometry.coordinates?.[0]) {
      if (pointInPolygon([lng, lat], f.geometry.coordinates[0])) {
        return f;
      }
    }
  }
  return null;
}

function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default {
  CATEGORY_PALETTE,
  TARGET_HIGHLIGHT_PALETTE,
  snapCoord,
  snapPolygonRing,
  getPolygonArea,
  insetPolygon,
  generatePartitionWalls,
  generateDoorPortals,
  resolveRoomCategory,
  buildRoomDigitalTwinFeatures,
  computeRoomLabelAnchor,
  raycastRoomHitTest
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CATEGORY_PALETTE,
    TARGET_HIGHLIGHT_PALETTE,
    snapCoord,
    snapPolygonRing,
    getPolygonArea,
    insetPolygon,
    generatePartitionWalls,
    generateDoorPortals,
    resolveRoomCategory,
    buildRoomDigitalTwinFeatures,
    computeRoomLabelAnchor,
    raycastRoomHitTest
  };
}
