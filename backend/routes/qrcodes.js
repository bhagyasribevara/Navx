const router = require('express').Router();
const QRCode = require('../models/QRCode');
const Floor = require('../models/Floor');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all QR codes (filter by floorId, campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    const qrcodes = await QRCode.find(filter);
    res.json(qrcodes);
  } catch (err) {
    next(err);
  }
});

// GET QR code by code string (for mobile scanning - public)
router.get('/scan/:code', async (req, res, next) => {
  try {
    const qr = await QRCode.findOne({ code: req.params.code, isActive: true })
      .populate('floorId', 'name level blockId')
      .populate('blockId', 'name campusId')
      .populate('nearestNodeId');
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    res.json(qr);
  } catch (err) {
    next(err);
  }
});

// POST create QR code
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    if (!req.body.code) {
      req.body.code = `NAVX-${uuidv4().substring(0, 8).toUpperCase()}`;
    }
    // Pre-generate QR code image and save it in document
    req.body.image = await qrcode.toDataURL(req.body.code, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    const qr = new QRCode(req.body);
    await qr.save();
    res.status(201).json(qr);
  } catch (err) {
    console.error('❌ QR Create Error:', err.message, '| Body:', JSON.stringify(req.body, null, 2));
    res.status(400).json({ error: err.message });
  }
});

// GET generate QR image for printing
router.get('/:id/image', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const qr = await QRCode.findById(req.params.id);
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    
    let qrDataUrl = qr.image;
    if (!qrDataUrl) {
      qrDataUrl = await qrcode.toDataURL(qr.code, {
        width: 300,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' }
      });
      qr.image = qrDataUrl;
      await qr.save();
    }
    
    res.json({ 
      code: qr.code, 
      label: qr.label,
      image: qrDataUrl 
    });
  } catch (err) {
    next(err);
  }
});

// GET export all QR codes for a floor as printable (Admin only)
router.get('/export/:floorId', authenticateJWT, async (req, res, next) => {
  try {
    const floor = await Floor.findById(req.params.floorId);
    if (!floor) return res.status(404).json({ error: 'Floor not found' });
    
    // Check campus level authorization
    if (req.admin.role !== 'SuperAdmin' && floor.campusId.toString() !== req.admin.campusId.toString()) {
      return res.status(403).json({ error: 'Access Denied: Floor belongs to another campus.' });
    }

    const qrcodes = await QRCode.find({ floorId: req.params.floorId, isActive: true });
    const results = await Promise.all(qrcodes.map(async (qr) => {
      let image = qr.image;
      if (!image) {
        image = await qrcode.toDataURL(qr.code, {
          width: 300, margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' }
        });
        qr.image = image;
        await qr.save();
      }
      return { code: qr.code, label: qr.label, position: qr.position, image };
    }));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// PUT update QR code
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    const qr = await QRCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    res.json(qr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE QR code
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res, next) => {
  try {
    await QRCode.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'QR code deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
