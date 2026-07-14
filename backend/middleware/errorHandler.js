/**
 * NavX Security — Global Error Handler
 * Logs full details internally, returns only generic messages to clients.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Global error-handling middleware.
 * Must be registered LAST in the middleware chain (after all routes).
 *
 * Usage in route handlers:
 *   catch (err) { next(err); }
 */
function globalErrorHandler(err, req, res, next) {
  // Generate a unique error ID for cross-referencing logs with user reports
  const errorId = uuidv4();

  // ─── Internal Logging (full details, never exposed to client) ──────────
  console.error(`[ERROR ${errorId}]`, {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    message: err.message,
    stack: err.stack,
  });

  // ─── Determine Status Code ────────────────────────────────────────────
  const statusCode = err.statusCode || err.status || 500;

  // ─── Client Response ──────────────────────────────────────────────────
  if (statusCode >= 500) {
    // Server errors: NEVER leak internal details
    const response = {
      error: 'An internal error occurred. Please try again later.',
      errorId,
    };

    // In development mode, optionally include the real message for debugging
    if (process.env.NODE_ENV === 'development') {
      response.devMessage = err.message;
    }

    return res.status(statusCode).json(response);
  }

  // 4xx errors (validation, auth, etc.) — these are intentional user-facing messages
  return res.status(statusCode).json({
    error: err.message || 'Bad request',
    errorId,
  });
}

module.exports = globalErrorHandler;
