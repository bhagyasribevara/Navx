const router = require('express').Router();
const Announcement = require('../models/Announcement');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

// GET all announcements (filter by campusId)
router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.campusId) filter.campusId = req.query.campusId;
    const announcements = await Announcement.find(filter).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single announcement
router.get('/:id', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create announcement
router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const announcement = new Announcement(req.body);
    await announcement.save();
    res.status(201).json(announcement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update announcement
router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE announcement
router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    await Announcement.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
