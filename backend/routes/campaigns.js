const router = require('express').Router();
const Campaign = require('../models/Campaign');

const populate = (q) => q
  .populate('destination.blockId', 'name')
  .populate('destination.floorId', 'name level')
  .populate('destination.roomId', 'name roomNumber type');

// Helper: emit socket event to campus room
const emit = (req, campusId, event, payload) => {
  const io = req.app.get('io');
  if (io && campusId) io.to(campusId.toString()).emit(event, payload);
};

// ─── GET top-level campaigns for a campus (parentId = null) ───────────────────
router.get('/campus/:campusId', async (req, res) => {
  try {
    const filter = { campusId: req.params.campusId, parentId: null };
    if (req.query.active === 'true') filter.isActive = true;

    const campaigns = await populate(Campaign.find(filter).sort({ createdAt: -1 }));

    // Attach subCount to each campaign
    const ids = campaigns.map(c => c._id);
    const subCounts = await Campaign.aggregate([
      { $match: { parentId: { $in: ids } } },
      { $group: { _id: '$parentId', count: { $sum: 1 } } }
    ]);
    const subCountMap = {};
    subCounts.forEach(s => { subCountMap[s._id.toString()] = s.count; });

    const result = campaigns.map(c => ({
      ...c.toObject(),
      subCount: subCountMap[c._id.toString()] || 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET sub-campaigns of a parent ───────────────────────────────────────────
router.get('/:id/sub', async (req, res) => {
  try {
    const filter = { parentId: req.params.id };
    if (req.query.active === 'true') filter.isActive = true;
    const subs = await populate(Campaign.find(filter).sort({ createdAt: 1 }));
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single campaign ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const campaign = await populate(Campaign.findById(req.params.id));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create campaign or sub-campaign ─────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    emit(req, req.body.campusId, 'campaign_updated', {
      action: 'created',
      campusId: req.body.campusId,
      campaignId: campaign._id,
      title: campaign.title,
    });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── PUT update campaign ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    emit(req, campaign.campusId, 'campaign_updated', {
      action: 'updated',
      campusId: campaign.campusId,
      campaignId: campaign._id,
      title: campaign.title,
    });
    res.json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── DELETE campaign (and all its sub-campaigns) ──────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const campusId = campaign.campusId;
    // Delete sub-campaigns first
    await Campaign.deleteMany({ parentId: req.params.id });
    await Campaign.findByIdAndDelete(req.params.id);
    emit(req, campusId, 'campaign_updated', {
      action: 'deleted',
      campusId,
      campaignId: req.params.id,
    });
    res.json({ message: 'Campaign and sub-campaigns deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
