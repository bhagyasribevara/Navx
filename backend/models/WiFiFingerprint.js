const mongoose = require('mongoose');

/**
 * WiFiFingerprint — Stores a single WiFi radio map observation.
 * Recorded by an admin walking the campus with the survey tool.
 *
 * Each document = one point in space with its observed WiFi network signals.
 * The k-NN matching algorithm finds the k closest fingerprints to the user's
 * live scan and estimates position as the weighted average of their coordinates.
 */
const WiFiFingerprintSchema = new mongoose.Schema({
  campusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    required: true,
    index: true,
  },
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    default: null,
  },
  // Ground truth GPS coordinates at time of recording
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },

  // Optional: room/block context for richer positioning
  blockId: { type: String, default: null },
  blockName: { type: String, default: null },

  // WiFi signal observations at this point
  // Each entry: { bssid: "AA:BB:CC:DD:EE:FF", ssid: "CAMPUS_WIFI", rssi: -65 }
  signals: [
    {
      bssid: { type: String, required: true },
      ssid: { type: String, default: '' },
      rssi: { type: Number, required: true }, // dBm, typically -30 to -90
    }
  ],

  // Metadata
  recordedBy: { type: String, default: 'admin' },
  recordedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Compound index for efficient campus-scoped k-NN lookups
WiFiFingerprintSchema.index({ campusId: 1, floorId: 1 });

module.exports = mongoose.model('WiFiFingerprint', WiFiFingerprintSchema);
