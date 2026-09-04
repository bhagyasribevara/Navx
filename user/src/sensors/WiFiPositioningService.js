import api from '../api';

/**
 * WiFiPositioningService — Indoor positioning using campus WiFi Access Points as free beacons.
 *
 * How it works:
 *   1. Phone's WiFi radio scans visible networks (BSSID + RSSI) without connecting
 *   2. Sends the fingerprint to the backend POST /wifi-position
 *   3. Backend runs k-NN matching against pre-recorded radio map
 *   4. Returns estimated { lat, lng, floorId, confidence }
 *   5. PositionEngine applies it as a drift correction (same as BLE would have)
 *
 * Platform notes:
 *   - Android: Full WiFi scanning available via NetInfo / native API
 *   - iOS: Apple restricts BSSID access. Service returns null on iOS gracefully.
 *
 * NOTE: This service requires react-native-wifi-reborn for production scanning.
 * For Expo Go / development, it uses the backend mock fingerprint matching.
 */
class WiFiPositioningService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this._onPosition = null;
    this.lastResult = null;
    this.scanIntervalMs = 5000; // scan every 5 seconds
  }

  /**
   * Check if WiFi positioning is available on this platform.
   * Currently Android-only for BSSID scanning.
   * @returns {boolean}
   */
  isAvailable() {
    // react-native-wifi-reborn is Android only for BSSID
    try {
      // If the native module exists, WiFi scanning is available
      const WifiManager = require('react-native-wifi-reborn').default;
      return !!WifiManager;
    } catch (e) {
      return false;
    }
  }

  /**
   * Perform a single WiFi scan and return estimated position from backend.
   * @param {string} campusId
   * @returns {Promise<{lat, lng, floorId, confidence} | null>}
   */
  async scanOnce(campusId) {
    try {
      let wifiNetworks = [];

      // Try native WiFi scanning (Android, requires react-native-wifi-reborn)
      try {
        const WifiManager = require('react-native-wifi-reborn').default;
        const networks = await WifiManager.loadWifiList();
        wifiNetworks = (networks || []).map(n => ({
          bssid: n.BSSID,
          ssid: n.SSID,
          rssi: n.level,
        }));
      } catch (wifiErr) {
        // WiFi scanning not available (iOS or missing module) — skip silently
        return null;
      }

      if (wifiNetworks.length === 0) return null;

      // Send fingerprint to backend for k-NN matching
      const response = await api.post('/wifi-position', {
        campusId,
        fingerprint: wifiNetworks,
      });

      if (response.data?.success && response.data?.position) {
        this.lastResult = response.data.position;
        return response.data.position; // { lat, lng, floorId, confidence }
      }
      return null;
    } catch (err) {
      console.warn('[WiFiPositioningService] Scan failed:', err?.message);
      return null;
    }
  }

  /**
   * Start periodic WiFi scanning.
   * @param {string} campusId
   * @param {function} onPosition - called with { lat, lng, floorId, confidence }
   */
  start(campusId, onPosition) {
    if (this.isRunning) this.stop();
    this._onPosition = onPosition;
    this.isRunning = true;

    // Initial scan immediately
    this.scanOnce(campusId).then(pos => {
      if (pos && this._onPosition) this._onPosition(pos);
    });

    // Periodic scan
    this.intervalId = setInterval(async () => {
      const pos = await this.scanOnce(campusId);
      if (pos && this._onPosition) this._onPosition(pos);
    }, this.scanIntervalMs);

    console.log('[WiFiPositioningService] Started periodic WiFi scanning');
  }

  /**
   * Stop periodic scanning.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[WiFiPositioningService] Stopped');
  }
}

const wifiPositioningService = new WiFiPositioningService();
export default wifiPositioningService;
