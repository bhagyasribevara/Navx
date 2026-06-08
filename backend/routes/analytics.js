const router = require('express').Router();
const Analytics = require('../models/Analytics');
const mongoose = require('mongoose');
const { authenticateJWT } = require('../utils/auth');

// POST log event (public endpoint from mobile app)
router.post('/', async (req, res) => {
  try {
    const event = new Analytics(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET analytics summary (Admin only)
router.get('/summary/:campusId', authenticateJWT, async (req, res) => {
  try {
    const { campusId } = req.params;
    if (req.admin.role !== 'SuperAdmin' && campusId !== req.admin.campusId.toString()) {
      return res.status(403).json({ error: 'Access Denied: You can only view analytics for your assigned campus.' });
    }

    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const [navCount, searchCount, qrCount, topSearches, topRoutes] = await Promise.all([
      Analytics.countDocuments({ campusId, type: 'navigation', timestamp: { $gte: since } }),
      Analytics.countDocuments({ campusId, type: 'search', timestamp: { $gte: since } }),
      Analytics.countDocuments({ campusId, type: 'qr_scan', timestamp: { $gte: since } }),
      Analytics.aggregate([
        { $match: { campusId: new mongoose.Types.ObjectId(campusId), type: 'search', timestamp: { $gte: since } } },
        { $group: { _id: '$data.searchQuery', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 }
      ]),
      Analytics.aggregate([
        { $match: { campusId: new mongoose.Types.ObjectId(campusId), type: 'navigation', timestamp: { $gte: since } } },
        { $group: { _id: { from: '$data.fromRoom', to: '$data.toRoom' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 }
      ])
    ]);
    
    res.json({ navCount, searchCount, qrCount, topSearches, topRoutes, period: `${days} days` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET heatmap data (Admin only)
router.get('/heatmap/:campusId', authenticateJWT, async (req, res) => {
  try {
    const { campusId } = req.params;
    if (req.admin.role !== 'SuperAdmin' && campusId !== req.admin.campusId.toString()) {
      return res.status(403).json({ error: 'Access Denied: You can only view heatmap for your assigned campus.' });
    }

    const { floorId, days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const events = await Analytics.find({
      campusId, type: 'navigation', timestamp: { $gte: since },
      ...(floorId && { 'data.floorId': floorId })
    }).select('data.path');
    
    const heatmap = {};
    events.forEach(e => {
      if (e.data && e.data.path) {
        e.data.path.forEach(p => {
          const key = `${Math.round(p.x / 20) * 20},${Math.round(p.y / 20) * 20}`;
          heatmap[key] = (heatmap[key] || 0) + 1;
        });
      }
    });
    
    res.json(Object.entries(heatmap).map(([k, v]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, intensity: v };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
