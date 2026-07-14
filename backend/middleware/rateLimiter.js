/**
 * NavX Security — Centralized Rate Limiting Middleware
 * Tiered token-bucket rate limiters for different endpoint categories.
 */

const rateLimit = require('express-rate-limit');

// ─── Auth Limiter (Login / Register / OTP) ─────────────────────────────────
// Very strict: prevents brute-force credential attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                    // 20 attempts per window (increased for dev)
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── General API Limiter ────────────────────────────────────────────────────
// Moderate: prevents overall API abuse / DoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                  // 1000 requests per window (increased for dev)
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── AI Chat Limiter ────────────────────────────────────────────────────────
// Per-minute limit: prevents Gemini token exhaustion / cost abuse
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 20,                   // 20 requests per minute
  message: { error: 'AI rate limit reached. Please wait a moment before sending another message.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Upload Limiter ─────────────────────────────────────────────────────────
// Prevents storage flooding
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 uploads per window
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  apiLimiter,
  aiLimiter,
  uploadLimiter,
};
