// Force Google DNS for MongoDB Atlas SRV resolution
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

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

<<<<<<< HEAD
// MongoDB Connection with Auto-Reconnect
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/navx';
const MAX_RETRIES = 10;
let retryCount = 0;

const connectWithRetry = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,   // Timeout after 10s instead of 30s default
      heartbeatFrequencyMS: 5000,        // Check server health every 5s
      retryWrites: true,
      retryReads: true,
    });
    retryCount = 0; // Reset on successful connection
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    retryCount++;
    const delay = Math.min(5000 * retryCount, 30000); // Exponential backoff, max 30s
    console.error(`❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES} failed:`, err.message);
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying in ${delay / 1000}s...`);
      setTimeout(connectWithRetry, delay);
    } else {
      console.error('💀 Max retries reached. Please check your MongoDB Atlas IP whitelist and connection string.');
    }
  }
};

// Connection event listeners for monitoring
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB. Attempting reconnect...');
  if (retryCount < MAX_RETRIES) {
    retryCount = 0; // Reset retry count for reconnection attempts
    setTimeout(connectWithRetry, 3000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

// Graceful shutdown — close DB connection when server stops
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed (app shutdown)');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed (app terminated)');
  process.exit(0);
});

// Start the initial connection
=======
// MongoDB Connection with retry logic
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/navx';
const MAX_RETRIES = 5;
let retryCount = 0;

const connectWithRetry = () => {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // 10s timeout per attempt
  })
    .then(() => {
      retryCount = 0;
      console.log('✅ MongoDB connected successfully');
    })
    .catch(err => {
      retryCount++;
      const isIPError = err.message?.includes('IP') || err.message?.includes('whitelist') || err.message?.includes('Could not connect');
      if (isIPError) {
        console.error('\n❌ MongoDB Atlas IP Whitelist Error!');
        console.error('👉 Fix: Go to https://cloud.mongodb.com → Security → Network Access');
        console.error('👉 Click "+ ADD IP ADDRESS" → "ADD CURRENT IP ADDRESS" → Confirm\n');
      } else {
        console.error(`❌ MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}):`, err.message);
      }
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(5000 * retryCount, 30000); // exponential backoff, max 30s
        console.log(`🔄 Retrying in ${delay / 1000}s...`);
        setTimeout(connectWithRetry, delay);
      } else {
        console.error('🛑 Max retries reached. Server will continue without DB — check your Atlas IP whitelist.');
      }
    });
};

>>>>>>> b25aeea38750dadf424ff4d796c8dee45adeb5e2
connectWithRetry();

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

// Health check (includes MongoDB status)
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStates[mongoose.connection.readyState] || 'unknown',
  });
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
