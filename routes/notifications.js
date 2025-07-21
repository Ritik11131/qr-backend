const express = require('express');
const { sendPushNotification, sendBulkNotification } = require('../services/notificationService');
const { auth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// Send test notification
router.post('/test', auth, generalRateLimit, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const userId = req.user.user_id;
    if (!userId) {
      return res.status(400).json({ error: 'No user_id in JWT', code: 'NO_USER_ID' });
    }
    const result = await sendPushNotification(userId, { title, body, data });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Failed to send test notification',
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
    const result = await sendPushNotification(userId, { title, body, data });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Failed to send notification',
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

    // Device tokens must be managed externally now. Notification sending is a stub.
    return res.status(501).json({
      error: 'Notification sending is not implemented. Device tokens must be managed externally.',
      code: 'NOTIFICATION_NOT_IMPLEMENTED'
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