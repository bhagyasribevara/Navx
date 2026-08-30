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
      floorReached: false,
    };
  }

  /**
   * Starts tracking a staircase connector
   * @param {Object} connector 
   */
  activate(connector) {
    if (!connector) return;
    this.state = {
      ...this._getInitialState(),
      isActive: true,
      connector,
      direction: connector.direction,
      totalSteps: connector.totalSteps,
      startFloorId: connector.startFloorId,
      endFloorId: connector.endFloorId,
      currentPosition: { 
        x: connector.startNode.x, 
        y: connector.startNode.y, 
        z: connector.startElevation, 
        nodeId: connector.startNode.nodeId,
        floorId: connector.startFloorId
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
  onStep(fusionState) {
    if (!this.state.isActive || this.state.floorReached) return;
    if (fusionState.state !== 'CLIMBING' && fusionState.state !== 'DESCENDING') return;
    // Optional: Check if direction matches connector direction
    // if (fusionState.direction !== this.state.direction) return;

    this.state.stepsClimbed += 1;
    this.state.rawProgress = Math.min(1.0, Math.max(0.0, this.state.stepsClimbed / this.state.totalSteps));
    
    // Exponential smoothing
    this.state.smoothProgress = 0.3 * this.state.rawProgress + 0.7 * this.state.smoothProgress;

    this._mapMatch();

    if (this.state.smoothProgress >= 0.95) {
      this._onFloorReached();
    }
  }

  /**
   * Map match the current progress to the intermediate nodes
   */
  _mapMatch() {
    const nodes = this.state.connector.intermediateNodes;
    if (!nodes || nodes.length < 2) return;

    const progress = this.state.smoothProgress;
    const segments = nodes.length - 1;
    const exactIndex = progress * segments;
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.min(segments, Math.ceil(exactIndex));

    if (lowerIndex === upperIndex) {
      const node = nodes[lowerIndex];
      this.state.currentPosition = {
        x: node.x,
        y: node.y,
        z: node.z,
        nodeId: node.nodeId,
        floorId: node.floorId
      };
      return;
    }

    const t = exactIndex - lowerIndex;
    const nodeA = nodes[lowerIndex];
    const nodeB = nodes[upperIndex];

    const getZ = (n) => n.z !== undefined && n.z !== null ? n.z : 0;

    const x = nodeA.x + (nodeB.x - nodeA.x) * t;
    const y = nodeA.y + (nodeB.y - nodeA.y) * t;
    const z = getZ(nodeA) + (getZ(nodeB) - getZ(nodeA)) * t;

    const nearestNode = t < 0.5 ? nodeA : nodeB;

    this.state.currentPosition = {
      x,
      y,
      z,
      nodeId: nearestNode.nodeId,
      floorId: nearestNode.floorId
    };
  }

  /**
   * Handle reaching the target floor
   */
  _onFloorReached() {
    this.state.floorReached = true;
    const endNode = this.state.connector.endNode;
    
    this.state.currentPosition = {
      x: endNode.x,
      y: endNode.y,
      z: this.state.connector.endElevation,
      nodeId: endNode.nodeId,
      floorId: this.state.endFloorId
    };

    if (typeof this.onFloorReached === 'function') {
      this.onFloorReached(this.state.endFloorId);
    }
  }

  /**
   * Gets current position
   * @returns {Object|null}
   */
  getPosition() {
    if (!this.state.isActive) return null;
    return this.state.currentPosition;
  }
}
