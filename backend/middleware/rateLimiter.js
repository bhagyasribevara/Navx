/**
 * NavX Security — Centralized Rate Limiting Middleware
 * Tiered token-bucket rate limiters for different endpoint categories.
 */

const rateLimit = require('express-rate-limit');

// Helper to determine if request is from local dev/private network
const isLocalOrDev = (req) => {
  if (process.env.NODE_ENV !== 'production') return true;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('192.168.') || ip.includes('10.') || ip.includes('172.');
};

// ─── Auth Limiter (Login / Register / OTP) ─────────────────────────────────
// Strict in production, relaxed in dev
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 500, // 500 attempts in dev
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalOrDev(req),
});

// ─── General API Limiter ────────────────────────────────────────────────────
// High capacity in dev to accommodate mobile spatial scanner streams & dashboard polling
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 3000 : 100000,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Always allow local dev and spatial studio telemetry streams
    if (isLocalOrDev(req)) return true;
    if (req.originalUrl && req.originalUrl.includes('/spatialStudio/')) return true;
    return false;
  },
});

// ─── AI Chat Limiter ────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  message: { error: 'AI rate limit reached. Please wait a moment before sending another message.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalOrDev(req),
});

// ─── Upload Limiter ─────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalOrDev(req),
});

module.exports = {
  authLimiter,
  apiLimiter,
  aiLimiter,
  uploadLimiter,
};
