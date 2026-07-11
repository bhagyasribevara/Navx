const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  title: { type: String, required: true }, // e.g. "Tuition Fee"
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date, default: null },
  transactionId: { type: String, default: null },
  paymentMethod: { type: String, default: null }
}, { timestamps: true });

feeSchema.index({ studentId: 1 });

module.exports = mongoose.model('Fee', feeSchema);
