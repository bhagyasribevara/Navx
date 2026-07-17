const router = require('express').Router();
const Analytics = require('../models/Analytics');
const mongoose = require('mongoose');
const { authenticateJWT } = require('../utils/auth');
const Attendance = require('../models/Attendance');

// POST log event (public endpoint from mobile app)
router.post('/', async (req, res, next) => {
  try {
    const event = new Analytics(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET analytics summary (Admin only)
router.get('/summary/:campusId', authenticateJWT, async (req, res, next) => {
  try {
    const { campusId } = req.params;
    if (req.admin.role !== 'SuperAdmin' && campusId !== req.admin.campusId.toString()) {
      return res.status(403).json({ error: 'Access Denied: You can only view analytics for your assigned campus.' });
    }

    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const [navCount, searchCount, qrCount, topSearches, topRoutes, attendanceStats, attendanceByDay, qrScanWeekly] = await Promise.all([
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
      ]),
      // Average Attendance Stats
      Attendance.aggregate([
        { $match: { campusId: new mongoose.Types.ObjectId(campusId), date: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Attendance Trend by Day of Week
      Attendance.aggregate([
        { $match: { campusId: new mongoose.Types.ObjectId(campusId), date: { $gte: since } } },
        { $group: { _id: { dayOfWeek: { $dayOfWeek: '$date' }, status: '$status' }, count: { $sum: 1 } } }
      ]),
      // QR Scan Weekly Trend
      Analytics.aggregate([
        { $match: { campusId: new mongoose.Types.ObjectId(campusId), type: 'qr_scan', timestamp: { $gte: since } } },
        { $group: { _id: { $week: '$timestamp' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } }
      ])
    ]);

    // Process Attendance Stats
    let totalPresent = 0;
    let totalAbsent = 0;
    attendanceStats.forEach(stat => {
      if (stat._id === 'Present') totalPresent += stat.count;
      if (stat._id === 'Absent') totalAbsent += stat.count;
    });
    const totalAttendanceRecords = totalPresent + totalAbsent;
    const averageAttendance = totalAttendanceRecords > 0 
      ? ((totalPresent / totalAttendanceRecords) * 100).toFixed(1)
      : 0;

    // Process Attendance Trend (Mon=2 to Fri=6)
    const dayLabels = { 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri' };
    const trendMap = { 2: { present: 0, total: 0 }, 3: { present: 0, total: 0 }, 4: { present: 0, total: 0 }, 5: { present: 0, total: 0 }, 6: { present: 0, total: 0 } };
    
    attendanceByDay.forEach(stat => {
      const day = stat._id.dayOfWeek;
      if (trendMap[day]) {
        trendMap[day].total += stat.count;
        if (stat._id.status === 'Present') {
          trendMap[day].present += stat.count;
        }
      }
    });

    const attendanceTrend = Object.keys(trendMap).map(day => {
      const data = trendMap[day];
      const percentage = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
      return {
        label: dayLabels[day],
        value: percentage
      };
    });

    // Process QR Scans (last 4 weeks if possible, or just sequentially based on data)
    let qrScans = qrScanWeekly.map((weekData, idx) => ({
      label: `Week ${idx + 1}`,
      value: weekData.count
    }));
    
    // Ensure we have at least 4 items for UI layout if empty
    if (qrScans.length === 0) {
      qrScans = [
        { label: 'Week 1', value: 0 },
        { label: 'Week 2', value: 0 },
        { label: 'Week 3', value: 0 },
        { label: 'Week 4', value: 0 }
      ];
    }

    res.json({ 
      navCount, 
      searchCount, 
      qrCount, 
      topSearches, 
      topRoutes, 
      averageAttendance,
      attendanceTrend,
      qrScans,
      period: `${days} days` 
    });
  } catch (err) { next(err); }
});

// GET heatmap data (Admin only)
router.get('/heatmap/:campusId', authenticateJWT, async (req, res, next) => {
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
  } catch (err) { next(err); }
});

module.exports = router;
