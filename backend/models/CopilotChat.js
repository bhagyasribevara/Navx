const mongoose = require('mongoose');

const copilotChatSchema = new mongoose.Schema({
  adminId: { type: String, required: true, index: true },
  campusId: { type: mongoose.Schema.Types.Mixed, default: null },
  history: [
    {
      role: { type: String, enum: ['user', 'ai', 'model'], required: true },
      text: { type: String, default: '' },
      image: { type: String, default: null },
      proposedAction: { type: mongoose.Schema.Types.Mixed, default: null },
      planDetails: { type: mongoose.Schema.Types.Mixed, default: null },
      actionStatus: { type: String, enum: ['pending', 'accepted', 'rejected'], default: null },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

copilotChatSchema.index({ adminId: 1 });

module.exports = mongoose.model('CopilotChat', copilotChatSchema);
