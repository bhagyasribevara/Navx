// Force Google DNS for MongoDB Atlas SRV resolution
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();

// ─── Security: Validate required env vars before anything else ──────────────
const { validateRequiredEnvVars } = require('./utils/auth');
validateRequiredEnvVars();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Security middleware
const { apiLimiter, authLimiter, aiLimiter, uploadLimiter } = require('./middleware/rateLimiter');
const globalErrorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  
  socket.on('join_campus', (campusId) => {
    socket.join(campusId);
    console.log(`Socket ${socket.id} joined campus ${campusId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// AI Chat WebSocket namespace
const aiChatNs = io.of('/ai-chat');
aiChatNs.on('connection', (socket) => {
  console.log('AI Chat client connected:', socket.id);

  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
  });

  socket.on('typing', (data) => {
    socket.to(data.sessionId).emit('typing', data);
  });

  socket.on('disconnect', () => {
    console.log('AI Chat client disconnected:', socket.id);
  });
});

// Middleware
const cookieParser = require('cookie-parser');
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Security: Apply global rate limiter to all API routes ──────────────────
app.use('/api/', apiLimiter);

// ─── Security: Serve uploads via controlled route (NOT express.static) ──────
// Old insecure line removed: app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Legacy compatibility: redirect old /uploads/* paths to the secure endpoint
app.use('/uploads', (req, res) => {
  // For backward compatibility with existing image URLs stored in the database
  const filename = path.basename(req.path);
  res.redirect(301, `/api/uploads/${filename}`);
});

// MongoDB Connection with Auto-Reconnect
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 10;
let retryCount = 0;

const connectWithRetry = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 5000,
      retryWrites: true,
      retryReads: true,
    });
    retryCount = 0;
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    retryCount++;
    const delay = Math.min(5000 * retryCount, 30000); // Exponential backoff, max 30s
    const isIPError = err.message?.includes('IP') || err.message?.includes('whitelist') || err.message?.includes('Could not connect');
    if (isIPError) {
      console.error('\n❌ MongoDB Atlas IP Whitelist Error!');
      console.error('👉 Fix: Go to https://cloud.mongodb.com → Security → Network Access');
      console.error('👉 Click "+ ADD IP ADDRESS" → "ADD CURRENT IP ADDRESS" → Confirm\n');
    } else {
      console.error(`❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES} failed:`, err.message);
    }
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
    retryCount = 0;
    setTimeout(connectWithRetry, 3000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

// Graceful shutdown
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
connectWithRetry();

// ─── Routes (with security rate limiters on sensitive endpoints) ─────────────
app.use('/api/app-auth', authLimiter, require('./routes/appAuth'));
app.use('/api/campus', require('./routes/campus'));
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/floors', require('./routes/floors'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/upload', uploadLimiter, require('./routes/upload'));
app.use('/api/uploads', require('./routes/serveUpload'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/nodes', require('./routes/nodes'));
app.use('/api/paths', require('./routes/paths'));
app.use('/api/qrcodes', require('./routes/qrcodes'));
app.use('/api/beacons', require('./routes/beacons'));
app.use('/api/navigation', require('./routes/navigation'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', aiLimiter, require('./routes/ai'));
app.use('/api/adminAi', require('./routes/adminAi'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/mapLayers', require('./routes/mapLayers'));
app.use('/api/landmarks', require('./routes/landmarks'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/navigationGraphs', require('./routes/navigationGraphs'));
app.use('/api/meet', require('./routes/liveMeet'));
app.use('/api/student', require('./routes/student'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/spatialStudio', require('./routes/spatialStudio'));

// Health check (includes MongoDB status)
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStates[mongoose.connection.readyState] || 'unknown',
  });
});

// Dynamic configuration check (expose only EXPO_PUBLIC_ variables)
app.get('/api/config', (req, res) => {
  const config = {};
  for (const key in process.env) {
    if (key.startsWith('EXPO_PUBLIC_')) {
      config[key] = process.env[key];
    }
  }
  res.json(config);
});

// ─── Security: Global error handler (MUST be registered LAST) ───────────────
// Catches all unhandled errors from next(err) calls in route handlers.
// Logs full details internally, returns only generic messages to the client.
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NavX Backend running on port ${PORT}`);
  console.log(`🔒 Security hardening active: rate limiting, input validation, error masking`);
});
