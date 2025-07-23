const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Call = require('../models/Call');
const QRCode = require('../models/QRCode');
const Device = require('../models/Device');
const { sendPushNotification } = require('../services/notificationService');
const { generateAgoraToken } = require('../services/agoraService');
const maskedCallingService = require('../services/maskedCallingService');
const { auth } = require('../middleware/auth');
const { callRateLimit, generalRateLimit } = require('../middleware/rateLimiter');
const { validateCallInitiation } = require('../middleware/validation');
const config = require('../config/app');

const router = express.Router();

// Enhanced call initiation for device-linked QR codes
router.post('/initiate', callRateLimit, validateCallInitiation, async (req, res) => {
  try {
    const { 
      qrId, 
      callType = 'audio', 
      callerInfo, 
      emergencyType = 'general', 
      urgencyLevel = 'medium',
      callMethod = 'direct' // 'direct' or 'masked'
    } = req.body;

    console.log(`📞 Call initiation request for QR: ${qrId}`);
    console.log(`   📱 Call method: ${callMethod}`);
    console.log(`   🚨 Emergency type: ${emergencyType}`);

    // Find QR code
    const qrCode = await QRCode.findOne({ qrId, isActive: true });
    if (!qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found or inactive',
        code: 'QR_NOT_FOUND'
      });
    }

    // Check if QR is linked
    if (qrCode.status !== 'linked') {
      return res.status(400).json({
        error: 'QR code is not linked to any device',
        status: qrCode.status,
        message: 'This QR code has not been activated yet. Please contact the vehicle owner.',
        code: 'QR_NOT_LINKED'
      });
    }

    // Get device info
    const device = await Device.findOne({
      deviceId: qrCode.linkedTo.deviceId,
      status: 'active'
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found or inactive',
        code: 'DEVICE_NOT_FOUND'
      });
    }

    // Check if anonymous calls are allowed
    if (!device.settings.allowAnonymousCalls) {
      return res.status(403).json({
        error: 'Anonymous calls are not allowed for this device',
        code: 'ANONYMOUS_CALLS_DISABLED'
      });
    }

    // Validate call method
    if (callMethod === 'masked' && !maskedCallingService.isAvailable()) {
      return res.status(400).json({
        error: 'Masked calling is not available',
        code: 'MASKED_CALLING_UNAVAILABLE',
        availableMethods: ['direct']
      });
    }

    // For masked calls, validate phone numbers
    if (callMethod === 'masked') {
      if (!callerInfo?.phone) {
        return res.status(400).json({
          error: 'Caller phone number is required for masked calling',
          code: 'CALLER_PHONE_REQUIRED'
        });
      }
      
      // We'll need the receiver's phone number from their profile
      // For now, we'll assume it's available in device settings or user profile
      // This would need to be implemented based on your user management system
    }
    // Generate unique call ID and channel name
    const callId = uuidv4();
    const channelName = `emergency_${callId}`;

    // Enhanced caller info with emergency context
    const enhancedCallerInfo = {
      name: callerInfo?.name || 'Anonymous Caller',
      phone: callerInfo?.phone || null,
      location: callerInfo?.location || 'Unknown location',
      emergencyType,
      urgencyLevel,
      description: callerInfo?.description || '',
      additionalInfo: callerInfo?.additionalInfo || '',
      deviceId: device.deviceId,
      timestamp: new Date()
    };

    // Create enhanced call record
    const call = new Call({
      callId,
      callerId: null, // Anonymous caller
      receiverId: qrCode.linkedTo.userId,
      qrCodeId: qrId,
      channelName,
      callType,
      callMethod, // Add call method to record
      status: 'initiated',
      callerInfo: enhancedCallerInfo,
      deviceInfo: {
        deviceId: device.deviceId
      },
      anonymousCall: true,
      isEmergency: emergencyType !== 'general',
      timing: {
        initiatedAt: new Date()
      }
    });

    await call.save();

    // Update QR code stats
    qrCode.stats.callCount += 1;
    qrCode.stats.lastCalled = new Date();
    if (emergencyType && emergencyType !== 'general') {
      qrCode.stats.emergencyCallCount += 1;
    }
    await qrCode.save();

    let callResponse = {
      success: true,
      callId,
      callMethod,
      receiver: {
        userId: qrCode.linkedTo.userId,
        name: qrCode.emergencyInfo.showOwnerName ? 'Vehicle Owner' : 'Vehicle Owner',
        avatar: ''
      },
      deviceInfo: {
        deviceId: device.deviceId
      },
      emergencyInfo: qrCode.emergencyInfo,
      callContext: {
        emergencyType,
        urgencyLevel,
        isEmergency: emergencyType !== 'general'
      }
    };

    // Handle different call methods
    if (callMethod === 'masked') {
      try {
        // For masked calling, we need the receiver's phone number
        // This should come from user profile or device settings
        const receiverPhone = device.settings.emergencyContacts?.[0]?.phone || 
                             device.owner.phone || // Assuming phone is stored in owner
                             '+1234567890'; // Fallback - should be properly implemented

        const maskedCallData = {
          callId,
          callerPhone: callerInfo.phone,
          receiverPhone,
          callbackUrl: `${config.get('urls.api')}/api/calls/webhook/masked`,
          metadata: {
            qrId,
            emergencyType,
            urgencyLevel,
            deviceId: device.deviceId
          }
        };

        const maskedResult = await maskedCallingService.initiateMaskedCall(maskedCallData);
        
        // Update call record with masked call info
        call.maskedCallInfo = {
          maskedCallId: maskedResult.maskedCallId,
          callerMaskedNumber: maskedResult.callerMaskedNumber,
          receiverMaskedNumber: maskedResult.receiverMaskedNumber
        };
        await call.save();

        callResponse.maskedCallInfo = maskedResult;
        callResponse.message = 'Masked call initiated. Both parties will receive calls from masked numbers.';

      } catch (maskedError) {
        console.error('❌ Masked call failed, falling back to direct call:', maskedError.message);
        
        // Fall back to direct call
        callMethod = 'direct';
        call.callMethod = 'direct';
        call.callerInfo.additionalInfo += ` (Masked call failed: ${maskedError.message})`;
        await call.save();
      }
    }

    // For direct calls or masked call fallback, use Agora
    if (callMethod === 'direct') {
      // Generate Agora tokens
      const callerUID = `caller_${callId}`;
      const receiverUID = `owner_${qrCode.linkedTo.userId}`;
      const callerToken = generateAgoraToken(channelName, callerUID);
      const receiverToken = generateAgoraToken(channelName, receiverUID);

      callResponse.callerUID = callerUID;
      callResponse.channelName = channelName;
      callResponse.token = callerToken;
      callResponse.appId = config.get('agora.appId');
      callResponse.message = emergencyType !== 'general'
        ? 'Emergency call initiated. The vehicle owner will be notified immediately with high priority.'
        : 'Call initiated successfully. The vehicle owner will be notified.';
    }

    // Determine notification priority and content
    const isEmergency = emergencyType !== 'general';
    const isHighUrgency = urgencyLevel === 'high' || urgencyLevel === 'critical';

    let notificationTitle = '📞 Vehicle Contact';
    let notificationBody = `${callerInfo?.name || 'Someone'} wants to contact you about your vehicle.`;

    if (isEmergency) {
      notificationTitle = urgencyLevel === 'critical' ? '🚨 CRITICAL EMERGENCY' : '⚠️ Emergency Call';
      notificationBody = `URGENT: ${emergencyType.toUpperCase()} involving your vehicle.`;
    }

    // Enhanced push notification
    let notificationData = {
      title: notificationTitle,
      body: notificationBody,
      data: {
        callId,
        callerUID: callResponse.callerUID || '',
        channelName,
        callType,
        callMethod,
        token: callMethod === 'direct' ? generateAgoraToken(channelName, `owner_${qrCode.linkedTo.userId}`) : '',
        callerInfo: JSON.stringify(enhancedCallerInfo),
        deviceInfo: JSON.stringify({ deviceId: device.deviceId }),
        emergencyType,
        urgencyLevel,
        priority: isHighUrgency ? 'high' : 'normal',
        qrId
      }
    };
    // Ensure all data values are strings
    notificationData.data = Object.fromEntries(
      Object.entries(notificationData.data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    );

    // Send push notification to the receiver (vehicle owner)
    try {
      await sendPushNotification(qrCode.linkedTo.userId, notificationData);
    } catch (notifError) {
      console.error('❌ Push notification error:', notifError.message);
      // Do not block the main flow if notification fails
    }

    console.log(`✅ Call ${callId} initiated successfully`);

    res.json(callResponse);
  } catch (error) {
    console.error('❌ Error initiating call:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_INITIATION_ERROR'
    });
  }
});

// Webhook endpoint for masked calling service
router.post('/webhook/masked', generalRateLimit, async (req, res) => {
  try {
    console.log('🔔 Masked calling webhook received:', req.body);
    
    const webhookData = maskedCallingService.handleWebhook(req.body);
    
    // Find the call record
    const call = await Call.findOne({ 
      callId: webhookData.originalCallId 
    });
    
    if (call) {
      // Update call status based on webhook
      switch (webhookData.eventType) {
        case 'call_answered':
          call.status = 'answered';
          call.timing.answeredAt = webhookData.timestamp;
          break;
        case 'call_ended':
          call.status = 'ended';
          call.timing.endedAt = webhookData.timestamp;
          call.timing.duration = webhookData.duration || 0;
          break;
        case 'call_failed':
          call.status = 'failed';
          call.timing.endedAt = webhookData.timestamp;
          break;
      }
      
      await call.save();
      
      // Emit socket event to update clients
      const io = req.app.get('io');
      if (io) {
        io.to(call.receiverId).emit('masked-call-update', {
          callId: call.callId,
          status: call.status,
          eventType: webhookData.eventType,
          timestamp: webhookData.timestamp
        });
      }
    }
    
    res.json({ success: true, received: true });
  } catch (error) {
    console.error('❌ Masked calling webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      code: 'WEBHOOK_ERROR'
    });
  }
});
// Answer call (AUTH REQUIRED - Only the QR owner can answer)
router.post('/:callId/answer', auth, generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.user_id;

    console.log(`✅ User ${userId} attempting to answer call ${callId}`);

    const call = await Call.findOne({ callId, receiverId: userId });
    if (!call) {
      return res.status(404).json({
        error: 'Call not found or you are not authorized to answer this call',
        code: 'CALL_NOT_FOUND'
      });
    }

    if (call.status !== 'initiated') {
      return res.status(400).json({
        error: `Call is not in initiated state. Current status: ${call.status}`,
        code: 'INVALID_CALL_STATUS'
      });
    }

    call.status = 'answered';
    call.timing.answeredAt = new Date();
    await call.save();

    let responseData = {
      success: true,
      message: 'Call answered successfully',
      callId: call.callId,
      callMethod: call.callMethod,
      callerInfo: call.callerInfo,
      deviceInfo: call.deviceInfo,
      callContext: {
        emergencyType: call.callerInfo.emergencyType,
        urgencyLevel: call.callerInfo.urgencyLevel,
        isEmergency: call.callerInfo.emergencyType !== 'general'
      }
    };

    // Handle response based on call method
    if (call.callMethod === 'masked') {
      // For masked calls, the actual connection is handled by the masked calling service
      responseData.maskedCallInfo = call.maskedCallInfo;
      responseData.message = 'Masked call answered. Connection established through masked numbers.';
    } else {
      // For direct calls, provide Agora token
      const receiverUID = `owner_${userId}`;
      const receiverToken = generateAgoraToken(call.channelName, receiverUID);
      
      responseData.channelName = call.channelName;
      responseData.token = receiverToken;
      responseData.appId = config.get('agora.appId');
    }

    console.log(`📞 Call ${callId} answered successfully`);

    res.json(responseData);
  } catch (error) {
    console.error('❌ Error answering call:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_ANSWER_ERROR'
    });
  }
});

// Reject call (AUTH REQUIRED - Only the QR owner can reject)
router.post('/:callId/reject', auth, generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;
    const { reason } = req.body;
    const userId = req.user.user_id;

    console.log(`❌ User ${userId} rejecting call ${callId}`);

    const call = await Call.findOne({ callId, receiverId: userId });
    if (!call) {
      return res.status(404).json({
        error: 'Call not found or you are not authorized to reject this call',
        code: 'CALL_NOT_FOUND'
      });
    }

    if (call.status !== 'initiated') {
      return res.status(400).json({
        error: `Call is not in initiated state. Current status: ${call.status}`,
        code: 'INVALID_CALL_STATUS'
      });
    }

    // Handle masked call rejection
    if (call.callMethod === 'masked' && call.maskedCallInfo?.maskedCallId) {
      try {
        await maskedCallingService.endMaskedCall(call.maskedCallInfo.maskedCallId);
      } catch (maskedError) {
        console.error('❌ Failed to end masked call:', maskedError.message);
        // Continue with rejection even if masked call end fails
      }
    }
    call.status = 'rejected';
    call.timing.endedAt = new Date();
    call.endedBy = 'receiver';
    if (reason) {
      call.callerInfo.additionalInfo = `Rejected: ${reason}`;
    }
    await call.save();

    console.log(`🚫 Call ${callId} rejected`);

    res.json({
      success: true,
      message: 'Call rejected successfully'
    });
  } catch (error) {
    console.error('❌ Error rejecting call:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_REJECT_ERROR'
    });
  }
});

// End call (Can be called by anyone in the call)
router.post('/:callId/end', generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;
    const { duration, endedBy, callQuality } = req.body;

    console.log(`📴 Ending call ${callId}`);

    const call = await Call.findOne({ callId });
    if (!call) {
      return res.status(404).json({ 
        error: 'Call not found',
        code: 'CALL_NOT_FOUND'
      });
    }

    if (call.status === 'ended') {
      return res.status(400).json({ 
        error: 'Call already ended',
        code: 'CALL_ALREADY_ENDED'
      });
    }

    // Handle masked call ending
    if (call.callMethod === 'masked' && call.maskedCallInfo?.maskedCallId) {
      try {
        const maskedResult = await maskedCallingService.endMaskedCall(call.maskedCallInfo.maskedCallId);
        // Use duration from masked calling service if available
        if (maskedResult.duration && !duration) {
          call.timing.duration = maskedResult.duration;
        }
      } catch (maskedError) {
        console.error('❌ Failed to end masked call:', maskedError.message);
        // Continue with ending the call record
      }
    }
    call.status = 'ended';
    call.timing.endedAt = new Date();
    call.timing.duration = duration || 0;
    call.endedBy = endedBy || 'unknown';

    if (callQuality) {
      call.callQuality = callQuality;
    }

    await call.save();

    console.log(`✅ Call ${callId} ended. Duration: ${call.timing.duration}s`);

    res.json({
      success: true,
      message: 'Call ended successfully',
      duration: call.timing.duration,
      callId: call.callId
    });
  } catch (error) {
    console.error('❌ Error ending call:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_END_ERROR'
    });
  }
});

// Get call status (No auth required - anonymous caller can check status)
router.get('/:callId/status', generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findOne({ callId });
    if (!call) {
      return res.status(404).json({ 
        error: 'Call not found',
        code: 'CALL_NOT_FOUND'
      });
    }

    let statusResponse = {
      success: true,
      status: call.status,
      callId: call.callId,
      callMethod: call.callMethod,
      duration: call.timing.duration,
      answeredAt: call.timing.answeredAt,
      endedAt: call.timing.endedAt,
      emergencyType: call.callerInfo.emergencyType,
      urgencyLevel: call.callerInfo.urgencyLevel,
      isEmergency: call.isEmergency
    };

    // Add masked call info if available
    if (call.callMethod === 'masked' && call.maskedCallInfo) {
      try {
        const maskedStatus = await maskedCallingService.getMaskedCallStatus(call.maskedCallInfo.maskedCallId);
        statusResponse.maskedCallStatus = maskedStatus;
      } catch (maskedError) {
        console.error('❌ Failed to get masked call status:', maskedError.message);
        // Don't fail the request, just omit masked status
      }
    }
    res.json(statusResponse);
  } catch (error) {
    console.error('❌ Error getting call status:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_STATUS_ERROR'
    });
  }
});

// Get available call methods
router.get('/methods', generalRateLimit, async (req, res) => {
  try {
    const methods = [
      {
        method: 'direct',
        name: 'Direct Voice Call',
        description: 'Connect directly through the app using Agora voice calling',
        available: true,
        requiresPhone: false
      }
    ];

    if (maskedCallingService.isAvailable()) {
      methods.push({
        method: 'masked',
        name: 'Masked Number Call',
        description: 'Call with number privacy protection using masked phone numbers',
        available: true,
        requiresPhone: true
      });
    }

    res.json({
      success: true,
      methods,
      defaultMethod: 'direct',
      maskedCallingConfig: maskedCallingService.getConfig()
    });
  } catch (error) {
    console.error('❌ Error getting call methods:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_METHODS_ERROR'
    });
  }
});
// Get enhanced call history with device context
router.get('/history', auth, generalRateLimit, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      deviceId, 
      emergencyOnly, 
      emergencyType, 
      callMethod,
      dateFrom, 
      dateTo 
    } = req.query;
    const userId = req.user.user_id;

    console.log(`📋 User ${userId} requesting call history`);

    const filter = {
      $or: [{ callerId: userId }, { receiverId: userId }]
    };

    // Filter by device if specified
    if (deviceId) {
      filter['deviceInfo.deviceId'] = deviceId;
    }

    // Filter by call method
    if (callMethod && ['direct', 'masked'].includes(callMethod)) {
      filter.callMethod = callMethod;
    }
    // Filter emergency calls only
    if (emergencyOnly === 'true') {
      filter['callerInfo.emergencyType'] = { $ne: 'general' };
    }

    // Filter by specific emergency type
    if (emergencyType && emergencyType !== 'all') {
      filter['callerInfo.emergencyType'] = emergencyType;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const calls = await Call.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Populate with device and user details
    const populatedCalls = await Promise.all(
      calls.map(async (call) => {
        let caller = null;
        if (call.callerId) {
          caller = {
            name: call.callerInfo?.name || 'Anonymous Caller',
            avatar: '',
            isAnonymous: true,
            emergencyType: call.callerInfo?.emergencyType || 'general',
            urgencyLevel: call.callerInfo?.urgencyLevel || 'medium'
          };
        }

        const receiver = { name: 'Unknown', avatar: '' };
        const device = null;

        return {
          ...call,
          caller: caller || {
            name: call.callerInfo?.name || 'Anonymous Caller',
            avatar: '',
            isAnonymous: true,
            emergencyType: call.callerInfo?.emergencyType || 'general',
            urgencyLevel: call.callerInfo?.urgencyLevel || 'medium'
          },
          receiver: receiver,
          device: device,
          isEmergency: call.callerInfo?.emergencyType !== 'general'
        };
      })
    );

    const totalCalls = await Call.countDocuments(filter);

    res.json({
      success: true,
      calls: populatedCalls,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCalls / limit),
        totalItems: totalCalls,
        itemsPerPage: Number(limit)
      },
      summary: {
        totalCalls,
        emergencyCalls: populatedCalls.filter(c => c.isEmergency).length,
        answeredCalls: populatedCalls.filter(c => c.status === 'answered' || c.status === 'ended').length,
        missedCalls: populatedCalls.filter(c => c.status === 'missed').length,
        directCalls: populatedCalls.filter(c => c.callMethod === 'direct').length,
        maskedCalls: populatedCalls.filter(c => c.callMethod === 'masked').length
      }
    });
  } catch (error) {
    console.error('❌ Error getting call history:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_HISTORY_ERROR'
    });
  }
});

// Get call details (AUTH REQUIRED - Only for logged-in users)
router.get('/:callId', auth, generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.user_id;

    const call = await Call.findOne({
      callId,
      $or: [{ callerId: userId }, { receiverId: userId }]
    });

    if (!call) {
      return res.status(404).json({ 
        error: 'Call not found',
        code: 'CALL_NOT_FOUND'
      });
    }

    // Populate user details
    let caller = null;
    if (call.callerId) {
      caller = {
        name: call.callerInfo?.name || 'Anonymous Caller',
        avatar: '',
        isAnonymous: true
      };
    }

    const receiver = { name: 'Unknown', avatar: '' };
    const device = null;

    let callDetails = {
      ...call.toObject(),
      caller: caller || {
        name: call.callerInfo?.name || 'Anonymous Caller',
        avatar: '',
        isAnonymous: true
      },
      receiver: receiver,
      device: device,
      isEmergency: call.callerInfo?.emergencyType !== 'general'
    };

    // Add masked call details if available
    if (call.callMethod === 'masked' && call.maskedCallInfo?.maskedCallId) {
      try {
        const maskedStatus = await maskedCallingService.getMaskedCallStatus(call.maskedCallInfo.maskedCallId);
        callDetails.maskedCallDetails = maskedStatus;
      } catch (maskedError) {
        console.error('❌ Failed to get masked call details:', maskedError.message);
        // Don't fail the request, just omit masked details
      }
    }
    res.json({
      success: true,
      call: callDetails
    });
  } catch (error) {
    console.error('❌ Error getting call details:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_DETAILS_ERROR'
    });
  }
});

module.exports = router;