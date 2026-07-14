/**
 * NavX Security — Secure File Serving Route
 * Serves uploaded files from the isolated storage directory with proper headers.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Secure uploads directory (outside web root)
const SECURE_UPLOAD_DIR = path.join(__dirname, '../../navx-secure-uploads');

// Allowed filename pattern: UUID + allowed extension
const SAFE_FILENAME_REGEX = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif)$/i;

// MIME type map
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// ─── GET /api/uploads/:filename ─────────────────────────────────────────────
router.get('/:filename', (req, res, next) => {
  const { filename } = req.params;

  // Validate filename format (prevents directory traversal)
  if (!SAFE_FILENAME_REGEX.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(SECURE_UPLOAD_DIR, filename);

  // Prevent path traversal by ensuring the resolved path is within the upload dir
  if (!filePath.startsWith(SECURE_UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

module.exports = router;
