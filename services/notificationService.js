const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Load service account JSON from config directory
    const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    console.log('✅ Firebase Admin SDK initialized with service account JSON');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}

/**
 * Send push notification to all device tokens for a user.
 * @param {string|number} userId - The user ID to fetch tokens for.
 * @param {object} payload - The notification payload (title, body, data, etc).
 * @returns {Promise<object>} - Result of notification sending.
 */
const sendPushNotification = async (userId, payload) => {
  try {
    // Fetch device tokens from external API
    const response = await fetch(`https://api.torqiot.in/api/token/GetTokenByUserId/${userId}`);
    if (!response.ok) throw new Error(`Failed to fetch tokens: ${response.status}`);
    const result = await response.json();
    if (!result.result || !result.data || !Array.isArray(result.data.android)) {
      throw new Error('Invalid token API response');
    }
    // Filter out invalid tokens
    const deviceTokens = result.data.android.filter(token => token && token !== 'NOTOKEN');
    if (deviceTokens.length === 0) {
      throw new Error('No valid device tokens found');
    }

    // Ensure all data values are strings
    const dataPayload = Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    );

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...dataPayload,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'emergency_calls'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1
          }
        }
      }
    };

    // Send to multiple devices
    const promises = deviceTokens.map(async (token) => {
      try {
        const response = await admin.messaging().send({
          ...message,
          token
        });
        console.log(`✅ Notification sent successfully to token: ${token.substring(0, 20)}...`);
        return { success: true, token, response };
      } catch (error) {
        console.error(`❌ Failed to send notification to token: ${token.substring(0, 20)}...`, error);
        return { success: false, token, error: error.message };
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📊 Notification results: ${successful} successful, ${failed} failed`);

    return {
      success: successful > 0,
      totalSent: successful,
      totalFailed: failed,
      results
    };
  } catch (error) {
    console.error('❌ Push notification service error:', error);
    throw error;
  }
};

const sendBulkNotification = async (userIds, payload) => {
  // Device tokens must be managed externally now. Notification sending is a stub.
  throw new Error('Bulk notification sending is not implemented. Device tokens must be managed externally.');
};

module.exports = {
  sendPushNotification
};