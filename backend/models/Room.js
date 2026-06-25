const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: [
      // Campus types
      'classroom', 'office', 'lab', 'restroom', 'cafeteria', 'library', 
      'auditorium', 'elevator', 'stairs', 'corridor', 'entrance', 'exit', 'bus_stop', 'other',
      // Hospital types
      'ward', 'icu', 'ot', 'pharmacy', 'reception', 'emergency', 'radiology',
      'pathology', 'blood_bank', 'consultation', 'waiting_area', 'nursing_station',
      // Airport types
      'gate', 'terminal', 'check_in', 'security', 'lounge', 'baggage_claim',
      'immigration', 'duty_free', 'boarding', 'customs',
      // Mall types
      'store', 'food_court', 'anchor_store', 'kiosk', 'parking',
      'entertainment', 'atm', 'customer_service', 'fitting_room',
      // Building types (generic large building)
      'conference', 'server_room', 'lobby', 'mail_room', 'gym',
      'rooftop', 'storage', 'utility', 'break_room', 'reception_desk'
    ],
    default: 'other' 
  },
  roomNumber: { type: String, default: '' },
  description: { type: String, default: '' },
  shape: {
    type: { type: String, enum: ['rectangle', 'polygon', 'circle'], default: 'rectangle' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 80 },
    height: { type: Number, default: 60 },
    radius: { type: Number, default: 0 },
    points: [{ x: Number, y: Number }],
    rotation: { type: Number, default: 0 },
    fill: { type: String, default: '#E8F4FD' },
    stroke: { type: String, default: '#4A90D9' },
    strokeWidth: { type: Number, default: 1 },
    opacity: { type: Number, default: 1 }
  },
  capacity: { type: Number, default: 0 },
  amenities: [String],
  accessible: { type: Boolean, default: true },
  excludedFloors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Floor' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

roomSchema.index({ floorId: 1 });
roomSchema.index({ blockId: 1 });
roomSchema.index({ campusId: 1 });
roomSchema.index({ name: 'text', roomNumber: 'text', description: 'text' });

module.exports = mongoose.model('Room', roomSchema);
