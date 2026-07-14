/**
 * NavX Security — Secure File Upload Route
 * Validates magic numbers, enforces size limits, randomizes filenames,
 * and stores files isolated from the web root.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ─── Configuration ──────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SECURE_UPLOAD_DIR = path.join(__dirname, '../../navx-secure-uploads');

// Ensure the secure upload directory exists
if (!fs.existsSync(SECURE_UPLOAD_DIR)) {
  fs.mkdirSync(SECURE_UPLOAD_DIR, { recursive: true });
}

// ─── Allowed MIME Types & Extensions ────────────────────────────────────────
const ALLOWED_MIMES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// ─── Magic Number Signatures ────────────────────────────────────────────────
// First N bytes that identify actual file type regardless of extension
const MAGIC_NUMBERS = [
  { type: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: starts with RIFF....WEBP
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], extraCheck: (buf) => buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 },
];

/**
 * Verify a file's magic bytes match an allowed image type.
 * Returns the detected MIME type or null if invalid.
 */
function verifyMagicNumber(buffer) {
  for (const sig of MAGIC_NUMBERS) {
    if (buffer.length < sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Additional check for WebP
      if (sig.extraCheck && !sig.extraCheck(buffer)) continue;
      return sig.type;
    }
  }
  return null;
}

// ─── Multer Configuration ───────────────────────────────────────────────────
// Store to temp first (memory), then validate + move to secure dir
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_MIMES[file.mimetype]) {
      return cb(new Error('File type not allowed. Only JPEG, PNG, WebP, and GIF are accepted.'));
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('File extension not allowed.'));
    }

    cb(null, true);
  },
});

// ─── POST / — Upload Endpoint ───────────────────────────────────────────────
router.post('/', upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ─── Magic Number Validation ──────────────────────────────────────────
    const detectedType = verifyMagicNumber(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({ error: 'File content does not match an allowed image type. Upload rejected.' });
    }

    // Verify detected type matches claimed MIME type
    if (detectedType !== req.file.mimetype) {
      console.warn(`[Upload Security] MIME mismatch: claimed ${req.file.mimetype}, detected ${detectedType}`);
      // Allow the detected type if it's in our allow-list (user may have wrong extension)
      if (!ALLOWED_MIMES[detectedType]) {
        return res.status(400).json({ error: 'File content type mismatch detected. Upload rejected.' });
      }
    }

    // ─── Generate Secure Filename ─────────────────────────────────────────
    const extensions = ALLOWED_MIMES[detectedType];
    const ext = extensions[0]; // Use canonical extension for the detected type
    const secureFilename = `${uuidv4()}${ext}`;

    // ─── Write to Secure Directory ────────────────────────────────────────
    const filePath = path.join(SECURE_UPLOAD_DIR, secureFilename);
    fs.writeFileSync(filePath, req.file.buffer);

    // Return the secure URL path (served via /api/uploads/:filename)
    const fileUrl = `/api/uploads/${secureFilename}`;

    res.json({ url: fileUrl });
  } catch (err) {
    next(err);
  }
});

// ─── Multer Error Handler ───────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message && err.message.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
