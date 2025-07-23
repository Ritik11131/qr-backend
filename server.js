const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import configuration and database
const config = require('./config/app');
const database = require('./config/database');
const app = express();
const server = http.createServer(app);

// Validate configuration
try {
  config.validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  if (config.isProduction()) {
    process.exit(1);
  }
}

// Get configuration
const corsOptions = {
  origin: config.get('cors.origins'),
  methods: config.get('cors.methods'),
  allowedHeaders: config.get('cors.allowedHeaders'),
  credentials: config.get('cors.credentials')
};
// Enhanced Socket.IO configuration
const io = socketIo(server, {
  cors: corsOptions,
  transports: config.get('socketIO.transports'),
  allowEIO3: config.get('socketIO.allowEIO3'),
  pingTimeout: config.get('socketIO.pingTimeout'),
  pingInterval: config.get('socketIO.pingInterval')
});

// Make io available to routes
app.set('io', io);
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
app.use(helmet(config.get('security.helmet')));
app.use(cors(corsOptions));
app.use(compression());

// Logging middleware
if (config.get('logging.enableConsole')) {
  app.use(morgan(config.get('logging.format')));
}

app.use(express.json({ limit: config.get('server.maxRequestSize') }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(globalRateLimit);

// Connect to database
database.connect().catch((error) => {
  console.error('❌ Failed to connect to database:', error);
  process.exit(1);
});

// Enhanced Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('join-user', (userId) => {
    socket.join(userId);
    console.log(`🏠 User ${userId} joined room`);
    socket.emit('joined', { userId, socketId: socket.id });
  });

  socket.on('call-initiated', (data) => {
    console.log('📞 Call initiated via socket:', data.callId);
    socket.to(data.receiverId).emit('incoming-call', data);
  });

  socket.on('call-answered', (data) => {
    console.log('✅ Call answered via socket:', data.callId);
    socket.to(data.callerId).emit('call-accepted', data);
  });

  socket.on('call-rejected', (data) => {
    console.log('❌ Call rejected via socket:', data.callId);
    socket.to(data.callerId).emit('call-rejected', data);
  });

  socket.on('call-ended', (data) => {
    console.log('📴 Call ended via socket:', data.callId);
    socket.to(data.participantId).emit('call-ended', data);
  });

  socket.on('masked-call-update', (data) => {
    console.log('📞 Masked call update via socket:', data.callId);
    socket.to(data.participantId).emit('masked-call-update', data);
  });
  socket.on('emergency-alert', (data) => {
    console.log('🚨 Emergency alert:', data);
    socket.broadcast.emit('emergency-alert', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('👋 User disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('🔥 Socket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = database.getConnectionStatus();
  const maskedCallingService = require('./services/maskedCallingService');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.get('server.apiVersion'),
    environment: config.get('server.environment'),
    database: {
      status: dbStatus.isConnected ? 'connected' : 'disconnected',
      host: dbStatus.host,
      name: dbStatus.name
    },
    services: {
      maskedCalling: maskedCallingService.getConfig()
    },
    uptime: process.uptime()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'QR Vehicle Emergency System API',
    version: config.get('server.apiVersion'),
    description: 'Complete API for QR-based vehicle emergency calling system',
    environment: config.get('server.environment'),
    endpoints: {
      qr: '/api/qr',
      calls: '/api/calls',
      agora: '/api/agora',
      notifications: '/api/notifications',
      admin: '/api/admin'
    },
    features: {
      directCalling: true,
      maskedCalling: require('./services/maskedCallingService').isAvailable(),
      pushNotifications: config.get('notifications.enabled'),
      realTimeUpdates: true
    },
    documentation: 'See README.md for complete API documentation',
    support: {
      health: '/health',
      version: config.get('server.apiVersion')
    }
  });
});

// Configuration endpoint (for debugging in development)
if (config.isDevelopment()) {
  app.get('/config', (req, res) => {
    const safeConfig = { ...config.getAll() };
    
    // Remove sensitive information
    delete safeConfig.jwt.secret;
    delete safeConfig.agora.appCertificate;
    delete safeConfig.firebase.privateKey;
    delete safeConfig.maskedCalling.apiKey;
    
    res.json({
      success: true,
      config: safeConfig,
      note: 'Sensitive values have been removed for security'
    });
  });
}
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
    availableEndpoints: ['/api', '/health'],
    documentation: 'See /api for available endpoints'
  });
});

const PORT = config.get('server.port');
const HOST = config.get('server.host');
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 QR Vehicle Emergency System API Started');
  console.log('='.repeat(50));
  console.log(`📍 Server: http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API info: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${config.get('server.environment')}`);
  console.log(`📦 Version: ${config.get('server.apiVersion')}`);
  console.log(`🔧 Masked Calling: ${require('./services/maskedCallingService').isAvailable() ? 'Enabled' : 'Disabled'}`);
  console.log('='.repeat(50));
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    database.disconnect().then(() => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    }).catch((error) => {
      console.error('❌ Error closing database connection:', error);
      process.exit(1);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    database.disconnect().then(() => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    }).catch((error) => {
      console.error('❌ Error closing database connection:', error);
      process.exit(1);
    });
  });
});
module.exports = { app, io };