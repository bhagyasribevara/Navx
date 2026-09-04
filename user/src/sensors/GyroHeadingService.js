import { Gyroscope, Magnetometer } from 'expo-sensors';

/**
 * GyroHeadingService — Complementary Filter fusion of Gyroscope + Magnetometer.
 *
 * Problem with raw Magnetometer indoors:
 *   - Campus metal structures, rebar, electrical wiring distort magnetic north
 *   - Result: heading jumps ±20-40° causing dead reckoning to walk in wrong direction
 *
 * Solution (Complementary Filter):
 *   heading = α × (prevHeading + gyro_dAngle × dt) + (1-α) × magnetometer_heading
 *   α = 0.98  →  98% gyroscope (smooth, accurate short-term, no distortion)
 *               2% magnetometer (slow drift correction long-term)
 *
 * The Gyroscope measures angular velocity (°/s) and has zero magnetic distortion.
 * The Magnetometer corrects accumulated gyro drift over longer periods.
 */
class GyroHeadingService {
  constructor() {
    this.gyroSub = null;
    this.magSub = null;
    this.fusedHeading = 0;      // degrees 0–360
    this.magHeading = 0;        // raw magnetometer heading
    this.lastGyroTime = null;
    this.isRunning = false;
    this._onHeading = null;

    // Complementary filter alpha: 0.98 = trust gyro 98%, mag 2%
    this.ALPHA = 0.98;

    // Raw sensor values for tilt compensation
    this.accelY = 0;
  }

  /**
   * Provide the current accelerometer Y value for tilt compensation.
   * Call this from the existing Accelerometer listener in NavigationScreen.
   * @param {number} y
   */
  setAccelY(y) {
    this.accelY = y;
  }

  /**
   * Start the gyro + mag fusion.
   * @param {function} onHeading - called with fused heading (degrees 0–360) whenever updated
   */
  start(onHeading) {
    if (this.isRunning) this.stop();
    this._onHeading = onHeading;
    this.lastGyroTime = null;
    this.fusedHeading = 0;

    // ── Gyroscope: 50ms interval for smooth integration
    Gyroscope.setUpdateInterval(50);
    this.gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (this.lastGyroTime === null) {
        this.lastGyroTime = now;
        return;
      }

      const dt = (now - this.lastGyroTime) / 1000; // seconds
      this.lastGyroTime = now;

      // z-axis rotation = yaw (rotation around vertical axis = heading change)
      // Convert rad/s to degrees
      const dAngle = z * (180 / Math.PI) * dt;

      // Complementary filter: blend gyro integration + magnetometer correction
      this.fusedHeading = this.ALPHA * (this.fusedHeading + dAngle) +
                          (1 - this.ALPHA) * this.magHeading;

      // Normalize to 0–360
      this.fusedHeading = ((this.fusedHeading % 360) + 360) % 360;

      if (this._onHeading) this._onHeading(this.fusedHeading);
    });

    // ── Magnetometer: 100ms — used only as long-term drift correction
    Magnetometer.setUpdateInterval(100);
    this.magSub = Magnetometer.addListener(({ x, y, z }) => {
      // Tilt-compensated compass using accelerometer Y
      const gY = Math.min(1, Math.abs(this.accelY || 0));
      const mForward = y * (1 - gY) + (-z) * gY;

      const h = Math.atan2(mForward, x) * (180 / Math.PI);
      const trueBearing = h - 90;
      this.magHeading = ((trueBearing % 360) + 360) % 360;
    });

    this.isRunning = true;
    console.log('[GyroHeadingService] Started complementary filter heading');
  }

  /**
   * Stop all listeners.
   */
  stop() {
    if (this.gyroSub) { this.gyroSub.remove(); this.gyroSub = null; }
    if (this.magSub) { this.magSub.remove(); this.magSub = null; }
    this.isRunning = false;
    this.lastGyroTime = null;
    console.log('[GyroHeadingService] Stopped');
  }

  /**
   * Get the current fused heading.
   * @returns {number} degrees 0–360
   */
  getHeading() {
    return this.fusedHeading;
  }
}

const gyroHeadingService = new GyroHeadingService();
export default gyroHeadingService;
