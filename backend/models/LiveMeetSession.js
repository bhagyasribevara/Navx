const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
  heading: { type: Number, default: 0 },
  speed: { type: Number, default: 0 }
}, { _id: false });

const LiveMeetSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  creatorDevice: { type: String, required: true }, // Device ID or unique identifier for User A
  joinerDevice: { type: String }, // Device ID for User B
  
  creatorName: { type: String, default: 'Host' },
  joinerName: { type: String, default: 'Friend' },

  creatorLocation: LocationSchema,
  joinerLocation: LocationSchema,

  destinationLabel: { type: String },
  destinationLocation: LocationSchema,

  status: { 
    type: String, 
    enum: ['waiting', 'active', 'arrived', 'cancelled', 'expired'], 
    default: 'waiting' 
  },
  
  durationMinutes: { type: Number, default: 30 },
  expiresAt: { type: Date, required: true, index: { expires: '1m' } }, // MongoDB TTL Index deletes the doc 1 min after expiresAt
}, { timestamps: true });

module.exports = mongoose.model('LiveMeetSession', LiveMeetSessionSchema);
