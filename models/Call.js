const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  callerId: {
    type: String,
    default: null, // null for anonymous callers
    index: true
  },
  receiverId: {
    type: String,
    required: true,
    index: true
  },
  qrCodeId: {
    type: String,
    required: true,
    index: true
  },
  channelName: {
    type: String,
    required: true
  },
  callType: {
    type: String,
    enum: ['audio', 'video'],
    default: 'audio'
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'answered', 'rejected', 'ended', 'missed', 'failed'],
    default: 'initiated',
    index: true
  },
  callerInfo: {
    name: {
      type: String,
      default: 'Anonymous Caller'
    },
    phone: {
      type: String,
      default: ''
    },
    location: {
      type: String,
      default: ''
    },
    emergencyType: {
      type: String,
      enum: ['accident', 'breakdown', 'theft', 'medical', 'general'],
      default: 'general',
      index: true
    },
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    additionalInfo: {
      type: String,
      default: ''
    }
  },
  deviceInfo: {
    deviceId: {
      type: String,
      required: true
    }
    // No other required fields
  },
  timing: {
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    answeredAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    duration: {
      type: Number,
      default: 0 // seconds
    }
  },
  endedBy: {
    type: String,
    enum: ['caller', 'receiver', 'system', 'timeout', null],
    default: null
  },
  callQuality: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    feedback: {
      type: String,
      default: ''
    }
  },
  anonymousCall: {
    type: Boolean,
    default: true
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    location: {
      lat: Number,
      lng: Number
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
callSchema.index({ receiverId: 1, createdAt: -1 });
callSchema.index({ qrCodeId: 1, createdAt: -1 });
callSchema.index({ status: 1, 'callerInfo.emergencyType': 1 });
callSchema.index({ 'timing.initiatedAt': -1 });

// Virtual for call duration calculation
callSchema.virtual('calculatedDuration').get(function() {
  if (this.timing.answeredAt && this.timing.endedAt) {
    return Math.floor((this.timing.endedAt - this.timing.answeredAt) / 1000);
  }
  return 0;
});

module.exports = mongoose.model('Call', callSchema);