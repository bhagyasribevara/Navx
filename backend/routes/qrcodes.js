const router = require('express').Router();
const QRCode = require('../models/QRCode');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// GET all QR codes (filter by floorId, campusId)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    const qrcodes = await QRCode.find(filter);
    res.json(qrcodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET QR code by code string (for mobile scanning)
router.get('/scan/:code', async (req, res) => {
  try {
    const qr = await QRCode.findOne({ code: req.params.code, isActive: true })
      .populate('floorId', 'name level blockId')
      .populate('blockId', 'name campusId')
      .populate('nearestNodeId');
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    res.json(qr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create QR code
router.post('/', async (req, res) => {
  try {
    if (!req.body.code) {
      req.body.code = `NAVX-${uuidv4().substring(0, 8).toUpperCase()}`;
    }
    const qr = new QRCode(req.body);
    await qr.save();
    res.status(201).json(qr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET generate QR image for printing
router.get('/:id/image', async (req, res) => {
  try {
    const qr = await QRCode.findById(req.params.id);
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    
    const qrDataUrl = await qrcode.toDataURL(qr.code, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    
    res.json({ 
      code: qr.code, 
      label: qr.label,
      image: qrDataUrl 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export all QR codes for a floor as printable
router.get('/export/:floorId', async (req, res) => {
  try {
    const qrcodes = await QRCode.find({ floorId: req.params.floorId, isActive: true });
    const results = await Promise.all(qrcodes.map(async (qr) => {
      const image = await qrcode.toDataURL(qr.code, {
        width: 300, margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' }
      });
      return { code: qr.code, label: qr.label, position: qr.position, image };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update QR code
router.put('/:id', async (req, res) => {
  try {
    const qr = await QRCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!qr) return res.status(404).json({ error: 'QR code not found' });
    res.json(qr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE QR code
router.delete('/:id', async (req, res) => {
  try {
    await QRCode.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'QR code deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
