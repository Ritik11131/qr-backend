const express = require('express');
const { adminAuth } = require('../middleware/auth');
const { adminRateLimit } = require('../middleware/rateLimiter');
const { validateBulkQRGeneration } = require('../middleware/validation');
const { generateQRBatch, getQRInventory, getQRAnalytics } = require('../services/qrService');
const QRCode = require('../models/QRCode');
const User = require('../models/User');
const Device = require('../models/Device');
const Call = require('../models/Call');

const router = express.Router();

// Bulk generate QR codes (ADMIN ONLY)
router.post('/qr/bulk-generate', adminAuth, adminRateLimit, validateBulkQRGeneration, async (req, res) => {
  try {
    const { count, batchNumber, qrType, notes } = req.body;
    const generatedBy = req.user.userId;
    const baseUrl = process.env.CALLER_URL || 'http://localhost:8000';

    console.log(`🏭 Admin ${req.user.email} generating ${count} QR codes`);

    // Check if batch number already exists
    const existingBatch = await QRCode.findOne({ 
      batchNumber: { $regex: batchNumber, $options: 'i' } 
    });
    
    if (existingBatch) {
      return res.status(409).json({ 
        error: 'Batch number already exists',
        code: 'BATCH_EXISTS'
      });
    }

    const result = await generateQRBatch(count, batchNumber, qrType, generatedBy, baseUrl);

    console.log(`✅ Successfully generated ${result.batchInfo.totalGenerated} QR codes`);

    res.status(201).json({
      success: true,
      message: `${result.batchInfo.totalGenerated} QR codes generated successfully`,
      ...result
    });
  } catch (error) {
    console.error('❌ Bulk QR generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR codes',
      code: 'QR_GENERATION_ERROR'
    });
  }
});

// Get QR inventory (ADMIN ONLY)
router.get('/qr/inventory', adminAuth, adminRateLimit, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      batchNumber: req.query.batchNumber,
      qrType: req.query.qrType,
      page: req.query.page || 1,
      limit: req.query.limit || 50,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    console.log(`📊 Admin ${req.user.email} requesting QR inventory`);

    const result = await getQRInventory(filters);

    // Populate linked user information for linked QR codes
    const populatedInventory = await Promise.all(
      result.inventory.map(async (qr) => {
        if (qr.status === 'linked' && qr.linkedTo.userId) {
          const user = await User.findOne({ userId: qr.linkedTo.userId }, 'name email');
          const device = await Device.findOne({ deviceId: qr.linkedTo.deviceId }, 'vehicle');
          
          return {
            ...qr,
            linkedTo: {
              ...qr.linkedTo,
              user: user ? { name: user.name, email: user.email } : null,
              device: device ? device.vehicle : null
            }
          };
        }
        return qr;
      })
    );

    res.json({
      success: true,
      inventory: populatedInventory,
      summary: result.summary,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('❌ QR inventory error:', error);
    res.status(500).json({ 
      error: 'Failed to get QR inventory',
      code: 'INVENTORY_ERROR'
    });
  }
});

// Get QR analytics (ADMIN ONLY)
router.get('/qr/analytics', adminAuth, adminRateLimit, async (req, res) => {
  try {
    const { dateRange = 30 } = req.query;

    console.log(`📈 Admin ${req.user.email} requesting analytics`);

    const analytics = await getQRAnalytics(Number(dateRange));

    // Additional system statistics
    const systemStats = await Promise.all([
      User.countDocuments({ role: 'user', isActive: true }),
      Device.countDocuments({ status: 'active' }),
      Call.countDocuments({ createdAt: { $gte: new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000) } }),
      Call.countDocuments({ 
        'callerInfo.emergencyType': { $ne: 'general' },
        createdAt: { $gte: new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000) }
      })
    ]);

    const [totalUsers, activeDevices, recentCalls, recentEmergencyCalls] = systemStats;

    res.json({
      success: true,
      analytics: {
        ...analytics.analytics,
        systemStats: {
          totalUsers,
          activeDevices,
          recentCalls,
          recentEmergencyCalls,
          emergencyRate: recentCalls > 0 ? (recentEmergencyCalls / recentCalls * 100).toFixed(2) : 0
        }
      },
      dateRange: analytics.dateRange,
      generatedAt: analytics.generatedAt
    });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to get analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// Update QR code status (ADMIN ONLY)
router.put('/qr/:qrId/status', adminAuth, adminRateLimit, async (req, res) => {
  try {
    const { qrId } = req.params;
    const { status, reason } = req.body;

    if (!['available', 'linked', 'suspended', 'damaged'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be: available, linked, suspended, or damaged',
        code: 'INVALID_STATUS'
      });
    }

    const qrCode = await QRCode.findOne({ qrId });
    if (!qrCode) {
      return res.status(404).json({ 
        error: 'QR code not found',
        code: 'QR_NOT_FOUND'
      });
    }

    const oldStatus = qrCode.status;
    qrCode.status = status;
    qrCode.notes = `Status changed from ${oldStatus} to ${status} by admin ${req.user.email}. Reason: ${reason || 'Not specified'}`;

    // If suspending or marking as damaged, handle linked device
    if ((status === 'suspended' || status === 'damaged') && qrCode.linkedTo.deviceId) {
      const device = await Device.findOne({ deviceId: qrCode.linkedTo.deviceId });
      if (device) {
        device.status = status === 'suspended' ? 'inactive' : 'maintenance';
        await device.save();
      }
    }

    await qrCode.save();

    console.log(`🔄 Admin ${req.user.email} changed QR ${qrId} status: ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: `QR code status updated from ${oldStatus} to ${status}`,
      qrCode: {
        qrId: qrCode.qrId,
        oldStatus,
        newStatus: status,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('❌ QR status update error:', error);
    res.status(500).json({ 
      error: 'Failed to update QR status',
      code: 'QR_STATUS_ERROR'
    });
  }
});

// Export QR batch for printing (ADMIN ONLY)
router.get('/qr/export/:batchNumber', adminAuth, adminRateLimit, async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { format = 'json' } = req.query;

    console.log(`📤 Admin ${req.user.email} exporting batch: ${batchNumber}`);

    const qrCodes = await QRCode.find({ 
      batchNumber: { $regex: batchNumber, $options: 'i' } 
    }).sort({ qrId: 1 });

    if (qrCodes.length === 0) {
      return res.status(404).json({ 
        error: 'Batch not found',
        code: 'BATCH_NOT_FOUND'
      });
    }

    const exportData = qrCodes.map(qr => ({
      qrId: qr.qrId,
      qrUrl: qr.qrUrl,
      status: qr.status,
      qrType: qr.qrType,
      createdAt: qr.createdAt
    }));

    if (format === 'csv') {
      const csv = [
        'QR ID,QR URL,Status,Type,Created At',
        ...exportData.map(qr => 
          `${qr.qrId},${qr.qrUrl},${qr.status},${qr.qrType},${qr.createdAt}`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${batchNumber}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      batchNumber,
      totalQRs: exportData.length,
      exportedAt: new Date(),
      qrCodes: exportData
    });
  } catch (error) {
    console.error('❌ QR export error:', error);
    res.status(500).json({ 
      error: 'Failed to export QR batch',
      code: 'QR_EXPORT_ERROR'
    });
  }
});

// Get system dashboard data (ADMIN ONLY)
router.get('/dashboard', adminAuth, adminRateLimit, async (req, res) => {
  try {
    console.log(`📊 Admin ${req.user.email} requesting dashboard data`);

    const today = new Date();
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalQRs,
      linkedQRs,
      totalUsers,
      activeDevices,
      totalCalls,
      emergencyCalls,
      callsLast30Days,
      callsLast7Days,
      recentActivity
    ] = await Promise.all([
      QRCode.countDocuments({ isActive: true }),
      QRCode.countDocuments({ status: 'linked' }),
      User.countDocuments({ role: 'user', isActive: true }),
      Device.countDocuments({ status: 'active' }),
      Call.countDocuments(),
      Call.countDocuments({ 'callerInfo.emergencyType': { $ne: 'general' } }),
      Call.countDocuments({ createdAt: { $gte: last30Days } }),
      Call.countDocuments({ createdAt: { $gte: last7Days } }),
      Call.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('receiverId', 'name email')
    ]);

    const linkageRate = totalQRs > 0 ? (linkedQRs / totalQRs * 100).toFixed(2) : 0;
    const emergencyRate = totalCalls > 0 ? (emergencyCalls / totalCalls * 100).toFixed(2) : 0;

    res.json({
      success: true,
      dashboard: {
        overview: {
          totalQRs,
          linkedQRs,
          linkageRate: `${linkageRate}%`,
          totalUsers,
          activeDevices
        },
        calls: {
          totalCalls,
          emergencyCalls,
          emergencyRate: `${emergencyRate}%`,
          callsLast30Days,
          callsLast7Days
        },
        recentActivity: recentActivity.map(call => ({
          callId: call.callId,
          emergencyType: call.callerInfo.emergencyType,
          urgencyLevel: call.callerInfo.urgencyLevel,
          status: call.status,
          createdAt: call.createdAt,
          vehicle: call.deviceInfo
        }))
      },
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ 
      error: 'Failed to get dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
});

// Get all users (ADMIN ONLY)
router.get('/users', adminAuth, adminRateLimit, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;

    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;

    const users = await User.find(filter, '-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalUsers = await User.countDocuments(filter);

    // Get device counts for each user
    const usersWithDevices = await Promise.all(
      users.map(async (user) => {
        const deviceCount = await Device.countDocuments({ 
          'owner.userId': user.userId,
          status: 'active'
        });
        return {
          ...user.toObject(),
          deviceCount
        };
      })
    );

    res.json({
      success: true,
      users: usersWithDevices,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalItems: totalUsers
      }
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ 
      error: 'Failed to get users',
      code: 'GET_USERS_ERROR'
    });
  }
});

module.exports = router;