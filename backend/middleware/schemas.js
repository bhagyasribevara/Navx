/**
 * NavX Security — Allow-List Schemas for Sensitive Endpoints
 * Each schema defines field names, types, constraints, and patterns.
 */

// ─── App Auth Schemas ───────────────────────────────────────────────────────

const registerSchema = {
  username: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_ .-]+$/,
  },
  password: {
    type: 'string',
    required: true,
    minLength: 6,
    maxLength: 128,
  },
  mobileNumber: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 15,
    pattern: /^[0-9+()-]+$/,
  },
  collegeEmail: {
    type: 'email',
    required: false,
    maxLength: 100,
  },
  collegeId: {
    type: 'string',
    required: false,
    maxLength: 50,
  },
  isStudent: {
    type: 'boolean',
    required: false,
  },
};

const loginSchema = {
  identifier: {
    type: 'string',
    required: false,
    maxLength: 100,
  },
  password: {
    type: 'string',
    required: true,
    maxLength: 128,
  },
  isStudent: {
    type: 'boolean',
    required: false,
  },
  collegeEmail: {
    type: 'email',
    required: false,
    maxLength: 100,
  },
  collegeId: {
    type: 'string',
    required: false,
    maxLength: 50,
  },
};

const otpRequestSchema = {
  isStudent: {
    type: 'boolean',
    required: false,
  },
  mobileNumber: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 15,
    pattern: /^[0-9+()-]+$/,
  },
  collegeEmail: {
    type: 'email',
    required: false,
    maxLength: 100,
  },
};

const otpVerifySchema = {
  isStudent: {
    type: 'boolean',
    required: false,
  },
  mobileNumber: {
    type: 'string',
    required: false,
    maxLength: 15,
  },
  collegeEmail: {
    type: 'email',
    required: false,
    maxLength: 100,
  },
  otpCode: {
    type: 'string',
    required: true,
    minLength: 6,
    maxLength: 6,
    pattern: /^[0-9]{6}$/,
  },
  newPassword: {
    type: 'string',
    required: true,
    minLength: 6,
    maxLength: 128,
  },
};

const profileUpdateSchema = {
  fullName: {
    type: 'string',
    required: false,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_ .'-]+$/,
  },
  mobileNumber: {
    type: 'string',
    required: false,
    maxLength: 15,
    pattern: /^[0-9+()-]+$/,
  },
  profileImage: {
    type: 'string',
    required: false,
    maxLength: 2000,
  },
};

// ─── Admin Schemas ──────────────────────────────────────────────────────────

const adminLoginSchema = {
  username: {
    type: 'string',
    required: true,
    maxLength: 50,
  },
  password: {
    type: 'string',
    required: true,
    maxLength: 128,
  },
};

const createCampusAdminSchema = {
  newUsername: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_.-]+$/,
  },
  newPassword: {
    type: 'string',
    required: true,
    minLength: 6,
    maxLength: 128,
  },
  campusName: {
    type: 'string',
    required: true,
    maxLength: 200,
  },
  campusAddress: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  venueType: {
    type: 'string',
    required: false,
    enum: ['campus', 'hospital', 'mall', 'airport', 'museum', 'office', 'convention_center'],
  },
  campusCode: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-z0-9-_]+$/,
  },
};

module.exports = {
  registerSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  profileUpdateSchema,
  adminLoginSchema,
  createCampusAdminSchema,
};
