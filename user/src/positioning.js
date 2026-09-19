// Indoor positioning fusion engine
// Combines QR, BLE, WiFi, and motion sensors for accurate indoor positioning

const STEP_LENGTH = 0.7; // Average step length in meters
const PIXEL_PER_METER = 20; // Scale factor
const EARTH_RADIUS = 6371000; // Earth radius in meters

/**
 * Calculates haversine distance in meters between two lat/lng coordinates.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculates initial bearing (forward azimuth) from point 1 to point 2 in degrees [0, 360).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Calculates shortest signed angular difference from current to target in degrees [-180, 180].
 */
export function shortestAngleDiff(current, target) {
  return (((target - current + 540) % 360) - 180);
}

/**
 * Projects a point (px, py) orthogonally onto segment (x1,y1)-(x2,y2), clamping to [0, 1].
 */
export function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1, t: 0 };

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: x1 + t * dx,
    y: y1 + t * dy,
    t: t
  };
}

/**
 * Advanced Snap-to-Route Map Matching Algorithm
 * - Evaluates multi-segment window along route polyline
 * - Prioritizes segments matching active floor level or currentStep neighborhood
 * - Calculates orthogonal projection, distance, along-track progress, and segment heading
 * - Applies progressive exponential attraction to prevent abrupt coordinate jumps
 */
export function snapPositionToRouteAdvanced(pos, path, currentStepIndex = 0, activeFloorId = null, maxSnapDistance = 22) {
  if (!pos || !path || path.length === 0) return { ...pos, isSnapped: false };

  // Filter or prioritize segments on the active floor if floorId is provided
  let bestCandidate = null;
  let minDistance = Infinity;

  // Search window: if path is long, check window around current step, but allow all on same floor
  const startIndex = Math.max(0, currentStepIndex - 2);
  const endIndex = Math.min(path.length - 1, currentStepIndex + 6);

  // First pass: try within active neighborhood [startIndex, endIndex]
  for (let i = 0; i < path.length - 1; i++) {
    const nodeA = path[i];
    const nodeB = path[i + 1];
    if (!nodeA || !nodeB) continue;

    // If floor filter active, prefer segments on same floor
    if (activeFloorId) {
      const aFloor = (nodeA.floorId || '').toString();
      const bFloor = (nodeB.floorId || '').toString();
      const targetFloor = activeFloorId.toString();
      if (aFloor && bFloor && aFloor !== targetFloor && bFloor !== targetFloor) {
        continue; // Skip segments on different floors
      }
    }

    const proj = getClosestPointOnSegment(pos.x, pos.y, nodeA.x, nodeA.y, nodeB.x, nodeB.y);
    const dist = haversineDistance(pos.x, pos.y, proj.x, proj.y);

    // Give slight priority score to segments close to currentStepIndex
    const stepPenalty = Math.abs(i - currentStepIndex) * 0.4;
    const effectiveScore = dist + stepPenalty;

    if (effectiveScore < minDistance) {
      minDistance = effectiveScore;
      const segBearing = calculateBearing(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
      bestCandidate = {
        snappedX: proj.x,
        snappedY: proj.y,
        t: proj.t,
        segmentIndex: i,
        realDistance: dist,
        bearing: segBearing,
        nodeA,
        nodeB
      };
    }
  }

  // Fallback pass: if activeFloorId was too restrictive and found no candidate within maxSnapDistance,
  // evaluate all segments along the route so user position is snapped properly (e.g. at route start)
  if (!bestCandidate || bestCandidate.realDistance > maxSnapDistance) {
    for (let i = 0; i < path.length - 1; i++) {
      const nodeA = path[i];
      const nodeB = path[i + 1];
      if (!nodeA || !nodeB) continue;

      const proj = getClosestPointOnSegment(pos.x, pos.y, nodeA.x, nodeA.y, nodeB.x, nodeB.y);
      const dist = haversineDistance(pos.x, pos.y, proj.x, proj.y);
      const stepPenalty = Math.abs(i - currentStepIndex) * 0.4;
      const effectiveScore = dist + stepPenalty;

      if (effectiveScore < minDistance) {
        minDistance = effectiveScore;
        const segBearing = calculateBearing(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
        bestCandidate = {
          snappedX: proj.x,
          snappedY: proj.y,
          t: proj.t,
          segmentIndex: i,
          realDistance: dist,
          bearing: segBearing,
          nodeA,
          nodeB
        };
      }
    }
  }

  if (bestCandidate && bestCandidate.realDistance <= maxSnapDistance) {
    // Progressive attraction: the closer to the path, the stronger the snap
    // At dist < 6m, snap 95% to line; at dist = 20m, blend gently (50%)
    const snapWeight = Math.max(0.65, 1.0 - (bestCandidate.realDistance / (maxSnapDistance * 1.5)));
    const blendedX = pos.x * (1 - snapWeight) + bestCandidate.snappedX * snapWeight;
    const blendedY = pos.y * (1 - snapWeight) + bestCandidate.snappedY * snapWeight;

    return {
      ...pos,
      x: blendedX,
      y: blendedY,
      snappedHeading: bestCandidate.bearing,
      isSnapped: true,
      distToPath: bestCandidate.realDistance,
      segmentIndex: bestCandidate.segmentIndex,
      segmentProgress: bestCandidate.t
    };
  }

  return { ...pos, isSnapped: false, distToPath: minDistance };
}

/**
 * Checks whether a point (lat, lng) is inside a GeoJSON polygon ring coords [[lng, lat], ...]
 */
export function isPointInPolygon(lat, lng, coords) {
  if (!coords || coords.length < 3) return false;
  let inside = false;
  const n = coords.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const xi = coords[i][0]; // lng
    const yi = coords[i][1]; // lat
    const xj = coords[j][0];
    const yj = coords[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

/**
 * Clamps a point (lat, lng) to stay within or on the boundary of a GeoJSON polygon ring.
 * Useful for keeping indoor positioning strictly inside building walls.
 */
export function clampPointToPolygon(lat, lng, coords) {
  if (!coords || coords.length < 3) return { lat, lng };

  // Check if already inside
  if (isPointInPolygon(lat, lng, coords)) return { lat, lng };

  // Otherwise, find closest point on polygon perimeter
  let closest = { lat, lng };
  let minD = Infinity;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    // coords are [lng, lat]
    const proj = getClosestPointOnSegment(lat, lng, p1[1], p1[0], p2[1], p2[0]);
    const d = haversineDistance(lat, lng, proj.x, proj.y);
    if (d < minD) {
      minD = d;
      closest = { lat: proj.x, lng: proj.y };
    }
  }

  return closest;
}

export class PositionEngine {
  constructor() {
    this.position = {
      x: 0,
      y: 0,
      z: null,
      floorId: null,
      floor: null, // backward compatibility with code expecting pos.floor
      floorLevel: 0,
      hasValidFloor: false,
      floorSource: 'unknown', // 'qr' | 'staircase' | 'ambient' | 'calibrated' | 'unknown'
      floorCalibrated: false,
      nodeId: null,
      movementState: 'STATIONARY',
      verticalProgress: 0.0,
      verticalTrackingActive: false,
      verticalDirection: null,
      activeConnectorId: null,
      hasValidElevation: false,
      elevationSource: 'unknown' // 'staircase_connector' | 'node' | 'floor' | 'barometer' | 'unknown'
    };
    this.heading = 0; // degrees
    this.smoothHeadingVal = 0;
    this.isCalibrated = false;
    this.lastQRTime = 0;
    this.stepCount = 0;
    this.listeners = [];
    this.bleBeacons = [];
    this.driftCorrection = { x: 0, y: 0 };
    // Vertical tracking state
    this.verticalTrackingActive = false;
  }

  // Subscribe to position updates
  onPositionUpdate(callback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  notify() {
    this.listeners.forEach(cb => cb({
      ...this.position,
      heading: this.heading,
      verticalTrackingActive: this.verticalTrackingActive
    }));
  }

  // Safe non-destructive update adhering to Invariant 6:
  // An unknown, default, or uncalibrated value must never overwrite an already-valid X/Y/Z/floor state.
  updatePosition(patch = {}) {
    if (!patch || typeof patch !== 'object') return;

    if (patch.x !== undefined && patch.x !== null && !isNaN(patch.x)) this.position.x = Number(patch.x);
    if (patch.y !== undefined && patch.y !== null && !isNaN(patch.y)) this.position.y = Number(patch.y);

    // Elevation update guard
    if (patch.hasValidElevation && patch.z !== undefined && patch.z !== null && !isNaN(patch.z)) {
      this.position.z = Number(patch.z);
      this.position.hasValidElevation = true;
      this.position.elevationSource = patch.elevationSource || 'calibrated';
    } else if (patch.z !== undefined && patch.z !== null && !isNaN(patch.z) && !this.position.hasValidElevation) {
      this.position.z = Number(patch.z);
      this.position.hasValidElevation = !!patch.hasValidElevation;
      this.position.elevationSource = patch.elevationSource || 'unknown';
    }

    // Floor update guard
    if (patch.hasValidFloor) {
      if (patch.floorId) {
        this.position.floorId = patch.floorId.toString();
        this.position.floor = patch.floorId.toString();
      }
      if (patch.floorLevel !== undefined && patch.floorLevel !== null) {
        this.position.floorLevel = Number(patch.floorLevel);
      }
      this.position.hasValidFloor = true;
      this.position.floorSource = patch.floorSource || 'calibrated';
      this.position.floorCalibrated = true;
    } else if (!this.position.hasValidFloor && patch.floorId) {
      this.position.floorId = patch.floorId.toString();
      this.position.floor = patch.floorId.toString();
      if (patch.floorLevel !== undefined && patch.floorLevel !== null) {
        this.position.floorLevel = Number(patch.floorLevel);
      }
    }

    if (patch.heading !== undefined && patch.heading !== null) {
      this.updateHeading(patch.heading);
    }
    if (patch.movementState !== undefined) {
      this.position.movementState = patch.movementState;
    }
    if (patch.verticalProgress !== undefined) {
      this.position.verticalProgress = patch.verticalProgress;
    }
    if (patch.verticalTrackingActive !== undefined) {
      this.position.verticalTrackingActive = patch.verticalTrackingActive;
      this.verticalTrackingActive = patch.verticalTrackingActive;
    }
    if (patch.verticalDirection !== undefined) {
      this.position.verticalDirection = patch.verticalDirection;
    }

    this.notify();
  }

  // QR Code positioning - highest accuracy, acts as anchor
  setPositionFromQR(x, y, floorId, floorLevel = 0, z = null) {
    let validZ = null;
    let hasValidElev = false;
    let source = 'unknown';

    if (z !== undefined && z !== null && !isNaN(z)) {
      validZ = Number(z);
      hasValidElev = true;
      source = 'node';
    } else if (floorLevel !== null && floorLevel !== undefined) {
      validZ = Number(floorLevel) * 3.5 + 0.54;
      hasValidElev = true;
      source = 'floor';
    }

    const fid = floorId ? floorId.toString() : null;
    const fLvl = floorLevel !== null && floorLevel !== undefined ? Number(floorLevel) : 0;

    this.position = {
      ...this.position,
      x,
      y,
      z: validZ,
      floorId: fid,
      floor: fid,
      floorLevel: fLvl,
      hasValidFloor: true,
      floorSource: 'qr',
      floorCalibrated: true,
      hasValidElevation: hasValidElev,
      elevationSource: source,
      verticalTrackingActive: false,
      verticalProgress: 0.0
    };
    this.verticalTrackingActive = false;
    this.isCalibrated = true;
    this.lastQRTime = Date.now();
    this.driftCorrection = { x: 0, y: 0 };
    this.stepCount = 0;
    this.notify();
    return this.position;
  }

  // Motion sensor tracking (dead reckoning with GPS scale conversion)
  processStep(heading) {
    if (!this.isCalibrated) return;

    this.updateHeading(heading);
    this.stepCount++;

    const radians = (this.heading * Math.PI) / 180;

    // Convert step size (0.7m) to GPS degrees
    const metersPerLatDegree = 111320;
    const currentLat = this.position.x || 18.4665;
    const metersPerLngDegree = 111320 * Math.cos((currentLat * Math.PI) / 180);

    const dLat = (STEP_LENGTH * Math.cos(radians)) / metersPerLatDegree;
    const dLng = (STEP_LENGTH * Math.sin(radians)) / metersPerLngDegree;

    // Apply displacement with drift correction
    this.position.x += dLat + this.driftCorrection.x;
    this.position.y += dLng + this.driftCorrection.y;

    // Reset drift correction after applying
    this.driftCorrection = { x: 0, y: 0 };

    this.notify();
  }

  // Fused GPS Update - blends GPS coordinate with indoor/outdoor awareness
  // GUARANTEE: Never overwrites floorLevel, floorId, z, or vertical tracking state!
  processGPSUpdate(lat, lng, accuracy = 15) {
    if (!this.isCalibrated) {
      this.position.x = lat;
      this.position.y = lng;
      this.isCalibrated = true;
      this.notify();
      return;
    }

    const isIndoors = (this.position.hasValidFloor && this.position.floorLevel > 0) || !!this.position.floorId;

    // When indoors, GPS accuracy is poor and multi-path reflections cause big drift outside walls
    let weight = 0.15;
    if (isIndoors) {
      if (accuracy > 12) {
        weight = 0.0; // Ignore GPS completely indoors if accuracy > 12m
      } else {
        weight = 0.04; // Very light anchor only
      }
    } else {
      if (accuracy > 25) {
        weight = 0.0; // Ignore inaccurate outdoors
      } else if (accuracy > 12) {
        weight = 0.08;
      } else if (accuracy <= 5) {
        weight = 0.35; // Strong outdoor lock
      }
    }

    if (weight > 0) {
      this.position.x = this.position.x * (1 - weight) + lat * weight;
      this.position.y = this.position.y * (1 - weight) + lng * weight;
    }
    this.notify();
  }

  // Update heading from compass with shortest-angle exponential smoothing
  updateHeading(heading) {
    if (heading === undefined || heading === null || isNaN(heading)) return;
    const diff = shortestAngleDiff(this.smoothHeadingVal, heading);
    this.smoothHeadingVal = ((this.smoothHeadingVal + diff * 0.35) % 360 + 360) % 360;
    this.heading = Math.round(this.smoothHeadingVal);
  }

  // Update vertical position (elevation) — called by VerticalTracker during staircase progress
  updateVerticalPosition(z, floorId = null, floorLevelOrOptions = null, verticalProgress = 0.0, elevationSource = 'staircase') {
    let floorLevel = null;
    let progress = verticalProgress;
    let source = elevationSource;
    let movementState = null;
    let isTrackingActive = true;

    if (floorLevelOrOptions && typeof floorLevelOrOptions === 'object') {
      if (floorLevelOrOptions.floorLevel !== undefined) floorLevel = floorLevelOrOptions.floorLevel;
      if (floorLevelOrOptions.verticalProgress !== undefined) progress = floorLevelOrOptions.verticalProgress;
      if (floorLevelOrOptions.elevationSource !== undefined) source = floorLevelOrOptions.elevationSource;
      if (floorLevelOrOptions.movementState !== undefined) movementState = floorLevelOrOptions.movementState;
      if (floorLevelOrOptions.verticalTrackingActive !== undefined) isTrackingActive = floorLevelOrOptions.verticalTrackingActive;
    } else if (floorLevelOrOptions !== null && floorLevelOrOptions !== undefined) {
      floorLevel = floorLevelOrOptions;
    }

    if (z !== undefined && z !== null && !isNaN(z)) {
      this.position.z = z;
      this.position.hasValidElevation = true;
      this.position.elevationSource = source;
    }
    if (floorId !== undefined && floorId !== null) {
      this.position.floorId = floorId.toString();
      this.position.floor = floorId.toString();
      this.position.hasValidFloor = true;
      this.position.floorSource = 'staircase';
    }
    if (floorLevel !== undefined && floorLevel !== null) {
      this.position.floorLevel = Number(floorLevel);
      this.position.hasValidFloor = true;
    }
    if (movementState !== null) {
      this.position.movementState = movementState;
    }
    this.position.verticalProgress = Math.max(0.0, Math.min(1.0, progress || 0.0));
    this.position.verticalTrackingActive = isTrackingActive;
    this.verticalTrackingActive = isTrackingActive;
    this.notify();
  }

  // Set floor explicitly (e.g., after floor transition completes or floor selection changes)
  setFloor(floorId, floorLevel = null, elevation = null, elevationSource = 'floor') {
    if (floorId !== undefined && floorId !== null) {
      this.position.floorId = floorId.toString();
      this.position.floor = floorId.toString();
      this.position.hasValidFloor = true;
      this.position.floorSource = elevationSource || 'floor';
    }
    if (floorLevel !== undefined && floorLevel !== null) {
      this.position.floorLevel = Number(floorLevel);
      this.position.hasValidFloor = true;
    }
    if (elevation !== undefined && elevation !== null && !isNaN(elevation)) {
      this.position.z = Number(elevation);
      this.position.hasValidElevation = true;
      this.position.elevationSource = elevationSource;
    } else if (floorLevel !== undefined && floorLevel !== null && Number(floorLevel) > 0) {
      this.position.z = Number(floorLevel) * 3.5 + 0.54;
      this.position.hasValidElevation = true;
      this.position.elevationSource = 'floor_fallback';
    } else {
      this.position.z = null;
      this.position.hasValidElevation = false;
      this.position.elevationSource = 'unknown';
    }
    this.position.verticalTrackingActive = false;
    this.position.verticalProgress = 0.0;
    this.verticalTrackingActive = false;
    this.notify();
  }

  // WiFi Fingerprinting positioning — applies estimated position as drift correction
  // confidence: 0.0–1.0 (from backend k-NN match quality)
  processWiFiPosition(lat, lng, confidence = 0.5, floorId = null) {
    if (!this.isCalibrated) return;

    // Map confidence (0–1) to blend weight (0.05–0.35)
    // Low confidence (0.3) → barely moves position
    // High confidence (0.9) → meaningful correction
    const weight = 0.05 + (confidence * 0.30);

    this.position.x = this.position.x * (1 - weight) + lat * weight;
    this.position.y = this.position.y * (1 - weight) + lng * weight;

    // If backend identified a floor from WiFi fingerprint, update it
    if (floorId && !this.verticalTrackingActive) {
      this.position.floor = floorId;
    }

    this.notify();
  }

  // BLE Beacon positioning - correction & accuracy improvement
  setBLEBeacons(beacons) {
    this.bleBeacons = beacons;
  }

  processBLESignals(signals) {
    // signals: [{ beaconId, rssi }]
    if (!this.isCalibrated || this.bleBeacons.length < 3) return;

    // Calculate distances from RSSI
    const beaconsWithDist = signals
      .map(sig => {
        const beacon = this.bleBeacons.find(b => b.beaconId === sig.beaconId);
        if (!beacon) return null;
        const distance = this.rssiToDistance(sig.rssi, beacon.calibration || {});
        return { ...beacon, distance };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // Use 3 closest beacons

    if (beaconsWithDist.length >= 3) {
      const estimated = this.trilaterate(beaconsWithDist);
      if (estimated) {
        // Apply as drift correction (weighted blend)
        const weight = 0.3; // BLE correction weight
        this.driftCorrection = {
          x: (estimated.x - this.position.x) * weight,
          y: (estimated.y - this.position.y) * weight
        };
      }
    }
  }

  rssiToDistance(rssi, calibration = {}) {
    const txPower = calibration.rssiAt1m || -59;
    const n = calibration.pathLossExponent || 2.0;
    return Math.pow(10, (txPower - rssi) / (10 * n));
  }

  trilaterate(beacons) {
    if (beacons.length < 3) return null;

    const [b1, b2, b3] = beacons;
    const x1 = b1.position.x, y1 = b1.position.y, r1 = b1.distance * PIXEL_PER_METER;
    const x2 = b2.position.x, y2 = b2.position.y, r2 = b2.distance * PIXEL_PER_METER;
    const x3 = b3.position.x, y3 = b3.position.y, r3 = b3.distance * PIXEL_PER_METER;

    const A = 2 * (x2 - x1);
    const B = 2 * (y2 - y1);
    const C = r1 * r1 - r2 * r2 - x1 * x1 + x2 * x2 - y1 * y1 + y2 * y2;
    const D = 2 * (x3 - x2);
    const E = 2 * (y3 - y2);
    const F = r2 * r2 - r3 * r3 - x2 * x2 + x3 * x3 - y2 * y2 + y3 * y3;

    const denom = A * E - B * D;
    if (Math.abs(denom) < 0.001) return null;

    return {
      x: (C * E - F * B) / denom,
      y: (A * F - C * D) / denom
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BLOCK DETECTION — Point-in-Polygon using GeoJSON campus data
  //  Returns the name/id of the building/block the user is currently inside.
  //  Called from NavigationScreen to show "You are in Block X, Floor Y" label.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Determines which block/building the user is currently inside.
   * Uses a ray-casting point-in-polygon algorithm against GeoJSON block features.
   *
   * @param {object} geoJSONData - GeoJSON FeatureCollection from campus data
   * @returns {{ blockName: string, blockId: string } | null}
   */
  getCurrentBlock(geoJSONData) {
    if (!geoJSONData?.features || !this.isCalibrated) return null;

    const lat = this.position.x;
    const lng = this.position.y;

    // Filter to polygon features that are blocks or buildings
    const blockFeatures = geoJSONData.features.filter(f =>
      f.geometry?.type === 'Polygon' &&
      (f.properties?.type === 'block' || f.properties?.type === 'building')
    );

    for (const feature of blockFeatures) {
      const coords = feature.geometry?.coordinates?.[0]; // outer ring
      if (!coords || coords.length < 3) continue;

      if (this._pointInPolygon(lat, lng, coords)) {
        return {
          blockName: feature.properties?.name || feature.properties?.blockName || 'Unknown Block',
          blockId: feature.properties?.id || feature.properties?._id || null,
        };
      }
    }
    return null; // User is outside all known blocks (outdoor)
  }

  /**
   * Ray-casting algorithm: determines if point (lat, lng) is inside a polygon.
   * Polygon coords are in GeoJSON format: [[lng, lat], [lng, lat], ...]
   * @param {number} lat
   * @param {number} lng
   * @param {Array} coords - array of [lng, lat] pairs
   * @returns {boolean}
   */
  _pointInPolygon(lat, lng, coords) {
    let inside = false;
    const n = coords.length;
    let j = n - 1;

    for (let i = 0; i < n; i++) {
      // GeoJSON: coords[i] = [longitude, latitude]
      const xi = coords[i][0]; // lng
      const yi = coords[i][1]; // lat
      const xj = coords[j][0];
      const yj = coords[j][1];

      // Ray cast from point horizontally
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
      j = i;
    }
    return inside;
  }

  // Get time since last QR calibration
  getTimeSinceCalibration() {
    return Date.now() - this.lastQRTime;
  }

  // Get accuracy estimate
  getAccuracyEstimate() {
    if (!this.isCalibrated) return 'unknown';
    const timeSinceQR = this.getTimeSinceCalibration();
    if (timeSinceQR < 10000) return 'high';
    if (timeSinceQR < 60000 && this.stepCount < 50) return 'medium';
    return 'low';
  }

  reset() {
    this.position = {
      x: 0,
      y: 0,
      z: null,
      floorId: null,
      floor: null,
      floorLevel: 0,
      hasValidFloor: false,
      floorSource: 'unknown',
      floorCalibrated: false,
      nodeId: null,
      movementState: 'STATIONARY',
      verticalProgress: 0.0,
      verticalTrackingActive: false,
      verticalDirection: null,
      activeConnectorId: null,
      hasValidElevation: false,
      elevationSource: 'unknown'
    };
    this.heading = 0;
    this.isCalibrated = false;
    this.stepCount = 0;
    this.driftCorrection = { x: 0, y: 0 };
    this.verticalTrackingActive = false;
    this.notify();
  }
}

// Step detection from accelerometer data
export class StepDetector {
  constructor(onStep) {
    this.onStep = onStep;
    this.lastMagnitude = 0;
    this.threshold = 1.2;
    this.lastStepTime = 0;
    this.minStepInterval = 300; // ms
    this.samples = [];
    this.windowSize = 10;
  }

  processAccelerometer(x, y, z) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    this.samples.push(magnitude);
    if (this.samples.length > this.windowSize) this.samples.shift();

    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const now = Date.now();

    // Peak detection
    if (
      magnitude > avg + this.threshold &&
      this.lastMagnitude <= avg + this.threshold &&
      now - this.lastStepTime > this.minStepInterval
    ) {
      this.lastStepTime = now;
      this.onStep();
    }

    this.lastMagnitude = magnitude;
  }
}

const defaultPosEngine = new PositionEngine();
export default defaultPosEngine;
