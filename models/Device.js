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
    }
  },
  owner: {
    userId: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      required: true,
      index: true
    },
  },
  status: {
    type: String,
    enum: ['active', 'removed'],
    default: 'active',
    index: true
  },
  settings: {
    allowAnonymousCalls: {
      type: Boolean,
      default: true
    },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String, required: true },
        priority: { type: Number, required: true }
      }
    ],
    autoAnswer: {
      type: Boolean,
      default: false
    },
    availableCallMethods: {
      type: [String],
      enum: ['direct', 'masked'],
      default: ['direct']
    }
  }
}, {
  timestamps: true
});

deviceSchema.index({ 'owner.userId': 1, status: 1 });
deviceSchema.index({ createdAt: -1 });
deviceSchema.index({ 'settings.availableCallMethods': 1 });

module.exports = mongoose.model('Device', deviceSchema);