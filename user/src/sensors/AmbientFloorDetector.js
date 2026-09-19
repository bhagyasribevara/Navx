import { Barometer } from 'expo-sensors';

/**
 * AmbientFloorDetector — Works WITHOUT navigation or admin setup.
 *
 * Uses the device barometer to continuously detect the user's current floor
 * by tracking altitude change from a baseline. Works anywhere, anytime.
 *
 * Algorithm:
 *   1. First reading = baseline (ground floor, level 0)
 *   2. Subsequent readings → deltaAlt = current - baseline
 *   3. floorIndex = round(deltaAlt / 3.5)   (3.5m per floor)
 *   4. altitude = floorIndex * 3.5 + 1.5    (1.5m = eye level)
 *
 * iOS: uses relativeAltitude directly (very accurate, sub-meter)
 * Android: uses hypsometric formula from pressure (accurate ±0.5 floor)
 *
 * Does NOT need WiFi, BLE, admin survey, or any external hardware.
 * Uses only the barometer chip built into every modern smartphone.
 */
class AmbientFloorDetector {
  constructor() {
    this.subscription = null;
    this.isRunning = false;
    this.baseAltitude = null;         // Set on first reading (= ground floor)
    this.baseRelativeAlt = null;      // iOS: relativeAltitude baseline
    this.basePressure = null;         // Android: pressure baseline
    this.currentFloorIndex = 0;
    this.currentAltitudeMeters = 0;   // Absolute altitude above ground (meters)
    this.buffer = [];
    this._onFloorChange = null;
    this._lastReportedFloor = null;
    this._pendingKnownFloor = null;
    this._floorCandidate = null;
    this._candidateCount = 0;
    this._onAltitudeChange = null;
  }

  /**
   * Set continuous filtered altitude callback (meters above ground).
   * @param {function} callback - called with altitudeMeters
   */
  setOnAltitudeChange(callback) {
    this._onAltitudeChange = callback;
  }

  /**
   * Check if barometer is available.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      return await Barometer.isAvailableAsync();
    } catch (e) {
      return false;
    }
  }

  /**
   * Start ambient floor detection.
   * @param {function} onFloorChange - called with { floorIndex, altitudeMeters }
   *   floorIndex: 0 = ground, 1 = 1st floor, 2 = 2nd floor, etc.
   *   altitudeMeters: actual meters above ground floor baseline
   */
  start(onFloorChange) {
    if (this.isRunning) this.stop();
    this._onFloorChange = onFloorChange;

    Barometer.setUpdateInterval(500);

    this.subscription = Barometer.addListener((data) => {
      const { pressure, relativeAltitude } = data;
      const timestamp = Date.now();

      this.buffer.push({ pressure, relativeAltitude, timestamp });
      if (this.buffer.length > 30) this.buffer.shift(); // 15-second rolling buffer

      // Apply any pending known floor sync now that we have data
      if (this._pendingKnownFloor !== null) {
        const floorToSet = this._pendingKnownFloor;
        this._pendingKnownFloor = null;
        this.setKnownFloor(floorToSet);
        return;
      }

      // ── iOS path: use native relativeAltitude ──
      if (relativeAltitude !== undefined && relativeAltitude !== null) {
        if (this.baseRelativeAlt === null) {
          this.baseRelativeAlt = relativeAltitude;
          this.baseAltitude = relativeAltitude;
        }
        const deltaAlt = relativeAltitude - this.baseRelativeAlt;
        this._updateFromDelta(deltaAlt);
        return;
      }

      // ── Android path: compute altitude from pressure ──
      if (pressure !== undefined && pressure !== null) {
        if (this.basePressure === null) {
          this.basePressure = pressure;
        }
        // Hypsometric formula: ΔAlt = 44330 × (1 - (P/P₀)^0.19)
        const deltaAlt = 44330 * (1 - Math.pow(pressure / this.basePressure, 0.19));
        this._updateFromDelta(deltaAlt);
      }
    });

    this.isRunning = true;
    console.log('[AmbientFloorDetector] Started — tracking floor from barometer');
  }

  /**
   * Reset baseline to current position (= "I am on ground floor right now")
   * Call this when user confirms they're on ground floor (e.g. entering campus).
   */
  resetBaseline() {
    this.setKnownFloor(0);
  }

  /**
   * Sync the barometer baseline to a known floor index.
   * Useful when the user calibrates via QR code on a specific floor.
   * @param {number} floorIndex 
   */
  setKnownFloor(floorIndex) {
    if (this.buffer.length === 0) {
      // If no reading yet, save it as pending
      this._pendingKnownFloor = floorIndex;
      console.log(`[AmbientFloorDetector] Saved pending known floor ${floorIndex}`);

      // Still update the UI instantly so the marker jumps up
      const knownDeltaAlt = floorIndex * 3.5;
      this.currentFloorIndex = floorIndex;
      this.currentAltitudeMeters = knownDeltaAlt + 1.5;
      this._lastReportedFloor = floorIndex;
      if (this._onFloorChange) {
        this._onFloorChange({ floorIndex: this.currentFloorIndex, altitudeMeters: this.currentAltitudeMeters });
      }
      return;
    }

    const latest = this.buffer[this.buffer.length - 1];
    const knownDeltaAlt = floorIndex * 3.5;

    if (latest.relativeAltitude !== undefined) {
      // iOS: base = current - delta
      this.baseRelativeAlt = latest.relativeAltitude - knownDeltaAlt;
    } else if (latest.pressure !== undefined) {
      // Android: base = current / ( (1 - delta/44330)^(1/0.19) )
      const ratio = Math.pow(1 - knownDeltaAlt / 44330, 1 / 0.19);
      this.basePressure = latest.pressure / ratio;
    }

    this.currentFloorIndex = floorIndex;
    this.currentAltitudeMeters = knownDeltaAlt + 1.5;
    this._lastReportedFloor = floorIndex;
    this._floorCandidate = null;
    this._candidateCount = 0;
    this._ema = knownDeltaAlt; // reset smoother

    if (this._onFloorChange) {
      this._onFloorChange({ floorIndex: this.currentFloorIndex, altitudeMeters: this.currentAltitudeMeters });
    }
    console.log(`[AmbientFloorDetector] Baseline synced to floor ${floorIndex}`);
  }

  _updateFromDelta(deltaAlt) {
    // Smooth: use exponential moving average to reduce high-frequency barometric noise
    const smoothedDelta = this._smoothedDelta(deltaAlt);

    // Calibrated floor threshold mapping:
    // Floor height constant H = 3.5m.
    // Ground Floor: slab = 0m, phone at chest level ~1.3m -> deltaAlt < 2.2m
    // Floor 1: slab = 3.5m, phone at chest level ~4.8m -> 2.2m <= deltaAlt < 5.7m
    // Floor 2: slab = 7.0m, phone at chest level ~8.3m -> 5.7m <= deltaAlt < 9.2m
    // Floor k: [k * 3.5 - 1.3, (k + 1) * 3.5 - 1.3)
    let candidate = 0;
    if (smoothedDelta >= 2.2) {
      candidate = Math.floor((smoothedDelta - 2.2) / 3.5) + 1;
    }
    candidate = Math.max(0, candidate);

    // Hysteresis: require 3 consecutive identical candidate readings to change floor,
    // completely eliminating boundary fluttering and transient pressure spikes.
    if (candidate !== this.currentFloorIndex) {
      if (this._floorCandidate === candidate) {
        this._candidateCount++;
        if (this._candidateCount >= 3) {
          this.currentFloorIndex = candidate;
          this._floorCandidate = null;
          this._candidateCount = 0;
        }
      } else {
        this._floorCandidate = candidate;
        this._candidateCount = 1;
      }
    } else {
      this._floorCandidate = null;
      this._candidateCount = 0;
    }

    const altitudeMeters = Math.max(0, smoothedDelta + 1.5);
    this.currentAltitudeMeters = altitudeMeters;

    // Continuous filtered altitude callback for diagnostics and confirmation
    if (this._onAltitudeChange) {
      this._onAltitudeChange(altitudeMeters);
    }

    // Fire callback when floor index changes
    if (this._lastReportedFloor !== this.currentFloorIndex) {
      this._lastReportedFloor = this.currentFloorIndex;
      if (this._onFloorChange) {
        this._onFloorChange({
          floorIndex: this.currentFloorIndex,
          altitudeMeters,
        });
      }
    }
  }

  _smoothedDelta(latestDelta) {
    // Use a simple exponential moving average to reduce sensor noise
    if (!this._ema) this._ema = latestDelta;
    this._ema = 0.3 * latestDelta + 0.7 * this._ema;
    return this._ema;
  }

  /**
   * Get current floor index synchronously.
   * @returns {number} 0 = ground, 1 = 1st floor, etc.
   */
  getFloorIndex() {
    return this.currentFloorIndex;
  }

  /**
   * Get current altitude above ground in meters.
   * Used directly as the 3D map marker height.
   * @returns {number}
   */
  getAltitudeMeters() {
    return this.currentAltitudeMeters;
  }

  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;
    this.buffer = [];
    this._ema = null;
    this._floorCandidate = null;
    this._candidateCount = 0;
    this._onAltitudeChange = null;
    console.log('[AmbientFloorDetector] Stopped');
  }
}

const ambientFloorDetector = new AmbientFloorDetector();
export default ambientFloorDetector;
