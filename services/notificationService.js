const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { checkTimeSync } = require('../services/timeSync');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Load service account JSON from config directory
    const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
    
    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    // Validate required fields in service account
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in service account: ${missingFields.join(', ')}`);
    }
    
    // Log initialization details for debugging
    console.log('🔧 Firebase Admin SDK Initialization:');
    console.log('   📁 Service account path:', serviceAccountPath);
    console.log('   🔑 Service account email:', serviceAccount.client_email);
    console.log('   🆔 Project ID:', serviceAccount.project_id);
    console.log('   🕐 Current server time:', new Date().toISOString());
    console.log('   🌐 Current UTC time:', new Date().toUTCString());

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting Firebase Authentication Issues:');
    console.error('   1. Check if your server time is synchronized');
    console.error('   2. Verify your service account key is valid at:');
    console.error('      https://console.firebase.google.com/iam-admin/serviceaccounts/project');
    console.error('   3. Generate a new service account key if needed');
    console.error('   4. Ensure the service account has proper permissions');
    console.error('');
    
    // Check time synchronization
    checkTimeSync();
    
    throw error; // Re-throw to prevent app from starting with invalid config
  }
}

/**
 * Validate device token format
 * @param {string} token - The device token to validate
 * @returns {boolean} - Whether the token is valid
 */
const isValidToken = (token) => {
  return token && 
         typeof token === 'string' && 
         token.length > 10 && 
         token !== 'NOTOKEN' &&
         !token.includes('undefined') &&
         !token.includes('null');
};

/**
 * Get masked token for logging (shows first 20 chars + ...)
 * @param {string} token - The token to mask
 * @returns {string} - Masked token for safe logging
 */
const getMaskedToken = (token) => {
  if (!token || token.length < 20) return 'invalid-token';
  return `${token.substring(0, 20)}...`;
};

/**
 * Fetch device tokens from external API with proper error handling
 * @param {string|number} userId - The user ID to fetch tokens for
 * @returns {Promise<string[]>} - Array of valid device tokens
 */
const fetchDeviceTokens = async (userId) => {
  try {
    console.log(`🔍 Fetching device tokens for user ID: ${userId}`);
    
    const response = await fetch(`https://api.torqiot.in/api/token/GetTokenByUserId/${userId}`, {
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Token API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📱 Token API response structure:', {
      hasResult: !!result.result,
      hasData: !!result.data,
      hasAndroid: !!(result.data && result.data.android),
      androidTokenCount: result.data && result.data.android ? result.data.android.length : 0
    });
    
    if (!result.result || !result.data || !Array.isArray(result.data.android)) {
      throw new Error('Invalid token API response structure');
    }
    
    // Filter and validate tokens
    const allTokens = result.data.android;
    const validTokens = allTokens.filter(isValidToken);
    const invalidTokens = allTokens.filter(token => !isValidToken(token));
    
    console.log(`📊 Token validation results:`);
    console.log(`   ✅ Valid tokens: ${validTokens.length}`);
    console.log(`   ❌ Invalid tokens: ${invalidTokens.length}`);
    
    if (invalidTokens.length > 0) {
      console.log(`   🗑️  Invalid tokens found:`, invalidTokens.map(t => t || 'null/undefined'));
    }
    
    if (validTokens.length === 0) {
      throw new Error('No valid device tokens found for this user');
    }
    
    console.log(`   📱 Valid tokens:`, validTokens.map(getMaskedToken));
    return validTokens;
    
  } catch (error) {
    console.error('❌ Failed to fetch device tokens:', error.message);
    throw error;
  }
};

/**
 * Send notification to a single device token
 * @param {string} token - The device token
 * @param {object} message - The FCM message object
 * @returns {Promise<object>} - Result of the send operation
 */
const sendToSingleToken = async (token, message) => {
  const maskedToken = getMaskedToken(token);
  
  try {
    // Validate token format before sending
    if (!isValidToken(token)) {
      throw new Error('Invalid token format');
    }
    
    console.log(`📤 Sending notification to token: ${maskedToken}`);
    
    const response = await admin.messaging().send({
      ...message,
      token
    });
    
    console.log(`✅ Notification sent successfully to: ${maskedToken}`);
    console.log(`   📋 Message ID: ${response}`);
    
    return { 
      success: true, 
      token: maskedToken, 
      messageId: response,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to send notification to: ${maskedToken}`);
    console.error(`   🔍 Error code: ${error.code || 'unknown'}`);
    console.error(`   💬 Error message: ${error.message}`);
    
    // Provide specific guidance based on error type
    if (error.code === 'messaging/invalid-registration-token') {
      console.error(`   💡 Token ${maskedToken} is invalid and should be removed from database`);
    } else if (error.code === 'messaging/registration-token-not-registered') {
      console.error(`   💡 Token ${maskedToken} is no longer registered and should be removed`);
    } else if (error.code === 'messaging/invalid-argument') {
      console.error(`   💡 Invalid message format or token format issue`);
    } else if (error.message.includes('invalid_grant') || error.message.includes('Invalid JWT Signature')) {
      console.error(`   🔧 Firebase credential issue detected:`);
      console.error(`      - Check server time synchronization`);
      console.error(`      - Verify service account key is not revoked`);
      console.error(`      - Generate new service account key if needed`);
    }
    
    return { 
      success: false, 
      token: maskedToken, 
      error: error.message,
      errorCode: error.code || 'unknown',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send push notification to all device tokens for a user.
 * @param {string|number} userId - The user ID to fetch tokens for.
 * @param {object} payload - The notification payload (title, body, data, etc).
 * @returns {Promise<object>} - Result of notification sending.
 */
const sendPushNotification = async (userId, payload) => {
  const startTime = Date.now();
  
  try {
    console.log('');
    console.log('🚀 Starting push notification process...');
    console.log(`   👤 User ID: ${userId}`);
    console.log(`   📝 Title: ${payload.title}`);
    console.log(`   💬 Body: ${payload.body}`);
    console.log(`   📊 Data keys: ${Object.keys(payload.data || {}).join(', ') || 'none'}`);
    
    // Verify Firebase Admin is properly initialized
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK is not initialized');
    }
    
    // Fetch device tokens
    const deviceTokens = await fetchDeviceTokens(userId);
    
    // Ensure all data values are strings (FCM requirement)
    const dataPayload = Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [
        k, 
        typeof v === 'string' ? v : JSON.stringify(v)
      ])
    );

    // Build FCM message
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...dataPayload,
        timestamp: new Date().toISOString(),
        userId: String(userId)
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

    console.log(`📤 Sending notifications to ${deviceTokens.length} devices...`);

    // Send to all devices concurrently
    const promises = deviceTokens.map(token => sendToSingleToken(token, message));
    const results = await Promise.all(promises);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const duration = Date.now() - startTime;

    console.log('');
    console.log('📊 NOTIFICATION SUMMARY:');
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   📈 Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);

    if (successful.length > 0) {
      console.log('');
      console.log('✅ SUCCESSFUL NOTIFICATIONS:');
      successful.forEach((result, index) => {
        console.log(`   ${index + 1}. Token: ${result.token} | Message ID: ${result.messageId}`);
      });
    }

    if (failed.length > 0) {
      console.log('');
      console.log('❌ FAILED NOTIFICATIONS:');
      failed.forEach((result, index) => {
        console.log(`   ${index + 1}. Token: ${result.token}`);
        console.log(`      Error: ${result.error}`);
        console.log(`      Code: ${result.errorCode}`);
      });
      
      // Group errors by type for better insights
      const errorGroups = failed.reduce((groups, result) => {
        const errorType = result.errorCode || 'unknown';
        if (!groups[errorType]) groups[errorType] = [];
        groups[errorType].push(result);
        return groups;
      }, {});
      
      console.log('');
      console.log('📋 ERROR BREAKDOWN:');
      Object.entries(errorGroups).forEach(([errorType, errors]) => {
        console.log(`   ${errorType}: ${errors.length} occurrences`);
      });
    }

    console.log('');

    return {
      success: successful.length > 0,
      totalSent: successful.length,
      totalFailed: failed.length,
      successRate: (successful.length / results.length) * 100,
      duration,
      results,
      summary: {
        successful: successful.map(r => ({ token: r.token, messageId: r.messageId })),
        failed: failed.map(r => ({ token: r.token, error: r.error, errorCode: r.errorCode }))
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('');
    console.error('❌ PUSH NOTIFICATION SERVICE ERROR:');
    console.error(`   ⏱️  Duration: ${duration}ms`);
    console.error(`   💬 Error: ${error.message}`);
    
    // Provide specific guidance based on error type
    if (error.message.includes('invalid_grant') || error.message.includes('Invalid JWT Signature')) {
      console.error('');
      console.error('🔧 FIREBASE AUTHENTICATION FIX REQUIRED:');
      console.error('   1. Sync your server time:');
      console.error('      Linux/Mac: sudo ntpdate -s time.nist.gov');
      console.error('      Windows: w32tm /resync (as Administrator)');
      console.error('   2. Or generate a new service account key:');
      console.error('      https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk');
      console.error('   3. Replace the firebase-service-account.json file');
    } else if (error.message.includes('fetch device tokens')) {
      console.error('');
      console.error('🔧 TOKEN API FIX REQUIRED:');
      console.error('   1. Check if the token API is accessible');
      console.error('   2. Verify the user ID exists in the system');
      console.error('   3. Check API endpoint URL and authentication');
    }
    
    console.error('');
    throw error;
  }
};

const sendBulkNotification = async (userIds, payload) => {
  console.log('🚀 Starting bulk notification process...');
  console.log(`   👥 User count: ${userIds.length}`);
  
  const results = [];
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  for (const userId of userIds) {
    try {
      const result = await sendPushNotification(userId, payload);
      results.push({ userId, ...result });
      totalSuccessful += result.totalSent;
      totalFailed += result.totalFailed;
    } catch (error) {
      console.error(`❌ Failed to send notification to user ${userId}:`, error.message);
      results.push({ 
        userId, 
        success: false, 
        error: error.message,
        totalSent: 0,
        totalFailed: 1
      });
      totalFailed++;
    }
  }
  
  console.log('');
  console.log('📊 BULK NOTIFICATION SUMMARY:');
  console.log(`   👥 Users processed: ${userIds.length}`);
  console.log(`   ✅ Total successful notifications: ${totalSuccessful}`);
  console.log(`   ❌ Total failed notifications: ${totalFailed}`);
  console.log('');
  
  return {
    success: totalSuccessful > 0,
    totalUsers: userIds.length,
    totalSuccessful,
    totalFailed,
    results
  };
};

module.exports = {
  sendPushNotification,
  sendBulkNotification
};