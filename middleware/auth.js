const jwt = require('jsonwebtoken');
const config = require('../config/app');

// General authentication middleware
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Decode and validate JWT structure
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }

    // Validate required JWT fields
    const payload = decoded.payload;
    if (!payload.user_id || !payload.role) {
      return res.status(401).json({ 
        error: 'Invalid token payload. Missing required fields.',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      return res.status(401).json({ 
        error: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    req.user = payload;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    // Check for admin role from JWT payload
    if (req.user && (req.user.role === '1' || req.user.role === 1)) {
      next();
    } else {
      res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        code: 'ADMIN_REQUIRED'
      });
    }
  });
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && decoded.payload) {
      const payload = decoded.payload;
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Only set user if token is valid and not expired
      if (payload.user_id && payload.role && (!payload.exp || payload.exp >= currentTime)) {
        req.user = payload;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }
  
  next();
};
module.exports = { auth, adminAuth, optionalAuth };