export default class VerticalTracker {
  constructor() {
    this.state = this._getInitialState();
    this.onFloorReached = null;
  }

  _getInitialState() {
    return {
      isActive: false,
      connector: null,
      direction: null,
      totalSteps: 0,
      stepsClimbed: 0,
      rawProgress: 0.0,
      smoothProgress: 0.0,
      currentPosition: null,
      startFloorId: null,
      endFloorId: null,
      startElevation: 0,
      endElevation: 0,
      floorReached: false,
    };
  }

  /**
   * Starts tracking a staircase connector
   * @param {Object} connector 
   */
  activate(connector) {
    if (!connector) return;
    const startElevation = connector.startElevation ?? 0;
    const direction = connector.direction || 'UP';
    const endElevation = connector.endElevation ?? (startElevation + (direction === 'DOWN' ? -3.5 : 3.5));
    const totalSteps = (connector.totalSteps && connector.totalSteps > 0) ? connector.totalSteps : 16;

    this.state = {
      ...this._getInitialState(),
      isActive: true,
      connector,
      direction,
      totalSteps,
      startFloorId: connector.startFloorId,
      endFloorId: connector.endFloorId,
      startElevation,
      endElevation,
      currentPosition: { 
        x: connector.startNode?.x ?? 0, 
        y: connector.startNode?.y ?? 0, 
        z: startElevation, 
        nodeId: connector.startNode?.nodeId,
        floorId: connector.startFloorId,
        hasValidElevation: true,
        elevationSource: 'staircase_connector'
      }
    };
  }

  /**
   * Stop tracking and reset state
   */
  deactivate() {
    this.state = this._getInitialState();
  }

  /**
   * Process a step event
   * @param {Object} fusionState Movement state from SensorFusion
   */
  onStep(fusionState = {}) {
    if (!this.state.isActive || this.state.floorReached) return;
    // Accept CLIMBING, DESCENDING, or WALKING when active on a staircase connector
    const validStates = ['CLIMBING', 'DESCENDING', 'WALKING'];
    if (fusionState && fusionState.state && !validStates.includes(fusionState.state)) return;

    const totalSteps = Math.max(1, this.state.totalSteps || 16);
    this.state.stepsClimbed += 1;
    this.state.rawProgress = Math.min(1.0, Math.max(0.0, this.state.stepsClimbed / totalSteps));
    
    // Exponential smoothing
    this.state.smoothProgress = 0.3 * this.state.rawProgress + 0.7 * this.state.smoothProgress;
    if (this.state.stepsClimbed >= totalSteps) {
      this.state.smoothProgress = Math.max(this.state.smoothProgress, this.state.rawProgress);
    }

    this._mapMatch();

    if (this.state.smoothProgress >= 0.95 || this.state.stepsClimbed >= totalSteps) {
      this._onFloorReached();
    }
  }

  /**
   * Map match the current progress to the intermediate nodes and compute continuous 3D elevation
   */
  _mapMatch() {
    if (!this.state.connector) return;

    const progress = Math.min(1.0, Math.max(0.0, this.state.smoothProgress));
    const startElev = this.state.startElevation ?? this.state.connector.startElevation ?? 0;
    const endElev = this.state.endElevation ?? this.state.connector.endElevation ?? (startElev + 3.5);
    const currentZ = startElev + (endElev - startElev) * progress;

    const startNode = this.state.connector.startNode || {};
    const endNode = this.state.connector.endNode || {};
    const intermediateNodes = this.state.connector.intermediateNodes;

    let x = (startNode.x ?? 0) + ((endNode.x ?? startNode.x ?? 0) - (startNode.x ?? 0)) * progress;
    let y = (startNode.y ?? 0) + ((endNode.y ?? startNode.y ?? 0) - (startNode.y ?? 0)) * progress;
    let nodeId = progress < 0.5 ? startNode.nodeId : endNode.nodeId;
    let floorId = progress < 0.5 ? this.state.startFloorId : this.state.endFloorId;

    if (intermediateNodes && intermediateNodes.length >= 2) {
      const segments = intermediateNodes.length - 1;
      const exactIndex = progress * segments;
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.min(segments, Math.ceil(exactIndex));

      if (lowerIndex === upperIndex) {
        const node = intermediateNodes[lowerIndex];
        x = node.x ?? x;
        y = node.y ?? y;
        nodeId = node.nodeId || nodeId;
        if (node.floorId) floorId = node.floorId;
      } else {
        const t = exactIndex - lowerIndex;
        const nodeA = intermediateNodes[lowerIndex];
        const nodeB = intermediateNodes[upperIndex];

        x = (nodeA.x ?? x) + ((nodeB.x ?? x) - (nodeA.x ?? x)) * t;
        y = (nodeA.y ?? y) + ((nodeB.y ?? y) - (nodeA.y ?? y)) * t;

        const nearestNode = t < 0.5 ? nodeA : nodeB;
        nodeId = nearestNode.nodeId || nodeId;
        if (nearestNode.floorId) floorId = nearestNode.floorId;
      }
    }

    this.state.currentPosition = {
      x,
      y,
      z: currentZ,
      nodeId,
      floorId,
      hasValidElevation: true,
      elevationSource: 'staircase_connector'
    };
  }

  /**
   * Handle reaching the target floor
   */
  _onFloorReached() {
    this.state.floorReached = true;
    const endNode = this.state.connector?.endNode || {};
    const endElev = this.state.endElevation ?? this.state.connector?.endElevation ?? 0;
    
    this.state.currentPosition = {
      x: endNode.x ?? (this.state.currentPosition?.x ?? 0),
      y: endNode.y ?? (this.state.currentPosition?.y ?? 0),
      z: endElev,
      nodeId: endNode.nodeId,
      floorId: this.state.endFloorId,
      hasValidElevation: true,
      elevationSource: 'staircase_connector'
    };

    if (typeof this.onFloorReached === 'function') {
      this.onFloorReached(this.state.endFloorId, endElev);
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
