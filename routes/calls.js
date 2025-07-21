const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Call = require('../models/Call');
const User = require('../models/User');
const QRCode = require('../models/QRCode');
const Device = require('../models/Device');
const { sendPushNotification } = require('../services/notificationService');
const { generateAgoraToken } = require('../services/agoraService');
const { auth } = require('../middleware/auth');
const { callRateLimit, generalRateLimit } = require('../middleware/rateLimiter');
const { validateCallInitiation } = require('../middleware/validation');

const router = express.Router();

// Enhanced call initiation for device-linked QR codes
router.post('/initiate', callRateLimit, validateCallInitiation, async (req, res) => {
  try {
    const { qrId, callType = 'audio', callerInfo, emergencyType = 'general', urgencyLevel = 'medium' } = req.body;

    console.log(`📞 Call initiation request for QR: ${qrId}`);

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

    // Get device and owner info
    const device = await Device.findOne({
      deviceId: qrCode.linkedTo.deviceId,
      status: 'active'
    });
    
    const owner = await User.findOne({ 
      userId: qrCode.linkedTo.userId,
      isActive: true 
    });

    if (!device || !owner) {
      return res.status(404).json({
        error: 'Device or owner not found, or device is inactive',
        code: 'DEVICE_OWNER_NOT_FOUND'
      });
    }

    // Check if anonymous calls are allowed
    if (!device.settings.allowAnonymousCalls) {
      return res.status(403).json({
        error: 'Anonymous calls are not allowed for this device',
        code: 'ANONYMOUS_CALLS_DISABLED'
      });
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
      vehicleInfo: {
        type: device.vehicle.type,
        model: `${device.vehicle.make} ${device.vehicle.model}`,
        plate: device.vehicle.plateNumber,
        color: device.vehicle.color
      },
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
      status: 'initiated',
      callerInfo: enhancedCallerInfo,
      deviceInfo: {
        deviceId: device.deviceId,
        vehicleType: device.vehicle.type,
        vehicleModel: `${device.vehicle.make} ${device.vehicle.model}`,
        plateNumber: device.vehicle.plateNumber,
        vehicleColor: device.vehicle.color
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

    // Update device stats
    device.stats.totalCalls += 1;
    device.stats.lastCallDate = new Date();
    if (emergencyType !== 'general') {
      device.stats.emergencyCalls += 1;
    }
    await device.save();

    // Update user stats
    owner.stats.totalCalls += 1;
    if (emergencyType !== 'general') {
      owner.stats.emergencyCalls += 1;
    }
    await owner.save();

    // Generate Agora tokens
    const callerUID = `caller_${callId.substring(0, 8)}`;
    const receiverUID = `owner_${qrCode.linkedTo.userId.substring(0, 8)}`;
    const callerToken = generateAgoraToken(channelName, callerUID);
    const receiverToken = generateAgoraToken(channelName, receiverUID);

    // Determine notification priority and content
    const isEmergency = emergencyType !== 'general';
    const isHighUrgency = urgencyLevel === 'high' || urgencyLevel === 'critical';

    let notificationTitle = '📞 Vehicle Contact';
    let notificationBody = `${callerInfo?.name || 'Someone'} wants to contact you about your ${device.vehicle.type}`;

    if (isEmergency) {
      notificationTitle = urgencyLevel === 'critical' ? '🚨 CRITICAL EMERGENCY' : '⚠️ Emergency Call';
      notificationBody = `URGENT: ${emergencyType.toUpperCase()} involving your ${device.vehicle.type} (${device.vehicle.plateNumber})`;
    }

    // Enhanced push notification
    const notificationData = {
      title: notificationTitle,
      body: notificationBody,
      data: {
        callId,
        callerUID,
        channelName,
        callType,
        token: receiverToken,
        callerInfo: JSON.stringify(enhancedCallerInfo),
        deviceInfo: JSON.stringify(call.deviceInfo),
        emergencyType,
        urgencyLevel,
        priority: isHighUrgency ? 'high' : 'normal',
        qrId
      }
    };

    // Send push notification
    if (owner.deviceTokens && owner.deviceTokens.length > 0) {
      try {
        await sendPushNotification(owner.deviceTokens, notificationData);
        console.log(`📱 Push notification sent to ${owner.deviceTokens.length} devices`);
      } catch (notificationError) {
        console.error('❌ Push notification failed:', notificationError);
        // Don't fail the call if notification fails
      }
    }

    console.log(`✅ Call ${callId} initiated successfully`);

    // Return enhanced response
    res.json({
      success: true,
      callId,
      callerUID,
      channelName,
      token: callerToken,
      appId: process.env.AGORA_APP_ID,
      receiver: {
        userId: owner.userId,
        name: qrCode.emergencyInfo.showOwnerName ? owner.name : 'Vehicle Owner',
        avatar: owner.avatar
      },
      deviceInfo: {
        vehicleType: device.vehicle.type,
        vehicleModel: `${device.vehicle.make} ${device.vehicle.model}`,
        plateNumber: qrCode.emergencyInfo.showVehiclePlate ? device.vehicle.plateNumber : 'Hidden',
        color: device.vehicle.color
      },
      emergencyInfo: qrCode.emergencyInfo,
      callContext: {
        emergencyType,
        urgencyLevel,
        isEmergency
      },
      message: isEmergency
        ? 'Emergency call initiated. The vehicle owner will be notified immediately with high priority.'
        : 'Call initiated successfully. The vehicle owner will be notified.'
    });
  } catch (error) {
    console.error('❌ Error initiating call:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_INITIATION_ERROR'
    });
  }
});

// Answer call (AUTH REQUIRED - Only the QR owner can answer)
router.post('/:callId/answer', auth, generalRateLimit, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.userId;

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

    // Generate fresh token for the receiver
    const receiverUID = `owner_${userId.substring(0, 8)}`;
    const receiverToken = generateAgoraToken(call.channelName, receiverUID);

    console.log(`📞 Call ${callId} answered successfully`);

    res.json({
      success: true,
      message: 'Call answered successfully',
      channelName: call.channelName,
      token: receiverToken,
      appId: process.env.AGORA_APP_ID,
      callerInfo: call.callerInfo,
      deviceInfo: call.deviceInfo,
      callContext: {
        emergencyType: call.callerInfo.emergencyType,
        urgencyLevel: call.callerInfo.urgencyLevel,
        isEmergency: call.callerInfo.emergencyType !== 'general'
      }
    });
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
    const userId = req.user.userId;

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

    res.json({
      success: true,
      status: call.status,
      callId: call.callId,
      duration: call.timing.duration,
      answeredAt: call.timing.answeredAt,
      endedAt: call.timing.endedAt,
      emergencyType: call.callerInfo.emergencyType,
      urgencyLevel: call.callerInfo.urgencyLevel,
      isEmergency: call.isEmergency
    });
  } catch (error) {
    console.error('❌ Error getting call status:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'CALL_STATUS_ERROR'
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
      dateFrom, 
      dateTo 
    } = req.query;
    const userId = req.user.userId;

    console.log(`📋 User ${userId} requesting call history`);

    const filter = {
      $or: [{ callerId: userId }, { receiverId: userId }]
    };

    // Filter by device if specified
    if (deviceId) {
      filter['deviceInfo.deviceId'] = deviceId;
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
          caller = await User.findOne({ userId: call.callerId }, 'name avatar');
        }

        const receiver = await User.findOne({ userId: call.receiverId }, 'name avatar');

        // Get device info if available
        let device = null;
        if (call.deviceInfo?.deviceId) {
          device = await Device.findOne({ deviceId: call.deviceInfo.deviceId });
        }

        return {
          ...call,
          caller: caller || {
            name: call.callerInfo?.name || 'Anonymous Caller',
            avatar: '',
            isAnonymous: true,
            emergencyType: call.callerInfo?.emergencyType || 'general',
            urgencyLevel: call.callerInfo?.urgencyLevel || 'medium'
          },
          receiver: receiver || { name: 'Unknown', avatar: '' },
          device: device ? {
            vehicleType: device.vehicle.type,
            vehicleModel: `${device.vehicle.make} ${device.vehicle.model}`,
            plateNumber: device.vehicle.plateNumber,
            color: device.vehicle.color
          } : call.deviceInfo,
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
        missedCalls: populatedCalls.filter(c => c.status === 'missed').length
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
    const userId = req.user.userId;

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
      caller = await User.findOne({ userId: call.callerId }, 'name avatar');
    }

    const receiver = await User.findOne({ userId: call.receiverId }, 'name avatar');
    const device = await Device.findOne({ deviceId: call.deviceInfo?.deviceId });

    res.json({
      success: true,
      call: {
        ...call.toObject(),
        caller: caller || {
          name: call.callerInfo?.name || 'Anonymous Caller',
          avatar: '',
          isAnonymous: true
        },
        receiver: receiver || { name: 'Unknown', avatar: '' },
        device: device ? {
          vehicleType: device.vehicle.type,
          vehicleModel: `${device.vehicle.make} ${device.vehicle.model}`,
          plateNumber: device.vehicle.plateNumber,
          color: device.vehicle.color,
          installation: device.installation
        } : null,
        isEmergency: call.callerInfo?.emergencyType !== 'general'
      }
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