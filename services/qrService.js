const { v4: uuidv4 } = require('uuid');
const QRCode = require('../models/QRCode');

const generateQRBatch = async (count, batchNumber, qrType, generatedBy, baseUrl) => {
  try {
    const qrCodes = [];
    const batchId = `BATCH_${batchNumber}_${Date.now()}`;
    
    console.log(`🔄 Generating ${count} QR codes for batch: ${batchNumber}`);

    for (let i = 1; i <= count; i++) {
      const qrId = `QR_${batchNumber}_${String(i).padStart(6, '0')}`;
      const qrUrl = `${baseUrl}/call?qr=${qrId}`;
      
      const qrCode = {
        qrId,
        qrUrl,
        status: 'available',
        qrType,
        batchNumber: batchId,
        generatedBy,
        emergencyInfo: {
          showOwnerName: true,
          showVehiclePlate: true,
          emergencyContact: '',
          alternateContact: '',
          specialInstructions: ''
        },
        stats: {
          scanCount: 0,
          callCount: 0,
          emergencyCallCount: 0,
          lastScanned: null,
          lastCalled: null
        },
        isActive: true
      };

      qrCodes.push(qrCode);
    }

    // Bulk insert for better performance
    const result = await QRCode.insertMany(qrCodes, { ordered: false });
    
    console.log(`✅ Successfully generated ${result.length} QR codes`);

    return {
      success: true,
      batchInfo: {
        batchNumber: batchId,
        totalGenerated: result.length,
        qrType,
        generatedAt: new Date(),
        generatedBy
      },
      qrCodes: result.map(qr => ({
        qrId: qr.qrId,
        qrUrl: qr.qrUrl,
        status: qr.status
      }))
    };
  } catch (error) {
    console.error('❌ QR batch generation error:', error);
    throw error;
  }
};

const getQRInventory = async (filters = {}) => {
  try {
    const {
      status,
      batchNumber,
      qrType,
      page = 1,
      limit = 50,
      search,
      dateFrom,
      dateTo
    } = filters;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (batchNumber) query.batchNumber = { $regex: batchNumber, $options: 'i' };
    if (qrType) query.qrType = qrType;
    if (search) {
      query.$or = [
        { qrId: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const qrCodes = await QRCode.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalItems = await QRCode.countDocuments(query);

    // Get summary statistics
    const summary = await QRCode.aggregate([
      { $match: {} },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const summaryObj = {
      total: totalItems,
      available: 0,
      linked: 0,
      suspended: 0,
      damaged: 0
    };

    summary.forEach(item => {
      summaryObj[item._id] = item.count;
    });

    return {
      inventory: qrCodes,
      summary: summaryObj,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: Number(limit)
      }
    };
  } catch (error) {
    console.error('❌ QR inventory error:', error);
    throw error;
  }
};

const getQRAnalytics = async (dateRange = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const analytics = await QRCode.aggregate([
      {
        $facet: {
          statusDistribution: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          typeDistribution: [
            { $group: { _id: '$qrType', count: { $sum: 1 } } }
          ],
          usageStats: [
            {
              $group: {
                _id: null,
                totalScans: { $sum: '$stats.scanCount' },
                totalCalls: { $sum: '$stats.callCount' },
                totalEmergencyCalls: { $sum: '$stats.emergencyCallCount' },
                averageScansPerQR: { $avg: '$stats.scanCount' },
                averageCallsPerQR: { $avg: '$stats.callCount' }
              }
            }
          ],
          recentActivity: [
            { $match: { 'stats.lastCalled': { $gte: startDate } } },
            { $sort: { 'stats.lastCalled': -1 } },
            { $limit: 10 },
            {
              $project: {
                qrId: 1,
                'stats.lastCalled': 1,
                'stats.callCount': 1,
                status: 1
              }
            }
          ],
          batchStats: [
            {
              $group: {
                _id: '$batchNumber',
                totalQRs: { $sum: 1 },
                linkedQRs: {
                  $sum: { $cond: [{ $eq: ['$status', 'linked'] }, 1, 0] }
                },
                totalCalls: { $sum: '$stats.callCount' },
                emergencyCalls: { $sum: '$stats.emergencyCallCount' }
              }
            },
            { $sort: { totalCalls: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    return {
      dateRange,
      analytics: analytics[0],
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('❌ QR analytics error:', error);
    throw error;
  }
};

module.exports = {
  generateQRBatch,
  getQRInventory,
  getQRAnalytics
};