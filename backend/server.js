require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/navx')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/campus', require('./routes/campus'));
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/floors', require('./routes/floors'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/nodes', require('./routes/nodes'));
app.use('/api/paths', require('./routes/paths'));
app.use('/api/qrcodes', require('./routes/qrcodes'));
app.use('/api/beacons', require('./routes/beacons'));
app.use('/api/navigation', require('./routes/navigation'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 NavX Backend running on port ${PORT}`);
});
