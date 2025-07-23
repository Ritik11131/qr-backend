const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const config = require('../config/app');

const APP_ID = config.get('agora.appId');
const APP_CERTIFICATE = config.get('agora.appCertificate');

const generateAgoraToken = (channelName, uid, role = RtcRole.PUBLISHER, expireTime = null) => {
    if (!APP_ID || !APP_CERTIFICATE) {
        throw new Error('Agora configuration is missing. Please check AGORA_APP_ID and AGORA_APP_CERTIFICATE.');
    }

    const tokenExpiry = expireTime || config.get('agora.tokenExpiryTime');
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + tokenExpiry;
    
    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uid,
            role,
            privilegeExpireTime
        );
        
        console.log(`🎤 Agora token generated for channel: ${channelName}, UID: ${uid}`);
        return token;
    } catch (error) {
        console.error('❌ Failed to generate Agora token:', error);
        throw new Error(`Agora token generation failed: ${error.message}`);
    }
};

const validateAgoraConfig = () => {
    const errors = [];
    
    if (!APP_ID) {
        errors.push('AGORA_APP_ID is required');
    }
    
    if (!APP_CERTIFICATE) {
        errors.push('AGORA_APP_CERTIFICATE is required');
    }
    
    if (errors.length > 0) {
        throw new Error(`Agora configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
};

const getAgoraConfig = () => {
    return {
        appId: APP_ID,
        maxChannelUsers: config.get('agora.maxChannelUsers'),
        tokenExpiryTime: config.get('agora.tokenExpiryTime'),
        isConfigured: !!(APP_ID && APP_CERTIFICATE)
    };
};

module.exports = {
    generateAgoraToken,
    validateAgoraConfig,
    getAgoraConfig
};