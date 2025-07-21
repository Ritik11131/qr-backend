const jwt = require('jsonwebtoken');

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

    // Only decode the JWT, do not verify the signature
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    req.user = decoded;
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

module.exports = { auth, adminAuth };