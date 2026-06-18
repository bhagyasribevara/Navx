const mongoose = require('mongoose');

const copilotChatSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
  history: { type: Array, default: [] },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

copilotChatSchema.index({ adminId: 1 });

module.exports = mongoose.model('CopilotChat', copilotChatSchema);
