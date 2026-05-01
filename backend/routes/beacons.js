const router = require('express').Router();
const Beacon = require('../models/Beacon');

router.get('/', async (req, res) => {
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

router.get('/floor/:floorId', async (req, res) => {
  try {
    const beacons = await Beacon.find({ floorId: req.params.floorId, isActive: true });
    res.json(beacons);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const beacon = new Beacon(req.body);
    await beacon.save();
    res.status(201).json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const beacon = await Beacon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });
    res.json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id/calibrate', async (req, res) => {
  try {
    const beacon = await Beacon.findByIdAndUpdate(req.params.id, { calibration: req.body }, { new: true });
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });
    res.json(beacon);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Beacon.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Beacon deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
