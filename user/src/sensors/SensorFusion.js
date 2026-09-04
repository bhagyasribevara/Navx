export default class SensorFusion {
  constructor() {
    this.stepTimestamps = [];
    this.pressureTrend = 'STABLE';
    this.isOnStaircase = false;
    this.hasBarometer = false;

    // ── NEW: Gyroscope vertical rate (rad/s on z-axis during stair movement)
    this.gyroVerticalRate = 0;
    this.lastGyroTime = null;

    // ── NEW: Device pitch angle (degrees) from DeviceMotion
    // Positive pitch = phone tilted forward (nose down) → climbing
    // Negative pitch = phone tilted backward (nose up) → descending
    this.pitch = 0;
    this.hasDeviceMotion = false;

    // ── NEW: Step cadence from PedometerService (steps per minute)
    // Walking flat: ~100 spm | Climbing stairs: ~65-80 spm | Descending: ~70-85 spm
    this.stepCadence = 0;
    this.hasNativePedometer = false;
  }

  // ─────────────────────────────────────────────────────────────
  //  EXISTING INPUTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Called when a step is detected (works for both manual detector and native pedometer)
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
  }

  /**
   * Sets barometer trend explicitly
   * @param {'RISING' | 'FALLING' | 'STABLE'} trend
   */
  setPressureTrend(trend) {
    this.pressureTrend = trend;
  }

  /**
   * Sets staircase context from route matching
   * @param {boolean} isOnStaircase
   * @param {'UP' | 'DOWN' | null} direction
   */
  setStaircaseContext(isOnStaircase, direction = null) {
    this.isOnStaircase = isOnStaircase;
    this.staircaseDirection = direction;
  }

  // ─────────────────────────────────────────────────────────────
  //  NEW INPUTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Update device pitch from DeviceMotion (rotation.beta in radians → converted to degrees).
   * A significant forward/backward tilt while walking = strong stair signal.
   * @param {number} pitchDegrees - positive = tilted forward, negative = tilted back
   */
  setPitch(pitchDegrees) {
    this.pitch = pitchDegrees;
    this.hasDeviceMotion = true;
  }

  /**
   * Update gyroscope vertical angular rate.
   * During stair climbing, users naturally rock side-to-side — gyro picks this up.
   * @param {number} rateRadPerSec - z-axis angular velocity magnitude
   */
  setGyroVertical(rateRadPerSec) {
    this.gyroVerticalRate = Math.abs(rateRadPerSec);
  }

  /**
   * Update step cadence from PedometerService.
   * @param {number} stepsPerMinute
   */
  setStepCadence(stepsPerMinute) {
    this.stepCadence = stepsPerMinute;
    this.hasNativePedometer = true;
  }

  // ─────────────────────────────────────────────────────────────
  //  MOVEMENT STATE CLASSIFIER (upgraded from 3 conditions → 5)
  // ─────────────────────────────────────────────────────────────

  /**
   * Evaluates the current movement state using all available sensor signals.
   * @returns {{state: string, direction: string|null, confidence: number, stepsDetected: number}}
   */
  getMovementState() {
    const now = Date.now();
    this.stepTimestamps = this.stepTimestamps.filter(t => now - t <= 3000);

    const stepsInLast3s = this.stepTimestamps.length;
    const stepsInLast2s = this.stepTimestamps.filter(t => now - t <= 2000).length;

    if (stepsInLast2s === 0) {
      return {
        state: 'STATIONARY',
        direction: null,
        confidence: 1.0,
        stepsDetected: 0,
      };
    }

    let climbingScore = 0;
    let descendingScore = 0;
    let totalSignals = 0;

    // ── Signal 1: Steps detected (baseline — both directions get +1)
    if (stepsInLast3s > 0) {
      climbingScore += 1;
      descendingScore += 1;
    }
    totalSignals += 1;

    // ── Signal 2: Route staircase context (map-matching knows direction)
    if (this.isOnStaircase) {
      totalSignals += 1;
      if (this.staircaseDirection === 'UP') {
        climbingScore += 1;
      } else if (this.staircaseDirection === 'DOWN') {
        descendingScore += 1;
      } else {
        // Unknown staircase direction — slight boost to both
        climbingScore += 0.5;
        descendingScore += 0.5;
      }
    }

    // ── Signal 3: Barometer pressure trend
    if (this.hasBarometer && this.pressureTrend !== 'STABLE') {
      totalSignals += 1;
      if (this.pressureTrend === 'FALLING') {
        climbingScore += 1;   // Pressure falls → going UP
      } else if (this.pressureTrend === 'RISING') {
        descendingScore += 1; // Pressure rises → going DOWN
      }
    }

    // ── Signal 4 (NEW): Device pitch angle from DeviceMotion
    // Forward tilt > 8° while on staircase = strong climbing signal
    // Backward tilt > 8° = descending signal
    if (this.hasDeviceMotion && Math.abs(this.pitch) > 8) {
      totalSignals += 1;
      if (this.pitch > 8) {
        climbingScore += 1;
      } else if (this.pitch < -8) {
        descendingScore += 1;
      }
    }

    // ── Signal 5 (NEW): Step cadence from native pedometer
    // Stair cadence is measurably lower than walking cadence
    // Flat walking: ~95-110 spm | Stairs: ~60-85 spm
    if (this.hasNativePedometer && this.stepCadence > 0) {
      totalSignals += 1;
      if (this.stepCadence < 85 && this.stepCadence > 30) {
        // Low cadence = stair-like rhythm → boost whichever direction is winning
        if (climbingScore >= descendingScore) {
          climbingScore += 0.5;
        } else {
          descendingScore += 0.5;
        }
      }
    }

    // ── Confidence: based on how many real sensors contributed
    let confidence = 0.65; // base (steps only)
    if (this.hasBarometer) confidence += 0.10;
    if (this.hasDeviceMotion) confidence += 0.10;
    if (this.hasNativePedometer) confidence += 0.10;
    if (this.isOnStaircase) confidence += 0.05; // map context is very reliable
    confidence = Math.min(0.98, confidence);

    // ── Decision: need majority of scoring conditions to agree
    // With 5 signals, climbing ≥ 2.5 is majority
    const majorityThreshold = Math.max(2, totalSignals * 0.5);

    if (climbingScore >= majorityThreshold && climbingScore > descendingScore) {
      return {
        state: 'CLIMBING',
        direction: 'UP',
        confidence,
        stepsDetected: stepsInLast3s,
      };
    }

    if (descendingScore >= majorityThreshold && descendingScore > climbingScore) {
      return {
        state: 'DESCENDING',
        direction: 'DOWN',
        confidence,
        stepsDetected: stepsInLast3s,
      };
    }

    // Default: walking flat
    return {
      state: 'WALKING',
      direction: null,
      confidence: 0.80,
      stepsDetected: stepsInLast3s,
    };
  }

  /**
   * Reset all state (called when navigation stops)
   */
  reset() {
    this.stepTimestamps = [];
    this.pressureTrend = 'STABLE';
    this.isOnStaircase = false;
    this.hasBarometer = false;
    this.gyroVerticalRate = 0;
    this.pitch = 0;
    this.hasDeviceMotion = false;
    this.stepCadence = 0;
    this.hasNativePedometer = false;
  }
}
