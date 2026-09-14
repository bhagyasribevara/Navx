// ReturnPathMatcher
// Reverses recorded trajectories, inverts floor transitions, matches user progress,
// and detects deviations with configurable tolerances.

import { geoDistMeters, generateDirections } from "../utils/pathfinding";

export const RETURN_MODES = {
  RETRACE_ROUTE: "RETRACE_ROUTE", // Primary: reversed actual trajectory
  FASTEST_ROUTE: "FASTEST_ROUTE", // Secondary: fallback route planner
};

export const DEVIATION_CONFIG = {
  NEARBY_TOLERANCE_METERS: 15,         // Small GPS / sensor error tolerance
  RECONNECT_TOLERANCE_METERS: 18,      // Distance within which user snaps back to path
  DEVIATION_THRESHOLD_METERS: 25,      // Distance beyond which off-route is flagged
  CONSECUTIVE_DEVIATIONS_REQUIRED: 3,  // Consecutive ticks to confirm genuine deviation
  PROGRESS_STEP_LOOKAHEAD: 2,          // Segments ahead to search for progress
};

export class ReturnPathMatcher {
  constructor(journeySession, config = {}) {
    this.journey = journeySession;
    this.config = { ...DEVIATION_CONFIG, ...config };
    this.mode = RETURN_MODES.RETRACE_ROUTE;
    this.consecutiveOffRouteCount = 0;
    this.currentStepIndex = 0;
    this.isReconnecting = false;
    this.returnRoute = null;

    if (journeySession) {
      this.returnRoute = this.buildReturnRoute(journeySession);
    }
  }

  /**
   * Reverses the recorded journey path and inverts floor transitions.
   * @param {object} journey
   * @returns {object} { path, directions, totalDistance, floorTransitions, destination, startPoint }
   */
  buildReturnRoute(journey) {
    if (!journey || !journey.pathNodes || journey.pathNodes.length === 0) {
      return null;
    }

    // 1. Reverse the path nodes array
    const originalNodes = journey.pathNodes;
    const reversedNodes = originalNodes.map((node) => ({ ...node })).reverse();

    // Re-index node order and recalculate segment distances for reversed direction
    for (let i = 0; i < reversedNodes.length; i++) {
      if (i > 0) {
        const prev = reversedNodes[i - 1];
        const curr = reversedNodes[i];
        curr.segmentDistance = geoDistMeters(prev.x, prev.y, curr.x, curr.y);
      } else {
        reversedNodes[i].segmentDistance = 0;
      }
    }

    // 2. Invert floor transitions
    // If original went fromFloor: 1 -> toFloor: 2, return goes fromFloor: 2 -> toFloor: 1
    const originalTransitions = journey.floorTransitions || [];
    const invertedTransitions = originalTransitions
      .map((t) => ({
        transitionNode: t.transitionNode,
        fromFloor: t.toFloor,
        toFloor: t.fromFloor,
        fromFloorLevel: t.toFloorLevel ?? null,
        toFloorLevel: t.fromFloorLevel ?? null,
        changeType: t.changeType || "floor_change",
      }))
      .reverse();

    // 3. Generate turn-by-turn directions in reverse
    const directions = generateDirections(reversedNodes);

    // 4. Compute total distance
    let totalDistance = 0;
    for (const d of directions) {
      totalDistance += d.distance || 0;
    }
    if (totalDistance === 0 && reversedNodes.length > 1) {
      for (let i = 1; i < reversedNodes.length; i++) {
        totalDistance += geoDistMeters(
          reversedNodes[i - 1].x,
          reversedNodes[i - 1].y,
          reversedNodes[i].x,
          reversedNodes[i].y
        );
      }
    }

    return {
      path: reversedNodes,
      directions,
      distance: Math.round(totalDistance * 10) / 10,
      floorTransitions: invertedTransitions,
      // The return destination is the original starting point!
      startPoint: journey.destination,
      destination: journey.startPoint,
      journeyId: journey.journeyId,
      campusId: journey.campusId,
    };
  }

  /**
   * Compares current user position against the return path.
   * Finds nearest segment, updates progress, and checks for deviation.
   *
   * @param {number} userLat
   * @param {number} userLng
   * @param {string|null} currentFloorId
   * @returns {object} {
   *   status: 'ON_TRACK' | 'DEVIATED' | 'RECONNECTING' | 'ARRIVED' | 'REQUEST_FALLBACK',
   *   matchedStepIndex: number,
   *   distanceToPath: number,
   *   nearestNode: object,
   *   message: string,
   *   shouldFallback: boolean
   * }
   */
  matchPosition(userLat, userLng, currentFloorId = null) {
    if (!this.returnRoute || !this.returnRoute.path || this.returnRoute.path.length === 0) {
      return {
        status: "REQUEST_FALLBACK",
        matchedStepIndex: 0,
        distanceToPath: Infinity,
        nearestNode: null,
        message: "No valid return route found.",
        shouldFallback: true,
      };
    }

    const path = this.returnRoute.path;
    const destNode = path[path.length - 1];
    const distToDestination = geoDistMeters(userLat, userLng, destNode.x, destNode.y);

    // Check arrival at original starting point
    if (distToDestination < 8) {
      return {
        status: "ARRIVED",
        matchedStepIndex: path.length - 1,
        distanceToPath: 0,
        nearestNode: destNode,
        message: "Arrived at starting point.",
        shouldFallback: false,
      };
    }

    // Find closest segment/node within window around current step
    let minDistance = Infinity;
    let closestIndex = this.currentStepIndex;

    // Search from currentStepIndex onwards (with lookbehind of 1)
    const searchStart = Math.max(0, this.currentStepIndex - 1);
    const searchEnd = Math.min(path.length - 1, this.currentStepIndex + 4);

    for (let i = searchStart; i <= searchEnd; i++) {
      const node = path[i];
      // If floorId provided, prefer matching same floor
      if (currentFloorId && node.floorId && node.floorId !== currentFloorId) {
        continue;
      }

      const dist = geoDistMeters(userLat, userLng, node.x, node.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // If local window didn't find a close match, scan all path nodes
    if (minDistance > this.config.DEVIATION_THRESHOLD_METERS) {
      for (let i = 0; i < path.length; i++) {
        const dist = geoDistMeters(userLat, userLng, path[i].x, path[i].y);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      }
    }

    const nearestNode = path[closestIndex];

    // Evaluate deviation state
    if (minDistance <= this.config.NEARBY_TOLERANCE_METERS) {
      // User is cleanly on track
      this.consecutiveOffRouteCount = 0;
      this.currentStepIndex = Math.max(this.currentStepIndex, closestIndex);
      const wasReconnecting = this.isReconnecting;
      this.isReconnecting = false;

      return {
        status: "ON_TRACK",
        matchedStepIndex: this.currentStepIndex,
        distanceToPath: minDistance,
        nearestNode,
        message: wasReconnecting ? "Return route restored." : "Following return route.",
        shouldFallback: false,
      };
    }

    if (minDistance <= this.config.DEVIATION_THRESHOLD_METERS) {
      // User is slightly off track but within reconnect tolerance
      this.isReconnecting = true;
      return {
        status: "RECONNECTING",
        matchedStepIndex: closestIndex,
        distanceToPath: minDistance,
        nearestNode,
        message: "You moved away from your original route. Reconnecting...",
        shouldFallback: false,
      };
    }

    // Beyond DEVIATION_THRESHOLD_METERS
    this.consecutiveOffRouteCount++;

    if (this.consecutiveOffRouteCount >= this.config.CONSECUTIVE_DEVIATIONS_REQUIRED) {
      // Genuine sustained deviation -> trigger secondary fallback (fastest route)
      this.mode = RETURN_MODES.FASTEST_ROUTE;
      return {
        status: "REQUEST_FALLBACK",
        matchedStepIndex: closestIndex,
        distanceToPath: minDistance,
        nearestNode,
        message: "You're away from your original route. Finding the best way back...",
        shouldFallback: true,
      };
    }

    return {
      status: "DEVIATED",
      matchedStepIndex: closestIndex,
      distanceToPath: minDistance,
      nearestNode,
      message: "You moved away from your original route. Reconnecting...",
      shouldFallback: false,
    };
  }

  /**
   * Reset deviation counters and restore RETRACE_ROUTE mode.
   */
  resetDeviation() {
    this.consecutiveOffRouteCount = 0;
    this.isReconnecting = false;
    this.mode = RETURN_MODES.RETRACE_ROUTE;
  }
}

export default ReturnPathMatcher;
