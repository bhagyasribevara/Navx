import { Barometer } from 'expo-sensors';

class BarometerService {
  constructor() {
    this.subscription = null;
    this.buffer = [];
    this.maxBufferSize = 60; // 30 seconds at 500ms
    this.firstPressure = null;
    this.initialRelativeAltitude = null;
  }

  /**
   * Checks if barometer is available on the device
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      return await Barometer.isAvailableAsync();
    } catch (error) {
      console.warn('Error checking barometer availability', error);
      return false;
    }
  }

  /**
   * Starts the barometer subscription
   * @param {function} onData - Callback with { pressure, relativeAltitude, timestamp }
   */
  start(onData) {
    if (this.subscription) {
      this.stop();
    }

    Barometer.setUpdateInterval(500);
    this.buffer = [];
    this.firstPressure = null;
    this.initialRelativeAltitude = null;

    this.subscription = Barometer.addListener((data) => {
      const { pressure, relativeAltitude } = data;
      const timestamp = Date.now();

      if (this.firstPressure === null) {
        this.firstPressure = pressure;
        this.initialRelativeAltitude = relativeAltitude;
      }

      this.buffer.push({ pressure, relativeAltitude, timestamp });
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }

      if (onData) {
        onData({ pressure, relativeAltitude, timestamp });
      }
    });
  }

  /**
   * Stops the barometer subscription
   */
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.buffer = [];
    this.firstPressure = null;
    this.initialRelativeAltitude = null;
  }

  /**
   * Gets the pressure trend over a specific window
   * @param {number} windowMs - Window size in milliseconds
   * @returns {'RISING' | 'FALLING' | 'STABLE'}
   */
  getPressureTrend(windowMs = 30000) {
    if (this.buffer.length < 2) return 'STABLE';

    const now = Date.now();
    const cutoff = now - windowMs;
    const windowData = this.buffer.filter(d => d.timestamp >= cutoff);

    if (windowData.length < 2) return 'STABLE';

    const currentPressure = windowData[windowData.length - 1].pressure;
    const avgHistorical = windowData.reduce((sum, d) => sum + d.pressure, 0) / windowData.length;
    
    const diff = currentPressure - avgHistorical;

    if (diff > 0.05) return 'RISING'; // Pressure increasing -> going DOWN
    if (diff < -0.05) return 'FALLING'; // Pressure decreasing -> going UP
    return 'STABLE';
  }

  /**
   * Gets the relative altitude change since start
   * @returns {number} Altitude change in meters
   */
  getRelativeAltitudeChange() {
    if (this.buffer.length === 0) return 0;

    const currentData = this.buffer[this.buffer.length - 1];

    // iOS provides relativeAltitude directly
    if (currentData.relativeAltitude !== undefined && this.initialRelativeAltitude !== undefined) {
      return currentData.relativeAltitude - this.initialRelativeAltitude;
    }

    // Android/fallback: Compute from pressure using hypsometric formula
    if (this.firstPressure !== null && currentData.pressure !== null) {
      const p0 = this.firstPressure;
      const p = currentData.pressure;
      // deltaAlt = 44330 * (1 - (P/P0)^0.19)
      const deltaAlt = 44330 * (1 - Math.pow(p / p0, 0.19));
      return deltaAlt;
    }

    return 0;
  }
}

const barometerService = new BarometerService();
export default barometerService;
