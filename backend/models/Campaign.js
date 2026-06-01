const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  // Sub-campaign support: if parentId is set, this is a sub-event of that parent campaign
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  subCampaignType: { type: String }, // e.g. "tech", "non-tech", "cultural", "workshop"
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
