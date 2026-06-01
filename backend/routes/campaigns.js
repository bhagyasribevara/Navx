const router = require('express').Router();
const Campaign = require('../models/Campaign');

// GET campaigns for a campus
// If "active" query parameter is passed as true, it filters for active campaigns.
router.get('/campus/:campusId', async (req, res) => {
  try {
    const filter = { campusId: req.params.campusId };
    if (req.query.active === 'true') {
      filter.isActive = true;
    }
    const campaigns = await Campaign.find(filter)
      .populate('destination.blockId', 'name')
      .populate('destination.floorId', 'name level')
      .populate('destination.roomId', 'name roomNumber type');
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single campaign
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('destination.roomId');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create campaign
router.post('/', async (req, res) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update campaign
router.put('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE campaign
router.delete('/:id', async (req, res) => {
  try {
    await Campaign.findByIdAndDelete(req.params.id);
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
