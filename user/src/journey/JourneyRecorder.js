// JourneyRecorder
// Privacy-first modular journey recording and retracing lifecycle controller.
// Consumes existing positioning output and records clean navigation representations.
// ZERO server transmission — 100% device-local storage.

import JourneyStorage from "./JourneyStorage";
import { geoDistMeters } from "../utils/pathfinding";

export const JOURNEY_STATES = {
  IDLE: "IDLE",
  RECORDING: "RECORDING",
  COMPLETED: "COMPLETED",
  RETURNING: "RETURNING",
  DEVIATED: "DEVIATED",
  RECONNECTING: "RECONNECTING",
  CANCELLED: "CANCELLED",
  DELETED: "DELETED",
};

class JourneyRecorder {
  constructor() {
    this.state = JOURNEY_STATES.IDLE;
    this.activeSession = null;
    this.lastRecordedNode = null;
    this.listeners = [];
  }

  /**
   * Subscribe to state / session changes.
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener({ state: this.state, session: this.activeSession });
      } catch (e) {
        // Safe listener execution
      }
    }
  }

  /**
   * 1. startJourney
   * Initiates a new local JourneySession.
   */
  async startJourney({
    campusId,
    buildingId = null,
    startPoint,
    destination,
    startFloor = null,
    destinationFloor = null,
    initialNodes = [],
  }) {
    const journeyId = `journey_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();

    this.activeSession = {
      journeyId,
      campusId: campusId ? String(campusId) : null,
      buildingId: buildingId ? String(buildingId) : null,
      startPoint: {
        name: startPoint?.name || "Starting Point",
        x: startPoint?.x ?? 0,
        y: startPoint?.y ?? 0,
        floorId: startFloor ?? startPoint?.floorId ?? null,
      },
      destination: {
        name: destination?.name || "Destination",
        roomId: destination?._id || destination?.roomId || null,
        x: destination?.x ?? destination?.shape?.x ?? 0,
        y: destination?.y ?? destination?.shape?.y ?? 0,
        floorId: destinationFloor ?? destination?.floorId ?? null,
        blockName: destination?.blockName || destination?.blockId?.name || null,
      },
      startFloor,
      destinationFloor,
      startTime,
      endTime: null,
      distance: 0,
      duration: 0,
      pathNodes: initialNodes.length > 0 ? [...initialNodes] : [],
      floorTransitions: [],
      checkpoints: [],
      status: JOURNEY_STATES.RECORDING,
    };

    // If starting point has valid coordinates, save as initial checkpoint
    if (startPoint?.x && startPoint?.y) {
      this.recordCheckpoint({
        nodeId: "start_node",
        floorId: startFloor,
        x: startPoint.x,
        y: startPoint.y,
        z: 0,
        timestamp: startTime,
        heading: 0,
        confidence: 1.0,
      });
    }

    this.state = JOURNEY_STATES.RECORDING;
    this.lastRecordedNode = null;
    await JourneyStorage.saveActiveSession(this.activeSession);
    this._notify();

    return this.activeSession;
  }

  /**
   * 2. recordPosition
   * Processes a new position estimate from the existing PositionEngine.
   * Filters out redundant jitter and stores only meaningful progress (> 3 meters).
   */
  recordPosition(pos) {
    if (this.state !== JOURNEY_STATES.RECORDING || !this.activeSession) return;
    if (!pos || pos.x == null || pos.y == null) return;

    const checkpoints = this.activeSession.checkpoints;
    const lastCp = checkpoints[checkpoints.length - 1];

    if (lastCp) {
      const dist = geoDistMeters(lastCp.x, lastCp.y, pos.x, pos.y);
      if (dist < 3.0) {
        // Less than 3m movement, skip to keep storage compact
        return;
      }
    }

    this.recordCheckpoint({
      nodeId: pos.nodeId || `pos_${Date.now()}`,
      floorId: pos.floor || this.activeSession.startFloor,
      x: pos.x,
      y: pos.y,
      z: pos.z || 0,
      timestamp: Date.now(),
      heading: pos.heading || 0,
      confidence: pos.confidence || 0.8,
    });
  }

  /**
   * 3. recordCheckpoint
   * Stores a meaningful checkpoint in the active session.
   */
  recordCheckpoint(checkpoint) {
    if (this.state !== JOURNEY_STATES.RECORDING || !this.activeSession) return;
    if (!checkpoint) return;

    const cp = {
      nodeId: checkpoint.nodeId || `cp_${Date.now()}`,
      floorId: checkpoint.floorId || null,
      x: checkpoint.x,
      y: checkpoint.y,
      z: checkpoint.z || 0,
      timestamp: checkpoint.timestamp || Date.now(),
      heading: checkpoint.heading || 0,
      confidence: checkpoint.confidence || 0.8,
    };

    this.activeSession.checkpoints.push(cp);

    // Keep active session saved in local storage
    JourneyStorage.saveActiveSession(this.activeSession);
  }

  /**
   * 4. recordNode
   * Records a validated navigation graph node along the user's journey.
   */
  recordNode(node) {
    if (this.state !== JOURNEY_STATES.RECORDING || !this.activeSession) return;
    if (!node || node.x == null || node.y == null) return;

    const nodeId = node._id || node.nodeId || node.id;
    if (this.lastRecordedNode && this.lastRecordedNode.nodeId === nodeId) {
      return; // Avoid adjacent duplicate node
    }

    const nodeEntry = {
      nodeId: String(nodeId),
      x: node.x,
      y: node.y,
      floorId: node.floorId || null,
      floorLevel: node.floorLevel ?? null,
      type: node.type || "corridor",
      timestamp: Date.now(),
    };

    this.activeSession.pathNodes.push(nodeEntry);
    this.lastRecordedNode = nodeEntry;

    JourneyStorage.saveActiveSession(this.activeSession);
  }

  /**
   * 5. recordFloorTransition
   * Records a vertical transition (staircase, elevator, ramp).
   */
  recordFloorTransition(transition) {
    if (this.state !== JOURNEY_STATES.RECORDING || !this.activeSession) return;
    if (!transition) return;

    const entry = {
      transitionNode: transition.transitionNode || transition.nodeId || "STAIRS",
      fromFloor: transition.fromFloor || transition.fromFloorId || null,
      toFloor: transition.toFloor || transition.toFloorId || null,
      fromFloorLevel: transition.fromFloorLevel ?? null,
      toFloorLevel: transition.toFloorLevel ?? null,
      changeType: transition.changeType || "stairs",
      timestamp: Date.now(),
    };

    this.activeSession.floorTransitions.push(entry);
    JourneyStorage.saveActiveSession(this.activeSession);
  }

  /**
   * 6. finishJourney
   * Finalizes the journey session upon reaching the destination.
   * Stores the completed journey in local device storage.
   */
  async finishJourney({ distance = 0, duration = 0 } = {}) {
    if (this.state !== JOURNEY_STATES.RECORDING || !this.activeSession) return null;

    const endTime = Date.now();
    const calculatedDuration = duration > 0
      ? duration
      : Math.round((endTime - this.activeSession.startTime) / 1000);

    this.activeSession.endTime = endTime;
    this.activeSession.duration = calculatedDuration;
    this.activeSession.distance = Math.round(distance);
    this.activeSession.status = JOURNEY_STATES.COMPLETED;

    const completed = { ...this.activeSession };

    // Persist to local completed journeys list
    await JourneyStorage.saveCompletedJourney(completed);
    await JourneyStorage.clearActiveSession();

    this.activeSession = null;
    this.lastRecordedNode = null;
    this.state = JOURNEY_STATES.COMPLETED;
    this._notify();

    return completed;
  }

  /**
   * 7. cancelJourney
   * Cancels the active journey without saving to completed history.
   */
  async cancelJourney() {
    if (this.activeSession) {
      await JourneyStorage.clearActiveSession();
      this.activeSession = null;
      this.lastRecordedNode = null;
    }
    this.state = JOURNEY_STATES.CANCELLED;
    this._notify();
  }

  /**
   * 8. deleteJourney
   * Deletes a single completed journey by journeyId.
   */
  async deleteJourney(journeyId) {
    await JourneyStorage.deleteJourney(journeyId);
    this._notify();
  }

  /**
   * 9. getRecentJourneys
   * Retrieves all completed journeys stored on the device.
   */
  async getRecentJourneys() {
    return await JourneyStorage.getCompletedJourneys();
  }

  /**
   * 10. getJourneyById
   * Retrieves a single journey by ID.
   */
  async getJourneyById(journeyId) {
    return await JourneyStorage.getJourneyById(journeyId);
  }

  /**
   * 11. clearAllJourneys
   * Idempotently purges ALL local journey data.
   */
  async clearAllJourneys() {
    this.activeSession = null;
    this.lastRecordedNode = null;
    this.state = JOURNEY_STATES.DELETED;
    await JourneyStorage.clearAllJourneys();
    this._notify();
  }

  /**
   * 12. validateJourneyCampus
   * Checks if user is still within the campus boundary for a given campus.
   * Returns true if user is within radius, false if outside.
   */
  validateJourneyCampus(campusCenter, userLocation, campusRadius = 500) {
    if (!campusCenter || !userLocation) return true;
    if (campusCenter.lat == null || campusCenter.lng == null) return true;
    if (userLocation.latitude == null || userLocation.longitude == null) return true;

    const dist = geoDistMeters(
      userLocation.latitude,
      userLocation.longitude,
      campusCenter.lat,
      campusCenter.lng
    );

    return dist <= campusRadius;
  }

  /**
   * 13. handleCampusExit
   * Called when verified campus exit occurs.
   * Purges all local journey data on device.
   */
  async handleCampusExit() {
    if (__DEV__) console.log("[JourneyRecorder] 🚫 Campus boundary exit verified. Clearing all local journeys.");
    await this.clearAllJourneys();
  }
}

// Singleton instance for app-wide coordination
const journeyRecorder = new JourneyRecorder();
export default journeyRecorder;
