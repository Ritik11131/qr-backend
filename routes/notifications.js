const express = require('express');
const { sendPushNotification, sendBulkNotification } = require('../services/notificationService');
const { auth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// Send test notification
router.post('/test', auth, generalRateLimit, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    
    if (!req.user.deviceTokens || req.user.deviceTokens.length === 0) {
      return res.status(400).json({ 
        error: 'No device tokens found for user',
        code: 'NO_DEVICE_TOKENS'
      });
    }

    const payload = {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from QR Vehicle Emergency System',
      data: data || { type: 'test' }
    };

    const result = await sendPushNotification(req.user.deviceTokens, payload);

    console.log(`🧪 Test notification sent to user ${req.user.email}`);

    res.json({ 
      success: true, 
      message: 'Test notification sent successfully',
      sentTo: req.user.deviceTokens.length,
      results: result
    });
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send test notification',
      code: 'TEST_NOTIFICATION_ERROR'
    });
  }
});

// Send notification to specific user
router.post('/send', auth, generalRateLimit, async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ 
        error: 'userId, title, and body are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const User = require('../models/User');
    const targetUser = await User.findOne({ userId, isActive: true });
    
    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!targetUser.deviceTokens || targetUser.deviceTokens.length === 0) {
      return res.status(400).json({ 
        error: 'No device tokens found for target user',
        code: 'NO_DEVICE_TOKENS'
      });
    }

    const payload = {
      title,
      body,
      data: data || {}
    };

    const result = await sendPushNotification(targetUser.deviceTokens, payload);

    console.log(`📤 Notification sent from ${req.user.email} to ${targetUser.email}`);

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      sentTo: targetUser.deviceTokens.length,
      results: result
    });
  } catch (error) {
    console.error('❌ Send notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      code: 'SEND_NOTIFICATION_ERROR'
    });
  }
});

// Get notification settings
router.get('/settings', auth, generalRateLimit, async (req, res) => {
  try {
    const settings = req.user.preferences?.notifications || {
      calls: true,
      emergencies: true,
      marketing: false
    };

    res.json({ 
      success: true, 
      settings: {
        ...settings,
        deviceTokens: req.user.deviceTokens?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Get notification settings error:', error);
    res.status(500).json({ 
      error: 'Failed to get notification settings',
      code: 'GET_SETTINGS_ERROR'
    });
  }
});

// Update notification settings
router.put('/settings', auth, generalRateLimit, async (req, res) => {
  try {
    const { calls, emergencies, marketing } = req.body;

    const updatedSettings = {
      calls: calls !== undefined ? calls : true,
      emergencies: emergencies !== undefined ? emergencies : true,
      marketing: marketing !== undefined ? marketing : false
    };

    req.user.preferences = {
      ...req.user.preferences,
      notifications: updatedSettings
    };

    await req.user.save();

    console.log(`⚙️ Notification settings updated for user ${req.user.email}`);

    res.json({ 
      success: true, 
      settings: updatedSettings,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('❌ Update notification settings error:', error);
    res.status(500).json({ 
      error: 'Failed to update notification settings',
      code: 'UPDATE_SETTINGS_ERROR'
    });
  }
});

// Send bulk notification (Admin feature)
router.post('/bulk', auth, generalRateLimit, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin privileges required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { userIds, title, body, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return res.status(400).json({ 
        error: 'userIds (array), title, and body are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const payload = {
      title,
      body,
      data: data || {}
    };

    const result = await sendBulkNotification(userIds, payload);

    console.log(`📢 Bulk notification sent by admin ${req.user.email} to ${userIds.length} users`);

    res.json({ 
      success: true, 
      message: 'Bulk notification sent successfully',
      targetUsers: userIds.length,
      results: result
    });
  } catch (error) {
    console.error('❌ Bulk notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send bulk notification',
      code: 'BULK_NOTIFICATION_ERROR'
    });
  }
});

module.exports = router;