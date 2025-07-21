const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('../models/QRCode');
const Device = require('../models/Device');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/rateLimiter');
const { validateQRLink } = require('../middleware/validation');

const router = express.Router();

// Get QR code information (PUBLIC - No auth required)
router.get('/info/:qrId', generalRateLimit, async (req, res) => {
  try {
    const { qrId } = req.params;

    console.log(`🔍 QR info request for: ${qrId}`);

    const qrCode = await QRCode.findOne({ qrId, isActive: true });
    if (!qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found or inactive',
        code: 'QR_NOT_FOUND'
      });
    }

    // Update scan count
    qrCode.stats.scanCount += 1;
    qrCode.stats.lastScanned = new Date();
    await qrCode.save();

    // If QR is not linked, return basic info
    if (qrCode.status !== 'linked') {
      return res.json({
        success: true,
        qrInfo: {
          qrId: qrCode.qrId,
          status: qrCode.status,
          isLinked: false,
          message: qrCode.status === 'available' 
            ? 'This QR code has not been activated yet. Please contact the vehicle owner.'
            : `QR code status: ${qrCode.status}`
        }
      });
    }

    // Get device and owner information
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
        error: 'Device or owner not found',
        code: 'DEVICE_OWNER_NOT_FOUND'
      });
    }

    // Return public information based on privacy settings
    res.json({
      success: true,
      qrInfo: {
        qrId: qrCode.qrId,
        status: qrCode.status,
        isLinked: true,
        linkedAt: qrCode.linkedTo.linkedAt,
        vehicle: {
          type: device.vehicle.type,
          make: device.vehicle.make,
          model: device.vehicle.model,
          color: device.vehicle.color,
          plateNumber: qrCode.emergencyInfo.showVehiclePlate 
            ? device.vehicle.plateNumber 
            : 'Hidden'
        },
        owner: {
          name: qrCode.emergencyInfo.showOwnerName 
            ? owner.name 
            : 'Vehicle Owner',
          isOnline: owner.isOnline,
          lastSeen: owner.lastSeen
        },
        emergencyInfo: {
          emergencyContact: qrCode.emergencyInfo.emergencyContact,
          alternateContact: qrCode.emergencyInfo.alternateContact,
          specialInstructions: qrCode.emergencyInfo.specialInstructions
        },
        allowAnonymousCalls: device.settings.allowAnonymousCalls
      }
    });
  } catch (error) {
    console.error('❌ Error getting QR info:', error);
    res.status(500).json({ 
      error: 'Failed to get QR information',
      code: 'QR_INFO_ERROR'
    });
  }
});

// Link QR code to device (AUTH REQUIRED)
router.post('/link', auth, generalRateLimit, validateQRLink, async (req, res) => {
  try {
    const { qrId, deviceInfo, vehicleInfo, emergencyInfo = {} } = req.body;
    const userId = req.user.userId;

    console.log(`🔗 Linking QR ${qrId} to user ${userId}`);

    // Find QR code
    const qrCode = await QRCode.findOne({ qrId, isActive: true });
    if (!qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found or inactive',
        code: 'QR_NOT_FOUND'
      });
    }

    // Check if QR is already linked
    if (qrCode.status === 'linked') {
      return res.status(400).json({ 
        error: 'QR code is already linked to another device',
        code: 'QR_ALREADY_LINKED'
      });
    }

    // Check if QR is available for linking
    if (qrCode.status !== 'available') {
      return res.status(400).json({ 
        error: `QR code cannot be linked. Current status: ${qrCode.status}`,
        code: 'QR_NOT_AVAILABLE'
      });
    }

    // Check if device serial number is already used
    const existingDevice = await Device.findOne({ 
      'deviceInfo.serialNumber': deviceInfo.serialNumber 
    });
    
    if (existingDevice) {
      return res.status(409).json({ 
        error: 'Device with this serial number is already registered',
        code: 'DEVICE_EXISTS'
      });
    }

    // Create device record
    const deviceId = uuidv4();
    const device = new Device({
      deviceId,
      deviceInfo: {
        model: deviceInfo.model,
        serialNumber: deviceInfo.serialNumber,
        firmwareVersion: deviceInfo.firmwareVersion || '',
        manufacturer: deviceInfo.manufacturer || 'GPS Solutions Inc.'
      },
      vehicle: vehicleInfo,
      owner: {
        userId,
        isPrimary: true,
        relationship: 'owner'
      },
      installation: {
        installedBy: req.user.name,
        installationDate: new Date(),
        installerNotes: `Linked via QR code ${qrId}`
      },
      settings: {
        emergencyContacts: [],
        autoAnswer: false,
        callTimeout: 30,
        allowAnonymousCalls: true
      },
      status: 'active'
    });

    await device.save();

    // Update QR code
    qrCode.status = 'linked';
    qrCode.linkedTo = {
      userId,
      deviceId,
      linkedAt: new Date()
    };
    qrCode.emergencyInfo = {
      showOwnerName: emergencyInfo.showOwnerName !== false,
      showVehiclePlate: emergencyInfo.showVehiclePlate !== false,
      emergencyContact: emergencyInfo.emergencyContact || '',
      alternateContact: emergencyInfo.alternateContact || '',
      specialInstructions: emergencyInfo.specialInstructions || ''
    };

    await qrCode.save();

    // Update user stats
    req.user.stats.devicesLinked += 1;
    await req.user.save();

    console.log(`✅ QR ${qrId} successfully linked to device ${deviceId}`);

    res.json({
      success: true,
      message: 'QR code linked successfully',
      deviceId,
      qrInfo: {
        qrId: qrCode.qrId,
        status: qrCode.status,
        linkedAt: qrCode.linkedTo.linkedAt
      },
      device: {
        deviceId: device.deviceId,
        vehicle: device.vehicle,
        settings: device.settings
      },
      emergencyUrl: qrCode.qrUrl
    });
  } catch (error) {
    console.error('❌ Error linking QR code:', error);
    res.status(500).json({ 
      error: 'Failed to link QR code',
      code: 'QR_LINK_ERROR'
    });
  }
});

// Get user's devices (AUTH REQUIRED)
router.get('/my-devices', auth, generalRateLimit, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    console.log(`📱 Getting devices for user: ${userId}`);

    const devices = await Device.find({ 
      'owner.userId': userId,
      status: { $ne: 'removed' }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Get QR codes for these devices
    const deviceIds = devices.map(d => d.deviceId);
    const qrCodes = await QRCode.find({ 
      'linkedTo.deviceId': { $in: deviceIds } 
    });

    // Combine device and QR information
    const devicesWithQR = devices.map(device => {
      const qrCode = qrCodes.find(qr => qr.linkedTo.deviceId === device.deviceId);
      return {
        deviceId: device.deviceId,
        deviceInfo: device.deviceInfo,
        vehicle: device.vehicle,
        installation: device.installation,
        settings: device.settings,
        status: device.status,
        stats: device.stats,
        qrCode: qrCode ? {
          qrId: qrCode.qrId,
          qrUrl: qrCode.qrUrl,
          stats: qrCode.stats,
          emergencyInfo: qrCode.emergencyInfo
        } : null,
        createdAt: device.createdAt
      };
    });

    const totalDevices = await Device.countDocuments({ 
      'owner.userId': userId,
      status: { $ne: 'removed' }
    });

    res.json({
      success: true,
      devices: devicesWithQR,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalDevices / limit),
        totalItems: totalDevices,
        itemsPerPage: Number(limit)
      },
      summary: {
        totalDevices,
        activeDevices: devices.filter(d => d.status === 'active').length,
        totalCalls: devices.reduce((sum, d) => sum + d.stats.totalCalls, 0),
        emergencyCalls: devices.reduce((sum, d) => sum + d.stats.emergencyCalls, 0)
      }
    });
  } catch (error) {
    console.error('❌ Error getting user devices:', error);
    res.status(500).json({ 
      error: 'Failed to get devices',
      code: 'GET_DEVICES_ERROR'
    });
  }
});

// Update device settings (AUTH REQUIRED)
router.put('/device/:deviceId/settings', auth, generalRateLimit, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { emergencyContacts, autoAnswer, callTimeout, allowAnonymousCalls } = req.body;
    const userId = req.user.userId;

    console.log(`⚙️ Updating settings for device: ${deviceId}`);

    const device = await Device.findOne({ 
      deviceId,
      'owner.userId': userId 
    });

    if (!device) {
      return res.status(404).json({ 
        error: 'Device not found or access denied',
        code: 'DEVICE_NOT_FOUND'
      });
    }

    // Update settings
    const updates = {};
    if (emergencyContacts !== undefined) updates['settings.emergencyContacts'] = emergencyContacts;
    if (autoAnswer !== undefined) updates['settings.autoAnswer'] = autoAnswer;
    if (callTimeout !== undefined) updates['settings.callTimeout'] = callTimeout;
    if (allowAnonymousCalls !== undefined) updates['settings.allowAnonymousCalls'] = allowAnonymousCalls;

    const updatedDevice = await Device.findOneAndUpdate(
      { deviceId },
      updates,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Device settings updated successfully',
      device: {
        deviceId: updatedDevice.deviceId,
        settings: updatedDevice.settings,
        vehicle: updatedDevice.vehicle
      }
    });
  } catch (error) {
    console.error('❌ Error updating device settings:', error);
    res.status(500).json({ 
      error: 'Failed to update device settings',
      code: 'DEVICE_SETTINGS_ERROR'
    });
  }
});

// Unlink QR code (AUTH REQUIRED)
router.post('/unlink/:qrId', auth, generalRateLimit, async (req, res) => {
  try {
    const { qrId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    console.log(`🔓 Unlinking QR ${qrId} from user ${userId}`);

    const qrCode = await QRCode.findOne({ 
      qrId,
      'linkedTo.userId': userId 
    });

    if (!qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found or access denied',
        code: 'QR_NOT_FOUND'
      });
    }

    if (qrCode.status !== 'linked') {
      return res.status(400).json({ 
        error: 'QR code is not currently linked',
        code: 'QR_NOT_LINKED'
      });
    }

    // Find and update device status
    const device = await Device.findOne({ 
      deviceId: qrCode.linkedTo.deviceId 
    });
    
    if (device) {
      device.status = 'removed';
      device.notes = `Unlinked on ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`;
      await device.save();
    }

    // Reset QR code
    qrCode.status = 'available';
    qrCode.linkedTo = {
      userId: null,
      deviceId: null,
      linkedAt: null
    };
    qrCode.notes = `Unlinked on ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`;

    await qrCode.save();

    // Update user stats
    req.user.stats.devicesLinked = Math.max(0, req.user.stats.devicesLinked - 1);
    await req.user.save();

    console.log(`✅ QR ${qrId} successfully unlinked`);

    res.json({
      success: true,
      message: 'QR code unlinked successfully',
      qrId,
      newStatus: 'available'
    });
  } catch (error) {
    console.error('❌ Error unlinking QR code:', error);
    res.status(500).json({ 
      error: 'Failed to unlink QR code',
      code: 'QR_UNLINK_ERROR'
    });
  }
});

// Get device call history (AUTH REQUIRED)
router.get('/device/:deviceId/calls', auth, generalRateLimit, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { page = 1, limit = 20, emergencyOnly } = req.query;
    const userId = req.user.userId;

    // Verify device ownership
    const device = await Device.findOne({ 
      deviceId,
      'owner.userId': userId 
    });

    if (!device) {
      return res.status(404).json({ 
        error: 'Device not found or access denied',
        code: 'DEVICE_NOT_FOUND'
      });
    }

    const Call = require('../models/Call');
    
    const filter = { 'deviceInfo.deviceId': deviceId };
    if (emergencyOnly === 'true') {
      filter['callerInfo.emergencyType'] = { $ne: 'general' };
    }

    const calls = await Call.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalCalls = await Call.countDocuments(filter);

    res.json({
      success: true,
      device: {
        deviceId: device.deviceId,
        vehicle: device.vehicle
      },
      calls,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCalls / limit),
        totalItems: totalCalls
      }
    });
  } catch (error) {
    console.error('❌ Error getting device calls:', error);
    res.status(500).json({ 
      error: 'Failed to get device calls',
      code: 'DEVICE_CALLS_ERROR'
    });
  }
});

module.exports = router;