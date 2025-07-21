const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const generateAgoraToken = (channelName, uid, role = 'publisher') => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  
  if (!appId || !appCertificate) {
    throw new Error('Agora credentials not configured');
  }

  // Token expires in 24 hours
  const expirationTimeInSeconds = 3600 * 24;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  // Convert string UID to number if needed
  const numericUid = typeof uid === 'string' ? 
    parseInt(uid.replace(/\D/g, '').substring(0, 10)) || 0 : uid;

  const roleType = role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      roleType,
      privilegeExpiredTs
    );

    return token;
  } catch (error) {
    console.error('Error generating Agora token:', error);
    throw new Error('Failed to generate voice call token');
  }
};

module.exports = {
  generateAgoraToken
};