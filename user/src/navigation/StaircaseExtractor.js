export default class StaircaseExtractor {
  /**
   * Extracts staircase connector metadata from a route path.
   * 
   * @param {Array} routePath - Array of path nodes
   * @param {Array} floors - Array of floor objects
   * @param {Array} staircaseMetadata - Optional array of staircase metadata
   * @returns {Array} Array of VerticalConnector objects
   */
  static extract(routePath, floors = [], staircaseMetadata = []) {
    if (!routePath || routePath.length === 0) return [];

    const floorLevelMap = new Map();
    floors.forEach(f => floorLevelMap.set(f._id, f.level));

    const connectors = [];
    let inStaircase = false;
    let startIndex = -1;
    let startFloorId = null;

    const getElevation = (node) => {
      if (node.z !== undefined && node.z !== null) return node.z;
      const level = node.floorLevel !== undefined ? node.floorLevel : floorLevelMap.get(node.floorId);
      if (level !== undefined) {
        return level * 3.5 + 0.5;
      }
      return 0;
    };

    for (let i = 0; i < routePath.length - 1; i++) {
      const current = routePath[i];
      const next = routePath[i + 1];

      const isStairs = current.segmentType === 'stairs' || next.segmentType === 'stairs' ||
                       current.type === 'stairs' || next.type === 'stairs';
      const currLvl = current.floorLevel !== undefined ? current.floorLevel : floorLevelMap.get(current.floorId);
      const nextLvl = next.floorLevel !== undefined ? next.floorLevel : floorLevelMap.get(next.floorId);
      const isFloorChange = currLvl !== undefined && nextLvl !== undefined && currLvl !== nextLvl;

      if (!inStaircase && (isStairs || isFloorChange)) {
        inStaircase = true;
        startIndex = i;
        startFloorId = current.floorId;
      } else if (inStaircase) {
        // Continue if it's still stairs or floor hasn't stabilized
        if (!isStairs && !isFloorChange && current.floorId !== startFloorId) {
          // Floor stabilized, end of staircase
          const endIndex = i;
          
          const startNode = routePath[startIndex];
          const endNode = routePath[endIndex];
          const startElevation = getElevation(startNode);
          const endElevation = getElevation(endNode);

          const direction = endElevation >= startElevation ? 'UP' : 'DOWN';

          // Try to find metadata
          let meta = staircaseMetadata.find(m => 
            m.startFloorId === (startNode.floorId || '').toString() && 
            m.endFloorId === (endNode.floorId || '').toString()
          );

          const elevDiff = Math.abs(endElevation - startElevation);
          if (elevDiff > 0.5 || (meta && meta.totalSteps > 0)) {
            const totalSteps = meta?.totalSteps || Math.max(1, Math.round(elevDiff / 0.175));

            connectors.push({
              type: 'staircase',
              direction,
              startNodeIndex: startIndex,
              endNodeIndex: endIndex,
              startNode,
              endNode,
              intermediateNodes: routePath.slice(startIndex, endIndex + 1),
              totalSteps,
              startElevation: meta?.startElevation || startElevation,
              endElevation: meta?.endElevation || endElevation,
              startFloorId: startNode.floorId,
              endFloorId: endNode.floorId,
            });
          }

          inStaircase = false;
          startIndex = -1;
          startFloorId = null;
        }
      }
    }

    // Handle case where path ends while in staircase
    if (inStaircase) {
      const endIndex = routePath.length - 1;
      const startNode = routePath[startIndex];
      const endNode = routePath[endIndex];
      const startElevation = getElevation(startNode);
      const endElevation = getElevation(endNode);
      const direction = endElevation >= startElevation ? 'UP' : 'DOWN';
      
      let meta = staircaseMetadata.find(m => 
        m.startFloorId === (startNode.floorId || '').toString() && 
        m.endFloorId === (endNode.floorId || '').toString()
      );

      const elevDiff = Math.abs(endElevation - startElevation);
      if (elevDiff > 0.5 || (meta && meta.totalSteps > 0)) {
        const totalSteps = meta?.totalSteps || Math.max(1, Math.round(elevDiff / 0.175));

        connectors.push({
          type: 'staircase',
          direction,
          startNodeIndex: startIndex,
          endNodeIndex: endIndex,
          startNode,
          endNode,
          intermediateNodes: routePath.slice(startIndex, endIndex + 1),
          totalSteps,
          startElevation: meta?.startElevation || startElevation,
          endElevation: meta?.endElevation || endElevation,
          startFloorId: startNode.floorId,
          endFloorId: endNode.floorId,
        });
      }
    }

    return connectors;
  }
}
