/**
 * StaircaseExtractor
 * Extracts normalized staircase connector metadata from a route path.
 * 
 * Supports backend-provided connectors as primary source, and provides
 * robust client-side extraction with authoritative elevation resolution as fallback.
 */
export default class StaircaseExtractor {
  /**
   * Resolves elevation for a node following authoritative hierarchy:
   * 1. Explicit valid node elevation (hasValidElevation === true && z !== null)
   * 2. Authoritative floor geometry/elevation from floor metadata
   * 3. Configured floor-height fallback (level * 3.5 + 0.54) if indoor floor is defined
   * 4. Unknown/null: { z: null, hasValidElevation: false, elevationSource: 'unknown' }
   */
  static resolveNodeElevation(node, floorLevelMap = new Map(), floors = []) {
    if (!node) return { z: null, hasValidElevation: false, elevationSource: 'unknown' };

    // 1. Explicitly valid node elevation
    if (node.hasValidElevation === true && node.z !== null && typeof node.z === 'number') {
      return { z: node.z, hasValidElevation: true, elevationSource: node.elevationSource || 'node' };
    }
    // Legacy explicit non-zero z
    if (typeof node.z === 'number' && Math.abs(node.z) > 0.001) {
      return { z: node.z, hasValidElevation: true, elevationSource: 'node' };
    }

    // 2. Authoritative floor geometry / metadata
    const floorIdStr = (node.floorId?._id || node.floorId || '').toString();
    if (floorIdStr && floors && floors.length > 0) {
      const fObj = floors.find(f => (f._id || f).toString() === floorIdStr);
      if (fObj && fObj.elevation !== undefined && fObj.elevation !== null && !isNaN(fObj.elevation)) {
        return { z: Number(fObj.elevation), hasValidElevation: true, elevationSource: 'floor' };
      }
    }

    // 3. Configured floor-height fallback (only if indoor upper floor is defined)
    const level = node.floorLevel !== undefined && node.floorLevel !== null
      ? Number(node.floorLevel)
      : (floorLevelMap.has(floorIdStr) ? floorLevelMap.get(floorIdStr) : undefined);

    if (level !== undefined && level !== null && level > 0 && floorIdStr) {
      return { z: level * 3.5 + 0.54, hasValidElevation: true, elevationSource: 'floor_fallback' };
    }

    // 4. Unknown / null - do NOT silently convert to 0.54
    return { z: null, hasValidElevation: false, elevationSource: 'unknown' };
  }

  /**
   * Normalizes an existing connector (e.g. from backend) to guaranteed schema.
   */
  static normalizeConnector(c, routePath = []) {
    const isAscending = c.direction === 'UP' || c.isAscending === true ||
      (c.upperElevation !== undefined && c.endElevation >= c.startElevation);
    const lowerElev = c.lowerElevation !== undefined ? c.lowerElevation : Math.min(c.startElevation ?? 0.54, c.endElevation ?? 4.04);
    const upperElev = c.upperElevation !== undefined ? c.upperElevation : Math.max(c.startElevation ?? 0.54, c.endElevation ?? 4.04);

    return {
      connectorId: c.connectorId || `stair_${c.startNodeId || 'start'}_${c.endNodeId || 'end'}_${c.startNodeIndex || 0}`,
      startNodeIndex: c.startNodeIndex !== undefined ? c.startNodeIndex : (c.pathIndex || 0),
      endNodeIndex: c.endNodeIndex !== undefined ? c.endNodeIndex : ((c.pathIndex || 0) + 1),
      startNodeId: c.startNodeId,
      endNodeId: c.endNodeId,
      startNode: c.startNode || (routePath[c.startNodeIndex] || null),
      endNode: c.endNode || (routePath[c.endNodeIndex] || null),
      intermediateNodes: c.intermediateNodes || (routePath.length > 0 && c.startNodeIndex !== undefined && c.endNodeIndex !== undefined
        ? routePath.slice(c.startNodeIndex, c.endNodeIndex + 1)
        : []),

      // Physical geometry
      lowerFloorId: (c.lowerFloorId || (isAscending ? c.startFloorId : c.endFloorId) || '').toString(),
      upperFloorId: (c.upperFloorId || (isAscending ? c.endFloorId : c.startFloorId) || '').toString(),
      lowerFloorLevel: c.lowerFloorLevel !== undefined ? c.lowerFloorLevel : Math.min(c.startFloorLevel ?? 0, c.endFloorLevel ?? 1),
      upperFloorLevel: c.upperFloorLevel !== undefined ? c.upperFloorLevel : Math.max(c.startFloorLevel ?? 0, c.endFloorLevel ?? 1),
      lowerElevation: lowerElev,
      upperElevation: upperElev,
      totalSteps: (c.totalSteps && c.totalSteps > 0) ? c.totalSteps : Math.max(8, Math.round(Math.abs(upperElev - lowerElev) / 0.175)),

      // Route-relative travel direction
      direction: isAscending ? 'UP' : 'DOWN',
      isAscending,
      startElevation: c.startElevation !== undefined ? c.startElevation : (isAscending ? lowerElev : upperElev),
      endElevation: c.endElevation !== undefined ? c.endElevation : (isAscending ? upperElev : lowerElev),
      startFloorId: (c.startFloorId || '').toString(),
      endFloorId: (c.endFloorId || '').toString(),
      startFloorLevel: c.startFloorLevel !== undefined ? c.startFloorLevel : (isAscending ? c.lowerFloorLevel : c.upperFloorLevel),
      endFloorLevel: c.endFloorLevel !== undefined ? c.endFloorLevel : (isAscending ? c.upperFloorLevel : c.lowerFloorLevel),
    };
  }

  /**
   * Extracts staircase connector metadata from a route path.
   * 
   * @param {Array} routePath - Array of path nodes
   * @param {Array} floors - Array of floor objects
   * @param {Array} staircaseMetadata - Optional array of backend staircase connectors
   * @returns {Array} Array of normalized VerticalConnector objects
   */
  static extract(routePath, floors = [], staircaseMetadata = []) {
    if (!routePath || routePath.length === 0) return [];

    // If backend provided authoritative staircase connectors, normalize and use them directly
    if (Array.isArray(staircaseMetadata) && staircaseMetadata.length > 0) {
      const normalized = staircaseMetadata.map(c => StaircaseExtractor.normalizeConnector(c, routePath));
      if (normalized.length > 0) {
        return normalized;
      }
    }

    const floorLevelMap = new Map();
    floors.forEach(f => {
      const fid = (f._id || f).toString();
      floorLevelMap.set(fid, f.level);
    });

    const getFloorLevel = (node) => {
      if (node.floorLevel !== null && node.floorLevel !== undefined) return Number(node.floorLevel);
      const fid = (node.floorId?._id || node.floorId || '').toString();
      if (floorLevelMap.has(fid)) return floorLevelMap.get(fid);
      return null;
    };

    const connectors = [];
    let inStaircase = false;
    let startIndex = -1;

    for (let i = 0; i < routePath.length - 1; i++) {
      const current = routePath[i];
      const next = routePath[i + 1];

      const isStairs = current.segmentType === 'stairs' || next.segmentType === 'stairs' ||
                       current.type === 'stairs' || next.type === 'stairs';
      const currLvl = getFloorLevel(current);
      const nextLvl = getFloorLevel(next);
      const isFloorChange = currLvl !== null && nextLvl !== null && currLvl !== nextLvl;

      if (!inStaircase && (isStairs || isFloorChange)) {
        inStaircase = true;
        startIndex = i;
      } else if (inStaircase) {
        if (!isStairs && !isFloorChange && current.floorId !== routePath[startIndex].floorId) {
          const endIndex = i;
          const connector = StaircaseExtractor._buildClientConnector(routePath, startIndex, endIndex, floorLevelMap, floors);
          if (connector) connectors.push(connector);
          inStaircase = false;
          startIndex = -1;
        }
      }
    }

    if (inStaircase) {
      const endIndex = routePath.length - 1;
      const connector = StaircaseExtractor._buildClientConnector(routePath, startIndex, endIndex, floorLevelMap, floors);
      if (connector) connectors.push(connector);
    }

    return connectors;
  }

  static _buildClientConnector(routePath, startIndex, endIndex, floorLevelMap, floors) {
    const startNode = routePath[startIndex];
    const endNode = routePath[endIndex];
    if (!startNode || !endNode) return null;

    const startFloorId = (startNode.floorId?._id || startNode.floorId || '').toString();
    const endFloorId = (endNode.floorId?._id || endNode.floorId || '').toString();

    const startLevel = startNode.floorLevel !== null && startNode.floorLevel !== undefined
      ? Number(startNode.floorLevel)
      : (floorLevelMap.get(startFloorId) ?? 0);
    const endLevel = endNode.floorLevel !== null && endNode.floorLevel !== undefined
      ? Number(endNode.floorLevel)
      : (floorLevelMap.get(endFloorId) ?? 0);

    const startElevObj = StaircaseExtractor.resolveNodeElevation(startNode, floorLevelMap, floors);
    const endElevObj = StaircaseExtractor.resolveNodeElevation(endNode, floorLevelMap, floors);

    let startElev = startElevObj.z !== null ? startElevObj.z : (startLevel * 3.5 + 0.54);
    let endElev = endElevObj.z !== null ? endElevObj.z : (endLevel * 3.5 + 0.54);

    if (Math.abs(endElev - startElev) < 0.1 && startLevel !== endLevel) {
      startElev = startLevel * 3.5 + 0.54;
      endElev = endLevel * 3.5 + 0.54;
    }

    const isAscending = endElev > startElev || (Math.abs(endElev - startElev) < 0.01 && endLevel >= startLevel);
    const lowerElevation = Math.min(startElev, endElev);
    const upperElevation = Math.max(startElev, endElev);
    const elevDiff = Math.abs(upperElevation - lowerElevation);
    const totalSteps = Math.max(8, Math.round(elevDiff / 0.175));

    return {
      connectorId: `stair_${startNode.nodeId || startIndex}_${endNode.nodeId || endIndex}_${startIndex}`,
      startNodeIndex: startIndex,
      endNodeIndex: endIndex,
      startNodeId: startNode.nodeId,
      endNodeId: endNode.nodeId,
      startNode,
      endNode,
      intermediateNodes: routePath.slice(startIndex, endIndex + 1),

      // Physical geometry
      lowerFloorId: isAscending ? startFloorId : endFloorId,
      upperFloorId: isAscending ? endFloorId : startFloorId,
      lowerFloorLevel: isAscending ? startLevel : endLevel,
      upperFloorLevel: isAscending ? endLevel : startLevel,
      lowerElevation,
      upperElevation,
      totalSteps,

      // Route-relative direction
      direction: isAscending ? 'UP' : 'DOWN',
      isAscending,
      startElevation: startElev,
      endElevation: endElev,
      startFloorId,
      endFloorId,
      startFloorLevel: startLevel,
      endFloorLevel: endLevel,
    };
  }
}
