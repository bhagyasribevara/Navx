const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  uploadedByName: { type: String, required: true }
}, { timestamps: true });

studyMaterialSchema.index({ campusId: 1, department: 1, semester: 1 });

module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
