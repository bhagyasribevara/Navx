const router = require('express').Router();
const Admin = require('../models/Admin');
const Campus = require('../models/Campus');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Auto-create SuperAdmin if no admins exist
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      if (username === 'superadmin' && password === 'admin123') {
        const newSuper = new Admin({ username, password, role: 'SuperAdmin' });
        await newSuper.save();
        return res.json({ 
          success: true, 
          admin: { _id: newSuper._id, username: newSuper.username, role: newSuper.role } 
        });
      }
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Plain text password for simplicity in this project scope
    if (admin.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    let campusDetails = null;
    if ((admin.role === 'CampusAdmin' || admin.role === 'VenueAdmin') && admin.campusId) {
      campusDetails = await Campus.findById(admin.campusId);
    }
    
    res.json({
      success: true,
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role,
        campusId: admin.campusId,
        campus: campusDetails,
        managedVenueType: admin.managedVenueType || campusDetails?.venueType || 'campus'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Venue Admin (SuperAdmin only)
router.post('/create-campus-admin', async (req, res) => {
  try {
    const { superAdminId, newUsername, newPassword, campusName, campusAddress, venueType } = req.body;
    
    const superAdmin = await Admin.findById(superAdminId);
    if (!superAdmin || superAdmin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized. Only SuperAdmin can create Venue Admins.' });
    }
    
    const resolvedVenueType = venueType || 'campus';

    // Create the venue first
    let campus = await Campus.findOne({ name: campusName });
    if (!campus) {
      campus = new Campus({ name: campusName, address: campusAddress, venueType: resolvedVenueType });
      await campus.save();
    } else if (venueType && campus.venueType !== venueType) {
      // Update venue type if changed
      campus.venueType = venueType;
      await campus.save();
    }
    
    // Create the admin
    const newAdmin = new Admin({
      username: newUsername,
      password: newPassword,
      role: 'VenueAdmin',
      campusId: campus._id,
      managedVenueType: resolvedVenueType
    });
    
    await newAdmin.save();
    
    res.status(201).json({ success: true, admin: newAdmin, campus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all admins (SuperAdmin only)
router.get('/admins/:superAdminId', async (req, res) => {
  try {
    const superAdmin = await Admin.findById(req.params.superAdminId);
    if (!superAdmin || superAdmin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    const admins = await Admin.find().populate('campusId');
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete admin (SuperAdmin only)
router.delete('/admins/:superAdminId/:adminId', async (req, res) => {
  try {
    const superAdmin = await Admin.findById(req.params.superAdminId);
    if (!superAdmin || superAdmin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const adminToDelete = await Admin.findById(req.params.adminId);
    if (!adminToDelete) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    if (adminToDelete.role === 'SuperAdmin') {
      return res.status(403).json({ error: 'Cannot delete a SuperAdmin.' });
    }

    await Admin.findByIdAndDelete(req.params.adminId);
    res.json({ success: true, message: 'Admin deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update admin (SuperAdmin only)
router.put('/admins/:superAdminId/:adminId', async (req, res) => {
  try {
    const superAdmin = await Admin.findById(req.params.superAdminId);
    if (!superAdmin || superAdmin.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { username, password } = req.body;
    const adminToUpdate = await Admin.findById(req.params.adminId);
    
    if (!adminToUpdate) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    if (username) adminToUpdate.username = username;
    if (password) adminToUpdate.password = password;

    await adminToUpdate.save();
    
    res.json({ success: true, admin: adminToUpdate });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
