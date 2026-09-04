import { Pedometer } from 'expo-sensors';

/**
 * PedometerService — Uses the device's built-in hardware step counter co-processor.
 * Much more accurate than manual accelerometer peak detection, especially on stairs.
 * Falls back gracefully; NavigationScreen checks isAvailable before using.
 */
class PedometerService {
  constructor() {
    this.subscription = null;
    this.lastStepCount = 0;
    this.isRunning = false;
    this.available = false;
    this._onStep = null;
    // Cadence tracking (steps per minute) for SensorFusion scoring
    this.stepTimestamps = [];
  }

  /**
   * Check if native pedometer is available on this device.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      this.available = await Pedometer.isAvailableAsync();
      return this.available;
    } catch (e) {
      console.warn('[PedometerService] Availability check failed:', e);
      this.available = false;
      return false;
    }
  }

  /**
   * Start listening to native step count.
   * @param {function} onStep - called once per step detected
   */
  start(onStep) {
    if (this.isRunning) this.stop();
    this._onStep = onStep;
    this.lastStepCount = 0;

    this.subscription = Pedometer.watchStepCount(result => {
      const totalSteps = result.steps;
      // Calculate delta steps since last callback
      const delta = totalSteps - this.lastStepCount;
      this.lastStepCount = totalSteps;

      if (delta > 0) {
        const now = Date.now();
        // Track each step timestamp for cadence calculation
        for (let i = 0; i < delta; i++) {
          this.stepTimestamps.push(now);
          if (this._onStep) this._onStep();
        }
        // Keep only last 10 seconds of timestamps
        this.stepTimestamps = this.stepTimestamps.filter(t => now - t <= 10000);
      }
    });

    this.isRunning = true;
    console.log('[PedometerService] Started native step counter');
  }

  /**
   * Stop the pedometer subscription.
   */
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;
    this.lastStepCount = 0;
    this.stepTimestamps = [];
    console.log('[PedometerService] Stopped');
  }

  /**
   * Returns current step cadence in steps per minute.
   * Stair cadence ~70 spm, walking ~100 spm, running ~150+ spm.
   * @returns {number} steps per minute (0 if no recent steps)
   */
  getCadence() {
    const now = Date.now();
    const windowMs = 6000; // 6-second window
    const recentSteps = this.stepTimestamps.filter(t => now - t <= windowMs);
    if (recentSteps.length < 2) return 0;
    return (recentSteps.length / windowMs) * 60000;
  }
}

const pedometerService = new PedometerService();
export default pedometerService;
