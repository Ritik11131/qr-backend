const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

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

const sendPushNotification = async (deviceTokens, payload) => {
  try {
    if (!deviceTokens || deviceTokens.length === 0) {
      throw new Error('No device tokens provided');
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...payload.data,
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
  try {
    const User = require('../models/User');
    const users = await User.find({ 
      userId: { $in: userIds },
      isActive: true 
    }, 'deviceTokens');

    const allTokens = users.reduce((tokens, user) => {
      return tokens.concat(user.deviceTokens || []);
    }, []);

    if (allTokens.length === 0) {
      throw new Error('No device tokens found for specified users');
    }

    return await sendPushNotification(allTokens, payload);
  } catch (error) {
    console.error('❌ Bulk notification error:', error);
    throw error;
  }
};

module.exports = {
  sendPushNotification,
  sendBulkNotification
};