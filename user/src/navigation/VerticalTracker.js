/**
 * VerticalTracker
 * Manages vertical elevation tracking and progress calculation along an active staircase connector.
 * 
 * Rules:
 * - Authoritative staircase geometry: lowerElevation, upperElevation, lowerFloorId, upperFloorId.
 * - Route-relative direction:
 *     UP   -> progress: 0.0 -> 1.0 (from lowerElevation to upperElevation)
 *     DOWN -> progress: 1.0 -> 0.0 (from upperElevation to lowerElevation)
 * - Formula: currentZ = lowerElevation + (upperElevation - lowerElevation) * progress
 * - Safeguards: local step reset, pre-activation step rejection, duplicate debounce, clamp [0, 1], endpoint snap.
 */
export default class VerticalTracker {
  constructor() {
    this.state = this._getInitialState();
    this.onFloorReached = null;
  }

  _getInitialState() {
    return {
      isActive: false,
      connector: null,
      direction: null, // 'UP' or 'DOWN'
      totalSteps: 0,
      stepsClimbed: 0,
      rawProgress: 0.0,
      smoothProgress: 0.0,
      currentPosition: null,
      lowerFloorId: null,
      upperFloorId: null,
      lowerFloorLevel: 0,
      upperFloorLevel: 1,
      lowerElevation: 0,
      upperElevation: 3.5,
      floorReached: false,
      activatedAt: 0,
      lastStepTime: 0,
    };
  }

  /**
   * Starts tracking a staircase connector
   * @param {Object} connector Normalized staircase connector
   */
  activate(connector) {
    if (!connector) return;

    const direction = connector.direction || (connector.endElevation >= connector.startElevation ? 'UP' : 'DOWN');
    const lowerElevation = connector.lowerElevation !== undefined
      ? connector.lowerElevation
      : Math.min(connector.startElevation ?? 0.54, connector.endElevation ?? 4.04);
    const upperElevation = connector.upperElevation !== undefined
      ? connector.upperElevation
      : Math.max(connector.startElevation ?? 0.54, connector.endElevation ?? 4.04);

    const totalSteps = (connector.totalSteps && connector.totalSteps > 0)
      ? connector.totalSteps
      : Math.max(8, Math.round(Math.abs(upperElevation - lowerElevation) / 0.175));

    const lowerFloorId = connector.lowerFloorId || (direction === 'UP' ? connector.startFloorId : connector.endFloorId);
    const upperFloorId = connector.upperFloorId || (direction === 'UP' ? connector.endFloorId : connector.startFloorId);
    const lowerFloorLevel = connector.lowerFloorLevel !== undefined ? connector.lowerFloorLevel : 0;
    const upperFloorLevel = connector.upperFloorLevel !== undefined ? connector.upperFloorLevel : 1;

    // Route-relative progress baseline:
    // UP: starts at 0.0 (lowerElevation), advances to 1.0 (upperElevation)
    // DOWN: starts at 1.0 (upperElevation), decreases to 0.0 (lowerElevation)
    const initialProgress = direction === 'UP' ? 0.0 : 1.0;
    const initialZ = direction === 'UP' ? lowerElevation : upperElevation;
    const initialFloorId = direction === 'UP' ? lowerFloorId : upperFloorId;
    const initialFloorLevel = direction === 'UP' ? lowerFloorLevel : upperFloorLevel;
    const now = Date.now();

    this.state = {
      ...this._getInitialState(),
      isActive: true,
      connector,
      direction,
      totalSteps,
      stepsClimbed: 0,
      rawProgress: initialProgress,
      smoothProgress: initialProgress,
      lowerFloorId,
      upperFloorId,
      lowerFloorLevel,
      upperFloorLevel,
      lowerElevation,
      upperElevation,
      activatedAt: now,
      lastStepTime: 0,
      currentPosition: {
        x: connector.startNode?.x ?? 0,
        y: connector.startNode?.y ?? 0,
        z: initialZ,
        nodeId: connector.startNode?.nodeId,
        floorId: initialFloorId,
        floorLevel: initialFloorLevel,
        hasValidElevation: true,
        elevationSource: 'staircase_connector'
      }
    };

    console.log(`[VERTICAL] connector activated: ${connector.connectorId || 'stairs'} | direction: ${direction} | lowerZ: ${lowerElevation.toFixed(2)} | upperZ: ${upperElevation.toFixed(2)} | totalSteps: ${totalSteps}`);
  }

  /**
   * Stop tracking and reset state
   */
  deactivate() {
    if (this.state.isActive) {
      console.log(`[VERTICAL] connector deactivated: ${this.state.connector?.connectorId || 'stairs'}`);
    }
    this.state = this._getInitialState();
  }

  /**
   * Process a step event
   * @param {Object} fusionState Movement state from SensorFusion (optional)
   * @param {number} timestamp Timestamp of detected step
   */
  onStep(fusionState = {}, timestamp = Date.now()) {
    if (!this.state.isActive || this.state.floorReached) return;

    // Safeguard 1: Ignore steps detected before this connector was activated
    if (timestamp < this.state.activatedAt) return;

    // Safeguard 2: Debounce rapid duplicate step callbacks (< 220ms)
    if (timestamp - this.state.lastStepTime < 220) return;
    this.state.lastStepTime = timestamp;

    const totalSteps = Math.max(1, this.state.totalSteps || 16);
    this.state.stepsClimbed += 1;
    const stepDelta = 1 / totalSteps;

    if (this.state.direction === 'UP') {
      // Ascending: 0.0 -> 1.0
      this.state.rawProgress = Math.min(1.0, Math.max(0.0, this.state.rawProgress + stepDelta));
      // Responsive smoothing without lagging behind the user
      this.state.smoothProgress = 0.5 * this.state.rawProgress + 0.5 * this.state.smoothProgress;
      if (this.state.stepsClimbed >= totalSteps) {
        this.state.smoothProgress = Math.max(this.state.smoothProgress, this.state.rawProgress);
      }
    } else {
      // Descending: 1.0 -> 0.0
      this.state.rawProgress = Math.min(1.0, Math.max(0.0, this.state.rawProgress - stepDelta));
      this.state.smoothProgress = 0.5 * this.state.rawProgress + 0.5 * this.state.smoothProgress;
      if (this.state.stepsClimbed >= totalSteps) {
        this.state.smoothProgress = Math.min(this.state.smoothProgress, this.state.rawProgress);
      }
    }

    this._mapMatch();

    const currentZ = this.state.currentPosition?.z ?? 0;
    console.log(`[VERTICAL] direction: ${this.state.direction} | step: ${this.state.stepsClimbed}/${totalSteps} | progress: ${this.state.smoothProgress.toFixed(2)} | Z: ${currentZ.toFixed(2)}m`);

    // Endpoint checks
    if (this.state.direction === 'UP') {
      if (this.state.smoothProgress >= 0.95 || this.state.stepsClimbed >= totalSteps) {
        this._onFloorReached('UP');
      }
    } else {
      if (this.state.smoothProgress <= 0.05 || this.state.stepsClimbed >= totalSteps) {
        this._onFloorReached('DOWN');
      }
    }
  }

  /**
   * Map match the current progress to intermediate nodes and compute continuous 3D elevation
   */
  _mapMatch() {
    if (!this.state.connector) return;

    const progress = Math.min(1.0, Math.max(0.0, this.state.smoothProgress));
    const lowerElev = this.state.lowerElevation ?? 0;
    const upperElev = this.state.upperElevation ?? (lowerElev + 3.5);

    // Authoritative vertical elevation from staircase progress
    const currentZ = lowerElev + (upperElev - lowerElev) * progress;

    const startNode = this.state.connector.startNode || {};
    const endNode = this.state.connector.endNode || {};
    const intermediateNodes = this.state.connector.intermediateNodes;

    // Route progress along travel direction (0.0 at entry node, 1.0 at exit node)
    const routeProgress = (this.state.direction === 'UP') ? progress : (1.0 - progress);

    let x = (startNode.x ?? 0) + ((endNode.x ?? startNode.x ?? 0) - (startNode.x ?? 0)) * routeProgress;
    let y = (startNode.y ?? 0) + ((endNode.y ?? startNode.y ?? 0) - (startNode.y ?? 0)) * routeProgress;
    let nodeId = routeProgress < 0.5 ? startNode.nodeId : endNode.nodeId;

    // Floor assignment: lower floor until passing mid-way, then upper floor
    const isPastMid = progress >= 0.5;
    const floorId = isPastMid ? this.state.upperFloorId : this.state.lowerFloorId;
    const floorLevel = isPastMid ? this.state.upperFloorLevel : this.state.lowerFloorLevel;

    if (intermediateNodes && intermediateNodes.length >= 2) {
      const segments = intermediateNodes.length - 1;
      const exactIndex = routeProgress * segments;
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.min(segments, Math.ceil(exactIndex));

      if (lowerIndex === upperIndex) {
        const node = intermediateNodes[lowerIndex];
        x = node.x ?? x;
        y = node.y ?? y;
        nodeId = node.nodeId || nodeId;
      } else {
        const t = exactIndex - lowerIndex;
        const nodeA = intermediateNodes[lowerIndex];
        const nodeB = intermediateNodes[upperIndex];

        x = (nodeA.x ?? x) + ((nodeB.x ?? x) - (nodeA.x ?? x)) * t;
        y = (nodeA.y ?? y) + ((nodeB.y ?? y) - (nodeA.y ?? y)) * t;

        const nearestNode = t < 0.5 ? nodeA : nodeB;
        nodeId = nearestNode.nodeId || nodeId;
      }
    }

    this.state.currentPosition = {
      x,
      y,
      z: currentZ,
      nodeId,
      floorId,
      floorLevel,
      hasValidElevation: true,
      elevationSource: 'staircase_connector'
    };
  }

  /**
   * Handle reaching the target floor with exact endpoint snapping
   */
  _onFloorReached(direction) {
    this.state.floorReached = true;
    const endNode = this.state.connector?.endNode || {};

    let exactZ, targetFloorId, targetFloorLevel;
    if (direction === 'UP') {
      this.state.smoothProgress = 1.0;
      this.state.rawProgress = 1.0;
      exactZ = this.state.upperElevation;
      targetFloorId = this.state.upperFloorId;
      targetFloorLevel = this.state.upperFloorLevel;
    } else {
      this.state.smoothProgress = 0.0;
      this.state.rawProgress = 0.0;
      exactZ = this.state.lowerElevation;
      targetFloorId = this.state.lowerFloorId;
      targetFloorLevel = this.state.lowerFloorLevel;
    }

    this.state.currentPosition = {
      x: endNode.x ?? (this.state.currentPosition?.x ?? 0),
      y: endNode.y ?? (this.state.currentPosition?.y ?? 0),
      z: exactZ,
      nodeId: endNode.nodeId,
      floorId: targetFloorId,
      floorLevel: targetFloorLevel,
      hasValidElevation: true,
      elevationSource: 'staircase_connector'
    };

    console.log(`[VERTICAL] Floor reached: ${targetFloorId} (Level ${targetFloorLevel}) at exact Z: ${exactZ.toFixed(2)}m`);

    if (typeof this.onFloorReached === 'function') {
      this.onFloorReached(targetFloorId, exactZ, targetFloorLevel);
    }
  }

  /**
   * Gets current position
   * @returns {Object|null}
   */
  getPosition() {
    if (!this.state.isActive && !this.state.floorReached) return null;
    return this.state.currentPosition;
  }
}
