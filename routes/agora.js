const express = require('express');
const { generateAgoraToken, getAgoraConfig } = require('../services/agoraService');
const { auth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/rateLimiter');
const config = require('../config/app');

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
    
    try {
      const token = generateAgoraToken(channelName, uid, role);
      
      console.log(`🎤 Agora token generated for user ${req.user.user_id}, channel: ${channelName}`);
      
      res.json({
        success: true,
        token,
        appId: config.get('agora.appId'),
        channelName,
        uid,
        expiresIn: `${config.get('agora.tokenExpiryTime')} seconds`
      });
    } catch (tokenError) {
      console.error('❌ Agora token generation failed:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to generate Agora token. Please check Agora configuration.',
        code: 'AGORA_TOKEN_GENERATION_FAILED'
      });
    }
    
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
    const agoraConfig = getAgoraConfig();
    
    res.json({
      success: true,
      config: {
        appId: agoraConfig.appId,
        isConfigured: agoraConfig.isConfigured,
        features: {
          audio: true,
          video: true,
          recording: false,
          streaming: false
        },
        limits: {
          maxChannelUsers: agoraConfig.maxChannelUsers,
          tokenExpirySeconds: agoraConfig.tokenExpiryTime
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