# AI Skill - Creating a Mongoose Database Model

This guide describes how to design and register a new Mongoose collection model in the database layer.

---

## Step 1: Define Model File
Save all schema configurations under `backend/models/`. Use the template:
```javascript
const mongoose = require('mongoose');

const beaconSchema = new mongoose.Schema({
  campusId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Campus', 
    required: true 
  },
  uuid: { type: String, required: true },
  major: { type: Number, required: true },
  minor: { type: Number, required: true },
  label: { type: String, default: '' },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for query optimization
beaconSchema.index({ campusId: 1 });

module.exports = mongoose.model('Beacon', beaconSchema);
```

---

## Step 2: Configure Indices
- Always index foreign references like `campusId`, `blockId`, or `floorId` to maximize query planning speed.
- If field query maps lookups, apply sparse compound indices where appropriate.

---

## Step 3: Reference Relations
- Document link references using `type: mongoose.Schema.Types.ObjectId` and provide the correct model target matching string in the `ref` key to permit populations.
