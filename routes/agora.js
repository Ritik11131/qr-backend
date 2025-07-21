const express = require('express');
const { generateAgoraToken } = require('../services/agoraService');
const { auth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// Generate Agora token
router.post('/token', auth, generalRateLimit, async (req, res) => {
  try {
    const { channelName, uid, role } = req.body;
    
    if (!channelName || !uid) {
      return res.status(400).json({ 
        error: 'Channel name and UID are required',
        code: 'MISSING_PARAMETERS'
      });
    }
    
    const token = generateAgoraToken(channelName, uid, role);
    
    console.log(`🎤 Agora token generated for user ${req.user.userId}, channel: ${channelName}`);
    
    res.json({
      success: true,
      token,
      appId: process.env.AGORA_APP_ID,
      channelName,
      uid,
      expiresIn: '24 hours'
    });
  } catch (error) {
    console.error('❌ Agora token generation error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'AGORA_TOKEN_ERROR'
    });
  }
});

// Get Agora app configuration
router.get('/config', auth, generalRateLimit, async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        appId: process.env.AGORA_APP_ID,
        features: {
          audio: true,
          video: true,
          recording: false,
          streaming: false
        },
        limits: {
          maxChannelUsers: 17,
          tokenExpiryHours: 24
        }
      }
    });
  } catch (error) {
    console.error('❌ Agora config error:', error);
    res.status(500).json({ 
      error: 'Failed to get Agora configuration',
      code: 'AGORA_CONFIG_ERROR'
    });
  }
});

module.exports = router;