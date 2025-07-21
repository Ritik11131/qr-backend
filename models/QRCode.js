const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  qrId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  qrUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'linked', 'suspended', 'damaged'],
    default: 'available',
    index: true
  },
  qrType: {
    type: String,
    enum: ['sticker', 'card', 'magnet', 'plate'],
    default: 'sticker'
  },
  batchNumber: {
    type: String,
    required: true,
    index: true
  },
  generatedBy: {
    type: String,
    required: true
  },
  linkedTo: {
    userId: {
      type: String,
      default: null,
      index: true
    },
    deviceId: {
      type: String,
      default: null,
      index: true
    },
    linkedAt: {
      type: Date,
      default: null
    }
  },
  emergencyInfo: {
    showOwnerName: {
      type: Boolean,
      default: true
    },
    showVehiclePlate: {
      type: Boolean,
      default: true
    },
    emergencyContact: {
      type: String,
      default: ''
    },
    alternateContact: {
      type: String,
      default: ''
    },
    specialInstructions: {
      type: String,
      default: ''
    }
  },
  stats: {
    scanCount: {
      type: Number,
      default: 0
    },
    callCount: {
      type: Number,
      default: 0
    },
    emergencyCallCount: {
      type: Number,
      default: 0
    },
    lastScanned: {
      type: Date,
      default: null
    },
    lastCalled: {
      type: Date,
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for performance
qrCodeSchema.index({ status: 1, batchNumber: 1 });
qrCodeSchema.index({ 'linkedTo.userId': 1 });
qrCodeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QRCode', qrCodeSchema);