const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
  destination: {
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
    floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
