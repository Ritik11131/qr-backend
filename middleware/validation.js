const Joi = require('joi');

// User registration validation
const validateUserRegistration = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    password: Joi.string().min(6).max(128).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

// User login validation
const validateUserLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

// QR link validation
const validateQRLink = (req, res, next) => {
  const schema = Joi.object({
    qrId: Joi.string().required(),
    deviceInfo: Joi.object({
      model: Joi.string().required(),
      serialNumber: Joi.string().required(),
      firmwareVersion: Joi.string().optional(),
      manufacturer: Joi.string().optional()
    }).required(),
    vehicleInfo: Joi.object({
      type: Joi.string().valid('car', 'truck', 'motorcycle', 'van', 'bus', 'trailer', 'other').required(),
      make: Joi.string().required(),
      model: Joi.string().required(),
      year: Joi.number().min(1900).max(new Date().getFullYear() + 2).optional(),
      plateNumber: Joi.string().required(),
      color: Joi.string().required(),
      vin: Joi.string().optional()
    }).required(),
    emergencyInfo: Joi.object({
      showOwnerName: Joi.boolean().default(true),
      showVehiclePlate: Joi.boolean().default(true),
      emergencyContact: Joi.string().optional(),
      alternateContact: Joi.string().optional(),
      specialInstructions: Joi.string().max(500).optional()
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

// Call initiation validation
const validateCallInitiation = (req, res, next) => {
  const schema = Joi.object({
    qrId: Joi.string().required(),
    callType: Joi.string().valid('audio', 'video').default('audio'),
    callerInfo: Joi.object({
      name: Joi.string().max(100).optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
      location: Joi.string().max(200).optional(),
      description: Joi.string().max(500).optional(),
      additionalInfo: Joi.string().max(500).optional()
    }).optional(),
    emergencyType: Joi.string().valid('accident', 'breakdown', 'theft', 'medical', 'general').default('general'),
    urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

// Bulk QR generation validation
const validateBulkQRGeneration = (req, res, next) => {
  const schema = Joi.object({
    count: Joi.number().min(1).max(20000).required(),
    batchNumber: Joi.string().required(),
    qrType: Joi.string().valid('sticker', 'card', 'magnet', 'plate').default('sticker'),
    notes: Joi.string().max(500).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateQRLink,
  validateCallInitiation,
  validateBulkQRGeneration
};