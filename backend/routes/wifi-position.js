const express = require('express');
const router = express.Router();
const WiFiFingerprint = require('../models/WiFiFingerprint');

// ─────────────────────────────────────────────────────────────────────────────
//  POST /wifi-position
//  Estimates user's indoor position from a live WiFi RSSI fingerprint scan.
//
//  Algorithm: Weighted k-Nearest Neighbour (k-NN)
//    1. Load all stored fingerprints for the campus
//    2. For each stored fingerprint, compute a "distance" to the live scan
//       using Signal Space Distance (SSD):
//         SSD = sqrt(sum of (rssi_live - rssi_stored)^2 for matching BSSIDs)
//    3. Select k=3 closest fingerprints
//    4. Weighted average of their GPS coordinates (weight = 1/SSD)
//    5. Return estimated {lat, lng, floorId, confidence}
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { campusId, fingerprint } = req.body;

    if (!campusId || !fingerprint || !Array.isArray(fingerprint) || fingerprint.length === 0) {
      return res.status(400).json({ success: false, error: 'campusId and fingerprint array required' });
    }

    // Build a BSSID → RSSI lookup from the live scan for fast comparison
    const liveScan = {};
    fingerprint.forEach(({ bssid, rssi }) => {
      if (bssid) liveScan[bssid.toUpperCase()] = rssi;
    });

    const liveKeys = Object.keys(liveScan);
    if (liveKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid BSSID entries in fingerprint' });
    }

    // Load campus fingerprints (limit to 2000 to keep response fast)
    const storedFingerprints = await WiFiFingerprint.find({ campusId })
      .select('lat lng floorId blockName signals')
      .limit(2000)
      .lean();

    if (storedFingerprints.length === 0) {
      return res.json({
        success: false,
        error: 'No WiFi fingerprints recorded for this campus yet. Run a WiFi survey first.',
      });
    }

    // ── Compute Signal Space Distance (SSD) for each stored fingerprint ──
    const scored = storedFingerprints.map(fp => {
      const storedScan = {};
      (fp.signals || []).forEach(s => {
        storedScan[s.bssid.toUpperCase()] = s.rssi;
      });

      // Only compare BSSIDs that appear in BOTH scans (intersection)
      const commonBSSIDs = liveKeys.filter(b => storedScan[b] !== undefined);

      if (commonBSSIDs.length === 0) {
        return { fp, ssd: Infinity, commonCount: 0 };
      }

      // Signal Space Distance (Euclidean in RSSI space)
      let sumSq = 0;
      commonBSSIDs.forEach(b => {
        const diff = (liveScan[b] || -100) - (storedScan[b] || -100);
        sumSq += diff * diff;
      });
      const ssd = Math.sqrt(sumSq / commonBSSIDs.length); // normalize by count

      return { fp, ssd, commonCount: commonBSSIDs.length };
    });

    // Filter out records with no common BSSIDs and sort by SSD ascending
    const valid = scored
      .filter(s => s.ssd !== Infinity && s.commonCount >= 1)
      .sort((a, b) => a.ssd - b.ssd);

    if (valid.length === 0) {
      return res.json({ success: false, error: 'No matching WiFi fingerprints found' });
    }

    // ── k-NN: take k=3 closest, weighted average ──
    const k = Math.min(3, valid.length);
    const topK = valid.slice(0, k);

    let weightSum = 0;
    let latSum = 0;
    let lngSum = 0;
    const floorVotes = {};

    topK.forEach(({ fp, ssd }) => {
      // Weight = 1/SSD (closer fingerprint = more influence)
      // Add small epsilon to avoid division by zero if SSD=0 (exact match)
      const weight = 1 / (ssd + 0.1);
      weightSum += weight;
      latSum += fp.lat * weight;
      lngSum += fp.lng * weight;

      // Vote for floor based on weighted contribution
      const floorKey = fp.floorId?.toString() || 'unknown';
      floorVotes[floorKey] = (floorVotes[floorKey] || 0) + weight;
    });

    const estimatedLat = latSum / weightSum;
    const estimatedLng = lngSum / weightSum;

    // Pick the floor with highest vote weight
    const bestFloorId = Object.entries(floorVotes)
      .sort((a, b) => b[1] - a[1])[0][0];

    // ── Confidence: based on best SSD score ──
    // SSD=0 → perfect match → confidence 1.0
    // SSD=10 → very noisy → confidence 0.3
    const bestSSD = topK[0].ssd;
    const confidence = Math.max(0.1, Math.min(0.98, 1 - bestSSD / 25));

    return res.json({
      success: true,
      position: {
        lat: estimatedLat,
        lng: estimatedLng,
        floorId: bestFloorId !== 'unknown' ? bestFloorId : null,
        confidence,
        matchedCount: topK.length,
        bestSSD: Math.round(bestSSD * 10) / 10,
      },
    });

  } catch (err) {
    console.error('[WiFi Position] Error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /wifi-position/record
//  Admin endpoint: record a new WiFi fingerprint at a known GPS location.
//  Called by the admin survey tool during campus walkthrough.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/record', async (req, res) => {
  try {
    const { campusId, floorId, lat, lng, signals, blockName } = req.body;

    if (!campusId || !lat || !lng || !signals?.length) {
      return res.status(400).json({ success: false, error: 'campusId, lat, lng, signals required' });
    }

    const fp = await WiFiFingerprint.create({
      campusId,
      floorId: floorId || null,
      lat,
      lng,
      blockName: blockName || null,
      signals: signals.map(s => ({
        bssid: s.bssid.toUpperCase(),
        ssid: s.ssid || '',
        rssi: s.rssi,
      })),
    });

    res.json({ success: true, id: fp._id, message: 'Fingerprint recorded successfully' });
  } catch (err) {
    console.error('[WiFi Record] Error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /wifi-position/stats/:campusId
//  Returns summary of recorded fingerprints for a campus.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/:campusId', async (req, res) => {
  try {
    const count = await WiFiFingerprint.countDocuments({ campusId: req.params.campusId });
    const byFloor = await WiFiFingerprint.aggregate([
      { $match: { campusId: new (require('mongoose').Types.ObjectId)(req.params.campusId) } },
      { $group: { _id: '$floorId', count: { $sum: 1 } } },
    ]);
    res.json({ success: true, totalFingerprints: count, byFloor });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
