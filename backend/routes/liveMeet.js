const router = require('express').Router();
const LiveMeetSession = require('../models/LiveMeetSession');
const crypto = require('crypto');

// Generate unique short id (e.g. abc123xyz)
const generateSessionId = () => crypto.randomBytes(4).toString('hex');

// ─── POST Create Meet Session ───────────────────────────────────────────────
router.post('/create', async (req, res) => {
  try {
    const { campusId, creatorDevice, creatorName, creatorLocation, destinationLabel, durationMinutes } = req.body;
    
    if (!campusId || !creatorDevice || !creatorLocation) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const duration = durationMinutes || 30;
    const expiresAt = new Date(Date.now() + duration * 60000);
    const sessionId = generateSessionId();

    const session = new LiveMeetSession({
      sessionId,
      campusId,
      creatorDevice,
      creatorName,
      creatorLocation,
      destinationLabel,
      durationMinutes: duration,
      expiresAt,
      status: 'waiting'
    });

    await session.save();
    
    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST Join Meet Session ─────────────────────────────────────────────────
router.post('/join/:sessionId', async (req, res) => {
  try {
    const { joinerDevice, joinerName, joinerLocation } = req.body;
    
    const session = await LiveMeetSession.findOne({ sessionId: req.params.sessionId });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'expired' || session.status === 'cancelled') {
      return res.status(400).json({ error: 'Session is no longer active' });
    }

    // Allow re-joining or new joiner
    if (!session.joinerDevice || session.joinerDevice === joinerDevice) {
      session.joinerDevice = joinerDevice;
      if (joinerName) session.joinerName = joinerName;
      if (joinerLocation) session.joinerLocation = joinerLocation;
      session.status = 'active';
      await session.save();
    } else if (session.joinerDevice !== joinerDevice) {
      return res.status(403).json({ error: 'This session is already joined by someone else.' });
    }

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET Fetch Active Session ───────────────────────────────────────────────
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await LiveMeetSession.findOne({ sessionId: req.params.sessionId }).populate('campusId', 'name venueType');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST End/Cancel Session ────────────────────────────────────────────────
router.post('/:sessionId/end', async (req, res) => {
  try {
    const session = await LiveMeetSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = req.body.status || 'cancelled'; // 'arrived' or 'cancelled'
    await session.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
