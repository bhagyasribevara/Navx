export default class SensorFusion {
  constructor() {
    this.stepTimestamps = [];
    this.pressureTrend = 'STABLE';
    this.isOnStaircase = false;
    this.hasBarometer = false;
  }

  /**
   * Called when a step is detected
   */
  onStep() {
    const now = Date.now();
    this.stepTimestamps.push(now);
    // Keep rolling window of last 3 seconds
    this.stepTimestamps = this.stepTimestamps.filter(t => now - t <= 3000);
  }

  /**
   * Called with barometer data
   * @param {number} pressure 
   * @param {number} relativeAltitude 
   */
  processBarometer(pressure, relativeAltitude) {
    this.hasBarometer = true;
    // pressure trend is usually fetched via BarometerService.getPressureTrend directly,
    // but if we need to update it here we can sync it or leave it to getMovementState.
  }

  /**
   * Sets barometer trend explicitly
   * @param {'RISING' | 'FALLING' | 'STABLE'} trend 
   */
  setPressureTrend(trend) {
    this.pressureTrend = trend;
  }

  /**
   * Sets staircase context
   * @param {boolean} isOnStaircase 
   * @param {'UP' | 'DOWN' | null} direction
   */
  setStaircaseContext(isOnStaircase, direction = null) {
    this.isOnStaircase = isOnStaircase;
    this.staircaseDirection = direction;
  }

  /**
   * Evaluates the current movement state
   * @returns {{state: string, direction: string|null, confidence: number, stepsDetected: number}}
   */
  getMovementState() {
    const now = Date.now();
    this.stepTimestamps = this.stepTimestamps.filter(t => now - t <= 3000);
    
    const stepsInLast3s = this.stepTimestamps.length;
    const hasRecentSteps = stepsInLast3s > 0;
    
    // Check if no steps in last 2 seconds
    const stepsInLast2s = this.stepTimestamps.filter(t => now - t <= 2000).length;
    if (stepsInLast2s === 0) {
      return {
        state: 'STATIONARY',
        direction: null,
        confidence: 1.0,
        stepsDetected: 0
      };
    }

    let climbingConditions = 0;
    let descendingConditions = 0;

    if (hasRecentSteps) {
      climbingConditions++;
      descendingConditions++;
    }

    if (this.isOnStaircase) {
      if (this.staircaseDirection === 'UP') {
        climbingConditions++;
      } else if (this.staircaseDirection === 'DOWN') {
        descendingConditions++;
      } else {
        climbingConditions++;
        descendingConditions++;
      }
    }

    if (this.pressureTrend === 'FALLING') {
      climbingConditions++;
    } else if (this.pressureTrend === 'RISING') {
      descendingConditions++;
    }

    const confidence = this.hasBarometer ? 0.9 : 0.7;

    if (climbingConditions >= 2 && climbingConditions > descendingConditions) {
      return {
        state: 'CLIMBING',
        direction: 'UP',
        confidence,
        stepsDetected: stepsInLast3s
      };
    }

    if (descendingConditions >= 2 && descendingConditions > climbingConditions) {
      return {
        state: 'DESCENDING',
        direction: 'DOWN',
        confidence,
        stepsDetected: stepsInLast3s
      };
    }

    // Default to walking if steps detected but not climbing/descending
    return {
      state: 'WALKING',
      direction: null,
      confidence: 0.8,
      stepsDetected: stepsInLast3s
    };
  }

  /**
   * Reset the fusion state
   */
  reset() {
    this.stepTimestamps = [];
    this.pressureTrend = 'STABLE';
    this.isOnStaircase = false;
    this.hasBarometer = false;
  }
}
