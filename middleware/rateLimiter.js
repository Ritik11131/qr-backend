const rateLimit = require('express-rate-limit');
const config = require('../config/app');

// Get rate limiting configuration
const rateLimitConfig = config.get('rateLimiting');
// General rate limiter
const generalRateLimit = rateLimit({
  windowMs: rateLimitConfig.global.windowMs,
  max: rateLimitConfig.global.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: `${Math.ceil(rateLimitConfig.global.windowMs / 60000)} minutes`,
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.user_id || req.ip;
  }
});

// Auth endpoints rate limiter (stricter)
const authRateLimit = rateLimit({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.max,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: `${Math.ceil(rateLimitConfig.auth.windowMs / 60000)} minutes`,
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Call endpoints rate limiter
const callRateLimit = rateLimit({
  windowMs: rateLimitConfig.calls.windowMs,
  max: rateLimitConfig.calls.max,
  message: {
    error: 'Too many call attempts, please try again later.',
    retryAfter: `${Math.ceil(rateLimitConfig.calls.windowMs / 60000)} minutes`,
    code: 'CALL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // For calls, use a combination of IP and QR ID if available
    const qrId = req.body?.qrId || req.params?.qrId;
    return qrId ? `${req.ip}:${qrId}` : req.ip;
  }
});

// Admin endpoints rate limiter
const adminRateLimit = rateLimit({
  windowMs: rateLimitConfig.admin.windowMs,
  max: rateLimitConfig.admin.max,
  message: {
    error: 'Too many admin requests, please try again later.',
    retryAfter: `${Math.ceil(rateLimitConfig.admin.windowMs / 60000)} minutes`,
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global rate limiter (very permissive)
const globalRateLimit = rateLimit({
  windowMs: rateLimitConfig.global.windowMs,
  max: rateLimitConfig.global.max * 10, // More permissive for global
  message: {
    error: 'Rate limit exceeded, please try again later.',
    retryAfter: `${Math.ceil(rateLimitConfig.global.windowMs / 60000)} minutes`,
    code: 'GLOBAL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api';
  }
});

module.exports = {
  generalRateLimit,
  authRateLimit,
  callRateLimit,
  adminRateLimit,
  globalRateLimit
};