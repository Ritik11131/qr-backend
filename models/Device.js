const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    model: {
      type: String,
      required: true
    },
    serialNumber: {
      type: String,
      required: true,
      unique: true
    },
    firmwareVersion: {
      type: String,
      default: ''
    },
    manufacturer: {
      type: String,
      default: 'GPS Solutions Inc.'
    }
  },
  vehicle: {
    type: {
      type: String,
      enum: ['car', 'truck', 'motorcycle', 'van', 'bus', 'trailer', 'other'],
      required: true
    },
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 2
    },
    plateNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    color: {
      type: String,
      required: true
    },
    vin: {
      type: String,
      default: ''
    }
  },
  owner: {
    userId: {
      type: String,
      required: true,
      index: true
    },
    isPrimary: {
      type: Boolean,
      default: true
    },
    relationship: {
      type: String,
      enum: ['owner', 'family', 'employee', 'other'],
      default: 'owner'
    }
  },
  installation: {
    installedBy: {
      type: String,
      required: true
    },
    installationDate: {
      type: Date,
      required: true
    },
    installerNotes: {
      type: String,
      default: ''
    },
    warrantyExpiry: {
      type: Date
    }
  },
  location: {
    lastKnownLat: {
      type: Number,
      default: null
    },
    lastKnownLng: {
      type: Number,
      default: null
    },
    lastLocationUpdate: {
      type: Date,
      default: null
    },
    address: {
      type: String,
      default: ''
    }
  },
  settings: {
    emergencyContacts: [{
      name: String,
      phone: String,
      relationship: String,
      priority: Number
    }],
    autoAnswer: {
      type: Boolean,
      default: false
    },
    callTimeout: {
      type: Number,
      default: 30 // seconds
    },
    allowAnonymousCalls: {
      type: Boolean,
      default: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'removed'],
    default: 'active',
    index: true
  },
  stats: {
    totalCalls: {
      type: Number,
      default: 0
    },
    emergencyCalls: {
      type: Number,
      default: 0
    },
    lastCallDate: {
      type: Date,
      default: null
    },
    uptime: {
      type: Number,
      default: 0 // hours
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
deviceSchema.index({ 'owner.userId': 1, status: 1 });
deviceSchema.index({ 'vehicle.plateNumber': 1 });
deviceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Device', deviceSchema);