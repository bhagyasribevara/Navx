/**
 * NavX Security — Input Validation Middleware
 * Allow-list schema validation to neutralize injection and malformed input.
 */

// Supported types: 'string', 'number', 'boolean', 'array', 'email', 'objectId'
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Sanitize a string value: trim whitespace, strip null bytes, enforce max length.
 */
function sanitizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\0/g, '').slice(0, maxLength);
}

/**
 * Validate a single field against its schema definition.
 * Returns null if valid, or an error string if invalid.
 */
function validateField(fieldName, value, rules) {
  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // If not required and not provided, skip further checks
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // Type checks
  switch (rules.type) {
    case 'string':
      if (typeof value !== 'string') return `${fieldName} must be a string`;
      if (rules.minLength && value.length < rules.minLength) {
        return `${fieldName} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `${fieldName} must be at most ${rules.maxLength} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        return `${fieldName} contains invalid characters`;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        return `${fieldName} must be one of: ${rules.enum.join(', ')}`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return `${fieldName} must be a number`;
      if (rules.min !== undefined && value < rules.min) return `${fieldName} must be at least ${rules.min}`;
      if (rules.max !== undefined && value > rules.max) return `${fieldName} must be at most ${rules.max}`;
      break;

    case 'boolean':
      if (typeof value !== 'boolean') return `${fieldName} must be a boolean`;
      break;

    case 'array':
      if (!Array.isArray(value)) return `${fieldName} must be an array`;
      if (rules.maxItems && value.length > rules.maxItems) {
        return `${fieldName} must have at most ${rules.maxItems} items`;
      }
      break;

    case 'email':
      if (typeof value !== 'string') return `${fieldName} must be a string`;
      if (!EMAIL_REGEX.test(value)) return `${fieldName} must be a valid email address`;
      break;

    case 'objectId':
      if (typeof value !== 'string') return `${fieldName} must be a string`;
      if (!OBJECT_ID_REGEX.test(value)) return `${fieldName} must be a valid ID`;
      break;

    default:
      break;
  }

  return null;
}

/**
 * Express middleware factory: validates req.body against an allow-list schema.
 * In strict mode, rejects any fields not defined in the schema.
 */
function validateBody(schema, { strict = false } = {}) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Strict mode: reject unknown fields
    if (strict) {
      const allowedFields = Object.keys(schema);
      const bodyFields = Object.keys(req.body);
      for (const field of bodyFields) {
        if (!allowedFields.includes(field)) {
          return res.status(400).json({ error: `Unrecognized field: ${field}` });
        }
      }
    }

    // Validate and sanitize each field
    for (const [fieldName, rules] of Object.entries(schema)) {
      let value = req.body[fieldName];

      // Sanitize strings
      if (typeof value === 'string') {
        value = sanitizeString(value, rules.maxLength || 1000);
        req.body[fieldName] = value;
      }

      const error = validateField(fieldName, value, rules);
      if (error) {
        return res.status(400).json({ error });
      }
    }

    next();
  };
}

/**
 * Express middleware factory: validates req.query against an allow-list schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    for (const [fieldName, rules] of Object.entries(schema)) {
      let value = req.query[fieldName];

      // Query params are always strings; coerce types if needed
      if (value !== undefined && rules.type === 'number') {
        value = Number(value);
        req.query[fieldName] = value;
      }

      if (typeof value === 'string') {
        value = sanitizeString(value, rules.maxLength || 500);
        req.query[fieldName] = value;
      }

      const error = validateField(fieldName, value, rules);
      if (error) {
        return res.status(400).json({ error });
      }
    }

    next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  sanitizeString,
};
