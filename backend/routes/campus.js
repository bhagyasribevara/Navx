const router = require('express').Router();
const Campus = require('../models/Campus');

// GET all campuses
router.get('/', async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true }).sort({ createdAt: 1 });
    res.json(campuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single campus
router.get('/:id', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create campus
router.post('/', async (req, res) => {
  try {
    const existingCampus = await Campus.findOne({ name: req.body.name });
    
    if (existingCampus) {
      if (!existingCampus.isActive) {
        // Reactivate soft-deleted campus
        const updatedCampus = await Campus.findByIdAndUpdate(
          existingCampus._id, 
          { ...req.body, isActive: true }, 
          { new: true }
        );
        return res.status(201).json(updatedCampus);
      } else {
        // Auto-append number to avoid E11000 failure
        let counter = 1;
        let newName = `${req.body.name} (${counter})`;
        while (await Campus.findOne({ name: newName })) {
          counter++;
          newName = `${req.body.name} (${counter})`;
        }
        req.body.name = newName;
      }
    }
    
    const campus = new Campus(req.body);
    await campus.save();
    res.status(201).json(campus);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A campus with this name already exists. Please choose a different name.' });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT update campus
router.put('/:id', async (req, res) => {
  try {
    if (req.body.name) {
      const existingCampus = await Campus.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
      if (existingCampus) {
        let counter = 1;
        let newName = `${req.body.name} (${counter})`;
        while (await Campus.findOne({ name: newName, _id: { $ne: req.params.id } })) {
          counter++;
          newName = `${req.body.name} (${counter})`;
        }
        req.body.name = newName;
      }
    }

    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A campus with this name already exists. Please choose a different name.' });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE campus
router.delete('/:id', async (req, res) => {
  try {
    await Campus.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Campus deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
