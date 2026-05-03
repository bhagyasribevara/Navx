const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['SuperAdmin', 'CampusAdmin'], default: 'CampusAdmin' },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' } // Only for CampusAdmin
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
