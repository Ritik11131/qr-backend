const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Import routes
const qrRoutes = require('./routes/qr');
const callRoutes = require('./routes/calls');
const agoraRoutes = require('./routes/agora');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Import middleware
const { globalRateLimit } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.CALLER_URL || 'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:8000'
  ],
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(globalRateLimit);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_vehicle_emergency', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'QR Vehicle Emergency System API',
    version: '2.0.0',
    description: 'Complete API for QR-based vehicle emergency calling system',
    endpoints: {
      auth: '/api/auth',
      qr: '/api/qr',
      calls: '/api/calls',
      agora: '/api/agora',
      notifications: '/api/notifications',
      admin: '/api/admin'
    },
    documentation: 'See README.md for complete API documentation'
  });
});

// API routes
app.use('/api/qr', qrRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: ['/api', '/health']
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 QR Vehicle Emergency System API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API info: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});