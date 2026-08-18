const mongoose = require('mongoose');

const DigitalTwinSchema = new mongoose.Schema({
  building: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'SpatialScanSession' },
  startPoint: { x: Number, y: Number, heading: Number },
  endPoint: { x: Number, y: Number, heading: Number },
  wallColorTop: { type: String, default: '#f6f6eb' },       // Cream / Off-white
  wallColorBottom: { type: String, default: '#b8aa8f' },    // Sandstone / Beige dado
  floorMaterial: { type: String, default: 'terrazzo_mosaic' },
  floorColor: { type: String, default: '#dcd6cc' },
  corridorWidth: { type: Number, default: 2.2 },
  corridorHeight: { type: Number, default: 2.8 },
  walls: [{
    start: { x: Number, y: Number, z: Number },
    end: { x: Number, y: Number, z: Number },
    height: { type: Number, default: 2.8 },
    thickness: { type: Number, default: 0.18 },
    colorTop: { type: String, default: '#f6f6eb' },
    colorBottom: { type: String, default: '#b8aa8f' }
  }],
  doors: [{
    position: { x: Number, y: Number, z: Number },
    width: { type: Number, default: 1.1 },
    height: { type: Number, default: 2.2 },
    roomNumber: { type: String, default: '301' },
    isOpen: { type: Boolean, default: true }
  }],
  detectedRooms: [{
    roomNumber: String,
    roomName: String,
    confidence: Number,
    position: { x: Number, y: Number, z: Number },
    dimensions: {
      width: { type: Number, default: 3.0 },
      length: { type: Number, default: 4.0 },
      height: { type: Number, default: 2.8 }
    },
    materials: {
      wall: { type: String, default: 'drywall' },
      floor: { type: String, default: 'carpet' },
      door: { type: String, default: 'glass' }
    }
  }],
  landmarks: [{
    type: { type: String }, // 'exit_sign', 'switch', 'fire_extinguisher'
    label: String,
    position: { x: Number, y: Number, z: Number }
  }],
  rooms: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    boundaries: [{ x: Number, y: Number, z: Number }]
  }],
  scannedElements: [{
    id: String,
    name: String,
    type: { type: String, enum: ['room', 'corridor'] },
    geometry3D: {
      dimensions: {
        width: { type: Number, default: 3.0 },
        length: { type: Number, default: 4.0 },
        height: { type: Number, default: 2.8 }
      },
      position: { x: Number, y: Number, z: Number },
      rotation: { x: Number, y: Number, z: Number },
      vertices: [{ x: Number, y: Number, z: Number }],
      faces: [[Number]],
      color: String
    },
    worldMatrix: [Number],
    status: { type: String, enum: ['unplaced', 'placed'], default: 'unplaced' }
  }],
  placedComponents: [{
    id: String,
    name: String,
    type: { type: String, enum: ['room', 'corridor'] },
    position: { x: Number, y: Number, z: Number },
    rotation: { x: Number, y: Number, z: Number },
    scale: { x: Number, y: Number, z: Number },
    dimensions: { width: Number, length: Number, height: Number },
    color: String,
    worldMatrix: [Number]
  }],
  lastUpdated: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('DigitalTwin', DigitalTwinSchema);
