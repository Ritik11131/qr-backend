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
      deviceId: Joi.string().optional()
    }).required(),
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
    callMethod: Joi.string().valid('direct', 'masked').default('direct'),
    callerInfo: Joi.object({
      name: Joi.string().max(100).optional(),
      phone: Joi.string().min(5).max(20).optional(),
      location: Joi.string().max(200).optional(),
      description: Joi.string().max(500).optional(),
      additionalInfo: Joi.string().max(500).optional(),
      timestamp: Joi.date().iso().optional()
    }).optional(),
    emergencyType: Joi.string().valid('accident', 'breakdown', 'theft', 'medical', 'general').default('general'),
    urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium')
  });

  // Custom validation for masked calling
  const customValidation = (value, helpers) => {
    if (value.callMethod === 'masked' && (!value.callerInfo || !value.callerInfo.phone)) {
      return helpers.error('custom.maskedCallRequiresPhone');
    }
    return value;
  };

  const schemaWithCustom = schema.custom(customValidation).messages({
    'custom.maskedCallRequiresPhone': 'Caller phone number is required for masked calling'
  });
  const { error } = schemaWithCustom.validate(req.body);
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

// Device settings validation
const validateDeviceSettings = (req, res, next) => {
  const schema = Joi.object({
    emergencyContacts: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        relationship: Joi.string().required(),
        priority: Joi.number().integer().min(1).max(10).required()
      })
    ).max(5).optional(),
    autoAnswer: Joi.boolean().optional(),
    allowAnonymousCalls: Joi.boolean().optional(),
    callMethods: Joi.array().items(
      Joi.string().valid('direct', 'masked')
    ).optional()
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
  validateDeviceSettings,
  validateBulkQRGeneration
};