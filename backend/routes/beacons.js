const router = require('express').Router();
const Beacon = require('../models/Beacon');
const Floor = require('../models/Floor');
const { authenticateJWT, optionalAuthenticateJWT, enforceCampusIsolation } = require('../utils/auth');

router.get('/', optionalAuthenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.campusId) filter.campusId = req.query.campusId;
    if (req.query.blockId) filter.blockId = req.query.blockId;
    const beacons = await Beacon.find(filter);
    res.json(beacons);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/detect/:beaconId', async (req, res) => {
  try {
    const beacon = await Beacon.findOne({ beaconId: req.params.beaconId, isActive: true })
      .populate('floorId', 'name level').populate('nearestNodeId');
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });
    res.json(beacon);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/floor/:floorId', optionalAuthenticateJWT, async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.floorId);
    if (!floor) return res.status(404).json({ error: 'Floor not found' });

    if (req.admin && req.admin.role !== 'SuperAdmin' && floor.campusId.toString() !== req.admin.campusId.toString()) {
      return res.status(403).json({ error: 'Access Denied: Floor belongs to another campus.' });
    }

    const beacons = await Beacon.find({ floorId: req.params.floorId, isActive: true });
    res.json(beacons);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const beacon = new Beacon(req.body);
    await beacon.save();
    res.status(201).json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const beacon = await Beacon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });
    res.json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id/calibrate', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    const beacon = await Beacon.findByIdAndUpdate(req.params.id, { calibration: req.body }, { new: true });
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });
    res.json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', authenticateJWT, enforceCampusIsolation, async (req, res) => {
  try {
    await Beacon.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Beacon deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
