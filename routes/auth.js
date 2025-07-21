const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { authRateLimit, generalRateLimit } = require('../middleware/rateLimiter');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register new user
router.post('/register', authRateLimit, validateUserRegistration, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists with this email or phone',
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const userId = uuidv4();
    const user = new User({
      userId,
      name,
      email,
      phone,
      password,
      role: 'user'
    });

    await user.save();

    // Generate token
    const token = generateToken(userId);

    console.log(`✅ New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login user
router.post('/login', authRateLimit, validateUserLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user.userId);

    console.log(`✅ User logged in: ${email} (${user.role})`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isOnline: user.isOnline,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        userId: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        avatar: req.user.avatar,
        role: req.user.role,
        isOnline: req.user.isOnline,
        lastSeen: req.user.lastSeen,
        preferences: req.user.preferences,
        stats: req.user.stats
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      code: 'PROFILE_ERROR'
    });
  }
});

// Update user profile
router.put('/profile', auth, generalRateLimit, async (req, res) => {
  try {
    const { name, avatar, preferences } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;
    if (preferences) updates.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findOneAndUpdate(
      { userId: req.user.userId },
      updates,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        preferences: user.preferences,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

// Update device token for push notifications
router.post('/device-token', auth, generalRateLimit, async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ 
        error: 'Device token is required',
        code: 'MISSING_DEVICE_TOKEN'
      });
    }

    // Add device token if not already present
    if (!req.user.deviceTokens.includes(deviceToken)) {
      req.user.deviceTokens.push(deviceToken);
      await req.user.save();
      console.log(`📱 Device token added for user: ${req.user.email}`);
    }

    res.json({ 
      success: true, 
      message: 'Device token updated successfully',
      totalTokens: req.user.deviceTokens.length
    });
  } catch (error) {
    console.error('Device token update error:', error);
    res.status(500).json({ 
      error: 'Failed to update device token',
      code: 'DEVICE_TOKEN_ERROR'
    });
  }
});

// Change password
router.post('/change-password', auth, authRateLimit, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    // Verify current password
    const isPasswordValid = await req.user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    console.log(`🔐 Password changed for user: ${req.user.email}`);

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// Verify token
router.get('/verify', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      valid: true,
      user: {
        userId: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      valid: false,
      code: 'TOKEN_INVALID'
    });
  }
});

// Logout user
router.post('/logout', auth, generalRateLimit, async (req, res) => {
  try {
    const { deviceToken } = req.body;

    // Update online status
    req.user.isOnline = false;
    req.user.lastSeen = new Date();

    // Remove device token if provided
    if (deviceToken) {
      req.user.deviceTokens = req.user.deviceTokens.filter(token => token !== deviceToken);
    }

    await req.user.save();

    console.log(`👋 User logged out: ${req.user.email}`);

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

module.exports = router;