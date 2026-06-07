// Indoor positioning fusion engine
// Combines QR, BLE, and motion sensors for accurate indoor positioning

const STEP_LENGTH = 0.7; // Average step length in meters
const PIXEL_PER_METER = 20; // Scale factor

export class PositionEngine {
  constructor() {
    this.position = { x: 0, y: 0, floor: null };
    this.heading = 0; // degrees
    this.isCalibrated = false;
    this.lastQRTime = 0;
    this.stepCount = 0;
    this.listeners = [];
    this.bleBeacons = [];
    this.driftCorrection = { x: 0, y: 0 };
  }

  // Subscribe to position updates
  onPositionUpdate(callback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  notify() {
    this.listeners.forEach(cb => cb({ ...this.position, heading: this.heading }));
  }

  // QR Code positioning - highest accuracy, acts as anchor
  setPositionFromQR(x, y, floorId) {
    this.position = { x, y, floor: floorId };
    this.isCalibrated = true;
    this.lastQRTime = Date.now();
    this.driftCorrection = { x: 0, y: 0 };
    this.stepCount = 0;
    this.notify();
    return this.position;
  }

  // Motion sensor tracking (dead reckoning with GPS scale conversion)
  processStep(heading) {
    if (!this.isCalibrated) return;

    this.heading = heading;
    this.stepCount++;

    const radians = (heading * Math.PI) / 180;

    // Convert step size (0.7m) to GPS degrees
    // 1 degree of Latitude ≈ 111,320 meters
    const metersPerLatDegree = 111320;
    const currentLat = this.position.x || 18.4665;
    // 1 degree of Longitude depends on the latitude
    const metersPerLngDegree = 111320 * Math.cos((currentLat * Math.PI) / 180);

    const dLat = (STEP_LENGTH * Math.cos(radians)) / metersPerLatDegree;
    const dLng = (STEP_LENGTH * Math.sin(radians)) / metersPerLngDegree;

    // Apply displacement
    this.position.x += dLat + this.driftCorrection.x;
    this.position.y += dLng + this.driftCorrection.y;

    // Reset drift correction after applying
    this.driftCorrection = { x: 0, y: 0 };

    this.notify();
  }

  // Fused GPS Update - blends GPS coordinate to correct sensor drift and filter noise
  processGPSUpdate(lat, lng, accuracy = 15) {
    if (!this.isCalibrated) {
      this.position = { ...this.position, x: lat, y: lng };
      this.isCalibrated = true;
      this.notify();
      return;
    }

    // Dynamic weight based on GPS accuracy radius
    // Indoors, accuracy > 25m is common and should be ignored to prevent jumping
    let weight = 0.15;
    if (accuracy > 25) {
      weight = 0.0;  // Ignore completely, trust Dead Reckoning / Sensors
    } else if (accuracy > 15) {
      weight = 0.05; // Lightly pull towards GPS
    } else if (accuracy <= 5) {
      weight = 0.3;  // Strong GPS lock, trust heavily
    }

    if (weight > 0) {
      this.position.x = this.position.x * (1 - weight) + lat * weight;
      this.position.y = this.position.y * (1 - weight) + lng * weight;
    }
    this.notify();
  }

  // Update heading from compass
  updateHeading(heading) {
    this.heading = heading;
  }

  // BLE Beacon positioning - correction & accuracy improvement
  setBLEBeacons(beacons) {
    this.bleBeacons = beacons;
  }

  processBLESignals(signals) {
    // signals: [{ beaconId, rssi }]
    if (!this.isCalibrated || this.bleBeacons.length < 3) return;

    // Calculate distances from RSSI
    const beaconsWithDist = signals
      .map(sig => {
        const beacon = this.bleBeacons.find(b => b.beaconId === sig.beaconId);
        if (!beacon) return null;
        const distance = this.rssiToDistance(sig.rssi, beacon.calibration || {});
        return { ...beacon, distance };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // Use 3 closest beacons

    if (beaconsWithDist.length >= 3) {
      const estimated = this.trilaterate(beaconsWithDist);
      if (estimated) {
        // Apply as drift correction (weighted blend)
        const weight = 0.3; // BLE correction weight
        this.driftCorrection = {
          x: (estimated.x - this.position.x) * weight,
          y: (estimated.y - this.position.y) * weight
        };
      }
    }
  }

  rssiToDistance(rssi, calibration = {}) {
    const txPower = calibration.rssiAt1m || -59;
    const n = calibration.pathLossExponent || 2.0;
    return Math.pow(10, (txPower - rssi) / (10 * n));
  }

  trilaterate(beacons) {
    if (beacons.length < 3) return null;

    const [b1, b2, b3] = beacons;
    const x1 = b1.position.x, y1 = b1.position.y, r1 = b1.distance * PIXEL_PER_METER;
    const x2 = b2.position.x, y2 = b2.position.y, r2 = b2.distance * PIXEL_PER_METER;
    const x3 = b3.position.x, y3 = b3.position.y, r3 = b3.distance * PIXEL_PER_METER;

    const A = 2 * (x2 - x1);
    const B = 2 * (y2 - y1);
    const C = r1 * r1 - r2 * r2 - x1 * x1 + x2 * x2 - y1 * y1 + y2 * y2;
    const D = 2 * (x3 - x2);
    const E = 2 * (y3 - y2);
    const F = r2 * r2 - r3 * r3 - x2 * x2 + x3 * x3 - y2 * y2 + y3 * y3;

    const denom = A * E - B * D;
    if (Math.abs(denom) < 0.001) return null;

    return {
      x: (C * E - F * B) / denom,
      y: (A * F - C * D) / denom
    };
  }

  // Get time since last QR calibration
  getTimeSinceCalibration() {
    return Date.now() - this.lastQRTime;
  }

  // Get accuracy estimate
  getAccuracyEstimate() {
    if (!this.isCalibrated) return 'unknown';
    const timeSinceQR = this.getTimeSinceCalibration();
    if (timeSinceQR < 10000) return 'high';
    if (timeSinceQR < 60000 && this.stepCount < 50) return 'medium';
    return 'low';
  }

  reset() {
    this.position = { x: 0, y: 0, floor: null };
    this.heading = 0;
    this.isCalibrated = false;
    this.stepCount = 0;
    this.driftCorrection = { x: 0, y: 0 };
  }
}

// Step detection from accelerometer data
export class StepDetector {
  constructor(onStep) {
    this.onStep = onStep;
    this.lastMagnitude = 0;
    this.threshold = 1.2;
    this.lastStepTime = 0;
    this.minStepInterval = 300; // ms
    this.samples = [];
    this.windowSize = 10;
  }

  processAccelerometer(x, y, z) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    this.samples.push(magnitude);
    if (this.samples.length > this.windowSize) this.samples.shift();

    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const now = Date.now();

    // Peak detection
    if (
      magnitude > avg + this.threshold &&
      this.lastMagnitude <= avg + this.threshold &&
      now - this.lastStepTime > this.minStepInterval
    ) {
      this.lastStepTime = now;
      this.onStep();
    }

    this.lastMagnitude = magnitude;
  }
}
